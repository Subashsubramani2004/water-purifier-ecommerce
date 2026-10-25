
import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Droplets,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Users,
  Pencil,
  X,
  Save,
  Eye,
  Building2,
Mail,
Phone,
} from "lucide-react";

import { auth, db } from "./services/firebase";
import {
  loginUser,
  logoutUser,
  registerCustomer,
} from "./services/auth";
import "./App.css";

const EMPTY_STATS = {
  products: 0,
  orders: 0,
  pendingOrders: 0,
  dealerApplications: 0,
  lowStock: 0,
  revenue: 0,
};

const EMPTY_PRODUCT = {
  name: "",
  brand: "",
  category: "",
  description: "",
  imageUrl: "",
  customerPrice: "",
  stock: "",
  active: true,
};

const ORDER_STATUSES = [
  "pending_payment",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(timestamp) {
  if (!timestamp) return "Date unavailable";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readableStatus(status) {
  return String(status || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function friendlyError(error) {
  if (error?.code === "permission-denied") {
    return "Firebase denied this action. Check your admin account and Firestore rules.";
  }

  if (error?.code === "unavailable") {
    return "Firebase is temporarily unavailable. Please try again.";
  }

  return error?.message || "Something went wrong. Please try again.";
}

function AdminSidebar({ view, setView, onSignOut }) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#dashboard"
        onClick={() => setView("dashboard")}
      >
        <span className="brand-icon">
          <Droplets size={24} />
        </span>
        <span>
          <strong>PureFlow</strong>
          <small>WATER SOLUTIONS</small>
        </span>
      </a>

      <div className="sidebar-label">WORKSPACE</div>

      <button
        type="button"
        className={`nav-item ${
          view === "dashboard" ? "nav-item-active" : "nav-item-muted"
        }`}
        onClick={() => setView("dashboard")}
      >
        <LayoutDashboard size={19} />
        <span>Dashboard</span>
      </button>

      <button
        type="button"
        className={`nav-item ${
          view === "products" ? "nav-item-active" : "nav-item-muted"
        }`}
        onClick={() => setView("products")}
      >
        <Package size={19} />
        <span>Products</span>
      </button>

      <button
        type="button"
        className={`nav-item ${
          view === "orders" ? "nav-item-active" : "nav-item-muted"
        }`}
        onClick={() => setView("orders")}
      >
        <ShoppingCart size={19} />
        <span>Orders</span>
      </button>

      
<button
  type="button"
  className={`nav-item ${
    view === "dealers" ? "nav-item-active" : "nav-item-muted"
  }`}
  onClick={() => setView("dealers")}
>
  <Users size={19} />
  <span>Dealers</span>
</button>


      <div className="sidebar-bottom">
        <div className="secure-note">
          <ShieldCheck size={18} />
          <span>Administrator access</span>
        </div>

        <button
          className="sidebar-signout"
          onClick={onSignOut}
          type="button"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function AdminTopbar({ profile, view }) {
  const pageNames = {
    dashboard: "Dashboard",
    products: "Products",
    orders: "Orders",
  };

  return (
    <header className="topbar">
      <div className="breadcrumb">
        Workspace <span>/</span>{" "}
        <strong>{pageNames[view] || "Dashboard"}</strong>
      </div>

      <div className="topbar-user">
        <div className="admin-avatar">
          {(profile.name || "A").charAt(0).toUpperCase()}
        </div>
        <div className="topbar-user-info">
          <strong>{profile.name || "Administrator"}</strong>
          <span>Administrator</span>
        </div>
      </div>
    </header>
  );
}

/* ---------------- PRODUCT MANAGEMENT ---------------- */

function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [formError, setFormError] = useState("");

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setError("");

    try {
      const snapshot = await getDocs(collection(db, "products"));

      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      list.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );

      setProducts(list);
    } catch (err) {
      console.error("Products loading failed:", err);
      setError(friendlyError(err));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function startAddProduct() {
    setEditingId(null);
    setProductForm({ ...EMPTY_PRODUCT });
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function startEditProduct(product) {
    setEditingId(product.id);
    setProductForm({
      name: product.name || "",
      brand: product.brand || "",
      category: product.category || "",
      description: product.description || "",
      imageUrl: product.imageUrl || "",
      customerPrice: String(product.customerPrice ?? ""),
      stock: String(product.stock ?? ""),
      active: product.active === true,
    });
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function updateProductField(event) {
    const { name, value, type, checked } = event.target;

    setProductForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleProductSubmit(event) {
    event.preventDefault();
    setFormError("");
    setNotice("");

    const name = productForm.name.trim();
    const price = Number(productForm.customerPrice);
    const stock = Number(productForm.stock);

    if (!name) {
      setFormError("Product name is required.");
      return;
    }

    if (
      productForm.customerPrice === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      setFormError("Enter a valid customer price of 0 or more.");
      return;
    }

    if (
      productForm.stock === "" ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setFormError("Stock must be a whole number of 0 or more.");
      return;
    }

    if (productForm.imageUrl.trim()) {
      try {
        const imageUrl = new URL(productForm.imageUrl.trim());

        if (!["http:", "https:"].includes(imageUrl.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        setFormError(
          "Enter a valid image URL beginning with https:// or http://."
        );
        return;
      }
    }

    const productData = {
      name,
      brand: productForm.brand.trim(),
      category: productForm.category.trim(),
      description: productForm.description.trim(),
      imageUrl: productForm.imageUrl.trim(),
      customerPrice: price,
      stock,
      active: productForm.active === true,
      updatedAt: serverTimestamp(),
    };

    setSaving(true);

    try {
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), productData);
        setNotice("Product updated successfully.");
      } else {
        await addDoc(collection(db, "products"), {
          ...productData,
          createdAt: serverTimestamp(),
        });
        setNotice("Product added successfully.");
      }

      setFormOpen(false);
      setEditingId(null);
      setProductForm({ ...EMPTY_PRODUCT });
      await loadProducts();
    } catch (err) {
      console.error("Product save failed:", err);
      setFormError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleProductStatus(product) {
    const nextActive = product.active !== true;
    const action = nextActive ? "activate" : "deactivate";

    if (
      !window.confirm(
        `Are you sure you want to ${action} "${product.name}"?`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await updateDoc(doc(db, "products", product.id), {
        active: nextActive,
        updatedAt: serverTimestamp(),
      });

      setNotice(
        nextActive
          ? "Product activated successfully."
          : "Product deactivated successfully."
      );

      await loadProducts();
    } catch (err) {
      console.error("Product status update failed:", err);
      setError(friendlyError(err));
    }
  }

  const filteredProducts = products.filter((product) => {
    const search = searchTerm.trim().toLowerCase();

    const matchesSearch =
      !search ||
      [product.name, product.brand, product.category, product.description]
        .some((value) => String(value || "").toLowerCase().includes(search));

    const isActive = product.active === true;

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && isActive) ||
      (filter === "inactive" && !isActive);

    return matchesSearch && matchesFilter;
  });

  const activeCount = products.filter(
    (item) => item.active === true
  ).length;

  const inactiveCount = products.length - activeCount;

  return (
    <div className="dashboard-content">
      <section className="page-heading">
        <div>
          <p className="eyebrow">STORE CATALOG</p>
          <h1>Product Management</h1>
          <p className="page-subtitle">
            Add products, update pricing and manage inventory.
          </p>
        </div>

        <button
          className="primary-action"
          type="button"
          onClick={startAddProduct}
        >
          <Plus size={18} />
          Add product
        </button>
      </section>

      {error && (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>Unable to load or update products</strong>
            <p>{error}</p>
            <button type="button" onClick={loadProducts}>
              Try again
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="product-notice" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="product-summary-grid">
        <article className="product-summary-card">
          <span>Total products</span>
          <strong>{products.length}</strong>
        </article>
        <article className="product-summary-card">
          <span>Active products</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="product-summary-card">
          <span>Inactive products</span>
          <strong>{inactiveCount}</strong>
        </article>
      </section>

      <section className="panel product-list-panel">
        <div className="product-toolbar">
          <label className="product-search">
            <Search size={18} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, brand or category..."
              aria-label="Search products"
            />
          </label>

          <select
            className="product-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter products"
          >
            <option value="all">All products</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>

          <button
            type="button"
            className="refresh-button"
            onClick={loadProducts}
            disabled={loadingProducts}
          >
            <RefreshCw
              size={16}
              className={loadingProducts ? "spin" : ""}
            />
            Refresh
          </button>
        </div>

        {loadingProducts ? (
          <div className="empty-state">Loading products from Firebase...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <Package size={30} />
            <strong>
              {products.length ? "No matching products" : "No products yet"}
            </strong>
            <span>
              {products.length
                ? "Try a different search or filter."
                : "Choose Add product to create your first product."}
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Customer price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="product-name-cell">
                        {product.imageUrl ? (
                          <img
                            className="product-thumbnail"
                            src={product.imageUrl}
                            alt=""
                            onError={(event) => {
                              event.currentTarget.style.visibility = "hidden";
                            }}
                          />
                        ) : (
                          <div className="product-thumbnail product-thumbnail-empty">
                            <Droplets size={20} />
                          </div>
                        )}
                        <div className="product-name-info">
                          <strong>{product.name || "Unnamed product"}</strong>
                          <span>{product.brand || "No brand"}</span>
                        </div>
                      </div>
                    </td>
                    <td>{product.category || "—"}</td>
                    <td className="amount-cell">
                      {formatCurrency(product.customerPrice)}
                    </td>
                    <td>
                      <span
                        className={
                          Number(product.stock) <= 5 ? "stock-cell-low" : ""
                        }
                      >
                        {Number(product.stock) || 0}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          product.active === true
                            ? "product-active-pill"
                            : "product-inactive-pill"
                        }`}
                      >
                        {product.active === true ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="product-actions">
                        <button
                          type="button"
                          className="icon-action"
                          title="Edit product"
                          aria-label={`Edit ${product.name}`}
                          onClick={() => startEditProduct(product)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="status-action"
                          onClick={() => toggleProductStatus(product)}
                        >
                          {product.active === true ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="product-modal-backdrop">
          <section
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
          >
            <header className="product-modal-heading">
              <div>
                <p className="eyebrow">
                  {editingId ? "UPDATE CATALOG" : "NEW CATALOG ITEM"}
                </p>
                <h2 id="product-form-title">
                  {editingId ? "Edit product" : "Add product"}
                </h2>
                <p>Fields marked * are required.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close form"
                onClick={() => {
                  if (!saving) {
                    setFormOpen(false);
                    setFormError("");
                  }
                }}
                disabled={saving}
              >
                <X size={21} />
              </button>
            </header>

            <form className="product-form" onSubmit={handleProductSubmit}>
              <div className="product-form-grid">
                <label>
                  Product name *
                  <input
                    name="name"
                    value={productForm.name}
                    onChange={updateProductField}
                    placeholder="e.g. PureFlow RO Purifier"
                    required
                    maxLength={120}
                  />
                </label>

                <label>
                  Brand
                  <input
                    name="brand"
                    value={productForm.brand}
                    onChange={updateProductField}
                    placeholder="e.g. PureFlow"
                    maxLength={80}
                  />
                </label>

                <label>
                  Category
                  <input
                    name="category"
                    value={productForm.category}
                    onChange={updateProductField}
                    placeholder="e.g. RO Purifier"
                    maxLength={80}
                  />
                </label>

                <label>
                  Customer price (₹) *
                  <input
                    name="customerPrice"
                    type="number"
                    value={productForm.customerPrice}
                    onChange={updateProductField}
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

                <label>
                  Available stock *
                  <input
                    name="stock"
                    type="number"
                    value={productForm.stock}
                    onChange={updateProductField}
                    min="0"
                    step="1"
                    required
                  />
                </label>

                <label>
                  Image URL
                  <input
                    name="imageUrl"
                    type="url"
                    value={productForm.imageUrl}
                    onChange={updateProductField}
                    placeholder="https://example.com/product.jpg"
                  />
                </label>

                <label className="product-description-field">
                  Description
                  <textarea
                    name="description"
                    value={productForm.description}
                    onChange={updateProductField}
                    placeholder="Describe the product and its features..."
                    rows={4}
                    maxLength={2000}
                  />
                </label>
              </div>

              <label className="product-active-toggle">
                <input
                  name="active"
                  type="checkbox"
                  checked={productForm.active}
                  onChange={updateProductField}
                />
                <span>
                  <strong>Product is active</strong>
                  <small>
                    Active products can be displayed in the customer catalog.
                  </small>
                </span>
              </label>

              {formError && (
                <div className="product-form-error" role="alert">
                  <AlertCircle size={18} />
                  <span>{formError}</span>
                </div>
              )}

              <footer className="product-form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setFormOpen(false);
                    setFormError("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-action"
                  disabled={saving}
                >
                  <Save size={17} />
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save changes"
                      : "Create product"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------------- ORDER MANAGEMENT ---------------- */

function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setError("");

    try {
      const snapshot = await getDocs(collection(db, "orders"));

      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      list.sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() ?? 0) -
          (a.createdAt?.toMillis?.() ?? 0)
      );

      setOrders(list);

      // Refresh the open detail view if its order still exists.
      setSelectedOrder((current) =>
        current ? list.find((order) => order.id === current.id) || null : null
      );
    } catch (err) {
      console.error("Orders loading failed:", err);
      setError(friendlyError(err));
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((order) => {
    const search = searchTerm.trim().toLowerCase();

    const searchableText = [
      order.id,
      order.customer?.name,
      order.customer?.email,
      order.customer?.phone,
      order.deliveryAddress?.name,
      order.deliveryAddress?.phone,
    ]
      .map((value) => String(value || ""))
      .join(" ")
      .toLowerCase();

    const matchesSearch = !search || searchableText.includes(search);

    const matchesStatus =
      statusFilter === "all" || order.orderStatus === statusFilter;

    const matchesPayment =
      paymentFilter === "all" || order.paymentStatus === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  async function updateOrderStatus(order, nextStatus) {
    if (!nextStatus || nextStatus === order.orderStatus) return;

    const confirmed = window.confirm(
      `Change order #${order.id.slice(0, 7)} to "${readableStatus(nextStatus)}"?`
    );

    if (!confirmed) return;

    setUpdatingId(order.id);
    setError("");
    setNotice("");

    try {
      // Do not modify paymentStatus here. Payment processing is a separate
      // integration and must be verified independently.
      await updateDoc(doc(db, "orders", order.id), {
        orderStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });

      setNotice(`Order #${order.id.slice(0, 7)} status updated.`);
      await loadOrders();
    } catch (err) {
      console.error("Order status update failed:", err);
      setError(friendlyError(err));
    } finally {
      setUpdatingId(null);
    }
  }

  const pendingCount = orders.filter((order) =>
    ["pending", "pending_payment"].includes(order.orderStatus)
  ).length;

  const paidCount = orders.filter(
    (order) => order.paymentStatus === "paid"
  ).length;

  const unpaidCount = orders.filter(
    (order) => order.paymentStatus !== "paid"
  ).length;

  function getOrderItems(order) {
    return Array.isArray(order.items) ? order.items : [];
  }

  function getItemName(item) {
    return item.name || item.productName || item.title || "Product";
  }

  function getItemQuantity(item) {
    return Number(item.quantity) || 1;
  }

  function getItemPrice(item) {
    return Number(item.price ?? item.customerPrice ?? item.unitPrice) || 0;
  }

  return (
    <div className="dashboard-content">
      <section className="page-heading">
        <div>
          <p className="eyebrow">ORDER OPERATIONS</p>
          <h1>Order Management</h1>
          <p className="page-subtitle">
            Review customer orders and manage fulfilment status.
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={loadOrders}
          disabled={loadingOrders}
        >
          <RefreshCw
            size={17}
            className={loadingOrders ? "spin" : ""}
          />
          Refresh orders
        </button>
      </section>

      {error && (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>Order operation failed</strong>
            <p>{error}</p>
            <button type="button" onClick={loadOrders}>
              Try again
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="product-notice" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="product-summary-grid">
        <article className="product-summary-card">
          <span>Total orders</span>
          <strong>{orders.length}</strong>
        </article>
        <article className="product-summary-card">
          <span>Pending orders</span>
          <strong>{pendingCount}</strong>
        </article>
        <article className="product-summary-card">
          <span>Paid / unpaid</span>
          <strong>
            {paidCount} / {unpaidCount}
          </strong>
        </article>
      </section>

      <section className="panel product-list-panel">
        <div className="product-toolbar">
          <label className="product-search">
            <Search size={18} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search order ID, customer or email..."
              aria-label="Search orders"
            />
          </label>

          <select
            className="product-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by order status"
          >
            <option value="all">All order statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {readableStatus(status)}
              </option>
            ))}
          </select>

          <select
            className="product-filter"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            aria-label="Filter by payment status"
          >
            <option value="all">All payment statuses</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {loadingOrders ? (
          <div className="empty-state">Loading orders from Firebase...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart size={30} />
            <strong>
              {orders.length ? "No matching orders" : "No orders yet"}
            </strong>
            <span>
              {orders.length
                ? "Try changing the search or filters."
                : "Customer orders will appear here after checkout."}
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Order status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>#{order.id.slice(0, 7)}</strong>
                    </td>
                    <td>
                      <div className="product-name-info">
                        <strong>{order.customer?.name || "Customer"}</strong>
                        <span>{order.customer?.email || order.uid || "—"}</span>
                      </div>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td className="amount-cell">
                      {formatCurrency(order.subtotal)}
                    </td>
                    <td>
                      <span className="status-pill">
                        {readableStatus(order.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      <span className="status-pill">
                        {readableStatus(order.orderStatus)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-action"
                        title="View order details"
                        aria-label={`View order ${order.id}`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedOrder && (
        <div
          className="product-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedOrder(null);
            }
          }}
        >
          <section
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
          >
            <header className="product-modal-heading">
              <div>
                <p className="eyebrow">ORDER DETAILS</p>
                <h2 id="order-detail-title">
                  Order #{selectedOrder.id.slice(0, 7)}
                </h2>
                <p>{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Close order details"
                onClick={() => setSelectedOrder(null)}
              >
                <X size={21} />
              </button>
            </header>

            <div className="product-form">
              <h3>Customer</h3>
              <p>
                <strong>Name:</strong>{" "}
                {selectedOrder.customer?.name || "Not provided"}
              </p>
              <p>
                <strong>Email:</strong>{" "}
                {selectedOrder.customer?.email || "Not provided"}
              </p>
              <p>
                <strong>Phone:</strong>{" "}
                {selectedOrder.customer?.phone || "Not provided"}
              </p>

              <h3>Delivery address</h3>
              {typeof selectedOrder.deliveryAddress === "string" ? (
                <p>{selectedOrder.deliveryAddress || "Not provided"}</p>
              ) : (
                <p>
                  {[
                    selectedOrder.deliveryAddress?.name,
                    selectedOrder.deliveryAddress?.phone,
                    selectedOrder.deliveryAddress?.addressLine1,
                    selectedOrder.deliveryAddress?.addressLine2,
                    selectedOrder.deliveryAddress?.address,
                    selectedOrder.deliveryAddress?.city,
                    selectedOrder.deliveryAddress?.state,
                    selectedOrder.deliveryAddress?.postalCode,
                    selectedOrder.deliveryAddress?.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "No delivery address stored."}
                </p>
              )}

              <h3>Items</h3>
              {getOrderItems(selectedOrder).length === 0 ? (
                <p>No item details were stored for this order.</p>
              ) : (
                <div className="table-scroll">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Unit price</th>
                        <th>Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getOrderItems(selectedOrder).map((item, index) => (
                        <tr key={item.productId || item.id || index}>
                          <td>{getItemName(item)}</td>
                          <td>{getItemQuantity(item)}</td>
                          <td>{formatCurrency(getItemPrice(item))}</td>
                          <td>
                            {formatCurrency(
                              getItemPrice(item) * getItemQuantity(item)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p>
                <strong>Order total:</strong>{" "}
                {formatCurrency(selectedOrder.subtotal)}
              </p>
              <p>
                <strong>Payment status:</strong>{" "}
                {readableStatus(selectedOrder.paymentStatus)}
              </p>

              <label>
                Update order status
                <select
                  className="product-filter"
                  value={selectedOrder.orderStatus || "pending_payment"}
                  disabled={updatingId === selectedOrder.id}
                  onChange={(event) =>
                    updateOrderStatus(selectedOrder, event.target.value)
                  }
                >
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {readableStatus(status)}
                    </option>
                  ))}
                  {selectedOrder.orderStatus &&
                    !ORDER_STATUSES.includes(selectedOrder.orderStatus) && (
                      <option value={selectedOrder.orderStatus}>
                        {readableStatus(selectedOrder.orderStatus)}
                      </option>
                    )}
                </select>
              </label>

              {updatingId === selectedOrder.id && (
                <p>Updating order status...</p>
              )}

              <p className="data-disclaimer">
                Changing the order status does not process or verify a payment.
                Payment status is displayed separately.
              </p>

              <footer className="product-form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelectedOrder(null)}
                >
                  Close
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------------- DEALER MANAGEMENT ---------------- */

function DealerManagement() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const snapshot = await getDocs(
        collection(db, "dealerApplications")
      );

      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      list.sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() ?? 0) -
          (a.createdAt?.toMillis?.() ?? 0)
      );

      setApplications(list);

      setSelectedApplication((current) =>
        current
          ? list.find((item) => item.id === current.id) || null
          : null
      );
    } catch (err) {
      console.error("Dealer applications loading failed:", err);
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const filteredApplications = applications.filter((application) => {
    const search = searchTerm.trim().toLowerCase();

    const searchableText = [
      application.businessName,
      application.name,
      application.email,
      application.phone,
      application.uid,
      application.userId,
    ]
      .map((value) => String(value || ""))
      .join(" ")
      .toLowerCase();

    const status = String(
      application.status || "pending"
    ).toLowerCase();

    return (
      (!search || searchableText.includes(search)) &&
      (statusFilter === "all" || status === statusFilter)
    );
  });

  const pendingCount = applications.filter(
    (item) =>
      String(item.status || "pending").toLowerCase() === "pending"
  ).length;

  const approvedCount = applications.filter(
    (item) =>
      String(item.status || "").toLowerCase() === "approved"
  ).length;

  const rejectedCount = applications.filter(
    (item) =>
      String(item.status || "").toLowerCase() === "rejected"
  ).length;

  async function updateApplicationStatus(application, nextStatus) {
    const currentStatus = String(
      application.status || "pending"
    ).toLowerCase();

    if (!["approved", "rejected"].includes(nextStatus)) return;
    if (processingId) return;

    if (currentStatus === nextStatus) {
      setNotice(`This application is already ${nextStatus}.`);
      return;
    }

    const action = nextStatus === "approved" ? "approve" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} the application for "${
        application.businessName || "this business"
      }"?`
    );

    if (!confirmed) return;

    setProcessingId(application.id);
    setError("");
    setNotice("");

    try {
      const applicationRef = doc(
        db,
        "dealerApplications",
        application.id
      );

      if (nextStatus === "approved") {
        // Support the user ID field names currently recognized by
        // the application. Do not guess an unrelated user account.
        const applicantUid =
          application.uid ||
          application.userId ||
          application.userUid ||
          application.applicantUid;

        if (!applicantUid) {
          throw new Error(
            "Cannot approve this application because it does not contain a recognized user ID (uid or userId). Check how the mobile app saves dealer applications."
          );
        }

        const userRef = doc(db, "users", applicantUid);
        const userSnapshot = await getDoc(userRef);

        if (!userSnapshot.exists()) {
          throw new Error(
            `No user profile was found for applicant ID "${applicantUid}". The application was not approved.`
          );
        }

        const userData = userSnapshot.data();

        if (
          userData.uid &&
          userData.uid !== applicantUid
        ) {
          throw new Error(
            "The applicant ID does not match the user profile. The application was not approved."
          );
        }

        // Update both documents together. Either both changes succeed,
        // or neither change is committed.
        const batch = writeBatch(db);

        batch.update(applicationRef, {
          status: "approved",
          updatedAt: serverTimestamp(),
        });

        batch.update(userRef, {
          uid: applicantUid,
          role: "dealer",
          status: "active",
          updatedAt: serverTimestamp(),
        });

        await batch.commit();

        setNotice(
          `${application.businessName || "Dealer application"} approved successfully. Dealer access has been activated.`
        );
      } else {
        // Rejection updates the application only. It does not change
        // the applicant's user role or account status.
        await updateDoc(applicationRef, {
          status: "rejected",
          updatedAt: serverTimestamp(),
        });

        setNotice(
          `${application.businessName || "Dealer application"} rejected.`
        );
      }

      await loadApplications();
    } catch (err) {
      console.error("Dealer application update failed:", err);
      setError(friendlyError(err));
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="dashboard-content">
      <section className="page-heading">
        <div>
          <p className="eyebrow">DEALER NETWORK</p>
          <h1>Dealer Applications</h1>
          <p className="page-subtitle">
            Review applications, approve eligible businesses, and manage
            dealer access.
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={loadApplications}
          disabled={loading || Boolean(processingId)}
        >
          <RefreshCw
            size={17}
            className={loading ? "spin" : ""}
          />
          Refresh applications
        </button>
      </section>

      {error && (
        <div className="dashboard-error" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>Dealer application action failed</strong>
            <p>{error}</p>
            <button type="button" onClick={loadApplications}>
              Try again
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="product-notice" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section className="product-summary-grid">
        <article className="product-summary-card">
          <span>Total applications</span>
          <strong>{applications.length}</strong>
        </article>

        <article className="product-summary-card">
          <span>Pending review</span>
          <strong>{pendingCount}</strong>
        </article>

        <article className="product-summary-card">
          <span>Approved</span>
          <strong>{approvedCount}</strong>
        </article>

        <article className="product-summary-card">
          <span>Rejected</span>
          <strong>{rejectedCount}</strong>
        </article>
      </section>

      <section className="panel product-list-panel">
        <div className="product-toolbar">
          <label className="product-search">
            <Search size={18} />
            <input
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
              placeholder="Search business, name, email or phone..."
              aria-label="Search dealer applications"
            />
          </label>

          <select
            className="product-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            aria-label="Filter dealer applications"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">
            Loading dealer applications from Firebase...
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="empty-state">
            <Building2 size={30} />
            <strong>
              {applications.length
                ? "No matching applications"
                : "No dealer applications yet"}
            </strong>
            <span>
              {applications.length
                ? "Try a different search or status filter."
                : "New dealer applications will appear here."}
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Contact</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>
              </thead>

              <tbody>
                {filteredApplications.map((application) => {
                  const status = String(
                    application.status || "pending"
                  ).toLowerCase();

                  return (
                    <tr key={application.id}>
                      <td>
                        <div className="product-name-cell">
                          <div className="product-thumbnail product-thumbnail-empty">
                            <Building2 size={20} />
                          </div>

                          <div className="product-name-info">
                            <strong>
                              {application.businessName ||
                                "Unnamed business"}
                            </strong>
                            <span>
                              {application.name ||
                                "Applicant name unavailable"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="product-name-info">
                          <span>
                            {application.email || "No email provided"}
                          </span>
                          <span>
                            {application.phone || "No phone provided"}
                          </span>
                        </div>
                      </td>

                      <td>{formatDate(application.createdAt)}</td>

                      <td>
                        <span
                          className={`status-pill ${
                            status === "approved"
                              ? "product-active-pill"
                              : status === "rejected"
                                ? "product-inactive-pill"
                                : "status-pending"
                          }`}
                        >
                          {readableStatus(status)}
                        </span>
                      </td>

                      <td>
                        <div className="product-actions">
                          <button
                            type="button"
                            className="icon-action"
                            title="View application"
                            aria-label="View application"
                            onClick={() =>
                              setSelectedApplication(application)
                            }
                          >
                            <Eye size={17} />
                          </button>

                          {status === "pending" && (
                            <>
                              <button
                                type="button"
                                className="dealer-approve-button"
                                disabled={Boolean(processingId)}
                                onClick={() =>
                                  updateApplicationStatus(
                                    application,
                                    "approved"
                                  )
                                }
                              >
                                {processingId === application.id
                                  ? "Saving..."
                                  : "Approve"}
                              </button>

                              <button
                                type="button"
                                className="dealer-reject-button"
                                disabled={Boolean(processingId)}
                                onClick={() =>
                                  updateApplicationStatus(
                                    application,
                                    "rejected"
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedApplication && (
        <div
          className="product-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedApplication(null);
            }
          }}
        >
          <section
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dealer-detail-title"
          >
            <header className="product-modal-heading">
              <div>
                <p className="eyebrow">APPLICATION DETAILS</p>
                <h2 id="dealer-detail-title">
                  {selectedApplication.businessName ||
                    "Dealer application"}
                </h2>
                <p>
                  Submitted {formatDate(selectedApplication.createdAt)}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                aria-label="Close application details"
                onClick={() => setSelectedApplication(null)}
              >
                <X size={21} />
              </button>
            </header>

            <div className="product-form">
              <h3>Applicant</h3>
              <p>
                <strong>Name:</strong>{" "}
                {selectedApplication.name || "Not provided"}
              </p>
              <p>
                <strong>Email:</strong>{" "}
                {selectedApplication.email || "Not provided"}
              </p>
              <p>
                <strong>Phone:</strong>{" "}
                {selectedApplication.phone || "Not provided"}
              </p>

              <h3>Business</h3>
              <p>
                <strong>Business name:</strong>{" "}
                {selectedApplication.businessName || "Not provided"}
              </p>
              <p>
                <strong>Address:</strong>{" "}
                {selectedApplication.address ||
                  selectedApplication.businessAddress ||
                  "Not provided"}
              </p>
              <p>
                <strong>Application ID:</strong>{" "}
                {selectedApplication.id}
              </p>
              <p>
                <strong>Applicant user ID:</strong>{" "}
                {selectedApplication.uid ||
                  selectedApplication.userId ||
                  selectedApplication.userUid ||
                  selectedApplication.applicantUid ||
                  "Not stored"}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                {readableStatus(
                  selectedApplication.status || "pending"
                )}
              </p>

              {String(
                selectedApplication.status || "pending"
              ).toLowerCase() === "pending" && (
                <div className="dealer-review-actions">
                  <button
                    type="button"
                    className="dealer-approve-button"
                    disabled={Boolean(processingId)}
                    onClick={() =>
                      updateApplicationStatus(
                        selectedApplication,
                        "approved"
                      )
                    }
                  >
                    <CheckCircle2 size={17} />
                    {processingId === selectedApplication.id
                      ? "Processing..."
                      : "Approve application"}
                  </button>

                  <button
                    type="button"
                    className="dealer-reject-button"
                    disabled={Boolean(processingId)}
                    onClick={() =>
                      updateApplicationStatus(
                        selectedApplication,
                        "rejected"
                      )
                    }
                  >
                    <X size={17} />
                    Reject application
                  </button>
                </div>
              )}

              <p className="data-disclaimer">
                Approval changes the application status and the associated
                user's profile role and status. Rejection changes only the
                application status.
              </p>

              <footer className="product-form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelectedApplication(null)}
                >
                  Close
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}


/* ---------------- ADMIN DASHBOARD ---------------- */

function AdminDashboard({ profile, onSignOut }) {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentApplications, setRecentApplications] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState("dashboard");

  const loadDashboard = useCallback(async () => {
    setLoadingData(true);
    setDashboardError("");

    try {
      const [productsSnapshot, ordersSnapshot, applicationsSnapshot] =
        await Promise.all([
          getDocs(
            query(collection(db, "products"), where("active", "==", true))
          ),
          getDocs(collection(db, "orders")),
          getDocs(collection(db, "dealerApplications")),
        ]);

      const products = productsSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      const orders = ordersSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      const applications = applicationsSnapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      const pendingOrders = orders.filter((order) =>
        ["pending", "pending_payment"].includes(order.orderStatus)
      ).length;

      const revenue = orders
        .filter((order) => order.paymentStatus === "paid")
        .reduce((sum, order) => sum + (Number(order.subtotal) || 0), 0);

      setStats({
        products: products.length,
        orders: orders.length,
        pendingOrders,
        dealerApplications: applications.filter(
          (application) => application.status === "pending"
        ).length,
        lowStock: products.filter(
          (product) => Number(product.stock) <= 5
        ).length,
        revenue,
      });

      const newestFirst = (a, b) =>
        (b.createdAt?.toMillis?.() ?? 0) -
        (a.createdAt?.toMillis?.() ?? 0);

      setRecentOrders([...orders].sort(newestFirst).slice(0, 5));

      setRecentApplications(
        [...applications]
          .filter((application) => application.status === "pending")
          .sort(newestFirst)
          .slice(0, 5)
      );
    } catch (err) {
      console.error("Dashboard loading failed:", err);
      setDashboardError(friendlyError(err));
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshKey]);

  const metricCards = [
    {
      label: "Active products",
      value: stats.products,
      icon: Package,
      detail: `${stats.lowStock} with stock at 5 or below`,
      className: "metric-blue",
    },
    {
      label: "Total orders",
      value: stats.orders,
      icon: ShoppingCart,
      detail: "All customer orders",
      className: "metric-purple",
    },
    {
      label: "Pending orders",
      value: stats.pendingOrders,
      icon: Clock3,
      detail: "Awaiting the next order step",
      className: "metric-orange",
    },
    {
      label: "Dealer applications",
      value: stats.dealerApplications,
      icon: Users,
      detail: "Awaiting review",
      className: "metric-green",
    },
  ];

  return (
    <main className="admin-layout">
      <AdminSidebar
        view={view}
        setView={setView}
        onSignOut={onSignOut}
      />

      <section className="admin-main" id="dashboard">
        <AdminTopbar profile={profile} view={view} />

        
{view === "products" ? (
  <ProductManagement />
) : view === "orders" ? (
  <OrderManagement />
) : view === "dealers" ? (
  <DealerManagement />
) : (

          <div className="dashboard-content">
            <section className="page-heading">
              <div>
                <p className="eyebrow">PUREFLOW CONTROL CENTER</p>
                <h1>Admin Dashboard</h1>
                <p className="page-subtitle">
                  Here's an overview of your store and its activity.
                </p>
              </div>

              <button
                className="refresh-button"
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                disabled={loadingData}
              >
                <RefreshCw
                  size={17}
                  className={loadingData ? "spin" : ""}
                />
                Refresh
              </button>
            </section>

            {dashboardError && (
              <div className="dashboard-error" role="alert">
                <AlertCircle size={20} />
                <div>
                  <strong>Unable to load dashboard data</strong>
                  <p>{dashboardError}</p>
                  <button
                    type="button"
                    onClick={() => setRefreshKey((key) => key + 1)}
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}

            <section className="metrics-grid">
              {metricCards.map((metric) => {
                const Icon = metric.icon;

                return (
                  <article className="metric-card" key={metric.label}>
                    <div className="metric-top">
                      <span className="metric-label">{metric.label}</span>
                      <span className={`metric-icon ${metric.className}`}>
                        <Icon size={21} />
                      </span>
                    </div>
                    <div className="metric-number">
                      {loadingData ? "—" : metric.value}
                    </div>
                    <p className="metric-detail">{metric.detail}</p>
                  </article>
                );
              })}
            </section>

            <section className="overview-grid">
              <article className="panel revenue-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Paid order total</h2>
                    <p>Based on orders marked as paid</p>
                  </div>
                  <span className="panel-icon">
                    <Activity size={21} />
                  </span>
                </div>
                <div className="revenue-number">
                  {loadingData ? "—" : formatCurrency(stats.revenue)}
                </div>
                <div className="revenue-note">
                  <CheckCircle2 size={17} />
                  <span>
                    Only orders with payment status “paid” are included.
                  </span>
                </div>
                <p className="data-disclaimer">
                  Dashboard summary only; payment settlement has not been
                  independently verified.
                </p>
              </article>

              <article className="panel stock-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Inventory overview</h2>
                    <p>Active product availability</p>
                  </div>
                  <span className="panel-icon stock-icon">
                    <Package size={21} />
                  </span>
                </div>
                <div className="stock-summary">
                  <div>
                    <strong>{loadingData ? "—" : stats.products}</strong>
                    <span>Active products</span>
                  </div>
                  <div>
                    <strong className="stock-warning">
                      {loadingData ? "—" : stats.lowStock}
                    </strong>
                    <span>Low or out of stock</span>
                  </div>
                </div>
                <div className="stock-progress-track">
                  <div
                    className="stock-progress-fill"
                    style={{
                      width: `${
                        stats.products
                          ? Math.min(
                              100,
                              (stats.lowStock / stats.products) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="stock-caption">
                  Low stock means 5 or fewer units remaining.
                </p>
              </article>
            </section>

            <section className="tables-grid">
              <article className="panel table-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent orders</h2>
                    <p>Your latest customer orders</p>
                  </div>
                  <ShoppingCart size={21} className="heading-icon" />
                </div>

                {loadingData ? (
                  <div className="empty-state">Loading orders...</div>
                ) : recentOrders.length === 0 ? (
                  <div className="empty-state">
                    <ShoppingCart size={27} />
                    <strong>No orders yet</strong>
                    <span>Customer orders will appear here.</span>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Date</th>
                          <th>Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <strong className="order-id">
                                #{order.id.slice(0, 7)}
                              </strong>
                              <span className="cell-subtitle">
                                {order.customer?.name || "Customer"}
                              </span>
                            </td>
                            <td>{formatDate(order.createdAt)}</td>
                            <td className="amount-cell">
                              {formatCurrency(order.subtotal)}
                            </td>
                            <td>
                              <span
                                className={`status-pill status-${String(
                                  order.orderStatus || "unknown"
                                ).toLowerCase()}`}
                              >
                                {readableStatus(order.orderStatus)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>

              <article className="panel table-panel applications-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Dealer applications</h2>
                    <p>Applications awaiting review</p>
                  </div>
                  <Users size={21} className="heading-icon" />
                </div>

                {loadingData ? (
                  <div className="empty-state">Loading applications...</div>
                ) : recentApplications.length === 0 ? (
                  <div className="empty-state">
                    <CheckCircle2 size={27} />
                    <strong>All caught up</strong>
                    <span>No pending dealer applications.</span>
                  </div>
                ) : (
                  <div className="application-list">
                    {recentApplications.map((application) => (
                      <div className="application-item" key={application.id}>
                        <div className="application-avatar">
                          {(application.businessName || "B")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div className="application-info">
                          <strong>
                            {application.businessName || "Unnamed business"}
                          </strong>
                          <span>
                            {application.phone || "No phone provided"}
                          </span>
                          <small>{formatDate(application.createdAt)}</small>
                        </div>
                        <span className="status-pill status-pending">
                          Pending
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>

            <footer className="dashboard-footer">
              <span>PureFlow Water Solutions</span>
              <span>Admin workspace</span>
            </footer>
          </div>
        )}
      </section>
    </main>
  );
}

/* ---------------- PUBLIC LANDING PAGE ---------------- */

function LandingPage({ onAdminLogin, error }) {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="#home">
          <span className="landing-logo">
            <Droplets size={27} />
          </span>
          <span>
            <strong>PureFlow</strong>
            <small>WATER SOLUTIONS</small>
          </span>
        </a>

        <nav className="landing-nav">
          <a href="#home">Home</a>
          <a href="#benefits">Why PureFlow?</a>
          <a href="#about">About</a>
          <button
            type="button"
            className="landing-login-button"
            onClick={onAdminLogin}
          >
            Admin Login <span>↗</span>
          </button>
        </nav>
      </header>

      <section className="landing-hero" id="home">
        <div className="landing-hero-content">
          <span className="landing-tag">
            <Droplets size={15} /> PURE WATER. BETTER LIVING.
          </span>

          <h1>
            Every Drop.
            <br />
            <span>Pure Confidence.</span>
          </h1>

          <p>
            Discover dependable water purification solutions
            designed to bring cleaner water, greater peace of
            mind, and healthier living to every home.
          </p>

          <div className="landing-actions">
            <a href="#benefits" className="landing-primary-button">
              Discover PureFlow <span>→</span>
            </a>

            <button
              type="button"
              className="landing-secondary-button"
              onClick={onAdminLogin}
            >
              Admin Portal <span>↗</span>
            </button>
          </div>

          <div className="landing-trust">
            <span className="landing-trust-icon">
              <ShieldCheck size={21} />
            </span>
            <div>
              <strong>Quality you can trust</strong>
              <small>Water solutions for everyday living</small>
            </div>
          </div>
        </div>

        <div className="landing-visual">
          <div className="landing-orbit landing-orbit-one" />
          <div className="landing-orbit landing-orbit-two" />

          <div className="landing-water-card">
            <div className="landing-water-icon">
              <Droplets size={76} strokeWidth={1.4} />
            </div>
            <span className="landing-water-label">
              PUREFLOW WATER SOLUTIONS
            </span>
            <h2>Pure water.<br />Clear future.</h2>
            <p>Designed for a better everyday.</p>
            <div className="landing-water-line" />
            <div className="landing-water-bottom">
              <span>PURE</span>
              <span>FRESH</span>
              <span>RELIABLE</span>
            </div>
          </div>

          <div className="landing-floating-badge">
            <ShieldCheck size={19} />
            <span>
              <strong>Pure by design</strong>
              <small>Care in every drop</small>
            </span>
          </div>

          <div className="landing-drop-decoration">
            <Droplets size={33} />
          </div>
        </div>
      </section>

      <section className="landing-benefits" id="benefits">
        <div className="landing-section-heading">
          <span>THE PUREFLOW DIFFERENCE</span>
          <h2>Water solutions. Made simple.</h2>
          <p>
            A dependable approach to cleaner water and a
            smoother customer experience.
          </p>
        </div>

        <div className="landing-benefit-grid">
          <article className="landing-benefit-card">
            <span><Droplets size={25} /></span>
            <h3>Clean Water Focus</h3>
            <p>
              Explore water purification solutions for your
              everyday needs.
            </p>
          </article>

          <article className="landing-benefit-card">
            <span><ShieldCheck size={25} /></span>
            <h3>Quality First</h3>
            <p>
              A customer-focused approach built around
              dependable water solutions.
            </p>
          </article>

          <article className="landing-benefit-card">
            <span><Users size={25} /></span>
            <h3>Customer & Dealer Network</h3>
            <p>
              Supporting customers and approved dealers through
              one connected platform.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-about" id="about">
        <div>
          <span>ABOUT PUREFLOW</span>
          <h2>A clearer way to care for your water.</h2>
        </div>
        <p>
          PureFlow Water Solutions brings products, customers,
          and dealer operations together in one convenient
          experience. We're focused on making water solutions
          easier to discover and manage.
        </p>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="#home">
          <span className="landing-logo">
            <Droplets size={23} />
          </span>
          <span>
            <strong>PureFlow</strong>
            <small>WATER SOLUTIONS</small>
          </span>
        </a>

        <span>Pure water. Better living.</span>

        <button type="button" onClick={onAdminLogin}>
          Administrator access ↗
        </button>

        <small>© {new Date().getFullYear()} PureFlow Water Solutions</small>
      </footer>

      {error && (
        <p className="landing-error" role="alert">{error}</p>
      )}
    </main>
  );
}

/* ---------------- AUTHENTICATION ---------------- */

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("login");
  const [showLogin, setShowLogin] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setProfile(null);
      setError("");

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(
          doc(db, "users", currentUser.uid)
        );

        if (!snapshot.exists()) {
          await logoutUser();
          setError("No user profile exists for this account.");
          return;
        }

        const data = snapshot.data();

        if (
          data.uid !== currentUser.uid ||
          !["customer", "dealer", "admin"].includes(data.role) ||
          data.status !== "active"
        ) {
          await logoutUser();
          setError("Your account does not have authorized access.");
          return;
        }

        setProfile(data);
      } catch (err) {
        console.error("Profile loading failed:", err);
        setError("Unable to load your profile. Please try again.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  function updateField(event) {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (mode === "register") {
        await registerCustomer(form);
      } else {
        await loginUser(form);
      }
    } catch (err) {
      console.error(err);

      const messages = {
        "auth/email-already-in-use":
          "This email is already registered.",
        "auth/invalid-credential":
          "Incorrect email or password.",
        "auth/weak-password":
          "Use a stronger password.",
        "auth/invalid-email":
          "Enter a valid email address.",
        "permission-denied":
          "Firestore denied access. Check your rules.",
      };

      setError(
        messages[err.code] ||
          err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      await logoutUser();
    } catch (err) {
      console.error("Sign out failed:", err);
      setError("Could not sign out. Please try again.");
    }
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <div className="auth-loading">
          <Droplets size={32} />
          <p>Checking your session...</p>
        </div>
      </main>
    );
  }

  if (user && profile) {
    if (profile.role === "admin") {
      return (
        <AdminDashboard
          profile={profile}
          onSignOut={handleSignOut}
        />
      );
    }

    const isDealer = profile.role === "dealer";

    return (
      <main className="dashboard">
        <header className="simple-header">
          <div className="brand">
            <span className="brand-icon">
              <Droplets size={24} />
            </span>

            <span>
              <strong>PureFlow</strong>
              <small>WATER SOLUTIONS</small>
            </span>
          </div>

          <button
            className="secondary"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </header>

        <section className="welcome-card">
          <p className="eyebrow">SIGNED IN SUCCESSFULLY</p>

          <h1>
            {isDealer ? "Dealer Dashboard" : "Customer Dashboard"}
          </h1>

          <h2>Welcome, {profile.name}</h2>
          <p>{profile.email}</p>

          <span className="role-pill">
            {profile.role.toUpperCase()}
          </span>

          <p>
            {isDealer
              ? "Dealer access verified. Wholesale ordering features will be added next."
              : "Your customer account is ready for shopping features."}
          </p>
        </section>
      </main>
    );
  }

  // Show the public landing page before opening the login form.
  if (!showLogin) {
    return (
      <LandingPage
        onAdminLogin={() => {
          setError("");
          setMode("login");
          setShowLogin(true);
        }}
        error={error}
      />
    );
  }

  // Login and customer registration form.
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <button
          type="button"
          className="landing-back-button"
          onClick={() => {
            setError("");
            setShowLogin(false);
          }}
        >
          ← Back to home
        </button>

        <div className="auth-logo">
          <Droplets size={28} />
        </div>

        <p className="eyebrow">PUREFLOW WATER SOLUTIONS</p>

        <h1>
          {mode === "login"
            ? "Welcome back"
            : "Create your account"}
        </h1>

        <p className="muted">
          {mode === "login"
            ? "Sign in to continue to your workspace."
            : "Register for a customer account."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                name="name"
                value={form.name}
                onChange={updateField}
                autoComplete="name"
                required
                minLength={2}
              />
            </label>
          )}

          <label>
            Email address
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={6}
              required
            />
          </label>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button disabled={busy} type="submit">
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create customer account"}
          </button>
        </form>

        <button
          className="text-button"
          type="button"
          onClick={() => {
            setError("");
            setMode((current) =>
              current === "login" ? "register" : "login"
            );
          }}
        >
          {mode === "login"
            ? "New customer? Create an account"
            : "Already registered? Sign in"}
        </button>

        <p className="muted small">
          Dealer access requires approval. Administrator accounts
          are provisioned separately.
        </p>
      </section>
    </main>
  );
}
