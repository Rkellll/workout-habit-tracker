
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2pd1hiFVZoiF7kyTVBYnrVlmIWKa7yMU",
  authDomain: "workout-habit-tracker.firebaseapp.com",
  projectId: "workout-habit-tracker",
  storageBucket: "workout-habit-tracker.firebasestorage.app",
  messagingSenderId: "194084933461",
  appId: "1:194084933461:web:37b20ae3cfd2116f0069dc",
  measurementId: "G-X706P57P7S"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
