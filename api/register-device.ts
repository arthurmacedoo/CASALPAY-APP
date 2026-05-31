import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Inicializa Firebase Admin SDK (singleton)
if (!getApps().length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n");

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!getApps().length) {
    return res.status(500).json({ error: "Server config error" });
  }

  // "user" é o nome fixo do perfil: "Arthur" ou "Zara"
  const { token, user, platform } = req.body ?? {};

  if (!token || !user) {
    return res.status(400).json({ error: "token e user são obrigatórios" });
  }

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";

  try {
    const db = getFirestore();

    // Documento identificado pelo nome (ex: doc "Arthur" ou doc "Zara")
    await db
      .collection("couples")
      .doc(COUPLE_ID)
      .collection("fcm_tokens")
      .doc(user)
      .set({
        token,
        user,           // "Arthur" ou "Zara"
        updatedAt: new Date(),
        platform: platform || "unknown",
      }, { merge: true });

    console.log(`[FCM] Token registrado para ${user}`);
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[FCM] Erro ao salvar token:", msg);
    return res.status(500).json({ error: msg });
  }
}
