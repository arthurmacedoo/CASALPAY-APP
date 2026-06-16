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
import { useAuthContext } from "../contexts/AuthContext";
import { useGroupContext } from "../contexts/GroupContext";
import {
  isInvoiceTransactionForMember,
  isSharedTransaction,
  calculatePersonalInvoiceTotal,
} from "../lib/transactionVisibility";

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"shared" | "personal">("shared");
  const { user } = useAuthContext();
  const { members, currentMember, isCurrentUserAdmin } = useGroupContext();

  const [selectedInvoiceMemberUserId, setSelectedInvoiceMemberUserId] = useState<string>(
    user?.uid || ""
  );

  // Sync initial state when user loads
  React.useEffect(() => {
    if (user?.uid && !selectedInvoiceMemberUserId) {
      setSelectedInvoiceMemberUserId(user.uid);
    }
  }, [user?.uid, selectedInvoiceMemberUserId]);
  const { transactions, loading, error, deleteTransaction } =
    useTransactions(selectedMonth);

  // Passo 3: Arrumar as Abas no Histórico
  const sharedTransactions = useMemo(
    () => transactions.filter(t => isSharedTransaction(t)),
    [transactions]
  );

  const selectedMember = useMemo(() => {
    return members.find(m => m.userId === selectedInvoiceMemberUserId) || currentMember;
  }, [members, selectedInvoiceMemberUserId, currentMember]);

  const invoiceTransactions = useMemo(() => {
    return transactions.filter(t => isInvoiceTransactionForMember(t, selectedMember));
  }, [transactions, selectedMember]);

  const invoiceTotal = useMemo(
    () => calculatePersonalInvoiceTotal(invoiceTransactions, selectedMember),
    [invoiceTransactions, selectedMember]
  );

  const filteredTransactions = useMemo(() => {
    const source = activeTab === "shared" ? sharedTransactions : invoiceTransactions;
    if (!searchTerm.trim()) return source;
    const lower = searchTerm.toLowerCase();
    return source.filter(t => t.description.toLowerCase().includes(lower));
  }, [sharedTransactions, invoiceTransactions, activeTab, searchTerm]);

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

      <div className="px-5 mb-4">
        <div className="relative flex bg-bg-elevated rounded-xl p-1 border border-border">
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-lg transition-transform duration-300 ease-in-out shadow-sm ${
              activeTab === "shared"
                ? "translate-x-0 bg-accent-pink"
                : "translate-x-full bg-[#A855F7]"
            }`}
          />
          <button
            onClick={() => setActiveTab("shared")}
            className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-300 ${
              activeTab === "shared"
                ? "text-white"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Nossos Gastos
          </button>
          <button
            onClick={() => setActiveTab("personal")}
            className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-300 ${
              activeTab === "personal"
                ? "text-white"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {isCurrentUserAdmin ? "Faturas Individuais" : "Minha Fatura"}
          </button>
        </div>
      </div>

      {activeTab === "personal" && isCurrentUserAdmin && (
        <div className="px-5 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {members.map(m => {
              const isSelected = m.userId === selectedInvoiceMemberUserId;
              const label = m.userId === currentMember?.userId ? "Você" : m.name;
              return (
                <button
                  key={m.userId}
                  onClick={() => setSelectedInvoiceMemberUserId(m.userId)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? "bg-[#A855F7] text-white"
                      : "bg-bg-elevated text-text-muted hover:text-text-primary border border-border"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!loading && (
        <div className="px-5 mb-4">
          <p className="text-sm text-text-muted mb-3 font-medium">
            Resumo de {monthLabel}
          </p>
          {activeTab === "shared" ? (
            <div className="flex gap-4 p-4 border border-border rounded-xl mb-4 bg-bg-elevated animate-fade-in-up">
              <div>
                <p className="text-xs text-text-muted">Despesas ({sharedTransactions.filter(t => t.type === 'expense').length})</p>
                <p className="font-medium text-text-primary">{formatBRL(calculateBalance(sharedTransactions).totalExpenses)}</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-4 p-4 border border-border rounded-xl mb-4 bg-bg-elevated animate-fade-in-up">
              <div>
                <p className="text-xs text-text-muted">Total da Fatura</p>
                <p className="font-medium text-[#A855F7]">{formatBRL(Math.max(0, invoiceTotal))}</p>
              </div>
            </div>
          )}
          {activeTab === "shared" && (
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
                ? `Alguém deve ${formatBRL(balance.netBalance)}`
                : `Você deve ${formatBRL(Math.abs(balance.netBalance))}`}
              </p>
            </div>
          )}
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
