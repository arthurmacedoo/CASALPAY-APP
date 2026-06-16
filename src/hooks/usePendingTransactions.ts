import { useState, useEffect } from "react";
import { query, where, orderBy, onSnapshot } from "firebase/firestore";
import type { Transaction } from "../types";
import { transactionsRef } from "../lib/firebase";
import { useGroupContext } from "../contexts/GroupContext";

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
  const { group, currentMember } = useGroupContext();

  useEffect(() => {
    if (!currentMember || !group) {
      setPendingTransactions([]);
      setLoading(false);
      return;
    }

    const activeGroupId = group.id;

    const q = query(
      transactionsRef(activeGroupId),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Transaction[] = snapshot.docs.map((docSnap) => {
          return { id: docSnap.id, ...docSnap.data() } as Transaction;
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
  }, [group, currentMember]);

  return {
    pendingTransactions,
    pendingCount: pendingTransactions.length,
    loading,
  };
}
