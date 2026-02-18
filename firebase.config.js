import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCyVDBJVFCu9otK51Z1p9BHLEfbkdY_TPU",
  authDomain: "evenly-6ff36.firebaseapp.com",
  projectId: "evenly-6ff36",
  storageBucket: "evenly-6ff36.firebasestorage.app",
  messagingSenderId: "240071770069",
  appId: "1:240071770069:web:1818b83f2606ed0d2cc75c",
  measurementId: "G-HZJL54JEB7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;