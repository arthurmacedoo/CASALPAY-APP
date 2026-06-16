import React, { useState, Component } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNotificationContext } from "../contexts/NotificationContext";
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

// ─── Error Boundary local para capturar crashes do FCM/notificação ────────
interface FcmErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class FcmErrorBoundary extends Component<
  { children: React.ReactNode },
  FcmErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(err: Error): FcmErrorBoundaryState {
    return { hasError: true, errorMessage: err.message };
  }

  componentDidCatch(err: Error) {
    console.error("[FCM ErrorBoundary] Capturou erro:", err.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex flex-col flex-1 pb-28 max-w-md mx-auto w-full items-center justify-center px-6" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border flex items-center justify-center mb-5">
            <span className="text-3xl">📫</span>
          </div>
          <h2 className="text-lg font-bold text-text-primary text-center mb-2">Chat Offline</h2>
          <p className="text-sm text-text-secondary text-center max-w-[280px] mb-6">
            O serviço de mensagens não está disponível agora. Verifique sua conexão ou reinicie o aplicativo.
          </p>
          <p className="text-xs text-text-muted/60 font-mono text-center">{this.state.errorMessage}</p>
        </main>
      );
    }
    return this.props.children;
  }
}

// ─── Componente principal ──────────────────────────────────────────────────
export const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const { permission, requestPermission, pushStatus, pushError } = useNotificationContext();
  
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent]       = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number>(0);
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
          target:  targetName,
          title:   `${senderName}:`,
          message: `${msg.emoji} ${msg.text}`,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error ?? `Erro ${response.status}`);
      }

      // Só mostra "Enviado!" se successCount > 0 (entrega real confirmada)
      const confirmedCount = data.successCount ?? data.sent ?? 0;
      if (confirmedCount === 0) {
        throw new Error(
          data.error ?? `Nenhum aparelho ativo encontrado para ${targetName}.`
        );
      }

      setSentCount(confirmedCount);
      setSent(msg.id);
      setTimeout(() => { setSent(null); setSentCount(0); }, 3500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar";
      setError(message);
      setTimeout(() => setError(null), 6000);
    } finally {
      setSending(null);
    }
  };

  // Label do status de registro do dispositivo
  const deviceStatusLabel = () => {
    if (permission !== "granted") return null;
    switch (pushStatus) {
      case "registering": return { text: "Registrando este aparelho...", color: "text-accent-blue" };
      case "registered":  return { text: "✅ Aparelho registrado", color: "text-accent-green" };
      case "error":       return { text: `⚠️ ${pushError ?? "Não foi possível registrar este aparelho"}`, color: "text-accent-red" };
      default:            return null;
    }
  };
  const deviceStatus = deviceStatusLabel();

  // ── Fallback UI quando o serviço FCM estiver em modo de erro crítico ──────
  // Isso ocorre quando o VAPID_KEY não está configurado (dev local sem .env)
  // ou quando o Admin SDK não está disponível no ambiente serverless.
  const isFcmCriticallyDown =
    pushStatus === "error" &&
    pushError !== null &&
    (pushError.includes("VAPID") ||
      pushError.includes("Admin SDK") ||
      pushError.includes("não configurado"));

  if (isFcmCriticallyDown) {
    return (
      <main
        className="flex flex-col flex-1 pb-28 max-w-md mx-auto w-full items-center justify-center px-6"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="w-20 h-20 rounded-full bg-bg-elevated border border-dashed border-border flex items-center justify-center mb-6">
          <span className="text-4xl">📫</span>
        </div>
        <h2 className="text-xl font-bold text-text-primary text-center mb-2">Chat Offline</h2>
        <p className="text-sm text-text-secondary text-center mb-6 max-w-[280px]">
          O serviço de mensagens requer configuração adicional no servidor. Em ambiente de produção funcionará normalmente.
        </p>
        <div className="w-full max-w-[300px] bg-bg-elevated rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Detalhes</p>
          <p className="text-xs text-text-muted/70 font-mono break-all">{pushError}</p>
        </div>
      </main>
    );
  }

  return (
    <FcmErrorBoundary>
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

      {/* ── Alerta de Permissão de Notificação ──────────────────────────────── */}
      {permission !== "granted" && (
        <div className="px-5 mt-3 animate-fade-in-up">
          <div className="card border border-accent-blue/30 bg-accent-blue/10 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="text-xl">🔔</span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Ativar Notificações</p>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                  Para receber e enviar mensagens em tempo real, precisamos da sua permissão.
                </p>
              </div>
            </div>
            
            {permission === "default" && (
              <button
                onClick={requestPermission}
                className="w-full py-2.5 rounded-xl bg-accent-blue text-white text-sm font-semibold active:scale-95 transition-transform"
              >
                Ativar Notificações
              </button>
            )}

            {permission === "denied" && (
              <p className="text-xs text-accent-red font-medium">
                Notificações bloqueadas. Acesse os Ajustes do seu celular, encontre o app na lista e ative as notificações.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Status do dispositivo (após permissão concedida) ───────────────── */}
      {deviceStatus && (
        <div className="px-5 mt-2 animate-fade-in-up">
          <p className={`text-xs text-center font-medium ${deviceStatus.color}`}>
            {deviceStatus.text}
          </p>
        </div>
      )}

      {/* ── Card "De → Para" ──────────────────────────────────────────────── */}
      <div className="px-5 mt-5 animate-fade-in-up">
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
      <div className="px-5 mt-5 grid grid-cols-2 gap-3 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
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
                {isSent
                  ? `Enviado para ${sentCount} aparelho${sentCount !== 1 ? "s" : ""}!`
                  : msg.text}
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
      <div className="mx-5 mt-6 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <div className="card border border-border bg-bg-elevated/40">
          <p className="text-[11px] text-text-muted text-center leading-relaxed">
            🔔 A notificação chega no celular de{" "}
            <span className="text-text-secondary font-medium">{targetName}</span>{" "}
            mesmo com o app fechado.
            <br />
            <span className="text-text-muted/70">
              (No iPhone, adicione o app à Tela de Início primeiro)
            </span>
          </p>
        </div>
      </div>
    </main>
    </FcmErrorBoundary>
  );
};
