import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTransactions } from "../hooks/useTransactions";
import { calculateBalance } from "../lib/calculations";
import {
  getCurrentMonthKey,
  formatBRL,
  formatMonthLabel,
} from "../lib/formatters";
import { TransactionItem } from "../components/TransactionItem";
import { MonthSelector } from "../components/MonthSelector";
import type { Transaction } from "../types";
import { OWNER_NAME, PARTNER_NAME } from "../constants/couple";

function isZaraCardPix(t: Transaction): boolean {
  return t.type === "settlement" && t.pixDestination === "zara_card";
}

function isZaraCardExpense(t: Transaction): boolean {
  return t.type === "expense" && t.splitType === "100% partner" && t.paidBy === "partner";
}

function isZaraInvoiceTransaction(t: Transaction): boolean {
  return isZaraCardPix(t) || isZaraCardExpense(t);
}

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"shared" | "zara">("shared");
  const { transactions, loading, error, deleteTransaction } =
    useTransactions(selectedMonth);

  // Passo 3: Arrumar as Abas no Histórico
  const sharedTransactions = useMemo(() => {
    return transactions.filter(t => !isZaraInvoiceTransaction(t));
  }, [transactions]);

  const zaraTransactions = useMemo(() => {
    return transactions.filter(t => isZaraInvoiceTransaction(t));
  }, [transactions]);

  // Passo 4: Matemática do Total da Fatura
  const zaraInvoiceTotal = useMemo(() => {
    return zaraTransactions.reduce((acc, t) => {
      if (t.type === 'expense') return acc + t.amount;
      if (t.type === 'settlement') {
         if (t.from === 'partner') return acc - t.amount;
         if (t.from === 'owner') return acc + t.amount;
      }
      return acc;
    }, 0);
  }, [zaraTransactions]);

  const filteredTransactions = useMemo(() => {
    const source = activeTab === "shared" ? sharedTransactions : zaraTransactions;
    if (!searchTerm.trim()) return source;
    const lower = searchTerm.toLowerCase();
    return source.filter(t => t.description.toLowerCase().includes(lower));
  }, [sharedTransactions, zaraTransactions, activeTab, searchTerm]);

  const balance = useMemo(
    () => calculateBalance(sharedTransactions),
    [sharedTransactions]
  );

  const handleEdit = (t: Transaction) => {
    navigate("/add", { state: { transaction: t } });
  };

  const handleDelete = async (t: Transaction) => {
    await deleteTransaction(t);
  };

  const monthLabel = formatMonthLabel(selectedMonth);

  return (
    <main className="flex-1 overflow-y-auto pb-24">
      {/* Header com Busca Expansível */}
      <div className="px-5 pt-14 pb-4 flex items-center justify-between min-h-[90px]">
        {!isSearchExpanded ? (
          <div className="animate-fade-in-up flex-1">
            <p className="text-text-muted text-sm font-medium">Todas as despesas</p>
            <h1 className="text-2xl font-bold text-text-primary mt-1">Histórico</h1>
          </div>
        ) : (
          <div className="animate-fade-in-up flex-1 mr-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-70">🔍</span>
            <input 
              autoFocus
              type="text" 
              placeholder="Buscar despesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-full pl-9 pr-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-pink transition-colors"
            />
          </div>
        )}
        
        <button 
          onClick={() => {
            if (isSearchExpanded) {
              setSearchTerm("");
            }
            setIsSearchExpanded(!isSearchExpanded);
          }}
          className="shrink-0 w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-secondary hover:text-accent-pink hover:border-accent-pink transition-colors"
        >
          {isSearchExpanded ? "✕" : "🔍"}
        </button>
      </div>

      {/* Seletor de mês */}
      <div className="px-5 mb-4">
        <MonthSelector
          selectedMonth={selectedMonth}
          onChange={setSelectedMonth}
        />
      </div>

      {/* Abas de Navegação (Posicionadas no topo) */}
      <div className="px-5 mb-4">
        <div className="relative flex bg-bg-elevated rounded-xl p-1 border border-border">
          {/* Sliding Pill Indicator */}
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-lg transition-all duration-300 ease-in-out shadow-sm ${
              activeTab === "shared" ? "translate-x-0 bg-accent-pink" : "translate-x-full bg-[#A855F7]"
            }`}
          />
          
          <button
            onClick={() => setActiveTab("shared")}
            className={`relative z-10 flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors duration-300 ${
              activeTab === "shared"
                ? "text-white"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Nossos Gastos
          </button>
          <button
            onClick={() => setActiveTab("zara")}
            className={`relative z-10 flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors duration-300 ${
              activeTab === "zara"
                ? "text-white"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Fatura Zara
          </button>
        </div>
      </div>

      {/* Saldo líquido do mês (apenas se estiver na aba Dia a Dia) */}
      {activeTab === "shared" && !loading && (
        <div className="px-5 mb-4">
          <div className="card">
            <p className="text-sm text-text-muted mb-3 font-medium">
              Resumo de {monthLabel}
            </p>
            
            <div className="bg-bg-elevated rounded-2xl p-5 text-center border border-border mb-3">
              <p className="text-xs text-text-muted mb-1 font-medium">Total Compartilhado</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">
                {formatBRL(balance.totalExpenses)}
              </p>
              <p className="text-xs text-text-muted mt-1">
                em {balance.expenseCount} compras
              </p>
            </div>

            <div
              className={`rounded-2xl p-3 text-center border ${
                balance.netBalance === 0
                  ? "bg-accent-green/10 border-accent-green/30"
                  : balance.netBalance > 0
                  ? "bg-accent-pink/10 border-accent-pink/30"
                  : "bg-accent-blue/10 border-accent-blue/30"
              }`}
            >
              <p className="text-xs text-text-muted mb-0.5">Saldo líquido</p>
              <p className={`font-semibold ${balance.netBalance === 0 ? "text-text-primary" : balance.netBalance > 0 ? "text-accent-pink" : "text-accent-blue"}`}>
                {balance.netBalance === 0 
                ? "Tudo quitado" 
                : balance.netBalance > 0 
                ? `${PARTNER_NAME} deve ${formatBRL(balance.netBalance)}`
                : `${OWNER_NAME} deve ${formatBRL(Math.abs(balance.netBalance))}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resumo da Fatura Zara (apenas se estiver na aba zara) */}
      {activeTab === "zara" && !loading && (
        <div className="px-5 mb-4 animate-fade-in-up">
          <div className="card text-center">
            <p className="text-sm text-text-muted mb-1 font-medium">
              Total da Fatura Zara
            </p>
            <p className="text-3xl font-bold text-text-primary tabular-nums">
              {formatBRL(Math.max(0, zaraInvoiceTotal))}
            </p>
            {zaraInvoiceTotal < 0 && (
              <p className="text-xs text-accent-green mt-1">Crédito de {formatBRL(Math.abs(zaraInvoiceTotal))} para a próxima fatura</p>
            )}
          </div>
        </div>
      )}

      {/* As Abas foram movidas para o topo */}

      {/* Lista de transações */}
      <div className="px-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="card h-24 animate-pulse bg-bg-elevated opacity-50"
              />
            ))}
          </div>
        ) : error ? (
          <div className="card flex flex-col items-center py-10 gap-3 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="text-text-secondary">{error}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="card flex flex-col items-center py-12 gap-3 text-center">
            <span className="text-4xl">📅</span>
            <p className="text-text-secondary font-medium">
              Sem despesas em {monthLabel}
            </p>
            <p className="text-text-muted text-sm max-w-xs">
              Selecione outro mês ou adicione uma nova despesa.
            </p>
          </div>
        ) : filteredTransactions.length === 0 && searchTerm ? (
          <div className="card flex flex-col items-center py-12 gap-3 text-center">
            <span className="text-4xl">🔍</span>
            <p className="text-text-secondary font-medium">
              Nenhum resultado encontrado
            </p>
            <p className="text-text-muted text-sm max-w-xs">
              Não encontramos despesas para "{searchTerm}".
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTransactions.map((t) => (
              <TransactionItem
                key={t.id}
                transaction={t}
                showActions
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
