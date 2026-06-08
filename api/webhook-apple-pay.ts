import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// ── Firebase Admin (singleton) ────────────────────────────────────────────────
if (!getApps().length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

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

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Extrai "YYYY-MM" a partir de "YYYY-MM-DD". */
function getMonthKey(date: string): string {
  return date.slice(0, 7);
}

/** Converte valor em reais (float ou string) para centavos (inteiro). */
function toCents(value: unknown): number | null {
  const num = typeof value === "string"
    ? parseFloat(value.replace(",", "."))
    : Number(value);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num * 100);
}

/** Valida formato YYYY-MM-DD. */
function isValidDate(date: unknown): date is string {
  if (typeof date !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/** Data de hoje no formato YYYY-MM-DD usando o relógio do servidor. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Resultado da validação ────────────────────────────────────────────────────
type ValidationResult =
  | { ok: true; amountCents: number; description: string; finalDate: string }
  | { ok: false; reason: string };

/**
 * TAREFA 1 — Validação estrita dos dados recebidos.
 * Retorna os campos prontos para uso OU o motivo da falha.
 */
function validateBody(body: Record<string, unknown>): ValidationResult {
  const { amount, description, date } = body;

  // Valida amount: deve existir, ser número válido e maior que zero
  const amountCents = toCents(amount);
  if (!amountCents) {
    return { ok: false, reason: "Valor não identificado" };
  }

  // Valida description: não pode ser vazia, nula ou a string literal "undefined"
  if (
    description === null ||
    description === undefined ||
    typeof description !== "string" ||
    description.trim() === "" ||
    description.trim().toLowerCase() === "undefined"
  ) {
    return { ok: false, reason: "Descrição ausente ou inválida" };
  }

  // Valida date: aceita YYYY-MM-DD; usa hoje como fallback se inválida
  const finalDate = isValidDate(date) ? date : todayISO();

  return {
    ok: true,
    amountCents,
    description: description.trim(),
    finalDate,
  };
}

/**
 * TAREFA 2 — Cria uma despesa de "alerta" na caixa de Pendentes quando
 * a validação falha. Garante que o usuário veja o problema no app e possa
 * revisar/corrigir manualmente sem perder o registro.
 */
async function saveFallbackExpense(
  db: FirebaseFirestore.Firestore,
  coupleId: string,
  reason: string,
  rawBody: Record<string, unknown>
): Promise<string> {
  const fallbackDate = isValidDate(rawBody.date) ? (rawBody.date as string) : todayISO();

  const docData = {
    type:        "expense",
    description: `⚠️ Erro Apple Pay: ${reason}`,
    amount:      1,              // 1 centavo — simbólico, para passar regras de negócio
    date:        fallbackDate,
    monthKey:    getMonthKey(fallbackDate),
    coupleId,
    paidBy:      "Zara",
    splitType:   "100% Zara",
    status:      "pending",      // Aparece na aba "Pendentes" para revisão manual
    source:      "webhook-apple-pay-fallback",
    rawPayload:  JSON.stringify(rawBody).slice(0, 500), // Dado original para debug
    createdAt:   FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
  };

  const ref = await db
    .collection("couples")
    .doc(coupleId)
    .collection("transactions")
    .add(docData);

  console.warn(`[webhook] Fallback criado: ${ref.id} — Motivo: ${reason}`);
  return ref.id;
}

/**
 * TAREFA 3 — Envia alerta FCM para ambos os membros do casal.
 * Reutiliza a mesma lógica de tokens do send-notification.ts.
 * É best-effort: nunca lança exceção — erros são apenas logados.
 */
async function sendCriticalAlert(
  db: FirebaseFirestore.Firestore,
  coupleId: string,
  message: string
): Promise<void> {
  if (!getApps().length) return;

  try {
    const messaging = getMessaging();
    const targets = ["Arthur", "Zara"];

    for (const target of targets) {
      const tokenDoc = await db
        .collection("couples")
        .doc(coupleId)
        .collection("fcm_tokens")
        .doc(target)
        .get();

      const fcmToken = tokenDoc.data()?.token;
      if (!fcmToken || typeof fcmToken !== "string") continue;

      await messaging.send({
        token: fcmToken,
        notification: {
          title: "🚨 CasalPay — Alerta Apple Pay",
          body:  message,
        },
        webpush: {
          notification: {
            icon:  "/icon-192.png",
            badge: "/icon-192.png",
            tag:   "casalpay-critical-alert",
          },
          headers: { Urgency: "high", TTL: "300" },
        },
      });

      console.log(`[webhook] Alerta crítico enviado para ${target}`);
    }
  } catch (notifErr) {
    // Erros de notificação são secundários — logamos e continuamos
    const msg = notifErr instanceof Error ? notifErr.message : String(notifErr);
    console.error("[webhook] Falha ao enviar alerta FCM:", msg);
  }
}

// ── Handler Principal ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS para chamadas do iOS Shortcuts via HTTP
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // ── Segurança: Bearer token ────────────────────────────────────────────────
  const authHeader     = req.headers.authorization ?? "";
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("[webhook] WEBHOOK_SECRET não configurado");
    return res.status(500).json({ error: "Server config error" });
  }

  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    console.warn("[webhook] Token inválido:", authHeader.slice(0, 20));
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── Firebase Admin disponível? ─────────────────────────────────────────────
  if (!getApps().length) {
    return res.status(500).json({ error: "Firebase Admin não inicializado" });
  }

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";
  const db        = getFirestore();
  const rawBody   = (req.body ?? {}) as Record<string, unknown>;

  // ── TAREFA 3: Try/Catch Global (erros de infraestrutura) ──────────────────
  try {

    // ── TAREFA 1: Validação Estrita ──────────────────────────────────────────
    const validation = validateBody(rawBody);

    if (!validation.ok) {
      console.warn(`[webhook] Validação falhou — ${validation.reason}`, rawBody);

      // ── TAREFA 2: Cria despesa de alerta nos Pendentes ─────────────────────
      const fallbackId = await saveFallbackExpense(db, COUPLE_ID, validation.reason, rawBody);

      // Notifica ambos sobre a compra com dados incompletos
      await sendCriticalAlert(
        db,
        COUPLE_ID,
        `Compra Apple Pay com dados incompletos detectada. Motivo: "${validation.reason}". Verifique a aba Pendentes.`
      );

      // HTTP 200: a requisição foi aceita e salva como fallback (sucesso parcial)
      return res.status(200).json({
        ok:       false,
        fallback: true,
        id:       fallbackId,
        reason:   validation.reason,
        message:  "Dados inválidos. Despesa de alerta criada nos Pendentes para revisão manual.",
      });
    }

    // ── Dados válidos: grava despesa normal como Pendente ─────────────────────
    const { amountCents, description, finalDate } = validation;
    const monthKey = getMonthKey(finalDate);

    const docData = {
      type:        "expense",
      description,
      amount:      amountCents,
      date:        finalDate,
      monthKey,
      coupleId:    COUPLE_ID,
      paidBy:      "Zara",
      splitType:   "100% Zara",
      status:      "pending",    // Fica nos Pendentes para confirmação manual
      source:      "webhook-apple-pay",
      createdAt:   FieldValue.serverTimestamp(),
      updatedAt:   FieldValue.serverTimestamp(),
    };

    const ref = await db
      .collection("couples")
      .doc(COUPLE_ID)
      .collection("transactions")
      .add(docData);

    console.log(`[webhook] Despesa criada: ${ref.id} — ${description} — R$ ${(amountCents / 100).toFixed(2)}`);

    return res.status(201).json({
      ok:      true,
      id:      ref.id,
      amount:  amountCents,
      date:    finalDate,
      monthKey,
    });

  } catch (err: unknown) {
    // ── Erro de infraestrutura (Firebase down, env ausente, etc.) ─────────────
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] Erro crítico de infraestrutura:", msg);

    // Best-effort: tenta notificar o casal; falha aqui não propaga
    try {
      await sendCriticalAlert(
        db,
        COUPLE_ID,
        "Falha crítica ao registrar compra no Apple Pay. Verifique o sistema."
      );
    } catch {
      // silencia — o erro primário já foi logado acima
    }

    return res.status(500).json({ error: "Internal server error", detail: msg });
  }
}
