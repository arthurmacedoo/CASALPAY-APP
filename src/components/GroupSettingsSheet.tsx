import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGroupContext } from "../contexts/GroupContext";
import { useAuthContext } from "../contexts/AuthContext";

interface GroupSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GroupSettingsSheet: React.FC<GroupSettingsSheetProps> = ({ isOpen, onClose }) => {
  const { group, isCurrentUserAdmin, updateGroup, deleteGroup } = useGroupContext();
  const { logout } = useAuthContext();
  
  const [name, setName] = useState(group?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) setName(group?.name ?? "");
  }, [isOpen, group?.name]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const isCustomGroup = isCurrentUserAdmin;

  const handleSave = async () => {
    if (!name.trim() || name === group?.name) { onClose(); return; }
    setSaving(true);
    try {
      await updateGroup(name);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Tem certeza que deseja apagar este grupo? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    try {
      await deleteGroup();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-bg animate-slide-left flex flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      {/* Header estilo página */}
      <header className="pt-[env(safe-area-inset-top)] bg-bg-card border-b border-border sticky top-0 z-10">
        <div className="px-4 py-4 flex items-center gap-3">
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-bg-elevated border border-border text-text-primary hover:bg-white/5 transition-colors"
            aria-label="Voltar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-text-primary">Configurações</h2>
        </div>
      </header>

      {/* Conteúdo principal */}
      <div className="flex-1 px-5 pt-6 pb-12 flex flex-col gap-8">
        
        {isCustomGroup && (
          <>
            {/* Seção 0: Código de Convite */}
            <section className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-widest pl-1">Código de Convite</label>
              <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-xl px-4 py-3">
                <code className="flex-1 text-sm font-mono text-accent-blue truncate">{group?.id}</code>
                <button 
                  onClick={() => { navigator.clipboard.writeText(group?.id || ''); alert("Código copiado!"); }} 
                  className="px-3 py-1.5 bg-accent-blue/10 text-accent-blue text-xs font-semibold rounded-lg hover:bg-accent-blue/20 transition-colors"
                >
                  Copiar
                </button>
              </div>
              <p className="text-xs text-text-muted pl-1">Compartilhe este código para convidar membros.</p>
            </section>

            {/* Seção 1: Alterar Nome */}
            <section className="flex flex-col gap-3">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-widest pl-1">Nome do Grupo</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full bg-bg-elevated border border-border rounded-xl px-4 py-4 text-sm text-text-primary focus:outline-none focus:border-accent-pink transition-colors"
              />
              <button onClick={handleSave} disabled={saving} className="mt-1 py-3.5 rounded-xl bg-accent-pink text-white text-sm font-semibold hover:bg-accent-pink/90 transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </section>
          </>
        )}

        <div className="flex-1" /> {/* Spacer */}

        {/* SEÇÃO DA CONTA */}
        <section className={`flex flex-col gap-3 ${isCustomGroup ? 'pt-6 border-t border-border mt-2' : ''}`}>
          <label className="text-xs font-semibold text-text-muted uppercase tracking-widest pl-1">Sua Conta</label>
          
          <button 
            onClick={() => { onClose(); logout(); }} 
            className="w-full py-4 rounded-xl bg-bg-elevated text-text-secondary border border-border text-sm font-semibold hover:bg-white/5 transition-colors"
          >
            Sair da Conta (Logout)
          </button>

          {isCustomGroup && (
            <button onClick={handleDelete} disabled={deleting} className="w-full mt-2 py-4 rounded-xl bg-accent-red/10 text-accent-red border border-accent-red/20 text-sm font-semibold hover:bg-accent-red/20 transition-colors disabled:opacity-50">
              {deleting ? 'Apagando...' : 'Apagar Grupo Definitivamente'}
            </button>
          )}
        </section>
      </div>
    </div>,
    document.body
  );
};
