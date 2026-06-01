import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTransactions } from "../hooks/useTransactions";
import { calculateBalance, generatePixSummary } from "../lib/calculations";
import { getCurrentMonthKey, formatMonthLabel } from "../lib/formatters";
import { BalanceCard } from "../components/BalanceCard";
import { TransactionItem } from "../components/TransactionItem";
import { AnniversaryCountdown } from "../components/AnniversaryCountdown";
import { Button } from "../components/ui/Button";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const currentMonth = getCurrentMonthKey();
  const { transactions, loading, error, deleteTransaction } = useTransactions(currentMonth);
  const [copied, setCopied] = useState(false);

  const balance = useMemo(
    () => calculateBalance(transactions),
    [transactions]
  );

  const recentTransactions = transactions.slice(0, 5);

  const handleCopyPix = async () => {
    const monthLabel = formatMonthLabel(currentMonth);
    const text = generatePixSummary(balance, monthLabel);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback para iOS
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-5 gap-4">
        <span className="text-4xl">😕</span>
        <p className="text-text-secondary text-center">{error}</p>
        <Button onClick={() => window.location.reload()} size="sm" variant="secondary">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto pb-24">
      {/* Header */}
      <header className="px-6 pt-12 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Arthur e Zara
        </h1>
        <p className="text-text-muted text-sm font-medium">Divisão de despesas</p>
      </header>

      <div className="px-5 flex flex-col gap-4">
        {/* Card de saldo */}
        {loading ? (
          <div className="card flex items-center justify-center py-12">
            <span className="spinner" />
          </div>
        ) : (
          <BalanceCard
            balance={balance}
            monthKey={currentMonth}
            onCopyPix={handleCopyPix}
            copied={copied}
          />
        )}

        {/* Últimas transações */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-text-primary">
              Últimas despesas
            </h2>
            {transactions.length > 5 && (
              <button
                onClick={() => navigate("/history")}
                className="text-sm text-accent-pink font-medium"
              >
                Ver todas →
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="card h-20 animate-pulse bg-bg-elevated opacity-50"
                />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="card flex flex-col items-center py-10 gap-3 text-center">
              <span className="text-4xl">🛍️</span>
              <p className="text-text-secondary font-medium">
                Nenhuma despesa ainda
              </p>
              <p className="text-text-muted text-sm max-w-xs">
                Adicione a primeira compra do mês e acompanhe quem deve a quem.
              </p>
              <Button
                size="sm"
                onClick={() => navigate("/add")}
                className="mt-2"
              >
                + Adicionar despesa
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentTransactions.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  showActions
                  onEdit={(tx) => navigate("/add", { state: { transaction: tx } })}
                  onDelete={(tx) => deleteTransaction(tx)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Botão de adicionar — só aparece quando há transações */}
        {!loading && transactions.length > 0 && (
          <Button
            id="btn-add-expense-home"
            fullWidth
            onClick={() => navigate("/add")}
            className="mt-2"
          >
            + Adicionar despesa
          </Button>
        )}

        {/* Contagem Regressiva para 1 ano de namoro */}
        <AnniversaryCountdown />
      </div>
    </main>
  );
};
