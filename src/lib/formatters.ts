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
