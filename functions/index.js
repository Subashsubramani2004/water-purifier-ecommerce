
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

function requiredText(value, field, maxLength = 200) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    throw new HttpsError(
      "invalid-argument",
      `Please provide a valid ${field}.`
    );
  }

  return value.trim();
}

exports.createOrder = onCall(
  { region: "asia-south1", maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Please sign in before placing an order."
      );
    }

    const uid = request.auth.uid;
    const data = request.data || {};
    const customer = data.customer || {};
    const address = data.deliveryAddress || {};

    const name = requiredText(customer.name, "customer name", 100);
    const phone = requiredText(customer.phone, "phone number", 20);

    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new HttpsError(
        "invalid-argument",
        "Enter a valid 10-digit Indian mobile number."
      );
    }

    const deliveryAddress = {
      address: requiredText(address.address, "delivery address", 300),
      city: requiredText(address.city, "city", 100),
      state: requiredText(address.state, "state", 100),
      pincode: requiredText(address.pincode, "PIN code", 6),
    };

    if (!/^\d{6}$/.test(deliveryAddress.pincode)) {
      throw new HttpsError(
        "invalid-argument",
        "Enter a valid six-digit PIN code."
      );
    }

    if (
      !Array.isArray(data.items) ||
      data.items.length === 0 ||
      data.items.length > 20
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Your cart must contain 1–20 product types."
      );
    }

    const quantities = new Map();

    for (const item of data.items) {
      if (
        typeof item?.productId !== "string" ||
        !item.productId.trim() ||
        item.productId.length > 150 ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100
      ) {
        throw new HttpsError(
          "invalid-argument",
          "A cart item is invalid."
        );
      }

      const id = item.productId.trim();
      quantities.set(id, (quantities.get(id) || 0) + item.quantity);

      if (quantities.get(id) > 100) {
        throw new HttpsError(
          "invalid-argument",
          "Product quantity cannot exceed 100."
        );
      }
    }

    const userRef = db.collection("users").doc(uid);
    const orderRef = db.collection("orders").doc();

    return db.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userRef);

      if (!userSnapshot.exists) {
        throw new HttpsError(
          "permission-denied",
          "Customer profile not found."
        );
      }

      const user = userSnapshot.data();

      if (
        user.status !== "active" ||
        !["customer", "dealer"].includes(user.role)
      ) {
        throw new HttpsError(
          "permission-denied",
          "Your account cannot place orders."
        );
      }

      const productIds = [...quantities.keys()];
      const productRefs = productIds.map((id) =>
        db.collection("products").doc(id)
      );

      const productSnapshots = await Promise.all(
        productRefs.map((ref) => transaction.get(ref))
      );

      const orderItems = [];
      let subtotalPaise = 0;

      for (let i = 0; i < productSnapshots.length; i++) {
        const snapshot = productSnapshots[i];
        const productId = productIds[i];
        const quantity = quantities.get(productId);

        if (!snapshot.exists) {
          throw new HttpsError(
            "not-found",
            "A product in your cart no longer exists."
          );
        }

        const product = snapshot.data();

        if (product.active !== true) {
          throw new HttpsError(
            "failed-precondition",
            `${product.name || "A product"} is unavailable.`
          );
        }

        const stock = Number(product.stock);
        const price = Number(product.customerPrice);

        if (
          !Number.isSafeInteger(stock) ||
          stock < 0 ||
          !Number.isFinite(price) ||
          price < 0
        ) {
          throw new HttpsError(
            "failed-precondition",
            "A product has invalid stock or price data."
          );
        }

        if (stock < quantity) {
          throw new HttpsError(
            "failed-precondition",
            `Not enough stock for ${product.name || "a product"}.`
          );
        }

        const unitPricePaise = Math.round(price * 100);
        const lineTotalPaise = unitPricePaise * quantity;

        if (!Number.isSafeInteger(lineTotalPaise)) {
          throw new HttpsError(
            "failed-precondition",
            "The order total is invalid."
          );
        }

        subtotalPaise += lineTotalPaise;

        orderItems.push({
          productId,
          name: String(product.name || "Product"),
          brand: String(product.brand || ""),
          quantity,
          unitPrice: unitPricePaise / 100,
          lineTotal: lineTotalPaise / 100,
        });
      }

      if (!Number.isSafeInteger(subtotalPaise)) {
        throw new HttpsError(
          "failed-precondition",
          "The order total is invalid."
        );
      }

      const totalAmount = subtotalPaise / 100;

      transaction.set(orderRef, {
        uid,
        customer: {
          name,
          phone,
          email: request.auth.token.email || user.email || "",
        },
        deliveryAddress,
        items: orderItems,
        subtotal: totalAmount,
        deliveryFee: 0,
        totalAmount,
        currency: "INR",
        status: "pending_payment",
        paymentStatus: "unpaid",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        orderId: orderRef.id,
        totalAmount,
      };
    });
  }
);
