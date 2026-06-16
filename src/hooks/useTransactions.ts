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

  const { group, currentMember } = useGroupContext();

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
          return {
            id: docSnap.id,
            ...docSnap.data(),
          } as Transaction;
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
  }, [monthKey, group, currentMember]);

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

          const isPersonalOwner = data.splitType === "100% owner";
          const isPersonalPartner = data.splitType === "100% partner";
          const visibility = (isPersonalOwner || isPersonalPartner) ? "personal" : "shared";
          const personalOwnerUserId = (data as ExpenseFormData).personalOwnerUserId;

          if (visibility === "personal" && !personalOwnerUserId) {
            throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
          }

          const docData = {
            ...baseData,
            amount: installmentAmount,
            date: newDateStr,
            monthKey: getMonthKey(newDateStr),
            type: "expense",
            paidBy: data.paidBy,
            splitType: data.splitType,
            installmentCount: count,
            currentInstallment: i,
            groupId: installmentGroupId,
            originalAmount: amountCents,
            visibility: visibility,
            personalOwnerUserId: personalOwnerUserId || null,
          };

          const newDocRef = doc(transactionsRef(activeGroupId));
          batch.set(newDocRef, docData);
        }
        await batch.commit();
      } else {
        let docData;
        if (data.type === "expense") {
          const isPersonalOwner = data.splitType === "100% owner";
          const isPersonalPartner = data.splitType === "100% partner";
          const visibility = (isPersonalOwner || isPersonalPartner) ? "personal" : "shared";
          const personalOwnerUserId = (data as ExpenseFormData).personalOwnerUserId;

          if (visibility === "personal" && !personalOwnerUserId) {
            throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
          }

          docData = {
            ...baseData,
            amount: amountCents,
            date: data.date,
            monthKey: getMonthKey(data.date),
            type: "expense",
            paidBy: data.paidBy,
            splitType: data.splitType,
            visibility: visibility,
            personalOwnerUserId: personalOwnerUserId || null,
          };
        } else {
          const visibility = data.pixDestination === "zara_card" ? "personal" : "shared";
          const personalOwnerUserId = (data as SettlementFormData).personalOwnerUserId;

          if (visibility === "personal" && !personalOwnerUserId) {
            throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
          }

          docData = {
            ...baseData,
            amount: amountCents,
            date: data.date,
            monthKey: getMonthKey(data.date),
            type: "settlement",
            from: data.from,
            to: data.to,
            pixDestination: data.pixDestination || "shared",
            visibility: visibility,
            personalOwnerUserId: personalOwnerUserId || null,
          };
        }

        await addDoc(transactionsRef(activeGroupId), docData);
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

      if (wasInstallment || willBeInstallment) {
        const batch = writeBatch(db);

        // 1. Apagar parcelas antigas
        const expenseOrig = originalTransaction.type === "expense" ? originalTransaction : null;
        // PROTEÇÃO CRÍTICA: Se o groupId for igual ao activeGroupId (erro de migração antiga), NUNCA apagar o grupo inteiro.
        if (expenseOrig?.groupId && expenseOrig.groupId !== activeGroupId) {
          const oldGroupSnap = await getDocs(
            query(transactionsRef(activeGroupId), where("groupId", "==", expenseOrig.groupId))
          );
          oldGroupSnap.forEach((docSnap) => batch.delete(docSnap.ref));
        } else {
          batch.delete(transactionDocRef(activeGroupId, originalTransaction.id));
        }

        // 2. Criar as N novas parcelas no mesmo batch
        if (willBeInstallment) {
          const count = data.installmentCount!;
          const baseAmount = Math.floor(amountCents / count);
          const remainder = amountCents % count;
          const installmentGroupId = doc(collection(db, "groups")).id;
          const [year, month, day] = data.date.split("-").map(Number);

          for (let i = 1; i <= count; i++) {
            const installmentAmount = i === 1 ? baseAmount + remainder : baseAmount;
            const targetMonthZeroIndex = month - 1 + (i - 1);
            const newYear = year + Math.floor(targetMonthZeroIndex / 12);
            const newMonthIndex = targetMonthZeroIndex % 12;
            const lastDayOfTargetMonth = new Date(newYear, newMonthIndex + 1, 0).getDate();
            const newDay = Math.min(day, lastDayOfTargetMonth);
            const newDateStr = `${newYear}-${String(newMonthIndex + 1).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
            
            const isPersonalOwner = data.splitType === "100% owner";
            const isPersonalPartner = data.splitType === "100% partner";
            const visibility = (isPersonalOwner || isPersonalPartner) ? "personal" : "shared";
            const personalOwnerUserId = (data as ExpenseFormData).personalOwnerUserId;

            if (visibility === "personal" && !personalOwnerUserId) {
              throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
            }

            batch.set(doc(transactionsRef(activeGroupId)), {
              description: data.description.trim(),
              coupleId: activeGroupId,
              amount: installmentAmount,
              date: newDateStr,
              monthKey: getMonthKey(newDateStr),
              type: "expense",
              paidBy: data.paidBy,
              splitType: data.splitType,
              installmentCount: count,
              currentInstallment: i,
              groupId: installmentGroupId,
              originalAmount: amountCents,
              visibility,
              personalOwnerUserId: personalOwnerUserId || null,
              status: "confirmed",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          let visibility: "shared" | "personal" = "shared";
          let personalOwnerUserId: string | null = null;

          if (data.type === "expense") {
            const isPersonalOwner = data.splitType === "100% owner";
            const isPersonalPartner = data.splitType === "100% partner";
            visibility = (isPersonalOwner || isPersonalPartner) ? "personal" : "shared";
            personalOwnerUserId = (data as ExpenseFormData).personalOwnerUserId || null;

            if (visibility === "personal" && !personalOwnerUserId) {
              throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
            }
          } else {
            visibility = data.pixDestination === "zara_card" ? "personal" : "shared";
            personalOwnerUserId = (data as SettlementFormData).personalOwnerUserId || null;

            if (visibility === "personal" && !personalOwnerUserId) {
              throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
            }
          }

          batch.set(doc(transactionsRef(activeGroupId)), {
            description: data.description.trim(),
            coupleId: activeGroupId,
            amount: amountCents,
            date: data.date,
            monthKey: getMonthKey(data.date),
            type: data.type,
            ...(data.type === "expense"
              ? { paidBy: data.paidBy, splitType: data.splitType }
              : { from: data.from, to: data.to, pixDestination: data.pixDestination || "shared" }
            ),
            visibility,
            personalOwnerUserId,
            status: "confirmed",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        return;
      }

      // ─── Cenário B: edição simples de compra única ─────────────────────────
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
        const isPersonalOwner = data.splitType === "100% owner";
        const isPersonalPartner = data.splitType === "100% partner";
        const visibility = (isPersonalOwner || isPersonalPartner) ? "personal" : "shared";
        const personalOwnerUserId = (data as ExpenseFormData).personalOwnerUserId || null;
        
        if (visibility === "personal" && !personalOwnerUserId) {
           throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }
        
        docData = { ...baseData, type: "expense" as const, paidBy: data.paidBy, splitType: data.splitType, visibility, personalOwnerUserId };
      } else {
        const visibility = data.pixDestination === "zara_card" ? "personal" : "shared";
        const personalOwnerUserId = (data as SettlementFormData).personalOwnerUserId || null;
        
        if (visibility === "personal" && !personalOwnerUserId) {
           throw new Error("O usuário responsável pela fatura pessoal não foi identificado.");
        }
        
        docData = { ...baseData, type: "settlement" as const, from: data.from, to: data.to, pixDestination: data.pixDestination || "shared", visibility, personalOwnerUserId };
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
