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
  const {
    netBalance,
  } = balance;

  const { members, currentMember } = useGroupContext();

  const isEven = netBalance === 0;
  const isAdmin = currentMember?.role === "admin";
  const adminOwes = netBalance < 0; // Admin should pay
  const adminReceives = netBalance > 0; // Admin should receive

  // Find the other member (assuming 2 members)
  const otherMember = members.find(m => m.userId !== currentMember?.userId);
  const otherName = otherMember ? otherMember.name.split(' ')[0] : "Parceiro(a)";

  // Zara is originally the partner. If I am admin (Arthur), Zara owes = adminReceives
  // Let's abstract this dynamically:
  const iOwe = isAdmin ? adminOwes : adminReceives;
  const otherOwes = isAdmin ? adminReceives : adminOwes;

  const colorClass = isEven
    ? "text-accent-green"
    : otherOwes
    ? "text-accent-pink"
    : "text-accent-blue";

  const glowClass = isEven
    ? "shadow-[0_0_30px_rgba(74,222,128,0.12)]"
    : otherOwes
    ? "shadow-glow"
    : "shadow-glow-blue";

  const borderClass = isEven
    ? "border-accent-green/30"
    : otherOwes
    ? "border-accent-pink/30"
    : "border-accent-blue/30";

  let statusMessage = "Tudo certo por enquanto 🙌";
  if (!isEven) {
    statusMessage = iOwe ? `Você deve a ${otherName}` : `${otherName} te deve`;
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
          {isEven ? "✅" : otherOwes ? "💖" : "💙"}
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
