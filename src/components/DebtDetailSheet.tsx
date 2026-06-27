import React, { useEffect, useCallback } from "react";
import type { DirectDebt, GroupMember } from "../types";
import { formatBRL, formatDateBR } from "../lib/formatters";

interface DebtDetailSheetProps {
  debt: DirectDebt | null;
  members: GroupMember[];
  currentUserId: string | undefined;
  onClose: () => void;
}

export const DebtDetailSheet: React.FC<DebtDetailSheetProps> = ({
  debt,
  members,
  currentUserId,
  onClose,
}) => {
  const isOpen = debt !== null;

  // ── Scroll lock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Fechar com Escape ────────────────────────────────────────────────────────
  const handleEscape = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );
  useEffect(() => {
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleEscape]);

  if (!debt) return null;

  // ── Dados derivados ──────────────────────────────────────────────────────────
  const isDebtor = debt.debtorId === currentUserId;
  const otherMember = members.find(
    (m) => m.userId === (isDebtor ? debt.creditorId : debt.debtorId)
  );
  const otherName   = otherMember?.name.split(" ")[0] ?? "Membro";
  const otherNameFull = otherMember?.name ?? "Membro";

  const totalSettled  = debt.settlements.reduce((acc, s) => acc + s.amount, 0);
  const nettingAmount = Math.max(0, debt.rawAmount - totalSettled - debt.amount);
  const hasNetting    = nettingAmount > 1; // ignora diferença de 1 centavo (arredondamento)
  const hasSettlements = debt.settlements.length > 0;
  const hasReduction  = hasSettlements || hasNetting;

  // Progresso: quanto do bruto já foi abatido
  const progressPct = debt.rawAmount > 0
    ? Math.min(100, Math.round(((debt.rawAmount - debt.amount) / debt.rawAmount) * 100))
    : 0;

  // Cores por direção da dívida
  const pink     = isDebtor;
  const colorHex = pink ? "#E879A0" : "#7B8FFF";

  const headerLabel = isDebtor
    ? `Você deve a ${otherName}`
    : `${otherName} te deve`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da dívida com ${otherNameFull}`}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] flex flex-col
                   bg-zinc-900 rounded-t-3xl shadow-2xl border-t border-zinc-800
                   animate-slide-up"
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-zinc-700" />
        </div>

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div className="px-4 pb-4 flex-shrink-0">
          <div
            className="rounded-2xl p-4 border"
            style={{
              background: `linear-gradient(135deg, ${colorHex}18 0%, ${colorHex}08 100%)`,
              borderColor: `${colorHex}30`,
            }}
          >
            {/* Label */}
            <p className="text-xs font-semibold uppercase tracking-widest mb-2"
               style={{ color: `${colorHex}99` }}>
              {isDebtor ? "💸 Você deve" : "💰 Te devem"}
            </p>

            {/* Nome + valor */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-zinc-200 leading-tight">
                  {headerLabel}
                </p>
                {hasReduction && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    originalmente {formatBRL(debt.rawAmount)}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-3xl font-bold tabular-nums"
                   style={{ color: colorHex }}>
                  {formatBRL(debt.amount)}
                </p>
              </div>
            </div>

            {/* Barra de progresso (mostra quanto já foi abatido) */}
            {hasReduction && debt.rawAmount > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>{progressPct}% já abatido</span>
                  <span>{formatBRL(debt.rawAmount - debt.amount)} reduzido</span>
                </div>
                <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progressPct}%`,
                      background: `linear-gradient(90deg, ${colorHex}80, ${colorHex})`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── BODY (scrollável) ───────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-4 pb-8 space-y-5">

          {/* ── SEÇÃO: Despesas ─────────────────────────────────────────────── */}
          <section>
            <SectionTitle icon="📦" label="Despesas que geraram esta dívida" />
            <div className="space-y-2">
              {debt.sources.length === 0 ? (
                <p className="text-sm text-zinc-500 italic px-1">
                  Nenhuma despesa rastreada.
                </p>
              ) : (
                debt.sources.map((src, i) => (
                  <div
                    key={`${src.expenseId}-${i}`}
                    className="bg-zinc-800/80 rounded-2xl border border-zinc-700/60 overflow-hidden"
                  >
                    <div className="flex items-stretch">
                      {/* Faixa lateral colorida */}
                      <div
                        className="w-1 flex-shrink-0 rounded-l-2xl"
                        style={{ background: colorHex }}
                      />
                      <div className="flex justify-between items-start gap-3 p-3.5 flex-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-100 truncate">
                            {src.description}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                            {formatDateBR(src.date)}
                          </p>
                          <p className="text-xs text-zinc-500 leading-relaxed">
                            {formatBRL(src.totalAmount)} ÷ {src.splitCount} pessoas
                          </p>
                          <p className="text-xs mt-0.5">
                            <span className="text-zinc-500">pago por </span>
                            <span className="text-zinc-300 font-medium">{src.paidByName}</span>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-zinc-500 mb-0.5">sua cota</p>
                          <p
                            className="text-lg font-bold tabular-nums"
                            style={{ color: colorHex }}
                          >
                            {formatBRL(src.yourShare)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ── SEÇÃO: Como chegamos neste valor ────────────────────────────── */}
          {hasReduction && (
            <section>
              <SectionTitle icon="🧮" label="Como chegamos neste valor" />
              <div className="bg-zinc-800/60 rounded-2xl border border-zinc-700/60 p-4 space-y-2">

                {/* Bruto */}
                <CalcRow
                  label="Despesas registradas"
                  value={formatBRL(debt.rawAmount)}
                  valueClass="text-zinc-200"
                  sign=""
                />

                {/* Acertos */}
                {hasSettlements && (
                  <CalcRow
                    label={`Pix já pagos (${debt.settlements.length}x)`}
                    value={formatBRL(totalSettled)}
                    valueClass="text-accent-green"
                    sign="−"
                  />
                )}

                {/* Netting */}
                {hasNetting && (
                  <CalcRow
                    label="Compensação mútua"
                    value={formatBRL(nettingAmount)}
                    valueClass="text-accent-blue"
                    sign="−"
                    tooltip="Você também devia algo a esta pessoa. O app abateu automaticamente."
                  />
                )}

                {/* Divisor */}
                <div className="border-t border-zinc-700 pt-2 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-zinc-200">
                      Valor final
                    </span>
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{ color: colorHex }}
                    >
                      {formatBRL(debt.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dica de compensação mútua */}
              {hasNetting && (
                <div className="mt-2 px-1">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    💡 <span className="text-zinc-400">Compensação mútua:</span> existia uma dívida no sentido contrário ({formatBRL(nettingAmount)}).
                    O app abateu automaticamente para minimizar o número de Pix necessários.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ── SEÇÃO: Acertos ──────────────────────────────────────────────── */}
          {hasSettlements && (
            <section>
              <SectionTitle icon="✅" label="Acertos Pix já realizados" />
              <div className="space-y-2">
                {debt.settlements.map((s, i) => (
                  <div
                    key={`${s.settlementId}-${i}`}
                    className="bg-zinc-800/80 rounded-2xl border border-accent-green/20 overflow-hidden"
                  >
                    <div className="flex items-stretch">
                      <div className="w-1 flex-shrink-0 rounded-l-2xl bg-accent-green" />
                      <div className="flex justify-between items-center gap-3 p-3.5 flex-1">
                        <div>
                          <p className="text-sm font-semibold text-accent-green">
                            Pix de acerto
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {formatDateBR(s.date)}
                          </p>
                        </div>
                        <span className="text-lg font-bold tabular-nums text-accent-green">
                          − {formatBRL(s.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Botão fechar ─────────────────────────────────────────────────── */}
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-zinc-800 border border-zinc-700
                       text-sm font-semibold text-zinc-400
                       hover:bg-zinc-700/80 hover:border-zinc-600 hover:text-zinc-200
                       active:scale-[0.98] transition-all duration-150"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  );
};

// ── Sub-componentes ────────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
    <span>{icon}</span>
    <span>{label}</span>
  </p>
);

const CalcRow: React.FC<{
  label: string;
  value: string;
  valueClass: string;
  sign: string;
  tooltip?: string;
}> = ({ label, value, valueClass, sign, tooltip }) => (
  <div className="flex justify-between items-center">
    <div className="flex items-center gap-1.5">
      {sign && (
        <span className={`text-sm font-bold w-4 text-center ${valueClass}`}>{sign}</span>
      )}
      {!sign && <span className="w-4" />}
      <span className="text-sm text-zinc-400">{label}</span>
      {tooltip && (
        <span
          className="text-xs text-zinc-600 cursor-help"
          title={tooltip}
        >
          ⓘ
        </span>
      )}
    </div>
    <span className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</span>
  </div>
);
