import type {
  BalanceSummary,
  ExpenseTransaction,
  SettlementTransaction,
  Transaction,
} from "../types";

export function calculateExpenseDebt(t: ExpenseTransaction): number {
  const { amount, paidBy, splitType } = t;

  if (splitType === "50/50") {
    const half = Math.floor(amount / 2);
    return paidBy === "Arthur" ? half : -half;
  }

  if (paidBy === "Arthur") {
    if (splitType === "100% Zara") return amount;
    if (splitType === "100% Arthur") return 0;
  }

  if (paidBy === "Zara") {
    if (splitType === "100% Arthur") return -amount;
    if (splitType === "100% Zara") return 0;
  }

  return 0;
}

export function calculateSettlementEffect(t: SettlementTransaction): number {
  const { amount, from } = t;
  if (from === "Zara") return -amount;
  if (from === "Arthur") return amount;
  return 0;
}

export function calculateBalance(transactions: Transaction[]): BalanceSummary {
  let totalExpensesByArthur = 0;
  let totalExpensesByZara = 0;
  let totalSettledByArthur = 0;
  let totalSettledByZara = 0;
  let expenseCount = 0;
  let settlementCount = 0;
  let rawDebt = 0;

  const validTransactions = transactions.filter(
    (t) => !(t.type === "settlement" && t.pixDestination === "zara_card")
  );

  for (const t of validTransactions) {
    if (t.type === "expense") {
      expenseCount++;
      if (t.paidBy === "Arthur") totalExpensesByArthur += t.amount;
      else totalExpensesByZara += t.amount;
      rawDebt += calculateExpenseDebt(t);
    } else {
      settlementCount++;
      if (t.from === "Arthur") totalSettledByArthur += t.amount;
      else totalSettledByZara += t.amount;
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
