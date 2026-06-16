import React from "react";
import type { BalanceSummary } from "../types";
import { formatBRL, formatMonthLabel } from "../lib/formatters";
import { useAuthContext } from "../contexts/AuthContext";
import { OWNER_EMOJI, PARTNER_EMOJI } from "../constants/couple";

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
  const {
    netBalance,
  } = balance;

  const isEven = netBalance === 0;
  const zaraOwes = netBalance > 0;

  const { user } = useAuthContext();
  const isArthur = user?.email?.toLowerCase().startsWith("arthur");

  const colorClass = isEven
    ? "text-accent-green"
    : zaraOwes
    ? "text-accent-pink"
    : "text-accent-blue";

  const glowClass = isEven
    ? "shadow-[0_0_30px_rgba(74,222,128,0.12)]"
    : zaraOwes
    ? "shadow-glow"
    : "shadow-glow-blue";

  const borderClass = isEven
    ? "border-accent-green/30"
    : zaraOwes
    ? "border-accent-pink/30"
    : "border-accent-blue/30";

  let statusMessage = "Tudo certo por enquanto 🙌";
  if (!isEven) {
    if (isArthur) {
      statusMessage = zaraOwes ? "Zara te deve" : "Você deve à Zara";
    } else {
      statusMessage = zaraOwes ? "Você deve ao Arthur" : "Arthur te deve";
    }
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
          {isEven ? "✅" : zaraOwes ? PARTNER_EMOJI : OWNER_EMOJI}
        </div>
      </div>

      {/* Valor principal */}
      {isEven ? (
        <div className={`text-4xl font-bold ${colorClass} mb-1`}>
          Zerado!
        </div>
      ) : (
        <div className={`text-4xl font-bold ${colorClass} mb-1 tabular-nums`}>
          {formatBRL(Math.abs(netBalance))}
        </div>
      )}

      {/* Subtítulo */}
      <p className="text-sm text-text-muted mb-5">
        {isEven
          ? "Nenhum Pix necessário este mês 🎉"
          : "Valor líquido a pagar no Pix"}
      </p>

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
        {copied ? "✓ Copiado!" : "📋 Copiar resumo do Pix"}
      </button>
    </div>
  );
};
