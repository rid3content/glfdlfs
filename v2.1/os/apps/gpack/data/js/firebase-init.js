// ============================================================================
// firebase-init.js
// Инициализация Firebase. Это единственное назначение данного модуля — связь
// с БД (Firestore) и аналитикой. Конфигурация ровно такая, какую предоставил
// заказчик — ничего лишнего сюда не добавляется.
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAZMr0-lg2UvcdVAZcyGDNELmvsoPNspa8",
  authDomain: "gpack-org.firebaseapp.com",
  projectId: "gpack-org",
  storageBucket: "gpack-org.firebasestorage.app",
  messagingSenderId: "876861822138",
  appId: "1:876861822138:web:b19cf630c4e7ae11835e83",
  measurementId: "G-HT41ZKYPRJ",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Analytics не работает в некоторых окружениях (например file://), поэтому
// оборачиваем в try/catch, чтобы не ронять остальное приложение.
export let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  console.warn("[gpack] Analytics недоступна в этом окружении:", err.message);
}

// Firestore — сама "база", в которую пишутся запросы пользователей и готовые
// конфиги, и из которой читается флаг ai_enabled. Схему коллекций подключит
// заказчик самостоятельно, здесь используются условные, понятные названия.
export const db = getFirestore(app);

export { collection, addDoc, doc, getDoc, serverTimestamp };
