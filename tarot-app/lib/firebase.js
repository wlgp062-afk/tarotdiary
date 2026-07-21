import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "여기에_파이어베이스_콘솔에서_복사한_진짜_apiKey를_넣으세요",
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