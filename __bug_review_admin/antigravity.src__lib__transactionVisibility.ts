import type { Transaction, GroupMember } from "../types";

/**
 * Retorna o membro atual dado o userId.
 */
export function getCurrentMember(userId: string | undefined, members: GroupMember[]): GroupMember | null {
  if (!userId) return null;
  return members.find(m => m.userId === userId) || null;
}

/**
 * Retorna true se o usuário for admin.
 */
export function isCurrentUserAdmin(userId: string | undefined, members: GroupMember[]): boolean {
  const member = getCurrentMember(userId, members);
  return member?.role === "admin";
}

/**
 * Mapeia a role atual para o equivalente legado ("owner" ou "partner").
 */
export function getLegacyRoleForMember(member: GroupMember | null): "owner" | "partner" | null {
  if (!member) return null;
  if (member.role === "admin") return "owner";
  if (member.role === "member") return "partner";
  return null;
}

/**
 * Identifica o dono de uma transação pessoal.
 */
export function getPersonalOwnerUserId(transaction: Transaction, members: GroupMember[]): string | undefined {
  if (transaction.visibility === "personal" && transaction.personalOwnerUserId) {
    return transaction.personalOwnerUserId;
  }
  
  // Retrocompatibilidade
  const ownerMember = members.find(m => m.role === "admin");
  const partnerMember = members.find(m => m.role === "member");
  
  if (transaction.type === "expense") {
    if (transaction.splitType === "100% owner" && transaction.paidBy === "owner") return ownerMember?.userId;
    if (transaction.splitType === "100% partner" && transaction.paidBy === "partner") return partnerMember?.userId;
  } else if (transaction.type === "settlement") {
    if (transaction.pixDestination === "zara_card") return partnerMember?.userId;
  }
  
  return undefined;
}

/**
 * Verifica se a transação é pessoal de algum membro.
 */
export function isPersonalTransaction(transaction: Transaction, members: GroupMember[]): boolean {
  return getPersonalOwnerUserId(transaction, members) !== undefined;
}

/**
 * Retorna true se a transação for compartilhada (Nossos Gastos).
 * A regra é forte: Nossos Gastos nunca deve incluir faturas pessoais.
 */
export function isSharedTransaction(transaction: Transaction, members: GroupMember[]): boolean {
  if (transaction.visibility === "shared") return true;
  if (transaction.visibility === "personal") return false;
  
  // Retrocompatibilidade: Se cair nos filtros de legado como pessoal, então NÃO é compartilhada.
  if (isPersonalTransaction(transaction, members)) return false;

  return true;
}

/**
 * Verifica se a transação pertence à fatura específica de um membro.
 */
export function isInvoiceTransactionForMember(transaction: Transaction, member: GroupMember | null, _members: GroupMember[]): boolean {
  if (!member) return false;

  // Dados novos
  if (transaction.visibility === "personal" && transaction.personalOwnerUserId === member.userId) {
    return true;
  }

  // Retrocompatibilidade
  const legacyRole = getLegacyRoleForMember(member);
  if (legacyRole === "partner") {
    if (transaction.type === "settlement" && transaction.pixDestination === "zara_card") return true;
    if (transaction.type === "expense" && transaction.splitType === "100% partner" && transaction.paidBy === "partner") return true;
  } else if (legacyRole === "owner") {
    if (transaction.type === "expense" && transaction.splitType === "100% owner" && transaction.paidBy === "owner") return true;
  }

  return false;
}

/**
 * Calcula o saldo total da fatura pessoal do membro selecionado.
 */
export function calculatePersonalInvoiceTotal(
  transactions: Transaction[],
  member: GroupMember | null,
  members: GroupMember[]
): number {
  if (!member) return 0;
  
  const memberTransactions = transactions.filter(t => isInvoiceTransactionForMember(t, member, members));
  const legacyRole = getLegacyRoleForMember(member);

  return memberTransactions.reduce((acc, t) => {
    if (t.type === "expense") return acc + t.amount;
    
    if (t.type === "settlement") {
      // Regra de legado: "partner" (Zara) paga pro "owner" (Arthur) para abater a fatura do "partner" (Zara).
      // Arthur envia pro Partner?
      if (legacyRole === "partner") {
        if (t.from === "partner") return acc - t.amount;
        if (t.from === "owner") return acc + t.amount;
      } else if (legacyRole === "owner") {
        if (t.from === "owner") return acc - t.amount;
        if (t.from === "partner") return acc + t.amount;
      }
    }
    return acc;
  }, 0);
}
