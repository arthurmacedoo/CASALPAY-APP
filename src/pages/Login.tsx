import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export const LoginPage: React.FC = () => {
  const { login, logout, loading, error, user, isAuthorized, unauthorizedReason } = useAuth();
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleCopyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      login(username, password);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-bg-card pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-[360px] mx-auto flex flex-col items-center gap-6">
        <div className="text-5xl">👩‍❤️‍👨</div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">
            CasalPay
          </h1>
          <p className="text-sm text-text-muted">
            O aplicativo de divisão de despesas do casal.
          </p>
        </div>

        {/* Mensagem de Erro Genérico ou Falha no Login */}
        {error && (
          <div className="w-full p-4 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm text-center">
            {error}
          </div>
        )}

        {/* Usuário logado, mas bloqueado pelo Firestore (UID não liberado) */}
        {user && !isAuthorized && !loading && (
          <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
            <div className="w-full p-5 rounded-xl bg-accent-blue/10 border border-accent-blue/30 flex flex-col items-center text-center">
              <h2 className="text-accent-blue font-semibold mb-2">Autenticado, mas bloqueado no app.</h2>
              <p className="text-sm text-text-secondary mb-4">
                <strong>Motivo exato:</strong><br />
                <span className="font-mono text-xs opacity-80 mt-1 block bg-black/20 p-2 rounded">{unauthorizedReason}</span>
              </p>
              
              <p className="text-xs text-text-muted mb-2">O seu <strong>UID</strong> é:</p>
              <code className="text-xs break-all bg-bg-card p-2 rounded block mb-3 font-mono text-text-primary w-full">
                {user.uid}
              </code>
              <Button onClick={handleCopyUid} variant="secondary" fullWidth>
                {copied ? "UID Copiado! ✓" : "Copiar meu UID"}
              </Button>
            </div>
            
            <button 
              onClick={logout} 
              className="text-text-muted text-sm underline mt-2"
            >
              Sair / Tentar com outra conta
            </button>
          </div>
        )}

        {/* Usuário deslogado completamente - Formulário Usuário e Senha */}
        {!user && !loading && (
          <form onSubmit={handleLogin} className="w-full flex flex-col gap-4 box-border">
            <Input
              type="text"
              label="Usuário"
              placeholder="Digite seu usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              type="password"
              label="Senha"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            <Button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              fullWidth
            >
              Entrar
            </Button>
          </form>
        )}

        {/* Estado de loading */}
        {loading && (
          <div className="mt-4 text-text-muted text-sm flex items-center gap-2">
            <span className="animate-spin text-lg">⏳</span>
            Verificando acesso...
          </div>
        )}
      </div>
    </div>
  );
};
