import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTransactions } from "../hooks/useTransactions";
import { deleteDoc } from "firebase/firestore";
import { transactionDocRef } from "../lib/firebase";
import { usePendingTransactions } from "../hooks/usePendingTransactions";
import { calculateBalance, generatePixSummary } from "../lib/calculations";
import { getCurrentMonthKey, formatMonthLabel, formatBRL, formatDateBR } from "../lib/formatters";
import { BalanceCard } from "../components/BalanceCard";
import { TransactionItem } from "../components/TransactionItem";
import { AnniversaryCountdown } from "../components/AnniversaryCountdown";
import { GroupSwitcherSheet } from "../components/GroupSwitcherSheet";
import { Button } from "../components/ui/Button";
import type { Transaction } from "../types";
import { PARTNER_NAME, OWNER_NAME } from "../constants/couple";
import { useGroupContext } from "../contexts/GroupContext";


type ViewMode = "shared" | "zara" | "pending";

function isZaraInvoiceTransaction(t: Transaction): boolean {
  if (t.type === "settlement") return t.pixDestination === "zara_card";
  if (t.type === "expense") return t.splitType === "100% partner" && t.paidBy === "partner";
  return false;
}


// ── Card de transação pendente ────────────────────────────────────────────────
const PendingTransactionCard: React.FC<{
  transaction: Transaction;
  onReview: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}> = ({ transaction, onReview, onDelete }) => {
  const isExpense = transaction.type === "expense";
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="card border-l-4 border-l-amber-400/70 animate-fade-in-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">📥</span>
            <p className="text-base font-semibold text-text-primary truncate">
              {transaction.description || "Compra via Apple Pay"}
            </p>
          </div>
          <p className="text-xs text-text-muted mb-1">
            {isExpense ? formatDateBR(transaction.date) : transaction.date}
            {" · "}
            <span className="text-amber-400 font-medium">Aguardando revisão</span>
          </p>
          <p className="text-xs text-text-muted">
            Classificação atual: Fatura {PARTNER_NAME}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold tabular-nums text-amber-400">
            {formatBRL(transaction.amount)}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
        <button
          onClick={() => onReview(transaction)}
          className="flex-1 py-2 text-sm font-semibold rounded-xl bg-accent-pink/20 text-accent-pink hover:bg-accent-pink/30 transition-colors"
        >
          ✏️ Revisar
        </button>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-bg-elevated text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
        >
          🗑
        </button>
      </div>

      {isModalOpen && createPortal(
        <div style={{ zIndex: 9999 }} className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-bg-elevated p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-border">
            <h3 className="text-lg font-bold text-text-primary mb-2">Excluir pendente</h3>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              Tem certeza que deseja excluir esta despesa pendente? O valor de {formatBRL(transaction.amount)} será ignorado.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-text-primary bg-bg-card hover:bg-border rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDelete(transaction);
                  setIsModalOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium bg-accent-red/20 text-accent-red hover:bg-accent-red/30 rounded-xl transition-colors"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────────────────────
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const currentMonth = getCurrentMonthKey();
  const { group } = useGroupContext();

  const { transactions, loading, error } = useTransactions(currentMonth);
  const { pendingTransactions, pendingCount, loading: pendingLoading } = usePendingTransactions();

  const [copied, setCopied] = useState(false);
  const [isGroupSheetOpen, setIsGroupSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (sessionStorage.getItem("casalpay_viewMode") as ViewMode) || "shared";
  });

  // Atualiza a sessionStorage sempre que a aba mudar, e escuta o BottomNav
  React.useEffect(() => {
    sessionStorage.setItem("casalpay_viewMode", viewMode);
  }, [viewMode]);

  React.useEffect(() => {
    const handleHomeClick = () => setViewMode("shared");
    window.addEventListener("casalpay_home_clicked", handleHomeClick);
    return () => window.removeEventListener("casalpay_home_clicked", handleHomeClick);
  }, []);

  // ── Filtragem das abas compartilhada e fatura ────────────────────────────────
  const sharedTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.visibility) return t.visibility === "shared";
      if (t.type === "settlement" && t.pixDestination === "zara_card") return false;
      if (t.type === "expense" && t.paidBy === "partner" && t.splitType === "100% partner") return false;
      return true;
    });
  }, [transactions]);

  const zaraTransactions = useMemo(
    () => transactions.filter(isZaraInvoiceTransaction),
    [transactions]
  );

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const balance = useMemo(
    () => calculateBalance(sharedTransactions),
    [sharedTransactions]
  );

  const zaraInvoiceTotal = useMemo(() => {
    return zaraTransactions.reduce((acc, t) => {
      if (t.type === "expense") return acc + t.amount;
      if (t.type === "settlement") {
        if (t.from === "partner") return acc - t.amount;
        if (t.from === "owner") return acc + t.amount;
      }
      return acc;
    }, 0);
  }, [zaraTransactions]);

  // ── Lista ativa por aba ───────────────────────────────────────────────────────
  const activeTransactions =
    viewMode === "shared" ? sharedTransactions :
    viewMode === "zara"   ? zaraTransactions   :
    pendingTransactions;

  const recentTransactions = viewMode === "pending"
    ? activeTransactions          // Pendentes: mostrar todos
    : activeTransactions.slice(0, 5);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCopyPix = async () => {
    const text = generatePixSummary(balance, formatMonthLabel(currentMonth));
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReviewPending = (t: Transaction) => {
    // Reutiliza o fluxo de edição do AddExpense — ao salvar, updateTransaction
    // irá gravar status: 'confirmed' automaticamente.
    navigate("/add", { state: { transaction: t } });
  };

  const handleDeletePending = async (t: Transaction) => {
    try {
      await deleteDoc(transactionDocRef(t.id));
    } catch (err) {
      console.error("Erro ao excluir despesa pendente", err);
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

  // ── Rótulos das abas ──────────────────────────────────────────────────────────
  // Removemos o número do label de texto para usar apenas o badge visual
  const pendingLabel = "Pendentes";

  return (
    <main className="flex-1 overflow-y-auto pb-24">
      {/* Header */}
      <header className="px-6 pt-12 pb-4">
        {/* Grupo ativo com botão de troca */}
        <button
          id="btn-group-switcher"
          onClick={() => setIsGroupSheetOpen(true)}
          className="flex items-center gap-2 group mb-0.5 -ml-0.5 px-1 py-0.5 rounded-xl transition-colors hover:bg-white/5 active:bg-white/10"
          aria-label="Trocar grupo ativo"
        >
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            {group?.name ?? `${OWNER_NAME} e ${PARTNER_NAME}`}
          </h1>
          {/* Chevron animado */}
          <svg
            className="w-5 h-5 text-text-muted mt-0.5 transition-transform duration-200 group-hover:translate-y-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <p className="text-text-muted text-sm font-medium">Divisão de despesas</p>
      </header>

      {/* Bottom Sheet de troca de grupo */}
      <GroupSwitcherSheet
        isOpen={isGroupSheetOpen}
        onClose={() => setIsGroupSheetOpen(false)}
      />

      <div className="px-5 flex flex-col gap-4">

        {/* ── Toggle de três abas ──────────────────────────────────────────────── */}
        <div className="relative flex bg-bg-elevated rounded-xl p-1 border border-border">
          {/* Sliding Pill */}
          <div
            className={`absolute top-1 bottom-1 w-[calc(33.333%-0.167rem)] rounded-lg transition-all duration-300 ease-in-out shadow-sm ${
              viewMode === "shared"  ? "translate-x-0      bg-accent-pink"  :
              viewMode === "zara"   ? "translate-x-[100%] bg-[#A855F7]"    :
                                      "translate-x-[200%] bg-amber-500"
            }`}
          />

          <button
            id="tab-shared"
            onClick={() => setViewMode("shared")}
            className={`relative z-10 flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors duration-300 ${
              viewMode === "shared" ? "text-white" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Nossos Gastos
          </button>

          <button
            id="tab-zara"
            onClick={() => setViewMode("zara")}
            className={`relative z-10 flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors duration-300 ${
              viewMode === "zara" ? "text-white" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Fatura {PARTNER_NAME}
          </button>

          <button
            id="tab-pending"
            onClick={() => setViewMode("pending")}
            className={`relative z-10 flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors duration-300 ${
              viewMode === "pending" ? "text-white" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {pendingLabel}
            {pendingCount > 0 && viewMode !== "pending" && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-amber-400 text-bg-card rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Card principal condicional ───────────────────────────────────────── */}
        {(loading && viewMode !== "pending") ? (
          <div className="card flex items-center justify-center py-12">
            <span className="spinner" />
          </div>
        ) : viewMode === "shared" ? (
          <BalanceCard
            balance={balance}
            monthKey={currentMonth}
            onCopyPix={handleCopyPix}
            copied={copied}
          />
        ) : viewMode === "zara" ? (
          <div className="card animate-fade-in-up">
            <p className="text-sm text-text-muted mb-1 font-medium text-center">
              Total da Fatura {PARTNER_NAME}
            </p>
            <p className="text-3xl font-bold text-center tabular-nums text-text-primary mb-3">
              {formatBRL(Math.max(0, zaraInvoiceTotal))}
            </p>
            {zaraInvoiceTotal < 0 ? (
              <p className="text-xs text-accent-green text-center">
                Crédito de {formatBRL(Math.abs(zaraInvoiceTotal))} para a próxima fatura
              </p>
            ) : (
              <div className="flex items-center justify-between text-xs text-text-muted border-t border-border pt-3 mt-1">
                <span>{zaraTransactions.filter((t) => t.type === "expense").length} compras</span>
                <span>{zaraTransactions.filter((t) => t.type === "settlement").length} pagamentos</span>
              </div>
            )}
          </div>
        ) : (
          /* ── Card de caixa de entrada ─────────────────────────────────────── */
          <div className="card animate-fade-in-up border border-amber-400/20 bg-amber-400/5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📥</span>
              <div>
                <p className="text-base font-bold text-text-primary">
                  Caixa de Entrada
                </p>
                <p className="text-xs text-text-muted">
                  {pendingLoading
                    ? "Carregando..."
                    : pendingCount === 0
                    ? "Nenhuma compra aguardando revisão"
                    : `${pendingCount} compra${pendingCount > 1 ? "s" : ""} aguardando revisão`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Lista de transações ──────────────────────────────────────────────── */}
        <div>
          {viewMode !== "pending" && (
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-text-primary">
                {viewMode === "shared" ? "Últimas despesas" : `Fatura ${PARTNER_NAME}`}
              </h2>
              {activeTransactions.length > 5 && (
                <button
                  onClick={() => navigate("/history")}
                  className="text-sm text-accent-pink font-medium"
                >
                  Ver todas →
                </button>
              )}
            </div>
          )}

          {/* ── Loading ─────────────────────────────────────────────────────── */}
          {(viewMode === "pending" ? pendingLoading : loading) ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-20 animate-pulse bg-bg-elevated opacity-50" />
              ))}
            </div>

          /* ── Aba Pendentes ─────────────────────────────────────────────────── */
          ) : viewMode === "pending" ? (
            pendingTransactions.length === 0 ? (
              <div className="card flex flex-col items-center py-10 gap-3 text-center">
                <span className="text-4xl">✅</span>
                <p className="text-text-secondary font-medium">Tudo em dia!</p>
                <p className="text-text-muted text-sm max-w-xs">
                  As compras enviadas pelo iPhone via Apple Pay/Shortcuts aparecerão aqui para revisão.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingTransactions.map((t) => (
                  <PendingTransactionCard
                    key={t.id}
                    transaction={t}
                    onReview={handleReviewPending}
                    onDelete={handleDeletePending}
                  />
                ))}
              </div>
            )

          /* ── Abas shared/zara ─────────────────────────────────────────────── */
          ) : recentTransactions.length === 0 ? (
            <div className="card flex flex-col items-center py-10 gap-3 text-center">
              <span className="text-4xl">{viewMode === "shared" ? "🛍️" : "💳"}</span>
              <p className="text-text-secondary font-medium">
                {viewMode === "shared"
                  ? "Nenhuma despesa ainda"
                  : `Nenhuma compra na fatura de ${PARTNER_NAME}`}
              </p>
              <p className="text-text-muted text-sm max-w-xs">
                {viewMode === "shared"
                  ? "Adicione a primeira compra do mês."
                  : `As compras do cartão adicional de ${PARTNER_NAME} aparecerão aqui.`}
              </p>
              {viewMode === "shared" && (
                <Button size="sm" onClick={() => navigate("/add")} className="mt-2">
                  + Adicionar despesa
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentTransactions.map((t) => (
                <TransactionItem key={t.id} transaction={t} />
              ))}
            </div>
          )}
        </div>

        {/* Botão de adicionar — só em Nossos Gastos */}
        {viewMode === "shared" && activeTransactions.length > 0 && !loading && (
          <Button
            id="btn-add-expense-home"
            fullWidth
            onClick={() => navigate("/add")}
            className="mt-2"
          >
            + Adicionar despesa
          </Button>
        )}

        <AnniversaryCountdown />
      </div>
    </main>
  );
};
