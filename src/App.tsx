import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { BottomNav } from "./components/BottomNav";
import { HomePage } from "./pages/Home";
import { AddExpensePage } from "./pages/AddExpense";
import { HistoryPage } from "./pages/History";
import { MessagesPage } from "./pages/Messages";
import { LoginPage } from "./pages/Login";
import { NotificationProvider } from "./contexts/NotificationContext";
import { Toaster } from "react-hot-toast";

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

// Componente interno que só monta quando autenticado — hook pode ser chamado sem violar regras
const AuthenticatedApp: React.FC = () => {
  return (
    <NotificationProvider>
      <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff', borderRadius: '12px' } }} />
      <BrowserRouter>
        <div className="flex flex-col min-h-screen min-h-dvh safe-top">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/add" element={<AddExpensePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/messages" element={<MessagesPage />} />
          </Routes>
          <BottomNav />
        </div>
      </BrowserRouter>
    </NotificationProvider>
  );
};

const App: React.FC = () => {
  const { user, loading, error, isAuthorized } = useAuth();

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (!user || !isAuthorized) return <LoginPage />;

  return <AuthenticatedApp />;
};

export default App;
