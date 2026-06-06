import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

// ── Handler Principal ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS para chamadas do iOS Shortcuts via HTTP
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── Segurança: Bearer token ────────────────────────────────────────────────
  const authHeader = req.headers.authorization ?? "";
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

  // ── Validação do body ──────────────────────────────────────────────────────
  const { amount, description, date } = req.body ?? {};

  const amountCents = toCents(amount);
  if (!amountCents) {
    return res.status(400).json({ error: "Campo 'amount' inválido. Envie um número positivo (ex: 89.90)" });
  }

  if (!description || typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ error: "Campo 'description' é obrigatório" });
  }

  const finalDate = isValidDate(date) ? date : new Date().toISOString().slice(0, 10);
  const monthKey  = getMonthKey(finalDate);

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";

  // ── Gravar no Firestore ────────────────────────────────────────────────────
  try {
    const db = getFirestore();

    const docData = {
      type:        "expense",
      description: description.trim(),
      amount:      amountCents,
      date:        finalDate,
      monthKey,
      coupleId:    COUPLE_ID,
      // Padrão conservador: classificada como Fatura da Zara (cartão adicional).
      // O usuário poderá alterar na tela de revisão.
      paidBy:    "partner",
      splitType: "100% partner",
      visibility: "personal",
      // Flag que coloca a despesa na caixa de entrada (aba "Pendentes")
      status:    "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // Origem para rastreabilidade
      source:    "webhook-apple-pay",
    };

    const ref = await db
      .collection("couples")
      .doc(COUPLE_ID)
      .collection("transactions")
      .add(docData);

    console.log(`[webhook] Despesa pendente criada: ${ref.id} — ${description} — R$ ${(amountCents / 100).toFixed(2)}`);

    return res.status(201).json({
      ok:    true,
      id:    ref.id,
      amount: amountCents,
      date:  finalDate,
      monthKey,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] Erro ao gravar:", msg);
    return res.status(500).json({ error: msg });
  }
}
