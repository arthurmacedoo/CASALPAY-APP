import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// ── Inicializa Firebase Admin SDK (singleton) ────────────────────────────────
if (!getApps().length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n"); // env vars escapam \n — precisa reverter

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
  // CORS — mesmo domínio Vercel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  if (!getApps().length) {
    return res.status(500).json({
      error: "Configuração do servidor incompleta. Configure as variáveis FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY na Vercel.",
    });
  }

  // "target" é o nome do DESTINATÁRIO: "Arthur" ou "Zara"
  const { target, title, message } = req.body ?? {};

  if (!target || !message) {
    return res.status(400).json({ error: "target e message são obrigatórios." });
  }

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";

  try {
    const db = getFirestore();

    // Busca DIRETAMENTE o documento do destinatário pelo nome (ex: doc "Zara")
    const tokenDoc = await db
      .collection("couples")
      .doc(COUPLE_ID)
      .collection("fcm_tokens")
      .doc(target)
      .get();

    if (!tokenDoc.exists) {
      return res.status(404).json({
        error: `${target} ainda não abriu o app ou não aceitou as notificações.`,
      });
    }

    const tokenData = tokenDoc.data();
    const fcmToken  = tokenData?.token;

    if (!fcmToken || typeof fcmToken !== "string" || fcmToken.length === 0) {
      return res.status(404).json({
        error: `Token FCM de ${target} está vazio ou inválido. Peça para ${target} abrir o app novamente.`,
      });
    }

    console.log(`[FCM] Enviando para ${target} (token: ...${fcmToken.slice(-8)})`);

    // Estratégia data-only: sem "notification" na raiz.
    // O onBackgroundMessage do SW exibe o banner manualmente no iOS PWA.
    const messaging = getMessaging();
    await messaging.send({
      token: fcmToken,
      webpush: {
        data: {
          title: title ?? "CasalPay 💞",
          body:  message,
        },
        headers: {
          Urgency: "high",
          TTL: "60",
        },
      },
    });

    console.log(`[FCM] Notificação entregue para ${target} com sucesso.`);
    return res.status(200).json({ ok: true, sent: 1 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno desconhecido";
    console.error("[FCM] Erro no handler:", msg);
    return res.status(500).json({ error: msg });
  }
}
