import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { processApplePayEvent } from "./webhook-apple-pay.js";

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

// ── Tipos ─────────────────────────────────────────────────────────────────────

type IncomingEvent = {
  clientEventId?: string;
  amount?: unknown;
  description?: unknown;
  date?: unknown;
  deviceUser?: unknown;
  source?: unknown;
  capturedAt?: unknown;
  [key: string]: unknown;
};

type EventSummary = {
  clientEventId: string;
  status: "created" | "duplicate" | "failed";
  id?: string;
  reason?: string;
};

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * POST /api/sync-apple-pay-outbox
 *
 * Aceita um lote de eventos capturados offline no iPhone e processa cada um
 * de forma idempotente, usando a mesma lógica do webhook individual.
 *
 * Body: { events: ApplePayEvent[] }
 *
 * Response:
 * {
 *   ok: true,
 *   total: number,
 *   created: number,
 *   duplicates: number,
 *   failed: number,
 *   results: EventSummary[]
 * }
 */
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
    console.error("[sync] WEBHOOK_SECRET não configurado");
    return res.status(500).json({ error: "Server config error" });
  }

  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    console.warn("[sync] Token inválido:", authHeader.slice(0, 20));
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!getApps().length) {
    return res.status(500).json({ error: "Firebase Admin não inicializado" });
  }

  // ── Validação do body ─────────────────────────────────────────────────────
  const body = (req.body ?? {}) as Record<string, unknown>;
  const events = Array.isArray(body.events) ? (body.events as IncomingEvent[]) : null;

  if (!events || events.length === 0) {
    return res.status(400).json({
      error: "Campo 'events' é obrigatório e deve ser um array não-vazio.",
    });
  }

  if (events.length > 100) {
    return res.status(400).json({ error: "Máximo de 100 eventos por lote." });
  }

  const COUPLE_ID = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";
  const db        = getFirestore();

  // ── Processamento em lote ─────────────────────────────────────────────────
  let created    = 0;
  let duplicates = 0;
  let failed     = 0;
  const results: EventSummary[] = [];

  console.log(`[sync] Iniciando lote com ${events.length} evento(s).`);

  for (const event of events) {
    const eventId = typeof event.clientEventId === "string"
      ? event.clientEventId
      : `no-id-${Date.now()}-${Math.random()}`;

    try {
      const result = await processApplePayEvent(
        db,
        COUPLE_ID,
        event as Record<string, unknown>
      );

      if (result.duplicate) {
        duplicates++;
        results.push({ clientEventId: eventId, status: "duplicate", id: result.id });
      } else if (!result.ok || result.fallback) {
        // fallback conta como "failed" do ponto de vista do sync
        failed++;
        results.push({
          clientEventId: eventId,
          status: "failed",
          id:     result.id,
          reason: result.reason ?? "Valor irrecuperável — despesa de alerta criada.",
        });
      } else {
        created++;
        results.push({ clientEventId: eventId, status: "created", id: result.id });
      }
    } catch (err: unknown) {
      failed++;
      const reason = err instanceof Error ? err.message : "Unknown error";
      console.error(`[sync] Falha ao processar evento="${eventId}":`, reason);
      results.push({ clientEventId: eventId, status: "failed", reason });
    }
  }

  console.log(`[sync] Lote concluído: ${created} criados, ${duplicates} duplicados, ${failed} falhas.`);

  return res.status(200).json({
    ok:         true,
    total:      events.length,
    created,
    duplicates,
    failed,
    results,
  });
}
