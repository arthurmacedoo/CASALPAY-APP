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

// ─────────────────────────────────────────────────────────────────────────────
// Configuração do Firebase — variáveis no arquivo .env
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "casalpay.vercel.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
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
