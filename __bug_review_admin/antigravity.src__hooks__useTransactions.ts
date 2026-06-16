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
import type { Transaction, TransactionFormData } from "../types";
import {
  transactionsRef,
  transactionDocRef,
  COUPLE_ID,
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

  const { members } = useGroupContext();
  const ownerMember = members.find((m) => m.role === "admin");
  const partnerMember = members.find((m) => m.role === "member");

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
        const docs: Transaction[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          // Tarefa 4.2: Mapeador de Retrocompatibilidade
          if (data.paidBy === "Arthur") data.paidBy = "owner";
          if (data.paidBy === "Zara") data.paidBy = "partner";
          if (data.from === "Arthur") data.from = "owner";
          if (data.from === "Zara") data.from = "partner";
          if (data.to === "Arthur") data.to = "owner";
          if (data.to === "Zara") data.to = "partner";
          if (data.splitType === "100% Arthur") data.splitType = "100% owner";
          if (data.splitType === "100% Zara") data.splitType = "100% partner";
          
          return {
            id: docSnap.id,
            ...data,
          } as Transaction;
        // Exclui pendentes das views shared/zara (geridas por usePendingTransactions)
        }).filter((t) => !t.status || t.status === "confirmed");
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
        const groupId = doc(collection(db, "couples")).id;

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

          // Tarefa 2: Visibilidade e Dono da fatura (Etapa 2.1)
          const isPersonalOwner = data.splitType === "100% owner";
          const isPersonalPartner = data.splitType === "100% partner";
          const visibility = (isPersonalOwner || isPersonalPartner) ? "personal" : "shared";
          const personalOwnerUserId = isPersonalOwner ? ownerMember?.userId : (isPersonalPartner ? partnerMember?.userId : undefined);

          if (visibility === "personal" && !personalOwnerUserId) {
            throw new Error("Membros do grupo ainda não carregados. Tente novamente.");
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
            groupId: groupId,
            originalAmount: amountCents,
            visibility: visibility,
            personalOwnerUserId: personalOwnerUserId,
          };

          const newDocRef = doc(transactionsRef());
          batch.set(newDocRef, docData);
        }
        await batch.commit();
      } else {
        let docData;
        if (data.type === "expense") {
          const isPersonalOwner = data.splitType === "100% owner";
          const isPersonalPartner = data.splitType === "100% partner";
          const visibility = (isPersonalOwner || isPersonalPartner) ? "personal" : "shared";
          const personalOwnerUserId = isPersonalOwner ? ownerMember?.userId : (isPersonalPartner ? partnerMember?.userId : undefined);

          if (visibility === "personal" && !personalOwnerUserId) {
            throw new Error("Membros do grupo ainda não carregados. Tente novamente.");
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
            personalOwnerUserId: personalOwnerUserId,
          };
        } else {
          const visibility = data.pixDestination === "zara_card" ? "personal" : "shared";
          const personalOwnerUserId = data.pixDestination === "zara_card" ? partnerMember?.userId : undefined;

          if (visibility === "personal" && !personalOwnerUserId) {
            throw new Error("Membros do grupo ainda não carregados. Tente novamente.");
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
            personalOwnerUserId: personalOwnerUserId,
          };
        }

        await addDoc(transactionsRef(), docData);
      }
    },
    [ownerMember?.userId, partnerMember?.userId]
  );

  const updateTransaction = useCallback(
    async (originalTransaction: Transaction, data: TransactionFormData, amountCents: number) => {
      const wasInstallment = originalTransaction.type === "expense" && Boolean(originalTransaction.groupId);
      const willBeInstallment = data.type === "expense" && Boolean(data.isInstallment) && (data.installmentCount ?? 0) > 1;

      // ─── Cenário A: qualquer mudança envolvendo parcelas ─────────────────────
      if (wasInstallment || willBeInstallment) {
        const batch = writeBatch(db);

        // 1. Apagar parcelas antigas
        const expenseOrig = originalTransaction.type === "expense" ? originalTransaction : null;
        if (expenseOrig?.groupId) {
          const oldGroupSnap = await getDocs(
            query(transactionsRef(), where("groupId", "==", expenseOrig.groupId))
          );
          oldGroupSnap.forEach((docSnap) => batch.delete(docSnap.ref));
        } else {
          // Era compra única (ex: pending sem groupId) — apaga só o doc original
          batch.delete(transactionDocRef(originalTransaction.id));
        }

        // 2. Criar as N novas parcelas no mesmo batch
        if (willBeInstallment) {
          const count = data.installmentCount!;
          const baseAmount = Math.floor(amountCents / count);
          const remainder = amountCents % count;
          const newGroupId = doc(collection(db, "couples")).id;
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
            const personalOwnerUserId = isPersonalOwner ? ownerMember?.userId : (isPersonalPartner ? partnerMember?.userId : undefined);

            if (visibility === "personal" && !personalOwnerUserId) {
              throw new Error("Membros do grupo ainda não carregados. Tente novamente.");
            }

            batch.set(doc(transactionsRef()), {
              description: data.description.trim(),
              coupleId: COUPLE_ID,
              amount: installmentAmount,
              date: newDateStr,
              monthKey: getMonthKey(newDateStr),
              type: "expense",
              paidBy: data.paidBy,
              splitType: data.splitType,
              installmentCount: count,
              currentInstallment: i,
              groupId: newGroupId,
              originalAmount: amountCents,
              visibility,
              personalOwnerUserId,
              status: "confirmed",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          // Passou de parcelado para compra única: cria um novo doc simples
          let visibility: "shared" | "personal" = "shared";
          let personalOwnerUserId: string | undefined = undefined;

          if (data.type === "expense") {
            const isPersonalOwner = data.splitType === "100% owner";
            const isPersonalPartner = data.splitType === "100% partner";
            visibility = (isPersonalOwner || isPersonalPartner) ? "personal" : "shared";
            personalOwnerUserId = isPersonalOwner ? ownerMember?.userId : (isPersonalPartner ? partnerMember?.userId : undefined);
          } else {
            visibility = data.pixDestination === "zara_card" ? "personal" : "shared";
            personalOwnerUserId = data.pixDestination === "zara_card" ? partnerMember?.userId : undefined;
          }

          if (visibility === "personal" && !personalOwnerUserId) {
            throw new Error("Membros do grupo ainda não carregados. Tente novamente.");
          }

          batch.set(doc(transactionsRef()), {
            description: data.description.trim(),
            coupleId: COUPLE_ID,
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
        const personalOwnerUserId = isPersonalOwner ? ownerMember?.userId : (isPersonalPartner ? partnerMember?.userId : undefined);
        
        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("Membros do grupo ainda não carregados. Tente novamente.");
        }
        
        docData = { ...baseData, type: "expense" as const, paidBy: data.paidBy, splitType: data.splitType, visibility, personalOwnerUserId };
      } else {
        const visibility = data.pixDestination === "zara_card" ? "personal" : "shared";
        const personalOwnerUserId = data.pixDestination === "zara_card" ? partnerMember?.userId : undefined;
        
        if (visibility === "personal" && !personalOwnerUserId) {
          throw new Error("Membros do grupo ainda não carregados. Tente novamente.");
        }
        
        docData = { ...baseData, type: "settlement" as const, from: data.from, to: data.to, pixDestination: data.pixDestination || "shared", visibility, personalOwnerUserId };
      }

      await updateDoc(transactionDocRef(originalTransaction.id), docData);
    },
    [ownerMember?.userId, partnerMember?.userId]
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
