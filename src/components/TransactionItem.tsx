import React, { useState } from "react";
import type { Transaction, ExpenseTransaction, SettlementTransaction } from "../types";
import { createPortal } from "react-dom";
import { formatBRL, formatDateBR, formatSplitType } from "../lib/formatters";
import { calculateExpenseDebt, calculateSettlementEffect } from "../lib/calculations";
import { OWNER_NAME, PARTNER_NAME, OWNER_EMOJI, PARTNER_EMOJI } from "../constants/couple";

interface TransactionItemProps {
  transaction: Transaction;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  showActions?: boolean;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onEdit,
  onDelete,
  showActions = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDeleteClick = () => {
    setIsModalOpen(true);
  };

  const handleConfirmDelete = () => {
    onDelete?.(transaction);
    setIsModalOpen(false);
  };

  const isExpense = transaction.type === "expense";

  return (
    <div className={`card animate-fade-in-up ${!isExpense ? 'bg-violet-900/10 border-violet-800/30' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-lg">
              {isExpense ? (transaction.paidBy === "owner" ? OWNER_EMOJI : PARTNER_EMOJI) : "💸"}
            </span>
            <p className="text-base font-semibold text-text-primary truncate">
              {transaction.description || (isExpense ? "Compra" : "Pix de Acerto")}
            </p>
            {isExpense && (transaction as ExpenseTransaction).currentInstallment && (
              <span className="text-[10px] bg-violet-900/40 text-violet-300 rounded-full px-2 py-0.5 border border-violet-700/30">
                Parcela {(transaction as ExpenseTransaction).currentInstallment}/{(transaction as ExpenseTransaction).installmentCount}
              </span>
            )}
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
              {!(isExpense && (transaction as ExpenseTransaction).groupId) && (
                <button
                  onClick={() => onEdit?.(transaction)}
                  className="text-xs text-text-muted hover:text-accent-blue transition-colors px-2 py-1 rounded-lg hover:bg-accent-blue/10"
                >
                  Editar
                </button>
              )}
              <button
                onClick={handleDeleteClick}
                className="text-xs text-text-muted hover:text-accent-red hover:bg-accent-red/10 px-2 py-1 rounded-lg transition-colors"
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && createPortal(
        <div style={{ zIndex: 9999 }} className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-bg-elevated p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-border">
            <h3 className="text-lg font-bold text-text-primary mb-2">Excluir despesa</h3>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              {isExpense && (transaction as ExpenseTransaction).groupId && (transaction as ExpenseTransaction).installmentCount
                ? `Atenção: Esta é uma compra parcelada. Ao confirmar, você excluirá TODAS as ${(transaction as ExpenseTransaction).installmentCount} parcelas de uma vez, removendo um total de ${formatBRL((transaction as ExpenseTransaction).originalAmount || (transaction.amount * ((transaction as ExpenseTransaction).installmentCount || 1)))} do histórico de todos os meses. Deseja continuar?`
                : `Tem certeza que deseja excluir esta transação? O valor de ${formatBRL(transaction.amount)} será removido do histórico.`
              }
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

const ExpenseDetails: React.FC<{ transaction: ExpenseTransaction }> = ({ transaction }) => {
  const debt = calculateExpenseDebt(transaction);
  const isNobodyOwes = debt === 0;
  const zaraOwes = debt > 0;

  const paidByColor = transaction.paidBy === "owner" ? "text-accent-blue" : "text-accent-pink";
  const debtColor = isNobodyOwes ? "text-text-muted" : zaraOwes ? "text-accent-pink" : "text-accent-blue";
  
  const debtText = isNobodyOwes
    ? "Sem dívida"
    : zaraOwes
    ? `${PARTNER_NAME} deve ${formatBRL(debt)}`
    : `${OWNER_NAME} deve ${formatBRL(Math.abs(debt))}`;

  return (
    <>
      <span className={`text-xs font-medium ${paidByColor}`}>
        Pagou: {transaction.paidBy === "owner" ? OWNER_NAME : PARTNER_NAME}
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
  
  const fromColor = transaction.from === "owner" ? "text-accent-blue" : "text-accent-pink";
  const effectText = effect > 0 
    ? `Reduziu dívida dela` 
    : `Reduziu dívida dele`;

  return (
    <>
      <span className={`text-xs font-medium ${fromColor}`}>
        Enviou: {transaction.from === "owner" ? OWNER_NAME : PARTNER_NAME}
      </span>
      <span className="text-text-muted text-xs">·</span>
      <span className="text-xs font-medium text-violet-400">
        {effectText}
      </span>
    </>
  );
};
