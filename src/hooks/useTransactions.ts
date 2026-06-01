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
} from "firebase/firestore";
import type { Transaction, TransactionFormData } from "../types";
import {
  transactionsRef,
  transactionDocRef,
  COUPLE_ID,
  db,
} from "../lib/firebase";
import { getMonthKey } from "../lib/calculations";

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  addTransaction: (data: TransactionFormData, amountCents: number) => Promise<void>;
  updateTransaction: (id: string, data: TransactionFormData, amountCents: number) => Promise<void>;
  deleteTransaction: (transaction: Transaction) => Promise<void>;
}

export function useTransactions(monthKey: string): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Agora buscamos direto de /couples/{coupleId}/transactions
    // E só precisamos filtrar por monthKey e ordenar.
    const q = query(
      transactionsRef(),
      where("monthKey", "==", monthKey),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Transaction[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        setTransactions(docs);
        setLoading(false);
      },
      (err: any) => {
        console.error("Erro ao carregar transações:", err);
        if (err.code === "permission-denied") {
          setError(`Usuário autenticado, mas sem permissão no Firestore. (Talvez o doc couples/${COUPLE_ID} não exista ou UID não esteja em members)`);
        } else if (err.code === "unavailable") {
          setError("Firestore indisponível ou sem conexão.");
        } else if (err.code === "failed-precondition" && err.message?.includes("index")) {
          // Oculta a URL feia do Firebase e mostra uma mensagem amigável
          console.warn("Index URL:", err.message);
          setError("O banco de dados precisa finalizar a criação de um índice. Tente novamente em alguns minutos.");
        } else {
          setError(`Erro ao carregar dados: ${err.message}`);
        }
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [monthKey]);

  const addTransaction = useCallback(
    async (data: TransactionFormData, amountCents: number) => {
      const baseData = {
        description: data.description.trim(),
        coupleId: COUPLE_ID, // Pode manter no doc, mas a regra usa o path
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (data.type === "expense" && data.isInstallment && data.installmentCount && data.installmentCount > 1) {
        const count = data.installmentCount;
        const baseAmount = Math.floor(amountCents / count);
        const remainder = amountCents % count;
        const groupId = crypto.randomUUID();

        const [year, month, day] = data.date.split("-").map(Number);
        
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
            groupId: groupId,
            originalAmount: amountCents
          };

          await addDoc(transactionsRef(), docData);
        }
      } else {
        let docData;
        if (data.type === "expense") {
          docData = {
            ...baseData,
            amount: amountCents,
            date: data.date,
            monthKey: getMonthKey(data.date),
            type: "expense",
            paidBy: data.paidBy,
            splitType: data.splitType,
          };
        } else {
          docData = {
            ...baseData,
            amount: amountCents,
            date: data.date,
            monthKey: getMonthKey(data.date),
            type: "settlement",
            from: data.from,
            to: data.to,
          };
        }

        await addDoc(transactionsRef(), docData);
      }
    },
    []
  );

  const updateTransaction = useCallback(
    async (id: string, data: TransactionFormData, amountCents: number) => {
      const baseData = {
        description: data.description.trim(),
        amount: amountCents,
        date: data.date,
        monthKey: getMonthKey(data.date),
        updatedAt: serverTimestamp(),
      };

      let docData;
      if (data.type === "expense") {
        docData = {
          ...baseData,
          type: "expense",
          paidBy: data.paidBy,
          splitType: data.splitType,
        };
      } else {
        docData = {
          ...baseData,
          type: "settlement",
          from: data.from,
          to: data.to,
        };
      }

      await updateDoc(transactionDocRef(id), docData);
    },
    []
  );

  const deleteTransaction = useCallback(async (transaction: Transaction) => {
    if (transaction.type === "expense" && transaction.groupId) {
      const q = query(
        transactionsRef(),
        where("groupId", "==", transaction.groupId)
      );
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
    } else {
      await deleteDoc(transactionDocRef(transaction.id));
    }
  }, []);

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
