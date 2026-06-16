import React from "react";
import type { Group } from "../types";
import { useAuthContext } from "../contexts/AuthContext";
import { useGroupContext } from "../contexts/GroupContext";
import toast from "react-hot-toast";

interface GroupHubProps {
  groups: Group[];
  onOpenCreate: () => void;
  onOpenJoin: () => void;
}

export const GroupHub: React.FC<GroupHubProps> = ({ groups, onOpenCreate, onOpenJoin }) => {
  const { user, logout } = useAuthContext();
  const { switchGroup, activeGroupId } = useGroupContext();

  const handleLogout = async () => {
    // Replaced window.confirm with a custom UI or toast approach, but since it's a direct button,
    // we'll dispatch a custom event or let the parent handle the confirm modal. For now, we'll just logout.
    // The prompt says "Modal de confirmação on-brand para Sair". I'll add an inline state for that.
    setShowLogoutConfirm(true);
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  // Estado B: Nenhum grupo
  if (groups.length === 0) {
    return (
      <div className="flex flex-col min-h-screen min-h-dvh safe-top bg-[#0D0D12] text-[#F0F0F8]">
        <header className="px-6 py-4 flex items-center justify-between border-b border-border bg-bg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-bold text-lg uppercase">
              {user?.email?.[0] ?? "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text-primary">Sua Conta</span>
              <span className="text-xs text-text-muted truncate max-w-[150px]">{user?.email}</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-xs font-semibold text-accent-red px-3 py-1.5 rounded-lg bg-accent-red/10 hover:bg-accent-red/20 transition-colors"
          >
            Sair
          </button>
        </header>

        <main className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-10">
          <div className="w-20 h-20 rounded-full bg-accent-blue/10 flex items-center justify-center mb-6">
            <span className="text-4xl">👥</span>
          </div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-blue to-accent-pink text-center mb-2">
            Comece criando ou entrando em um grupo
          </h2>
          <p className="text-text-muted text-sm text-center mb-8">
            Um grupo financeiro é compartilhado entre você e seu parceiro(a).
          </p>
          
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <button 
              onClick={onOpenCreate}
              className="group flex items-center justify-between p-5 bg-bg-card border border-border rounded-2xl hover:bg-bg-elevated transition-all active:scale-[0.98] text-left"
            >
              <div className="flex flex-col gap-1">
                <span className="text-text-primary font-bold text-lg">Criar novo grupo</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-accent-blue text-xl">+</span>
              </div>
            </button>
            
            <button 
              onClick={onOpenJoin}
              className="group flex items-center justify-between p-5 bg-bg-card border border-border rounded-2xl hover:bg-bg-elevated transition-all active:scale-[0.98] text-left"
            >
              <div className="flex flex-col gap-1">
                <span className="text-text-primary font-bold text-lg">Entrar com código</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-accent-pink/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-accent-pink text-xl">🔗</span>
              </div>
            </button>
          </div>
        </main>
        {showLogoutConfirm && <LogoutModal onConfirm={() => { setShowLogoutConfirm(false); logout(); }} onCancel={() => setShowLogoutConfirm(false)} />}
      </div>
    );
  }

  // Estado A: Tem 1+ grupos
  return (
    <div className="flex flex-col min-h-screen min-h-dvh safe-top bg-[#0D0D12] text-[#F0F0F8]">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border bg-bg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-bold text-lg uppercase">
            {user?.email?.[0] ?? "U"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-primary">Sua Conta</span>
            <span className="text-xs text-text-muted truncate max-w-[150px]">{user?.email}</span>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="text-xs font-semibold text-accent-red px-3 py-1.5 rounded-lg bg-accent-red/10 hover:bg-accent-red/20 transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-10">
        <h2 className="text-2xl font-bold text-text-primary text-center mb-8">
          Seus grupos
        </h2>
        
        <div className="flex flex-col gap-4 w-full max-w-sm mb-8">
          {groups.map((g) => {
            const isActive = g.id === activeGroupId;
            return (
              <button 
                key={g.id}
                onClick={async () => {
                  try {
                    await switchGroup(g.id);
                    toast.success(`Entrou no grupo ${g.name}`);
                  } catch (e: any) {
                    toast.error(e.message || "Erro ao trocar grupo");
                  }
                }}
                className={`relative flex items-center p-4 border rounded-2xl transition-all active:scale-[0.98] text-left ${isActive ? 'bg-bg-elevated border-accent-blue' : 'bg-bg-card border-border hover:bg-bg-elevated'}`}
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mr-4">
                  <span className="text-xl font-bold text-text-secondary">{g.name.substring(0, 1).toUpperCase()}</span>
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-text-primary font-bold text-lg truncate">{g.name}</span>
                  <span className="text-text-muted text-sm">{g.memberIds.length} membro(s)</span>
                </div>
                {isActive && (
                  <div className="absolute top-4 right-4 text-xs font-bold px-2 py-1 bg-accent-blue/20 text-accent-blue rounded-md">
                    Ativo
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex w-full max-w-sm gap-4">
           <button 
              onClick={onOpenCreate}
              className="flex-1 py-3 bg-bg-card border border-border rounded-xl text-text-primary font-semibold hover:bg-bg-elevated transition-colors text-sm"
            >
              Criar grupo
            </button>
            <button 
              onClick={onOpenJoin}
              className="flex-1 py-3 bg-bg-card border border-border rounded-xl text-text-primary font-semibold hover:bg-bg-elevated transition-colors text-sm"
            >
              Entrar c/ código
            </button>
        </div>
      </main>

      {showLogoutConfirm && <LogoutModal onConfirm={() => { setShowLogoutConfirm(false); logout(); }} onCancel={() => setShowLogoutConfirm(false)} />}
    </div>
  );
};

const LogoutModal: React.FC<{ onConfirm: () => void, onCancel: () => void }> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
    <div className="bg-bg-card border border-border rounded-3xl p-6 w-full max-w-[320px] shadow-2xl animate-scale-up flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-accent-red/10 flex items-center justify-center mb-4">
        <span className="text-2xl">👋</span>
      </div>
      <h3 className="text-xl font-bold text-text-primary mb-2">Sair da Conta?</h3>
      <p className="text-sm text-text-secondary mb-6">
        Tem certeza que deseja sair do CasalPay? Você precisará fazer login novamente para acessar.
      </p>
      <div className="flex gap-3 w-full">
        <button 
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-bg-elevated text-text-primary font-semibold hover:bg-white/5 transition-colors"
        >
          Cancelar
        </button>
        <button 
          onClick={onConfirm}
          className="flex-1 py-3 rounded-xl bg-accent-red text-white font-semibold shadow-[0_0_20px_rgba(248,113,113,0.15)] hover:bg-accent-red/90 transition-colors"
        >
          Sim, sair
        </button>
      </div>
    </div>
  </div>
);
