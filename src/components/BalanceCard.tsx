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
  const otherDebts = directDebts.filter(
    (d) => d.debtorId !== currentMember?.userId && d.creditorId !== currentMember?.userId
  );

  const isAllSettled = directDebts.length === 0;
  const isMeSettled  = myDebts.length === 0 && myCredits.length === 0;
  const hasDebts     = myDebts.length > 0;
  const hasCredits   = myCredits.length > 0;

  let borderClass   = "border-border";
  let glowClass     = "shadow-lg";
  let icon          = "✅";
  let statusMessage = "Tudo certo por enquanto 🙌";
  let colorClass    = "text-text-primary";

  if (isAllSettled) {
    colorClass    = "text-accent-green";
    borderClass   = "border-accent-green/30";
    glowClass     = "shadow-[0_0_30px_rgba(74,222,128,0.12)]";
  } else if (isMeSettled && otherDebts.length > 0) {
    colorClass    = "text-accent-green";
    borderClass   = "border-accent-green/30";
    glowClass     = "shadow-[0_0_30px_rgba(74,222,128,0.12)]";
    icon          = "✨";
    statusMessage = "Sua parte está quitada";
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
        {isAllSettled ? (
          <div className={`text-4xl font-bold ${colorClass} mb-6`}>
            Zerado!
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 mb-6 mt-2">
            {isMeSettled && (
              <div className="p-3 rounded-xl bg-accent-green/10 border border-accent-green/20 text-accent-green text-xs font-semibold flex items-center gap-2">
                <span>✓</span>
                <span>Você está em dia! Veja abaixo os acertos entre os outros membros:</span>
              </div>
            )}

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

            {/* Outros acertos do grupo (quando há mais membros) */}
            {otherDebts.length > 0 && (
              <div className="pt-2 border-t border-border/50 flex flex-col gap-2 mt-1">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider pl-1">
                  Outros acertos no grupo
                </span>
                {otherDebts.map((debt) => {
                  const debtor = members.find((m) => m.userId === debt.debtorId);
                  const creditor = members.find((m) => m.userId === debt.creditorId);
                  return (
                    <button
                      key={`other-${debt.debtorId}-${debt.creditorId}`}
                      onClick={() => setSelectedDebt(debt)}
                      className="w-full flex justify-between items-center bg-bg-elevated/70 hover:bg-bg-elevated p-3 rounded-xl border border-border/60 hover:border-border transition-all text-left group cursor-pointer"
                    >
                      <span className="text-xs text-text-secondary truncate">
                        {debtor?.name.split(" ")[0] ?? "Membro"} deve a {creditor?.name.split(" ")[0] ?? "Membro"}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-bold text-text-primary tabular-nums">
                          {formatBRL(debt.amount)}
                        </span>
                        <span className="text-text-muted text-xs group-hover:text-text-primary transition-colors">›</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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
