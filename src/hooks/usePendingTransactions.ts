import { useState, useEffect } from "react";
import { query, where, orderBy, onSnapshot } from "firebase/firestore";
import type { Transaction } from "../types";
import { transactionsRef, COUPLE_ID } from "../lib/firebase";

interface UsePendingTransactionsReturn {
  pendingTransactions: Transaction[];
  pendingCount: number;
  loading: boolean;
}

/**
 * Hook dedicado às transações com status "pending".
 * Não filtra por mês — a caixa de entrada mostra todos os meses.
 */
export function usePendingTransactions(): UsePendingTransactionsReturn {
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      transactionsRef(),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Transaction[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          // Mesmo mapeador de retrocompatibilidade do useTransactions
          if (data.paidBy === "Arthur") data.paidBy = "owner";
          if (data.paidBy === "Zara")   data.paidBy = "partner";
          if (data.from === "Arthur")   data.from = "owner";
          if (data.from === "Zara")     data.from = "partner";
          if (data.to === "Arthur")     data.to = "owner";
          if (data.to === "Zara")       data.to = "partner";
          if (data.splitType === "100% Arthur") data.splitType = "100% owner";
          if (data.splitType === "100% Zara")   data.splitType = "100% partner";
          return { id: docSnap.id, ...data } as Transaction;
        });
        setPendingTransactions(docs);
        setLoading(false);
      },
      (err) => {
        console.error("[usePendingTransactions] Erro:", err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [COUPLE_ID]);

  return {
    pendingTransactions,
    pendingCount: pendingTransactions.length,
    loading,
  };
}
