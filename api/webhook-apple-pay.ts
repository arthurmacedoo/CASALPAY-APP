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

/**
 * Sanitiza um clientEventId para uso seguro como ID de documento Firestore.
 * Remove caracteres inválidos; trunca para 128 chars.
 */
function sanitizeEventId(raw: string): string {
  return raw
    .replace(/[\/\\.\s#$\[\]]/g, "_")
    .slice(0, 128);
}

/**
 * Higieniza e converte um valor monetário para centavos.
 * Aceita: "R$ 15,90", "15.90", " 15,90 ", "BRL 15.90", "1590" etc.
 * Retorna null se o resultado for zero, negativo ou não-numérico.
 */
function toCents(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  let raw = String(value).trim();

  // Remove tudo que não seja dígito, vírgula ou ponto
  raw = raw.replace(/[^\d,.]/g, "");

  if (!raw) return null;

  // Detecta o separador decimal:
  // "1.234,56" → ponto como milhar, vírgula como decimal → remove ponto, troca vírgula
  // "1,234.56" → vírgula como milhar, ponto como decimal → remove vírgula
  // "15,90"    → só vírgula → troca por ponto
  // "15.90"    → só ponto   → manter
  const hasComma = raw.includes(",");
  const hasDot   = raw.includes(".");

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot   = raw.lastIndexOf(".");
    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (hasComma) {
    raw = raw.replace(",", ".");
  }

  const num = parseFloat(raw);
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
// Objeto simples com errorReason opcional para evitar problemas de narrowing
// de union types no compilador do Vercel.
type ValidationResult = {
  amountCents: number;    // 0 = falha
  description: string;
  finalDate: string;
  errorReason?: string;   // definido apenas quando a validação falha
};

/**
 * Validação com higienização inteligente:
 * - Amount: limpa símbolos antes de converter
 * - Description: usa "Compra Apple Pay" se ausente (NÃO falha)
 * - Date: usa hoje como fallback se inválida
 * - Falha APENAS se o amount for irrecuperável (retorna errorReason)
 */
function validateBody(body: Record<string, unknown>): ValidationResult {
  const { amount, description, date } = body;

  // 1. Higieniza e valida o amount — único motivo de fallback real
  const amountCents = toCents(amount) ?? 0;
  if (amountCents <= 0) {
    return {
      amountCents: 0,
      description: "",
      finalDate: isValidDate(date) ? date : todayISO(),
      errorReason: `Valor irrecuperável: "${String(amount ?? "ausente")}"`,
    };
  }

  // 2. Description: usa padrão se vazio/nulo/undefined/"undefined"
  const rawDesc = typeof description === "string" ? description.trim() : "";
  const finalDescription =
    rawDesc === "" || rawDesc.toLowerCase() === "undefined"
      ? "Compra Apple Pay"
      : rawDesc;

  // 3. Date: usa hoje se inválida
  const finalDate = isValidDate(date) ? date : todayISO();

  return { amountCents, description: finalDescription, finalDate };
}

/**
 * Cria uma despesa de "alerta" na caixa de Pendentes quando
 * a validação falha — amount completamente irrecuperável.
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
    amount:      1,
    date:        fallbackDate,
    monthKey:    getMonthKey(fallbackDate),
    coupleId,
    paidBy:      "partner",
    splitType:   "100% partner",
    status:      "pending",
    source:      "webhook-apple-pay-fallback",
    rawPayload:  JSON.stringify(rawBody).slice(0, 500),
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
 * Envia uma notificação para TODOS os tokens FCM do casal de uma vez.
 * Usa sendEachForMulticast para evitar notificações duplicadas.
 * Best-effort: nunca lança exceção.
 */
async function sendCriticalAlert(
  db: FirebaseFirestore.Firestore,
  coupleId: string,
  message: string
): Promise<void> {
  if (!getApps().length) return;

  try {
    const messaging = getMessaging();

    const tokensSnap = await db
      .collection("couples")
      .doc(coupleId)
      .collection("fcm_tokens")
      .get();

    const tokens: string[] = [];
    tokensSnap.forEach((doc) => {
      const token = doc.data()?.token;
      if (token && typeof token === "string" && !tokens.includes(token)) {
        tokens.push(token);
      }
    });

    if (tokens.length === 0) {
      console.warn("[webhook] Nenhum token FCM encontrado para notificar.");
      return;
    }

    const response = await messaging.sendEachForMulticast({
      tokens,
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

    console.log(`[webhook] Notificação enviada: ${response.successCount} ok, ${response.failureCount} falha(s).`);
  } catch (notifErr) {
    const msg = notifErr instanceof Error ? notifErr.message : String(notifErr);
    console.error("[webhook] Falha ao enviar alerta FCM:", msg);
  }
}

/**
 * Verifica idempotência via coleção apple_pay_events.
 * Retorna o ID da transação existente se for duplicata, ou null se for novo.
 *
 * Estrutura Firestore:
 *   couples/{coupleId}/apple_pay_events/{sanitizedEventId}
 *     → { transactionId, amountCents, description, date, processedAt }
 */
async function checkAndRegisterEvent(
  db: FirebaseFirestore.Firestore,
  coupleId: string,
  eventId: string
): Promise<string | null> {
  const sanitized = sanitizeEventId(eventId);
  const eventRef = db
    .collection("couples")
    .doc(coupleId)
    .collection("apple_pay_events")
    .doc(sanitized);

  const snap = await eventRef.get();
  if (snap.exists) {
    // Já foi processado — retorna o ID da transação original
    const data = snap.data() as { transactionId?: string };
    return data.transactionId ?? "__unknown__";
  }
  return null; // ainda não processado
}

/**
 * Registra o evento como processado após criar a transação.
 */
async function markEventProcessed(
  db: FirebaseFirestore.Firestore,
  coupleId: string,
  eventId: string,
  transactionId: string,
  meta: { amountCents: number; description: string; date: string }
): Promise<void> {
  const sanitized = sanitizeEventId(eventId);
  await db
    .collection("couples")
    .doc(coupleId)
    .collection("apple_pay_events")
    .doc(sanitized)
    .set({
      transactionId,
      amountCents:  meta.amountCents,
      description:  meta.description,
      date:         meta.date,
      processedAt:  FieldValue.serverTimestamp(),
    });
}

// ── Lógica central reutilizável (usada pelo webhook e pelo sync) ───────────────

export type ProcessEventResult = {
  ok: boolean;
  id: string;
  duplicate?: boolean;
  fallback?: boolean;
  reason?: string;
  idempotent: boolean;
  warning?: string;
};

/**
 * Processa um único evento Apple Pay de forma idempotente.
 * Reutilizado pelo webhook individual e pelo endpoint de sync em lote.
 */
export async function processApplePayEvent(
  db: FirebaseFirestore.Firestore,
  coupleId: string,
  rawBody: Record<string, unknown>
): Promise<ProcessEventResult> {
  const clientEventId = typeof rawBody.clientEventId === "string"
    ? rawBody.clientEventId.trim()
    : "";

  // ── Idempotência ──────────────────────────────────────────────────────────
  if (clientEventId) {
    const existingId = await checkAndRegisterEvent(db, coupleId, clientEventId);
    if (existingId) {
      console.log(`[webhook] Evento duplicado ignorado: clientEventId="${clientEventId}" → transação="${existingId}"`);
      return { ok: true, duplicate: true, id: existingId, idempotent: true };
    }
  }

  // ── Validação ─────────────────────────────────────────────────────────────
  const validation = validateBody(rawBody);

  if (validation.errorReason) {
    const reason = validation.errorReason;
    console.warn(`[webhook] Validação falhou — ${reason} | clientEventId="${clientEventId}"`);

    const fallbackId = await saveFallbackExpense(db, coupleId, reason, rawBody);

    // Registra o evento de fallback também (evita spam duplicado)
    if (clientEventId) {
      await markEventProcessed(db, coupleId, clientEventId, fallbackId, {
        amountCents: 0,
        description: `fallback: ${reason}`,
        date:        validation.finalDate,
      });
    }

    return {
      ok:        false,
      fallback:  true,
      id:        fallbackId,
      reason,
      idempotent: Boolean(clientEventId),
    };
  }

  // ── Cria transação Pendente ───────────────────────────────────────────────
  const { amountCents, description, finalDate } = validation;
  const monthKey = getMonthKey(finalDate);

  const docData = {
    type:        "expense",
    description,
    amount:      amountCents,
    date:        finalDate,
    monthKey,
    coupleId,
    paidBy:      "partner",
    splitType:   "100% partner",
    visibility:  "personal",
    status:      "pending",
    source:      rawBody.source ?? "webhook-apple-pay",
    clientEventId: clientEventId || null,
    deviceUser:  rawBody.deviceUser ?? null,
    capturedAt:  rawBody.capturedAt ?? null,
    createdAt:   FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
  };

  const ref = await db
    .collection("couples")
    .doc(coupleId)
    .collection("transactions")
    .add(docData);

  console.log(
    `[webhook] Despesa criada: id="${ref.id}" | desc="${description}" | R$ ${(amountCents / 100).toFixed(2)} | clientEventId="${clientEventId}"`
  );

  // Registra o evento como processado para deduplicação futura
  if (clientEventId) {
    await markEventProcessed(db, coupleId, clientEventId, ref.id, {
      amountCents,
      description,
      date: finalDate,
    });
  }

  const result: ProcessEventResult = {
    ok:         true,
    id:         ref.id,
    idempotent: Boolean(clientEventId),
  };

  if (!clientEventId) {
    result.warning = "clientEventId ausente: este envio não é idempotente. Reenvios podem criar duplicatas.";
  }

  return result;
}

// ── Handler Principal ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // ── Autenticação ──────────────────────────────────────────────────────────
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

  if (!getApps().length) {
    return res.status(500).json({ error: "Firebase Admin não inicializado" });
  }

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";
  const db        = getFirestore();
  const rawBody   = (req.body ?? {}) as Record<string, unknown>;

  try {
    const result = await processApplePayEvent(db, COUPLE_ID, rawBody);

    // Alert FCM apenas em falhas reais (não duplicatas nem warnings de idempotência)
    if (result.fallback) {
      await sendCriticalAlert(
        db,
        COUPLE_ID,
        `Compra Apple Pay com valor irrecuperável. Motivo: "${result.reason}". Verifique a aba Pendentes.`
      );
    }

    const httpStatus = result.ok
      ? (result.duplicate ? 200 : 201)
      : 200; // fallback retorna 200 (aceito com aviso)

    return res.status(httpStatus).json({ ...result, amount: result.ok && !result.duplicate
      ? undefined  // amount já vai no result quando necessário
      : undefined,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] Erro crítico de infraestrutura:", msg);

    try {
      await sendCriticalAlert(
        db,
        COUPLE_ID,
        "Falha crítica ao registrar compra no Apple Pay. Verifique o sistema."
      );
    } catch {
      // silencia
    }

    return res.status(500).json({ error: "Internal server error", detail: msg });
  }
}
