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
 * Dívida direta entre um par (devedor → credor), SEM otimização de rotas.
 * Preserva a relação original "X deve para Gabi" e "X deve para Miguel" separadamente.
 */
export interface DirectDebt {
  debtorId: string;
  creditorId: string;
  amount: number;
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
