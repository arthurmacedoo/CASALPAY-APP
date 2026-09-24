import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTransactions } from "../hooks/useTransactions";
import { deleteDoc, setDoc, addDoc, serverTimestamp, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db, transactionDocRef, transactionsRef, COUPLE_ID, userDocRef } from "../lib/firebase";
import { useAuthContext } from "../contexts/AuthContext";
import { usePendingTransactions } from "../hooks/usePendingTransactions";
import { calculateBalance, generatePixSummary, getMonthKey } from "../lib/calculations";
import { getCurrentMonthKey, formatMonthLabel, formatBRL, formatDateBR, getTodayDateString, sanitizeDateString } from "../lib/formatters";
import { BalanceCard } from "../components/BalanceCard";
import { TransactionItem } from "../components/TransactionItem";
import { AnniversaryCountdown } from "../components/AnniversaryCountdown";
import { GroupSwitcherSheet } from "../components/GroupSwitcherSheet";
import { GroupSettingsSheet } from "../components/GroupSettingsSheet";
import { Button } from "../components/ui/Button";
import type { Transaction } from "../types";
import { PARTNER_NAME, OWNER_NAME } from "../constants/couple";
import { APP_VERSION, APP_RELEASE_NAME } from "../constants/version";
import { useGroupContext } from "../contexts/GroupContext";

import {
  isInvoiceTransactionForMember,
  isSharedTransaction,
  calculatePersonalInvoiceTotal,
} from "../lib/transactionVisibility";

type ViewMode = "shared" | "personal" | "pending";


// ── Card de transação pendente ────────────────────────────────────────────────
const PendingTransactionCard: React.FC<{
  transaction: Transaction;
  members: any[];
  onReview: (t: Transaction) => void;
  onQuickConfirm: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}> = ({ transaction, members, onReview, onQuickConfirm, onDelete }) => {
  const isExpense = transaction.type === "expense";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const deviceName = (transaction as any).deviceUser;
  const inferredMember = deviceName
    ? members.find((m) => m.name?.toLowerCase().includes(deviceName.toLowerCase()))
    : null;
  const ownerLabel = inferredMember ? inferredMember.name.split(" ")[0] : deviceName || "Membro";

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onQuickConfirm(transaction);
    } finally {
      setConfirming(false);
    }
  };

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
          <p className="text-xs text-text-muted flex items-center gap-1.5 flex-wrap">
            <span>Classificação:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-pink/15 text-accent-pink font-medium text-[11px]">
              💳 Fatura de {ownerLabel}
            </span>
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
          onClick={handleConfirm}
          disabled={confirming}
          className="flex-1 py-2 text-xs font-semibold rounded-xl bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition-colors flex items-center justify-center gap-1"
        >
          {confirming ? <span className="spinner" /> : "⚡ Confirmar Fatura"}
        </button>
        <button
          onClick={() => onReview(transaction)}
          className="px-3 py-2 text-xs font-semibold rounded-xl bg-accent-pink/20 text-accent-pink hover:bg-accent-pink/30 transition-colors"
        >
          ✏️ Revisar
        </button>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3 py-2 text-xs font-medium rounded-xl bg-bg-elevated text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-colors"
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
  const { user, logout } = useAuthContext();
  const { group, currentMember, members } = useGroupContext();
  const currentMonth = getCurrentMonthKey();

  const { transactions, loading, error, updateTransaction } = useTransactions(currentMonth);
  const { pendingTransactions, pendingCount, loading: pendingLoading } = usePendingTransactions();

  const [copied, setCopied] = useState(false);
  const [isGroupSheetOpen, setIsGroupSheetOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedInvoiceUserId, setSelectedInvoiceUserId] = useState<string>(() => {
    const requestedMember = new URLSearchParams(window.location.search).get("member");
    return requestedMember || user?.uid || "";
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView === "shared" || requestedView === "personal" || requestedView === "pending") {
      return requestedView;
    }

    const stored = sessionStorage.getItem("casalpay_viewMode");
    return (stored === "shared" || stored === "personal" || stored === "pending")
      ? (stored as ViewMode)
      : "shared";
  });

  const [pendingToast, setPendingToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Atualiza a sessionStorage sempre que a aba mudar, e escuta o BottomNav
  React.useEffect(() => {
    sessionStorage.setItem("casalpay_viewMode", viewMode);
  }, [viewMode]);

  // Auto-heal: recupera e corrige qualquer despesa confirmada com mês inválido gerado por atalhos anteriores (ex: 2026-36)
  React.useEffect(() => {
    if (!group) return;
    const healOrphanTransactions = async () => {
      try {
        const q = query(
          transactionsRef(group.id),
          where("monthKey", ">", "2026-12")
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            const safeDate = sanitizeDateString(data.date);
            const safeMonthKey = getMonthKey(safeDate);
            batch.update(docSnap.ref, {
              date: safeDate,
              monthKey: safeMonthKey,
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
          console.log(`[AutoHeal] ${snap.size} transações com mês corrigido.`);
        }
      } catch (e) {
        // Silencioso se não houver registros ou permissão
        console.warn("[AutoHeal] Verificação:", e);
      }
    };
    healOrphanTransactions();
  }, [group?.id]);

  // Sincroniza membro selecionado da URL ou quando o usuário autentica
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMember = params.get("member");
    const requestedView = params.get("view");
    if (requestedView === "shared" || requestedView === "personal" || requestedView === "pending") {
      setViewMode(requestedView);
    }
    if (requestedMember) {
      setSelectedInvoiceUserId(requestedMember);
    } else if (user?.uid && !selectedInvoiceUserId) {
      setSelectedInvoiceUserId(user.uid);
    }
  }, [user?.uid, window.location.search]);

  React.useEffect(() => {
    const handleHomeClick = () => setViewMode("shared");
    window.addEventListener("casalpay_home_clicked", handleHomeClick);
    return () => window.removeEventListener("casalpay_home_clicked", handleHomeClick);
  }, []);

  // Membro cuja fatura está sendo visualizada na Home
  const activeInvoiceMember = useMemo(() => {
    return members.find((m) => m.userId === selectedInvoiceUserId) || currentMember;
  }, [members, selectedInvoiceUserId, currentMember]);

  const isViewingMyOwnInvoice = activeInvoiceMember?.userId === user?.uid;
  const invoiceOwnerName = activeInvoiceMember?.name?.split(" ")[0] || "Pessoal";

  // ── Filtragem das abas compartilhada e fatura ────────────────────────────────
  const sharedTransactions = useMemo(
    () => transactions.filter(t => isSharedTransaction(t)),
    [transactions]
  );

  const myTransactions = useMemo(
    () => transactions.filter((t) => isInvoiceTransactionForMember(t, activeInvoiceMember)),
    [transactions, activeInvoiceMember]
  );

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const balance = useMemo(
    () => calculateBalance(sharedTransactions, members),
    [sharedTransactions, members]
  );

  const myInvoiceTotal = useMemo(
    () => calculatePersonalInvoiceTotal(myTransactions, activeInvoiceMember),
    [myTransactions, activeInvoiceMember]
  );

  // ── Lista ativa por aba ───────────────────────────────────────────────────────
  const activeTransactions =
    viewMode === "shared"   ? sharedTransactions  :
    viewMode === "personal" ? myTransactions      :
    pendingTransactions;

  const recentTransactions = viewMode === "pending"
    ? activeTransactions          // Pendentes: mostrar todos
    : activeTransactions.slice(0, 5);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCopyPix = async () => {
    const text = generatePixSummary(balance, formatMonthLabel(currentMonth), members);
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
    // Reutiliza o fluxo de edição do AddExpense garantindo data higienizada
    const safeDate = sanitizeDateString(t.date);
    navigate("/add", { state: { transaction: { ...t, date: safeDate } } });
  };

  const handleQuickConfirmPending = async (t: Transaction) => {
    if (!group) return;
    try {
      const deviceName = (t as any).deviceUser?.toLowerCase().trim();
      const matchedMember = deviceName
        ? members.find((m) => m.name.toLowerCase().includes(deviceName))
        : null;
      const ownerId =
        matchedMember?.userId ??
        (t.type === "expense" ? t.paidByUserId : t.fromUserId) ??
        user?.uid ??
        (members[0]?.userId ?? "");

      const ownerName = members.find((m) => m.userId === ownerId)?.name?.split(" ")[0] || "você";
      const safeDate = sanitizeDateString(t.date);

      await updateTransaction(
        t,
        {
          type: "expense",
          description: t.description || "Compra Apple Pay",
          amount: (t.amount / 100).toFixed(2).replace(".", ","),
          date: safeDate,
          paidByUserId: ownerId,
          splitBetweenUserIds: members.map((m) => m.userId),
          splitMode: "personal",
          personalOwnerUserId: ownerId,
          isInstallment: false,
          installmentCount: 2,
        },
        t.amount
      );

      // Mantém o usuário na aba de pendentes com feedback claro
      setPendingToast({
        message: `⚡ "${t.description || "Compra"}" adicionada à fatura de ${ownerName}!`,
        type: "success",
      });
      setTimeout(() => setPendingToast(null), 3500);
    } catch (err: any) {
      console.error("Erro ao confirmar despesa pendente:", err);
      setPendingToast({
        message: `Erro ao confirmar: ${err?.message || "Tente novamente"}`,
        type: "error",
      });
      setTimeout(() => setPendingToast(null), 4500);
    }
  };

  const handleDeletePending = async (t: Transaction) => {
    if (!group) return;
    try {
      await deleteDoc(transactionDocRef(group.id, t.id));
    } catch (err) {
      console.error("Erro ao excluir despesa pendente", err);
    }
  };

  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulateApplePay = async () => {
    if (!group) return;
    setIsSimulating(true);
    try {
      const partner = members.find((m) => m.userId !== user?.uid);
      const targetDeviceUser = partner ? partner.name.split(" ")[0] : "Zara";
      const descriptions = [
        "Farmácia Drogasil",
        "iFood - Restaurante",
        "Uber *Viagem",
        "Supermercado Pão de Açúcar",
        "Zara Brasil",
      ];
      const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
      const randomAmount = Math.floor(Math.random() * 8000) + 1500; // R$ 15,00 a R$ 95,00
      const today = getTodayDateString();

      await addDoc(transactionsRef(group.id), {
        type: "expense",
        description: `${randomDesc} (Apple Pay)`,
        amount: randomAmount,
        date: today,
        monthKey: today.slice(0, 7),
        coupleId: group.id,
        paidByUserId: null,
        personalOwnerUserId: null,
        splitMode: "personal",
        visibility: "personal",
        status: "pending",
        source: "webhook-apple-pay",
        deviceUser: targetDeviceUser,
        clientEventId: `sim_${Date.now()}`,
        capturedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Erro ao simular despesa Apple Pay:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-bg flex flex-col items-center px-6 py-10 overflow-y-auto">
        {/* Header do Perfil */}
        <header className="w-full flex items-center justify-between border-b border-border pb-4 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-blue/20 flex items-center justify-center text-accent-blue font-bold text-lg uppercase">
              {user?.email?.[0] ?? "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-text-primary">Sua Conta</span>
              <span className="text-xs text-text-muted truncate max-w-[150px]">{user?.email}</span>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="text-xs font-semibold text-accent-red px-3 py-1.5 rounded-lg bg-accent-red/10 hover:bg-accent-red/20 active:bg-accent-red/30 transition-colors"
          >
            Sair
          </button>
        </header>

        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-sm mt-8">
          <div className="w-20 h-20 rounded-full bg-accent-red/10 flex items-center justify-center mb-6">
            <span className="text-4xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-text-primary text-center mb-2">
            Acesso Negado
          </h2>
          <p className="text-text-secondary text-center text-sm mb-8">
            Sua sessão neste grupo expirou ou você não tem mais acesso.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <button 
              onClick={() => setIsGroupSheetOpen(true)}
              className="w-full py-3.5 bg-accent-blue text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:bg-accent-blue/90 transition-all active:scale-[0.98]"
            >
              Trocar de Grupo
            </button>
            
            <button 
              onClick={async () => {
                localStorage.removeItem('casalpay_active_group');
                if (user) {
                   await setDoc(userDocRef(user.uid), { activeGroupId: null }, { merge: true });
                }
                window.location.reload();
              }}
              className="w-full py-3.5 bg-bg-card border border-border text-text-primary font-semibold rounded-xl hover:bg-bg-elevated transition-all active:scale-[0.98]"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
        <GroupSwitcherSheet isOpen={isGroupSheetOpen} onClose={() => setIsGroupSheetOpen(false)} />
      </div>
    );
  }

  // ── Rótulos das abas ──────────────────────────────────────────────────────────
  // Removemos o número do label de texto para usar apenas o badge visual
  const pendingLabel = "Pendentes";

  return (
    <main className="flex-1 overflow-y-auto pb-24">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
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
        </div>

        {group && (
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full bg-bg-elevated hover:bg-white/5 transition-colors border border-border">
            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
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
              viewMode === "shared"   ? "translate-x-0      bg-accent-pink"  :
              viewMode === "personal" ? "translate-x-[100%] bg-[#A855F7]"    :
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
            id="tab-personal"
            onClick={() => setViewMode("personal")}
            className={`relative z-10 flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors duration-300 ${
              viewMode === "personal" ? "text-white" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {members.length > 1 ? "Fatura" : "Minha Fatura"}
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

        {/* ── Seletor de Fatura (quando mais de 1 membro e na aba Fatura) ─────── */}
        {viewMode === "personal" && members.length > 1 && (
          <div className="relative flex bg-bg-elevated rounded-xl p-1 border border-border animate-fade-in-up">
            {/* Sliding Pill Indicator */}
            <div className="absolute inset-1 pointer-events-none">
              <div
                className="h-full rounded-lg transition-transform duration-300 ease-out shadow-sm bg-accent-pink"
                style={{
                  width: `${100 / members.length}%`,
                  transform: `translateX(${Math.max(
                    0,
                    members.findIndex((m) => m.userId === activeInvoiceMember?.userId)
                  ) * 100}%)`,
                }}
              />
            </div>

            {members.map((m) => {
              const isSelected = activeInvoiceMember?.userId === m.userId;
              const isMe = m.userId === user?.uid;
              const firstName = m.name?.split(" ")[0] || "Membro";
              return (
                <button
                  key={m.userId}
                  onClick={() => setSelectedInvoiceUserId(m.userId)}
                  className={`relative z-10 flex-1 py-2 text-xs font-semibold rounded-lg transition-colors duration-300 ${
                    isSelected
                      ? "text-white"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {isMe ? "Sua Fatura" : `Fatura de ${firstName}`}
                </button>
              );
            })}
          </div>
        )}

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
        ) : viewMode === "personal" ? (
          <div className="card animate-fade-in-up">
            <p className="text-sm text-text-muted mb-1 font-medium text-center">
              {isViewingMyOwnInvoice ? "Total da Minha Fatura" : `Total da Fatura (${invoiceOwnerName})`}
            </p>
            <p className="text-3xl font-bold text-center tabular-nums text-text-primary mb-3">
              {formatBRL(Math.max(0, myInvoiceTotal))}
            </p>
            {myInvoiceTotal < 0 ? (
              <p className="text-xs text-accent-green text-center">
                Crédito de {formatBRL(Math.abs(myInvoiceTotal))} para a próxima fatura
              </p>
            ) : (
              <div className="flex items-center justify-between text-xs text-text-muted border-t border-border pt-3 mt-1">
                <span>{myTransactions.filter((t) => t.type === "expense").length} compras</span>
                <span>{myTransactions.filter((t) => t.type === "settlement").length} pagamentos</span>
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
                {viewMode === "shared"
                  ? "Últimas despesas"
                  : isViewingMyOwnInvoice
                  ? "Minha Fatura"
                  : `Fatura de ${invoiceOwnerName}`}
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
            <div className="flex flex-col gap-3">
              <button
                type="button"
                id="btn-simulate-apple-pay"
                onClick={handleSimulateApplePay}
                disabled={isSimulating}
                className="w-full py-2.5 px-4 rounded-xl border border-dashed border-amber-400/50 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                {isSimulating ? <span className="spinner" /> : "🧪 Simular Compra Apple Pay (Teste)"}
              </button>

              {pendingTransactions.length === 0 ? (
                <div className="card flex flex-col items-center py-10 gap-3 text-center">
                  <span className="text-4xl">✅</span>
                  <p className="text-text-secondary font-medium">Tudo em dia!</p>
                  <p className="text-text-muted text-sm max-w-xs">
                    As compras enviadas pelo iPhone via Apple Pay/Shortcuts aparecerão aqui para revisão.
                  </p>
                </div>
              ) : (
                pendingTransactions.map((t) => (
                  <PendingTransactionCard
                    key={t.id}
                    transaction={t}
                    members={members}
                    onReview={handleReviewPending}
                    onQuickConfirm={handleQuickConfirmPending}
                    onDelete={handleDeletePending}
                  />
                ))
              )}
            </div>
          ) :
          /* ── Abas shared/personal ─────────────────────────────────────────────── */
          recentTransactions.length === 0 ? (
            <div className="bg-bg-card border border-border rounded-3xl flex flex-col items-center py-12 gap-3 text-center px-6">
              <span className="text-4xl">{viewMode === "shared" ? "🛍️" : "💳"}</span>
              <p className="text-text-primary font-semibold">
                {viewMode === "shared"
                  ? "Nenhuma despesa ainda"
                  : isViewingMyOwnInvoice
                  ? "Nenhuma despesa pessoal lançada"
                  : `Nenhuma despesa na fatura de ${invoiceOwnerName}`}
              </p>
              <p className="text-text-muted text-sm max-w-xs">
                {viewMode === "shared"
                  ? "Adicione a primeira compra do mês."
                  : isViewingMyOwnInvoice
                  ? "Suas compras pessoais ou no cartão de crédito aparecerão aqui."
                  : `As compras e despesas pessoais de ${invoiceOwnerName} aparecerão aqui.`}
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

        {group?.id === COUPLE_ID && <AnniversaryCountdown />}

        {/* Badge discreto da versão ativa para conferência no celular */}
        <div className="flex justify-center pt-2 pb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-elevated/80 border border-border/60 text-[11px] text-text-muted font-medium select-none shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green inline-block animate-pulse" />
            v{APP_VERSION} · {APP_RELEASE_NAME}
          </span>
        </div>
      </div>
      
      <GroupSettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Toast flutuante de confirmação de despesa pendente */}
      {pendingToast && (
        <div
          role="status"
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] max-w-[90vw] px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-semibold animate-fade-in-up border ${
            pendingToast.type === "success"
              ? "bg-bg-elevated/95 text-accent-green border-accent-green/40 shadow-accent-green/10"
              : "bg-bg-elevated/95 text-accent-red border-accent-red/40 shadow-accent-red/10"
          }`}
        >
          <span className="text-sm shrink-0">{pendingToast.type === "success" ? "⚡" : "⚠️"}</span>
          <span className="truncate">{pendingToast.message}</span>
        </div>
      )}
    </main>
  );
};
