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

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { transactions, loading, error, deleteTransaction } =
    useTransactions(selectedMonth);

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const lower = searchTerm.toLowerCase();
    return transactions.filter(t => t.description.toLowerCase().includes(lower));
  }, [transactions, searchTerm]);

  const balance = useMemo(
    () => calculateBalance(transactions),
    [transactions]
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

      {/* Resumo do mês selecionado */}
      {!loading && transactions.length > 0 && (
        <div className="px-5 mb-4">
          <div className="card">
            <p className="text-sm text-text-muted mb-3 font-medium">
              Resumo de {monthLabel}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-elevated rounded-2xl p-3">
                <p className="text-xs text-text-muted">Despesas do mês</p>
                <p className="text-base font-bold text-text-primary tabular-nums mt-0.5">
                  {formatBRL(balance.totalExpenses)}
                </p>
              </div>
              <div className="bg-bg-elevated rounded-2xl p-3">
                <p className="text-xs text-text-muted">Qtd de compras</p>
                <p className="text-base font-bold text-text-primary mt-0.5">
                  {balance.expenseCount}
                </p>
              </div>
              <div className="bg-bg-elevated rounded-2xl p-3">
                <p className="text-xs text-text-muted">Arthur pagou</p>
                <p className="text-base font-bold text-accent-blue tabular-nums mt-0.5">
                  {formatBRL(balance.totalExpensesByArthur)}
                </p>
              </div>
              <div className="bg-bg-elevated rounded-2xl p-3">
                <p className="text-xs text-text-muted">Zara pagou</p>
                <p className="text-sm font-semibold text-accent-pink">
                  {formatBRL(balance.totalExpensesByZara)}
                </p>
              </div>
            </div>

            {/* Saldo líquido do mês */}
            <div
              className={`mt-3 rounded-2xl p-3 text-center border ${
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
                ? `Zara deve ${formatBRL(balance.netBalance)}`
                : `Arthur deve ${formatBRL(Math.abs(balance.netBalance))}`}
              </p>
            </div>
          </div>
        </div>
      )}

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
