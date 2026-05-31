import { initializeApp } from "firebase/app";
import { 
  initializeAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  collection,
  doc,
} from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

// ─────────────────────────────────────────────────────────────────────────────
// Configuração do Firebase — variáveis no arquivo .env
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "casalpay.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: "590507010136", // FIXED: Was missing a '1' in the env var
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// ─────────────────────────────────────────────────────────────────────────────
// Authentication — Custom AuthDomain para PWA e persistência em IndexedDB
// ─────────────────────────────────────────────────────────────────────────────
export const auth = initializeAuth(app, {
  persistence: [
    indexedDBLocalPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Firestore — persistentLocalCache substitui o deprecated enableIndexedDbPersistence
// ─────────────────────────────────────────────────────────────────────────────
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Cloud Messaging — para push notifications
// Apenas instanciado em contextos que suportam (não no Service Worker)
// ─────────────────────────────────────────────────────────────────────────────
export const getFirebaseMessaging = () => {
  if (typeof window === "undefined") return null;
  try {
    return getMessaging(app);
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ID do casal — identificador (não é segredo, proteção real vem dos UIDs no Firestore)
// O mesmo valor deve ser usado nos dois celulares via .env
// ─────────────────────────────────────────────────────────────────────────────
export const COUPLE_ID =
  import.meta.env.VITE_COUPLE_ID || "arthur-namorada-2026";

// ─────────────────────────────────────────────────────────────────────────────
// Referências Firestore
// Estrutura: /couples/{coupleId}/transactions/{transactionId}
// ─────────────────────────────────────────────────────────────────────────────

/** Referência ao documento do casal */
export const coupleDocRef = () => doc(db, "couples", COUPLE_ID);

/** Coleção de transações do casal */
export const transactionsRef = () =>
  collection(db, "couples", COUPLE_ID, "transactions");

/** Referência a uma transação específica */
export const transactionDocRef = (id: string) =>
  doc(db, "couples", COUPLE_ID, "transactions", id);

/** Coleção de tokens FCM do casal */
export const fcmTokensRef = () =>
  collection(db, "couples", COUPLE_ID, "fcm_tokens");
