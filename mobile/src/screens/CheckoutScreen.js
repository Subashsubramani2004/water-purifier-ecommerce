import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";

const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
    }
    body { overflow: hidden; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([20.5937, 78.9629], 5);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    let marker = null;

    function selectLocation(lat, lng, zoom = 16) {
      const position = [lat, lng];
      map.setView(position, zoom);

      if (marker) {
        marker.setLatLng(position);
      } else {
        marker = L.marker(position).addTo(map);
      }

      marker.bindPopup('Selected delivery location').openPopup();

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'location',
          latitude: lat,
          longitude: lng
        }));
      }
    }

    map.on('click', event => {
      selectLocation(event.latlng.lat, event.latlng.lng);
    });

    window.centerOnLocation = (lat, lng) => {
      selectLocation(lat, lng, 17);
    };

    window.searchLocation = async query => {
      try {
        const url =
          'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q='
          + encodeURIComponent(query);

        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          throw new Error('Search service unavailable');
        }

        const results = await response.json();

        if (!results.length) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'searchError',
            message: 'No matching location found. Try a nearby area or city.'
          }));
          return;
        }

        selectLocation(Number(results[0].lat), Number(results[0].lon), 16);
      } catch (error) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'searchError',
          message: 'Could not search right now. Check your internet connection and try again.'
        }));
      }
    };
  </script>
</body>
</html>
`;

export default function CheckoutScreen({
  items,
  subtotal,
  onBack,
  onPlaceOrder,
}) {
  const webViewRef = useRef(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleMapMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "location") {
        setSelectedLocation({
          latitude: data.latitude,
          longitude: data.longitude,
        });
        setSearching(false);
        setLocating(false);
      } else if (data.type === "searchError") {
        setSearching(false);
        Alert.alert("Location not found", data.message);
      }
    } catch {
      setSearching(false);
      setLocating(false);
    }
  }

  function searchForLocation() {
    const query = searchQuery.trim();

    if (!query) {
      Alert.alert(
        "Enter a location",
        "Type a street, area, landmark or city to search."
      );
      return;
    }

    if (!mapReady || !webViewRef.current) {
      Alert.alert("Map loading", "Please wait for the map to finish loading.");
      return;
    }

    setSearching(true);
    webViewRef.current.injectJavaScript(
      `window.searchLocation(${JSON.stringify(query)}); true;`
    );
  }

  async function useCurrentLocation() {
    try {
      setLocating(true);

      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Allow location access in your phone settings. You can also search or select a pin manually."
        );
        setLocating(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!webViewRef.current || !mapReady) {
        Alert.alert("Map loading", "Please wait and try again.");
        setLocating(false);
        return;
      }

      const { latitude, longitude } = position.coords;

      webViewRef.current.injectJavaScript(
        `window.centerOnLocation(${latitude}, ${longitude}); true;`
      );
    } catch (error) {
      setLocating(false);
      Alert.alert(
        "Could not get location",
        error?.message ||
          "Check that your phone's location services are enabled."
      );
    }
  }

  async function handlePlaceOrder() {
    if (
      !name.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !city.trim() ||
      !state.trim() ||
      !pincode.trim()
    ) {
      Alert.alert("Missing details", "Please complete all delivery fields.");
      return;
    }

    // Remove spaces, +91, hyphens and other formatting characters.
    let cleanedPhone = phone.replace(/\D/g, "");

    // Accept either a 10-digit Indian number or an 11/12-digit
    // number prefixed with India's country code 91.
    if (cleanedPhone.length === 12 && cleanedPhone.startsWith("91")) {
      cleanedPhone = cleanedPhone.slice(2);
    } else if (
      cleanedPhone.length === 11 &&
      cleanedPhone.startsWith("0")
    ) {
      cleanedPhone = cleanedPhone.slice(1);
    }

    if (!/^[6-9][0-9]{9}$/.test(cleanedPhone)) {
      Alert.alert(
        "Invalid phone number",
        "Enter a valid Indian mobile number with 10 digits, optionally prefixed by +91."
      );
      return;
    }

    if (!/^[0-9]{6}$/.test(pincode.trim())) {
      Alert.alert("Invalid PIN code", "Enter a valid 6-digit PIN code.");
      return;
    }

    if (!items?.length) {
      Alert.alert("Your cart is empty", "Add a product before checkout.");
      return;
    }

    try {
      setSaving(true);

      await onPlaceOrder({
        customer: {
          name: name.trim(),
          phone: cleanedPhone,
        },
        deliveryAddress: {
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          latitude: selectedLocation?.latitude ?? null,
          longitude: selectedLocation?.longitude ?? null,
        },
        items,
        subtotal,
      });
    } catch (error) {
      Alert.alert(
        "Could not place order",
        error?.message || "Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  function field(label, value, setValue, placeholder, options = {}) {
    return (
      <View style={styles.field} key={label}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor="#84918C"
          autoCapitalize={options.autoCapitalize || "words"}
          keyboardType={options.keyboardType || "default"}
          maxLength={options.maxLength}
          editable={!saving}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} disabled={saving}>
            <Text style={styles.back}>‹ Back to cart</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Delivery details</Text>
          <Text style={styles.subtitle}>
            Where should we deliver your order?
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Contact information</Text>

          {field("Full name", name, setName, "Enter your full name")}
          {field("Mobile number", phone, setPhone, "10-digit mobile number", {
            keyboardType: "phone-pad",
            maxLength: 15,
            autoCapitalize: "none",
          })}

          <Text style={styles.sectionTitle}>Delivery location</Text>
          <Text style={styles.mapHelp}>
            Search for your area or use your phone's current location.
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search area, street or city"
              placeholderTextColor="#84918C"
              returnKeyType="search"
              onSubmitEditing={searchForLocation}
              editable={!saving && !searching}
            />
            <TouchableOpacity
              style={[
                styles.searchButton,
                (searching || saving) && styles.disabled,
              ]}
              onPress={searchForLocation}
              disabled={searching || saving}
            >
              {searching ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.locationButton,
              (locating || saving) && styles.disabled,
            ]}
            onPress={useCurrentLocation}
            disabled={locating || saving}
          >
            {locating ? (
              <ActivityIndicator color="#087F6A" />
            ) : (
              <Text style={styles.locationButtonText}>
                ◎  Use my current location
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: MAP_HTML }}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              onMessage={handleMapMessage}
              onLoadEnd={() => setMapReady(true)}
              style={styles.map}
              nestedScrollEnabled
            />
          </View>

          <Text style={styles.mapHelp}>
            Tap the map to select a pin or adjust its position.
          </Text>

          {selectedLocation ? (
            <View style={styles.locationSelected}>
              <Text style={styles.locationTitle}>
                ✓ Delivery pin selected
              </Text>
              <Text style={styles.coordinates}>
                Latitude: {selectedLocation.latitude.toFixed(6)}
              </Text>
              <Text style={styles.coordinates}>
                Longitude: {selectedLocation.longitude.toFixed(6)}
              </Text>
            </View>
          ) : (
            <Text style={styles.mapHelp}>
              No pin selected. You can still enter your delivery address manually.
            </Text>
          )}

          {field(
            "House / Street address",
            address,
            setAddress,
            "House number, street, area"
          )}
          {field("City", city, setCity, "Enter your city")}
          {field("State", state, setState, "Enter your state")}
          {field("PIN code", pincode, setPincode, "6-digit PIN code", {
            keyboardType: "number-pad",
            maxLength: 6,
            autoCapitalize: "none",
          })}

          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Order summary</Text>
            <Text style={styles.summaryText}>
              {items?.reduce((total, item) => total + item.quantity, 0) || 0}{" "}
              item(s)
            </Text>
            <Text style={styles.total}>
              ₹{Number(subtotal || 0).toLocaleString("en-IN")}
            </Text>
            <Text style={styles.note}>
              This is the estimated subtotal. Delivery charges and final prices
              must be confirmed before payment.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.disabled]}
            onPress={handlePlaceOrder}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Place order</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: "#F5F8F6" },
  header: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E6ECE8",
  },
  back: { color: "#087F6A", fontWeight: "700", marginBottom: 16 },
  title: { fontSize: 25, fontWeight: "800", color: "#173B32" },
  subtitle: { fontSize: 13, color: "#718078", marginTop: 6 },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#173B32",
    marginTop: 10,
    marginBottom: 14,
  },
  field: { marginBottom: 15 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#41564D",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE8E2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    color: "#173B32",
  },
  mapHelp: {
    fontSize: 12,
    lineHeight: 18,
    color: "#718078",
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE8E2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: "#173B32",
  },
  searchButton: {
    backgroundColor: "#087F6A",
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 82,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  locationButton: {
    borderWidth: 1,
    borderColor: "#B8DCCF",
    backgroundColor: "#EAF6F0",
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  locationButtonText: {
    color: "#087F6A",
    fontSize: 13,
    fontWeight: "800",
  },
  mapContainer: {
    height: 280,
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DFE8E2",
    marginBottom: 12,
    backgroundColor: "#EAF0EC",
  },
  map: { flex: 1, backgroundColor: "#EAF0EC" },
  locationSelected: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#E4F5ED",
    marginBottom: 16,
  },
  locationTitle: {
    color: "#087F6A",
    fontWeight: "800",
    marginBottom: 5,
  },
  coordinates: {
    color: "#41564D",
    fontSize: 12,
    marginTop: 3,
  },
  summary: {
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5ECE7",
    padding: 18,
  },
  summaryTitle: { fontSize: 16, fontWeight: "800", color: "#173B32" },
  summaryText: { color: "#718078", marginTop: 10 },
  total: {
    color: "#087F6A",
    fontSize: 25,
    fontWeight: "800",
    marginTop: 5,
  },
  note: { fontSize: 11, color: "#718078", lineHeight: 17, marginTop: 8 },
  button: {
    backgroundColor: "#087F6A",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  disabled: { opacity: 0.65 },
});
