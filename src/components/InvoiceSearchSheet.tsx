import React, { useState, useMemo, useEffect, useCallback, useDeferredValue, useRef } from "react";
import { createPortal } from "react-dom";
import type { Transaction, GroupMember } from "../types";
import { formatBRL, formatDateBR, getCurrentMonthKey, normalizeSearchText } from "../lib/formatters";
import {
  isInvoiceTransactionForMember,
  isSharedTransaction,
  calculatePersonalInvoiceTotal,
  reconcileCarryOverForDisplay,
  getSettledExpenseIds,
} from "../lib/transactionVisibility";
import { TransactionItem } from "./TransactionItem";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

export interface InvoiceSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: GroupMember | null;
  members: GroupMember[];
  groupId: string;
  initialTransactions: Transaction[];
  initialScope?: "shared" | "personal";
  currentMonthKey: string;
  onEditTransaction?: (t: Transaction) => void;
  onDeleteTransaction?: (t: Transaction) => void;
}

const RECENT_SEARCHES_KEY = "casalpay_fatura_recent_searches";

export const InvoiceSearchSheet: React.FC<InvoiceSearchSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  members,
  groupId,
  initialTransactions,
  initialScope = "shared",
  currentMonthKey,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [searchScope, setSearchScope] = useState<"shared" | "personal">(initialScope);
  const [selectedInvoiceUserId, setSelectedInvoiceUserId] = useState<string>(
    activeMember?.userId || members[0]?.userId || ""
  );

  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey || getCurrentMonthKey());
  const [filterType, setFilterType] = useState<"all" | "expense" | "settlement">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [cachedTransactions, setCachedTransactions] = useState<Transaction[]>(initialTransactions);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const loadedMonthsRef = useRef<Set<string>>(new Set([currentMonthKey]));
  const allMonthsLoadedRef = useRef<boolean>(false);

  // Histórico de buscas salvas no LocalStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : ["Farmácia", "Apple Pay", "iFood", "Uber"];
    } catch {
      return ["Farmácia", "Apple Pay", "iFood"];
    }
  });

  // Atualiza escopo e membro sempre que o sheet é aberto
  useEffect(() => {
    if (isOpen) {
      setSearchScope(initialScope);
      if (activeMember?.userId) {
        setSelectedInvoiceUserId(activeMember.userId);
      }
    }
  }, [isOpen, initialScope, activeMember?.userId]);

  // Sincroniza initialTransactions com o mês atual com segurança (itens excluídos somem)
  useEffect(() => {
    setCachedTransactions((prev) => {
      const otherMonths = prev.filter(
        (t) => (t.monthKey || t.date.slice(0, 7)) !== currentMonthKey
      );
      const map = new Map<string, Transaction>();
      otherMonths.forEach((t) => map.set(t.id, t));
      initialTransactions.forEach((t) => map.set(t.id, t));
      return Array.from(map.values());
    });
    if (currentMonthKey) {
      loadedMonthsRef.current.add(currentMonthKey);
    }
  }, [initialTransactions, currentMonthKey]);

  // Carregar transações sob demanda (mês específico ou 12 meses para "Todos os Meses")
  const loadMonthTransactions = useCallback(
    async (monthKey: string) => {
      if (!groupId) return;

      if (monthKey === "all") {
        if (allMonthsLoadedRef.current) return;
        setLoadingMonth(true);
        try {
          // Alcance de 12 meses: busca a partir de 11 meses atrás
          const now = new Date();
          const pastDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
          const pastKey = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, "0")}`;

          const q = query(
            collection(db, "groups", groupId, "transactions"),
            where("monthKey", ">=", pastKey)
          );
          const snap = await getDocs(q);
          const docs = snap.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Transaction))
            .filter((t) => !t.status || t.status === "confirmed");

          setCachedTransactions((prev) => {
            const map = new Map<string, Transaction>();
            prev.forEach((t) => map.set(t.id, t));
            docs.forEach((t) => map.set(t.id, t));
            return Array.from(map.values());
          });
          allMonthsLoadedRef.current = true;
        } catch (err) {
          console.warn("[InvoiceSearchSheet] Erro ao carregar histórico de 12 meses:", err);
        } finally {
          setLoadingMonth(false);
        }
        return;
      }

      // Mês específico
      if (loadedMonthsRef.current.has(monthKey) || allMonthsLoadedRef.current) {
        return;
      }

      setLoadingMonth(true);
      try {
        const q = query(
          collection(db, "groups", groupId, "transactions"),
          where("monthKey", "==", monthKey)
        );
        const snap = await getDocs(q);
        const docs = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Transaction))
          .filter((t) => !t.status || t.status === "confirmed");

        setCachedTransactions((prev) => {
          const map = new Map<string, Transaction>();
          prev.forEach((t) => map.set(t.id, t));
          docs.forEach((t) => map.set(t.id, t));
          return Array.from(map.values());
        });
        loadedMonthsRef.current.add(monthKey);
      } catch (err) {
        console.warn("[InvoiceSearchSheet] Erro ao buscar mês sob demanda:", err);
      } finally {
        setLoadingMonth(false);
      }
    },
    [groupId]
  );

  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonth(monthKey);
    loadMonthTransactions(monthKey);
  };

  // Salvar no histórico de buscas recentes
  const saveSearchToHistory = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const updated = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const removeSearchItem = (itemToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== itemToRemove);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // ── useMemo 1: Opções de Meses Disponíveis (12 meses cobrindo 1 ano) ─────────
  const monthOptions = useMemo(() => {
    const options: { key: string; label: string }[] = [{ key: "all", label: "Todos os Meses" }];
    const now = new Date();
    for (let i = 0; i >= -11; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${year}-${month}`;
      const shortLabel = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      options.push({ key, label: shortLabel });
    }
    return options;
  }, []);

  const targetInvoiceMember = useMemo(() => {
    return members.find((m) => m.userId === selectedInvoiceUserId) || activeMember || members[0] || null;
  }, [members, selectedInvoiceUserId, activeMember]);

  const settledExpenseIds = useMemo(
    () => getSettledExpenseIds(cachedTransactions),
    [cachedTransactions]
  );

  // Reconcilia saldos anteriores por mês para ocultar os que já foram quitados no respectivo mês
  const displayCachedTransactions = useMemo(() => {
    const byMonth = new Map<string, Transaction[]>();
    cachedTransactions.forEach((t) => {
      const mKey = t.monthKey || t.date.slice(0, 7);
      const arr = byMonth.get(mKey) || [];
      arr.push(t);
      byMonth.set(mKey, arr);
    });
    const result: Transaction[] = [];
    byMonth.forEach((monthTxList) => {
      result.push(...reconcileCarryOverForDisplay(monthTxList));
    });
    return result;
  }, [cachedTransactions]);

  // ── useMemo 2: Filtro Otimizado de Transações ──────────────────────────────
  const filteredTransactions = useMemo(() => {
    // 1. Filtro por escopo (Nossos Gastos vs Fatura Individual)
    let list = displayCachedTransactions.filter((t) => {
      if (searchScope === "shared") {
        return isSharedTransaction(t);
      }
      return isInvoiceTransactionForMember(t, targetInvoiceMember);
    });

    // 2. Filtro por mês
    if (selectedMonth !== "all") {
      list = list.filter((t) => (t.monthKey || t.date.slice(0, 7)) === selectedMonth);
    }

    // 3. Filtro por tipo
    if (filterType !== "all") {
      list = list.filter((t) => t.type === filterType);
    }

    // 4. Filtro por texto / busca inteligente sem acentos
    if (deferredSearch.trim()) {
      const termNorm = normalizeSearchText(deferredSearch);
      list = list.filter((t) => {
        const descNorm = normalizeSearchText(t.description || "");
        const descMatch = descNorm.includes(termNorm);
        const amountCentsStr = String(t.amount);
        const amountReaisStr = (t.amount / 100).toFixed(2).replace(".", ",");
        const amountMatch =
          amountReaisStr.includes(termNorm) ||
          amountCentsStr.includes(termNorm) ||
          String(t.amount / 100).includes(termNorm);
        const dateMatch = formatDateBR(t.date).includes(termNorm) || t.date.includes(termNorm);
        return descMatch || amountMatch || dateMatch;
      });
    }

    // 5. Ordenação (Cuidado Extra 2: mais recente primeiro com desempate por createdAt)
    list = [...list].sort((a, b) => {
      if (sortBy === "date_desc") {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        const timeB = (b.createdAt as any)?.seconds ?? 0;
        const timeA = (a.createdAt as any)?.seconds ?? 0;
        return timeB - timeA;
      }
      if (sortBy === "date_asc") {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        const timeA = (a.createdAt as any)?.seconds ?? 0;
        const timeB = (b.createdAt as any)?.seconds ?? 0;
        return timeA - timeB;
      }
      if (sortBy === "amount_desc") return b.amount - a.amount;
      if (sortBy === "amount_asc") return a.amount - b.amount;
      return 0;
    });

    return list;
  }, [displayCachedTransactions, searchScope, targetInvoiceMember, selectedMonth, filterType, deferredSearch, sortBy]);

  // ── useMemo 3: Métricas Consolidadas (Cuidados Extras 1 e 2: ignorar carryOver) ─
  const metrics = useMemo(() => {
    // Ignora carryOver na soma de despesas/compras para não duplicar dívidas roladas
    const totalExpenses = filteredTransactions
      .filter((t) => t.type === "expense" && !t.carryOver)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSettlements = filteredTransactions
      .filter((t) => t.type === "settlement" && !t.carryOver)
      .reduce((sum, t) => sum + t.amount, 0);

    // No escopo de fatura individual de um mês específico, usa o cálculo oficial (que inclui saldo anterior - pagamentos)
    // Em "Todos os Meses" ou com busca textual, soma apenas compras reais (!carryOver) menos pagamentos
    let netTotal = totalExpenses - totalSettlements;
    if (
      searchScope === "personal" &&
      selectedMonth !== "all" &&
      !deferredSearch.trim() &&
      filterType === "all"
    ) {
      const rawMonthInvoiceTx = cachedTransactions.filter(
        (t) =>
          (t.monthKey || t.date.slice(0, 7)) === selectedMonth &&
          isInvoiceTransactionForMember(t, targetInvoiceMember)
      );
      netTotal = calculatePersonalInvoiceTotal(rawMonthInvoiceTx, targetInvoiceMember);
    }

    const expenseCount = filteredTransactions.filter((t) => t.type === "expense" && !t.carryOver).length;
    const settlementCount = filteredTransactions.filter((t) => t.type === "settlement" && !t.carryOver).length;
    const carryOverCount = filteredTransactions.filter((t) => Boolean(t.carryOver)).length;

    return {
      totalExpenses,
      totalSettlements,
      netTotal,
      count: filteredTransactions.length,
      expenseCount,
      settlementCount,
      carryOverCount,
    };
  }, [
    filteredTransactions,
    searchScope,
    selectedMonth,
    deferredSearch,
    filterType,
    cachedTransactions,
    targetInvoiceMember,
  ]);

  if (!isOpen) return null;

  const invoiceOwnerFirstName = targetInvoiceMember?.name?.split(" ")[0] || "Membro";

  return createPortal(
    <div
      style={{ zIndex: 9999 }}
      onClick={onClose}
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in-up"
    >
      <div
        className="w-full sm:max-w-lg bg-[#16161F] border border-[#2A2A3E] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col h-[94vh] max-h-[94vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com Identificação */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-accent-pink/15 border border-accent-pink/30 flex items-center justify-center text-accent-pink text-base font-bold shadow-glow">
              🔍
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary leading-tight">
                Busca & Histórico
              </h2>
              <p className="text-[11px] text-text-muted">
                {searchScope === "shared" ? (
                  <span>Nossos Gastos do Casal</span>
                ) : (
                  <span>Fatura de <strong className="text-accent-pink">{invoiceOwnerFirstName}</strong></span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* ── Seletor de Escopo: Nossos Gastos vs Fatura Individual ──────────── */}
        <div className="pt-3 pb-2 shrink-0">
          <div className="relative flex bg-bg-elevated rounded-xl p-1 border border-border">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-lg transition-transform duration-300 ease-in-out shadow-sm ${
                searchScope === "shared" ? "translate-x-0 bg-accent-pink" : "translate-x-full bg-[#A855F7]"
              }`}
            />
            <button
              onClick={() => setSearchScope("shared")}
              className={`relative z-10 flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-300 ${
                searchScope === "shared" ? "text-white" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              👥 Nossos Gastos
            </button>
            <button
              onClick={() => setSearchScope("personal")}
              className={`relative z-10 flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-300 ${
                searchScope === "personal" ? "text-white" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              💳 {members.length > 1 ? "Fatura Individual" : "Minha Fatura"}
            </button>
          </div>

          {/* Sub-seletor de membro quando estiver em Fatura */}
          {searchScope === "personal" && members.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pt-2 pb-0.5 scrollbar-hide animate-fade-in-up">
              {members.map((m) => {
                const isSelected = selectedInvoiceUserId === m.userId;
                const firstName = m.name?.split(" ")[0] || "Membro";
                return (
                  <button
                    key={m.userId}
                    onClick={() => setSelectedInvoiceUserId(m.userId)}
                    className={`shrink-0 px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                      isSelected
                        ? "bg-[#A855F7] text-white border-[#A855F7] shadow-sm"
                        : "bg-bg-elevated border-border text-text-muted hover:text-text-primary"
                    }`}
                  >
                    Fatura de {firstName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Campo de Busca Principal com Glow */}
        <div className="pb-2 shrink-0">
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-base text-accent-pink">🔍</span>
            <input
              type="text"
              placeholder={
                searchScope === "shared"
                  ? "Buscar compras do casal por loja, valor ou data..."
                  : `Buscar na fatura de ${invoiceOwnerFirstName}...`
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSearchToHistory(searchTerm);
              }}
              className="w-full bg-bg-elevated border border-border focus:border-accent-pink rounded-2xl pl-10 pr-9 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none shadow-sm transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-text-muted text-xs flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Histórico de Buscas Recentes (Chips Rápidos de 1 toque) */}
        {!searchTerm && recentSearches.length > 0 && (
          <div className="pb-2.5 shrink-0 animate-fade-in-up">
            <div className="flex items-center justify-between mb-1 px-0.5">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                <span>🕒</span> Buscas Frequentes
              </span>
              <button
                onClick={() => {
                  setRecentSearches([]);
                  localStorage.removeItem(RECENT_SEARCHES_KEY);
                }}
                className="text-[10px] text-text-muted hover:text-accent-red transition-colors"
              >
                Limpar
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {recentSearches.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSearchTerm(item)}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-bg-elevated hover:bg-white/10 border border-border/80 text-text-secondary text-xs transition-all active:scale-95 group"
                >
                  <span>{item}</span>
                  <span
                    onClick={(e) => removeSearchItem(item, e)}
                    className="text-[10px] text-text-muted hover:text-accent-red group-hover:inline-block"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Seletor Horizontal de Meses (Cobrir 12 meses) */}
        <div className="pb-2 shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {monthOptions.map((opt) => {
              const isSelected = selectedMonth === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => handleSelectMonth(opt.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isSelected
                      ? "bg-accent-pink text-white border-accent-pink shadow-glow"
                      : "bg-bg-elevated border-border/70 text-text-muted hover:text-text-primary hover:border-border"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtros Rápidos (Tipo & Ordenação) */}
        <div className="flex items-center justify-between pb-3 shrink-0 text-xs">
          <div className="flex gap-1 bg-bg-elevated p-0.5 rounded-xl border border-border/60">
            <button
              onClick={() => setFilterType("all")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterType === "all" ? "bg-accent-pink text-white" : "text-text-muted"
              }`}
            >
              Tudo
            </button>
            <button
              onClick={() => setFilterType("expense")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterType === "expense" ? "bg-accent-pink text-white" : "text-text-muted"
              }`}
            >
              Compras
            </button>
            <button
              onClick={() => setFilterType("settlement")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterType === "settlement" ? "bg-accent-pink text-white" : "text-text-muted"
              }`}
            >
              {searchScope === "shared" ? "Acertos (Pix)" : "Pagamentos"}
            </button>
          </div>

          <button
            onClick={() =>
              setSortBy((prev) =>
                prev === "date_desc"
                  ? "amount_desc"
                  : prev === "amount_desc"
                  ? "date_asc"
                  : "date_desc"
              )
            }
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary font-medium"
          >
            <span>↕</span>
            <span>
              {sortBy === "date_desc"
                ? "Mais recentes"
                : sortBy === "amount_desc"
                ? "Maior valor"
                : "Mais antigas"}
            </span>
          </button>
        </div>

        {/* Pílula de Resumo Otimizado (useMemo metrics) */}
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-bg-elevated/70 border border-border/80 mb-3 shrink-0 text-xs">
          <div className="flex flex-col">
            <span className="text-text-muted font-medium">
              {metrics.count === 0
                ? "Nenhum resultado"
                : `${metrics.count} ${metrics.count === 1 ? "registro" : "registros"} encontrado${
                    metrics.count > 1 ? "s" : ""
                  }`}
            </span>
            {metrics.carryOverCount > 0 && (
              <span className="text-[10px] text-amber-400 font-normal">
                (inclui {metrics.carryOverCount} saldo anterior)
              </span>
            )}
          </div>
          <div className="text-right">
            {searchScope === "shared" ? (
              <span className="font-bold text-text-primary tabular-nums">
                Gasto Total:{" "}
                <strong className="text-accent-pink text-sm">
                  {formatBRL(metrics.totalExpenses)}
                </strong>
              </span>
            ) : (
              <span className="font-bold text-text-primary tabular-nums">
                Total da Fatura:{" "}
                <strong className="text-[#A855F7] text-sm">
                  {formatBRL(Math.max(0, metrics.netTotal))}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Lista de Resultados Fluida com Scroll */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5">
          {loadingMonth ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted text-xs">
              <span className="spinner" />
              <span>Consultando histórico de despesas...</span>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <span className="text-4xl mb-3">🔍</span>
              <p className="text-sm font-bold text-text-primary mb-1">
                Nenhum lançamento encontrado
              </p>
              <p className="text-xs text-text-muted max-w-xs">
                {searchTerm
                  ? `Não encontramos registros para "${searchTerm}" neste filtro.`
                  : "Não há compras ou pagamentos registrados para o período selecionado."}
              </p>
            </div>
          ) : (
            filteredTransactions.map((t) => (
              <TransactionItem
                key={t.id}
                transaction={t}
                isSettled={settledExpenseIds.has(t.id)}
                showActions={!t.carryOver}
                onEdit={t.carryOver ? undefined : onEditTransaction}
                onDelete={t.carryOver ? undefined : onDeleteTransaction}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
