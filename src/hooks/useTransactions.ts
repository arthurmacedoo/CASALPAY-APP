import { useState, useEffect, useCallback } from "react";
import {
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  doc,
  collection,
} from "firebase/firestore";
import type { Transaction, TransactionFormData, ExpenseFormData, SettlementFormData } from "../types";
import {
  transactionsRef,
  transactionDocRef,
  db,
} from "../lib/firebase";
import { getMonthKey } from "../lib/calculations";
import { useGroupContext } from "../contexts/GroupContext";

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  addTransaction: (data: TransactionFormData, amountCents: number) => Promise<void>;
  updateTransaction: (originalTransaction: Transaction, data: TransactionFormData, amountCents: number) => Promise<void>;
  deleteTransaction: (transaction: Transaction) => Promise<void>;
}

export function useTransactions(monthKey: string): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { group, currentMember, members } = useGroupContext();

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Query Bailing: Proteção estrita multi-grupos.
    if (!currentMember || !group) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const activeGroupId = group.id;

    const q = query(
      transactionsRef(activeGroupId),
      where("monthKey", "==", monthKey),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Transaction[] = snapshot.docs.map((docSnap) => {
          const data = {
            id: docSnap.id,
            ...docSnap.data(),
          } as Transaction;

          return data;
        }).filter((t) => !t.status || t.status === "confirmed");
        
        setTransactions(docs);
        setLoading(false);
      },
      (err: any) => {
        console.error("Erro ao carregar transações:", err);
        if (err.code === "permission-denied") {
          localStorage.removeItem('casalpay_active_group');
          setError(`Usuário autenticado, mas sem permissão no Firestore para o grupo ${activeGroupId}.`);
        } else if (err.code === "unavailable") {
          setError("Firestore indisponível ou sem conexão.");
        } else if (err.code === "failed-precondition" && err.message?.includes("index")) {
          console.warn("Index URL:", err.message);
          setError("O banco de dados precisa finalizar a criação de um índice. Tente novamente em alguns minutos.");
        } else {
          setError(`Erro ao carregar dados: ${err.message}`);
        }
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [monthKey, group, currentMember, members]);

  const addTransaction = useCallback(
    async (data: TransactionFormData, amountCents: number) => {
      if (!group) throw new Error("Grupo não carregado.");
      const activeGroupId = group.id;

      const baseData = {
        description: data.description.trim(),
        coupleId: activeGroupId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (data.type === "expense" && data.isInstallment && data.installmentCount && data.installmentCount > 1) {
        const count = data.installmentCount;
        const baseAmount = Math.floor(amountCents / count);
        const remainder = amountCents % count;
        const installmentGroupId = doc(collection(db, "groups")).id;
        const [year, month, day] = data.date.split("-").map(Number);
        const batch = writeBatch(db);

        const visibility: "shared" | "personal" = data.splitMode === "personal" ? "personal" : "shared";
        const personalOwnerUserId = data.personalOwnerUserId;

        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }

        for (let i = 1; i <= count; i++) {
          const installmentAmount = i === 1 ? baseAmount + remainder : baseAmount;
          const targetMonthZeroIndex = month - 1 + (i - 1);
          const newYear = year + Math.floor(targetMonthZeroIndex / 12);
          const newMonthIndex = targetMonthZeroIndex % 12;
          const lastDayOfTargetMonth = new Date(newYear, newMonthIndex + 1, 0).getDate();
          const newDay = Math.min(day, lastDayOfTargetMonth);
          const newMonthStr = String(newMonthIndex + 1).padStart(2, "0");
          const newDayStr = String(newDay).padStart(2, "0");
          const newDateStr = `${newYear}-${newMonthStr}-${newDayStr}`;

          const newDocRef = doc(transactionsRef(activeGroupId));
          batch.set(newDocRef, {
            ...baseData,
            amount: installmentAmount,
            date: newDateStr,
            monthKey: getMonthKey(newDateStr),
            type: "expense",
            paidByUserId: data.paidByUserId,
            splitBetweenUserIds: data.splitBetweenUserIds,
            splitMode: data.splitMode,
            installmentCount: count,
            currentInstallment: i,
            groupId: installmentGroupId,
            originalAmount: amountCents,
            visibility,
            personalOwnerUserId: personalOwnerUserId ?? null,
          });
        }
        await batch.commit();
      } else if (data.type === "expense") {
        const visibility: "shared" | "personal" = data.splitMode === "personal" ? "personal" : "shared";
        const personalOwnerUserId = data.personalOwnerUserId;

        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }

        await addDoc(transactionsRef(activeGroupId), {
          ...baseData,
          amount: amountCents,
          date: data.date,
          monthKey: getMonthKey(data.date),
          type: "expense",
          paidByUserId: data.paidByUserId,
          splitBetweenUserIds: data.splitBetweenUserIds,
          splitMode: data.splitMode,
          visibility,
          personalOwnerUserId: personalOwnerUserId ?? null,
        });
      } else {
        // settlement
        const visibility: "shared" | "personal" = data.isPersonalInvoice ? "personal" : "shared";
        const personalOwnerUserId = data.personalOwnerUserId;

        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }

        await addDoc(transactionsRef(activeGroupId), {
          ...baseData,
          amount: amountCents,
          date: data.date,
          monthKey: getMonthKey(data.date),
          type: "settlement",
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          visibility,
          personalOwnerUserId: personalOwnerUserId ?? null,
        });
      }
    },
    [group]
  );

  const updateTransaction = useCallback(
    async (originalTransaction: Transaction, data: TransactionFormData, amountCents: number) => {
      if (!group) throw new Error("Grupo não carregado.");
      const activeGroupId = group.id;

      const wasInstallment = originalTransaction.type === "expense" && Boolean(originalTransaction.groupId);
      const willBeInstallment = data.type === "expense" && Boolean(data.isInstallment) && (data.installmentCount ?? 0) > 1;

      // ─ Helper: resolve visibility + personalOwnerUserId do novo formato ─
      const resolveExpenseVisibility = (d: ExpenseFormData): { visibility: "shared" | "personal"; personalOwnerUserId: string | null } => {
        const visibility: "shared" | "personal" = d.splitMode === "personal" ? "personal" : "shared";
        const personalOwnerUserId = d.personalOwnerUserId ?? null;
        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }
        return { visibility, personalOwnerUserId };
      };

      const resolveSettlementVisibility = (d: SettlementFormData): { visibility: "shared" | "personal"; personalOwnerUserId: string | null } => {
        const visibility: "shared" | "personal" = d.isPersonalInvoice ? "personal" : "shared";
        const personalOwnerUserId = d.personalOwnerUserId ?? null;
        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }
        return { visibility, personalOwnerUserId };
      };

      if (wasInstallment || willBeInstallment) {
        const batch = writeBatch(db);

        // 1. Apagar parcelas antigas
        const expenseOrig = originalTransaction.type === "expense" ? originalTransaction : null;
        if (expenseOrig?.groupId && expenseOrig.groupId !== activeGroupId) {
          const oldGroupSnap = await getDocs(
            query(transactionsRef(activeGroupId), where("groupId", "==", expenseOrig.groupId))
          );
          oldGroupSnap.forEach((docSnap) => batch.delete(docSnap.ref));
        } else {
          batch.delete(transactionDocRef(activeGroupId, originalTransaction.id));
        }

        // 2. Criar as N novas parcelas no mesmo batch
        if (willBeInstallment && data.type === "expense") {
          const count = data.installmentCount!;
          const baseAmount = Math.floor(amountCents / count);
          const remainder = amountCents % count;
          const installmentGroupId = doc(collection(db, "groups")).id;
          const [year, month, day] = data.date.split("-").map(Number);
          const { visibility, personalOwnerUserId } = resolveExpenseVisibility(data);

          for (let i = 1; i <= count; i++) {
            const installmentAmount = i === 1 ? baseAmount + remainder : baseAmount;
            const targetMonthZeroIndex = month - 1 + (i - 1);
            const newYear = year + Math.floor(targetMonthZeroIndex / 12);
            const newMonthIndex = targetMonthZeroIndex % 12;
            const lastDayOfTargetMonth = new Date(newYear, newMonthIndex + 1, 0).getDate();
            const newDay = Math.min(day, lastDayOfTargetMonth);
            const newDateStr = `${newYear}-${String(newMonthIndex + 1).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;

            batch.set(doc(transactionsRef(activeGroupId)), {
              description: data.description.trim(),
              coupleId: activeGroupId,
              amount: installmentAmount,
              date: newDateStr,
              monthKey: getMonthKey(newDateStr),
              type: "expense",
              paidByUserId: data.paidByUserId,
              splitBetweenUserIds: data.splitBetweenUserIds,
              splitMode: data.splitMode,
              installmentCount: count,
              currentInstallment: i,
              groupId: installmentGroupId,
              originalAmount: amountCents,
              visibility,
              personalOwnerUserId: personalOwnerUserId ?? null,
              status: "confirmed",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          // Recriou como simples
          if (data.type === "expense") {
            const { visibility, personalOwnerUserId } = resolveExpenseVisibility(data);
            batch.set(doc(transactionsRef(activeGroupId)), {
              description: data.description.trim(),
              coupleId: activeGroupId,
              amount: amountCents,
              date: data.date,
              monthKey: getMonthKey(data.date),
              type: "expense",
              paidByUserId: data.paidByUserId,
              splitBetweenUserIds: data.splitBetweenUserIds,
              splitMode: data.splitMode,
              visibility,
              personalOwnerUserId: personalOwnerUserId ?? null,
              status: "confirmed",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            const { visibility, personalOwnerUserId } = resolveSettlementVisibility(data);
            batch.set(doc(transactionsRef(activeGroupId)), {
              description: data.description.trim(),
              coupleId: activeGroupId,
              amount: amountCents,
              date: data.date,
              monthKey: getMonthKey(data.date),
              type: "settlement",
              fromUserId: data.fromUserId,
              toUserId: data.toUserId,
              visibility,
              personalOwnerUserId: personalOwnerUserId ?? null,
              status: "confirmed",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        await batch.commit();
        return;
      }

      // ─── Cenário B: edição simples ──────────────────────────────────────
      const baseData = {
        description: data.description.trim(),
        amount: amountCents,
        date: data.date,
        monthKey: getMonthKey(data.date),
        updatedAt: serverTimestamp(),
        status: "confirmed" as const,
      };

      let docData;
      if (data.type === "expense") {
        const { visibility, personalOwnerUserId } = resolveExpenseVisibility(data);
        docData = {
          ...baseData,
          type: "expense" as const,
          paidByUserId: data.paidByUserId,
          splitBetweenUserIds: data.splitBetweenUserIds,
          splitMode: data.splitMode,
          visibility,
          personalOwnerUserId: personalOwnerUserId ?? null,
        };
      } else {
        const { visibility, personalOwnerUserId } = resolveSettlementVisibility(data);
        docData = {
          ...baseData,
          type: "settlement" as const,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          visibility,
          personalOwnerUserId: personalOwnerUserId ?? null,
        };
      }

      await updateDoc(transactionDocRef(activeGroupId, originalTransaction.id), docData);
    },
    [group]
  );

  const deleteTransaction = useCallback(async (transaction: Transaction) => {
    if (!group) throw new Error("Grupo não carregado.");
    const activeGroupId = group.id;

    if (transaction.type === "expense" && transaction.groupId && transaction.groupId !== activeGroupId) {
      const q = query(
        transactionsRef(activeGroupId),
        where("groupId", "==", transaction.groupId)
      );
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
    } else {
      await deleteDoc(transactionDocRef(activeGroupId, transaction.id));
    }
  }, [group]);

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
