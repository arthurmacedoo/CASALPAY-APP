/**
 * GroupSwitcherSheet.tsx
 *
 * Bottom Sheet mobile-friendly para trocar o grupo ativo.
 * Estilo Notion/Slack — abre por baixo com overlay suave.
 *
 * Etapa 2: mostra apenas o grupo atual com check.
 * Etapa 3+: listará outros grupos e oferecerá "Criar grupo" / "Entrar por convite".
 */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGroupContext } from "../contexts/GroupContext";
import { useAuthContext } from "../contexts/AuthContext";
import { useUserGroups } from "../hooks/useUserGroups";
import { OWNER_NAME, PARTNER_NAME } from "../constants/couple";
import { COUPLE_ID } from "../lib/firebase";
import toast from "react-hot-toast";
import type { GroupMember } from "../types";

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
  const { group, members, loading: activeLoading, switchGroup, createGroup, joinGroup, currentMember, removeMember } = useGroupContext();
  const { user } = useAuthContext();
  const { groups: userGroups, loading: groupsLoading } = useUserGroups(user);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState("");
  
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    try {
      await removeMember(memberToRemove.userId);
      toast.success("Membro removido com sucesso");
      setMemberToRemove(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover membro");
    } finally {
      setRemovingMember(false);
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) { setCreateError('Dê um nome ao grupo'); return; }
    setCreating(true);
    setCreateError('');
    try {
      await createGroup(name);
      toast.success('Grupo criado com sucesso!');
      setShowCreateForm(false);
      setShowJoinForm(false);
      setNewGroupName("");
      setInviteCode("");
      setCreateError("");
      onClose();
    } catch (e: any) {
      setCreateError(e.message || 'Erro ao criar grupo. Tente novamente.');
      toast.error('Erro ao criar grupo.');
    } finally {
      setCreating(false);
    }
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
      className="fixed inset-0 z-50 flex flex-col bg-bg-card animate-slide-left"
    >
      {/* ── Cabeçalho do modal tela cheia ── */}
      <div className="safe-top bg-bg-card border-b border-border/50 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <h2 className="text-xl font-bold text-text-primary tracking-tight">Meus Grupos</h2>
        <button 
          onClick={onClose} 
          className="p-2 -mr-2 bg-bg-elevated/50 hover:bg-bg-elevated rounded-full text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-20 safe-bottom">
        {/* Título da seção */}
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
                        {m.role === 'admin' ? "Admin 👑" : "Membro"}
                      </p>
                    </div>
                    
                    {/* Botão de Engrenagem (Opções do Admin) */}
                    {currentMember?.role === 'admin' && !isMe && (
                      <button
                        onClick={() => setMemberToRemove(m)}
                        className="p-2 -mr-2 text-text-muted hover:text-text-primary transition-colors shrink-0"
                        title="Opções do membro"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    )}
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
                      toast.success('Você entrou no grupo com sucesso!');
                      setShowJoinForm(false);
                      setInviteCode('');
                      onClose();
                    } catch (err: any) {
                      setCreateError(err.message || 'Erro ao entrar no grupo.');
                      toast.error('Código de convite inválido ou erro de conexão.');
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
      
      {/* Modal de Remover Membro */}
      {memberToRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMemberToRemove(null)}>
          <div className="bg-bg-card border border-border rounded-3xl p-6 w-full max-w-[320px] shadow-2xl animate-scale-up flex flex-col items-center text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-accent-red/10 flex items-center justify-center mb-4 text-accent-red">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Remover membro?</h3>
            <p className="text-sm text-text-secondary mb-6">
              Tem certeza que deseja remover <strong>{memberToRemove.name}</strong> do grupo? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setMemberToRemove(null)}
                className="flex-1 py-3 rounded-xl bg-bg-elevated text-text-primary font-semibold hover:bg-white/5 transition-colors"
                disabled={removingMember}
              >
                Cancelar
              </button>
              <button 
                onClick={handleRemoveMember}
                disabled={removingMember}
                className="flex-1 py-3 rounded-xl bg-accent-red text-white font-semibold shadow-[0_0_20px_rgba(248,113,113,0.15)] hover:bg-accent-red/90 transition-colors disabled:opacity-50"
              >
                {removingMember ? "Removendo..." : "Sim, remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
