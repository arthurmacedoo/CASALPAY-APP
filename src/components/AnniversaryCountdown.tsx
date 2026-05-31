import React, { useEffect, useState } from "react";

export const AnniversaryCountdown: React.FC = () => {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [isPassed, setIsPassed] = useState(false);

  useEffect(() => {
    // 26 de novembro de 2027 (mês 10 em JS)
    const targetDate = new Date(2027, 10, 26, 0, 0, 0).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setIsPassed(true);
        setDaysLeft(0);
        return;
      }

      // Arredonda para cima para contar frações de dia como +1 dia
      const days = Math.ceil(difference / (1000 * 60 * 60 * 24));
      setDaysLeft(days);
      setIsPassed(false);
    };

    updateCountdown();

    // Atualiza a cada hora para garantir que a virada de dia reflita
    const interval = setInterval(updateCountdown, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, []);

  if (daysLeft === null) return null; // Evita piscar enquanto calcula

  if (isPassed) {
    return (
      <div className="card mt-2 border border-accent-pink/40 shadow-glow text-center py-6 animate-fade-in-up">
        <h3 className="text-xl font-bold text-accent-pink">💖 Feliz 1 ano de namoro!</h3>
      </div>
    );
  }

  return (
    <div className="card mt-2 border border-accent-pink/20 bg-bg-elevated/40 shadow-[0_0_20px_rgba(236,72,153,0.08)] animate-fade-in-up">
      <div className="flex flex-col items-center justify-center py-5 text-center">
        <h3 className="text-xs font-bold text-accent-pink mb-3 uppercase tracking-widest">
          💖 1 ano de namoro
        </h3>
        
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-3xl font-bold text-text-primary tabular-nums">
            {daysLeft}
          </span>
          <span className="text-base font-medium text-text-secondary">
            {daysLeft === 1 ? "dia" : "dias"}
          </span>
        </div>
        
        <p className="text-sm text-text-muted">
          Faltam {daysLeft} {daysLeft === 1 ? "dia" : "dias"} para o nosso aniversário! ✨
        </p>
      </div>
    </div>
  );
};
