import React, { useEffect, useRef, useMemo } from "react";


interface MonthSelectorProps {
  selectedMonth: string;
  onChange: (monthKey: string) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => {
    const arr: string[] = [];
    const now = new Date();
    // Do futuro (+12 meses) até o passado (-4 meses)
    for (let i = 12; i >= -4; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      arr.push(`${year}-${month}`);
    }
    return arr;
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      // Pequeno timeout para garantir que os elementos foram renderizados
      setTimeout(() => {
        const selectedEl = containerRef.current?.querySelector('[data-selected="true"]');
        if (selectedEl) {
          selectedEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      }, 50);
    }
  }, [selectedMonth]);

  return (
    <div ref={containerRef} className="flex gap-2 overflow-x-auto pb-1 scroll-smooth hide-scrollbar">
      {months.map((month) => {
        const isSelected = month === selectedMonth;
        const [year, m] = month.split("-");
        const date = new Date(Number(year), Number(m) - 1, 1);
        const shortLabel = date.toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        });

        return (
          <button
            key={month}
            data-selected={isSelected}
            onClick={() => onChange(month)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95 border
              ${
                isSelected
                  ? "bg-accent-pink text-white border-accent-pink shadow-glow"
                  : "bg-bg-elevated text-text-secondary border-border hover:border-border-light"
              }`}
          >
            {shortLabel}
          </button>
        );
      })}
    </div>
  );
};
