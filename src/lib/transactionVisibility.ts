import type { Transaction, GroupMember } from "../types";

// ─── Helpers de membro ────────────────────────────────────────────────────────

export function getCurrentMember(
  userId: string | undefined,
  members: GroupMember[]
): GroupMember | null {
  if (!userId) return null;
  return members.find((m) => m.userId === userId) ?? null;
}

export function isCurrentUserAdmin(
  userId: string | undefined,
  members: GroupMember[]
): boolean {
  return getCurrentMember(userId, members)?.role === "admin";
}

// ─── Classificação de transações ──────────────────────────────────────────────

/**
 * Retorna true se a transação for compartilhada (aba "Nossos Gastos").
 */
export function isSharedTransaction(transaction: Transaction): boolean {
  return transaction.visibility === "shared";
}

/**
 * Retorna true se a transação pertence à fatura pessoal do membro informado.
 */
export function isInvoiceTransactionForMember(
  transaction: Transaction,
  member: GroupMember | null
): boolean {
  if (!member) return false;
  if (transaction.visibility !== "personal") return false;

  // Documentos antigos podem ter sido confirmados sem o dono explícito.
  // Nesse caso, preserve a visibilidade histórica pelo UID de quem pagou;
  // quando o dono estiver gravado, ele continua sendo a fonte de verdade.
  return (
    transaction.personalOwnerUserId === member.userId ||
    (!transaction.personalOwnerUserId &&
      transaction.type === "expense" &&
      transaction.paidByUserId === member.userId)
  );
}

/**
 * Calcula o total da fatura pessoal de um membro.
 * Soma despesas pessoais e subtrai acertos pessoais (abatimentos de fatura).
 */
export function calculatePersonalInvoiceTotal(
  transactions: Transaction[],
  member: GroupMember | null
): number {
  if (!member) return 0;

  return transactions
    .filter((t) => isInvoiceTransactionForMember(t, member))
    .reduce((acc, t) => {
      if (t.type === "expense") return acc + t.amount;
      // Acerto pessoal abate a fatura
      if (t.type === "settlement") return acc - t.amount;
      return acc;
    }, 0);
}
