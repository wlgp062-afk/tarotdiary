import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDZfZC-KhJpLygM0QdqQAxOHVo1ZupoXpA",
  authDomain: "tarot-diary-79838.firebaseapp.com",
  projectId: "tarot-diary-79838",
  storageBucket: "tarot-diary-79838.firebasestorage.app",
  messagingSenderId: "여기에_진짜_messagingSenderId",
  appId: "여기에_진짜_appId"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);