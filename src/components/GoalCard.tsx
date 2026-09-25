import React from "react";
import type { Goal } from "../types";
import { formatBRL, formatDeadline } from "../lib/formatters";

interface GoalCardProps {
  goal: Goal;
  arthurUid: string;
  zaraUid: string;
  onClick: (goal: Goal) => void;
  hideBalance?: boolean;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  arthurUid,
  zaraUid,
  onClick,
  hideBalance = false,
}) => {
  const percentage = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0;

  const arthurContrib = goal.contributionsByMember?.[arthurUid] || 0;
  const zaraContrib = goal.contributionsByMember?.[zaraUid] || 0;
  const totalMemberContrib = arthurContrib + zaraContrib;

  const arthurPct = totalMemberContrib > 0
    ? Math.round((arthurContrib / totalMemberContrib) * 100)
    : 50;
  const zaraPct = totalMemberContrib > 0
    ? 100 - arthurPct
    : 50;

  const isCompleted = goal.status === "completed" || goal.currentAmount >= goal.targetAmount;

  return (
    <div
      onClick={() => onClick(goal)}
      className="group relative bg-[#16161F] border border-[#2A2A3E] hover:border-accent-pink/50 rounded-3xl p-5 transition-all duration-200 active:scale-[0.99] cursor-pointer shadow-lg hover:shadow-accent-pink/5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform">
            {goal.emoji || "🎯"}
          </div>
          <div>
            <span className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
              {goal.category || "Sonho"}
            </span>
            <h3 className="text-base font-bold text-text-primary leading-tight line-clamp-1">
              {goal.title}
            </h3>
          </div>
        </div>

        {isCompleted ? (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-accent-green/20 text-accent-green border border-accent-green/30 animate-pulse">
            Concluída 🏆
          </span>
        ) : (
          <span className="text-xs font-bold text-accent-pink tabular-nums bg-accent-pink/10 px-2 py-1 rounded-xl">
            {percentage}%
          </span>
        )}
      </div>

      {/* Valores */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-xs text-text-muted mb-0.5 font-medium">Acumulado</p>
          <p className="text-xl font-black text-text-primary tabular-nums tracking-tight">
            {hideBalance ? "••••••" : formatBRL(goal.currentAmount)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted mb-0.5 font-medium">Alvo</p>
          <p className="text-sm font-semibold text-text-secondary tabular-nums">
            {hideBalance ? "••••••" : formatBRL(goal.targetAmount)}
          </p>
        </div>
      </div>

      {/* Barra de Progresso com Gradiente */}
      <div className="w-full h-2.5 bg-bg-elevated rounded-full overflow-hidden mb-3.5 border border-border/40 p-[1px]">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isCompleted
              ? "bg-accent-green shadow-[0_0_10px_rgba(74,222,128,0.5)]"
              : "bg-gradient-to-r from-accent-pink via-[#C084FC] to-accent-blue shadow-[0_0_10px_rgba(232,121,160,0.3)]"
          }`}
          style={{ width: `${Math.max(4, percentage)}%` }}
        />
      </div>

      {/* Distribuição do Casal na Meta */}
      <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-accent-blue">
            <span className="w-2 h-2 rounded-full bg-accent-blue" />
            Arthur {arthurPct}%
          </span>
          <span className="text-text-muted">·</span>
          <span className="inline-flex items-center gap-1 font-semibold text-accent-pink">
            <span className="w-2 h-2 rounded-full bg-accent-pink" />
            Zara {zaraPct}%
          </span>
        </div>

        {goal.deadline ? (
          <span className="text-[11px] text-text-muted font-medium">
            📅 {formatDeadline(goal.deadline)}
          </span>
        ) : (
          <span className="text-[11px] text-text-muted">Sem prazo fixo</span>
        )}
      </div>
    </div>
  );
};
