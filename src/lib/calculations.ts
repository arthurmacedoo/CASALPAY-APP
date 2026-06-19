import type {
  BalanceSummary,
  ExpenseTransaction,
  SettlementTransaction,
  Transaction,
  GroupMember,
} from "../types";

// ─── Runtime Mapping (Opção B) ────────────────────────────────────────────────
//
// Para transações históricas que não têm paidByUserId/fromUserId,
// usa group.createdBy como âncora determinística:
//   - "owner" → adminUid (criador do grupo)
//   - "partner" → uid do outro membro (não-admin)
//
// Isso garante que o saldo histórico inteiro seja preservado.

export function resolveAdminUid(members: GroupMember[]): string | null {
  return members.find((m) => m.role === "admin")?.userId ?? null;
}

export function resolveMemberUid(members: GroupMember[]): string | null {
  return members.find((m) => m.role === "member")?.userId ?? null;
}

/**
 * Resolve o UID de quem pagou a despesa.
 * Prioriza o campo novo (paidByUserId); cai no mapeamento legado via role.
 */
export function resolvePaidByUid(
  t: ExpenseTransaction,
  adminUid: string | null,
  memberUid: string | null
): string | null {
  if (t.paidByUserId) return t.paidByUserId;
  // Fallback para o legado
  const pb = (t.paidBy || "").toLowerCase();
  if (pb === "owner" || pb === "arthur") return adminUid;
  if (pb === "partner" || pb === "zara" || pb === "namorada") return memberUid;
  return null;
}

/**
 * Resolve os UIDs entre quem a despesa é dividida.
 * Prioriza splitBetweenUserIds; cai no mapeamento legado via splitType.
 */
export function resolveSplitUids(
  t: ExpenseTransaction,
  adminUid: string | null,
  memberUid: string | null,
  allMemberUids: string[]
): string[] {
  // Novo modelo
  if (t.splitBetweenUserIds && t.splitBetweenUserIds.length > 0) {
    return t.splitBetweenUserIds;
  }

  if (t.splitMode === "personal") {
    if (t.personalOwnerUserId) return [t.personalOwnerUserId];
    const payerUid = resolvePaidByUid(t, adminUid, memberUid);
    return payerUid ? [payerUid] : [];
  }

  // Legado: mapeamento via splitType
  const personalAdminSplits = ["100% owner", "100% arthur"];
  const personalMemberSplits = ["100% partner", "100% zara", "100% namorada"];

  const splitType = (t.splitType || "").toLowerCase();
  const paidBy = (t.paidBy || "").toLowerCase();

  if (
    personalAdminSplits.includes(splitType) || 
    (splitType === "gasto pessoal" && (paidBy === "owner" || paidBy === "arthur"))
  ) {
    return adminUid ? [adminUid] : [];
  }
  if (
    personalMemberSplits.includes(splitType) || 
    (splitType === "gasto pessoal" && (paidBy === "partner" || paidBy === "zara" || paidBy === "namorada"))
  ) {
    return memberUid ? [memberUid] : [];
  }

  // "50/50" ou sem splitType → divide entre todos
  return allMemberUids;
}

/**
 * Resolve os UIDs de from/to em acertos.
 * Prioriza fromUserId/toUserId; cai no mapeamento legado.
 */
export function resolveSettlementUids(
  t: SettlementTransaction,
  adminUid: string | null,
  memberUid: string | null
): { fromUid: string | null; toUid: string | null } {
  // Novo modelo
  if (t.fromUserId && t.toUserId) {
    return { fromUid: t.fromUserId, toUid: t.toUserId };
  }

  // Legado: from/to via Person
  const fromUid = t.from === "owner" ? adminUid : t.from === "partner" ? memberUid : null;
  const toUid   = t.to   === "owner" ? adminUid : t.to   === "partner" ? memberUid : null;
  return { fromUid, toUid };
}

// ─── Incremento seguro de mapa ────────────────────────────────────────────────

function addToMap(map: Record<string, number>, uid: string, value: number): void {
  map[uid] = (map[uid] ?? 0) + value;
}

// ─── Motor principal ──────────────────────────────────────────────────────────

/**
 * Calcula o resumo financeiro do mês de forma 100% dinâmica por UID.
 *
 * Suporta tanto transações novas (paidByUserId / fromUserId) quanto legadas
 * (paidBy: "owner"/"partner") via Runtime Mapping usando group.createdBy
 * como âncora determinística (Opção B).
 *
 * @param transactions  Lista de transações do mês (já filtradas: apenas "shared")
 * @param members       Membros do grupo ativo
 */
export function calculateBalance(
  transactions: Transaction[],
  members: GroupMember[]
): BalanceSummary {
  const adminUid  = resolveAdminUid(members);
  const memberUid = resolveMemberUid(members);
  const allMemberUids = members.map((m) => m.userId);

  const memberExpenses:    Record<string, number> = {};
  const memberSettlements: Record<string, number> = {};
  const memberBalances:    Record<string, number> = {};

  let totalExpenses  = 0;
  let expenseCount   = 0;
  let settlementCount = 0;

  // Inicializa saldos para todos os membros
  for (const uid of allMemberUids) {
    memberBalances[uid] = 0;
  }

  for (const t of transactions) {
    // Exclui acertos de fatura pessoal do cálculo compartilhado
    if (t.type === "settlement" && t.pixDestination === "zara_card") continue;
    if (t.visibility === "personal") continue;

    if (t.type === "expense") {
      expenseCount++;
      totalExpenses += t.amount;

      const paidBy   = resolvePaidByUid(t, adminUid, memberUid);
      const splitUids = resolveSplitUids(t, adminUid, memberUid, allMemberUids);

      if (!paidBy || splitUids.length === 0) continue;

      // Quem pagou recebe crédito integral
      addToMap(memberExpenses, paidBy, t.amount);
      addToMap(memberBalances, paidBy, t.amount);

      // Cada membro que divide arca com sua cota
      const sharePerMember = Math.floor(t.amount / splitUids.length);
      const remainder = t.amount % splitUids.length;

      splitUids.forEach((uid, index) => {
        // O primeiro da lista absorve o centavo de arredondamento
        const share = index === 0 ? sharePerMember + remainder : sharePerMember;
        addToMap(memberBalances, uid, -share);
      });
    }

    if (t.type === "settlement") {
      settlementCount++;

      const { fromUid, toUid } = resolveSettlementUids(t, adminUid, memberUid);
      if (!fromUid || !toUid) continue;

      addToMap(memberSettlements, fromUid, t.amount);
      // Quem pagou tem seu débito reduzido
      addToMap(memberBalances, fromUid, t.amount);
      // Quem recebeu tem seu crédito reduzido
      addToMap(memberBalances, toUid, -t.amount);
    }
  }

  // ── netBalance simplificado para grupos de 2 (mantém UX do BalanceCard) ──
  // Positivo = admin deve receber; Negativo = admin deve pagar.
  const netBalance = adminUid ? (memberBalances[adminUid] ?? 0) : 0;

  return {
    memberExpenses,
    memberSettlements,
    memberBalances,
    totalExpenses,
    expenseCount,
    settlementCount,
    netBalance,
    adminUid,
  };
}

// ─── Funções auxiliares ───────────────────────────────────────────────────────

/**
 * Gera o texto de resumo do Pix para copiar, usando nomes reais dos membros.
 * Genérico: funciona com qualquer número de membros.
 */
export function generatePixSummary(
  balance: BalanceSummary,
  monthLabel: string,
  members: GroupMember[]
): string {
  if (balance.netBalance === 0) {
    return `CasalPay — ${monthLabel}: Zerado! Nenhum Pix necessário ✅`;
  }

  const abs = formatCentsToBRL(Math.abs(balance.netBalance));
  const adminMember = members.find((m) => m.userId === balance.adminUid);
  const otherMember = members.find((m) => m.userId !== balance.adminUid);

  const adminName = adminMember?.name ?? "Admin";
  const otherName = otherMember?.name ?? "Parceiro(a)";

  if (balance.netBalance > 0) {
    // Admin deve receber → o outro deve ao admin
    return `CasalPay — ${monthLabel}: ${otherName} deve R$ ${abs} para ${adminName} 💙`;
  }
  // Admin deve pagar → admin deve ao outro
  return `CasalPay — ${monthLabel}: ${adminName} deve R$ ${abs} para ${otherName} 🩷`;
}

function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export function getMonthKey(date: string): string {
  return date.slice(0, 7);
}

// ─── Helpers de UI (TransactionItem) ──────────────────────────────────────────

export function calculateExpenseDebt(t: ExpenseTransaction, members: GroupMember[]): number {
  const adminUid = resolveAdminUid(members);
  const memberUid = resolveMemberUid(members);
  const allMemberUids = members.map(m => m.userId);
  const splitUids = resolveSplitUids(t, adminUid, memberUid, allMemberUids);
  
  // Se a despesa for dividida entre mais de 1 pessoa, retornamos a cota que cabe a cada "outro" membro.
  // (Este valor é usado visualmente para mostrar a dívida gerada pela transação).
  if (splitUids.length <= 1) return 0;
  return Math.floor(t.amount / splitUids.length);
}

export function calculateSettlementEffect(t: SettlementTransaction): number {
  return t.amount;
}
