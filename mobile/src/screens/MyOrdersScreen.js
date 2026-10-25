
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { auth, db } from "../services/firebase";

function formatDate(timestamp) {
  if (!timestamp) return "Date unavailable";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status) {
  return String(status || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MyOrdersScreen({ onBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      const user = auth.currentUser;

      if (!user) {
        if (mounted) {
          setError("Please sign in to view your orders.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError("");

        const ordersQuery = query(
          collection(db, "orders"),
          where("uid", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(ordersQuery);

        const results = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (mounted) {
          setOrders(results);
        }
      } catch (err) {
        console.error("Load orders error:", err);

        if (mounted) {
          setError(
            "Could not load your orders. Please try again."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOrders();

    return () => {
      mounted = false;
    };
  }, []);

  function renderOrder({ item }) {
    const itemCount = (item.items || []).reduce(
      (total, product) => total + Number(product.quantity || 0),
      0
    );

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderText}>
            <Text style={styles.orderLabel}>ORDER ID</Text>
            <Text style={styles.orderId} selectable>
              {item.id}
            </Text>
            <Text style={styles.date}>
              {formatDate(item.createdAt)}
            </Text>
          </View>

          <View style={styles.amountContainer}>
            <Text style={styles.amount}>
              ₹{Number(item.subtotal || 0).toLocaleString("en-IN")}
            </Text>
            <Text style={styles.amountLabel}>Subtotal</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Items ordered</Text>

        {(item.items || []).map((product, index) => (
          <View
            key={`${product.productId || product.name}-${index}`}
            style={styles.itemRow}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.productName}>
                {product.name || "Product"}
              </Text>
              <Text style={styles.itemMeta}>
                Qty: {product.quantity} × ₹
                {Number(product.unitPrice || 0).toLocaleString("en-IN")}
              </Text>
            </View>

            <Text style={styles.itemTotal}>
              ₹
              {(
                Number(product.quantity || 0) *
                Number(product.unitPrice || 0)
              ).toLocaleString("en-IN")}
            </Text>
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Delivery address</Text>
        <Text style={styles.address}>
          {item.customer?.name || ""}
        </Text>
        <Text style={styles.address}>
          {item.customer?.phone || ""}
        </Text>
        <Text style={styles.address}>
          {item.deliveryAddress?.address || ""}
        </Text>
        <Text style={styles.address}>
          {[
            item.deliveryAddress?.city,
            item.deliveryAddress?.state,
            item.deliveryAddress?.pincode,
          ]
            .filter(Boolean)
            .join(", ")}
        </Text>

        <View style={styles.statusContainer}>
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>ORDER STATUS</Text>
            <Text style={styles.orderStatus}>
              {formatStatus(item.orderStatus)}
            </Text>
          </View>

          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>PAYMENT</Text>
            <Text style={styles.paymentStatus}>
              {formatStatus(item.paymentStatus)}
            </Text>
          </View>
        </View>

        <Text style={styles.itemCount}>
          {itemCount} item{itemCount === 1 ? "" : "s"} in this order
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={["top", "left", "right"]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>My Orders</Text>
          <Text style={styles.headerSubtitle}>
            Your purchase history
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#087F6A" />
          <Text style={styles.message}>Loading your orders...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setLoading(true);
              setError("");
              // Trigger a fresh load by remounting this screen
              // through the parent if a retry is required.
              setLoading(false);
              setError("Please go back and reopen My Orders to retry.");
            }}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.message}>
            Your orders will appear here after you place an order.
          </Text>

          <TouchableOpacity style={styles.button} onPress={onBack}>
            <Text style={styles.buttonText}>Continue shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.resultsText}>
              {orders.length} order{orders.length === 1 ? "" : "s"} found
            </Text>
          }
        />
      )}
    </SafeAreaView>
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
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5ECE7",
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backText: {
    color: "#087F6A",
    fontSize: 14,
    fontWeight: "700",
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#173B32",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#718078",
    marginTop: 3,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  resultsText: {
    color: "#6B7973",
    fontSize: 13,
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E3EBE5",
    padding: 16,
    marginBottom: 16,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  orderHeaderText: {
    flex: 1,
  },
  orderLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "800",
    color: "#75837B",
  },
  orderId: {
    color: "#173B32",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 5,
  },
  date: {
    color: "#78857E",
    fontSize: 11,
    marginTop: 6,
  },
  amountContainer: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#087F6A",
  },
  amountLabel: {
    fontSize: 11,
    color: "#78857E",
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: "#E8EEE9",
    marginVertical: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#173B32",
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },
  itemInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#29483D",
  },
  itemMeta: {
    fontSize: 11,
    color: "#75837B",
    marginTop: 4,
  },
  itemTotal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#173B32",
  },
  address: {
    fontSize: 12,
    color: "#52645A",
    lineHeight: 19,
  },
  statusContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statusBox: {
    flex: 1,
    backgroundColor: "#F2F7F3",
    borderRadius: 10,
    padding: 11,
  },
  statusLabel: {
    color: "#748279",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  orderStatus: {
    color: "#9A6700",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
  paymentStatus: {
    color: "#B45309",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
  itemCount: {
    color: "#75837B",
    fontSize: 11,
    marginTop: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  message: {
    color: "#748279",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 44,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#173B32",
    marginTop: 12,
  },
  error: {
    color: "#B42318",
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#087F6A",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
