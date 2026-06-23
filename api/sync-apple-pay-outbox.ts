import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestore } from "firebase-admin/firestore";
import { processApplePayEvent } from "./webhook-apple-pay.js";
import { initFirebaseAdmin } from "./_firebase-admin.js";

// Inicializa Firebase Admin SDK
initFirebaseAdmin();

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

  // Permite ler o groupId dinamicamente, caindo no default antigo se ausente
  const groupId = (req.query.groupId as string) || (body.groupId as string) || process.env.VITE_COUPLE_ID || "arthur-namorada-2026";
  const db      = getFirestore();

  // ── Processamento em lote ─────────────────────────────────────────────────
  let created    = 0;
  let duplicates = 0;
  let failed     = 0;
  const results: EventSummary[] = [];

  console.log(`[sync] Iniciando lote com ${events.length} evento(s) no grupo ${groupId}.`);

  for (const event of events) {
    const eventId = typeof event.clientEventId === "string"
      ? event.clientEventId
      : `no-id-${Date.now()}-${Math.random()}`;

    try {
      const result = await processApplePayEvent(
        db,
        groupId,
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
