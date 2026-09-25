import React, { useState } from "react";
import { useGoals } from "../hooks/useGoals";
import { useGroupContext } from "../contexts/GroupContext";
import { useAuthContext } from "../contexts/AuthContext";
import { GoalCard } from "../components/GoalCard";
import { NewGoalSheet } from "../components/NewGoalSheet";
import { GoalDetailSheet } from "../components/GoalDetailSheet";
import { GroupSwitcherSheet } from "../components/GroupSwitcherSheet";
import { formatBRL } from "../lib/formatters";
import type { Goal } from "../types";

export const GoalsPage: React.FC = () => {
  const { group } = useGroupContext();
  const { user } = useAuthContext();
  const {
    goals,
    contributions,
    withdrawals,
    metrics,
    loading,
    isGroupSupported,
    arthurUid,
    zaraUid,
    createGoal,
    addContribution,
    withdrawGoal,
    deleteGoal,
  } = useGoals();

  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    return localStorage.getItem("casalpay_hide_goal_balance") === "true";
  });

  const [isNewSheetOpen, setIsNewSheetOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isGroupSheetOpen, setIsGroupSheetOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "in_progress" | "completed">("all");

  const toggleHideBalance = () => {
    setHideBalance((prev) => {
      const next = !prev;
      localStorage.setItem("casalpay_hide_goal_balance", String(next));
      return next;
    });
  };

  const filteredGoals = goals.filter((g) => {
    if (filterStatus === "all") return true;
    return g.status === filterStatus;
  });

  // ── Se o grupo não for suportado (ex: Brasília, amigos) ─────────────────────
  if (!isGroupSupported) {
    return (
      <main className="flex-1 overflow-y-auto pb-24 px-6 pt-16 flex flex-col items-center justify-center text-center animate-fade-in-up">
        <div className="w-20 h-20 rounded-full bg-accent-pink/10 border border-accent-pink/20 flex items-center justify-center text-4xl mb-6 shadow-glow">
          🔒
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          Metas & Sonhos do Casal
        </h2>
        <p className="text-sm text-text-secondary max-w-sm mb-8 leading-relaxed">
          Esta funcionalidade é exclusiva para o planejamento financeiro e investimentos conjuntos de{" "}
          <strong className="text-text-primary">Arthur & Zara</strong>.
          <br /><br />
          No grupo atual (<span className="text-accent-pink font-semibold">{group?.name || "Secundário"}</span>), a gestão de metas está desativada para manter os gastos isolados.
        </p>

        <button
          onClick={() => setIsGroupSheetOpen(true)}
          className="w-full max-w-xs py-3.5 bg-gradient-to-r from-accent-pink to-[#A855F7] text-white font-bold rounded-2xl shadow-lg shadow-accent-pink/20 hover:opacity-90 active:scale-[0.98] transition-all"
        >
          Alterne para o Grupo do Casal
        </button>

        <GroupSwitcherSheet
          isOpen={isGroupSheetOpen}
          onClose={() => setIsGroupSheetOpen(false)}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto pb-28">
      {/* Header */}
      <header className="px-6 pt-12 pb-4 flex items-center justify-between">
        <div>
          <button
            onClick={() => setIsGroupSheetOpen(true)}
            className="flex items-center gap-2 group mb-0.5 -ml-0.5 px-1 py-0.5 rounded-xl transition-colors hover:bg-white/5"
          >
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Metas & Sonhos
            </h1>
            <svg className="w-5 h-5 text-text-muted mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
          <p className="text-text-muted text-xs font-medium">
            Patrimônio & Investimentos do Casal
          </p>
        </div>

        <button
          onClick={() => setIsNewSheetOpen(true)}
          className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-accent-pink to-[#A855F7] text-white text-xs font-bold shadow-md shadow-accent-pink/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
        >
          <span>+</span> Nova Meta
        </button>
      </header>

      <div className="px-5 flex flex-col gap-4">
        {/* Hero Card: Patrimônio Total Guardado */}
        <div className="relative overflow-hidden bg-[#16161F] border border-[#2A2A3E] rounded-3xl p-6 shadow-2xl">
          {/* Efeito Glow de Fundo */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent-pink/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-blue/10 rounded-full blur-3xl pointer-events-none -ml-10 -mb-10" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold tracking-wider text-text-muted uppercase">
                Patrimônio Total Guardado
              </span>
              <button
                onClick={toggleHideBalance}
                className="p-1.5 rounded-full bg-bg-elevated hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors text-xs"
                title={hideBalance ? "Exibir valores" : "Ocultar valores"}
              >
                {hideBalance ? "👁️ Mostrar" : "🙈 Ocultar"}
              </button>
            </div>

            <p className="text-3xl sm:text-4xl font-black text-text-primary tracking-tight tabular-nums mb-4">
              {hideBalance ? "••••••••" : formatBRL(metrics.totalSaved)}
            </p>

            {/* Barra Bipartida Arthur vs Zara */}
            <div className="mb-3">
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-accent-blue flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-blue" />
                  Arthur ({metrics.memberPercentages[arthurUid] ?? 50}%)
                </span>
                <span className="text-accent-pink flex items-center gap-1.5">
                  Zara ({metrics.memberPercentages[zaraUid] ?? 50}%)
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-pink" />
                </span>
              </div>

              <div className="w-full h-3 bg-bg-elevated rounded-full overflow-hidden flex p-[1px] border border-border/60">
                <div
                  className="h-full bg-accent-blue transition-all duration-700 rounded-l-full shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                  style={{ width: `${metrics.memberPercentages[arthurUid] ?? 50}%` }}
                />
                <div
                  className="h-full bg-accent-pink transition-all duration-700 rounded-r-full shadow-[0_0_12px_rgba(232,121,160,0.4)]"
                  style={{ width: `${metrics.memberPercentages[zaraUid] ?? 50}%` }}
                />
              </div>
            </div>

            {/* Pílula Informativa de Aportes do Mês */}
            <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
              <span className="text-text-muted">Aportes realizados este mês:</span>
              <span className="font-bold text-accent-green tabular-nums">
                + {hideBalance ? "••••" : formatBRL(metrics.monthlyInvested)}
              </span>
            </div>
          </div>
        </div>

        {/* Filtros de Metas */}
        <div className="flex items-center justify-between mt-2">
          <h2 className="text-sm font-bold text-text-primary">
            Nossos Sonhos ({goals.length})
          </h2>

          <div className="flex gap-1 bg-bg-elevated p-1 rounded-xl border border-border/60 text-xs">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                filterStatus === "all" ? "bg-accent-pink text-white" : "text-text-muted hover:text-text-primary"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterStatus("in_progress")}
              className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                filterStatus === "in_progress" ? "bg-accent-pink text-white" : "text-text-muted hover:text-text-primary"
              }`}
            >
              Em aberto
            </button>
            <button
              onClick={() => setFilterStatus("completed")}
              className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                filterStatus === "completed" ? "bg-accent-pink text-white" : "text-text-muted hover:text-text-primary"
              }`}
            >
              Concluídas
            </button>
          </div>
        </div>

        {/* Lista de Metas */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-bg-elevated/40 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="bg-[#16161F] border border-[#2A2A3E] rounded-3xl p-8 flex flex-col items-center text-center gap-3">
            <span className="text-4xl">🏖️</span>
            <p className="text-base font-bold text-text-primary">Nenhum sonho cadastrado ainda</p>
            <p className="text-xs text-text-muted max-w-xs mb-2">
              Comece cadastrando uma meta do casal para acompanhar o progresso conjunto sem misturar com os gastos diários.
            </p>
            <button
              onClick={() => setIsNewSheetOpen(true)}
              className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-accent-pink to-[#A855F7] text-white text-xs font-bold shadow-md shadow-accent-pink/20"
            >
              + Criar Primeira Meta
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {filteredGoals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                arthurUid={arthurUid}
                zaraUid={zaraUid}
                onClick={(selected) => setSelectedGoal(selected)}
                hideBalance={hideBalance}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sheets / Modais */}
      {isNewSheetOpen && (
        <NewGoalSheet
          isOpen={isNewSheetOpen}
          onClose={() => setIsNewSheetOpen(false)}
          onCreate={async (data) => {
            await createGoal(data);
          }}
        />
      )}

      {selectedGoal && (
        <GoalDetailSheet
          goal={selectedGoal}
          contributions={contributions}
          withdrawals={withdrawals}
          isOpen={selectedGoal !== null}
          onClose={() => setSelectedGoal(null)}
          arthurUid={arthurUid}
          zaraUid={zaraUid}
          currentUserUid={user?.uid}
          onAddContribution={async (goalId, amount, contributorType, note) => {
            const res = await addContribution(goalId, amount, contributorType, note);
            setSelectedGoal(res.updatedGoal);
          }}
          onWithdraw={async (goalId, amount, reason, contributorType) => {
            const res = await withdrawGoal(goalId, amount, reason, contributorType);
            setSelectedGoal(res.updatedGoal);
          }}
          onDelete={async (goalId) => {
            await deleteGoal(goalId);
            setSelectedGoal(null);
          }}
        />
      )}

      <GroupSwitcherSheet
        isOpen={isGroupSheetOpen}
        onClose={() => setIsGroupSheetOpen(false)}
      />
    </main>
  );
};
