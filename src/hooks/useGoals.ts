import { useState, useEffect, useMemo, useCallback } from "react";
import { onSnapshot, setDoc, doc, deleteDoc, collection } from "firebase/firestore";
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

  // Carregar dados e escutar em tempo real (Firestore com fallback de Cache Local)
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
    let unsubGoals: (() => void) | undefined;
    let unsubContribs: (() => void) | undefined;
    let unsubWithdrawals: (() => void) | undefined;

    try {
      const gRef = goalsRef(groupId);
      unsubGoals = onSnapshot(
        gRef,
        (snapshot) => {
          const remoteGoals: Goal[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Goal;
            if (!data.id?.startsWith("sandbox_")) {
              remoteGoals.push({ ...data, id: docSnap.id });
            }
          });
          setGoals(remoteGoals);
          localStorage.setItem(`${GOALS_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(remoteGoals));
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
        (snapshot) => {
          const remoteContribs: GoalContribution[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as GoalContribution;
            if (!data.id?.startsWith("contrib_demo_") && !data.goalId?.startsWith("sandbox_")) {
              remoteContribs.push({ ...data, id: docSnap.id });
            }
          });
          setContributions(remoteContribs);
          localStorage.setItem(`${CONTRIBS_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(remoteContribs));
        },
        (err) => {
          console.warn("Firestore contribuições em modo local:", err.message);
        }
      );

      const wRef = collection(db, "groups", groupId, "goal_withdrawals");
      unsubWithdrawals = onSnapshot(
        wRef,
        (snapshot) => {
          const remoteWithdrawals: GoalWithdrawal[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as GoalWithdrawal;
            if (!data.goalId?.startsWith("sandbox_")) {
              remoteWithdrawals.push({ ...data, id: docSnap.id });
            }
          });
          setWithdrawals(remoteWithdrawals);
          localStorage.setItem(`${WITHDRAWALS_STORAGE_KEY_PREFIX}${groupId}`, JSON.stringify(remoteWithdrawals));
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

      persistLocal(nextGoals, nextContribs);

      // Persistência no Firestore
      try {
        await setDoc(
          doc(db, "groups", groupId, "goal_contributions", newContrib.id),
          newContrib
        );
        await setDoc(goalDocRef(groupId, goalId), updatedGoal);
      } catch (err) {
        console.warn("Contribuição salva em cache local (offline):", err);
      }

      return { updatedGoal, newContrib };
    },
    [groupId, goals, contributions, persistLocal, arthurUid, zaraUid]
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

      persistLocal(nextGoals, contributions, nextWithdrawals);

      // Persistência no Firestore
      try {
        await setDoc(
          doc(db, "groups", groupId, "goal_withdrawals", newWithdrawal.id),
          newWithdrawal
        );
        await setDoc(goalDocRef(groupId, goalId), updatedGoal);
      } catch (err) {
        console.warn("Resgate salvo em cache local (offline):", err);
      }

      return { updatedGoal, newWithdrawal };
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
