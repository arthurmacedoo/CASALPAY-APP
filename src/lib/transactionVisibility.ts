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

/**
 * Retorna um Set com os IDs de despesas que já foram diretamente quitadas por um acerto.
 */
export function getSettledExpenseIds(transactions: Transaction[]): Set<string> {
  const settledIds = new Set<string>();
  for (const t of transactions) {
    if (t.type === "settlement" && t.settledExpenseId) {
      settledIds.add(t.settledExpenseId);
    }
  }
  return settledIds;
}

/**
 * Reconcilia as linhas de `carryOver` (Saldo Anterior) para exibição nas listas (Home, Histórico e Busca):
 * - Quando o usuário realiza um pagamento de fatura ou acerto Pix no mês, o valor pago
 *   abate primeiro o Saldo Anterior daquele mês.
 * - Se o Saldo Anterior já foi 100% coberto pelos pagamentos do mês (ou quitado diretamente),
 *   a linha de `carryOver` desaparece automaticamente da lista e do histórico visual,
 *   enquanto o documento bruto continua preservado para manter o saldo contábil líquido exato.
 * - Se foi pago parcialmente, exibe apenas o saldo restante a pagar.
 */
export function reconcileCarryOverForDisplay(transactions: Transaction[]): Transaction[] {
  const settledDirectIds = getSettledExpenseIds(transactions);

  // Agrupa os pools de pagamento por mês para abater os carryOvers correspondentes
  // Chave para fatura pessoal: `${monthKey}_personal_${ownerId}`
  // Chave para gasto compartilhado: `${monthKey}_shared_${debtorId}_${creditorId}`
  const paymentPools = new Map<string, number>();

  for (const t of transactions) {
    if (t.type !== "settlement" || t.carryOver) continue;
    // Se este settlement quitou uma compra normal específica (que não é carryOver),
    // não usamos seu valor no pool genérico de abatimento do saldo anterior
    if (t.settledExpenseId && !t.settledExpenseId.startsWith("carry_")) {
      continue;
    }

    const mKey = t.monthKey || t.date.slice(0, 7);
    if (t.visibility === "personal") {
      const ownerId = t.personalOwnerUserId || t.fromUserId || t.toUserId;
      if (ownerId) {
        const poolKey = `${mKey}_personal_${ownerId}`;
        paymentPools.set(poolKey, (paymentPools.get(poolKey) ?? 0) + t.amount);
      }
    } else {
      const fromId = t.fromUserId;
      const toId = t.toUserId;
      if (fromId && toId) {
        const poolKey = `${mKey}_shared_${fromId}_${toId}`;
        paymentPools.set(poolKey, (paymentPools.get(poolKey) ?? 0) + t.amount);
      }
    }
  }

  const result: Transaction[] = [];

  for (const t of transactions) {
    if (!t.carryOver || t.type !== "expense") {
      result.push(t);
      continue;
    }

    // Se foi quitado diretamente pelo ID
    if (settledDirectIds.has(t.id)) {
      continue;
    }

    const mKey = t.monthKey || t.date.slice(0, 7);
    let poolKey = "";
    if (t.visibility === "personal") {
      const ownerId = t.personalOwnerUserId || t.paidByUserId;
      if (ownerId) poolKey = `${mKey}_personal_${ownerId}`;
    } else {
      const debtorId = t.personalOwnerUserId || t.splitBetweenUserIds?.[0];
      const creditorId = t.paidByUserId;
      if (debtorId && creditorId) poolKey = `${mKey}_shared_${debtorId}_${creditorId}`;
    }

    const availablePool = poolKey ? (paymentPools.get(poolKey) ?? 0) : 0;
    if (availablePool >= t.amount) {
      // 100% quitado! Consome do pool e oculta a mensagem de saldo anterior da lista
      paymentPools.set(poolKey, availablePool - t.amount);
      continue;
    } else if (availablePool > 0) {
      // Parcialmente quitado: exibe apenas o residual pendente
      paymentPools.set(poolKey, 0);
      result.push({
        ...t,
        amount: t.amount - availablePool,
      });
    } else {
      result.push(t);
    }
  }

  return result;
}
