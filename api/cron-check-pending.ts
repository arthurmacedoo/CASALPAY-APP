import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { initFirebaseAdmin } from "./_firebase-admin.js";
import { sendPushToGroup } from "./push.js";

// Inicializa Firebase Admin SDK
initFirebaseAdmin();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── CORS Headers (Caso seja chamado do frontend para testes) ──────────────────
  const origin = req.headers.origin;
  const allowedOrigins = ["https://casalpay.vercel.app"];
  
  if (origin && (allowedOrigins.includes(origin) || origin.startsWith("http://localhost:"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://casalpay.vercel.app");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Autenticação do Cron ──────────────────────────────────────────────────
  const authHeader = req.headers.authorization ?? "";
  const CRON_SECRET = process.env.CRON_SECRET;

  if (!CRON_SECRET) {
    console.error("[cron] CRON_SECRET não configurado nas variáveis de ambiente.");
    return res.status(500).json({ error: "Server config error: CRON_SECRET is missing" });
  }

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn("[cron] Tentativa de acesso não autorizada ao cron.");
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!getApps().length) {
    return res.status(500).json({ error: "Firebase Admin não inicializado" });
  }

  const db = getFirestore();

  try {
    console.log("[cron] Iniciando verificação diária de despesas pendentes...");

    // 1. Busca todas as transações pendentes usando Collection Group Query
    // Isso busca na subcoleção "transactions" de todos os grupos de uma vez.
    const pendingSnap = await db
      .collectionGroup("transactions")
      .where("status", "==", "pending")
      .get();

    if (pendingSnap.empty) {
      console.log("[cron] Nenhuma despesa pendente encontrada no sistema.");
      return res.status(200).json({ ok: true, message: "No pending transactions found." });
    }

    // 2. Agrupa as transações por groupId
    const groupsWithPending = new Map<string, number>();
    pendingSnap.forEach((doc) => {
      // O parent.parent de "groups/{groupId}/transactions/{docId}" é o documento do grupo "groups/{groupId}"
      const groupRef = doc.ref.parent.parent;
      if (groupRef) {
        const groupId = groupRef.id;
        const currentCount = groupsWithPending.get(groupId) || 0;
        groupsWithPending.set(groupId, currentCount + 1);
      }
    });

    console.log(`[cron] Encontrados ${groupsWithPending.size} grupo(s) com despesas pendentes.`);

    const results: Array<{ groupId: string; pendingCount: number; status: string; detail?: string }> = [];

        // 3. Para cada grupo, envia um lembrete consolidado e data-only.
    // O service worker é o único responsável por exibir a notificação em background,
    // evitando duplicidade entre payload notification e showNotification.
    for (const [groupId, pendingCount] of groupsWithPending.entries()) {
      try {
        const title = "🟢 Pendências aguardando revisão";
        const body = pendingCount === 1
          ? "Você tem 1 despesa na aba Pendentes. Abra o CasalPay para confirmar."
          : `Você tem ${pendingCount} despesas na aba Pendentes. Abra o CasalPay para confirmar.`;

        const pushResult = await sendPushToGroup(db, {
          groupId,
          title,
          body,
          url: "/?view=pending",
          tag: "casalpay-pending-daily-reminder",
          kind: "pending-daily-reminder",
        });

        if (pushResult.tokenCount === 0) {
          console.warn(`[cron] Grupo "${groupId}" tem ${pendingCount} pendência(s), mas nenhum token FCM registrado.`);
          results.push({ groupId, pendingCount, status: "no_tokens" });
          continue;
        }

        if (pushResult.successCount === 0) {
          console.warn(`[cron] Nenhum dispositivo aceitou o lembrete do grupo "${groupId}".`);
          results.push({
            groupId,
            pendingCount,
            status: "error",
            detail: `${pushResult.failureCount} falha(s) no FCM; tokens inválidos foram removidos quando aplicável`,
          });
          continue;
        }

        console.log(`[cron] Lembrete enviado para o grupo "${groupId}": ${pushResult.successCount} ok, ${pushResult.failureCount} falha(s).`);
        results.push({
          groupId,
          pendingCount,
          status: "sent",
          detail: `${pushResult.successCount} enviado(s), ${pushResult.failureCount} falha(s)`
        });

      } catch (groupErr: any) {

        console.error(`[cron] Falha ao processar notificações do grupo "${groupId}":`, groupErr.message);
        results.push({ groupId, pendingCount, status: "error", detail: groupErr.message });
      }
    }

    return res.status(200).json({ ok: true, processedGroups: results });

  } catch (err: any) {
    const msg = err.message || String(err);
    console.error("[cron] Erro crítico durante varredura de pendências:", msg);

    // Se o erro indicar falta de índice de Collection Group, avisa de forma mais amigável
    if (msg.includes("index") || msg.includes("FAILED_PRECONDITION")) {
      console.warn("[cron] Considere criar o índice de Collection Group para a coleção 'transactions' com o campo 'status' no console do Firebase.");
      return res.status(500).json({ 
        error: "Missing Firestore Collection Group index for transactions(status). Please check Vercel/Firebase logs for creation link.",
        detail: msg 
      });
    }

    return res.status(500).json({ error: "Internal Server Error", detail: msg });
  }
}
