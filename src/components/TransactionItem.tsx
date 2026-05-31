import React, { useState } from "react";
import type { Transaction, ExpenseTransaction, SettlementTransaction } from "../types";
import { formatBRL, formatDateBR, formatSplitType } from "../lib/formatters";
import { calculateExpenseDebt, calculateSettlementEffect } from "../lib/calculations";
import { OWNER_NAME, PARTNER_NAME, OWNER_EMOJI, PARTNER_EMOJI } from "../constants/couple";

interface TransactionItemProps {
  transaction: Transaction;
  onEdit?: (t: Transaction) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onEdit,
  onDelete,
  showActions = false,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDeleteClick = () => {
    if (showConfirmDelete) {
      onDelete?.(transaction.id);
      setShowConfirmDelete(false);
    } else {
      setShowConfirmDelete(true);
      setTimeout(() => setShowConfirmDelete(false), 3000);
    }
  };

  const isExpense = transaction.type === "expense";

  return (
    <div className={`card animate-fade-in-up ${!isExpense ? 'bg-violet-900/10 border-violet-800/30' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">
              {isExpense ? (transaction.paidBy === OWNER_NAME ? OWNER_EMOJI : PARTNER_EMOJI) : "💸"}
            </span>
            <p className="text-base font-semibold text-text-primary truncate">
              {transaction.description || (isExpense ? "Compra" : "Pix de Acerto")}
            </p>
          </div>
          
          <p className="text-xs text-text-muted mb-2">
            {formatDateBR(transaction.date)}
            {isExpense && ` · ${formatSplitType(transaction.splitType)}`}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {isExpense ? (
              <ExpenseDetails transaction={transaction as ExpenseTransaction} />
            ) : (
              <SettlementDetails transaction={transaction as SettlementTransaction} />
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className={`text-lg font-bold tabular-nums ${!isExpense ? 'text-violet-400' : 'text-text-primary'}`}>
            {formatBRL(transaction.amount)}
          </p>
          {showActions && (
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => onEdit?.(transaction)}
                className="text-xs text-text-muted hover:text-accent-blue transition-colors px-2 py-1 rounded-lg hover:bg-accent-blue/10"
              >
                Editar
              </button>
              <button
                onClick={handleDeleteClick}
                className={`text-xs px-2 py-1 rounded-lg transition-all ${
                  showConfirmDelete
                    ? "bg-accent-red/20 text-accent-red border border-accent-red"
                    : "text-text-muted hover:text-accent-red hover:bg-accent-red/10"
                }`}
              >
                {showConfirmDelete ? "Confirmar" : "Excluir"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-componentes para exibir os detalhes ──────────────────────────────────

const ExpenseDetails: React.FC<{ transaction: ExpenseTransaction }> = ({ transaction }) => {
  const debt = calculateExpenseDebt(transaction);
  const isNobodyOwes = debt === 0;
  const zaraOwes = debt > 0;

  const paidByColor = transaction.paidBy === OWNER_NAME ? "text-accent-blue" : "text-accent-pink";
  const debtColor = isNobodyOwes ? "text-text-muted" : zaraOwes ? "text-accent-pink" : "text-accent-blue";
  
  const debtText = isNobodyOwes
    ? "Sem dívida"
    : zaraOwes
    ? `${PARTNER_NAME} deve ${formatBRL(debt)}`
    : `${OWNER_NAME} deve ${formatBRL(Math.abs(debt))}`;

  return (
    <>
      <span className={`text-xs font-medium ${paidByColor}`}>
        Pagou: {transaction.paidBy}
      </span>
      <span className="text-text-muted text-xs">·</span>
      <span className={`text-xs font-medium ${debtColor}`}>
        {debtText}
      </span>
    </>
  );
};

const SettlementDetails: React.FC<{ transaction: SettlementTransaction }> = ({ transaction }) => {
  const effect = calculateSettlementEffect(transaction);
  // effect positivo = reduz dívida da Zara
  // effect negativo = reduz dívida do Arthur
  
  const fromColor = transaction.from === OWNER_NAME ? "text-accent-blue" : "text-accent-pink";
  const effectText = effect > 0 
    ? `Reduziu dívida dela` 
    : `Reduziu dívida dele`;

  return (
    <>
      <span className={`text-xs font-medium ${fromColor}`}>
        Enviou: {transaction.from}
      </span>
      <span className="text-text-muted text-xs">·</span>
      <span className="text-xs font-medium text-violet-400">
        {effectText}
      </span>
    </>
  );
};
