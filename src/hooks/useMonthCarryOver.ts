import { useEffect, useRef } from "react";
import {
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db, transactionsRef } from "../lib/firebase";
import { calculateBalance } from "../lib/calculations";
import {
  isSharedTransaction,
  isInvoiceTransactionForMember,
  calculatePersonalInvoiceTotal,
} from "../lib/transactionVisibility";
import { getPreviousMonthKey, formatMonthLabel } from "../lib/formatters";
import type { GroupMember, Transaction } from "../types";

/**
 * Hook para rolar dívidas e créditos pendentes do mês anterior para o mês atual.
 *
 * Funciona de forma idempotente, automática e segura (writeBatch com IDs determinísticos).
 * Executa uma sincronização quando o app abre ou o grupo muda:
 * - Se o mês anterior fechou com dívidas diretas em "Nossos Gastos", cria/atualiza
 *   uma linha de despesa de carryOver no mês atual (somente leitura).
 * - Se as faturas individuais tiverem saldo devedor ou crédito, cria/atualiza
 *   o saldo anterior na fatura correspondente.
 * - Se a pendência foi quitada ou zerada no mês anterior, remove a linha do mês atual.
 */
export function useMonthCarryOver(
  groupId: string | undefined,
  members: GroupMember[],
  currentMonthKey: string
): void {
  const isSyncingRef = useRef(false);
  const lastSyncKeyRef = useRef<string>("");

  useEffect(() => {
    if (!groupId || members.length === 0 || !currentMonthKey) return;

    const syncKey = `${groupId}_${currentMonthKey}`;
    // Evita loop ou re-execuções simultâneas
    if (isSyncingRef.current || lastSyncKeyRef.current === syncKey) {
      return;
    }

    const prevMonthKey = getPreviousMonthKey(currentMonthKey);

    const runCarryOverSync = async () => {
      isSyncingRef.current = true;
      try {
        // 1. Busca transações confirmadas do mês anterior
        const prevQuery = query(
          transactionsRef(groupId),
          where("monthKey", "==", prevMonthKey)
        );
        const prevSnap = await getDocs(prevQuery);
        const prevDocs = prevSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Transaction))
          .filter((t) => !t.status || t.status === "confirmed");

        // 2. Mapa de transações de carryOver esperadas para o mês atual
        const expectedCarryMap: Record<string, Record<string, any>> = {};

        const prevLabel = formatMonthLabel(prevMonthKey);
        const prevShortName = prevLabel.split(" ")[0];
        const prevShortYear = prevMonthKey.slice(2, 4);
        const shortMonthTag = `${prevShortName}/${prevShortYear}`;

        // ── 2.1 Nossos Gastos (Dívidas Compartilhadas) ──────────────────────────
        const prevShared = prevDocs.filter((t) => isSharedTransaction(t));
        const prevBalance = calculateBalance(prevShared, members);

        for (const debt of prevBalance.directDebts) {
          if (debt.amount > 0) {
            // ID determinístico: 1 única despesa por par devedor -> credor no mês
            const docId = `carry_${currentMonthKey}_shared_${debt.debtorId}_${debt.creditorId}`;
            expectedCarryMap[docId] = {
              type: "expense",
              description: `Saldo anterior · ${shortMonthTag}`,
              amount: debt.amount,
              date: `${currentMonthKey}-01`,
              monthKey: currentMonthKey,
              coupleId: groupId,
              paidByUserId: debt.creditorId,
              splitBetweenUserIds: [debt.debtorId],
              splitMode: "personal",
              personalOwnerUserId: debt.debtorId,
              visibility: "shared",
              carryOver: true,
              carryOverFromMonth: prevMonthKey,
              status: "confirmed",
              updatedAt: serverTimestamp(),
            };
          }
        }

        // ── 2.2 Faturas Individuais dos Membros ──────────────────────────────────
        for (const m of members) {
          const prevInvoiceDocs = prevDocs.filter((t) =>
            isInvoiceTransactionForMember(t, m)
          );
          const prevInvoiceTotal = calculatePersonalInvoiceTotal(
            prevInvoiceDocs,
            m
          );

          if (prevInvoiceTotal > 0) {
            // Saldo devedor pendente na fatura pessoal
            const docId = `carry_${currentMonthKey}_invoice_${m.userId}`;
            expectedCarryMap[docId] = {
              type: "expense",
              description: `Saldo anterior fatura · ${shortMonthTag}`,
              amount: prevInvoiceTotal,
              date: `${currentMonthKey}-01`,
              monthKey: currentMonthKey,
              coupleId: groupId,
              paidByUserId: m.userId,
              splitMode: "personal",
              personalOwnerUserId: m.userId,
              visibility: "personal",
              carryOver: true,
              carryOverFromMonth: prevMonthKey,
              status: "confirmed",
              updatedAt: serverTimestamp(),
            };
          } else if (prevInvoiceTotal < 0) {
            // Crédito de fatura que passa como abatimento para a próxima fatura
            const docId = `carry_${currentMonthKey}_invoice_${m.userId}`;
            expectedCarryMap[docId] = {
              type: "settlement",
              description: `Crédito fatura anterior · ${shortMonthTag}`,
              amount: Math.abs(prevInvoiceTotal),
              date: `${currentMonthKey}-01`,
              monthKey: currentMonthKey,
              coupleId: groupId,
              fromUserId: m.userId,
              toUserId: m.userId,
              personalOwnerUserId: m.userId,
              visibility: "personal",
              carryOver: true,
              carryOverFromMonth: prevMonthKey,
              status: "confirmed",
              updatedAt: serverTimestamp(),
            };
          }
        }

        // 3. Consulta documentos carryOver já existentes no mês atual
        const currentCarryQuery = query(
          transactionsRef(groupId),
          where("monthKey", "==", currentMonthKey),
          where("carryOver", "==", true)
        );
        const currentCarrySnap = await getDocs(currentCarryQuery);
        const existingDocsMap = new Map<string, any>();
        currentCarrySnap.docs.forEach((d) => {
          existingDocsMap.set(d.id, d);
        });

        // 4. Batch de reconciliação
        const batch = writeBatch(db);
        let hasOperations = false;

        // Criar ou atualizar os esperados
        for (const [docId, expectedData] of Object.entries(expectedCarryMap)) {
          const docRef = doc(transactionsRef(groupId), docId);
          if (!existingDocsMap.has(docId)) {
            batch.set(docRef, {
              ...expectedData,
              createdAt: serverTimestamp(),
            });
            hasOperations = true;
          } else {
            const existingData = existingDocsMap.get(docId).data();
            if (
              existingData.amount !== expectedData.amount ||
              existingData.type !== expectedData.type ||
              existingData.visibility !== expectedData.visibility
            ) {
              batch.set(docRef, expectedData, { merge: true });
              hasOperations = true;
            }
          }
        }

        // Remover linhas que não são mais devidas (ex: dívida quitada retroativamente)
        for (const [existingId, existingDocSnap] of existingDocsMap.entries()) {
          if (!expectedCarryMap[existingId]) {
            batch.delete(existingDocSnap.ref);
            hasOperations = true;
          }
        }

        if (hasOperations) {
          await batch.commit();
          console.log(`[useMonthCarryOver] Sincronização concluída para ${currentMonthKey}.`);
        }

        lastSyncKeyRef.current = syncKey;
      } catch (err) {
        console.warn("[useMonthCarryOver] Aviso na reconciliação de saldo anterior:", err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    runCarryOverSync();
  }, [groupId, members, currentMonthKey]);
}
