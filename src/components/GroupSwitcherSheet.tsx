/**
 * GroupSwitcherSheet.tsx
 *
 * Bottom Sheet mobile-friendly para trocar o grupo ativo.
 * Estilo Notion/Slack — abre por baixo com overlay suave.
 *
 * Etapa 2: mostra apenas o grupo atual com check.
 * Etapa 3+: listará outros grupos e oferecerá "Criar grupo" / "Entrar por convite".
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGroupContext } from "../contexts/GroupContext";
import { useAuth } from "../hooks/useAuth";
import { useUserGroups } from "../hooks/useUserGroups";
import { OWNER_NAME, PARTNER_NAME } from "../constants/couple";
import { COUPLE_ID } from "../lib/firebase";

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
  const { group, members, loading: activeLoading, switchGroup, createGroup, joinGroup, currentMember } = useGroupContext();
  const { user } = useAuth();
  const { groups: userGroups, loading: groupsLoading } = useUserGroups(user);
  const sheetRef = useRef<HTMLDivElement>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) { setCreateError('Dê um nome ao grupo'); return; }
    setCreating(true);
    setCreateError('');
    try {
      await createGroup(name);
      setShowCreateForm(false);
      setShowJoinForm(false);
      setNewGroupName("");
      setInviteCode("");
      setCreateError("");
      onClose();
    } catch (e) {
      console.error("[CasalPay CRÍTICO] Falha ao criar grupo no Firestore:", e);
      setCreateError('Erro ao criar grupo. Tente novamente.');
    } finally {
      setCreating(false);
    }
  };

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

        {/* ── Lista de grupos ────────────────────────────────────────────────────── */}
        {groupsLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-2xl">
                <div className="w-11 h-11 rounded-2xl bg-bg-elevated animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-36 bg-bg-elevated rounded animate-pulse" />
                  <div className="h-2.5 w-20 bg-bg-elevated rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : userGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center border border-dashed border-border rounded-2xl bg-bg-elevated/50">
            <span className="text-2xl mb-2">📭</span>
            <p className="text-sm font-semibold text-text-primary mb-1">Nenhum grupo</p>
            <p className="text-xs text-text-secondary">Você ainda não participa de nenhum grupo financeiro. Crie ou entre em um grupo abaixo para começar.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {userGroups.map((g) => {
              const isActive = g.id === group?.id;
              const gName = g.name ?? "Grupo sem nome";
              const gInitial = gName.charAt(0).toUpperCase();

              return (
                <button
                  key={g.id}
                  onClick={async () => {
                    if (!isActive) await switchGroup(g.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-colors ${
                    isActive
                      ? "bg-accent-pink/10 border border-accent-pink/20"
                      : "bg-transparent hover:bg-bg-elevated border border-transparent"
                  }`}
                >
                  {/* Avatar do grupo */}
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isActive ? "bg-accent-pink/20 border border-accent-pink/30" : "bg-bg-elevated border border-border"
                  }`}>
                    <span className={`text-lg font-bold ${isActive ? "text-accent-pink" : "text-text-muted"}`}>
                      {gInitial}
                    </span>
                  </div>

                  {/* Nome */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isActive ? "text-text-primary" : "text-text-secondary"}`}>
                      {gName}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {g.id === COUPLE_ID ? "Grupo principal" : (g.memberIds?.length === 1 ? "1 membro" : `${g.memberIds?.length ?? 0} membros`)}
                    </p>
                  </div>

                  {/* Check de ativo */}
                  {isActive && (
                    <div className="w-5 h-5 rounded-full bg-accent-pink flex items-center justify-center shrink-0">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Membros do grupo ativo ─────────────────────────────────────────────── */}
        {!activeLoading && group && currentMember && members.length > 0 && (
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
                      <p className="text-xs text-text-muted capitalize">
                        {m.userId === group?.createdBy ? "Admin 👑" : "Membro"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Ações: Criar ou Entrar ──────────────────────────────────────────────────────── */}
        <div className="mt-5 border-t border-border pt-4 flex flex-col gap-2">
          {!showCreateForm && !showJoinForm && (
            <>
              <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-bg-elevated transition-colors">
                <div className="w-8 h-8 rounded-xl bg-bg-elevated border border-dashed border-accent-blue/50 flex items-center justify-center text-base text-accent-blue">＋</div>
                <span className="text-sm font-medium text-text-secondary">Criar novo grupo</span>
              </button>
              <button onClick={() => setShowJoinForm(true)} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-bg-elevated transition-colors">
                <div className="w-8 h-8 rounded-xl bg-bg-elevated border border-dashed border-accent-pink/50 flex items-center justify-center text-base text-accent-pink">🔗</div>
                <span className="text-sm font-medium text-text-secondary">Entrar com código</span>
              </button>
            </>
          )}

          {showCreateForm && (
            <div className="animate-fade-in-up flex flex-col gap-3 bg-bg-elevated rounded-2xl p-4 border border-border">
              <p className="text-sm font-semibold text-text-primary">Nome do novo grupo</p>
              <input
                autoFocus
                type="text"
                placeholder="Ex: Despesas da Faculdade"
                value={newGroupName}
                onChange={(e) => { setNewGroupName(e.target.value); setCreateError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') { setShowCreateForm(false); setNewGroupName(''); } }}
                className="w-full bg-bg-card border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-pink transition-colors"
              />
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateGroup}
                  disabled={creating || !newGroupName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-accent-blue text-white text-sm font-semibold hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar grupo'}
                </button>
                <button onClick={() => { setShowCreateForm(false); setNewGroupName(''); setCreateError(''); }} className="px-4 py-2.5 rounded-xl bg-bg-card border border-border text-sm text-text-muted hover:text-text-primary transition-colors">Cancelar</button>
              </div>
            </div>
          )}

          {showJoinForm && (
            <div className="animate-fade-in-up flex flex-col gap-3 bg-bg-elevated rounded-2xl p-4 border border-border">
              <p className="text-sm font-semibold text-text-primary">Código de convite</p>
              <input
                autoFocus
                type="text"
                placeholder="Cole o ID do grupo aqui"
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); setCreateError(''); }}
                className="w-full bg-bg-card border border-border rounded-xl px-4 py-3 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent-pink transition-colors"
              />
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setJoining(true);
                    try {
                      await joinGroup(inviteCode);
                      setShowJoinForm(false);
                      setInviteCode('');
                      onClose();
                    } catch (err: any) {
                      setCreateError(err.message || 'Erro ao entrar no grupo.');
                    } finally {
                      setJoining(false);
                    }
                  }}
                  disabled={joining || !inviteCode.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-accent-pink text-white text-sm font-semibold hover:bg-accent-pink/90 transition-colors disabled:opacity-50"
                >
                  {joining ? 'Entrando...' : 'Entrar no grupo'}
                </button>
                <button onClick={() => { setShowJoinForm(false); setInviteCode(''); setCreateError(''); }} className="px-4 py-2.5 rounded-xl bg-bg-card border border-border text-sm text-text-muted hover:text-text-primary transition-colors">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
