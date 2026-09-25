import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import type { Goal, GoalContribution, GoalWithdrawal, ContributorType } from "../types";
import { formatBRL, formatDateBR, maskCurrencyInput, formatBRLRaw, formatDeadline } from "../lib/formatters";
import { parseToCents } from "../lib/calculations";

interface GoalDetailSheetProps {
  goal: Goal | null;
  contributions: GoalContribution[];
  withdrawals?: GoalWithdrawal[];
  isOpen: boolean;
  onClose: () => void;
  arthurUid: string;
  zaraUid: string;
  currentUserUid?: string;
  onAddContribution: (
    goalId: string,
    amount: number,
    contributorType: ContributorType,
    note?: string
  ) => Promise<any>;
  onWithdraw: (
    goalId: string,
    amount: number,
    reason: string,
    contributorType: ContributorType
  ) => Promise<any>;
  onDelete: (goalId: string) => Promise<void>;
}

interface HistoryItem {
  id: string;
  type: "contribution" | "withdrawal";
  amount: number;
  date: string;
  createdAt: string;
  contributorType: ContributorType;
  label: string;
}

export const GoalDetailSheet: React.FC<GoalDetailSheetProps> = ({
  goal,
  contributions,
  withdrawals = [],
  isOpen,
  onClose,
  arthurUid,
  zaraUid,
  currentUserUid,
  onAddContribution,
  onWithdraw,
  onDelete,
}) => {
  const defaultWithdrawType: ContributorType =
    currentUserUid && currentUserUid === zaraUid ? "zara" : "arthur";

  const [contributorType, setContributorType] = useState<ContributorType>("split");
  const [withdrawContributorType, setWithdrawContributorType] = useState<ContributorType>(defaultWithdrawType);
  const [amountStr, setAmountStr] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmountStr, setWithdrawAmountStr] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goalContribs = useMemo(
    () => (goal ? contributions.filter((c) => c.goalId === goal.id) : []),
    [contributions, goal?.id]
  );

  const goalWithdrawals = useMemo(
    () => (goal ? withdrawals.filter((w) => w.goalId === goal.id) : []),
    [withdrawals, goal?.id]
  );

  const historyItems: HistoryItem[] = useMemo(() => {
    if (!goal) return [];
    const items: HistoryItem[] = [
      ...goalContribs.map((c) => ({
        id: c.id,
        type: "contribution" as const,
        amount: c.amount,
        date: c.date,
        createdAt: c.createdAt,
        contributorType: c.contributorType,
        label: c.note || "Aporte na meta",
      })),
      ...goalWithdrawals.map((w) => ({
        id: w.id,
        type: "withdrawal" as const,
        amount: w.amount,
        date: w.date,
        createdAt: w.createdAt,
        contributorType: w.contributorType || "split",
        label: w.reason || "Resgate da meta",
      })),
    ];

    return items.sort((a, b) => {
      const dateA = a.createdAt || a.date;
      const dateB = b.createdAt || b.date;
      return dateB.localeCompare(dateA);
    });
  }, [goal, goalContribs, goalWithdrawals]);

  if (!isOpen || !goal) return null;

  const percentage = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0;

  const arthurContrib = goal.contributionsByMember?.[arthurUid] || 0;
  const zaraContrib = goal.contributionsByMember?.[zaraUid] || 0;
  const totalMemberContrib = arthurContrib + zaraContrib;

  const arthurPct = totalMemberContrib > 0
    ? Math.round((arthurContrib / totalMemberContrib) * 100)
    : 50;
  const zaraPct = totalMemberContrib > 0
    ? 100 - arthurPct
    : 50;

  const handleAddQuickAmount = (cents: number) => {
    const current = parseToCents(amountStr) || 0;
    const next = current + cents;
    setAmountStr(formatBRLRaw(next));
  };

  const handleSaveContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cents = parseToCents(amountStr);
    if (!cents || cents <= 0) {
      setError("Informe um valor válido para o aporte.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddContribution(goal.id, cents, contributorType, note.trim() || undefined);
      setAmountStr("");
      setNote("");
    } catch (err: any) {
      setError(err?.message || "Erro ao registrar aporte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWithdrawModal = () => {
    setWithdrawContributorType(currentUserUid && currentUserUid === zaraUid ? "zara" : "arthur");
    setShowWithdrawModal(true);
  };

  const handleConfirmWithdraw = async () => {
    setError(null);
    const cents = parseToCents(withdrawAmountStr);
    if (!cents || cents <= 0) {
      setError("Informe um valor válido para o resgate.");
      return;
    }
    if (cents > goal.currentAmount) {
      setError("O valor do resgate não pode ser maior que o saldo acumulado.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onWithdraw(
        goal.id,
        cents,
        withdrawReason.trim() || "Resgate para uso",
        withdrawContributorType
      );
      setShowWithdrawModal(false);
      setWithdrawAmountStr("");
      setWithdrawReason("");
    } catch (err: any) {
      setError(err?.message || "Erro ao efetuar resgate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      style={{ zIndex: 9999 }}
      onClick={onClose}
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in-up"
    >
      <div
        className="w-full sm:max-w-lg bg-[#16161F] border border-[#2A2A3E] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header da Folha */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{goal.emoji}</span>
            <div>
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                {goal.category}
              </span>
              <h2 className="text-lg font-bold text-text-primary leading-tight">
                {goal.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-accent-red/10 border border-accent-red/30 text-accent-red text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Resumo da Meta */}
        <div className="bg-bg-elevated/70 border border-border/70 rounded-2xl p-4 mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <p className="text-xs text-text-muted font-medium">Guardado até agora</p>
              <p className="text-2xl font-black text-text-primary tabular-nums">
                {formatBRL(goal.currentAmount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted font-medium">Meta final</p>
              <p className="text-sm font-semibold text-text-secondary tabular-nums">
                {formatBRL(goal.targetAmount)}
              </p>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="w-full h-3 bg-bg-card rounded-full overflow-hidden mb-2.5 border border-border/40 p-[1px]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-pink via-[#C084FC] to-accent-blue transition-all duration-500 shadow-[0_0_10px_rgba(232,121,160,0.3)]"
              style={{ width: `${Math.max(4, percentage)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-bold text-accent-pink">{percentage}% alcançado</span>
            <div className="flex gap-2">
              <span className="text-accent-blue font-medium">Arthur: {formatBRL(arthurContrib)} ({arthurPct}%)</span>
              <span className="text-text-muted">·</span>
              <span className="text-accent-pink font-medium">Zara: {formatBRL(zaraContrib)} ({zaraPct}%)</span>
            </div>
          </div>

          {goal.deadline && (
            <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-xs text-text-muted">
              <span>Prazo Estimado:</span>
              <span className="font-semibold text-text-primary">📅 {formatDeadline(goal.deadline)}</span>
            </div>
          )}
        </div>

        {/* Formulário: Registrar Novo Aporte */}
        <form onSubmit={handleSaveContribution} className="mb-6">
          <h3 className="text-sm font-bold text-text-primary mb-2.5 flex items-center gap-2">
            <span>💰</span> Registrar Novo Aporte
          </h3>

          {/* Seletor de Quem Aportou */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              type="button"
              onClick={() => setContributorType("arthur")}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                contributorType === "arthur"
                  ? "bg-accent-blue/20 border-accent-blue text-accent-blue shadow-sm"
                  : "bg-bg-elevated border-border/60 text-text-muted hover:text-text-primary"
              }`}
            >
              Arthur 💙 (100%)
            </button>
            <button
              type="button"
              onClick={() => setContributorType("zara")}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                contributorType === "zara"
                  ? "bg-accent-pink/20 border-accent-pink text-accent-pink shadow-sm"
                  : "bg-bg-elevated border-border/60 text-text-muted hover:text-text-primary"
              }`}
            >
              Zara 💖 (100%)
            </button>
            <button
              type="button"
              onClick={() => setContributorType("split")}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                contributorType === "split"
                  ? "bg-[#C084FC]/20 border-[#C084FC] text-[#C084FC] shadow-sm"
                  : "bg-bg-elevated border-border/60 text-text-muted hover:text-text-primary"
              }`}
            >
              50/50 💑 (Meio a Meio)
            </button>
          </div>

          {/* Campo de Valor */}
          <div className="mb-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(maskCurrencyInput(e.target.value))}
              className="w-full bg-bg-elevated border border-border/80 focus:border-accent-pink rounded-2xl px-4 py-3 text-lg font-bold text-text-primary outline-none transition-colors tabular-nums"
            />
          </div>

          {/* Chips Rápidos */}
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {[5000, 10000, 20000, 50000, 100000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleAddQuickAmount(val)}
                className="shrink-0 px-2.5 py-1 rounded-xl bg-bg-elevated border border-border/60 hover:border-accent-pink/50 text-[11px] font-semibold text-text-secondary active:scale-95 transition-all"
              >
                + R$ {val / 100}
              </button>
            ))}
          </div>

          {/* Observação Opcional */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Nota (ex: Bônus do mês, economia...)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-bg-elevated border border-border/80 focus:border-accent-pink rounded-xl px-3 py-2 text-base text-text-primary outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-accent-pink to-[#A855F7] text-white text-sm font-bold shadow-lg shadow-accent-pink/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <span className="spinner" /> : "⚡ Confirmar Aporte"}
          </button>
        </form>

        {/* Histórico Consolidado (Aportes + Resgates) */}
        <div className="border-t border-border/60 pt-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Histórico ({historyItems.length})
            </h4>
            {historyItems.length > 0 && (
              <span className="text-[11px] text-text-muted">
                {goalContribs.length} aporte{goalContribs.length !== 1 ? "s" : ""} · {goalWithdrawals.length} resgate{goalWithdrawals.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {historyItems.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4 bg-bg-elevated/40 rounded-xl">
              Nenhuma movimentação registrada ainda nesta meta.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {historyItems.map((item) => {
                const isArthur = item.contributorType === "arthur";
                const isZara = item.contributorType === "zara";
                const isContrib = item.type === "contribution";

                const badgeColor = isArthur
                  ? "bg-accent-blue/15 text-accent-blue border-accent-blue/30"
                  : isZara
                  ? "bg-accent-pink/15 text-accent-pink border-accent-pink/30"
                  : "bg-[#C084FC]/15 text-[#C084FC] border-[#C084FC]/30";

                const label = isArthur
                  ? "Arthur 💙"
                  : isZara
                  ? "Zara 💖"
                  : "Arthur & Zara 💑 (50/50)";

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-bg-elevated border border-border/50 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                          {label}
                        </span>
                        <span className="text-text-muted truncate max-w-[140px]">
                          {isContrib ? item.label : `💸 ${item.label}`}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted">{formatDateBR(item.date)}</p>
                    </div>
                    <span
                      className={`font-bold tabular-nums text-sm ${
                        isContrib ? "text-accent-green" : "text-amber-400"
                      }`}
                    >
                      {isContrib ? `+ ${formatBRL(item.amount)}` : `- ${formatBRL(item.amount)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ações Secundárias (Resgatar / Excluir) */}
        <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs">
          <button
            type="button"
            onClick={handleOpenWithdrawModal}
            className="px-3 py-2 rounded-xl bg-bg-elevated hover:bg-white/10 text-amber-400 font-semibold transition-colors flex items-center gap-1"
          >
            💸 Resgatar Valor
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-2 rounded-xl bg-bg-elevated hover:bg-accent-red/20 text-accent-red font-medium transition-colors"
          >
            🗑 Excluir Meta
          </button>
        </div>

        {/* Modal de Resgate */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4">
            <div className="bg-[#16161F] border border-border p-5 rounded-3xl max-w-sm w-full animate-fade-in-up">
              <h4 className="text-base font-bold text-text-primary mb-1">💸 Resgatar da Meta</h4>
              <p className="text-xs text-text-muted mb-4">
                Informe o valor a retirar de <strong>{goal.title}</strong>:
              </p>

              {/* Quem está retirando? */}
              <div className="mb-3">
                <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
                  Quem está retirando o dinheiro?
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWithdrawContributorType("arthur")}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                      withdrawContributorType === "arthur"
                        ? "bg-accent-blue/20 border-accent-blue text-accent-blue shadow-sm"
                        : "bg-bg-elevated border-border/60 text-text-muted hover:text-text-primary"
                    }`}
                  >
                    Arthur 💙
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawContributorType("zara")}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                      withdrawContributorType === "zara"
                        ? "bg-accent-pink/20 border-accent-pink text-accent-pink shadow-sm"
                        : "bg-bg-elevated border-border/60 text-text-muted hover:text-text-primary"
                    }`}
                  >
                    Zara 💖
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawContributorType("split")}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                      withdrawContributorType === "split"
                        ? "bg-[#C084FC]/20 border-[#C084FC] text-[#C084FC] shadow-sm"
                        : "bg-bg-elevated border-border/60 text-text-muted hover:text-text-primary"
                    }`}
                  >
                    50/50 💑
                  </button>
                </div>
              </div>

              {/* Valor */}
              <div className="mb-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={withdrawAmountStr}
                  onChange={(e) => setWithdrawAmountStr(maskCurrencyInput(e.target.value))}
                  className="w-full bg-bg-elevated border border-border rounded-xl p-3 text-base font-bold text-text-primary outline-none tabular-nums"
                />
              </div>

              {/* Chips Rápidos de Resgate */}
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                {[5000, 10000, 20000, 50000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setWithdrawAmountStr(formatBRLRaw(val))}
                    className="shrink-0 px-2 py-1 rounded-lg bg-bg-elevated border border-border/60 hover:border-amber-400/50 text-[10px] font-semibold text-text-secondary active:scale-95 transition-all"
                  >
                    R$ {val / 100}
                  </button>
                ))}
                {goal.currentAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setWithdrawAmountStr(formatBRLRaw(goal.currentAmount))}
                    className="shrink-0 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold active:scale-95 transition-all"
                  >
                    Saldo Total
                  </button>
                )}
              </div>

              {/* Motivo */}
              <input
                type="text"
                placeholder="Motivo (ex: Viagem realizada, emergência...)"
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded-xl p-3 text-base text-text-primary mb-4 outline-none"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-bg-elevated text-text-secondary text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWithdraw}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-bg text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  {isSubmitting ? "Resgatando..." : "Confirmar Resgate"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Confirmar Exclusão */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4">
            <div className="bg-[#16161F] border border-border p-5 rounded-3xl max-w-sm w-full animate-fade-in-up">
              <h4 className="text-base font-bold text-accent-red mb-2">Excluir esta Meta?</h4>
              <p className="text-xs text-text-muted mb-5 leading-relaxed">
                Tem certeza que deseja apagar <strong>"{goal.title}"</strong>?
                {goal.currentAmount > 0 && (
                  <span className="block mt-1 text-amber-400 font-medium">
                    Atenção: O saldo acumulado de {formatBRL(goal.currentAmount)} e todo o histórico serão removidos.
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-bg-elevated text-text-secondary text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await onDelete(goal.id);
                    setShowDeleteConfirm(false);
                    onClose();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-accent-red text-white text-xs font-bold"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
