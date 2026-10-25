
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export async function createOrder({
  customer,
  deliveryAddress,
  items,
  subtotal,
}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in before placing an order.");
  }

  if (!items || items.length === 0) {
    throw new Error("Your cart is empty.");
  }

  if (
    !customer?.name?.trim() ||
    !customer?.phone?.trim() ||
    !deliveryAddress?.address?.trim() ||
    !deliveryAddress?.city?.trim() ||
    !deliveryAddress?.state?.trim() ||
    !deliveryAddress?.pincode?.trim()
  ) {
    throw new Error("Please complete all delivery details.");
  }

  const orderItems = items.map((item) => ({
    productId: String(item.productId ?? item.id ?? ""),
    name: String(item.name ?? ""),
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
  }));

  for (const item of orderItems) {
    if (
      !item.productId ||
      !item.name ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unitPrice) ||
      item.unitPrice < 0
    ) {
      throw new Error("One or more cart items are invalid.");
    }
  }

  const orderSubtotal = Number(subtotal);

  if (
    !Number.isFinite(orderSubtotal) ||
    orderSubtotal < 0
  ) {
    throw new Error("The order subtotal is invalid.");
  }

  // Save coordinates only when valid numeric coordinates are available.
  const latitude = deliveryAddress.latitude;
  const longitude = deliveryAddress.longitude;

  const hasValidCoordinates =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180;

  const orderData = {
    uid: user.uid,

    customer: {
      name: customer.name.trim(),
      phone: customer.phone.trim(),
    },

    deliveryAddress: {
      address: deliveryAddress.address.trim(),
      city: deliveryAddress.city.trim(),
      state: deliveryAddress.state.trim(),
      pincode: deliveryAddress.pincode.trim(),
      latitude: hasValidCoordinates ? latitude : null,
      longitude: hasValidCoordinates ? longitude : null,
    },

    items: orderItems,
    subtotal: orderSubtotal,
    orderStatus: "pending_payment",
    paymentStatus: "unpaid",
    createdAt: serverTimestamp(),
  };

  const orderRef = await addDoc(
    collection(db, "orders"),
    orderData
  );

  return {
    orderId: orderRef.id,
    subtotal: orderSubtotal,
    ...orderData,
  };
}
