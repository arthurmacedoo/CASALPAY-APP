import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { BottomNav } from "./components/BottomNav";
import { HomePage } from "./pages/Home";
import { AddExpensePage } from "./pages/AddExpense";
import { HistoryPage } from "./pages/History";
import { MessagesPage } from "./pages/Messages";
import { LoginPage } from "./pages/Login";
import { NotificationProvider } from "./contexts/NotificationContext";
import { GroupProvider, useGroupContext } from "./contexts/GroupContext";
import { GroupSwitcherSheet } from "./components/GroupSwitcherSheet";
import { GroupSettingsSheet } from "./components/GroupSettingsSheet";
import { Toaster } from "react-hot-toast";
import { isFirebaseConfigured, firebaseConfigError } from "./lib/firebase";

const LoadingScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-6">
    <div className="text-5xl animate-soft-pulse">💑</div>
    <div>
      <p className="text-text-primary font-semibold text-lg text-center">CasalPay</p>
      <p className="text-text-muted text-sm text-center mt-1">Conectando...</p>
    </div>
    <span className="spinner" />
  </div>
);

const ErrorScreen: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-8">
    <span className="text-4xl">😕</span>
    <p className="text-text-primary font-semibold text-center">
      Não foi possível conectar
    </p>
    <p className="text-text-muted text-sm text-center">{message}</p>
    <button
      onClick={() => window.location.reload()}
      className="text-accent-pink font-medium text-sm mt-2"
    >
      Tentar novamente
    </button>
  </div>
);

// Componente interno de Blindagem de Grupo
const ProtectedGroupRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentMember, group, loading: groupLoading } = useGroupContext();
  const { user, logout } = useAuth();
  const [isGroupSheetOpen, setIsGroupSheetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Aguarda resolver o contexto do grupo antes de decidir a tela
  if (groupLoading) {
    return <LoadingScreen />;
  }

  // Se logado mas sem membro atual válido (nenhum grupo associado/criado) ou sem grupo carregado
  if (!currentMember || !group) {
    return (
      <div className="flex flex-col min-h-screen min-h-dvh safe-top bg-[#0D0D12] text-[#F0F0F8]">
        {/* Header do Perfil */}
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
            onClick={() => setShowLogoutConfirm(true)}
            className="text-xs font-semibold text-accent-red px-3 py-1.5 rounded-lg bg-accent-red/10 hover:bg-accent-red/20 active:bg-accent-red/30 transition-colors"
          >
            Sair
          </button>
        </header>

        {/* Dashboard de Ações */}
        <main className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-10">
          <div className="w-20 h-20 rounded-full bg-accent-blue/10 flex items-center justify-center mb-6">
            <span className="text-4xl">👋</span>
          </div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-blue to-accent-pink text-center mb-8">
            Bem-vindo(a) ao CasalPay
          </h2>
          
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <button 
              onClick={() => setIsGroupSheetOpen(true)}
              className="group flex items-center justify-between p-5 bg-bg-card border border-border rounded-2xl hover:bg-bg-elevated transition-all active:scale-[0.98] text-left"
            >
              <div className="flex flex-col gap-1">
                <span className="text-text-primary font-bold text-lg">Criar novo grupo</span>
                <span className="text-text-muted text-sm">Para você e seu parceiro(a)</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-accent-blue text-xl">+</span>
              </div>
            </button>
            
            <button 
              onClick={() => setIsGroupSheetOpen(true)}
              className="group flex items-center justify-between p-5 bg-bg-card border border-border rounded-2xl hover:bg-bg-elevated transition-all active:scale-[0.98] text-left"
            >
              <div className="flex flex-col gap-1">
                <span className="text-text-primary font-bold text-lg">Entrar com código</span>
                <span className="text-text-muted text-sm">Se você recebeu um convite</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-accent-pink/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-accent-pink text-xl">🔗</span>
              </div>
            </button>
          </div>

          <GroupSwitcherSheet
            isOpen={isGroupSheetOpen}
            onClose={() => setIsGroupSheetOpen(false)}
          />
          <GroupSettingsSheet
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />

          {/* Popup de Confirmação de Logout */}
          {showLogoutConfirm && (
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
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-3 rounded-xl bg-bg-elevated text-text-primary font-semibold hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => { setShowLogoutConfirm(false); logout(); }}
                    className="flex-1 py-3 rounded-xl bg-accent-red text-white font-semibold shadow-[0_0_20px_rgba(248,113,113,0.15)] hover:bg-accent-red/90 transition-colors"
                  >
                    Sim, sair
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Com grupo válido, renderiza as rotas internas e a BottomNav
  return (
    <div className="flex flex-col min-h-screen min-h-dvh safe-top bg-bg">
      {children}
    </div>
  );
};

// Componente interno que só monta quando autenticado — hook pode ser chamado sem violar regras
const AuthenticatedApp: React.FC = () => {
  return (
    <GroupProvider>
      <NotificationProvider>
        <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff', borderRadius: '12px' } }} />
        <BrowserRouter>
          <ProtectedGroupRoute>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/add" element={<AddExpensePage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/messages" element={<MessagesPage />} />
            </Routes>
            <BottomNav />
          </ProtectedGroupRoute>
        </BrowserRouter>
      </NotificationProvider>
    </GroupProvider>
  );
};

const MainApp: React.FC = () => {
  const { user, loading, error, isAuthorized } = useAuth();

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (!user || !isAuthorized) return <LoginPage />;

  return <AuthenticatedApp />;
};

const App: React.FC = () => {
  if (!isFirebaseConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-8 bg-[#0D0D14] text-[#F0F0F8]">
        <span className="text-5xl animate-soft-pulse">⚠️</span>
        <p className="text-xl font-bold text-center">Configuração do Firebase Ausente</p>
        <p className="text-sm text-text-secondary text-center max-w-md">
          O projeto foi clonado com sucesso, mas você precisa configurar as credenciais do Firebase em um arquivo <code className="bg-[#1E1E2C] px-2 py-1 rounded text-[#E879A0]">.env</code> na raiz do projeto para que o app funcione localmente.
        </p>
        <div className="bg-[#16161F] border border-[#2A2A3E] p-4 rounded-2xl w-full max-w-md mt-2">
          <p className="text-xs font-semibold text-[#F0F0F8] mb-2">Status:</p>
          <code className="text-xs text-[#F87171] font-mono break-all">{firebaseConfigError}</code>
        </div>
      </div>
    );
  }

  return <MainApp />;
};

export default App;
