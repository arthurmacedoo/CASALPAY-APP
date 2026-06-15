import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// ── Inicializa Firebase Admin SDK (singleton) ────────────────────────────────
if (!getApps().length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n");

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    console.error("[FCM] Variáveis de ambiente do Firebase Admin SDK não configuradas.");
  } else {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
}

// ── Handler principal ────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!getApps().length) {
    return res.status(500).json({ error: "Configuração do servidor incompleta." });
  }

  // "target" é o nome do DESTINATÁRIO: "Arthur" ou "Zara"
  const { target, title, message } = req.body ?? {};

  if (!target || !message) {
    return res.status(400).json({ error: "target e message são obrigatórios." });
  }

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";

  try {
    const db = getFirestore();
    const messaging = getMessaging();

    // Busca TODOS os tokens do destinatário (múltiplos dispositivos)
    const tokensSnap = await db
      .collection("couples")
      .doc(COUPLE_ID)
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
              .collection("couples")
              .doc(COUPLE_ID)
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
