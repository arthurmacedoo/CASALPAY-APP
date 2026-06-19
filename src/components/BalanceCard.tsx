import React from "react";
import type { BalanceSummary } from "../types";
import { formatBRL, formatMonthLabel } from "../lib/formatters";
import { useGroupContext } from "../contexts/GroupContext";

interface BalanceCardProps {
  balance: BalanceSummary;
  monthKey: string;
  onCopyPix: () => void;
  copied: boolean;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  monthKey,
  onCopyPix,
  copied,
}) => {
  const { obligations } = balance;
  const { members, currentMember } = useGroupContext();

  const myDebts = obligations.filter((o) => o.fromUid === currentMember?.userId);
  const myCredits = obligations.filter((o) => o.toUid === currentMember?.userId);

  const isEven = myDebts.length === 0 && myCredits.length === 0;
  const hasDebts = myDebts.length > 0;
  const hasCredits = myCredits.length > 0;

  let colorClass = "text-text-primary";
  let borderClass = "border-border";
  let glowClass = "shadow-lg";
  let icon = "✅";
  let statusMessage = "Tudo certo por enquanto 🙌";

  if (isEven) {
    colorClass = "text-accent-green";
    borderClass = "border-accent-green/30";
    glowClass = "shadow-[0_0_30px_rgba(74,222,128,0.12)]";
  } else if (hasDebts && !hasCredits) {
    colorClass = "text-accent-pink";
    borderClass = "border-accent-pink/30";
    glowClass = "shadow-glow";
    icon = "💸";
    statusMessage = myDebts.length === 1 ? "Você tem um Pix a fazer" : "Você possui acertos pendentes";
  } else if (hasCredits && !hasDebts) {
    colorClass = "text-accent-blue";
    borderClass = "border-accent-blue/30";
    glowClass = "shadow-glow-blue";
    icon = "💰";
    statusMessage = myCredits.length === 1 ? "Você tem um Pix a receber" : "Você tem valores a receber";
  } else {
    colorClass = "text-text-primary";
    borderClass = "border-border-light";
    glowClass = "shadow-lg";
    icon = "⚖️";
    statusMessage = "Acertos cruzados pendentes";
  }

  const monthLabel = formatMonthLabel(monthKey);

  return (
    <div
      className={`card border ${borderClass} ${glowClass} transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-widest">
            Saldo de {monthLabel}
          </p>
          <p className="text-sm font-medium text-text-secondary mt-0.5">
            {statusMessage}
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-bg-elevated flex items-center justify-center text-xl">
          {icon}
        </div>
      </div>

      {/* Lista de Liquidações */}
      {isEven ? (
        <div className={`text-4xl font-bold ${colorClass} mb-6`}>
          Zerado!
        </div>
      ) : (
        <div className="flex flex-col gap-3 mb-6 mt-2">
           {myDebts.map((debt) => {
              const toMember = members.find((m) => m.userId === debt.toUid);
              return (
                 <div key={`debt-${debt.toUid}`} className="flex justify-between items-center bg-accent-pink/10 p-3.5 rounded-xl border border-accent-pink/20">
                    <span className="text-sm font-medium text-accent-pink/90">Você deve a {toMember?.name.split(' ')[0] ?? 'Membro'}</span>
                    <span className="text-xl font-bold text-accent-pink tabular-nums">{formatBRL(debt.amount)}</span>
                 </div>
              );
           })}
           {myCredits.map((credit) => {
              const fromMember = members.find((m) => m.userId === credit.fromUid);
              return (
                 <div key={`credit-${credit.fromUid}`} className="flex justify-between items-center bg-accent-blue/10 p-3.5 rounded-xl border border-accent-blue/20">
                    <span className="text-sm font-medium text-accent-blue/90">{fromMember?.name.split(' ')[0] ?? 'Membro'} te deve</span>
                    <span className="text-xl font-bold text-accent-blue tabular-nums">{formatBRL(credit.amount)}</span>
                 </div>
              );
           })}
        </div>
      )}

      {/* Botão copiar resumo Pix */}
      <button
        onClick={onCopyPix}
        id="btn-copy-pix"
        className={`w-full py-3 rounded-2xl text-sm font-medium transition-all duration-200 active:scale-95 border
          ${
            copied
              ? "bg-accent-green/20 border-accent-green text-accent-green"
              : "bg-bg-elevated border-border text-text-secondary hover:border-border-light"
          }`}
      >
        {copied ? "✓ Copiado!" : "📋 Copiar resumo do Pix do Grupo"}
      </button>
    </div>
  );
};
