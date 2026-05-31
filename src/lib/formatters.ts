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
 * Formata "YYYY-MM-DD" para "30/05/2026"
 */
export function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
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
    case "100% Arthur":
      return "Só do Arthur";
    case "100% Namorada":
      return "Só da Namorada";
    case "Pix Antecipado":
      return "Pix Antecipado 💸";
    default:
      return splitType;
  }
}
