import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { initFirebaseAdmin, verifyUserToken } from "./_firebase-admin.js";

// Inicializa Firebase Admin SDK
initFirebaseAdmin();

// ── Handler principal ────────────────────────────────────────────────────────
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // ── Autenticação ──────────────────────────────────────────────────────────
  try {
    await verifyUserToken(req.headers.authorization);
  } catch (err: any) {
    console.warn("[FCM Send] Falha de autenticação:", err.message);
    return res.status(401).json({ error: "Unauthorized", detail: err.message });
  }

  const { target, title, message, groupId } = req.body ?? {};

  if (!target || !message) {
    return res.status(400).json({ error: "target e message são obrigatórios." });
  }
  
  if (!groupId) {
    return res.status(400).json({ error: "groupId é obrigatório no SaaS." });
  }


  try {
    const db = getFirestore();
    const messaging = getMessaging();

    // Busca TODOS os tokens do destinatário (múltiplos dispositivos)
    const tokensSnap = await db
      .collection("groups")
      .doc(groupId)
      .collection("fcm_tokens")
      .where("user", "==", target)
      .get();

    if (tokensSnap.empty) {
      return res.status(404).json({
        error: `${target} não tem nenhum dispositivo registrado. Peça para ${target} abrir o app, ` +
          `instalar na Tela de Início (iPhone) e aceitar as notificações.`,
      });
    }

    // Deduplica tokens e associa ao docId para limpeza posterior
    const tokenMap = new Map<string, string>(); // token -> docId
    tokensSnap.forEach((docSnap) => {
      const tkn = docSnap.data()?.token;
      if (tkn && typeof tkn === "string" && tkn.length > 0) {
        tokenMap.set(tkn, docSnap.id);
      }
    });

    if (tokenMap.size === 0) {
      return res.status(404).json({
        error: `Tokens de ${target} estão vazios. Peça para ${target} abrir o app novamente.`,
      });
    }

    const tokens = Array.from(tokenMap.keys());
    console.log(`[FCM] Enviando para ${target}: ${tokens.length} token(s)`);

    // Envia para todos os tokens de uma vez usando sendEachForMulticast
    const multicastMessage = {
      tokens,
      data: {
        title: title ?? "CasalPay:",
        body: message,
        url: "/messages",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "casalpay-love",
      },
      webpush: {
        headers: {
          Urgency: "high",
          TTL: "60",
          Topic: "casalpay-msg",
        },
      },
      apns: {
        headers: {
          "apns-collapse-id": "casalpay-msg",
        },
      },
    };

    const batchResponse = await messaging.sendEachForMulticast(multicastMessage);

    // Remove tokens inválidos do Firestore
    const batch = db.batch();
    let tokensRemoved = 0;
    batchResponse.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code ?? "";
        const isInvalidToken =
          errCode.includes("registration-token-not-registered") ||
          errCode.includes("invalid-registration-token") ||
          errCode.includes("sender-id-mismatch") ||
          errCode.includes("mismatched-credential");

        if (isInvalidToken) {
          const token = tokens[idx];
          const docId = tokenMap.get(token);
          if (docId) {
            const docRef = db
              .collection("groups")
              .doc(groupId)
              .collection("fcm_tokens")
              .doc(docId);
            batch.delete(docRef);
            tokensRemoved++;
            console.warn(`[FCM] Token inválido removido: doc ${docId} (erro: ${errCode})`);
          }
        } else {
          console.error(`[FCM] Falha no token ${idx}: ${errCode} — ${resp.error?.message}`);
        }
      }
    });

    if (tokensRemoved > 0) {
      await batch.commit();
      console.log(`[FCM] ${tokensRemoved} token(s) inválido(s) removido(s) do Firestore.`);
    }

    const successCount = batchResponse.successCount;
    const failureCount = batchResponse.failureCount;

    console.log(`[FCM] Resultado: ${successCount} enviado(s), ${failureCount} falha(s).`);

    if (successCount === 0) {
      return res.status(502).json({
        ok: false,
        error: `Nenhum aparelho ativo encontrado para ${target}. ` +
          `Todos os tokens eram inválidos e foram removidos. ` +
          `Peça para ${target} abrir o app novamente para registrar o dispositivo.`,
        attemptedCount: tokens.length,
        successCount: 0,
        failureCount,
      });
    }

    return res.status(200).json({
      ok: true,
      target,
      attemptedCount: tokens.length,
      successCount,
      failureCount,
      sent: successCount,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno desconhecido";
    console.error("[FCM] Erro no handler:", msg);
    return res.status(500).json({ error: msg });
  }
}
