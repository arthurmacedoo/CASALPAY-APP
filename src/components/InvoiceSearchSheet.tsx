import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Transaction, GroupMember } from "../types";
import { formatBRL, formatDateBR, getCurrentMonthKey } from "../lib/formatters";
import { isInvoiceTransactionForMember } from "../lib/transactionVisibility";
import { TransactionItem } from "./TransactionItem";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

interface InvoiceSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeMember: GroupMember | null;
  groupId: string;
  initialTransactions: Transaction[];
  onEditTransaction?: (t: Transaction) => void;
  onDeleteTransaction?: (t: Transaction) => void;
}

const RECENT_SEARCHES_KEY = "casalpay_fatura_recent_searches";

export const InvoiceSearchSheet: React.FC<InvoiceSearchSheetProps> = ({
  isOpen,
  onClose,
  activeMember,
  groupId,
  initialTransactions,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const currentMonth = getCurrentMonthKey();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [filterType, setFilterType] = useState<"all" | "expense" | "settlement">("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [cachedTransactions, setCachedTransactions] = useState<Transaction[]>(initialTransactions);
  const [loadingMonth, setLoadingMonth] = useState(false);

  // Histórico de buscas salvas no LocalStorage
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : ["Farmácia", "Apple Pay", "iFood", "Uber"];
    } catch {
      return ["Farmácia", "Apple Pay", "iFood"];
    }
  });

  // Sincroniza initialTransactions removendo itens excluídos do mês ativo
  useEffect(() => {
    setCachedTransactions((prev) => {
      const currentMonthKey = initialTransactions[0]?.monthKey;
      const otherMonths = currentMonthKey ? prev.filter((t) => t.monthKey !== currentMonthKey) : prev;
      const map = new Map<string, Transaction>();
      otherMonths.forEach((t) => map.set(t.id, t));
      initialTransactions.forEach((t) => map.set(t.id, t));
      return Array.from(map.values());
    });
  }, [initialTransactions]);

  // Carregar transações de outro mês sob demanda
  const loadMonthTransactions = useCallback(
    async (monthKey: string) => {
      if (monthKey === "all") return;
      setLoadingMonth(true);
      try {
        const q = query(
          collection(db, "groups", groupId, "transactions"),
          where("monthKey", "==", monthKey)
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Transaction[];

        setCachedTransactions((prev) => {
          const map = new Map<string, Transaction>();
          prev.forEach((t) => map.set(t.id, t));
          docs.forEach((t) => map.set(t.id, t));
          return Array.from(map.values());
        });
      } catch (err) {
        console.warn("Erro ao buscar mês sob demanda:", err);
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

  // ── useMemo 1: Opções de Meses Disponíveis ──────────────────────────────────
  const monthOptions = useMemo(() => {
    const options: { key: string; label: string }[] = [{ key: "all", label: "Todos os Meses" }];
    const now = new Date();
    for (let i = 1; i >= -5; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${year}-${month}`;
      const shortLabel = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      options.push({ key, label: shortLabel });
    }
    return options;
  }, []);

  // ── useMemo 2: Filtro Otimizado de Transações da Fatura ─────────────────────
  const filteredTransactions = useMemo(() => {
    let list = cachedTransactions.filter((t) =>
      isInvoiceTransactionForMember(t, activeMember)
    );

    // Filtro por mês
    if (selectedMonth !== "all") {
      list = list.filter((t) => (t.monthKey || t.date.slice(0, 7)) === selectedMonth);
    }

    // Filtro por tipo
    if (filterType !== "all") {
      list = list.filter((t) => t.type === filterType);
    }

    // Filtro por texto / busca inteligente
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((t) => {
        const descMatch = t.description?.toLowerCase().includes(term);
        const amountCentsStr = String(t.amount);
        const amountReaisStr = (t.amount / 100).toFixed(2).replace(".", ",");
        const amountMatch =
          amountReaisStr.includes(term) ||
          amountCentsStr.includes(term) ||
          String(t.amount / 100).includes(term);
        const dateMatch = formatDateBR(t.date).includes(term) || t.date.includes(term);
        return descMatch || amountMatch || dateMatch;
      });
    }

    // Ordenação
    list = [...list].sort((a, b) => {
      if (sortBy === "date_desc") return b.date.localeCompare(a.date);
      if (sortBy === "date_asc") return a.date.localeCompare(b.date);
      if (sortBy === "amount_desc") return b.amount - a.amount;
      if (sortBy === "amount_asc") return a.amount - b.amount;
      return 0;
    });

    return list;
  }, [cachedTransactions, activeMember, selectedMonth, filterType, searchTerm, sortBy]);

  // ── useMemo 3: Métricas Consolidadas do Resultado ───────────────────────────
  const metrics = useMemo(() => {
    const totalExpenses = filteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSettlements = filteredTransactions
      .filter((t) => t.type === "settlement")
      .reduce((sum, t) => sum + t.amount, 0);

    const netTotal = totalExpenses - totalSettlements;
    const expenseCount = filteredTransactions.filter((t) => t.type === "expense").length;
    const settlementCount = filteredTransactions.filter((t) => t.type === "settlement").length;

    return {
      totalExpenses,
      totalSettlements,
      netTotal,
      count: filteredTransactions.length,
      expenseCount,
      settlementCount,
    };
  }, [filteredTransactions]);

  if (!isOpen) return null;

  const memberFirstName = activeMember?.name?.split(" ")[0] || "Membro";

  return createPortal(
    <div
      style={{ zIndex: 9999 }}
      onClick={onClose}
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in-up"
    >
      <div
        className="w-full sm:max-w-lg bg-[#16161F] border border-[#2A2A3E] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col h-[92vh] max-h-[92vh] overflow-hidden"
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
                Histórico & Busca da Fatura
              </h2>
              <p className="text-[11px] text-text-muted">
                Fatura de <strong className="text-accent-pink">{memberFirstName}</strong>
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

        {/* Campo de Busca Principal com Glow */}
        <div className="pt-3 pb-2 shrink-0">
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-base text-accent-pink">🔍</span>
            <input
              type="text"
              placeholder="Buscar por loja, valor ou data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveSearchToHistory(searchTerm);
              }}
              className="w-full bg-bg-elevated border border-border focus:border-accent-pink rounded-2xl pl-10 pr-9 py-2.5 text-base text-text-primary placeholder:text-text-muted focus:outline-none shadow-sm transition-all"
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
            <div className="flex items-center justify-between mb-1.5 px-0.5">
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

        {/* Seletor Horizontal de Meses */}
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
              Pagamentos
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
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-bg-elevated/70 border border-border/80 mb-3 shrink-0 text-xs">
          <span className="text-text-muted font-medium">
            {metrics.count === 0
              ? "Nenhum resultado"
              : `${metrics.count} ${metrics.count === 1 ? "registro" : "registros"} encontrado${
                  metrics.count > 1 ? "s" : ""
                }`}
          </span>
          <span className="font-bold text-text-primary tabular-nums">
            Total:{" "}
            <strong className="text-accent-pink text-sm">
              {formatBRL(Math.max(0, metrics.netTotal))}
            </strong>
          </span>
        </div>

        {/* Lista de Resultados Fluida com Scroll */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5">
          {loadingMonth ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted text-xs">
              <span className="spinner" />
              <span>Consultando histórico da fatura...</span>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <span className="text-4xl mb-3">🔍</span>
              <p className="text-sm font-bold text-text-primary mb-1">
                Nenhuma compra encontrada
              </p>
              <p className="text-xs text-text-muted max-w-xs">
                {searchTerm
                  ? `Não encontramos registros para "${searchTerm}" nesta fatura.`
                  : "Não há compras ou pagamentos registrados para o filtro selecionado."}
              </p>
            </div>
          ) : (
            filteredTransactions.map((t) => (
              <TransactionItem
                key={t.id}
                transaction={t}
                showActions
                onEdit={onEditTransaction}
                onDelete={onDeleteTransaction}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
