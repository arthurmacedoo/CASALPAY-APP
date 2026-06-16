import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuthContext } from "./contexts/AuthContext";
import { BottomNav } from "./components/BottomNav";
import { HomePage } from "./pages/Home";
import { AddExpensePage } from "./pages/AddExpense";
import { HistoryPage } from "./pages/History";
import { MessagesPage } from "./pages/Messages";
import { LoginPage } from "./pages/Login";
import { NotificationProvider } from "./contexts/NotificationContext";
import { GroupProvider, useGroupContext } from "./contexts/GroupContext";
import { GroupSwitcherSheet } from "./components/GroupSwitcherSheet";
import { GroupHub } from "./components/GroupHub";
import { useUserGroups } from "./hooks/useUserGroups";
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
  const { user, loading: authLoading } = useAuthContext();
  const { currentMember, group, loading: groupLoading } = useGroupContext();
  const { groups: userGroups, loading: userGroupsLoading } = useUserGroups(user);
  
  const [isGroupSheetOpen, setIsGroupSheetOpen] = useState(false);

  // Aguarda resolver o contexto do grupo antes de decidir a tela
  if (authLoading || groupLoading || userGroupsLoading) {
    return <LoadingScreen />;
  }

  // Se logado mas sem membro atual válido (nenhum grupo associado/criado) ou sem grupo carregado
  if (!currentMember || !group) {
    return (
      <>
        <GroupHub 
          groups={userGroups} 
          onOpenCreate={() => setIsGroupSheetOpen(true)} 
          onOpenJoin={() => setIsGroupSheetOpen(true)} 
        />
        <GroupSwitcherSheet
          isOpen={isGroupSheetOpen}
          onClose={() => setIsGroupSheetOpen(false)}
        />
      </>
    );
  }

  // Com grupo válido, renderiza as rotas internas e a BottomNav
  return (
    <div className="flex flex-col min-h-screen min-h-dvh safe-top bg-bg">
      {children}
    </div>
  );
};

// Componente interno que só monta quando autenticado
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
  const { user, loading, error, isAuthorized } = useAuthContext();

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

  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
