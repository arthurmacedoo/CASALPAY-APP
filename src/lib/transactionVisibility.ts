import type { Transaction, GroupMember } from "../types";

export function getCurrentMember(userId: string | undefined, members: GroupMember[]): GroupMember | null {
  if (!userId) return null;
  return members.find(m => m.userId === userId) || null;
}

export function isCurrentUserAdmin(userId: string | undefined, members: GroupMember[]): boolean {
  const member = getCurrentMember(userId, members);
  return member?.role === "admin";
}

export function getPersonalOwnerUserId(transaction: Transaction): string | undefined {
  if (transaction.visibility === "personal" && transaction.personalOwnerUserId) {
    return transaction.personalOwnerUserId;
  }
  return undefined;
}

export function isPersonalTransaction(transaction: Transaction): boolean {
  return getPersonalOwnerUserId(transaction) !== undefined;
}

export function isSharedTransaction(transaction: Transaction): boolean {
  // Se a transação possui um splitType indicando que é pessoal, NUNCA é compartilhada (sobrepõe visibility: shared errada)
  if (transaction.type === "expense") {
    const isPersonalSplit = ["100% owner", "100% partner", "100% Arthur", "100% Zara", "100% Namorada"].includes(transaction.splitType || "");
    if (isPersonalSplit) return false;
  }
  
  if (transaction.visibility === "shared") return true;
  
  if (transaction.type === "settlement" && transaction.pixDestination !== "zara_card") return true;
  
  return false;
}

export function isInvoiceTransactionForMember(transaction: Transaction, member: GroupMember | null): boolean {
  if (!member) return false;
  
  // Condição Oficial SaaS
  if (transaction.visibility === "personal" && transaction.personalOwnerUserId === member.userId) {
    return true;
  }
  
  // FALLBACK ESTRITO DADOS LEGADOS:
  // Usa o nome do membro (Gmail atual) para cruzar com a string literal do splitType antigo
  const name = member.name.toLowerCase();
  const isZara = name.includes("zara");
  const isArthur = name.includes("arthur") || name.includes("owner"); // owner como segurança
  
  if (transaction.type === "expense") {
    if (isZara && ["100% partner", "100% Zara", "100% Namorada"].includes(transaction.splitType || "")) return true;
    if (isArthur && ["100% owner", "100% Arthur"].includes(transaction.splitType || "")) return true;
  }
  
  if (transaction.type === "settlement") {
    if (isZara && transaction.pixDestination === "zara_card") return true;
  }
  
  return false;
}

export function calculatePersonalInvoiceTotal(
  transactions: Transaction[],
  member: GroupMember | null
): number {
  if (!member) return 0;
  
  const memberTransactions = transactions.filter(t => isInvoiceTransactionForMember(t, member));

  return memberTransactions.reduce((acc, t) => {
    if (t.type === "expense") return acc + t.amount;
    if (t.type === "settlement" && t.pixDestination === "zara_card") return acc - t.amount;
    return acc;
  }, 0);
}
