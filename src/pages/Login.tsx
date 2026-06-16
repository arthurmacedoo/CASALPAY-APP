import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export const LoginPage: React.FC = () => {
  const { login, register, error, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    
    if (isRegister) {
      if (!name.trim()) return;
      register(name, email, password, remember);
    } else {
      login(email, password, remember);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-bg-card pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-[360px] mx-auto flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 border border-border flex items-center justify-center mb-2 shadow-glow-blue">
          <svg className="w-8 h-8 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">CasalPay</h1>
          <p className="text-sm text-text-muted">Gestão financeira transparente.</p>
        </div>

        {/* Toggle Mode */}
        <div className="relative flex bg-bg-elevated p-1 rounded-xl w-full border border-border">
          {/* Fundo dinâmico deslizando */}
          <div 
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg shadow-sm border transition-all duration-300 ease-out ${!isRegister ? 'bg-accent-blue/10 border-accent-blue/20' : 'bg-accent-purple/10 border-accent-purple/20'}`}
            style={{ transform: isRegister ? 'translateX(100%)' : 'translateX(0)' }}
          />
          <button 
            type="button"
            onClick={() => { setIsRegister(false); /*setError(null);*/ }}
            className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-colors duration-300 ${!isRegister ? 'text-accent-blue' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Entrar
          </button>
          <button 
            type="button"
            onClick={() => { setIsRegister(true); /*setError(null);*/ }}
            className={`relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-colors duration-300 ${isRegister ? 'text-accent-purple' : 'text-text-muted hover:text-text-secondary'}`}
          >
            Criar Conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {error && <div className="p-3 rounded-xl bg-accent-red/10 text-accent-red text-sm text-center font-medium border border-accent-red/20">{error}</div>}

          {isRegister && (
            <input type="text" placeholder="Seu nome ou apelido" value={name} onChange={(e) => setName(e.target.value)} required className="input-base" disabled={loading} />
          )}
          
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-base" disabled={loading} />
          
          <div className="relative w-full">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Senha" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="input-base pr-12 w-full" 
              disabled={loading} 
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-text-secondary transition-colors outline-none"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          </div>

          <label className="flex items-center gap-3 cursor-pointer mt-1 pl-1">
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors duration-300 ${remember ? (!isRegister ? 'bg-accent-blue border-accent-blue' : 'bg-accent-purple border-accent-purple') : 'bg-transparent border-border'}`}>
              {remember && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
            <span className="text-sm font-medium text-text-secondary select-none">Manter conectado</span>
            <input type="checkbox" className="hidden" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={loading} />
          </label>

          <button 
            type="submit" 
            className={`w-full py-3.5 rounded-xl text-white text-sm font-semibold transition-all duration-300 active:scale-[0.98] mt-2 disabled:opacity-50 ${!isRegister ? 'bg-accent-blue shadow-glow-blue hover:bg-accent-blue/90' : 'bg-accent-purple shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:bg-accent-purple/90'}`} 
            disabled={loading}
          >
            {loading ? (isRegister ? 'Criando conta...' : 'Entrando...') : (isRegister ? 'Criar e Acessar' : 'Acessar CasalPay')}
          </button>
        </form>
      </div>
    </div>
  );
};
