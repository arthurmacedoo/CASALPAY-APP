import React, { useEffect, useState } from "react";

export const AnniversaryCountdown: React.FC = () => {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [isToday, setIsToday] = useState(false);
  const [targetYear, setTargetYear] = useState<number>(2026);
  const [yearsCount, setYearsCount] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const todayMidnight = new Date(currentYear, now.getMonth(), now.getDate());

      // Aniversário de namoro: 26 de Novembro (mês 10, 0-indexed)
      // Ano inicial: 2025
      let targetAnniversaryYear = currentYear;
      let targetMidnight = new Date(targetAnniversaryYear, 10, 26);

      // Se a data de hoje já ultrapassou o dia 26 de novembro deste ano (ou seja, a partir de 27 de novembro),
      // a contagem vira automaticamente para o próximo ano
      if (todayMidnight.getTime() > targetMidnight.getTime()) {
        targetAnniversaryYear = currentYear + 1;
        targetMidnight = new Date(targetAnniversaryYear, 10, 26);
      }

      const diffMs = targetMidnight.getTime() - todayMidnight.getTime();
      const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const calculatedYears = targetAnniversaryYear - 2025;

      setIsToday(days === 0);
      setDaysLeft(days);
      setTargetYear(targetAnniversaryYear);
      setYearsCount(calculatedYears);
    };

    updateCountdown();
    // Atualiza a cada minuto para virar exatamente na meia-noite
    const interval = setInterval(updateCountdown, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fechar no Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    if (isModalOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  if (daysLeft === null) return null;

  const yearsLabel = yearsCount === 1 ? "UM ANO" : `${yearsCount} ANOS`;
  const yearsPlural = yearsCount === 1 ? "ano" : "anos";

  return (
    <>
      <section 
        className="card mt-2 border border-accent-pink/20 bg-bg-elevated/40 shadow-[0_0_20px_rgba(236,72,153,0.08)] animate-fade-in-up"
        aria-labelledby="anniversary-countdown-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="anniversary-countdown-title" className="text-[11px] font-bold text-accent-pink uppercase tracking-widest mt-1">
              🤍 Contagem regressiva: {yearsLabel} juntos
            </p>
          </div>
          <button
            type="button"
            aria-label={`Abrir celebração de ${yearsCount} ${yearsPlural} juntos`}
            onClick={() => setIsModalOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-pink/10 text-xl hover:bg-accent-pink/20 transition active:scale-95 shadow-[0_0_15px_rgba(236,72,153,0.15)]"
          >
            ✨
          </button>
        </div>

        <div className="mt-2 text-center pb-2">
          {isToday ? (
            <div className="py-2 animate-bounce">
              <p className="text-xl font-bold text-accent-pink">
                Hoje completamos {yearsCount} {yearsPlural} juntos! 🎉
              </p>
              <p className="text-xs text-text-muted mt-1">
                Uma data mais que especial para celebrar! 🤍
              </p>
            </div>
          ) : (
            <div className="flex justify-center items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold text-text-primary tabular-nums">
                {daysLeft}
              </span>
              <span className="text-base font-medium text-text-secondary">
                dias
              </span>
            </div>
          )}
          
          <p className="text-[10px] uppercase tracking-widest text-text-muted mt-2">
            26 de novembro de {targetYear}
          </p>
        </div>
      </section>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-md transition-opacity"
          role="dialog"
          aria-modal="true"
          aria-labelledby="anniversary-modal-title"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="anniversary-modal-in relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-accent-pink/30 bg-bg-card p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Confetes */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {[...Array(16)].map((_, i) => (
                <span
                  key={i}
                  className="anniversary-confetti absolute top-[-20px] inline-block h-2 w-2 rounded-sm"
                  style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: ['#ec4899', '#8b5cf6', '#ffffff', '#fbcfe8', '#f59e0b'][Math.floor(Math.random() * 5)],
                    animationDelay: `${Math.random() * 1.5}s`,
                    animationDuration: `${1.2 + Math.random()}s`,
                    '--x': `${(Math.random() - 0.5) * 80}px`,
                  } as React.CSSProperties}
                />
              ))}
            </div>

            <div className="relative z-10">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-pink/15 text-3xl shadow-[0_0_30px_rgba(236,72,153,0.25)]">
                🤍
              </div>

              <h2 id="anniversary-modal-title" className="text-xl font-bold text-text-primary">
                {isToday ? `Feliz ${yearsCount} ${yearsPlural} juntos!` : `${yearsCount === 1 ? "Um ano" : `${yearsCount} anos`} juntos`}
              </h2>

              {!isToday && (
                <p className="mt-2 text-sm text-text-secondary">
                  Nosso aniversário de {yearsCount} {yearsPlural} está chegando.
                </p>
              )}

              <p className="mt-6 text-4xl font-black text-accent-pink tabular-nums drop-shadow-sm">
                {isToday ? "🎉 🤍 ✨" : `${daysLeft} dias`}
              </p>

              <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-text-muted">
                26 de novembro de {targetYear}
              </p>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="mt-8 w-full rounded-2xl bg-accent-pink px-4 py-4 font-bold text-white shadow-lg shadow-accent-pink/20 transition active:scale-[0.98]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
