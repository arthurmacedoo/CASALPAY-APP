import React, { useState } from "react";
import type { Transaction, ExpenseTransaction, SettlementTransaction } from "../types";
import { createPortal } from "react-dom";
import { formatBRL, formatDateBR, formatSplitType } from "../lib/formatters";
import { calculateExpenseDebt, calculateSettlementEffect, resolveAdminUid } from "../lib/calculations";
import { useGroupContext } from "../contexts/GroupContext";

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

  const { members } = useGroupContext();
  const isExpense = transaction.type === "expense";

  let avatarInitial = "💸";
  if (isExpense) {
    if (transaction.visibility === "personal" && transaction.personalOwnerUserId) {
      const owner = members.find(m => m.userId === transaction.personalOwnerUserId);
      avatarInitial = owner?.name.charAt(0).toUpperCase() || "👤";
    } else {
      const payerId = (transaction as ExpenseTransaction).paidByUserId;
      const payer = members.find(m => m.userId === payerId);
      if (payer) {
        avatarInitial = payer.name.charAt(0).toUpperCase();
      } else {
        avatarInitial = "👤";
      }
    }
  }

  return (
    <div className={`card animate-fade-in-up ${!isExpense ? 'bg-violet-900/10 border-violet-800/30' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-bold border border-border shrink-0">
              {avatarInitial}
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
            {isExpense && ` · ${
              transaction.visibility === "personal" && transaction.personalOwnerUserId
                ? `Só de ${members.find(m => m.userId === transaction.personalOwnerUserId)?.name?.split(' ')[0] || "Membro"}`
                : (transaction as ExpenseTransaction).splitMode === "personal"
                  ? "Gasto Pessoal"
                  : formatSplitType(transaction.splitType || "")
            }`}
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-1">
            {isExpense ? (
              <ExpenseDetails transaction={transaction as ExpenseTransaction} members={members} />
            ) : (
              <SettlementDetails transaction={transaction as SettlementTransaction} members={members} />
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

const ExpenseDetails: React.FC<{ transaction: ExpenseTransaction, members: any[] }> = ({ transaction, members }) => {
  const debt = calculateExpenseDebt(transaction, members);
  const isNobodyOwes = debt === 0;

  const payerId = transaction.paidByUserId;
  const payer = members.find(m => m.userId === payerId);
  const payerName = payer ? payer.name.split(' ')[0] : "Membro";

  const adminUid = resolveAdminUid(members);
  const paidByColor = (adminUid && payerId === adminUid) ? "text-accent-blue" : "text-accent-pink";
  const debtColor = isNobodyOwes ? "text-text-muted" : "text-accent-pink";
  
  const debtText = isNobodyOwes
    ? "Sem dívida"
    : `Dívida de ${formatBRL(Math.abs(debt))}`;

  return (
    <>
      <span className={`text-xs font-medium ${paidByColor}`}>
        Pagou: {payerName}
      </span>
      <span className="text-text-muted text-xs">·</span>
      <span className={`text-xs font-medium ${debtColor}`}>
        {debtText}
      </span>
    </>
  );
};

const SettlementDetails: React.FC<{ transaction: SettlementTransaction, members: any[] }> = ({ transaction, members }) => {
  const effect = calculateSettlementEffect(transaction);
  
  const fromId = transaction.fromUserId;
  const sender = members.find(m => m.userId === fromId);
  const senderName = sender ? sender.name.split(' ')[0] : "Membro";

  const adminUid = resolveAdminUid(members);
  const fromColor = (adminUid && fromId === adminUid) ? "text-accent-blue" : "text-accent-pink";
  const effectText = effect > 0 
    ? `Reduziu dívida` 
    : `Reduziu dívida`;

  return (
    <>
      <span className={`text-xs font-medium ${fromColor}`}>
        Enviou: {senderName}
      </span>
      <span className="text-text-muted text-xs">·</span>
      <span className="text-xs font-medium text-violet-400">
        {effectText}
      </span>
    </>
  );
};
