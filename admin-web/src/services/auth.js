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

  try {
    const user = credential.user;

    const profile = {
      uid: user.uid,
      name: name.trim(),
      email: user.email,
      role: "customer",
      status: "active",
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, "users", user.uid), profile);

    return profile;
  } catch (error) {
    // Do not leave a signed-in account without a valid profile.
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
      throw new Error(
        "Your account profile is missing. Contact the administrator."
      );
    }

    const profile = snapshot.data();

    if (
      profile.uid !== user.uid ||
      !["customer", "dealer", "admin"].includes(profile.role) ||
      profile.status !== "active"
    ) {
      throw new Error(
        "Your account does not have an active authorized role."
      );
    }

    return profile;
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export async function logoutUser() {
  await signOut(auth);
}
