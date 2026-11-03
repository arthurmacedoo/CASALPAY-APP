import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Transaction, ExpenseTransaction, SettlementTransaction } from "../types";
import { createPortal } from "react-dom";
import { formatBRL, formatDateBR, formatSplitType, formatMonthName } from "../lib/formatters";
import {
  calculateSettlementEffect,
  resolveAdminUid,
  resolveExpenseDebtParties,
} from "../lib/calculations";
import { useGroupContext } from "../contexts/GroupContext";

interface TransactionItemProps {
  transaction: Transaction;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  showActions?: boolean;
  isSettled?: boolean;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onEdit,
  onDelete,
  showActions = false,
  isSettled = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDeleteClick = () => {
    setIsModalOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete?.(transaction);
    setIsModalOpen(false);
  };

  const { members } = useGroupContext();
  const navigate = useNavigate();
  const isExpense = transaction.type === "expense";
  const isCarryOver = Boolean(transaction.carryOver);

  const debtParties = isExpense
    ? resolveExpenseDebtParties(transaction as ExpenseTransaction, members)
    : { paidByUid: "", debtorUid: "", debtAmount: 0, splitUids: [] };

  const canQuickSettle =
    isExpense &&
    transaction.amount > 0 &&
    (transaction.visibility === "personal" ||
      isCarryOver ||
      debtParties.debtAmount > 0);

  const handleQuickSettle = (t: Transaction) => {
    if (t.type !== "expense") return;
    const isPersonal = t.visibility === "personal";
    const monthName = t.carryOverFromMonth
      ? formatMonthName(t.carryOverFromMonth)
      : "mês anterior";
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    if (isPersonal) {
      const ownerId = t.personalOwnerUserId || t.paidByUserId;
      const amountStr = (t.amount / 100).toFixed(2).replace(".", ",");
      const desc = t.carryOver
        ? `Pagamento saldo anterior · ${capitalizedMonth}`
        : `Pagamento · ${t.description || "Fatura"}`;

      navigate("/add", {
        state: {
          prefillSettlement: {
            type: "settlement",
            settlementMode: "invoice",
            personalOwnerUserId: ownerId,
            amount: amountStr,
            description: desc,
            fromUserId: ownerId,
            toUserId: ownerId,
            settledExpenseId: t.id,
          },
        },
      });
    } else {
      const expense = t as ExpenseTransaction;
      const { paidByUid, debtorUid, debtAmount } = resolveExpenseDebtParties(
        expense,
        members
      );
      const fallbackDebtor =
        expense.personalOwnerUserId || expense.splitBetweenUserIds?.[0] || "";
      const finalDebtor = debtorUid || fallbackDebtor;
      const finalCreditor = paidByUid || expense.paidByUserId || "";
      const amountToSettle = debtAmount > 0 ? debtAmount : expense.amount;
      const amountStr = (amountToSettle / 100).toFixed(2).replace(".", ",");
      const desc = t.carryOver
        ? `Acerto saldo anterior · ${capitalizedMonth}`
        : `Acerto · ${t.description || "Compra"}`;

      navigate("/add", {
        state: {
          prefillSettlement: {
            type: "settlement",
            settlementMode: "shared",
            fromUserId: finalDebtor,
            toUserId: finalCreditor,
            amount: amountStr,
            description: desc,
            settledExpenseId: t.id,
          },
        },
      });
    }
  };

  let avatarInitial = "💸";
  if (isCarryOver) {
    avatarInitial = "↪";
  } else if (isExpense) {
    if (transaction.visibility === "personal" && transaction.personalOwnerUserId) {
      const owner = members.find((m) => m.userId === transaction.personalOwnerUserId);
      avatarInitial = owner?.name.charAt(0).toUpperCase() || "👤";
    } else {
      const payerId = (transaction as ExpenseTransaction).paidByUserId;
      const payer = members.find((m) => m.userId === payerId);
      if (payer) {
        avatarInitial = payer.name.charAt(0).toUpperCase();
      } else {
        avatarInitial = "👤";
      }
    }
  }

  const getSubtitleSuffix = (): string => {
    if (isCarryOver) {
      return "Transferido do mês anterior (toque para quitar)";
    }
    if (!isExpense) return "";
    const exp = transaction as ExpenseTransaction;
    if (exp.visibility === "personal" && exp.personalOwnerUserId) {
      const ownerName =
        members.find((m) => m.userId === exp.personalOwnerUserId)?.name?.split(" ")[0] ||
        "Membro";
      return `Só de ${ownerName}`;
    }
    if (exp.splitMode === "personal") {
      return "Gasto Pessoal";
    }
    const splitUids = exp.splitBetweenUserIds || [];
    if (splitUids.length === 1) {
      const targetName =
        members.find((m) => m.userId === splitUids[0])?.name?.split(" ")[0] || "Membro";
      return `100% de ${targetName}`;
    }
    if (splitUids.length > 1) {
      return "Dividido 50/50";
    }
    return formatSplitType(exp.splitType || "");
  };

  const subtitleSuffix = getSubtitleSuffix();

  return (
    <div
      onClick={
        isCarryOver && !isSettled ? () => handleQuickSettle(transaction) : undefined
      }
      className={`card animate-fade-in-up ${
        isCarryOver
          ? "bg-amber-500/5 border-amber-500/25 hover:border-amber-400/50 hover:bg-amber-500/10 cursor-pointer transition-all"
          : !isExpense
          ? "bg-violet-900/10 border-violet-800/30"
          : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isCarryOver
                  ? "bg-amber-400/15 border border-amber-400/30 text-amber-300"
                  : "bg-bg-elevated border border-border"
              }`}
            >
              {avatarInitial}
            </span>
            <p className="text-base font-semibold text-text-primary truncate">
              {transaction.description || (isExpense ? "Compra" : "Pix de Acerto")}
            </p>
            {isCarryOver && (
              <span className="text-[10px] bg-amber-400/15 text-amber-300 font-semibold rounded-full px-2 py-0.5 border border-amber-400/30">
                Saldo anterior
              </span>
            )}
            {isExpense && (transaction as ExpenseTransaction).currentInstallment && (
              <span className="text-[10px] bg-violet-900/40 text-violet-300 rounded-full px-2 py-0.5 border border-violet-700/30">
                Parcela {(transaction as ExpenseTransaction).currentInstallment}/
                {(transaction as ExpenseTransaction).installmentCount}
              </span>
            )}
          </div>

          <p className="text-xs text-text-muted mb-2">
            {formatDateBR(transaction.date)}
            {subtitleSuffix ? ` · ${subtitleSuffix}` : ""}
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-1">
            {isExpense ? (
              <ExpenseDetails
                transaction={transaction as ExpenseTransaction}
                members={members}
              />
            ) : (
              <SettlementDetails
                transaction={transaction as SettlementTransaction}
                members={members}
              />
            )}
          </div>
        </div>

        <div className="text-right shrink-0 flex flex-col items-end">
          <p
            className={`text-lg font-bold tabular-nums ${
              isCarryOver
                ? "text-amber-300"
                : !isExpense
                ? "text-violet-400"
                : "text-text-primary"
            }`}
          >
            {formatBRL(transaction.amount)}
          </p>

          <div className="flex items-center gap-1.5 mt-2 justify-end flex-wrap">
            {canQuickSettle && (
              isSettled ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent-green/15 border border-accent-green/30 text-[10px] font-bold text-accent-green">
                  ✓ Quitado
                </span>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickSettle(transaction);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-accent-green/15 hover:bg-accent-green/25 border border-accent-green/40 text-accent-green text-xs font-bold transition-all active:scale-95 shadow-sm"
                  title="Abrir Pix / Acerto com valor preenchido"
                >
                  <span>💸</span>
                  <span>{isCarryOver ? "Quitar saldo" : "Quitar"}</span>
                </button>
              )
            )}

            {showActions && !isCarryOver && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(transaction);
                  }}
                  className="text-xs text-text-muted hover:text-accent-blue transition-colors px-2 py-1 rounded-lg hover:bg-accent-blue/10"
                >
                  Editar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick();
                  }}
                  className="text-xs text-text-muted hover:text-accent-red hover:bg-accent-red/10 px-2 py-1 rounded-lg transition-colors"
                >
                  Excluir
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {isModalOpen &&
        createPortal(
          <div
            style={{ zIndex: 9999 }}
            className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in-up"
          >
            <div className="bg-bg-elevated p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-border">
              <h3 className="text-lg font-bold text-text-primary mb-2">
                Excluir despesa
              </h3>
              <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                {isExpense &&
                (transaction as ExpenseTransaction).groupId &&
                (transaction as ExpenseTransaction).installmentCount
                  ? `Atenção: Esta é uma compra parcelada. Ao confirmar, você excluirá TODAS as ${(transaction as ExpenseTransaction).installmentCount} parcelas de uma vez, removendo um total de ${formatBRL((transaction as ExpenseTransaction).originalAmount || transaction.amount * ((transaction as ExpenseTransaction).installmentCount || 1))} do histórico de todos os meses. Deseja continuar?`
                  : `Tem certeza que deseja excluir esta transação? O valor de ${formatBRL(transaction.amount)} será removido do histórico.`}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-text-primary bg-bg-card hover:bg-border rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-sm font-medium bg-accent-red/20 text-accent-red hover:bg-accent-red/30 rounded-xl transition-colors"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

// ─── Sub-componentes para exibir os detalhes ──────────────────────────────────

const ExpenseDetails: React.FC<{
  transaction: ExpenseTransaction;
  members: any[];
}> = ({ transaction, members }) => {
  const payerId = transaction.paidByUserId;
  const payer = members.find((m) => m.userId === payerId);
  const payerName = payer ? payer.name.split(" ")[0] : "Membro";

  const adminUid = resolveAdminUid(members);
  const paidByColor =
    adminUid && payerId === adminUid ? "text-accent-blue" : "text-accent-pink";

  if (transaction.visibility === "personal") {
    const ownerId = transaction.personalOwnerUserId || payerId;
    const owner = members.find((m) => m.userId === ownerId);
    const ownerName = owner ? owner.name.split(" ")[0] : payerName;

    return (
      <>
        <span className={`text-xs font-medium ${paidByColor}`}>
          Titular: {ownerName}
        </span>
        <span className="text-text-muted text-xs">·</span>
        <span className="text-xs font-medium text-violet-400">
          Fatura individual
        </span>
      </>
    );
  }

  const { debtorUid, debtAmount } = resolveExpenseDebtParties(
    transaction,
    members
  );
  const isNobodyOwes = debtAmount === 0;
  const debtor = debtorUid
    ? members.find((m) => m.userId === debtorUid)
    : undefined;
  const debtorName = debtor ? debtor.name.split(" ")[0] : "";

  const debtColor = isNobodyOwes ? "text-text-muted" : "text-accent-pink";
  const debtText = isNobodyOwes
    ? "Sem dívida"
    : debtorName
    ? `${debtorName} deve ${formatBRL(debtAmount)}`
    : `Dívida de ${formatBRL(debtAmount)}`;

  return (
    <>
      <span className={`text-xs font-medium ${paidByColor}`}>
        Pagou: {payerName}
      </span>
      <span className="text-text-muted text-xs">·</span>
      <span className={`text-xs font-medium ${debtColor}`}>{debtText}</span>
    </>
  );
};

const SettlementDetails: React.FC<{
  transaction: SettlementTransaction;
  members: any[];
}> = ({ transaction, members }) => {
  const effect = calculateSettlementEffect(transaction);

  const fromId = transaction.fromUserId;
  const sender = members.find((m) => m.userId === fromId);
  const senderName = sender ? sender.name.split(" ")[0] : "Membro";

  const adminUid = resolveAdminUid(members);
  const fromColor =
    adminUid && fromId === adminUid ? "text-accent-blue" : "text-accent-pink";
  const effectText =
    transaction.visibility === "personal"
      ? "Abateu fatura"
      : effect > 0
      ? "Reduziu dívida"
      : "Reduziu dívida";

  return (
    <>
      <span className={`text-xs font-medium ${fromColor}`}>
        Pagou: {senderName}
      </span>
      <span className="text-text-muted text-xs">·</span>
      <span className="text-xs font-medium text-violet-400">{effectText}</span>
    </>
  );
};
