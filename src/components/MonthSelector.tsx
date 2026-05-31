import React from "react";
import { getLastNMonths } from "../lib/formatters";

interface MonthSelectorProps {
  selectedMonth: string;
  onChange: (monthKey: string) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onChange,
}) => {
  const months = getLastNMonths(6);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
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
