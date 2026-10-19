import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC1Fb5Jo4ZPo223TfUEZdpRf7ql8SfHpsY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "camman-01.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "camman-01",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "camman-01.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "464475327191",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:464475327191:web:70b692d3470485816bbe92",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-0F5F76BYGY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (err) {
    // Analytics is blocked or unsupported in this browser environment
    console.warn('[Firebase] Analytics disabled:', err.message);
  }
}
export { analytics };

export default app;
