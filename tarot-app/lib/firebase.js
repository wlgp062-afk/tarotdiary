import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDZfZC-KhJpLygM0QdQqAXOHVo1ZupoXpA",
  authDomain: "tarot-diary-79838.firebaseapp.com",
  projectId: "tarot-diary-79838",
  storageBucket: "tarot-diary-79838.appspot.com",
  messagingSenderId: "360314638573",
  appId: "1:360314638573:web:dcdc5f6e38151b4a5abce4",
  measurementId: "G-C2M5ZC7YDL"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);