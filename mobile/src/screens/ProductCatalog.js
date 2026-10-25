import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../services/firebase";
import { createOrder } from "../services/orders";
import CartScreen from "./CartScreen";
import CheckoutScreen from "./CheckoutScreen";
import MyOrdersScreen from "./MyOrdersScreen";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "purifiers", label: "Purifiers" },
  { id: "dispensers", label: "Dispensers" },
  { id: "pumps", label: "Pumps" },
  { id: "filters", label: "Filters" },
  { id: "spare-parts", label: "Spare Parts" },
];

export default function ProductCatalog({
  onBack,
  cart = {},
  setCart,
  profile,
}) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("home");
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showMyOrders, setShowMyOrders] = useState(false);
  const [checkoutData, setCheckoutData] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const productsQuery = query(
          collection(db, "products"),
          where("active", "==", true)
        );

        const snapshot = await getDocs(productsQuery);

        const items = snapshot.docs.map((productDoc) => ({
          id: productDoc.id,
          ...productDoc.data(),
        }));

        items.sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        );

        if (mounted) {
          setProducts(items);
        }
      } catch (err) {
        console.error("Product catalog error:", err);

        if (mounted) {
          setError(
            "Could not load products. Check your connection, sign-in status, and Firestore rules."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        category === "all" || product.category === category;

      const matchesSearch =
        !term ||
        (product.name || "").toLowerCase().includes(term) ||
        (product.brand || "").toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const cartCount = Object.values(cart).reduce(
    (total, quantity) => total + Number(quantity || 0),
    0
  );

  const featuredProducts = products.slice(0, 4);

  function changeQuantity(product, change) {
    setCart((previous) => {
      const current = previous[product.id] || 0;
      const next = current + change;
      const stock = Number(product.stock || 0);

      if (next <= 0) {
        const updated = { ...previous };
        delete updated[product.id];
        return updated;
      }

      if (next > stock) {
        return previous;
      }

      return {
        ...previous,
        [product.id]: next,
      };
    });
  }

  function openProducts(selectedCategory = "all") {
    setCategory(selectedCategory);
    setActiveTab("products");
    setShowCart(false);
    setShowMyOrders(false);
  }

  function openCart() {
    setShowCart(true);
    setShowMyOrders(false);
    setShowCheckout(false);
  }

  function openOrders() {
    setShowMyOrders(true);
    setShowCart(false);
    setShowCheckout(false);
  }

  function handleCheckout({ items, subtotal }) {
    if (!items || items.length === 0) {
      Alert.alert(
        "Your cart is empty",
        "Please add a product before checking out."
      );
      return;
    }

    setCheckoutData({ items, subtotal });
    setShowCart(false);
    setShowCheckout(true);
  }

  function handleBackFromCheckout() {
    if (placingOrder) return;

    setShowCheckout(false);
    setShowCart(true);
  }

  async function handlePlaceOrder(orderDetails) {
    if (placingOrder) return;

    try {
      setPlacingOrder(true);

      const order = await createOrder(orderDetails);

      // Clear the shared cart only after the order is saved.
      setCart({});
      setCheckoutData(null);
      setShowCheckout(false);
      setShowCart(false);

      Alert.alert(
        "Order placed successfully!",
        `Order ID:\n${order.orderId}\n\n` +
          `Subtotal: ₹${Number(order.subtotal).toLocaleString("en-IN")}\n\n` +
          "Payment is pending. You can view this order in My Orders.",
        [
          {
            text: "Continue shopping",
            onPress: () => setActiveTab("products"),
          },
          {
            text: "My Orders",
            onPress: openOrders,
          },
        ]
      );
    } catch (err) {
      console.error("Create order error:", err);

      Alert.alert(
        "Could not place order",
        err?.message ||
          "Something went wrong while saving your order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  async function retryProducts() {
    try {
      setLoading(true);
      setError("");

      const productsQuery = query(
        collection(db, "products"),
        where("active", "==", true)
      );

      const snapshot = await getDocs(productsQuery);

      const items = snapshot.docs.map((productDoc) => ({
        id: productDoc.id,
        ...productDoc.data(),
      }));

      items.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );

      setProducts(items);
    } catch (err) {
      console.error("Retry products error:", err);
      setError("Could not load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function renderProduct({ item }) {
    const quantity = cart[item.id] || 0;
    const stock = Number(item.stock || 0);

    return (
      <View style={styles.productCard}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.productImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderIcon}>💧</Text>
            <Text style={styles.placeholderText}>PureFlow</Text>
          </View>
        )}

        <Text style={styles.brand}>
          {item.brand || "PureFlow"}
        </Text>

        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>

        <Text style={styles.description} numberOfLines={2}>
          {item.description ||
            "Quality water purification product."}
        </Text>

        <Text style={styles.price}>
          ₹{Number(item.customerPrice || 0).toLocaleString("en-IN")}
        </Text>

        <Text style={stock > 0 ? styles.inStock : styles.outOfStock}>
          {stock > 0 ? `${stock} available` : "Out of stock"}
        </Text>

        {quantity === 0 ? (
          <TouchableOpacity
            style={[
              styles.addButton,
              stock <= 0 && styles.disabledButton,
            ]}
            disabled={stock <= 0}
            onPress={() => changeQuantity(item, 1)}
          >
            <Text style={styles.addButtonText}>+ Add to cart</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.quantityRow}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => changeQuantity(item, -1)}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>

            <Text style={styles.quantity}>{quantity}</Text>

            <TouchableOpacity
              style={[
                styles.quantityButton,
                quantity >= stock && styles.disabledButton,
              ]}
              disabled={quantity >= stock}
              onPress={() => changeQuantity(item, 1)}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function renderCategoryChips() {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryList}
      >
        {CATEGORIES.map((item) => {
          const selected = category === item.id;

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => setCategory(item.id)}
              style={[
                styles.categoryChip,
                selected && styles.selectedChip,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selected && styles.selectedChipText,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  function renderProductList() {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#087F6A" />
          <Text style={styles.message}>Loading products...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={retryProducts}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        key="product-grid"
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.productList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.message}>
              No products found. Try another search or category.
            </Text>
          </View>
        }
      />
    );
  }

  function renderHome() {
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.homeContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeRow}>
          <View style={styles.welcomeText}>
            <Text style={styles.eyebrow}>WELCOME TO PUREFLOW</Text>
            <Text style={styles.welcomeTitle}>
              Clean water.
              {"\n"}
              Better living.
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Discover dependable water purifiers, filters and
              essential accessories for your home.
            </Text>
          </View>

          <View style={styles.waterIconCircle}>
            <Text style={styles.waterIcon}>💧</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.heroButton}
          onPress={() => openProducts("all")}
          activeOpacity={0.85}
        >
          <Text style={styles.heroButtonText}>Explore products</Text>
          <Text style={styles.heroArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.benefitsRow}>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>✓</Text>
            <Text style={styles.benefitTitle}>Quality products</Text>
          </View>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>⌂</Text>
            <Text style={styles.benefitTitle}>Home essentials</Text>
          </View>
          <View style={styles.benefit}>
            <Text style={styles.benefitIcon}>↗</Text>
            <Text style={styles.benefitTitle}>Track orders</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Shop by category</Text>
            <Text style={styles.sectionSubtitle}>
              Find what you need
            </Text>
          </View>
        </View>

        <View style={styles.categoryGrid}>
          {[
            { id: "purifiers", title: "Purifiers", icon: "💧" },
            { id: "filters", title: "Filters", icon: "◉" },
            { id: "pumps", title: "Water pumps", icon: "⚙" },
            { id: "spare-parts", title: "Spare parts", icon: "🔧" },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.homeCategory}
              onPress={() => openProducts(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.homeCategoryIcon}>
                <Text style={styles.homeCategoryEmoji}>
                  {item.icon}
                </Text>
              </View>
              <Text style={styles.homeCategoryTitle}>
                {item.title}
              </Text>
              <Text style={styles.homeCategoryArrow}>Explore →</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Popular products</Text>
            <Text style={styles.sectionSubtitle}>
              Explore our collection
            </Text>
          </View>

          <TouchableOpacity onPress={() => openProducts("all")}>
            <Text style={styles.viewAll}>View all →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color="#087F6A" />
            <Text style={styles.message}>Loading products...</Text>
          </View>
        ) : error ? (
          <TouchableOpacity onPress={retryProducts}>
            <Text style={styles.error}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        ) : featuredProducts.length === 0 ? (
          <Text style={styles.message}>
            Products will appear here when available.
          </Text>
        ) : (
          <View style={styles.featuredGrid}>
            {featuredProducts.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.featuredCard}
                onPress={() => openProducts("all")}
                activeOpacity={0.85}
              >
                {product.imageUrl ? (
                  <Image
                    source={{ uri: product.imageUrl }}
                    style={styles.featuredImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.featuredPlaceholder}>
                    <Text style={styles.placeholderIcon}>💧</Text>
                  </View>
                )}

                <Text style={styles.brand}>
                  {product.brand || "PureFlow"}
                </Text>

                <Text style={styles.featuredName} numberOfLines={2}>
                  {product.name}
                </Text>

                <Text style={styles.featuredPrice}>
                  ₹
                  {Number(product.customerPrice || 0).toLocaleString(
                    "en-IN"
                  )}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.ordersBanner}
          onPress={openOrders}
          activeOpacity={0.85}
        >
          <View style={styles.ordersBannerIcon}>
            <Text style={styles.ordersBannerEmoji}>📦</Text>
          </View>
          <View style={styles.ordersBannerText}>
            <Text style={styles.ordersBannerTitle}>
              Your orders, all in one place
            </Text>
            <Text style={styles.ordersBannerSubtitle}>
              Check your order history and status.
            </Text>
          </View>
          <Text style={styles.bannerArrow}>→</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          PureFlow · Water care, made simple
        </Text>
      </ScrollView>
    );
  }

  function renderProductsPage() {
    return (
      <View style={styles.productsPage}>
        <Text style={styles.pageEyebrow}>PUREFLOW COLLECTION</Text>
        <Text style={styles.pageTitle}>Find your perfect fit</Text>
        <Text style={styles.pageSubtitle}>
          Purifiers, filters and accessories for your home.
        </Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Search products or brands..."
          placeholderTextColor="#84918C"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />

        {renderCategoryChips()}
        {renderProductList()}
      </View>
    );
  }

  function renderProfile() {
    const currentUser = auth.currentUser;
    const displayName =
      profile?.name ||
      profile?.fullName ||
      currentUser?.displayName ||
      "PureFlow customer";

    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.profileContent}
      >
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {String(displayName).charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>
            {profile?.email || currentUser?.email || ""}
          </Text>

          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>
              {String(profile?.role || "customer").toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your account</Text>

        <TouchableOpacity
          style={styles.profileRow}
          onPress={openOrders}
        >
          <Text style={styles.profileRowIcon}>📦</Text>
          <View style={styles.profileRowContent}>
            <Text style={styles.profileRowTitle}>My orders</Text>
            <Text style={styles.profileRowSubtitle}>
              View purchases and order status
            </Text>
          </View>
          <Text style={styles.profileRowArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileRow}
          onPress={openCart}
        >
          <Text style={styles.profileRowIcon}>🛒</Text>
          <View style={styles.profileRowContent}>
            <Text style={styles.profileRowTitle}>Shopping cart</Text>
            <Text style={styles.profileRowSubtitle}>
              {cartCount} item{cartCount === 1 ? "" : "s"} in your cart
            </Text>
          </View>
          <Text style={styles.profileRowArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => openProducts("all")}
        >
          <Text style={styles.profileRowIcon}>💧</Text>
          <View style={styles.profileRowContent}>
            <Text style={styles.profileRowTitle}>Browse products</Text>
            <Text style={styles.profileRowSubtitle}>
              Explore the PureFlow collection
            </Text>
          </View>
          <Text style={styles.profileRowArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onBack}
        >
          <Text style={styles.secondaryButtonText}>
            Back to dashboard
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Keep the existing checkout screen and map integration.
  if (showCheckout && checkoutData) {
    return (
      <SafeAreaView
        style={styles.screen}
        edges={["top", "left", "right"]}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <CheckoutScreen
          items={checkoutData.items}
          subtotal={checkoutData.subtotal}
          onBack={handleBackFromCheckout}
          onPlaceOrder={handlePlaceOrder}
        />
      </SafeAreaView>
    );
  }

  if (showCart) {
    return (
      <SafeAreaView
        style={styles.screen}
        edges={["top", "left", "right"]}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <CartScreen
          products={products}
          cart={cart}
          changeQuantity={changeQuantity}
          onBack={() => setShowCart(false)}
          onCheckout={handleCheckout}
        />
      </SafeAreaView>
    );
  }

  if (showMyOrders) {
    return (
      <MyOrdersScreen onBack={() => setShowMyOrders(false)} />
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={["top", "left", "right"]}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.brandMark}
          onPress={() => setActiveTab("home")}
        >
          <Text style={styles.brandMarkIcon}>💧</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerBrand}
          onPress={() => setActiveTab("home")}
        >
          <Text style={styles.logo}>PureFlow</Text>
          <Text style={styles.subtitle}>Water care, made simple</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCart}
          onPress={openCart}
          activeOpacity={0.8}
        >
          <Text style={styles.headerCartIcon}>🛒</Text>
          <View style={styles.headerCartBadge}>
            <Text style={styles.headerCartBadgeText}>
              {cartCount}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {activeTab === "home" && renderHome()}
        {activeTab === "products" && renderProductsPage()}
        {activeTab === "profile" && renderProfile()}
      </View>

      <View style={styles.bottomNav}>
        <NavItem
          icon="⌂"
          label="Home"
          selected={activeTab === "home"}
          onPress={() => setActiveTab("home")}
        />

        <NavItem
          icon="▦"
          label="Products"
          selected={activeTab === "products"}
          onPress={() => setActiveTab("products")}
        />

        <NavItem
          icon="🛒"
          label="Cart"
          selected={false}
          badge={cartCount}
          onPress={openCart}
        />

        <NavItem
          icon="▤"
          label="Orders"
          selected={false}
          onPress={openOrders}
        />

        <NavItem
          icon="♙"
          label="Profile"
          selected={activeTab === "profile"}
          onPress={() => setActiveTab("profile")}
        />
      </View>
    </SafeAreaView>
  );
}

function NavItem({ icon, label, selected, badge, onPress }) {
  return (
    <TouchableOpacity
      style={styles.navItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.navIconWrap}>
        <Text
          style={[
            styles.navIcon,
            selected && styles.navIconSelected,
          ]}
        >
          {icon}
        </Text>

        {Number(badge) > 0 && (
          <View style={styles.navBadge}>
            <Text style={styles.navBadgeText}>
              {badge > 99 ? "99+" : badge}
            </Text>
          </View>
        )}
      </View>

      <Text
        style={[
          styles.navLabel,
          selected && styles.navLabelSelected,
        ]}
      >
        {label}
      </Text>

      {selected && <View style={styles.navIndicator} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F8F6",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECE8",
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E0F3EC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brandMarkIcon: {
    fontSize: 22,
  },
  headerBrand: {
    flex: 1,
  },
  logo: {
    fontSize: 20,
    fontWeight: "900",
    color: "#087F6A",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "#718078",
    fontSize: 10,
    marginTop: 1,
  },
  headerCart: {
    height: 42,
    minWidth: 44,
    borderRadius: 14,
    backgroundColor: "#F0F7F3",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerCartIcon: {
    fontSize: 19,
  },
  headerCartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "#087F6A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerCartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  mainContent: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  homeContent: {
    padding: 18,
    paddingBottom: 28,
  },

  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E4F3EB",
    borderRadius: 24,
    padding: 18,
    minHeight: 210,
  },
  welcomeText: {
    flex: 1,
    paddingRight: 6,
  },
  eyebrow: {
    color: "#087F6A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 10,
  },
  welcomeTitle: {
    color: "#143B30",
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  welcomeSubtitle: {
    color: "#526C60",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  waterIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#C9EBDD",
    alignItems: "center",
    justifyContent: "center",
  },
  waterIcon: {
    fontSize: 42,
  },
  heroButton: {
    marginTop: -22,
    marginHorizontal: 18,
    backgroundColor: "#087F6A",
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 3,
  },
  heroButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
  heroArrow: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },

  benefitsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 27,
    gap: 8,
  },
  benefit: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: "#E6ECE8",
  },
  benefitIcon: {
    color: "#087F6A",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  benefitTitle: {
    color: "#496056",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#173B32",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: "#77867E",
    fontSize: 12,
    marginTop: 4,
  },
  viewAll: {
    color: "#087F6A",
    fontSize: 12,
    fontWeight: "800",
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  homeCategory: {
    width: "48.2%",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E6ECE8",
  },
  homeCategoryIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 11,
  },
  homeCategoryEmoji: {
    fontSize: 22,
    color: "#087F6A",
  },
  homeCategoryTitle: {
    color: "#173B32",
    fontSize: 13,
    fontWeight: "800",
  },
  homeCategoryArrow: {
    color: "#087F6A",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 7,
  },

  featuredGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  featuredCard: {
    width: "48.2%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6ECE8",
    padding: 10,
    marginBottom: 10,
  },
  featuredImage: {
    height: 115,
    width: "100%",
    backgroundColor: "#F7F9F7",
    borderRadius: 11,
  },
  featuredPlaceholder: {
    height: 115,
    borderRadius: 11,
    backgroundColor: "#EAF4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredName: {
    color: "#173B32",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 5,
    minHeight: 34,
  },
  featuredPrice: {
    color: "#173B32",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 7,
  },

  ordersBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#173B32",
    borderRadius: 18,
    padding: 15,
    marginTop: 4,
  },
  ordersBannerIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#31594B",
    alignItems: "center",
    justifyContent: "center",
  },
  ordersBannerEmoji: {
    fontSize: 22,
  },
  ordersBannerText: {
    flex: 1,
    paddingHorizontal: 11,
  },
  ordersBannerTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  ordersBannerSubtitle: {
    color: "#C6D8CE",
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  bannerArrow: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  footerText: {
    color: "#87938D",
    fontSize: 11,
    textAlign: "center",
    marginTop: 24,
  },

  productsPage: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  pageEyebrow: {
    color: "#087F6A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  pageTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: "#173B32",
    marginTop: 5,
  },
  pageSubtitle: {
    fontSize: 12,
    color: "#718078",
    marginTop: 5,
    marginBottom: 14,
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE8E2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#173B32",
  },
  categoryScroll: {
    maxHeight: 48,
    marginTop: 12,
    marginBottom: 8,
    flexGrow: 0,
  },
  categoryList: {
    alignItems: "center",
    gap: 8,
    paddingRight: 12,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "#E9EFEB",
  },
  selectedChip: {
    backgroundColor: "#087F6A",
  },
  categoryText: {
    color: "#41564D",
    fontWeight: "600",
    fontSize: 12,
  },
  selectedChipText: {
    color: "#FFFFFF",
  },
  productList: {
    paddingBottom: 20,
  },
  productRow: {
    gap: 12,
  },
  productCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    padding: 10,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E7EDE8",
  },
  productImage: {
    width: "100%",
    height: 115,
    backgroundColor: "#F7F9F7",
    borderRadius: 10,
  },
  imagePlaceholder: {
    height: 115,
    backgroundColor: "#EAF4EF",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    fontSize: 30,
  },
  placeholderText: {
    fontSize: 11,
    color: "#72867B",
    marginTop: 5,
  },
  brand: {
    color: "#087F6A",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#173B32",
    marginTop: 4,
  },
  description: {
    fontSize: 11,
    color: "#738079",
    marginTop: 5,
    minHeight: 30,
  },
  price: {
    fontSize: 16,
    fontWeight: "800",
    color: "#173B32",
    marginTop: 8,
  },
  inStock: {
    fontSize: 11,
    color: "#087F6A",
    marginTop: 4,
  },
  outOfStock: {
    fontSize: 11,
    color: "#B42318",
    marginTop: 4,
  },
  addButton: {
    backgroundColor: "#087F6A",
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.45,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 4,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#E0F3EC",
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    color: "#087F6A",
    fontWeight: "800",
    fontSize: 18,
  },
  quantity: {
    color: "#173B32",
    fontWeight: "800",
  },

  profileContent: {
    padding: 18,
    paddingBottom: 28,
  },
  profileHero: {
    alignItems: "center",
    backgroundColor: "#E4F3EB",
    borderRadius: 22,
    padding: 24,
    marginBottom: 25,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#087F6A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  profileName: {
    color: "#173B32",
    fontSize: 20,
    fontWeight: "900",
  },
  profileEmail: {
    color: "#64786D",
    fontSize: 12,
    marginTop: 5,
  },
  rolePill: {
    backgroundColor: "#C9EBDD",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  rolePillText: {
    color: "#087F6A",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    padding: 15,
    marginTop: 10,
  },
  profileRowIcon: {
    fontSize: 22,
    marginRight: 13,
  },
  profileRowContent: {
    flex: 1,
  },
  profileRowTitle: {
    color: "#173B32",
    fontSize: 14,
    fontWeight: "800",
  },
  profileRowSubtitle: {
    color: "#718078",
    fontSize: 11,
    marginTop: 4,
  },
  profileRowArrow: {
    color: "#087F6A",
    fontSize: 24,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#087F6A",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 22,
  },
  secondaryButtonText: {
    color: "#087F6A",
    fontWeight: "800",
  },

  bottomNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E3EBE5",
    paddingTop: 8,
    paddingBottom: 5,
    minHeight: 61,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  navIconWrap: {
    position: "relative",
    minHeight: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  navIcon: {
    fontSize: 21,
    color: "#87958D",
  },
  navIconSelected: {
    color: "#087F6A",
  },
  navBadge: {
    position: "absolute",
    right: -13,
    top: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: "#087F6A",
    alignItems: "center",
    justifyContent: "center",
  },
  navBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  navLabel: {
    fontSize: 9,
    color: "#87958D",
    fontWeight: "600",
    marginTop: 2,
  },
  navLabelSelected: {
    color: "#087F6A",
    fontWeight: "900",
  },
  navIndicator: {
    width: 15,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#087F6A",
    marginTop: 3,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  inlineLoading: {
    padding: 20,
    alignItems: "center",
  },
  message: {
    color: "#738079",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  error: {
    color: "#B42318",
    textAlign: "center",
    lineHeight: 20,
    padding: 16,
  },
  primaryButton: {
    backgroundColor: "#087F6A",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});