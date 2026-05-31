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

  // Valida se o Admin SDK foi inicializado
  if (!getApps().length) {
    return res.status(500).json({
      error:
        "Configuração do servidor incompleta. Configure as variáveis FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY na Vercel.",
    });
  }

  const { senderEmail, message, title } = req.body ?? {};

  if (!senderEmail || !message) {
    return res.status(400).json({ error: "senderEmail e message são obrigatórios." });
  }

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";

  try {
    const db = getFirestore();

    // Busca todos os tokens FCM registrados do casal
    const tokensSnap = await db
      .collection("couples")
      .doc(COUPLE_ID)
      .collection("fcm_tokens")
      .get();

    if (tokensSnap.empty) {
      return res.status(404).json({
        error:
          "Nenhum dispositivo registrado ainda. Os dois precisam abrir o app e aceitar as notificações.",
      });
    }

    // Filtra: envia apenas para o DESTINATÁRIO (não para quem clicou)
    const tokensToNotify: string[] = [];
    tokensSnap.forEach((snap) => {
      const data = snap.data();
      const dbEmail = (data.email || "").toLowerCase();
      const sendEmail = senderEmail.toLowerCase();

      if (dbEmail !== sendEmail && typeof data.token === "string" && data.token.length > 0) {
        tokensToNotify.push(data.token);
      }
    });

    if (tokensToNotify.length === 0) {
      return res.status(404).json({
        error:
          "O destinatário ainda não abriu o app ou não aceitou as notificações.",
      });
    }

    // Dispara as notificações — uma por token (suporta múltiplos dispositivos)
    const messaging = getMessaging();
    const results = await Promise.allSettled(
      tokensToNotify.map((token) =>
        messaging.send({
          token,
          notification: {
            title: title ?? "CasalPay 💞",
            body: message,
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "casalpay-messages",
              priority: "high",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
            headers: {
              "apns-priority": "10",
            },
          },
          webpush: {
            notification: {
              title: title ?? "CasalPay 💞",
              body: message,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag: "casalpay-love",
              renotify: true,
              vibrate: [200, 100, 200],
            },
            headers: {
              Urgency: "high",
            },
          },
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed    = results.filter((r) => r.status === "rejected");

    if (succeeded === 0) {
      console.error("[FCM] Todos os envios falharam:", failed);
      return res.status(500).json({ error: "Falha ao entregar a notificação." });
    }

    return res.status(200).json({ ok: true, sent: succeeded });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno desconhecido";
    console.error("[FCM] Erro no handler:", msg);
    return res.status(500).json({ error: msg });
  }
}
