import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  OWNER_NAME,
  PARTNER_NAME,
  OWNER_EMOJI,
  PARTNER_EMOJI,
} from "../constants/couple";

// ─── Mensagens disponíveis ─────────────────────────────────────────────────
interface LoveMessage {
  id: string;
  emoji: string;
  text: string;
  color: "pink" | "blue" | "purple" | "green";
}

const LOVE_MESSAGES: LoveMessage[] = [
  { id: "saudades",    emoji: "❤️",  text: "Saudades",           color: "pink"   },
  { id: "te-amo",      emoji: "💕",  text: "Te amo",             color: "pink"   },
  { id: "beijinho",    emoji: "😘",  text: "Beijinho",           color: "purple" },
  { id: "fazendo-que", emoji: "🧐",  text: "Fazendo o quê?",     color: "blue"   },
  { id: "com-fome",    emoji: "🍕",  text: "Tô com fome",        color: "purple" },
  { id: "pensando",    emoji: "💭",  text: "Pensando em você",   color: "blue"   },
];

const COLOR_MAP = {
  pink:   { border: "border-accent-pink/30",   bg: "bg-accent-pink/10",   glow: "shadow-[0_0_20px_rgba(232,121,160,0.15)]",  text: "text-accent-pink"   },
  blue:   { border: "border-accent-blue/30",   bg: "bg-accent-blue/10",   glow: "shadow-[0_0_20px_rgba(123,143,255,0.15)]",  text: "text-accent-blue"   },
  purple: { border: "border-violet-400/30",    bg: "bg-violet-500/10",    glow: "shadow-[0_0_20px_rgba(167,139,250,0.15)]",  text: "text-violet-400"    },
  green:  { border: "border-accent-green/30",  bg: "bg-accent-green/10",  glow: "shadow-[0_0_20px_rgba(74,222,128,0.15)]",   text: "text-accent-green"  },
};

// ─── Componente principal ──────────────────────────────────────────────────
export const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent]       = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const isOwner    = user?.email?.toLowerCase().startsWith("arthur");
  const senderName = isOwner ? OWNER_NAME   : PARTNER_NAME;
  const senderEmoji= isOwner ? OWNER_EMOJI  : PARTNER_EMOJI;
  const targetName = isOwner ? PARTNER_NAME : OWNER_NAME;
  const targetEmoji= isOwner ? PARTNER_EMOJI: OWNER_EMOJI;

  const handleSend = async (msg: LoveMessage) => {
    if (sending) return;
    setSending(msg.id);
    setError(null);

    try {
      const response = await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderEmail: user?.email,
          title: `${senderEmoji} ${senderName} mandou um carinho`,
          message: `${msg.emoji} ${msg.text}`,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error ?? `Erro ${response.status}`);
      }

      setSent(msg.id);
      setTimeout(() => setSent(null), 3500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar";
      setError(message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setSending(null);
    }
  };

  return (
    <main
      className="flex flex-col flex-1 pb-28 max-w-md mx-auto w-full"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-8 pb-2 animate-fade-in-up">
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          Mensagens 💌
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Mande um carinho para {targetName} agora mesmo
        </p>
      </div>

      {/* ── Card "De → Para" ──────────────────────────────────────────────── */}
      <div className="px-5 mt-4 animate-fade-in-up">
        <div className="card border border-border flex items-center gap-4">
          {/* Remetente */}
          <div className="flex flex-col items-center gap-1 min-w-[56px]">
            <div className="w-12 h-12 rounded-full bg-accent-blue/15 border border-accent-blue/20 flex items-center justify-center text-2xl">
              {senderEmoji}
            </div>
            <span className="text-[10px] text-text-muted font-medium">{senderName}</span>
          </div>

          {/* Seta animada */}
          <div className="flex-1 flex items-center justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full bg-accent-pink animate-soft-pulse"
                style={{ animationDelay: `${i * 0.25}s` }}
              />
            ))}
            <span className="text-accent-pink text-lg mx-1">→</span>
            {[3, 4, 5].map((i) => (
              <span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full bg-accent-pink animate-soft-pulse"
                style={{ animationDelay: `${(i - 3) * 0.25}s` }}
              />
            ))}
          </div>

          {/* Destinatário */}
          <div className="flex flex-col items-center gap-1 min-w-[56px]">
            <div className="w-12 h-12 rounded-full bg-accent-pink/15 border border-accent-pink/20 flex items-center justify-center text-2xl shadow-[0_0_16px_rgba(232,121,160,0.25)]">
              {targetEmoji}
            </div>
            <span className="text-[10px] text-text-muted font-medium">{targetName}</span>
          </div>
        </div>
      </div>

      {/* ── Grid de mensagens ─────────────────────────────────────────────── */}
      <div className="px-5 mt-5 grid grid-cols-2 gap-3 animate-fade-in-up">
        {LOVE_MESSAGES.map((msg) => {
          const isSending = sending === msg.id;
          const isSent    = sent    === msg.id;
          const isBlocked = !!sending && !isSending;
          const c         = isSent ? COLOR_MAP.green : COLOR_MAP[msg.color];

          return (
            <button
              key={msg.id}
              type="button"
              onClick={() => handleSend(msg)}
              disabled={!!sending}
              aria-label={`Enviar mensagem: ${msg.text}`}
              className={[
                "relative flex flex-col items-center justify-center gap-2.5",
                "rounded-3xl p-5 border transition-all duration-200",
                "active:scale-95 select-none min-h-[110px]",
                isSent
                  ? `${COLOR_MAP.green.border} ${COLOR_MAP.green.bg} ${COLOR_MAP.green.glow}`
                  : `${c.border} ${c.bg} ${c.glow} bg-bg-elevated`,
                isSending ? "opacity-70 cursor-wait" : "",
                isBlocked  ? "opacity-35 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {/* Emoji / Check */}
              <span
                className={`text-3xl transition-transform duration-200 ${isSending ? "animate-soft-pulse" : ""}`}
              >
                {isSent ? "✅" : msg.emoji}
              </span>

              {/* Texto */}
              <span
                className={`text-sm font-semibold text-center leading-tight ${
                  isSent ? "text-accent-green" : "text-text-primary"
                }`}
              >
                {isSent ? "Enviado!" : msg.text}
              </span>

              {/* Spinner overlay enquanto envia */}
              {isSending && (
                <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-bg-card/60 backdrop-blur-sm">
                  <span className="spinner" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Feedback de erro ──────────────────────────────────────────────── */}
      {error && (
        <div className="mx-5 mt-4 card border border-accent-red/30 bg-accent-red/10 animate-fade-in-up">
          <p className="text-sm text-accent-red text-center">⚠️ {error}</p>
        </div>
      )}

      {/* ── Aviso de iOS ──────────────────────────────────────────────────── */}
      <div className="mx-5 mt-6 animate-fade-in-up">
        <div className="card border border-border bg-bg-elevated/40">
          <p className="text-[11px] text-text-muted text-center leading-relaxed">
            🔔 A notificação chega no celular de{" "}
            <span className="text-text-secondary font-medium">{targetName}</span>{" "}
            mesmo com o app fechado.
            <br />
            <span className="text-text-muted/70">
              (Requer iOS 16.4+ para funcionar no iPhone)
            </span>
          </p>
        </div>
      </div>
    </main>
  );
};
