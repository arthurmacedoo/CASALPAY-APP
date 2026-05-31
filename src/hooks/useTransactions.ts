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
} from "firebase/firestore";
import type { Transaction, TransactionFormData } from "../types";
import {
  transactionsRef,
  transactionDocRef,
  COUPLE_ID,
} from "../lib/firebase";
import { getMonthKey } from "../lib/calculations";

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  addTransaction: (data: TransactionFormData, amountCents: number) => Promise<void>;
  updateTransaction: (id: string, data: TransactionFormData, amountCents: number) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
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
        amount: amountCents,
        date: data.date,
        monthKey: getMonthKey(data.date),
        coupleId: COUPLE_ID, // Pode manter no doc, mas a regra usa o path
        createdAt: serverTimestamp(),
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

      await addDoc(transactionsRef(), docData);
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

  const deleteTransaction = useCallback(async (id: string) => {
    await deleteDoc(transactionDocRef(id));
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
