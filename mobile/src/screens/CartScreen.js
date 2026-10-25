
import React from "react";
import {
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function CartScreen({
  products,
  cart,
  changeQuantity,
  onBack,
  onCheckout,
}) {
  const cartProducts = products.filter(
    (product) => (cart[product.id] || 0) > 0
  );

  const itemCount = cartProducts.reduce(
    (total, product) => total + cart[product.id],
    0
  );

  const subtotal = cartProducts.reduce(
    (total, product) =>
      total + cart[product.id] * Number(product.customerPrice || 0),
    0
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>‹ Back to products</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Your Cart</Text>
        <Text style={styles.muted}>
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </Text>
      </View>

      {cartProducts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.muted}>
            Add a purifier or accessory to get started.
          </Text>

          <TouchableOpacity style={styles.button} onPress={onBack}>
            <Text style={styles.buttonText}>Browse products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const quantity = cart[item.id] || 0;
              const price = Number(item.customerPrice || 0);

              return (
                <View style={styles.product}>
                  <View style={styles.productInfo}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.muted}>
                      ₹{price.toLocaleString("en-IN")} each
                    </Text>
                    <Text style={styles.lineTotal}>
                      ₹{(price * quantity).toLocaleString("en-IN")}
                    </Text>
                  </View>

                  <View style={styles.quantityRow}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => changeQuantity(item, -1)}
                    >
                      <Text style={styles.quantityText}>−</Text>
                    </TouchableOpacity>

                    <Text style={styles.quantity}>{quantity}</Text>

                    <TouchableOpacity
                      style={styles.quantityButton}
                      disabled={quantity >= item.stock}
                      onPress={() => changeQuantity(item, 1)}
                    >
                      <Text style={styles.quantityText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.summary}>
            <View style={styles.totalRow}>
              <Text style={styles.subtotalLabel}>Subtotal</Text>
              <Text style={styles.subtotal}>
                ₹{subtotal.toLocaleString("en-IN")}
              </Text>
            </View>

            <Text style={styles.note}>
              Delivery charges and final prices will be confirmed at checkout.
            </Text>

            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                if (cartProducts.length === 0) {
                  Alert.alert("Your cart is empty");
                  return;
                }

                onCheckout?.({
                  items: cartProducts.map((product) => ({
                    productId: product.id,
                    name: product.name,
                    quantity: cart[product.id],
                    unitPrice: Number(product.customerPrice || 0),
                  })),
                  subtotal,
                });
              }}
            >
              <Text style={styles.buttonText}>Continue to checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F8F6" },
  header: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECE8",
  },
  back: { color: "#087F6A", fontWeight: "700", marginBottom: 15 },
  title: { fontSize: 25, fontWeight: "800", color: "#173B32" },
  muted: { color: "#718078", marginTop: 5, fontSize: 13 },
  list: { padding: 16, paddingBottom: 30 },
  product: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5ECE7",
  },
  productInfo: { flex: 1, paddingRight: 8 },
  name: { fontSize: 15, fontWeight: "700", color: "#173B32" },
  lineTotal: {
    color: "#173B32",
    fontWeight: "800",
    fontSize: 16,
    marginTop: 7,
  },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "#E0F3EC",
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: { color: "#087F6A", fontWeight: "800", fontSize: 20 },
  quantity: { color: "#173B32", fontWeight: "800" },
  summary: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5ECE7",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subtotalLabel: { fontSize: 16, color: "#53635B" },
  subtotal: { fontSize: 23, fontWeight: "800", color: "#173B32" },
  note: { fontSize: 11, color: "#718078", marginTop: 8, lineHeight: 17 },
  button: {
    backgroundColor: "#087F6A",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "800" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#173B32",
    marginTop: 15,
  },
});
