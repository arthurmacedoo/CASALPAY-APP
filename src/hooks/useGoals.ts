import { useState, useEffect, useMemo, useCallback } from "react";
import { useGroupContext } from "../contexts/GroupContext";
import { getCurrentMonthKey, getTodayDateString } from "../lib/formatters";
import type {
  Goal,
  GoalContribution,
  GoalWithdrawal,
  GoalSummaryMetrics,
  ContributorType,
} from "../types";

const SANDBOX_STORAGE_KEY_PREFIX = "casalpay_sandbox_goals_";
const SANDBOX_CONTRIBS_KEY_PREFIX = "casalpay_sandbox_contribs_";
const SANDBOX_WITHDRAWALS_KEY_PREFIX = "casalpay_sandbox_withdrawals_";
const IS_SANDBOX_KEY = "casalpay_goals_is_sandbox";

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

  // Modo Sandbox ativo por padrão para garantir testes 100% seguros
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(IS_SANDBOX_KEY);
    return saved !== null ? saved === "true" : true;
  });

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

  // Carregar dados (Sandbox LocalStorage por padrão)
  useEffect(() => {
    if (!group) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (isSandboxMode) {
        const storedGoals = localStorage.getItem(`${SANDBOX_STORAGE_KEY_PREFIX}${groupId}`);
        const storedContribs = localStorage.getItem(`${SANDBOX_CONTRIBS_KEY_PREFIX}${groupId}`);
        const storedWithdrawals = localStorage.getItem(`${SANDBOX_WITHDRAWALS_KEY_PREFIX}${groupId}`);

        if (storedWithdrawals) {
          setWithdrawals(JSON.parse(storedWithdrawals));
        } else {
          setWithdrawals([]);
        }

        if (storedGoals) {
          setGoals(JSON.parse(storedGoals));
        } else {
          // Metas de demonstração acolhedoras para o primeiro uso do Sandbox
          const initialGoals: Goal[] = [
            {
              id: "sandbox_reserva",
              groupId,
              title: "Reserva de Emergência",
              category: "Segurança",
              emoji: "🛡️",
              targetAmount: 3000000, // R$ 30.000,00
              currentAmount: 1250000, // R$ 12.500,00
              status: "in_progress",
              contributionsByMember: {
                [arthurUid]: 750000, // R$ 7.500,00 (60%)
                [zaraUid]: 500000,   // R$ 5.000,00 (40%)
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: "sandbox_viagem",
              groupId,
              title: "Próxima Viagem do Casal",
              category: "Viagem",
              emoji: "✈️",
              targetAmount: 1200000, // R$ 12.000,00
              currentAmount: 480000,  // R$ 4.800,00
              status: "in_progress",
              contributionsByMember: {
                [arthurUid]: 240000, // R$ 2.400,00 (50%)
                [zaraUid]: 240000,   // R$ 2.400,00 (50%)
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];
          setGoals(initialGoals);
          localStorage.setItem(`${SANDBOX_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(initialGoals));
        }

        if (storedContribs) {
          setContributions(JSON.parse(storedContribs));
        } else {
          // Histórico inicial de exemplo no Sandbox
          const currentMonth = getCurrentMonthKey();
          const today = getTodayDateString();
          const initialContribs: GoalContribution[] = [
            {
              id: "contrib_demo_1",
              goalId: "sandbox_reserva",
              amount: 100000, // R$ 1.000,00
              contributorType: "split",
              contributedByUserId: arthurUid,
              memberAmounts: { [arthurUid]: 50000, [zaraUid]: 50000 },
              date: today,
              monthKey: currentMonth,
              note: "Aporte conjunto inicial",
              createdAt: new Date().toISOString(),
            },
          ];
          setContributions(initialContribs);
          localStorage.setItem(`${SANDBOX_CONTRIBS_KEY_PREFIX}${groupId}`, JSON.stringify(initialContribs));
        }
      }
    } catch (e) {
      console.error("Erro ao carregar metas em sandbox:", e);
    } finally {
      setLoading(false);
    }
  }, [groupId, isSandboxMode, arthurUid, zaraUid, group]);

  // Persistir alterações no Sandbox
  const persistSandbox = useCallback(
    (newGoals: Goal[], newContribs?: GoalContribution[], newWithdrawals?: GoalWithdrawal[]) => {
      setGoals(newGoals);
      localStorage.setItem(`${SANDBOX_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(newGoals));
      if (newContribs) {
        setContributions(newContribs);
        localStorage.setItem(`${SANDBOX_CONTRIBS_KEY_PREFIX}${groupId}`, JSON.stringify(newContribs));
      }
      if (newWithdrawals) {
        setWithdrawals(newWithdrawals);
        localStorage.setItem(`${SANDBOX_WITHDRAWALS_KEY_PREFIX}${groupId}`, JSON.stringify(newWithdrawals));
      }
    },
    [groupId]
  );

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
      if (initial > 0) {
        const today = getTodayDateString();
        const initialContrib: GoalContribution = {
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
      persistSandbox(updated, nextContribs);
      return newGoal;
    },
    [groupId, goals, contributions, persistSandbox, arthurUid, zaraUid]
  );

  const addContribution = useCallback(
    async (
      goalId: string,
      amount: number,
      contributorType: ContributorType,
      note?: string
    ) => {
      const targetGoal = goals.find((g) => g.id === goalId);
      if (!targetGoal) throw new Error("Meta não encontrada");

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

      const newCurrentAmount = targetGoal.currentAmount + amount;
      const isCompleted = newCurrentAmount >= targetGoal.targetAmount;

      const updatedContributionsByMember = { ...(targetGoal.contributionsByMember || {}) };
      for (const [mId, mAmount] of Object.entries(memberAmounts)) {
        updatedContributionsByMember[mId] = (updatedContributionsByMember[mId] || 0) + mAmount;
      }

      const updatedGoal: Goal = {
        ...targetGoal,
        currentAmount: newCurrentAmount,
        status: isCompleted ? "completed" : "in_progress",
        contributionsByMember: updatedContributionsByMember,
        updatedAt: new Date().toISOString(),
      };

      const today = getTodayDateString();
      const newContrib: GoalContribution = {
        id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
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

      const nextGoals = goals.map((g) => (g.id === goalId ? updatedGoal : g));
      const nextContribs = [newContrib, ...contributions];

      persistSandbox(nextGoals, nextContribs);
      return { updatedGoal, newContrib };
    },
    [goals, contributions, persistSandbox, arthurUid, zaraUid]
  );

  const withdrawGoal = useCallback(
    async (
      goalId: string,
      amount: number,
      reason: string,
      contributorType: ContributorType = "split"
    ) => {
      const targetGoal = goals.find((g) => g.id === goalId);
      if (!targetGoal) throw new Error("Meta não encontrada");
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

      const today = getTodayDateString();
      const newWithdrawal: GoalWithdrawal = {
        id: `with_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        goalId,
        amount,
        reason: reason.trim() || "Resgate da meta",
        contributorType,
        withdrawnByUserId: contributorType === "zara" ? zaraUid : arthurUid,
        date: today,
        createdAt: new Date().toISOString(),
      };

      const nextGoals = goals.map((g) => (g.id === goalId ? updatedGoal : g));
      const nextWithdrawals = [newWithdrawal, ...withdrawals];

      persistSandbox(nextGoals, contributions, nextWithdrawals);
      return { updatedGoal, newWithdrawal };
    },
    [goals, contributions, withdrawals, persistSandbox, arthurUid, zaraUid]
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      const nextGoals = goals.filter((g) => g.id !== goalId);
      const nextContribs = contributions.filter((c) => c.goalId !== goalId);
      const nextWithdrawals = withdrawals.filter((w) => w.goalId !== goalId);
      persistSandbox(nextGoals, nextContribs, nextWithdrawals);
    },
    [goals, contributions, withdrawals, persistSandbox]
  );

  const clearSandboxData = useCallback(() => {
    localStorage.removeItem(`${SANDBOX_STORAGE_KEY_PREFIX}${groupId}`);
    localStorage.removeItem(`${SANDBOX_CONTRIBS_KEY_PREFIX}${groupId}`);
    localStorage.removeItem(`${SANDBOX_WITHDRAWALS_KEY_PREFIX}${groupId}`);
    setGoals([]);
    setContributions([]);
    setWithdrawals([]);
  }, [groupId]);

  const toggleSandboxMode = useCallback(() => {
    setIsSandboxMode((prev) => {
      const next = !prev;
      localStorage.setItem(IS_SANDBOX_KEY, String(next));
      return next;
    });
  }, []);

  return {
    goals,
    contributions,
    withdrawals,
    metrics,
    loading,
    isGroupSupported,
    isSandboxMode,
    arthurUid,
    zaraUid,
    createGoal,
    addContribution,
    withdrawGoal,
    deleteGoal,
    clearSandboxData,
    toggleSandboxMode,
  };
}
