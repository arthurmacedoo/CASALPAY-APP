import type {
  Transaction,
  GroupMember,
  BalanceSummary,
  SettlementObligation,
  DirectDebt,
  ExpenseTransaction,
  SettlementTransaction,
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
  // Se for "Só de um", força a resolução para a pessoa dona do gasto (ignora lixo no array)
  if (t.splitMode === "personal") {
    if (t.personalOwnerUserId) return [t.personalOwnerUserId];
    const payerUid = resolvePaidByUid(t, adminUid, memberUid);
    return payerUid ? [payerUid] : [];
  }

  // Novo modelo de Rateio
  if (t.splitBetweenUserIds && t.splitBetweenUserIds.length > 0) {
    return t.splitBetweenUserIds;
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

// ─── Chave composta devedor/credor ────────────────────────────────────────────

function pairKey(debtorId: string, creditorId: string): string {
  return `${debtorId}::${creditorId}`;
}

/**
 * Converte o mapa de dívidas brutas por par em array tipado de DirectDebt,
 * fazendo NETTING entre pares opostos antes de retornar.
 *
 * Exemplo: se A→B = 4,37 e B→A = 25,00 → resultado: { B→A, 20,63 }
 * Isso evita exibir "Você deve a X" e "X te deve" simultaneamente.
 */
function buildDirectDebts(
  pairDebts: Record<string, number>
): DirectDebt[] {
  const result: DirectDebt[] = [];
  const processed = new Set<string>();

  for (const [key, rawAmount] of Object.entries(pairDebts)) {
    if (processed.has(key)) continue;

    const [debtorId, creditorId] = key.split("::");
    const reverseKey    = pairKey(creditorId, debtorId);
    const reverseAmount = pairDebts[reverseKey] ?? 0;

    // Marca ambas as direções como processadas
    processed.add(key);
    processed.add(reverseKey);

    const net = rawAmount - reverseAmount;

    if (net > 0) {
      // Direção original prevalece (debtorId → creditorId)
      result.push({ debtorId, creditorId, amount: net });
    } else if (net < 0) {
      // Direção inversa prevalece (creditorId → debtorId)
      result.push({ debtorId: creditorId, creditorId: debtorId, amount: -net });
    }
    // net === 0 → par está zerado, nada a exibir
  }

  return result;
}


// ─── Motor principal e Algoritmo de Dívidas ───────────────────────────────────

function computeOptimalSettlements(balances: Record<string, number>): SettlementObligation[] {
  const debtors: { uid: string; amount: number }[] = [];
  const creditors: { uid: string; amount: number }[] = [];

  for (const [uid, balance] of Object.entries(balances)) {
    if (balance < 0) debtors.push({ uid, amount: -balance });
    else if (balance > 0) creditors.push({ uid, amount: balance });
  }

  // Ordena do maior pro menor para minimizar transações
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const obligations: SettlementObligation[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    
    // Ignora pequenos resíduos de arredondamento (ex: 1 centavo)
    if (debtor.amount === 0) { d++; continue; }
    if (creditor.amount === 0) { c++; continue; }

    const settled = Math.min(debtor.amount, creditor.amount);
    
    obligations.push({
      fromUid: debtor.uid,
      toUid: creditor.uid,
      amount: settled
    });

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount === 0) d++;
    if (creditor.amount === 0) c++;
  }

  return obligations;
}

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
  // Rastreia dívidas brutas: chave = "debtorId::creditorId", valor em centavos.
  // Não faz otimização de rotas — preserva "X deve para Gabi" E "X deve para Miguel".
  const pairDebts:         Record<string, number> = {};

  let totalExpenses  = 0;
  let expenseCount   = 0;
  let settlementCount = 0;

  // Inicializa saldos para todos os membros
  for (const uid of allMemberUids) {
    memberBalances[uid] = 0;
  }

  // ── PASSO 1: todas as DESPESAS → popula pairDebts e memberBalances ───────────
  // Executado antes dos acertos para garantir que pairDebts está 100% construído
  // antes de qualquer subtração, independente da ordem date DESC das transações.
  for (const t of transactions) {
    if (t.visibility === "personal") continue;
    if (t.type !== "expense") continue;

    expenseCount++;
    totalExpenses += t.amount;

    const paidBy    = resolvePaidByUid(t, adminUid, memberUid);
    const splitUids = resolveSplitUids(t, adminUid, memberUid, allMemberUids);

    if (!paidBy || splitUids.length === 0) continue;

    addToMap(memberExpenses, paidBy, t.amount);
    addToMap(memberBalances, paidBy, t.amount);

    const sharePerMember = Math.floor(t.amount / splitUids.length);
    const remainder      = t.amount % splitUids.length;

    splitUids.forEach((uid, index) => {
      const share = index === 0 ? sharePerMember + remainder : sharePerMember;
      addToMap(memberBalances, uid, -share);

      // Dívida direta: uid deve "share" para paidBy
      if (uid !== paidBy) {
        addToMap(pairDebts, pairKey(uid, paidBy), share);
      }
    });
  }

  // ── PASSO 2: todos os ACERTOS → abate pairDebts e ajusta memberBalances ──────
  // Com pairDebts já totalmente populado, a subtração é sempre correta,
  // resolvendo o bug onde acertos mais recentes (date DESC) eram processados
  // antes das despesas e não encontravam a chave no mapa.
  for (const t of transactions) {
    if (t.visibility === "personal") continue;
    if (t.type !== "settlement") continue;
    if (t.pixDestination === "zara_card") continue;

    settlementCount++;

    const { fromUid, toUid } = resolveSettlementUids(t, adminUid, memberUid);
    if (!fromUid || !toUid) continue;

    addToMap(memberSettlements, fromUid, t.amount);
    addToMap(memberBalances, fromUid,  t.amount);  // débito reduzido
    addToMap(memberBalances, toUid,   -t.amount);  // crédito reduzido

    // Abate a dívida direta — usa ?? 0 para tolerar acertos sem despesa correspondente
    const key = pairKey(fromUid, toUid);
    pairDebts[key] = Math.max(0, (pairDebts[key] ?? 0) - t.amount);
  }

  // ── netBalance simplificado para grupos de 2 (mantém UX do BalanceCard) ──
  // Positivo = admin deve receber; Negativo = admin deve pagar.
  const netBalance = adminUid ? (memberBalances[adminUid] ?? 0) : 0;

  const obligations  = computeOptimalSettlements(memberBalances);
  const directDebts  = buildDirectDebts(pairDebts);

  return {
    memberExpenses,
    memberSettlements,
    memberBalances,
    totalExpenses,
    expenseCount,
    settlementCount,
    netBalance,
    adminUid,
    obligations,
    directDebts,
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
  if (balance.obligations.length === 0) {
    return `CasalPay — ${monthLabel}: Zerado! Nenhum Pix necessário ✅`;
  }

  let text = `CasalPay — ${monthLabel}:\n`;

  balance.obligations.forEach((obs) => {
    const fromName = members.find((m) => m.userId === obs.fromUid)?.name.split(' ')[0] ?? "Membro";
    const toName = members.find((m) => m.userId === obs.toUid)?.name.split(' ')[0] ?? "Membro";
    const amountStr = formatCentsToBRL(obs.amount);
    text += `💸 ${fromName} deve R$ ${amountStr} para ${toName}\n`;
  });

  return text.trim();
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
