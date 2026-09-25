# CasalPay — Código-Fonte Essencial & Modelos de Dados 💻📄

Este documento reúne os arquivos estruturais, cálculos financeiros, regras de segurança e integração do CasalPay.

## 📄 Arquivo: `src/types/index.ts`

```ts
import type { Timestamp } from "firebase/firestore";

// ─── Grupo (arquitetura definitiva: groups/{groupId}) ──────────────────────────

export type GroupRole = "admin" | "member";
export type GroupMemberStatus = "active" | "invited" | "inactive";

export interface GroupMember {
  userId: string;
  name: string;
  email: string;
  role: GroupRole;
  joinedAt: Timestamp;
  status: GroupMemberStatus;
}

export interface Group {
  id: string;                      // Document ID = groupId
  name: string;                    // "Grupo Arthur e Zara"
  createdBy: string;               // uid do criador (âncora para runtime mapping legado)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** IDs de todos os membros (usado para query array-contains) */
  memberIds: string[];
}

/** Estado do contexto de grupo ativo. */
export interface ActiveGroupState {
  group: Group | null;
  members: GroupMember[];
  loading: boolean;
  error: string | null;
  currentMember: GroupMember | null;
  currentUserRole: GroupRole | undefined;
  isCurrentUserAdmin: boolean;
}

/** Perfil do usuário em users/{userId}. */
export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  activeGroupId: string | null;
  defaultGroupId: string | null;
  updatedAt: Timestamp;
}

// ─── Campos legados (somente leitura do Firestore — nunca escrever) ───────────
// Mantidos como opcionais para não quebrar documentos históricos.

/** @deprecated Legado — use paidByUserId */
export type LegacyPerson = "owner" | "partner";

/** @deprecated Legado — use splitMode + splitBetweenUserIds */
export type LegacySplitType =
  | "50/50"
  | "100% owner"
  | "100% partner"
  | "100% Arthur"
  | "100% Zara"
  | "100% Namorada"
  | "Gasto Pessoal"
  | string; // Permitir fallback de strings de banco de dados legadas

// ─── Modo de divisão (novo) ───────────────────────────────────────────────────

/** Modo de divisão da despesa:
 * - "equal"    → dividido igualmente entre splitBetweenUserIds
 * - "personal" → 100% de um único membro (personalOwnerUserId obrigatório)
 */
export type SplitMode = "equal" | "personal";

// ─── Transação de despesa real ────────────────────────────────────────────────

export interface ExpenseTransaction {
  id: string;
  type: "expense";
  description: string;
  /** Valor em centavos (nunca ponto flutuante) */
  amount: number;
  date: string;     // "2026-05-30"
  monthKey: string; // "2026-05"
  coupleId: string; // = groupId (mantido para compatibilidade de queries)
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // ── Novo modelo (SaaS unificado) ──────────────────────────────────────────
  /** UID de quem passou o cartão / pagou */
  paidByUserId?: string;
  /** UIDs entre quem a despesa é dividida */
  splitBetweenUserIds?: string[];
  /** Modo de divisão */
  splitMode?: SplitMode;

  // ── Fatura pessoal ───────────────────────────────────────────────────────
  /** Visibilidade: shared = nossos gastos; personal = minha fatura */
  visibility?: "shared" | "personal";
  /** UID do dono da fatura pessoal (obrigatório quando visibility = "personal") */
  personalOwnerUserId?: string;

  // ── Parcelamento ─────────────────────────────────────────────────────────
  installmentCount?: number;
  currentInstallment?: number;
  groupId?: string;        // ID do grupo de parcelas (não confundir com groupId do grupo)
  originalAmount?: number;

  // ── Status do ciclo de vida ───────────────────────────────────────────────
  status?: "pending" | "confirmed";

  // ── Campos legados (read-only) ────────────────────────────────────────────
  /** @deprecated use paidByUserId */
  paidBy?: LegacyPerson;
  /** @deprecated use splitMode + splitBetweenUserIds */
  splitType?: LegacySplitType;
}

// ─── Transação de acerto / Pix ────────────────────────────────────────────────

export interface SettlementTransaction {
  id: string;
  type: "settlement";
  description: string;
  /** Valor em centavos */
  amount: number;
  date: string;
  monthKey: string;
  coupleId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // ── Novo modelo (SaaS unificado) ──────────────────────────────────────────
  /** UID de quem enviou o Pix */
  fromUserId?: string;
  /** UID de quem recebeu */
  toUserId?: string;

  // ── Fatura pessoal ───────────────────────────────────────────────────────
  /** Visibilidade: shared = nossos gastos; personal = minha fatura */
  visibility?: "shared" | "personal";
  /** UID do dono da fatura pessoal */
  personalOwnerUserId?: string;

  // ── Status do ciclo de vida ───────────────────────────────────────────────
  status?: "pending" | "confirmed";

  // ── Campos legados (read-only) ────────────────────────────────────────────
  /** @deprecated use fromUserId */
  from?: LegacyPerson;
  /** @deprecated use toUserId */
  to?: LegacyPerson;
  /** @deprecated use visibility + personalOwnerUserId */
  pixDestination?: "shared" | "zara_card";
}

// ─── Union type geral ─────────────────────────────────────────────────────────

export type Transaction = ExpenseTransaction | SettlementTransaction;

// ─── Form data (strings para inputs, convertidos para centavos na submissão) ──

export interface ExpenseFormData {
  type: "expense";
  description: string;
  amount: string;
  date: string;
  /** UID de quem pagou */
  paidByUserId: string;
  /** UIDs entre quem dividir (vazio = todos os membros do grupo) */
  splitBetweenUserIds: string[];
  /** Modo de divisão */
  splitMode: SplitMode;
  /** UID do dono da fatura pessoal (obrigatório quando splitMode = "personal") */
  personalOwnerUserId: string | null;
  isInstallment?: boolean;
  installmentCount?: number;
}

export interface SettlementFormData {
  type: "settlement";
  description: string;
  amount: string;
  date: string;
  /** UID de quem enviou o Pix */
  fromUserId: string;
  /** UID de quem recebeu */
  toUserId: string;
  /** Se o acerto é para abater fatura pessoal de alguém */
  isPersonalInvoice: boolean;
  /** UID do dono da fatura (obrigatório quando isPersonalInvoice = true) */
  personalOwnerUserId: string | null;
}

export type TransactionFormData = ExpenseFormData | SettlementFormData;

// ─── Resumo financeiro dinâmico do mês ───────────────────────────────────────

export interface SettlementObligation {
  fromUid: string;
  toUid: string;
  amount: number;
}

/**
 * Despesa individual que compõe uma dívida direta.
 * Todos os valores monetários em centavos (inteiros).
 */
export interface DebtSource {
  /** ID do documento da despesa no Firestore */
  expenseId:   string;
  /** Descrição da despesa (ex: "Mercado", "Uber") */
  description: string;
  /** Data no formato "YYYY-MM-DD" */
  date:        string;
  /** Valor total da despesa em centavos */
  totalAmount: number;
  /** Cota do devedor nesta despesa em centavos */
  yourShare:   number;
  /** Nome de quem pagou (resolvido via Map O(1) em calculateBalance) */
  paidByName:  string;
  /** Quantas pessoas dividiram */
  splitCount:  number;
}

/**
 * Acerto (Pix) que já abateu parte de uma dívida direta.
 * Valor em centavos.
 */
export interface DebtSettlement {
  settlementId: string;
  /** Valor do acerto em centavos */
  amount:       number;
  /** Data no formato "YYYY-MM-DD" */
  date:         string;
}

/**
 * Dívida direta entre um par (devedor → credor), SEM otimização de rotas.
 * Carrega rastreabilidade completa para o DebtDetailSheet.
 */
export interface DirectDebt {
  debtorId:    string;
  creditorId:  string;
  /** Valor líquido após netting e acertos (centavos) */
  amount:      number;
  /** Valor bruto das despesas antes de acertos (centavos) */
  rawAmount:   number;
  /** Despesas que geraram esta dívida */
  sources:     DebtSource[];
  /** Acertos que já abateram esta dívida */
  settlements: DebtSettlement[];
  /** Despesas em sentido contrário que geraram compensação mútua (abatimento) */
  nettingSources?: DebtSource[];
}

export interface BalanceSummary {
  /** Total de despesas pagas por cada membro. Chave = userId */
  memberExpenses: Record<string, number>;
  /** Total de acertos enviados por cada membro. Chave = userId */
  memberSettlements: Record<string, number>;
  /** Saldo líquido por membro (positivo = deve receber; negativo = deve pagar). Chave = userId */
  memberBalances: Record<string, number>;
  /** Soma total de todas as despesas do mês */
  totalExpenses: number;
  /** Número de despesas */
  expenseCount: number;
  /** Número de acertos */
  settlementCount: number;
  /**
   * Saldo líquido simplificado para grupos de 2 membros.
   * Positivo = adminUid deve receber; Negativo = adminUid deve pagar.
   * Usado pelo BalanceCard para manter a UX atual sem refatorar o componente.
   */
  netBalance: number;
  /** UID do admin do grupo (âncora do sinal do netBalance) */
  adminUid: string | null;
  /** Lista de transferências otimizadas para zerar as dívidas do grupo (mínimo de Pix) */
  obligations: SettlementObligation[];
  /**
   * Dívidas brutas por par (devedor → credor), sem otimização de rotas.
   * Usadas para exibição direta no BalanceCard: garante que "X deve para Gabi"
   * e "X deve para Miguel" apareçam como linhas separadas.
   */
  directDebts: DirectDebt[];
}

// ─── Metas & Investimentos do Casal (Aba Metas) ──────────────────────────────

export type ContributorType = "arthur" | "zara" | "split";

export interface Goal {
  id: string;
  groupId: string;
  title: string;
  category: string;
  emoji: string;
  targetAmount: number;   // em centavos
  currentAmount: number;  // em centavos
  deadline?: string;      // YYYY-MM
  status: "in_progress" | "completed";
  contributionsByMember: Record<string, number>; // { [userId]: totalEmCentavos }
  createdAt: string;
  updatedAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number; // em centavos
  contributorType: ContributorType;
  contributedByUserId: string;
  memberAmounts: Record<string, number>; // { [userId]: centavos }
  date: string;     // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  note?: string;
  createdAt: string;
}

export interface GoalWithdrawal {
  id: string;
  goalId: string;
  amount: number; // em centavos
  reason: string;
  contributorType: ContributorType;
  withdrawnByUserId?: string;
  date: string;
  createdAt: string;
}

export interface GoalSummaryMetrics {
  totalSaved: number;
  monthlyInvested: number;
  memberTotals: Record<string, number>;
  memberPercentages: Record<string, number>;
  overallProgress: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
}
```

---

## 📄 Arquivo: `src/lib/calculations.ts`

```ts
import type {
  Transaction,
  GroupMember,
  BalanceSummary,
  SettlementObligation,
  DirectDebt,
  DebtSource,
  DebtSettlement,
  ExpenseTransaction,
  SettlementTransaction,
} from "../types";
import { sanitizeDateString } from "./formatters";

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

// ─── Estrutura interna de rastreamento por par ─────────────────────────────────

interface PairDebtEntry {
  grossTotal:  number;           // soma bruta das despesas (NUNCA reduzida por acertos)
  total:       number;           // total líquido após acertos (decrementado nos settlements)
  sources:     DebtSource[];     // despesas que geraram esta dívida
  settlements: DebtSettlement[]; // acertos que abateram esta dívida (APENAS desta direção)
}

/**
 * Converte o mapa de dívidas brutas por par em array tipado de DirectDebt,
 * fazendo NETTING entre pares opostos e carregando sources + settlements.
 *
 * Exemplo: se A→B = 437 e B→A = 2500 → resultado: { B→A, net=2063, sources de B→A }
 */
function buildDirectDebts(
  pairDebts: Record<string, PairDebtEntry>
): DirectDebt[] {
  const result: DirectDebt[]    = [];
  const processed = new Set<string>();

  for (const [key, entry] of Object.entries(pairDebts)) {
    if (processed.has(key)) continue;

    const [debtorId, creditorId] = key.split("::");
    const reverseKey   = pairKey(creditorId, debtorId);
    const reverseEntry = pairDebts[reverseKey];

    processed.add(key);
    processed.add(reverseKey);

    const forwardGross = entry.grossTotal;
    const reverseGross = reverseEntry?.grossTotal ?? 0;
    const forwardNet   = entry.total;
    const reverseNet   = reverseEntry?.total ?? 0;
    const net          = forwardNet - reverseNet;

    // Settlements de cada direção ficam apenas na sua entrada —
    // juntá-los aqui exibe todos os acertos relevantes sem duplicar.
    const allSettlements: DebtSettlement[] = [
      ...entry.settlements,
      ...(reverseEntry?.settlements ?? []),
    ];

    if (net > 0) {
      result.push({
        debtorId,
        creditorId,
        amount:         net,
        rawAmount:      forwardGross,   // bruto REAL das despesas (sem abatimento)
        sources:        entry.sources,
        settlements:    allSettlements,
        nettingSources: reverseEntry?.sources ?? [],
      });
    } else if (net < 0) {
      result.push({
        debtorId:       creditorId,
        creditorId:     debtorId,
        amount:         -net,
        rawAmount:      reverseGross,   // bruto REAL da direção inversa
        sources:        reverseEntry?.sources ?? [],
        settlements:    allSettlements,
        nettingSources: entry.sources,
      });
    }
    // net === 0 → par zerado, nada a exibir
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
  const adminUid      = resolveAdminUid(members);
  const memberUid     = resolveMemberUid(members);
  const allMemberUids = members.map((m) => m.userId);

  // ── Lookup O(1): userId → firstName ──────────────────────────────────────────
  // Evita O(n) de Array.find() dentro dos loops de despesa.
  const nameMap = new Map<string, string>(
    members.map((m) => [m.userId, m.name.split(" ")[0]])
  );
  const resolveName = (uid: string): string => nameMap.get(uid) ?? "Membro";

  const memberExpenses:    Record<string, number> = {};
  const memberSettlements: Record<string, number> = {};
  const memberBalances:    Record<string, number> = {};

  // Rastreia dívidas brutas por par com rastreabilidade completa
  const pairDebts: Record<string, PairDebtEntry> = {};

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
    const paidByName     = resolveName(paidBy);

    splitUids.forEach((uid, index) => {
      const share = index === 0 ? sharePerMember + remainder : sharePerMember;
      addToMap(memberBalances, uid, -share);

      // Dívida direta: uid deve "share" para paidBy
      if (uid !== paidBy) {
        const key = pairKey(uid, paidBy);
        if (!pairDebts[key]) {
          pairDebts[key] = { grossTotal: 0, total: 0, sources: [], settlements: [] };
        }
        pairDebts[key].grossTotal += share;
        pairDebts[key].total      += share;
        pairDebts[key].sources.push({
          expenseId:   t.id,
          description: t.description,
          date:        t.date,
          totalAmount: t.amount,
          yourShare:   share,
          paidByName,
          splitCount:  splitUids.length,
        });
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

    // Abate o total líquido e registra o settlement APENAS nesta direção.
    // Não empurramos para reverseKey pois buildDirectDebts já mescla os dois lados,
    // evitando a duplicação de acertos na exibição.
    const key = pairKey(fromUid, toUid);
    if (!pairDebts[key]) {
      pairDebts[key] = { grossTotal: 0, total: 0, sources: [], settlements: [] };
    }
    const settlementEntry: DebtSettlement = {
      settlementId: t.id,
      amount:       t.amount,
      date:         t.date,
    };
    pairDebts[key].total = Math.max(0, pairDebts[key].total - t.amount);
    pairDebts[key].settlements.push(settlementEntry);
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
  if (!value) return null;
  // Remove "R$", espaços normais e espaços não-quebráveis (\u00A0)
  const cleaned = value.replace(/R\$\s?|\s|\u00A0/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",")) {
    // Padrão brasileiro: 1.500,50 -> remove pontos de milhar e troca vírgula por ponto
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export function getMonthKey(date: string): string {
  const safeDate = sanitizeDateString(date);
  return safeDate.slice(0, 7);
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
```

---

## 📄 Arquivo: `src/lib/formatters.ts`

```ts
/**
 * Formatadores de exibição — BRL e datas no padrão brasileiro.
 */


/**
 * Formata centavos para moeda brasileira. Ex: 12050 → "R$ 120,50"
 */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Formata centavos para string sem o prefixo "R$". Ex: 12050 → "120,50"
 */
export function formatBRLRaw(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Máscara estilo maquininha de cartão / POS para inputs monetários.
 * Converte dígitos digitados da direita para a esquerda:
 * "1" -> "0,01"
 * "15" -> "0,15"
 * "150" -> "1,50"
 * "1500" -> "15,00"
 * "150000" -> "1.500,00"
 */
export function maskCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  if (cents === 0) return "";
  return formatBRLRaw(cents);
}

/**
 * Sanitiza uma data garantindo o formato "YYYY-MM-DD" com ano, mês (01-12) e dia (01-31) válidos.
 * Se a data for inválida ou o mês estiver corrompido (ex: minutos gravados por atalhos iOS como 2026-36-23),
 * substitui pelo mês atual preservando o dia e ano válidos, ou pela data de hoje.
 */
export function sanitizeDateString(dateStr?: unknown): string {
  if (!dateStr || typeof dateStr !== "string") return getTodayDateString();
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return getTodayDateString();
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    year < 2020 || year > 2050 ||
    month < 1 || month > 12 ||
    day < 1 || day > 31
  ) {
    const now = new Date();
    const safeYear = year >= 2020 && year <= 2050 ? year : now.getFullYear();
    const safeMonth = String(now.getMonth() + 1).padStart(2, "0");
    const safeDay = day >= 1 && day <= 31 ? String(day).padStart(2, "0") : String(now.getDate()).padStart(2, "0");
    return `${safeYear}-${safeMonth}-${safeDay}`;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Formata "YYYY-MM-DD" para "30/05/2026"
 */
export function formatDateBR(dateStr: string): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  const m = Number(month);
  const d = Number(day);
  if (isNaN(m) || isNaN(d) || m < 1 || m > 12) {
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
    const safeDay = d >= 1 && d <= 31 ? String(d).padStart(2, "0") : String(new Date().getDate()).padStart(2, "0");
    return `${safeDay}/${currentMonth}/${year}`;
  }
  return `${day}/${month}/${year}`;
}

/**
 * Formata "YYYY-MM" para "Maio 2026"
 */
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Formata prazo da meta de forma amigável.
 * Ex: "2026-12" -> "Dez/2026", "2027-07" -> "Jul/2027"
 */
export function formatDeadline(deadline?: string): string {
  if (!deadline) return "";
  if (/^\d{4}-\d{2}$/.test(deadline)) {
    const [year, month] = deadline.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    const monthName = date.toLocaleDateString("pt-BR", { month: "short" });
    const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1).replace(".", "");
    return `${formattedMonth}/${year}`;
  }
  return deadline;
}

/**
 * Formata "YYYY-MM" para "maio" (só o nome do mês, minúsculo)
 */
export function formatMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long" });
}

/**
 * Retorna o monthKey atual no formato "YYYY-MM"
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Retorna a data atual no formato "YYYY-MM-DD"
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Retorna lista dos últimos N meses como monthKeys ["2026-05", "2026-04", ...]
 */
export function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
  }
  return months;
}

/**
 * Descreve o tipo de divisão de forma amigável
 */
export function formatSplitType(splitType: string): string {
  switch (splitType) {
    case "50/50":
      return "Dividido 50/50";
    case "100% owner":
    case "100% partner":
    case "100% Arthur":
    case "100% Zara":
    case "100% Namorada":
      return "Gasto Pessoal";
    case "Pix Antecipado":
      return "Pix Antecipado 💸";
    default:
      return splitType;
  }
}
```

---

## 📄 Arquivo: `firestore.rules`

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthed() {
      return request.auth != null;
    }

    match /groups/{groupId} {
      // Regra blindada: apenas membros autenticados pertencentes ao grupo podem consultar e listar o grupo
      allow get: if isAuthed() && request.auth.uid in resource.data.memberIds;
      allow list: if isAuthed() && request.auth.uid in resource.data.memberIds;
      
      allow update: if isAuthed() && (request.auth.uid in resource.data.memberIds || request.auth.uid in request.resource.data.memberIds);
      allow delete: if isAuthed() && request.auth.uid in resource.data.memberIds;
      allow create: if isAuthed() && request.auth.uid in request.resource.data.memberIds;

      // Cascata para subcoleções (members, transactions, fcm_tokens, apple_pay_events)
      match /{document=**} {
        allow read, write: if isAuthed() && (
          (exists(/databases/$(database)/documents/groups/$(groupId)) && request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.memberIds) ||
          (existsAfter(/databases/$(database)/documents/groups/$(groupId)) && request.auth.uid in getAfter(/databases/$(database)/documents/groups/$(groupId)).data.memberIds)
        );
      }
    }

    // Perfis de usuario
    match /users/{userId} {
      allow read, write: if isAuthed() && request.auth.uid == userId;
    }
  }
}
```

---

## 📄 Arquivo: `src/hooks/useGoals.ts`

```ts
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  collection,
  runTransaction,
} from "firebase/firestore";
import { useGroupContext } from "../contexts/GroupContext";
import { getCurrentMonthKey, getTodayDateString } from "../lib/formatters";
import { db, goalsRef, goalDocRef } from "../lib/firebase";
import type {
  Goal,
  GoalContribution,
  GoalWithdrawal,
  GoalSummaryMetrics,
  ContributorType,
} from "../types";

const GOALS_STORAGE_KEY_PREFIX = "casalpay_goals_";
const CONTRIBS_STORAGE_KEY_PREFIX = "casalpay_contribs_";
const WITHDRAWALS_STORAGE_KEY_PREFIX = "casalpay_withdrawals_";

// Chaves legadas do sandbox para auto-limpeza em dispositivos reais
const LEGACY_SANDBOX_KEYS = [
  "casalpay_sandbox_goals_",
  "casalpay_sandbox_contribs_",
  "casalpay_sandbox_withdrawals_",
  "casalpay_goals_is_sandbox",
];

export function isGroupAllowedForGoals(groupName?: string): boolean {
  if (!groupName) return false;
  const normalized = groupName.toLowerCase();
  return (
    normalized.includes("arthur") ||
    normalized.includes("zara") ||
    normalized.includes("teste") ||
    normalized.includes("laborat")
  );
}

export function useGoals() {
  const { group, members } = useGroupContext();

  const isGroupSupported = useMemo(() => {
    return isGroupAllowedForGoals(group?.name);
  }, [group?.name]);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [withdrawals, setWithdrawals] = useState<GoalWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const groupId = group?.id || "default_group";

  // Identificação do Arthur e da Zara para rateios
  const arthurUid = useMemo(() => {
    const found = members.find((m) => m.name.toLowerCase().includes("arthur") || m.role === "admin");
    return found?.userId || members[0]?.userId || "arthur_id";
  }, [members]);

  const zaraUid = useMemo(() => {
    const found = members.find((m) => m.name.toLowerCase().includes("zara") || m.userId !== arthurUid);
    return found?.userId || members[1]?.userId || "zara_id";
  }, [members, arthurUid]);

  // Persistir alterações em cache local
  const persistLocal = useCallback(
    (newGoals: Goal[], newContribs?: GoalContribution[], newWithdrawals?: GoalWithdrawal[]) => {
      setGoals(newGoals);
      localStorage.setItem(`${GOALS_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(newGoals));
      if (newContribs) {
        setContributions(newContribs);
        localStorage.setItem(`${CONTRIBS_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(newContribs));
      }
      if (newWithdrawals) {
        setWithdrawals(newWithdrawals);
        localStorage.setItem(`${WITHDRAWALS_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(newWithdrawals));
      }
    },
    [groupId]
  );

  // Carregar dados e escutar em tempo real (Firestore com controle de Cache Offline e Metadata)
  useEffect(() => {
    if (!group) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Limpeza proativa de qualquer dado fictício de sandbox armazenado no aparelho
    try {
      LEGACY_SANDBOX_KEYS.forEach((k) => {
        localStorage.removeItem(`${k}${groupId}`);
        localStorage.removeItem(k);
      });
    } catch {
      // Ignorar erros de quota/storage
    }

    // 2. Carrega cache local imediato (filtrando qualquer resíduo fictício)
    try {
      const storedGoals = localStorage.getItem(`${GOALS_STORAGE_KEY_PREFIX}${groupId}`);
      const storedContribs = localStorage.getItem(`${CONTRIBS_STORAGE_KEY_PREFIX}${groupId}`);
      const storedWithdrawals = localStorage.getItem(`${WITHDRAWALS_STORAGE_KEY_PREFIX}${groupId}`);

      if (storedGoals) {
        const parsed: Goal[] = JSON.parse(storedGoals);
        const realGoals = parsed.filter((g) => !g.id.startsWith("sandbox_"));
        setGoals(realGoals);
      } else {
        setGoals([]);
      }

      if (storedContribs) {
        const parsed: GoalContribution[] = JSON.parse(storedContribs);
        const realContribs = parsed.filter(
          (c) => !c.id.startsWith("contrib_demo_") && !c.goalId.startsWith("sandbox_")
        );
        setContributions(realContribs);
      } else {
        setContributions([]);
      }

      if (storedWithdrawals) {
        const parsed: GoalWithdrawal[] = JSON.parse(storedWithdrawals);
        setWithdrawals(parsed.filter((w) => !w.goalId.startsWith("sandbox_")));
      } else {
        setWithdrawals([]);
      }
    } catch (e) {
      console.warn("Aviso ao ler cache local de metas:", e);
    }

    // 3. Sincronização em tempo real com Firestore (Arthur e Zara compartilham as mesmas metas)
    // Monitora metadata de cache para evitar sobrescrever dados locais com snapshots desatualizados
    let unsubGoals: (() => void) | undefined;
    let unsubContribs: (() => void) | undefined;
    let unsubWithdrawals: (() => void) | undefined;

    try {
      const gRef = goalsRef(groupId);
      unsubGoals = onSnapshot(
        gRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          const isFromCache = snapshot.metadata.fromCache;
          const hasPendingWrites = snapshot.metadata.hasPendingWrites;

          const remoteGoals: Goal[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Goal;
            if (!data.id?.startsWith("sandbox_")) {
              remoteGoals.push({ ...data, id: docSnap.id });
            }
          });

          // Atualiza caso os dados venham do servidor, tenham pendências ativas locais ou a lista remota exista
          if (!isFromCache || hasPendingWrites || remoteGoals.length > 0) {
            setGoals(remoteGoals);
            localStorage.setItem(`${GOALS_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(remoteGoals));
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Firestore metas em modo local:", err.message);
          setLoading(false);
        }
      );

      const cRef = collection(db, "groups", groupId, "goal_contributions");
      unsubContribs = onSnapshot(
        cRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          const isFromCache = snapshot.metadata.fromCache;
          const hasPendingWrites = snapshot.metadata.hasPendingWrites;

          const remoteContribs: GoalContribution[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as GoalContribution;
            if (!data.id?.startsWith("contrib_demo_") && !data.goalId?.startsWith("sandbox_")) {
              remoteContribs.push({ ...data, id: docSnap.id });
            }
          });

          if (!isFromCache || hasPendingWrites || remoteContribs.length > 0) {
            setContributions(remoteContribs);
            localStorage.setItem(`${CONTRIBS_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(remoteContribs));
          }
        },
        (err) => {
          console.warn("Firestore contribuições em modo local:", err.message);
        }
      );

      const wRef = collection(db, "groups", groupId, "goal_withdrawals");
      unsubWithdrawals = onSnapshot(
        wRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          const isFromCache = snapshot.metadata.fromCache;
          const hasPendingWrites = snapshot.metadata.hasPendingWrites;

          const remoteWithdrawals: GoalWithdrawal[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as GoalWithdrawal;
            if (!data.goalId?.startsWith("sandbox_")) {
              remoteWithdrawals.push({ ...data, id: docSnap.id });
            }
          });

          if (!isFromCache || hasPendingWrites || remoteWithdrawals.length > 0) {
            setWithdrawals(remoteWithdrawals);
            localStorage.setItem(`${WITHDRAWALS_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(remoteWithdrawals));
          }
        },
        (err) => {
          console.warn("Firestore resgates em modo local:", err.message);
        }
      );
    } catch (e) {
      console.warn("Erro ao configurar listeners de metas:", e);
      setLoading(false);
    }

    return () => {
      unsubGoals?.();
      unsubContribs?.();
      unsubWithdrawals?.();
    };
  }, [groupId, group]);

  // Cálculos consolidados em tempo real
  const metrics: GoalSummaryMetrics = useMemo(() => {
    let totalSaved = 0;
    let totalTarget = 0;
    let activeGoalsCount = 0;
    let completedGoalsCount = 0;

    const memberTotals: Record<string, number> = {
      [arthurUid]: 0,
      [zaraUid]: 0,
    };

    for (const goal of goals) {
      totalSaved += goal.currentAmount;
      totalTarget += goal.targetAmount;
      if (goal.status === "completed") {
        completedGoalsCount++;
      } else {
        activeGoalsCount++;
      }

      for (const [mId, amount] of Object.entries(goal.contributionsByMember || {})) {
        memberTotals[mId] = (memberTotals[mId] || 0) + amount;
      }
    }

    const currentMonth = getCurrentMonthKey();
    const monthlyInvested = contributions
      .filter((c) => c.monthKey === currentMonth)
      .reduce((sum, c) => sum + c.amount, 0);

    const totalContributed = Object.values(memberTotals).reduce((a, b) => a + b, 0);
    const memberPercentages: Record<string, number> = {};

    [arthurUid, zaraUid].forEach((id) => {
      if (totalContributed === 0) {
        memberPercentages[id] = 50.0;
      } else {
        memberPercentages[id] = Number(((memberTotals[id] / totalContributed) * 100).toFixed(1));
      }
    });

    const overallProgress = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

    return {
      totalSaved,
      monthlyInvested,
      memberTotals,
      memberPercentages,
      overallProgress: Number(overallProgress.toFixed(1)),
      activeGoalsCount,
      completedGoalsCount,
    };
  }, [goals, contributions, arthurUid, zaraUid]);

  // Ações de gerenciamento de Metas
  const createGoal = useCallback(
    async (data: {
      title: string;
      category: string;
      emoji: string;
      targetAmount: number;
      initialAmount?: number;
      deadline?: string;
    }) => {
      const initial = data.initialAmount || 0;
      const newGoal: Goal = {
        id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        groupId,
        title: data.title.trim(),
        category: data.category.trim() || "Sonho",
        emoji: data.emoji || "🎯",
        targetAmount: data.targetAmount,
        currentAmount: initial,
        deadline: data.deadline,
        status: initial >= data.targetAmount ? "completed" : "in_progress",
        contributionsByMember: {
          [arthurUid]: Math.floor(initial / 2),
          [zaraUid]: Math.floor(initial / 2) + (initial % 2),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let nextContribs = contributions;
      let initialContrib: GoalContribution | null = null;
      if (initial > 0) {
        const today = getTodayDateString();
        initialContrib = {
          id: `contrib_init_${Date.now()}`,
          goalId: newGoal.id,
          amount: initial,
          contributorType: "split",
          contributedByUserId: arthurUid,
          memberAmounts: {
            [arthurUid]: Math.floor(initial / 2),
            [zaraUid]: Math.floor(initial / 2) + (initial % 2),
          },
          date: today,
          monthKey: today.slice(0, 7),
          note: "Saldo inicial da meta",
          createdAt: new Date().toISOString(),
        };
        nextContribs = [initialContrib, ...contributions];
      }

      const updated = [newGoal, ...goals];
      persistLocal(updated, nextContribs);

      // Persistência no Firestore
      try {
        await setDoc(goalDocRef(groupId, newGoal.id), newGoal);
        if (initialContrib) {
          await setDoc(
            doc(db, "groups", groupId, "goal_contributions", initialContrib.id),
            initialContrib
          );
        }
      } catch (err) {
        console.warn("Meta salva em cache local (offline):", err);
      }

      return newGoal;
    },
    [groupId, goals, contributions, persistLocal, arthurUid, zaraUid]
  );

  // MUTAÇÃO ATÔMICA: addContribution utilizando runTransaction
  const addContribution = useCallback(
    async (
      goalId: string,
      amount: number,
      contributorType: ContributorType,
      note?: string
    ) => {
      const today = getTodayDateString();
      const contribId = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const contribDocRef = doc(db, "groups", groupId, "goal_contributions", contribId);
      const targetGoalDocRef = goalDocRef(groupId, goalId);

      const computeContribution = (
        currentGoalData: Goal
      ): { updatedGoal: Goal; newContrib: GoalContribution } => {
        const memberAmounts: Record<string, number> = {};
        if (contributorType === "arthur") {
          memberAmounts[arthurUid] = amount;
          memberAmounts[zaraUid] = 0;
        } else if (contributorType === "zara") {
          memberAmounts[arthurUid] = 0;
          memberAmounts[zaraUid] = amount;
        } else {
          const half = Math.floor(amount / 2);
          memberAmounts[arthurUid] = half + (amount % 2);
          memberAmounts[zaraUid] = half;
        }

        const newCurrentAmount = currentGoalData.currentAmount + amount;
        const isCompleted = newCurrentAmount >= currentGoalData.targetAmount;

        const updatedContributionsByMember = { ...(currentGoalData.contributionsByMember || {}) };
        for (const [mId, mAmount] of Object.entries(memberAmounts)) {
          updatedContributionsByMember[mId] = (updatedContributionsByMember[mId] || 0) + mAmount;
        }

        const updatedGoal: Goal = {
          ...currentGoalData,
          currentAmount: newCurrentAmount,
          status: isCompleted ? "completed" : "in_progress",
          contributionsByMember: updatedContributionsByMember,
          updatedAt: new Date().toISOString(),
        };

        const newContrib: GoalContribution = {
          id: contribId,
          goalId,
          amount,
          contributorType,
          contributedByUserId: contributorType === "zara" ? zaraUid : arthurUid,
          memberAmounts,
          date: today,
          monthKey: today.slice(0, 7),
          note,
          createdAt: new Date().toISOString(),
        };

        return { updatedGoal, newContrib };
      };

      try {
        // 1. Transação Atômica no Firestore para prevenir lost updates concorrentes
        const result = await runTransaction(db, async (txn) => {
          const goalSnap = await txn.get(targetGoalDocRef);
          if (!goalSnap.exists()) {
            throw new Error("Meta não encontrada no servidor");
          }
          const currentGoalData = { id: goalSnap.id, ...goalSnap.data() } as Goal;
          const { updatedGoal, newContrib } = computeContribution(currentGoalData);

          txn.set(targetGoalDocRef, updatedGoal);
          txn.set(contribDocRef, newContrib);

          return { updatedGoal, newContrib };
        });

        // 2. Atualiza estado e cache local com o resultado atômico
        const nextGoals = goals.map((g) => (g.id === goalId ? result.updatedGoal : g));
        const nextContribs = [result.newContrib, ...contributions];
        persistLocal(nextGoals, nextContribs);

        return result;
      } catch (err) {
        console.warn("Transação remota de aporte offline/falhou. Aplicando fallback local:", err);

        const targetGoal = goals.find((g) => g.id === goalId);
        if (!targetGoal) throw new Error("Meta não encontrada");

        const { updatedGoal, newContrib } = computeContribution(targetGoal);
        const nextGoals = goals.map((g) => (g.id === goalId ? updatedGoal : g));
        const nextContribs = [newContrib, ...contributions];
        persistLocal(nextGoals, nextContribs);

        return { updatedGoal, newContrib };
      }
    },
    [groupId, goals, contributions, persistLocal, arthurUid, zaraUid]
  );

  // MUTAÇÃO ATÔMICA: withdrawGoal utilizando runTransaction
  const withdrawGoal = useCallback(
    async (
      goalId: string,
      amount: number,
      reason: string,
      contributorType: ContributorType = "split"
    ) => {
      const today = getTodayDateString();
      const withdrawalId = `with_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const withdrawalDocRef = doc(db, "groups", groupId, "goal_withdrawals", withdrawalId);
      const targetGoalDocRef = goalDocRef(groupId, goalId);

      const computeWithdrawal = (
        targetGoal: Goal
      ): { updatedGoal: Goal; newWithdrawal: GoalWithdrawal } => {
        if (amount <= 0) throw new Error("Valor inválido");
        if (amount > targetGoal.currentAmount) throw new Error("Saldo insuficiente na meta");

        const newAmount = targetGoal.currentAmount - amount;

        // Abate as contribuições acumuladas dos membros garantindo consistência patrimonial
        const currentMemberContribs = { ...(targetGoal.contributionsByMember || {}) };
        const arthurBal = currentMemberContribs[arthurUid] || 0;
        const zaraBal = currentMemberContribs[zaraUid] || 0;

        if (contributorType === "arthur") {
          if (amount > arthurBal) {
            throw new Error("Arthur não possui saldo individual suficiente nesta meta para este resgate.");
          }
          currentMemberContribs[arthurUid] = arthurBal - amount;
        } else if (contributorType === "zara") {
          if (amount > zaraBal) {
            throw new Error("Zara não possui saldo individual suficiente nesta meta para este resgate.");
          }
          currentMemberContribs[zaraUid] = zaraBal - amount;
        } else {
          // Resgate conjunto (split 50/50 ou proporcional se saldo for assimétrico)
          const totalCurrent = targetGoal.currentAmount;
          const arthurRatio = totalCurrent > 0 ? arthurBal / totalCurrent : 0.5;
          const arthurDeduct = Math.min(arthurBal, Math.round(amount * arthurRatio));
          const zaraDeduct = amount - arthurDeduct;
          currentMemberContribs[arthurUid] = Math.max(0, arthurBal - arthurDeduct);
          currentMemberContribs[zaraUid] = Math.max(0, zaraBal - zaraDeduct);
        }

        const updatedGoal: Goal = {
          ...targetGoal,
          currentAmount: newAmount,
          contributionsByMember: currentMemberContribs,
          status: newAmount >= targetGoal.targetAmount ? "completed" : "in_progress",
          updatedAt: new Date().toISOString(),
        };

        const newWithdrawal: GoalWithdrawal = {
          id: withdrawalId,
          goalId,
          amount,
          reason: reason.trim() || "Resgate da meta",
          contributorType,
          withdrawnByUserId: contributorType === "zara" ? zaraUid : arthurUid,
          date: today,
          createdAt: new Date().toISOString(),
        };

        return { updatedGoal, newWithdrawal };
      };

      try {
        // 1. Transação Atômica no Firestore
        const result = await runTransaction(db, async (txn) => {
          const goalSnap = await txn.get(targetGoalDocRef);
          if (!goalSnap.exists()) {
            throw new Error("Meta não encontrada no servidor");
          }
          const currentGoalData = { id: goalSnap.id, ...goalSnap.data() } as Goal;
          const { updatedGoal, newWithdrawal } = computeWithdrawal(currentGoalData);

          txn.set(targetGoalDocRef, updatedGoal);
          txn.set(withdrawalDocRef, newWithdrawal);

          return { updatedGoal, newWithdrawal };
        });

        // 2. Atualiza estado e cache local com o resultado atômico
        const nextGoals = goals.map((g) => (g.id === goalId ? result.updatedGoal : g));
        const nextWithdrawals = [result.newWithdrawal, ...withdrawals];
        persistLocal(nextGoals, contributions, nextWithdrawals);

        return result;
      } catch (err) {
        console.warn("Transação remota de resgate offline/falhou. Aplicando fallback local:", err);

        const targetGoal = goals.find((g) => g.id === goalId);
        if (!targetGoal) throw new Error("Meta não encontrada");

        const { updatedGoal, newWithdrawal } = computeWithdrawal(targetGoal);
        const nextGoals = goals.map((g) => (g.id === goalId ? updatedGoal : g));
        const nextWithdrawals = [newWithdrawal, ...withdrawals];
        persistLocal(nextGoals, contributions, nextWithdrawals);

        return { updatedGoal, newWithdrawal };
      }
    },
    [groupId, goals, contributions, withdrawals, persistLocal, arthurUid, zaraUid]
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      const nextGoals = goals.filter((g) => g.id !== goalId);
      const nextContribs = contributions.filter((c) => c.goalId !== goalId);
      const nextWithdrawals = withdrawals.filter((w) => w.goalId !== goalId);
      persistLocal(nextGoals, nextContribs, nextWithdrawals);

      try {
        await deleteDoc(goalDocRef(groupId, goalId));
      } catch (err) {
        console.warn("Exclusão salva em cache local (offline):", err);
      }
    },
    [groupId, goals, contributions, withdrawals, persistLocal]
  );

  return {
    goals,
    contributions,
    withdrawals,
    metrics,
    loading,
    isGroupSupported,
    arthurUid,
    zaraUid,
    createGoal,
    addContribution,
    withdrawGoal,
    deleteGoal,
  };
}
```

---

## 📄 Arquivo: `src/hooks/useTransactions.ts`

```ts
import { useState, useEffect, useCallback } from "react";
import {
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  writeBatch,
  getDocs,
  doc,
  collection,
} from "firebase/firestore";
import type { Transaction, TransactionFormData, ExpenseFormData, SettlementFormData } from "../types";
import {
  transactionsRef,
  transactionDocRef,
  db,
} from "../lib/firebase";
import { getMonthKey } from "../lib/calculations";
import { useGroupContext } from "../contexts/GroupContext";

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  addTransaction: (data: TransactionFormData, amountCents: number) => Promise<void>;
  updateTransaction: (originalTransaction: Transaction, data: TransactionFormData, amountCents: number) => Promise<void>;
  deleteTransaction: (transaction: Transaction) => Promise<void>;
}

export function useTransactions(monthKey: string): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { group, currentMember } = useGroupContext();


  useEffect(() => {
    setLoading(true);
    setError(null);

    // Query Bailing: Proteção estrita multi-grupos.
    if (!currentMember || !group) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const activeGroupId = group.id;

    const q = query(
      transactionsRef(activeGroupId),
      where("monthKey", "==", monthKey),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Transaction[] = snapshot.docs.map((docSnap) => {
          const data = {
            id: docSnap.id,
            ...docSnap.data(),
          } as Transaction;

          return data;
        }).filter((t) => !t.status || t.status === "confirmed");
        
        setTransactions(docs);
        setLoading(false);
      },
      (err: any) => {
        console.error("Erro ao carregar transações:", err);
        if (err.code === "permission-denied") {
          localStorage.removeItem('casalpay_active_group');
          setError(`Usuário autenticado, mas sem permissão no Firestore para o grupo ${activeGroupId}.`);
        } else if (err.code === "unavailable") {
          setError("Firestore indisponível ou sem conexão.");
        } else if (err.code === "failed-precondition" && err.message?.includes("index")) {
          console.warn("Index URL:", err.message);
          setError("O banco de dados precisa finalizar a criação de um índice. Tente novamente em alguns minutos.");
        } else {
          setError(`Erro ao carregar dados: ${err.message}`);
        }
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [monthKey, group, currentMember]);


  const addTransaction = useCallback(
    async (data: TransactionFormData, amountCents: number) => {
      if (!group) throw new Error("Grupo não carregado.");
      const activeGroupId = group.id;

      const baseData = {
        description: data.description.trim(),
        coupleId: activeGroupId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (data.type === "expense" && data.isInstallment && data.installmentCount && data.installmentCount > 1) {
        const count = data.installmentCount;
        const baseAmount = Math.floor(amountCents / count);
        const remainder = amountCents % count;
        const installmentGroupId = doc(collection(db, "groups")).id;
        const [year, month, day] = data.date.split("-").map(Number);
        const batch = writeBatch(db);

        const visibility: "shared" | "personal" = data.splitMode === "personal" ? "personal" : "shared";
        const personalOwnerUserId = data.personalOwnerUserId;

        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }

        for (let i = 1; i <= count; i++) {
          const installmentAmount = i === 1 ? baseAmount + remainder : baseAmount;
          const targetMonthZeroIndex = month - 1 + (i - 1);
          const newYear = year + Math.floor(targetMonthZeroIndex / 12);
          const newMonthIndex = targetMonthZeroIndex % 12;
          const lastDayOfTargetMonth = new Date(newYear, newMonthIndex + 1, 0).getDate();
          const newDay = Math.min(day, lastDayOfTargetMonth);
          const newMonthStr = String(newMonthIndex + 1).padStart(2, "0");
          const newDayStr = String(newDay).padStart(2, "0");
          const newDateStr = `${newYear}-${newMonthStr}-${newDayStr}`;

          const newDocRef = doc(transactionsRef(activeGroupId));
          batch.set(newDocRef, {
            ...baseData,
            amount: installmentAmount,
            date: newDateStr,
            monthKey: getMonthKey(newDateStr),
            type: "expense",
            paidByUserId: data.paidByUserId,
            splitBetweenUserIds: data.splitBetweenUserIds,
            splitMode: data.splitMode,
            installmentCount: count,
            currentInstallment: i,
            groupId: installmentGroupId,
            originalAmount: amountCents,
            visibility,
            personalOwnerUserId: personalOwnerUserId ?? null,
          });
        }
        await batch.commit();
      } else if (data.type === "expense") {
        const visibility: "shared" | "personal" = data.splitMode === "personal" ? "personal" : "shared";
        const personalOwnerUserId = data.personalOwnerUserId;

        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }

        await addDoc(transactionsRef(activeGroupId), {
          ...baseData,
          amount: amountCents,
          date: data.date,
          monthKey: getMonthKey(data.date),
          type: "expense",
          paidByUserId: data.paidByUserId,
          splitBetweenUserIds: data.splitBetweenUserIds,
          splitMode: data.splitMode,
          visibility,
          personalOwnerUserId: personalOwnerUserId ?? null,
        });
      } else {
        // settlement
        const visibility: "shared" | "personal" = data.isPersonalInvoice ? "personal" : "shared";
        const personalOwnerUserId = data.personalOwnerUserId;

        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }

        await addDoc(transactionsRef(activeGroupId), {
          ...baseData,
          amount: amountCents,
          date: data.date,
          monthKey: getMonthKey(data.date),
          type: "settlement",
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          visibility,
          personalOwnerUserId: personalOwnerUserId ?? null,
        });
      }
    },
    [group]
  );

  const updateTransaction = useCallback(
    async (originalTransaction: Transaction, data: TransactionFormData, amountCents: number) => {
      if (!group) throw new Error("Grupo não carregado.");
      const activeGroupId = group.id;

      // Apenas despesas com metadados completos de parcelamento entram no fluxo
      // de apagar e recriar parcelas. O webhook usa coupleId para o grupo; um
      // groupId isolado não pode ser interpretado como grupo de parcelas.
      const wasInstallment =
        originalTransaction.type === "expense" &&
        Boolean(
          originalTransaction.groupId &&
          (originalTransaction.installmentCount ?? 0) > 1
        );
      const willBeInstallment = data.type === "expense" && Boolean(data.isInstallment) && (data.installmentCount ?? 0) > 1;

      // ─ Helper: resolve visibility + personalOwnerUserId do novo formato ─
      const resolveExpenseVisibility = (d: ExpenseFormData): { visibility: "shared" | "personal"; personalOwnerUserId: string | null } => {
        const visibility: "shared" | "personal" = d.splitMode === "personal" ? "personal" : "shared";
        const personalOwnerUserId = d.personalOwnerUserId ?? null;
        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }
        return { visibility, personalOwnerUserId };
      };

      const resolveSettlementVisibility = (d: SettlementFormData): { visibility: "shared" | "personal"; personalOwnerUserId: string | null } => {
        const visibility: "shared" | "personal" = d.isPersonalInvoice ? "personal" : "shared";
        const personalOwnerUserId = d.personalOwnerUserId ?? null;
        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }
        return { visibility, personalOwnerUserId };
      };

      if (wasInstallment || willBeInstallment) {
        const batch = writeBatch(db);

        // 1. Apagar parcelas antigas
        const expenseOrig = originalTransaction.type === "expense" ? originalTransaction : null;
        if (expenseOrig?.groupId && expenseOrig.groupId !== activeGroupId) {
          const oldGroupSnap = await getDocs(
            query(transactionsRef(activeGroupId), where("groupId", "==", expenseOrig.groupId))
          );
          oldGroupSnap.forEach((docSnap) => batch.delete(docSnap.ref));
        } else {
          batch.delete(transactionDocRef(activeGroupId, originalTransaction.id));
        }

        // 2. Criar as N novas parcelas no mesmo batch
        if (willBeInstallment && data.type === "expense") {
          const count = data.installmentCount!;
          const baseAmount = Math.floor(amountCents / count);
          const remainder = amountCents % count;
          const installmentGroupId = doc(collection(db, "groups")).id;
          const [year, month, day] = data.date.split("-").map(Number);
          const { visibility, personalOwnerUserId } = resolveExpenseVisibility(data);

          for (let i = 1; i <= count; i++) {
            const installmentAmount = i === 1 ? baseAmount + remainder : baseAmount;
            const targetMonthZeroIndex = month - 1 + (i - 1);
            const newYear = year + Math.floor(targetMonthZeroIndex / 12);
            const newMonthIndex = targetMonthZeroIndex % 12;
            const lastDayOfTargetMonth = new Date(newYear, newMonthIndex + 1, 0).getDate();
            const newDay = Math.min(day, lastDayOfTargetMonth);
            const newDateStr = `${newYear}-${String(newMonthIndex + 1).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;

            batch.set(doc(transactionsRef(activeGroupId)), {
              description: data.description.trim(),
              coupleId: activeGroupId,
              amount: installmentAmount,
              date: newDateStr,
              monthKey: getMonthKey(newDateStr),
              type: "expense",
              paidByUserId: data.paidByUserId,
              splitBetweenUserIds: data.splitBetweenUserIds,
              splitMode: data.splitMode,
              installmentCount: count,
              currentInstallment: i,
              groupId: installmentGroupId,
              originalAmount: amountCents,
              visibility,
              personalOwnerUserId: personalOwnerUserId ?? null,
              status: "confirmed",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          // Recriou como simples
          if (data.type === "expense") {
            const { visibility, personalOwnerUserId } = resolveExpenseVisibility(data);
            batch.set(doc(transactionsRef(activeGroupId)), {
              description: data.description.trim(),
              coupleId: activeGroupId,
              amount: amountCents,
              date: data.date,
              monthKey: getMonthKey(data.date),
              type: "expense",
              paidByUserId: data.paidByUserId,
              splitBetweenUserIds: data.splitBetweenUserIds,
              splitMode: data.splitMode,
              visibility,
              personalOwnerUserId: personalOwnerUserId ?? null,
              status: "confirmed",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            const { visibility, personalOwnerUserId } = resolveSettlementVisibility(data);
            batch.set(doc(transactionsRef(activeGroupId)), {
              description: data.description.trim(),
              coupleId: activeGroupId,
              amount: amountCents,
              date: data.date,
              monthKey: getMonthKey(data.date),
              type: "settlement",
              fromUserId: data.fromUserId,
              toUserId: data.toUserId,
              visibility,
              personalOwnerUserId: personalOwnerUserId ?? null,
              status: "confirmed",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        await batch.commit();
        return;
      }

      // ─── Cenário B: edição simples ──────────────────────────────────────
      const baseData = {
        description: data.description.trim(),
        amount: amountCents,
        date: data.date,
        monthKey: getMonthKey(data.date),
        updatedAt: serverTimestamp(),
        status: "confirmed" as const,
      };

      let docData;
      if (data.type === "expense") {
        const { visibility, personalOwnerUserId } = resolveExpenseVisibility(data);
        docData = {
          ...baseData,
          type: "expense" as const,
          paidByUserId: data.paidByUserId,
          splitBetweenUserIds: data.splitBetweenUserIds,
          splitMode: data.splitMode,
          visibility,
          personalOwnerUserId: personalOwnerUserId ?? null,
          // Se o documento antigo tinha um groupId inválido, não o carregue
          // para futuras edições, onde ele poderia parecer parcelamento.
          groupId: deleteField(),
        };
      } else {
        const { visibility, personalOwnerUserId } = resolveSettlementVisibility(data);
        docData = {
          ...baseData,
          type: "settlement" as const,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          visibility,
          personalOwnerUserId: personalOwnerUserId ?? null,
        };
      }

      await updateDoc(transactionDocRef(activeGroupId, originalTransaction.id), docData);
    },
    [group]
  );

  const deleteTransaction = useCallback(async (transaction: Transaction) => {
    if (!group) throw new Error("Grupo não carregado.");
    const activeGroupId = group.id;

    if (transaction.type === "expense" && transaction.groupId && transaction.groupId !== activeGroupId) {
      const q = query(
        transactionsRef(activeGroupId),
        where("groupId", "==", transaction.groupId)
      );
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
    } else {
      await deleteDoc(transactionDocRef(activeGroupId, transaction.id));
    }
  }, [group]);

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
```

---

## 📄 Arquivo: `api/webhook-apple-pay.ts`

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import { initFirebaseAdmin } from "./_firebase-admin.js";
import { sendPendingExpenseRegistered, sendPushToGroup } from "./push.js";

// Inicializa Firebase Admin SDK
initFirebaseAdmin();

// ── Helpers ────────────────────────────────────────────────────────────────────


/** Extrai "YYYY-MM" a partir de "YYYY-MM-DD", garantindo formato válido. */
function getMonthKey(date: string): string {
  const safe = sanitizeWebhookDate(date);
  return safe.slice(0, 7);
}

/**
 * Sanitiza um clientEventId para uso seguro como ID de documento Firestore.
 * Remove caracteres inválidos; trunca para 128 chars.
 */
function sanitizeEventId(raw: string): string {
  return raw
    .replace(/[/\\.\s#$[\]]/g, "_")
    .slice(0, 128);
}

/**
 * Higieniza e converte um valor monetário para centavos.
 * Aceita: "R$ 15,90", "15.90", " 15,90 ", "BRL 15.90", "1590" etc.
 * Retorna null se o resultado for zero, negativo ou não-numérico.
 */
function toCents(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  let raw = String(value).trim();

  // Remove tudo que não seja dígito, vírgula ou ponto
  raw = raw.replace(/[^\d,.]/g, "");

  if (!raw) return null;

  // Detecta o separador decimal:
  // "1.234,56" → ponto como milhar, vírgula como decimal → remove ponto, troca vírgula
  // "1,234.56" → vírgula como milhar, ponto como decimal → remove vírgula
  // "15,90"    → só vírgula → troca por ponto
  // "15.90"    → só ponto   → manter
  const hasComma = raw.includes(",");
  const hasDot   = raw.includes(".");

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot   = raw.lastIndexOf(".");
    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (hasComma) {
    raw = raw.replace(",", ".");
  }

  const num = parseFloat(raw);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num * 100);
}

/** Valida formato YYYY-MM-DD com ano, mês (01-12) e dia (01-31). */
function isValidDate(date: unknown): date is string {
  if (typeof date !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 2020 || year > 2050) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

/** Data de hoje no formato YYYY-MM-DD usando o relógio do servidor. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sanitiza a data para YYYY-MM-DD garantindo mês válido.
 * Se o atalho do iOS enviar minutos no lugar do mês (ex: 2026-36-23),
 * preserva o dia e o ano e usa o mês atual.
 */
function sanitizeWebhookDate(date: unknown): string {
  if (isValidDate(date)) return date;
  const now = new Date();
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, , d] = date.split("-").map(Number);
    const safeYear = y >= 2020 && y <= 2050 ? y : now.getFullYear();
    const safeMonth = String(now.getMonth() + 1).padStart(2, "0");
    const safeDay = d >= 1 && d <= 31 ? String(d).padStart(2, "0") : String(now.getDate()).padStart(2, "0");
    return `${safeYear}-${safeMonth}-${safeDay}`;
  }
  return todayISO();
}

// ── Resultado da validação ────────────────────────────────────────────────────
// Objeto simples com errorReason opcional para evitar problemas de narrowing
// de union types no compilador do Vercel.
type ValidationResult = {
  amountCents: number;    // 0 = falha
  description: string;
  finalDate: string;
  errorReason?: string;   // definido apenas quando a validação falha
};

/**
 * Validação com higienização inteligente:
 * - Amount: limpa símbolos antes de converter
 * - Description: usa "Compra Apple Pay" se ausente (NÃO falha)
 * - Date: sanitiza mês/dia inválidos preservando dados úteis, ou usa hoje
 * - Falha APENAS se o amount for irrecuperável (retorna errorReason)
 */
function validateBody(body: Record<string, unknown>): ValidationResult {
  const { amount, description, date } = body;

  // 1. Higieniza e valida o amount — único motivo de fallback real
  const amountCents = toCents(amount) ?? 0;
  if (amountCents <= 0) {
    return {
      amountCents: 0,
      description: "",
      finalDate: sanitizeWebhookDate(date),
      errorReason: `Valor irrecuperável: "${String(amount ?? "ausente")}"`,
    };
  }

  // 2. Description: usa padrão se vazio/nulo/undefined/"undefined"
  const rawDesc = typeof description === "string" ? description.trim() : "";
  const finalDescription =
    rawDesc === "" || rawDesc.toLowerCase() === "undefined"
      ? "Compra Apple Pay"
      : rawDesc;

  // 3. Date: sanitiza garantindo data e mês válidos
  const finalDate = sanitizeWebhookDate(date);

  return { amountCents, description: finalDescription, finalDate };
}

/**
 * Cria uma despesa de "alerta" na caixa de Pendentes quando
 * a validação falha — amount completamente irrecuperável.
 */
async function saveFallbackExpense(
  db: FirebaseFirestore.Firestore,
  groupId: string,
  reason: string,
  rawBody: Record<string, unknown>
): Promise<string> {
  const fallbackDate = isValidDate(rawBody.date) ? (rawBody.date as string) : todayISO();

  const docData = {
    type:        "expense",
    description: `⚠️ Erro Apple Pay: ${reason}`,
    amount:      1,
    date:        fallbackDate,
    monthKey:    getMonthKey(fallbackDate),
    coupleId:      groupId,
    paidByUserId: null,
    personalOwnerUserId: null,
    splitMode:   "personal",
    visibility:  "personal",
    status:      "pending",
    source:      "webhook-apple-pay-fallback",
    rawPayload:  JSON.stringify(rawBody).slice(0, 500),
    createdAt:   FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
  };

  const ref = await db
    .collection("groups")
    .doc(groupId)
    .collection("transactions")
    .add(docData);

  console.warn(`[webhook] Fallback criado: ${ref.id} — Motivo: ${reason}`);
  return ref.id;
}

/**
 * Envia um alerta crítico de forma best-effort e data-only.
 * O service worker é o único responsável pela exibição em background.
 */
async function sendCriticalAlert(
  db: FirebaseFirestore.Firestore,
  groupId: string,
  message: string
): Promise<void> {
  if (!getApps().length) return;

  try {
    const result = await sendPushToGroup(db, {
      groupId,
      title: "🚨 CasalPay — Alerta Apple Pay",
      body: message,
      tag: "casalpay-critical-alert",
      kind: "system",
    });

    console.log(`[webhook] Alerta enviado: ${result.successCount} ok, ${result.failureCount} falha(s).`);
  } catch (notifErr) {
    const msg = notifErr instanceof Error ? notifErr.message : String(notifErr);
    console.error("[webhook] Falha ao enviar alerta FCM:", msg);
  }
}






/**
 * Verifica idempotência via coleção apple_pay_events.
 * Retorna o ID da transação existente se for duplicata, ou null se for novo.
 *
 * Estrutura Firestore:
 *   couples/{coupleId}/apple_pay_events/{sanitizedEventId}
 *     → { transactionId, amountCents, description, date, processedAt }
 */
async function checkAndRegisterEvent(
  db: FirebaseFirestore.Firestore,
  groupId: string,
  eventId: string
): Promise<string | null> {
  const sanitized = sanitizeEventId(eventId);
  const eventRef = db
    .collection("groups")
    .doc(groupId)
    .collection("apple_pay_events")
    .doc(sanitized);

  const snap = await eventRef.get();
  if (snap.exists) {
    // Já foi processado — retorna o ID da transação original
    const data = snap.data() as { transactionId?: string };
    return data.transactionId ?? "__unknown__";
  }
  return null; // ainda não processado
}

/**
 * Registra o evento como processado após criar a transação.
 */
async function markEventProcessed(
  db: FirebaseFirestore.Firestore,
  groupId: string,
  eventId: string,
  transactionId: string,
  meta: { amountCents: number; description: string; date: string }
): Promise<void> {
  const sanitized = sanitizeEventId(eventId);
  await db
    .collection("groups")
    .doc(groupId)
    .collection("apple_pay_events")
    .doc(sanitized)
    .set({
      transactionId,
      amountCents:  meta.amountCents,
      description:  meta.description,
      date:         meta.date,
      processedAt:  FieldValue.serverTimestamp(),
    });
}

// ── Lógica central reutilizável (usada pelo webhook e pelo sync) ───────────────

export type ProcessEventResult = {
  ok: boolean;
  id: string;
  duplicate?: boolean;
  fallback?: boolean;
  reason?: string;
  idempotent: boolean;
  warning?: string;
  amountCents?: number;
  description?: string;
};

/**
 * Processa um único evento Apple Pay de forma idempotente.
 * Reutilizado pelo webhook individual e pelo endpoint de sync em lote.
 */
export async function processApplePayEvent(
  db: FirebaseFirestore.Firestore,
  groupId: string,
  rawBody: Record<string, unknown>
): Promise<ProcessEventResult> {
  const clientEventId = typeof rawBody.clientEventId === "string"
    ? rawBody.clientEventId.trim()
    : "";

  // ── Idempotência ──────────────────────────────────────────────────────────
  if (clientEventId) {
    const existingId = await checkAndRegisterEvent(db, groupId, clientEventId);
    if (existingId) {
      console.log(`[webhook] Evento duplicado ignorado: clientEventId="${clientEventId}" → transação="${existingId}"`);
      return { ok: true, duplicate: true, id: existingId, idempotent: true };
    }
  }

  // ── Validação ─────────────────────────────────────────────────────────────
  const validation = validateBody(rawBody);

  if (validation.errorReason) {
    const reason = validation.errorReason;
    console.warn(`[webhook] Validação falhou — ${reason} | clientEventId="${clientEventId}"`);

    const fallbackId = await saveFallbackExpense(db, groupId, reason, rawBody);

    // Registra o evento de fallback também (evita spam duplicado)
    if (clientEventId) {
      await markEventProcessed(db, groupId, clientEventId, fallbackId, {
        amountCents: 0,
        description: `fallback: ${reason}`,
        date:        validation.finalDate,
      });
    }

    return {
      ok:        false,
      fallback:  true,
      id:        fallbackId,
      reason,
      idempotent: Boolean(clientEventId),
      amountCents: 0,
      description: `fallback: ${reason}`,
    };
  }

  // ── Cria transação Pendente ───────────────────────────────────────────────
  const { amountCents, description, finalDate } = validation;
  const monthKey = getMonthKey(finalDate);

  const docData = {
    type:        "expense",
    description,
    amount:      amountCents,
    date:        finalDate,
    monthKey,
    // A subcoleção já usa groupId no caminho; no documento, mantenha apenas
    // o campo de compatibilidade coupleId. groupId é reservado ao grupo de parcelas.
    coupleId:    groupId,
    paidByUserId: null,
    personalOwnerUserId: null,
    splitMode:   "personal",
    visibility:  "personal",
    status:      "pending",
    source:      rawBody.source ?? "webhook-apple-pay",
    clientEventId: clientEventId || null,
    deviceUser:  rawBody.deviceUser ?? null,
    capturedAt:  rawBody.capturedAt ?? null,
    createdAt:   FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
  };

  const ref = await db
    .collection("groups")
    .doc(groupId)
    .collection("transactions")
    .add(docData);

  console.log(
    `[webhook] Despesa criada: id="${ref.id}" | desc="${description}" | R$ ${(amountCents / 100).toFixed(2)} | clientEventId="${clientEventId}"`
  );

  // Registra o evento como processado para deduplicação futura
  if (clientEventId) {
    await markEventProcessed(db, groupId, clientEventId, ref.id, {
      amountCents,
      description,
      date: finalDate,
    });
  }

  // O aviso acontece depois da persistência e também vale para eventos
  // recebidos pelo endpoint de sincronização offline.
  try {
    const pushResult = await sendPendingExpenseRegistered(db, groupId, {
      amountCents,
      description,
      deviceUser: rawBody.deviceUser,
    });
    console.log(
      `[webhook] Aviso de pendência enviado: ${pushResult.successCount}/${pushResult.tokenCount} dispositivo(s)`
    );
  } catch (pushErr) {
    // Push é best-effort: uma falha de notificação não desfaz a compra salva.
    console.error("[webhook] Falha ao enviar aviso de pendência:", pushErr);
  }

  const result: ProcessEventResult = {
    ok:         true,
    id:         ref.id,
    idempotent: Boolean(clientEventId),
    amountCents,
    description,
  };

  if (!clientEventId) {
    result.warning = "clientEventId ausente: este envio não é idempotente. Reenvios podem criar duplicatas.";
  }

  return result;
}

// ── Handler Principal ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigins = ["https://casalpay.vercel.app"];
  
  if (origin && (allowedOrigins.includes(origin) || origin.startsWith("http://localhost:"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://casalpay.vercel.app");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ error: "Method not allowed" });

  // ── Autenticação Estrita via Header HTTP ───────────────────────────────────
  // Rejeita qualquer tentativa de autenticação via query string para evitar vazamento em logs/URLs
  const authHeader     = req.headers.authorization ?? "";
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("[webhook] WEBHOOK_SECRET não configurado nas variáveis de ambiente");
    return res.status(500).json({ error: "Server config error" });
  }

  // Exige estritamente Authorization: Bearer <WEBHOOK_SECRET>
  const isAuthHeaderValid = authHeader === `Bearer ${WEBHOOK_SECRET}`;

  if (!isAuthHeaderValid) {
    console.warn("[webhook] Acesso não autorizado: Header Authorization inválido ou ausente");
    return res.status(401).json({ error: "Unauthorized: Missing or invalid Authorization header" });
  }

  if (!getApps().length) {
    return res.status(500).json({ error: "Firebase Admin não inicializado" });
  }

  const db        = getFirestore();
  const rawBody   = (req.body ?? {}) as Record<string, unknown>;

  const groupId =
    (req.query.groupId as string) ||
    (rawBody.groupId as string) ||
    process.env.VITE_COUPLE_ID ||
    "arthur-namorada-2026";

  try {
    const result = await processApplePayEvent(db, groupId, rawBody);

    // Alert FCM apenas em falhas reais (não duplicatas nem warnings de idempotência)
    if (result.fallback) {
      // Background (não usa await) para não travar o webhook
      sendCriticalAlert(
        db,
        groupId,
        `Compra Apple Pay com valor irrecuperável. Motivo: "${result.reason}". Verifique a aba Pendentes.`
      ).catch(console.error);
    }

    const httpStatus = result.ok
      ? (result.duplicate ? 200 : 201)
      : 200; // fallback retorna 200 (aceito com aviso)

    return res.status(httpStatus).json({ 
      ...result, 
      amount: result.amountCents ? (result.amountCents / 100) : undefined
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] Erro crítico de infraestrutura:", msg);

    try {
      sendCriticalAlert(
        db,
        groupId,
        "Falha crítica ao registrar compra no Apple Pay. Verifique o sistema."
      ).catch(() => {});
    } catch {
      // silencia
    }

    return res.status(500).json({ error: "Internal server error", detail: msg });
  }
}
```

---

