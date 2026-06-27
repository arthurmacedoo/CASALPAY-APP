import React, { useState } from "react";
import type { BalanceSummary, DirectDebt } from "../types";
import { formatBRL, formatMonthLabel } from "../lib/formatters";
import { useGroupContext } from "../contexts/GroupContext";
import { DebtDetailSheet } from "./DebtDetailSheet";

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
  const { directDebts } = balance;
  const { members, currentMember } = useGroupContext();

  // ── Estado do Bottom Sheet ─────────────────────────────────────────────────
  const [selectedDebt, setSelectedDebt] = useState<DirectDebt | null>(null);

  const myDebts   = directDebts.filter((d) => d.debtorId   === currentMember?.userId);
  const myCredits = directDebts.filter((d) => d.creditorId === currentMember?.userId);

  const isEven     = myDebts.length === 0 && myCredits.length === 0;
  const hasDebts   = myDebts.length > 0;
  const hasCredits = myCredits.length > 0;

  let borderClass   = "border-border";
  let glowClass     = "shadow-lg";
  let icon          = "✅";
  let statusMessage = "Tudo certo por enquanto 🙌";
  let colorClass    = "text-text-primary";

  if (isEven) {
    colorClass    = "text-accent-green";
    borderClass   = "border-accent-green/30";
    glowClass     = "shadow-[0_0_30px_rgba(74,222,128,0.12)]";
  } else if (hasDebts && !hasCredits) {
    colorClass    = "text-accent-pink";
    borderClass   = "border-accent-pink/30";
    glowClass     = "shadow-glow";
    icon          = "💸";
    statusMessage = myDebts.length === 1 ? "Você tem um Pix a fazer" : "Você possui acertos pendentes";
  } else if (hasCredits && !hasDebts) {
    colorClass    = "text-accent-blue";
    borderClass   = "border-accent-blue/30";
    glowClass     = "shadow-glow-blue";
    icon          = "💰";
    statusMessage = myCredits.length === 1 ? "Você tem um Pix a receber" : "Você tem valores a receber";
  } else {
    borderClass   = "border-border-light";
    icon          = "⚖️";
    statusMessage = "Acertos cruzados pendentes";
  }

  const monthLabel = formatMonthLabel(monthKey);

  return (
    <>
      <div className={`card border ${borderClass} ${glowClass} transition-all duration-300`}>

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

        {/* Lista de dívidas */}
        {isEven ? (
          <div className={`text-4xl font-bold ${colorClass} mb-6`}>
            Zerado!
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 mb-6 mt-2">

            {/* Dívidas — você deve para alguém */}
            {myDebts.map((debt) => {
              const toMember = members.find((m) => m.userId === debt.creditorId);
              return (
                <button
                  key={`debt-${debt.debtorId}-${debt.creditorId}`}
                  id={`debt-btn-${debt.creditorId}`}
                  onClick={() => setSelectedDebt(debt)}
                  className="w-full flex justify-between items-center
                             bg-accent-pink/10 hover:bg-accent-pink/15
                             p-3.5 rounded-xl border border-accent-pink/20 hover:border-accent-pink/40
                             cursor-pointer active:scale-[0.98]
                             transition-all duration-150 text-left group"
                >
                  <span className="text-sm font-medium text-accent-pink/90">
                    Você deve a {toMember?.name.split(" ")[0] ?? "Membro"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-accent-pink tabular-nums">
                      {formatBRL(debt.amount)}
                    </span>
                    <span className="text-accent-pink/50 text-lg group-hover:text-accent-pink/80 transition-colors">
                      ›
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Créditos — alguém deve para você */}
            {myCredits.map((credit) => {
              const fromMember = members.find((m) => m.userId === credit.debtorId);
              return (
                <button
                  key={`credit-${credit.debtorId}-${credit.creditorId}`}
                  id={`credit-btn-${credit.debtorId}`}
                  onClick={() => setSelectedDebt(credit)}
                  className="w-full flex justify-between items-center
                             bg-accent-blue/10 hover:bg-accent-blue/15
                             p-3.5 rounded-xl border border-accent-blue/20 hover:border-accent-blue/40
                             cursor-pointer active:scale-[0.98]
                             transition-all duration-150 text-left group"
                >
                  <span className="text-sm font-medium text-accent-blue/90">
                    {fromMember?.name.split(" ")[0] ?? "Membro"} te deve
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-accent-blue tabular-nums">
                      {formatBRL(credit.amount)}
                    </span>
                    <span className="text-accent-blue/50 text-lg group-hover:text-accent-blue/80 transition-colors">
                      ›
                    </span>
                  </div>
                </button>
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

      {/* Bottom Sheet — renderizado fora do card para evitar z-index issues */}
      <DebtDetailSheet
        debt={selectedDebt}
        members={members}
        currentUserId={currentMember?.userId}
        onClose={() => setSelectedDebt(null)}
      />
    </>
  );
};
