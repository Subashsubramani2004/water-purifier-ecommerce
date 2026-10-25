
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./src/services/firebase";
import {
  loginUser,
  logoutUser,
  registerCustomer,
  submitDealerApplication,
} from "./src/services/auth";

import ProductCatalog from "./src/screens/ProductCatalog";

export default function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Shared cart: survives leaving and reopening ProductCatalog.
  const [cartItems, setCartItems] = useState({});

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    businessName: "",
    phone: "",
    address: "",
  });

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function loadProfile(currentUser) {
    const profileSnapshot = await getDoc(
      doc(db, "users", currentUser.uid)
    );

    if (!profileSnapshot.exists()) {
      await logoutUser();
      throw new Error("Account profile not found.");
    }

    const data = profileSnapshot.data();

    if (
      data.uid !== currentUser.uid ||
      !["customer", "dealer", "admin"].includes(data.role) ||
      data.status !== "active"
    ) {
      await logoutUser();
      throw new Error("Account is not authorized.");
    }

    let dealerApplication = null;

    if (data.role === "customer") {
      const applicationSnapshot = await getDoc(
        doc(db, "dealerApplications", currentUser.uid)
      );

      if (applicationSnapshot.exists()) {
        dealerApplication = applicationSnapshot.data();
      }
    }

    setUser(currentUser);
    setProfile(data);
    setApplication(dealerApplication);
    setScreen("dashboard");
  }

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!mounted) return;

      setLoading(true);

      try {
        if (currentUser) {
          await loadProfile(currentUser);
        } else {
          setUser(null);
          setProfile(null);
          setApplication(null);
          setCartItems({});
          setScreen("login");
        }
      } catch (error) {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setApplication(null);
          setCartItems({});
          setScreen("login");
          console.error("Session restoration failed:", error);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  async function handleAuth() {
    if (busy) return;

    setBusy(true);

    try {
      if (screen === "register") {
        if (!form.name.trim()) {
          Alert.alert("Missing information", "Enter your full name.");
          return;
        }

        await registerCustomer(form);
      } else {
        await loginUser(form);
      }

      // Firebase's auth listener loads the account profile.
    } catch (error) {
      console.error("Authentication error:", error);
      Alert.alert("Authentication failed", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDealerApplication() {
    if (busy) return;

    if (
      !form.businessName.trim() ||
      !form.phone.trim() ||
      !form.address.trim()
    ) {
      Alert.alert(
        "Missing information",
        "Complete your business name, phone number, and address."
      );
      return;
    }

    setBusy(true);

    try {
      await submitDealerApplication(form);

      const snapshot = await getDoc(
        doc(db, "dealerApplications", user.uid)
      );

      setApplication(snapshot.exists() ? snapshot.data() : null);
      setScreen("dashboard");

      Alert.alert(
        "Application submitted",
        "Your dealer application is pending admin approval."
      );
    } catch (error) {
      Alert.alert("Application failed", error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
    } catch (error) {
      Alert.alert("Sign out failed", error.message);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#087f68" />
        <Text style={styles.muted}>Loading your account...</Text>
      </SafeAreaView>
    );
  }

  // Customer and dealer catalog with shared cart state.
  if (
    screen === "products" &&
    user &&
    profile &&
    ["customer", "dealer"].includes(profile.role)
  ) {
    return (
      <ProductCatalog
        onBack={() => setScreen("dashboard")}
        cart={cartItems}
        setCart={setCartItems}
        profile={profile}
      />
    );
  }

  const isAuthScreen =
    screen === "login" || screen === "register";

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>PUREFLOW</Text>
          <Text style={styles.subtitle}>
            Water solutions for every home
          </Text>

          {isAuthScreen ? (
            <View style={styles.card}>
              <Text style={styles.heading}>
                {screen === "login"
                  ? "Welcome back"
                  : "Create account"}
              </Text>

              {screen === "register" && (
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  value={form.name}
                  onChangeText={(value) => updateField("name", value)}
                  autoCapitalize="words"
                />
              )}

              <TextInput
                style={styles.input}
                placeholder="Email address"
                value={form.email}
                onChangeText={(value) => updateField("email", value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TextInput
                style={styles.input}
                placeholder="Password (minimum 6 characters)"
                value={form.password}
                onChangeText={(value) => updateField("password", value)}
                secureTextEntry
              />

              <TouchableOpacity
                style={styles.primaryButton}
                disabled={busy}
                onPress={handleAuth}
              >
                <Text style={styles.primaryText}>
                  {busy
                    ? "Please wait..."
                    : screen === "login"
                      ? "Sign in"
                      : "Create customer account"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() =>
                  setScreen(
                    screen === "login" ? "register" : "login"
                  )
                }
              >
                <Text style={styles.linkText}>
                  {screen === "login"
                    ? "New customer? Register"
                    : "Already registered? Sign in"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : screen === "dealer-application" ? (
            <View style={styles.card}>
              <Text style={styles.heading}>Dealer application</Text>
              <Text style={styles.muted}>
                Submit your business details for admin review.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Business name"
                value={form.businessName}
                onChangeText={(value) =>
                  updateField("businessName", value)
                }
              />

              <TextInput
                style={styles.input}
                placeholder="Phone number"
                value={form.phone}
                onChangeText={(value) => updateField("phone", value)}
                keyboardType="phone-pad"
              />

              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Business address"
                value={form.address}
                onChangeText={(value) =>
                  updateField("address", value)
                }
                multiline
              />

              <TouchableOpacity
                style={styles.primaryButton}
                disabled={busy}
                onPress={handleDealerApplication}
              >
                <Text style={styles.primaryText}>
                  {busy ? "Submitting..." : "Submit application"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setScreen("dashboard")}
              >
                <Text style={styles.linkText}>
                  Back to dashboard
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>

              <Text style={styles.heading}>
                {profile?.role === "admin"
                  ? "Admin account"
                  : profile?.role === "dealer"
                    ? "Dealer dashboard"
                    : "Customer dashboard"}
              </Text>

              <Text style={styles.body}>
                Welcome, {profile?.name || "User"}
              </Text>

              <Text style={styles.muted}>{profile?.email}</Text>

              {(profile?.role === "customer" ||
                profile?.role === "dealer") && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => setScreen("products")}
                >
                  <Text style={styles.primaryText}>
                    {profile?.role === "dealer"
                      ? "Browse Products"
                      : "Shop Products"}
                  </Text>
                </TouchableOpacity>
              )}

              {profile?.role === "customer" && (
                <>
                  <Text style={styles.sectionTitle}>
                    Dealer access
                  </Text>

                  {application?.status === "pending" ? (
                    <Text style={styles.status}>
                      Application pending admin approval.
                    </Text>
                  ) : application?.status === "approved" ? (
                    <Text style={styles.status}>
                      Application approved. Your profile role must
                      also be updated to dealer by an administrator.
                    </Text>
                  ) : application?.status === "rejected" ? (
                    <Text style={styles.status}>
                      Application rejected. Contact the administrator.
                    </Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() =>
                        setScreen("dealer-application")
                      }
                    >
                      <Text style={styles.secondaryText}>
                        Apply to become a dealer
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {profile?.role === "dealer" && (
                <Text style={styles.status}>
                  Dealer access verified. Browse the catalog to shop.
                </Text>
              )}

              {profile?.role === "admin" && (
                <Text style={styles.status}>
                  Admin account verified. Use the web panel for
                  administration.
                </Text>
              )}

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleLogout}
              >
                <Text style={styles.secondaryText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#f3f7f5" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f7f5",
    gap: 12,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 22,
  },
  brand: {
    color: "#087f68",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
  },
  subtitle: {
    color: "#72817b",
    textAlign: "center",
    marginTop: 7,
    marginBottom: 28,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e2eae5",
  },
  heading: {
    color: "#193b32",
    fontSize: 25,
    fontWeight: "800",
    marginBottom: 12,
  },
  eyebrow: {
    color: "#087f68",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fbfcfb",
    borderWidth: 1,
    borderColor: "#dce5df",
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 13,
    color: "#193b32",
  },
  multiline: { minHeight: 95, textAlignVertical: "top" },
  primaryButton: {
    backgroundColor: "#087f68",
    borderRadius: 11,
    padding: 15,
    alignItems: "center",
    marginTop: 20,
  },
  primaryText: { color: "#ffffff", fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "#e5f4ed",
    padding: 14,
    borderRadius: 11,
    marginTop: 12,
  },
  secondaryText: {
    color: "#087f68",
    fontWeight: "700",
    textAlign: "center",
  },
  linkButton: { padding: 14, alignItems: "center" },
  linkText: { color: "#087f68", fontWeight: "700" },
  muted: { color: "#72817b", lineHeight: 21 },
  body: { color: "#193b32", fontSize: 16, marginTop: 8 },
  sectionTitle: {
    color: "#193b32",
    fontWeight: "800",
    marginTop: 26,
    marginBottom: 8,
  },
  status: {
    color: "#087f68",
    backgroundColor: "#e5f4ed",
    borderRadius: 10,
    padding: 13,
    marginTop: 12,
    lineHeight: 21,
  },
});
