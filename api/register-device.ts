import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initFirebaseAdmin, verifyUserToken } from "./_firebase-admin.js";

// Inicializa Firebase Admin SDK
initFirebaseAdmin();

/**
 * Gera um hash curto e estável de uma string (token FCM).
 * Usado como ID do documento: groups/{groupId}/fcm_tokens/{user}_{hash}
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
  const origin = req.headers.origin;
  const allowedOrigins = ["https://casalpay.vercel.app"];
  
  if (origin && (allowedOrigins.includes(origin) || origin.startsWith("http://localhost:"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://casalpay.vercel.app");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Autenticação ──────────────────────────────────────────────────────────
  let requesterUid: string;
  try {
    requesterUid = await verifyUserToken(req.headers.authorization);
  } catch (err: any) {
    console.warn("[FCM Register] Falha de autenticação:", err.message);
    return res.status(401).json({ error: "Unauthorized", detail: err.message });
  }

  const { token, user, platform, userAgent, groupId } = req.body ?? {};

  if (!token || !user) {
    return res.status(400).json({ error: "token e user são obrigatórios" });
  }

  if (!groupId) {
    return res.status(400).json({ error: "groupId é obrigatório no modelo SaaS" });
  }

  try {
    const db = getFirestore();

    // ID do documento = "{user}_{hashDoToken}" — único por (pessoa + dispositivo)
    const docId = `${user}_${shortHash(token)}`;

    // Grava diretamente na coleção do grupo ativo
    await db
      .collection("groups")
      .doc(groupId)
      .collection("fcm_tokens")
      .doc(docId)
      .set({
        token,
        user,             // "Arthur" ou "Zara"
        platform: platform || "unknown",
        userAgent: userAgent || "",
        registeredByUid: requesterUid, // Rastreabilidade do registro
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastSeenAt: FieldValue.serverTimestamp(),
      }, { merge: true });

    console.log(`[FCM] Token registrado para ${user} no grupo ${groupId} (doc: ${docId})`);
    return res.status(200).json({ ok: true, docId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[FCM] Erro ao salvar token:", msg);
    return res.status(500).json({ error: msg });
  }
}

