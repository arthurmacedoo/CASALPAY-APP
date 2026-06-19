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
 *
 * Regra unificada:
 * - Novo modelo: visibility === "shared"
 * - Legado: qualquer expense com splitType que não seja 100% pessoal,
 *   e qualquer settlement que não seja zara_card.
 *
 * Não usa nomes de pessoas — apenas campos de dados.
 */
export function isSharedTransaction(transaction: Transaction): boolean {
  // Novo modelo — visibilidade explícita
  if (transaction.visibility === "personal") return false;
  if (transaction.visibility === "shared") return true;

  // Legado — inferência por campos antigos (sem nomes hardcoded)
  if (transaction.type === "expense") {
    if (transaction.splitMode === "personal") return false;

    const legacyPersonalSplits: string[] = [
      "100% owner",
      "100% partner",
      "100% arthur",
      "100% zara",
      "100% namorada",
      "gasto pessoal",
    ];
    if (legacyPersonalSplits.includes((transaction.splitType || "").toLowerCase())) {
      return false;
    }
    return true;
  }

  if (transaction.type === "settlement") {
    // Legado: zara_card é pessoal
    if (transaction.pixDestination === "zara_card") return false;
    return true;
  }

  return false;
}

/**
 * Retorna true se a transação pertence à fatura pessoal do membro informado.
 *
 * Regra estritamente binária e baseada em UID:
 * - Novo modelo: visibility === "personal" && personalOwnerUserId === member.userId
 * - Legado (ponte de leitura): se o membro for admin, verifica splitTypes de "owner";
 *   se for member, verifica splitTypes de "partner" e pixDestination "zara_card".
 *   Isso garante retrocompatibilidade sem usar nomes hardcoded.
 */
export function isInvoiceTransactionForMember(
  transaction: Transaction,
  member: GroupMember | null
): boolean {
  if (!member) return false;

  // ── Novo modelo (SaaS) — regra binária por UID ────────────────────────────
  if (
    transaction.visibility === "personal" &&
    transaction.personalOwnerUserId === member.userId
  ) {
    return true;
  }

  // ── Ponte legada — sem uso de nomes, usa role como âncora ────────────────
  // "owner" mapeou historicamente para o admin do grupo.
  // "partner" mapeou historicamente para o membro não-admin.
  const isAdmin = member.role === "admin";

  if (transaction.type === "expense") {
    const splitType = (transaction.splitType || "").toLowerCase();
    const paidBy = (transaction.paidBy || "").toLowerCase();

    if (transaction.splitMode === "personal" && !transaction.personalOwnerUserId) {
        if (transaction.paidByUserId) return transaction.paidByUserId === member.userId;
        if (paidBy === "owner" || paidBy === "arthur") return isAdmin;
        if (paidBy === "partner" || paidBy === "zara" || paidBy === "namorada") return !isAdmin;
    }

    const adminSplits: string[] = ["100% owner", "100% arthur"];
    const memberSplits: string[] = [
      "100% partner",
      "100% zara",
      "100% namorada",
    ];

    if (
      isAdmin && 
      (adminSplits.includes(splitType) || 
      (splitType === "gasto pessoal" && (paidBy === "owner" || paidBy === "arthur")))
    ) return true;

    if (
      !isAdmin && 
      (memberSplits.includes(splitType) || 
      (splitType === "gasto pessoal" && (paidBy === "partner" || paidBy === "zara" || paidBy === "namorada")))
    ) return true;
  }

  if (transaction.type === "settlement") {
    // zara_card historicamente = fatura do membro não-admin
    if (!isAdmin && transaction.pixDestination === "zara_card") return true;
  }

  return false;
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
