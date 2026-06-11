import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

/**
 * Gera um hash curto e estável de uma string (token FCM).
 * Usado como ID do documento: couples/{id}/fcm_tokens/{user}_{hash}
 * Garante que cada token tem seu próprio documento — sem sobrescrita entre devices.
 */
function shortHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!getApps().length) {
    return res.status(500).json({ error: "Server config error: Firebase Admin não inicializado." });
  }

  const { token, user, platform, userAgent } = req.body ?? {};

  if (!token || !user) {
    return res.status(400).json({ error: "token e user são obrigatórios" });
  }

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";

  try {
    const db = getFirestore();

    // ID do documento = "{user}_{hashDoToken}" — único por (pessoa + dispositivo)
    const docId = `${user}_${shortHash(token)}`;

    await db
      .collection("couples")
      .doc(COUPLE_ID)
      .collection("fcm_tokens")
      .doc(docId)
      .set({
        token,
        user,             // "Arthur" ou "Zara"
        platform: platform || "unknown",
        userAgent: userAgent || "",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
      }, { merge: true });

    console.log(`[FCM] Token registrado para ${user} (doc: ${docId})`);
    return res.status(200).json({ ok: true, docId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[FCM] Erro ao salvar token:", msg);
    return res.status(500).json({ error: msg });
  }
}
