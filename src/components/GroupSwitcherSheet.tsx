/**
 * GroupSwitcherSheet.tsx
 *
 * Bottom Sheet mobile-friendly para trocar o grupo ativo.
 * Estilo Notion/Slack — abre por baixo com overlay suave.
 *
 * Etapa 2: mostra apenas o grupo atual com check.
 * Etapa 3+: listará outros grupos e oferecerá "Criar grupo" / "Entrar por convite".
 */
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useGroupContext } from "../contexts/GroupContext";
import { useAuth } from "../hooks/useAuth";
import { OWNER_NAME, PARTNER_NAME } from "../constants/couple";

interface GroupSwitcherSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

function getMemberEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes(OWNER_NAME.toLowerCase())) return "👨🏻";
  if (lower.includes(PARTNER_NAME.toLowerCase())) return "👩🏻";
  return "👤";
}

export const GroupSwitcherSheet: React.FC<GroupSwitcherSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const { group, members, loading } = useGroupContext();
  const { user } = useAuth();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora do sheet
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Fecha com Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Trava scroll do body enquanto aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const groupName = group?.name ?? "Grupo Arthur e Zara";
  const initial   = groupName.charAt(0).toUpperCase();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={handleOverlayClick}
    >
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="
          bg-bg-card rounded-t-3xl border-t border-border
          px-5 pt-3 pb-10
          animate-slide-up
          max-h-[85vh] overflow-y-auto
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-5">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Título */}
        <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3 px-1">
          Seus grupos
        </p>

        {/* ── Grupo atual ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl">
            <div className="w-11 h-11 rounded-2xl bg-bg-elevated animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-36 bg-bg-elevated rounded animate-pulse" />
              <div className="h-2.5 w-20 bg-bg-elevated rounded animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-accent-pink/10 border border-accent-pink/20">
            {/* Avatar do grupo */}
            <div className="w-11 h-11 rounded-2xl bg-accent-pink/20 border border-accent-pink/30 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-accent-pink">{initial}</span>
            </div>

            {/* Nome e membros */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">
                {groupName}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {members.length > 0
                  ? `${members.length} membro${members.length !== 1 ? "s" : ""}`
                  : "Carregando membros..."}
              </p>
            </div>

            {/* Check de ativo */}
            <div className="w-5 h-5 rounded-full bg-accent-pink flex items-center justify-center shrink-0">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        )}

        {/* ── Membros do grupo ─────────────────────────────────────────────── */}
        {!loading && members.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2 px-1">
              Membros
            </p>
            <div className="flex flex-col gap-1">
              {members.map((m) => {
                const isMe = m.userId === user?.uid;
                return (
                  <div
                    key={m.userId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-sm shrink-0">
                      <span>{getMemberEmoji(m.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {m.name}
                        {isMe && (
                          <span className="ml-1.5 text-[10px] font-semibold text-accent-pink/70">
                            (você)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-text-muted capitalize">{m.role}</p>
                    </div>
                    {m.status === "active" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Ações futuras (placeholder visual para Etapa 3) ────────────── */}
        <div className="mt-5 border-t border-border pt-4 flex flex-col gap-2">
          <button
            disabled
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-text-muted opacity-40 cursor-not-allowed"
          >
            <div className="w-8 h-8 rounded-xl bg-bg-elevated border border-dashed border-border flex items-center justify-center text-base">
              ＋
            </div>
            <span className="text-sm font-medium">Criar novo grupo</span>
            <span className="ml-auto text-[10px] bg-bg-elevated px-2 py-0.5 rounded-full border border-border">
              Em breve
            </span>
          </button>
          <button
            disabled
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-text-muted opacity-40 cursor-not-allowed"
          >
            <div className="w-8 h-8 rounded-xl bg-bg-elevated border border-dashed border-border flex items-center justify-center text-base">
              🔗
            </div>
            <span className="text-sm font-medium">Entrar por convite</span>
            <span className="ml-auto text-[10px] bg-bg-elevated px-2 py-0.5 rounded-full border border-border">
              Em breve
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
