import type { Timestamp } from "firebase/firestore";

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
