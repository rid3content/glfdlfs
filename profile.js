// ============================================================
//  Firebase config — инициализация подключения к базе Google
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Твоя конфигурация проекта (Firebase Console -> Project settings)
const firebaseConfig = {
  apiKey: "AIzaSyCLVSjhr4NTNyx0AI0S3rt6K2UdU7Egh80",
  authDomain: "rid3-chat.firebaseapp.com",
  projectId: "rid3-chat",
  storageBucket: "rid3-chat.firebasestorage.app",
  messagingSenderId: "50099464029",
  appId: "1:50099464029:web:96d71f7fcaf03802142ab4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Реэкспорт функций SDK, чтобы остальные модули брали их из одного места
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
  getDocs,
  limit
};
