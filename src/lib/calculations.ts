import type {
  BalanceSummary,
  ExpenseTransaction,
  SettlementTransaction,
  Transaction,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Dívida gerada por UMA despesa
// Retorna valor em centavos: positivo = Zara deve ao Arthur
//                            negativo = Arthur deve à Zara
// ─────────────────────────────────────────────────────────────────────────────
export function calculateExpenseDebt(t: ExpenseTransaction): number {
  const { amount, paidBy, splitType } = t;

  if (splitType === "50/50") {
    // Math.floor: quem pagou absorve o centavo extra em valores ímpares.
    // Ex: R$10,01 → 1001 centavos. half = 500. Zara deve 500, Arthur absorve 501.
    const half = Math.floor(amount / 2);
    return paidBy === "Arthur" ? half : -half;
  }

  if (paidBy === "Arthur") {
    if (splitType === "100% Zara") return amount; // Zara deve tudo
    if (splitType === "100% Arthur") return 0;         // Sem dívida
  }

  if (paidBy === "Zara") {
    if (splitType === "100% Arthur") return -amount;   // Arthur deve tudo
    if (splitType === "100% Zara") return 0;        // Sem dívida
  }

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Efeito de um Pix/acerto no saldo
// Retorna valor em centavos: positivo = reduz dívida da Zara
//                            negativo = reduz dívida do Arthur
// ─────────────────────────────────────────────────────────────────────────────
export function calculateSettlementEffect(t: SettlementTransaction): number {
  const { amount, from } = t;
  // Quem envia o Pix está pagando a própria dívida
  // Zara → Arthur: ela está quitando o que devia → reduz zaraOwes
  if (from === "Zara") return -amount; // abate dívida da Zara
  if (from === "Arthur") return amount;    // abate dívida do Arthur
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumo financeiro completo do mês
// ─────────────────────────────────────────────────────────────────────────────
export function calculateBalance(transactions: Transaction[]): BalanceSummary {
  let totalExpensesByArthur = 0;
  let totalExpensesByZara = 0;
  let totalSettledByArthur = 0;
  let totalSettledByZara = 0;
  let expenseCount = 0;
  let settlementCount = 0;

  // Saldo bruto de despesas (sem settlements)
  let rawDebt = 0; // positivo = Zara deve; negativo = Arthur deve

  for (const t of transactions) {
    if (t.type === "expense") {
      expenseCount++;
      if (t.paidBy === "Arthur") totalExpensesByArthur += t.amount;
      else totalExpensesByZara += t.amount;
      rawDebt += calculateExpenseDebt(t);
    } else {
      settlementCount++;
      if (t.from === "Arthur") totalSettledByArthur += t.amount;
      else totalSettledByZara += t.amount;
      // Settlements abatam a dívida
      rawDebt += calculateSettlementEffect(t);
    }
  }

  return {
    totalExpensesByArthur,
    totalExpensesByZara,
    totalExpenses: totalExpensesByArthur + totalExpensesByZara,
    totalSettledByArthur,
    totalSettledByZara,
    netBalance: rawDebt,
    expenseCount,
    settlementCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Texto para copiar no WhatsApp / Pix
// ─────────────────────────────────────────────────────────────────────────────
export function generatePixSummary(
  balance: BalanceSummary,
  monthLabel: string
): string {
  const abs = Math.abs(balance.netBalance);
  const formatted = formatCentsToBRL(abs);

  if (balance.netBalance === 0) {
    return `CasalPay — ${monthLabel}: Zerado! Nenhum Pix necessário ✅`;
  }
  if (balance.netBalance > 0) {
    return `CasalPay — ${monthLabel}: Zara deve R$ ${formatted} para Arthur 💙`;
  }
  return `CasalPay — ${monthLabel}: Arthur deve R$ ${formatted} para a Zara 🩷`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Converte string de valor (ex: "12,50" ou "12.50") para centavos. */
export function parseToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

/** Gera o monthKey "YYYY-MM" a partir de uma data "YYYY-MM-DD". */
export function getMonthKey(date: string): string {
  return date.slice(0, 7);
}
