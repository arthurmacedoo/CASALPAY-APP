import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});

async function run() {
  const db = getFirestore();
  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";
  const snap = await db.collection("couples").doc(COUPLE_ID).collection("fcm_tokens").get();
  
  console.log(`Total tokens: ${snap.size}`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`- Doc: ${doc.id}, User: ${data.user}, Platform: ${data.platform}, Date: ${data.createdAt?.toDate?.()}`);
  });
}
run();
