import React, { useEffect, useState } from "react";

// Helper function
function getDaysUntil(targetDate: Date): number {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diff = target.getTime() - startOfToday.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export const AnniversaryCountdown: React.FC = () => {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [isPassed, setIsPassed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // 26 de novembro de 2027 (mês 10 em JS)
    const targetDate = new Date(2027, 10, 26, 0, 0, 0);

    const updateCountdown = () => {
      const days = getDaysUntil(targetDate);
      if (days <= 0) {
        setIsPassed(true);
        setDaysLeft(0);
      } else {
        setIsPassed(false);
        setDaysLeft(days);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000 * 60 * 60);
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

  return (
    <>
      <section 
        className="card mt-2 border border-accent-pink/20 bg-bg-elevated/40 shadow-[0_0_20px_rgba(236,72,153,0.08)] animate-fade-in-up"
        aria-labelledby="anniversary-countdown-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="anniversary-countdown-title" className="text-[11px] font-bold text-accent-pink uppercase tracking-widest mt-1">
              🤍 Contagem regressiva: um ano juntos
            </p>
          </div>
          <button
            type="button"
            aria-label="Abrir celebração de um ano juntos"
            onClick={() => setIsModalOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-pink/10 text-xl hover:bg-accent-pink/20 transition active:scale-95 shadow-[0_0_15px_rgba(236,72,153,0.15)]"
          >
            ✨
          </button>
        </div>

        <div className="mt-2 text-center pb-2">
          {isPassed ? (
            <p className="text-xl font-bold text-accent-pink py-2">Hoje é nosso primeiro ano juntos</p>
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
            26 de novembro de 2027
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
              {[...Array(14)].map((_, i) => (
                <span
                  key={i}
                  className="anniversary-confetti absolute top-[-20px] inline-block h-2 w-2 rounded-sm"
                  style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: ['#ec4899', '#8b5cf6', '#ffffff', '#fbcfe8'][Math.floor(Math.random() * 4)],
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
                {isPassed ? "Feliz 1 ano juntos!" : "Um ano juntos"}
              </h2>

              {!isPassed && (
                <p className="mt-2 text-sm text-text-secondary">
                  Nosso primeiro ano está chegando.
                </p>
              )}

              <p className="mt-6 text-4xl font-black text-accent-pink tabular-nums drop-shadow-sm">
                {isPassed ? "🤍" : `${daysLeft} dias`}
              </p>

              <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-text-muted">
                26 de novembro de 2027
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
