
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export async function registerCustomer({ name, email, password }) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );

  const user = credential.user;

  try {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name: name.trim(),
      email: user.email,
      role: "customer",
      status: "active",
      createdAt: serverTimestamp(),
    });

    return user;
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export async function loginUser({ email, password }) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );

  try {
    const user = credential.user;
    const snapshot = await getDoc(doc(db, "users", user.uid));

    if (!snapshot.exists()) {
      throw new Error("Account profile not found.");
    }

    const profile = snapshot.data();

    if (
      profile.uid !== user.uid ||
      !["customer", "dealer", "admin"].includes(profile.role) ||
      profile.status !== "active"
    ) {
      throw new Error("This account is not authorized.");
    }

    return profile;
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export async function submitDealerApplication({
  businessName,
  phone,
  address,
}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please sign in before applying.");
  }

  const profileRef = doc(db, "users", user.uid);
  const profileSnapshot = await getDoc(profileRef);

  if (!profileSnapshot.exists()) {
    throw new Error("Account profile not found.");
  }

  const profile = profileSnapshot.data();

  if (profile.role === "dealer" && profile.status === "active") {
    throw new Error("This account already has dealer access.");
  }

  if (profile.role !== "customer" || profile.status !== "active") {
    throw new Error("This account cannot submit a dealer application.");
  }

  const applicationRef = doc(db, "dealerApplications", user.uid);
  const existingApplication = await getDoc(applicationRef);

  if (existingApplication.exists()) {
    const status = existingApplication.data().status;

    if (status === "pending") {
      throw new Error("Your dealer application is already pending.");
    }

    if (status === "approved") {
      throw new Error("Your application has already been approved.");
    }

    throw new Error(
      "An application already exists. Contact the administrator to reapply."
    );
  }

  await setDoc(applicationRef, {
    uid: user.uid,
    businessName: businessName.trim(),
    phone: phone.trim(),
    address: address.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function logoutUser() {
  await signOut(auth);
}
