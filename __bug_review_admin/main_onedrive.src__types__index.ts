import type { Timestamp } from "firebase/firestore";

// ─── Grupo (arquitetura definitiva: groups/{groupId}) ─────────────────────────
// Etapa 1: usado para criar contexto e membros.
// Etapa 1.5: transactions/apple_pay_events/fcm_tokens migrarão para groups/{groupId}/...

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
  createdBy: string;               // uid do criador
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Legado: aponta para couples/{coupleId} durante Etapa 1.
   *  Será removido na Etapa 1.5 quando as coleções forem migradas. */
  legacyCoupleId?: string;
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

// ─── Primitivos compartilhados ───────────────────────────────────────────────

export type Person = "owner" | "partner";
export type SplitType = "50/50" | "100% owner" | "100% partner";

// ─── Transação de despesa real ────────────────────────────────────────────────

export interface ExpenseTransaction {
  id: string;
  type: "expense";
  description: string;
  /** Valor em centavos (nunca ponto flutuante) */
  amount: number;
  paidBy: Person;
  splitType: SplitType;
  date: string;     // "2026-05-30"
  monthKey: string; // "2026-05"
  coupleId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Parcelamento (opcional)
  installmentCount?: number;
  currentInstallment?: number;
  groupId?: string;
  originalAmount?: number;
  /** Visibilidade para queries: shared (partilhado) ou personal (pessoal, ex: fatura) */
  visibility?: "shared" | "personal";
  /** Identificador real do usuário dono da fatura pessoal (Etapa 2.1) */
  personalOwnerUserId?: string;
  /** Status do ciclo de vida: pending = aguarda confirmação; confirmed = consolidada */
  status?: "pending" | "confirmed";
}

// ─── Transação de acerto / Pix ────────────────────────────────────────────────

export interface SettlementTransaction {
  id: string;
  type: "settlement";
  description: string;
  /** Valor em centavos */
  amount: number;
  /** Quem enviou o Pix / fez o pagamento */
  from: Person;
  /** Quem recebeu */
  to: Person;
  date: string;
  monthKey: string;
  coupleId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Destino do Pix: abater do dia a dia (shared) ou abater da fatura Zara (zara_card) */
  pixDestination?: "shared" | "zara_card";
  /** Visibilidade para queries: shared (partilhado) ou personal (pessoal, ex: fatura) */
  visibility?: "shared" | "personal";
  /** Identificador real do usuário dono da fatura pessoal (Etapa 2.1) */
  personalOwnerUserId?: string;
  /** Status do ciclo de vida: pending = aguarda confirmação; confirmed = consolidada */
  status?: "pending" | "confirmed";
}

// ─── Union type geral ─────────────────────────────────────────────────────────

export type Transaction = ExpenseTransaction | SettlementTransaction;

// ─── Form data (strings para inputs, convertidos para centavos na submissão) ──

export interface ExpenseFormData {
  type: "expense";
  description: string;
  amount: string;
  paidBy: Person;
  splitType: SplitType;
  date: string;
  isInstallment?: boolean;
  installmentCount?: number;
}

export interface SettlementFormData {
  type: "settlement";
  description: string;
  amount: string;
  from: Person;
  to: Person;
  date: string;
  pixDestination?: "shared" | "zara_card";
}

export type TransactionFormData = ExpenseFormData | SettlementFormData;

// ─── Resumo financeiro do mês ─────────────────────────────────────────────────

export interface BalanceSummary {
  /** Total em despesas pagas por Arthur (não inclui settlements) */
  totalExpensesByArthur: number;
  /** Total em despesas pagas pela Zara (não inclui settlements) */
  totalExpensesByZara: number;
  /** Soma de todas as despesas do mês */
  totalExpenses: number;
  /** Total de Pix/acertos enviados por Arthur */
  totalSettledByArthur: number;
  /** Total de Pix/acertos enviados pela Zara */
  totalSettledByZara: number;
  /** Saldo líquido: positivo = Zara deve ao Arthur; negativo = Arthur deve à Zara */
  netBalance: number;
  expenseCount: number;
  settlementCount: number;
}

export type BalanceDirection = "zara-owes" | "arthur-owes" | "even";

// ─── Nota arquitetural ────────────────────────────────────────────────────────
// Etapa 1: Person = "owner" | "partner" mantido para compatibilidade com
//   Fatura Zara (splitType "100% partner"), Pix/Acerto (from/to) e cálculos.
// Etapa 4+: paidBy e splitBetween serão migrados para userId[] genéricos
//   quando AddExpense suportar múltiplos membros.
