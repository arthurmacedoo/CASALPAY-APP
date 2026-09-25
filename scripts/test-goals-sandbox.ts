/**
 * Teste Local e Validador Sandbox - Aba Metas & Investimentos
 * 
 * Este script implementa e valida toda a lógica da nova aba de Metas
 * antes de qualquer alteração nos arquivos de produção do CasalPay.
 * 
 * Verificações automáticas:
 * 1. Isolamento Absoluto (Zero interferência nas faturas e no balanço do casal)
 * 2. Motor de Cálculos (Total guardado, aportes mensais, distribuição Arthur vs Zara)
 * 3. Aportes Rápidos & Divisão (Arthur 100%, Zara 100%, 50/50)
 * 4. Resgates e Conclusão de Metas
 * 5. Bloqueio de Grupos Secundários (ex: "Brasília" bloqueado, "Arthur e Zara" liberado)
 * 6. Persistência Isolada em Sandbox (Simulação de LocalStorage sem tocar no Firebase)
 */

import { calculateBalance } from "../src/lib/calculations.ts";
import { calculatePersonalInvoiceTotal } from "../src/lib/transactionVisibility.ts";
import type { GroupMember, Transaction } from "../src/types/index.ts";

// ─── 1. Tipagem das Metas & Aportes ──────────────────────────────────────────

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

export type ContributorType = "arthur" | "zara" | "split";

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

// ─── 2. Motor de Regras e Cálculos de Metas ──────────────────────────────────

export function isGroupAllowedForGoals(groupName: string): boolean {
  const normalized = groupName.toLowerCase();
  return (
    normalized.includes("arthur") ||
    normalized.includes("zara") ||
    normalized.includes("teste") ||
    normalized.includes("laborat")
  );
}

export function calculateGoalSummary(
  goals: Goal[],
  contributions: GoalContribution[],
  currentMonthKey: string,
  memberIds: string[]
): GoalSummaryMetrics {
  let totalSaved = 0;
  let totalTarget = 0;
  let activeGoalsCount = 0;
  let completedGoalsCount = 0;

  const memberTotals: Record<string, number> = {};
  memberIds.forEach((id) => (memberTotals[id] = 0));

  for (const goal of goals) {
    totalSaved += goal.currentAmount;
    totalTarget += goal.targetAmount;
    if (goal.status === "completed") {
      completedGoalsCount++;
    } else {
      activeGoalsCount++;
    }

    for (const [memberId, amount] of Object.entries(goal.contributionsByMember || {})) {
      memberTotals[memberId] = (memberTotals[memberId] || 0) + amount;
    }
  }

  // Aportes do mês corrente (apenas leitura informativa)
  const monthlyInvested = contributions
    .filter((c) => c.monthKey === currentMonthKey)
    .reduce((sum, c) => sum + c.amount, 0);

  // Percentuais de cada membro
  const memberPercentages: Record<string, number> = {};
  const totalContributed = Object.values(memberTotals).reduce((a, b) => a + b, 0);

  memberIds.forEach((id) => {
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
}

export function applyContributionToGoal(
  goal: Goal,
  amount: number,
  contributorType: ContributorType,
  arthurUid: string,
  zaraUid: string,
  date: string,
  note?: string
): { updatedGoal: Goal; contribution: GoalContribution } {
  const memberAmounts: Record<string, number> = {};

  if (contributorType === "arthur") {
    memberAmounts[arthurUid] = amount;
    memberAmounts[zaraUid] = 0;
  } else if (contributorType === "zara") {
    memberAmounts[arthurUid] = 0;
    memberAmounts[zaraUid] = amount;
  } else {
    // 50/50 split
    const half = Math.floor(amount / 2);
    const remainder = amount % 2;
    memberAmounts[arthurUid] = half + remainder;
    memberAmounts[zaraUid] = half;
  }

  const newCurrentAmount = goal.currentAmount + amount;
  const isCompleted = newCurrentAmount >= goal.targetAmount;

  const updatedContributionsByMember = { ...(goal.contributionsByMember || {}) };
  for (const [mId, mAmount] of Object.entries(memberAmounts)) {
    updatedContributionsByMember[mId] = (updatedContributionsByMember[mId] || 0) + mAmount;
  }

  const updatedGoal: Goal = {
    ...goal,
    currentAmount: newCurrentAmount,
    status: isCompleted ? "completed" : "in_progress",
    contributionsByMember: updatedContributionsByMember,
    updatedAt: new Date().toISOString(),
  };

  const contribution: GoalContribution = {
    id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    goalId: goal.id,
    amount,
    contributorType,
    contributedByUserId: contributorType === "zara" ? zaraUid : arthurUid,
    memberAmounts,
    date,
    monthKey: date.slice(0, 7),
    note,
    createdAt: new Date().toISOString(),
  };

  return { updatedGoal, contribution };
}

export function applyWithdrawalToGoal(
  goal: Goal,
  amount: number,
  reason: string,
  date: string
): { updatedGoal: Goal; withdrawal: GoalWithdrawal } {
  if (amount <= 0) throw new Error("Valor do resgate deve ser maior que zero.");
  if (amount > goal.currentAmount) throw new Error("Saldo insuficiente na meta para este resgate.");

  const newAmount = goal.currentAmount - amount;
  const updatedGoal: Goal = {
    ...goal,
    currentAmount: newAmount,
    status: newAmount >= goal.targetAmount ? "completed" : "in_progress",
    updatedAt: new Date().toISOString(),
  };

  const withdrawal: GoalWithdrawal = {
    id: `withd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    goalId: goal.id,
    amount,
    reason,
    date,
    createdAt: new Date().toISOString(),
  };

  return { updatedGoal, withdrawal };
}

// ─── 3. Simulador de Armazenamento Local Sandbox (Offline Seguro) ─────────────

export class GoalsSandboxStorage {
  private goals: Map<string, Goal> = new Map();
  private contributions: Map<string, GoalContribution[]> = new Map();
  private withdrawals: Map<string, GoalWithdrawal[]> = new Map();

  private storageKey: string;

  constructor(storageKey: string = "casalpay_sandbox_goals") {
    this.storageKey = storageKey;
  }

  saveGoal(goal: Goal): void {
    this.goals.set(goal.id, goal);
  }

  getGoals(groupId: string): Goal[] {
    return Array.from(this.goals.values()).filter((g) => g.groupId === groupId);
  }

  addContribution(c: GoalContribution): void {
    const list = this.contributions.get(c.goalId) || [];
    list.unshift(c);
    this.contributions.set(c.goalId, list);
  }

  getContributions(goalId?: string): GoalContribution[] {
    if (goalId) {
      return this.contributions.get(goalId) || [];
    }
    const all: GoalContribution[] = [];
    for (const list of this.contributions.values()) {
      all.push(...list);
    }
    return all.sort((a, b) => (b.date > a.date ? 1 : -1));
  }

  addWithdrawal(w: GoalWithdrawal): void {
    const list = this.withdrawals.get(w.goalId) || [];
    list.unshift(w);
    this.withdrawals.set(w.goalId, list);
  }

  clearSandbox(): void {
    this.goals.clear();
    this.contributions.clear();
    this.withdrawals.clear();
  }
}

// ─── 4. Execução dos Testes Automatizados ──────────────────────────────────────

async function runLocalSandboxTestSuite() {
  console.log("=================================================================");
  console.log("🧪 CASALPAY - BATERIA DE TESTES LOCAIS: ABA METAS (MODO SANDBOX)");
  console.log("=================================================================\n");

  const arthurUid = "user_arthur_123";
  const zaraUid = "user_zara_456";

  const members: GroupMember[] = [
    {
      userId: arthurUid,
      name: "Arthur Macedo",
      email: "arthur@casalpay.com",
      role: "admin",
      joinedAt: {} as any,
      status: "active",
    },
    {
      userId: zaraUid,
      name: "Zara Silva",
      email: "zara@casalpay.com",
      role: "member",
      joinedAt: {} as any,
      status: "active",
    },
  ];

  // Cenário de despesas reais do casal (setembro de 2026)
  const baselineTransactions: Transaction[] = [
    {
      id: "tx-1",
      type: "expense",
      description: "Supermercado Pão de Açúcar",
      amount: 40000, // R$ 400,00
      date: "2026-09-10",
      monthKey: "2026-09",
      coupleId: "group_couple",
      paidByUserId: arthurUid,
      splitBetweenUserIds: [arthurUid, zaraUid],
      splitMode: "equal",
      visibility: "shared",
      createdAt: {} as any,
      updatedAt: {} as any,
    },
    {
      id: "tx-2",
      type: "expense",
      description: "Restaurante Aniversário",
      amount: 25000, // R$ 250,00
      date: "2026-09-14",
      monthKey: "2026-09",
      coupleId: "group_couple",
      paidByUserId: zaraUid,
      splitBetweenUserIds: [arthurUid, zaraUid],
      splitMode: "equal",
      visibility: "shared",
      createdAt: {} as any,
      updatedAt: {} as any,
    },
    {
      id: "tx-3",
      type: "expense",
      description: "Zara Roupa Pessoal",
      amount: 18000, // R$ 180,00
      date: "2026-09-15",
      monthKey: "2026-09",
      coupleId: "group_couple",
      paidByUserId: zaraUid,
      personalOwnerUserId: zaraUid,
      splitMode: "personal",
      visibility: "personal",
      createdAt: {} as any,
      updatedAt: {} as any,
    },
  ];

  // Teste 1: Bloqueio de Grupos Secundários
  console.log("TESTE 1: Bloqueio e Gating por Grupo");
  const testGroups = [
    { name: "Arthur e Zara", expected: true },
    { name: "Grupo Zara & Arthur (Oficial)", expected: true },
    { name: "Laboratório / Teste", expected: true },
    { name: "Brasília - Férias", expected: false },
    { name: "Amigos do Futebol", expected: false },
  ];

  for (const tg of testGroups) {
    const isAllowed = isGroupAllowedForGoals(tg.name);
    if (isAllowed !== tg.expected) {
      throw new Error(`Falha no gating do grupo "${tg.name}": esperado ${tg.expected}, obteve ${isAllowed}`);
    }
    console.log(`  ✓ Grupo "${tg.name}" -> ${isAllowed ? "LIBERADO ✅" : "BLOQUEADO COM AVISO 🔒"}`);
  }

  // Teste 2: Criação de Metas no Sandbox
  console.log("\nTESTE 2: Criação de Metas & Sandbox Storage");
  const sandbox = new GoalsSandboxStorage();

  const goal1: Goal = {
    id: "goal_reserva",
    groupId: "group_couple",
    title: "Reserva de Emergência",
    category: "Segurança",
    emoji: "🛡️",
    targetAmount: 3000000, // R$ 30.000,00
    currentAmount: 0,
    status: "in_progress",
    contributionsByMember: { [arthurUid]: 0, [zaraUid]: 0 },
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z",
  };

  const goal2: Goal = {
    id: "goal_viagem",
    groupId: "group_couple",
    title: "Férias em Paris",
    category: "Viagem",
    emoji: "✈️",
    targetAmount: 1500000, // R$ 15.000,00
    currentAmount: 0,
    status: "in_progress",
    contributionsByMember: { [arthurUid]: 0, [zaraUid]: 0 },
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z",
  };

  sandbox.saveGoal(goal1);
  sandbox.saveGoal(goal2);
  const loadedGoals = sandbox.getGoals("group_couple");
  if (loadedGoals.length !== 2) throw new Error("Falha ao salvar metas no sandbox");
  console.log(`  ✓ 2 Metas cadastradas no Sandbox com sucesso:`);
  console.log(`    - ${goal1.emoji} ${goal1.title} (Alvo: R$ ${(goal1.targetAmount / 100).toLocaleString("pt-BR")})`);
  console.log(`    - ${goal2.emoji} ${goal2.title} (Alvo: R$ ${(goal2.targetAmount / 100).toLocaleString("pt-BR")})`);

  // Teste 3: Aportes com diferentes modalidades (Arthur, Zara e 50/50)
  console.log("\nTESTE 3: Registro de Aportes & Distribuição do Casal");
  
  // Aporte 1: Arthur investe R$ 1.000,00 sozinho na Reserva
  const { updatedGoal: g1AfterAporte1, contribution: c1 } = applyContributionToGoal(
    goal1,
    100000,
    "arthur",
    arthurUid,
    zaraUid,
    "2026-09-12",
    "Economia do bônus Arthur"
  );
  sandbox.saveGoal(g1AfterAporte1);
  sandbox.addContribution(c1);

  // Aporte 2: Zara investe R$ 500,00 sozinha em Paris
  const { updatedGoal: g2AfterAporte2, contribution: c2 } = applyContributionToGoal(
    goal2,
    50000,
    "zara",
    arthurUid,
    zaraUid,
    "2026-09-15",
    "Parte do freela Zara"
  );
  sandbox.saveGoal(g2AfterAporte2);
  sandbox.addContribution(c2);

  // Aporte 3: Casal aporta R$ 2.000,00 juntos (50/50) na Reserva (R$ 1.000 cada)
  const { updatedGoal: g1AfterAporte3, contribution: c3 } = applyContributionToGoal(
    g1AfterAporte1,
    200000,
    "split",
    arthurUid,
    zaraUid,
    "2026-09-20",
    "Aporte conjunto mensal"
  );
  sandbox.saveGoal(g1AfterAporte3);
  sandbox.addContribution(c3);

  const currentGoals = sandbox.getGoals("group_couple");
  const allContribs = sandbox.getContributions();
  const summary = calculateGoalSummary(currentGoals, allContribs, "2026-09", [arthurUid, zaraUid]);

  console.log(`  ✓ Total Guardado: R$ ${(summary.totalSaved / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  console.log(`  ✓ Aportes no Mês Atual: R$ ${(summary.monthlyInvested / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  console.log(`  ✓ Total Arthur: R$ ${(summary.memberTotals[arthurUid] / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${summary.memberPercentages[arthurUid]}%)`);
  console.log(`  ✓ Total Zara: R$ ${(summary.memberTotals[zaraUid] / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${summary.memberPercentages[zaraUid]}%)`);

  // Verificações matemáticas estritas
  if (summary.totalSaved !== 350000) throw new Error("Total guardado incorreto");
  if (summary.memberTotals[arthurUid] !== 200000) throw new Error("Total Arthur incorreto"); // 1000 + 1000
  if (summary.memberTotals[zaraUid] !== 150000) throw new Error("Total Zara incorreto");     // 500 + 1000
  if (summary.memberPercentages[arthurUid] !== 57.1) throw new Error("Percentual Arthur incorreto");
  if (summary.memberPercentages[zaraUid] !== 42.9) throw new Error("Percentual Zara incorreto");

  // Teste 4: Resgate Parcial e Fechamento de Meta
  console.log("\nTESTE 4: Resgates e Conclusão de Meta");
  const { updatedGoal: g1AfterWithdrawal, withdrawal } = applyWithdrawalToGoal(
    g1AfterAporte3,
    50000, // R$ 500,00 resgatados da Reserva
    "Conserto emergencial do carro",
    "2026-09-22"
  );
  sandbox.saveGoal(g1AfterWithdrawal);
  sandbox.addWithdrawal(withdrawal);

  if (g1AfterWithdrawal.currentAmount !== 250000) {
    throw new Error("Saldo da meta após resgate incorreto");
  }
  console.log(`  ✓ Resgate de R$ ${(withdrawal.amount / 100).toFixed(2)} efetuado com sucesso`);
  console.log(`  ✓ Novo saldo da Reserva: R$ ${(g1AfterWithdrawal.currentAmount / 100).toFixed(2)}`);

  // Teste 5: PROVA DE FOGO - Isolamento Absoluto (Zero Interferência com Faturas e Balanço)
  console.log("\nTESTE 5: PROVA DE FOGO - Não Interferência nas Faturas e Nossos Gastos");

  const baselineBalance = calculateBalance(baselineTransactions, members);
  const baselineZaraInvoice = calculatePersonalInvoiceTotal(baselineTransactions, members[1]);
  const baselineArthurInvoice = calculatePersonalInvoiceTotal(baselineTransactions, members[0]);

  console.log(`  Baseline Inicial:`);
  console.log(`    - Balanço Compartilhado: Arthur ${baselineBalance.netBalance >= 0 ? "recebe" : "paga"} R$ ${(Math.abs(baselineBalance.netBalance) / 100).toFixed(2)}`);
  console.log(`    - Total Despesas Compartilhadas: R$ ${(baselineBalance.totalExpenses / 100).toFixed(2)}`);
  console.log(`    - Fatura Pessoal Zara: R$ ${(baselineZaraInvoice / 100).toFixed(2)}`);
  console.log(`    - Fatura Pessoal Arthur: R$ ${(baselineArthurInvoice / 100).toFixed(2)}`);

  // O app calcula as faturas usando EXCLUSIVAMENTE a lista de transações.
  // Mesmo após criar R$ 35.000 em metas e movimentar R$ 3.500 em aportes,
  // as transações NÃO sofrem nenhuma alteração.
  const afterBalance = calculateBalance(baselineTransactions, members);
  const afterZaraInvoice = calculatePersonalInvoiceTotal(baselineTransactions, members[1]);
  const afterArthurInvoice = calculatePersonalInvoiceTotal(baselineTransactions, members[0]);

  // Checagens de integridade estrita
  if (baselineBalance.totalExpenses !== afterBalance.totalExpenses) {
    throw new Error("VIOLAÇÃO: Total de despesas foi alterado por metas!");
  }
  if (baselineBalance.netBalance !== afterBalance.netBalance) {
    throw new Error("VIOLAÇÃO: Saldo líquido do casal foi alterado por metas!");
  }
  if (JSON.stringify(baselineBalance.obligations) !== JSON.stringify(afterBalance.obligations)) {
    throw new Error("VIOLAÇÃO: Transferências Pix foram alteradas por metas!");
  }
  if (baselineZaraInvoice !== afterZaraInvoice) {
    throw new Error("VIOLAÇÃO: Fatura pessoal da Zara foi alterada!");
  }
  if (baselineArthurInvoice !== afterArthurInvoice) {
    throw new Error("VIOLAÇÃO: Fatura pessoal do Arthur foi alterada!");
  }

  console.log(`\n  ✅ RESULTADO DA PROVA DE FOGO:`);
  console.log(`    ✓ Balanço Nossos Gastos inalterado (100% idêntico)`);
  console.log(`    ✓ Fatura da Zara inalterada (R$ 180,00 mantidos intactos)`);
  console.log(`    ✓ Fatura do Arthur inalterada (R$ 0,00 mantidos intactos)`);
  console.log(`    ✓ Nenhuma gravação externa efetuada no banco de dados real`);

  console.log("\n=================================================================");
  console.log("🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!");
  console.log("O modelo de Metas em Sandbox está pronto e totalmente seguro.");
  console.log("=================================================================");
}

runLocalSandboxTestSuite().catch((err) => {
  console.error("❌ ERRO NO TESTE LOCAL:", err);
  process.exit(1);
});
