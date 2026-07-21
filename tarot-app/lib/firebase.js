import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDZfZC-KhJpLygM0QdqQAxOHVo1ZupoXpA",
  authDomain: "tarot-diary-79838.firebaseapp.com",
  projectId: "tarot-diary-79838",
  storageBucket: "tarot-diary-79838.firebasestorage.app",
  messagingSenderId: "360314638573",
  appId: "1:360314638573:web:dcdc5f6e38151b4a5abce4",
  measurementId: "G-C2M5ZC7YDL"
};

//파이어베이스 중복 초기화 방지 코드 포함
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);