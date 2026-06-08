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
    // Formato europeu: 1.234,56
    const lastComma = raw.lastIndexOf(",");
    const lastDot   = raw.lastIndexOf(".");
    if (lastComma > lastDot) {
      // vírgula é decimal
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      // ponto é decimal
      raw = raw.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Só vírgula → decimal brasileiro: 15,90
    raw = raw.replace(",", ".");
  }
  // Se só tem ponto: já está no formato correto (15.90)

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
type ValidationResult =
  | { ok: true; amountCents: number; description: string; finalDate: string }
  | { ok: false; reason: string };

/**
 * Validação com higienização inteligente:
 * - Amount: limpa símbolos antes de converter
 * - Description: usa "Compra Apple Pay" se ausente (NÃO falha)
 * - Date: usa hoje como fallback se inválida
 * - Falha APENAS se o amount for irrecuperável
 */
function validateBody(body: Record<string, unknown>): ValidationResult {
  const { amount, description, date } = body;

  // 1. Higieniza e valida o amount — único motivo de fallback real
  const amountCents = toCents(amount);
  if (!amountCents) {
    return {
      ok: false,
      reason: `Valor irrecuperável: "${String(amount ?? "ausente")}"`,
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

  return {
    ok: true,
    amountCents,
    description: finalDescription,
    finalDate,
  };
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
    amount:      1,              // 1 centavo simbólico
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
 * Usa sendEachForMulticast para evitar notificações duplicadas no mesmo aparelho.
 * É best-effort: nunca lança exceção.
 */
async function sendCriticalAlert(
  db: FirebaseFirestore.Firestore,
  coupleId: string,
  message: string
): Promise<void> {
  if (!getApps().length) return;

  try {
    const messaging = getMessaging();

    // Coleta todos os tokens únicos do casal
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

    // Envia uma única chamada para todos os tokens (evita duplicatas)
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
          tag:   "casalpay-critical-alert", // tag única: substitui a anterior em vez de empilhar
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

// ── Handler Principal ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  if (!getApps().length) {
    return res.status(500).json({ error: "Firebase Admin não inicializado" });
  }

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";
  const db        = getFirestore();
  const rawBody   = (req.body ?? {}) as Record<string, unknown>;

  try {
    // ── Validação Inteligente ─────────────────────────────────────────────────
    const validation = validateBody(rawBody);

    if (!validation.ok) {
      console.warn(`[webhook] Validação falhou — ${validation.reason}`, rawBody);

      const fallbackId = await saveFallbackExpense(db, COUPLE_ID, validation.reason, rawBody);

      await sendCriticalAlert(
        db,
        COUPLE_ID,
        `Compra Apple Pay com valor irrecuperável. Motivo: "${validation.reason}". Verifique a aba Pendentes.`
      );

      return res.status(200).json({
        ok:       false,
        fallback: true,
        id:       fallbackId,
        reason:   validation.reason,
        message:  "Valor irrecuperável. Despesa de alerta criada nos Pendentes.",
      });
    }

    // ── Dados válidos: grava despesa Pendente normal ───────────────────────────
    const { amountCents, description, finalDate } = validation;
    const monthKey = getMonthKey(finalDate);

    const docData = {
      type:        "expense",
      description,
      amount:      amountCents,
      date:        finalDate,
      monthKey,
      coupleId:    COUPLE_ID,
      paidBy:      "partner",
      splitType:   "100% partner",
      visibility:  "personal",
      status:      "pending",
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
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] Erro crítico de infraestrutura:", msg);

    try {
      await sendCriticalAlert(
        db,
        COUPLE_ID,
        "Falha crítica ao registrar compra no Apple Pay. Verifique o sistema."
      );
    } catch {
      // silencia — erro primário já foi logado
    }

    return res.status(500).json({ error: "Internal server error", detail: msg });
  }
}
