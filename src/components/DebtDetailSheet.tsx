import React, { useEffect, useCallback, useState, useRef } from "react";
import { createPortal } from "react-dom";
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

  // ── Gesto de deslizar (swipe/pull down to dismiss) ──────────────────────────
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
    const diff = touchCurrentY.current - touchStartY.current;
    if (diff > 0) {
      // Puxando para baixo: arrasta a folha
      setDragY(diff);
    } else {
      // Puxando para cima: resistência sutil
      setDragY(diff * 0.15);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const diff = touchCurrentY.current - touchStartY.current;
    if (diff > 90) {
      onClose();
    }
    setDragY(0);
  };

  // ── Scroll lock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setDragY(0);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ── Fechar com Escape ────────────────────────────────────────────────────────
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleEscape]);

  if (!debt || !isOpen) return null;

  // ── Dados derivados ──────────────────────────────────────────────────────────
  const isDebtor = debt.debtorId === currentUserId;
  const otherMember = members.find(
    (m) => m.userId === (isDebtor ? debt.creditorId : debt.debtorId)
  );
  const otherName = otherMember?.name.split(" ")[0] ?? "Membro";
  const otherNameFull = otherMember?.name ?? "Membro";

  const totalSettled = debt.settlements.reduce((acc, s) => acc + s.amount, 0);
  const nettingAmount = Math.max(0, debt.rawAmount - totalSettled - debt.amount);
  const hasNetting = nettingAmount > 1; // ignora diferença de 1 centavo
  const hasSettlements = debt.settlements.length > 0;
  const hasReduction = hasSettlements || hasNetting;

  // Progresso: quanto do bruto já foi abatido
  const progressPct =
    debt.rawAmount > 0
      ? Math.min(100, Math.round(((debt.rawAmount - debt.amount) / debt.rawAmount) * 100))
      : 0;

  // Cores por direção da dívida
  const pink = isDebtor;
  const colorHex = pink ? "#E879A0" : "#7B8FFF";

  const headerLabel = isDebtor
    ? `Você deve a ${otherName}`
    : `${otherName} te deve`;

  const sheetContent = (
    <>
      {/* Backdrop (z-[9990] garante cobertura total sobre a barra de navegação inferior) */}
      <div
        className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet (z-[9999] fica estritamente acima de tudo) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes da dívida com ${otherNameFull}`}
        className="fixed bottom-0 left-0 right-0 z-[9999] max-h-[92dvh] sm:max-h-[90vh] flex flex-col
                   w-full max-w-lg mx-auto bg-zinc-900 rounded-t-[28px] sm:rounded-t-[32px]
                   shadow-[0_-10px_40px_rgba(0,0,0,0.85)] border-t border-white/10 animate-slide-up select-none"
        style={{
          transform: `translateY(${Math.max(0, dragY)}px)`,
          transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}
      >
        {/* Drag Handle & Header interativo para puxar para baixo */}
        <div
          className="relative flex flex-col items-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Pílula de puxar */}
          <div className="w-12 h-1.5 rounded-full bg-zinc-600 hover:bg-zinc-500 transition-colors" />
          <span className="text-[10px] text-zinc-500 mt-1 font-medium tracking-wide">
            Deslize para baixo para fechar
          </span>

          {/* Botão de Fechar rápido (✕) */}
          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="absolute top-2.5 right-4 w-8 h-8 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center text-sm font-semibold transition-all active:scale-90"
          >
            ✕
          </button>
        </div>

        {/* ── HEADER COM VALOR E RESUMO ───────────────────────────────────────── */}
        <div className="px-4 sm:px-5 pb-2.5 sm:pb-3 flex-shrink-0">
          <div
            className="rounded-2xl p-3.5 sm:p-4 border relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${colorHex}1A 0%, ${colorHex}08 100%)`,
              borderColor: `${colorHex}35`,
            }}
          >
            {/* Tag de identificação */}
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                style={{
                  color: colorHex,
                  background: `${colorHex}18`,
                  border: `1px solid ${colorHex}30`,
                }}
              >
                {isDebtor ? "💸 Você deve" : "💰 Te devem"}
              </span>

              {hasReduction && (
                <span className="text-xs text-zinc-400 font-medium">
                  {progressPct}% já abatido
                </span>
              )}
            </div>

            {/* Nome + Valor Final */}
            <div className="flex items-end justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-base sm:text-lg font-bold text-zinc-100 leading-tight truncate">
                  {headerLabel}
                </p>
                {hasReduction && (
                  <p className="text-xs text-zinc-400 mt-1">
                    Total bruto original: <span className="line-through text-zinc-500">{formatBRL(debt.rawAmount)}</span>
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p
                  className="text-2xl sm:text-3xl font-extrabold tabular-nums tracking-tight"
                  style={{ color: colorHex }}
                >
                  {formatBRL(debt.amount)}
                </p>
              </div>
            </div>

            {/* Barra de progresso visual */}
            {hasReduction && debt.rawAmount > 0 && (
              <div className="mt-3 pt-2.5 border-t border-white/5">
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1.5">
                  <span>Economia de {formatBRL(debt.rawAmount - debt.amount)}</span>
                  <span>Resta {formatBRL(debt.amount)}</span>
                </div>
                <div className="h-2 bg-zinc-800/90 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progressPct}%`,
                      background: `linear-gradient(90deg, ${colorHex}90, ${colorHex})`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CORPO ROLÁVEL COM AS DESPESAS E ABATIMENTOS ───────────────────────── */}
        <div className="overflow-y-auto overscroll-contain flex-1 px-4 sm:px-5 pb-6 space-y-4 sm:space-y-5 scrollbar-hide">

          {/* ── 1. Despesas que geraram a dívida ──────────────────────────────── */}
          <section className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-2.5">
              <SectionTitle icon="📦" label="Despesas que geraram esta dívida" />
              <span className="text-xs font-semibold text-zinc-400">
                {debt.sources.length} {debt.sources.length === 1 ? "compra" : "compras"}
              </span>
            </div>

            <div className="space-y-2">
              {debt.sources.length === 0 ? (
                <p className="text-xs text-zinc-500 italic px-1">
                  Nenhuma despesa direta registrada.
                </p>
              ) : (
                debt.sources.map((src, i) => (
                  <div
                    key={`${src.expenseId}-${i}`}
                    className="bg-zinc-800/70 rounded-2xl border border-zinc-700/50 hover:border-zinc-600/80 transition-all overflow-hidden"
                  >
                    <div className="flex items-stretch">
                      <div
                        className="w-1.5 flex-shrink-0 rounded-l-2xl"
                        style={{ background: colorHex }}
                      />
                      <div className="flex justify-between items-start gap-3 p-3.5 flex-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-zinc-100 truncate">
                            {src.description}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {formatDateBR(src.date)} · Total {formatBRL(src.totalAmount)}
                          </p>
                          <p className="text-xs mt-1">
                            <span className="text-zinc-500">Pago por </span>
                            <span className="text-zinc-300 font-semibold">{src.paidByName}</span>
                            <span className="text-zinc-500"> ({src.splitCount} pessoas)</span>
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] text-zinc-500 font-medium mb-0.5">sua cota</p>
                          <p
                            className="text-base font-bold tabular-nums"
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

          {/* ── 2. De onde veio o abatimento (Compensação mútua) ─────────────────── */}
          {hasNetting && (
            <section className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-2">
                <SectionTitle icon="🔄" label="De onde veio o abatimento (Compensação mútua)" />
                <span className="text-xs font-bold text-accent-blue bg-accent-blue/15 px-2.5 py-0.5 rounded-full tabular-nums">
                  − {formatBRL(nettingAmount)}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                Despesas pagas no sentido contrário que geraram crédito e foram <strong className="text-accent-blue">abatidas automaticamente</strong> para zerar a troca de Pix:
              </p>

              <div className="space-y-2">
                {(!debt.nettingSources || debt.nettingSources.length === 0) ? (
                  <div className="bg-zinc-800/40 rounded-2xl p-3.5 border border-accent-blue/20 text-center">
                    <p className="text-xs text-zinc-400">
                      Compensação consolidada de gastos compartilhados do período ({formatBRL(nettingAmount)}).
                    </p>
                  </div>
                ) : (
                  debt.nettingSources.map((src, i) => (
                    <div
                      key={`netting-${src.expenseId}-${i}`}
                      className="bg-zinc-800/70 rounded-2xl border border-accent-blue/30 overflow-hidden shadow-sm"
                    >
                      <div className="flex items-stretch">
                        <div className="w-1.5 flex-shrink-0 bg-accent-blue rounded-l-2xl" />
                        <div className="flex justify-between items-start gap-3 p-3.5 flex-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs">🔄</span>
                              <p className="text-sm font-bold text-zinc-100 truncate">
                                {src.description}
                              </p>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              {formatDateBR(src.date)} · Total {formatBRL(src.totalAmount)}
                            </p>
                            <p className="text-xs mt-1">
                              <span className="text-zinc-500">Pago por </span>
                              <span className="text-accent-blue font-semibold">{src.paidByName}</span>
                              <span className="text-zinc-500"> ({src.splitCount} pessoas)</span>
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[11px] text-accent-blue/80 uppercase font-medium mb-0.5">abatido</p>
                            <p className="text-base font-bold tabular-nums text-accent-blue">
                              − {formatBRL(src.yourShare)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* ── 3. Acertos Pix já realizados ────────────────────────────────────── */}
          {hasSettlements && (
            <section className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-2">
                <SectionTitle icon="💸" label="Acertos Pix já realizados" />
                <span className="text-xs font-bold text-accent-green bg-accent-green/15 px-2.5 py-0.5 rounded-full tabular-nums">
                  − {formatBRL(totalSettled)}
                </span>
              </div>
              <div className="space-y-2">
                {debt.settlements.map((s, i) => (
                  <div
                    key={`${s.settlementId}-${i}`}
                    className="bg-zinc-800/70 rounded-2xl border border-accent-green/30 overflow-hidden"
                  >
                    <div className="flex items-stretch">
                      <div className="w-1.5 flex-shrink-0 rounded-l-2xl bg-accent-green" />
                      <div className="flex justify-between items-center gap-3 p-3.5 flex-1">
                        <div>
                          <p className="text-sm font-semibold text-accent-green">
                            Pix de acerto transferido
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {formatDateBR(s.date)}
                          </p>
                        </div>
                        <span className="text-base font-bold tabular-nums text-accent-green">
                          − {formatBRL(s.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── 4. Como chegamos neste valor (Demonstrativo) ───────────────────── */}
          {hasReduction && (
            <section className="animate-fade-in-up">
              <SectionTitle icon="🧮" label="Demonstrativo do cálculo" />
              <div className="bg-zinc-800/60 rounded-2xl border border-zinc-700/60 p-4 space-y-2.5">
                {/* Bruto */}
                <CalcRow
                  label="Despesas registradas"
                  value={formatBRL(debt.rawAmount)}
                  valueClass="text-zinc-200"
                  sign=""
                />

                {/* Netting */}
                {hasNetting && (
                  <CalcRow
                    label="Compensação mútua"
                    value={formatBRL(nettingAmount)}
                    valueClass="text-accent-blue font-bold"
                    sign="−"
                    tooltip="Despesas pagas no sentido inverso foram abatidas automaticamente."
                  />
                )}

                {/* Acertos Pix */}
                {hasSettlements && (
                  <CalcRow
                    label={`Pix já transferidos (${debt.settlements.length}x)`}
                    value={formatBRL(totalSettled)}
                    valueClass="text-accent-green font-bold"
                    sign="−"
                  />
                )}

                {/* Divisor & Total Final */}
                <div className="border-t border-zinc-700/80 pt-3 mt-1.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm font-bold text-zinc-100">
                        Valor final líquido
                      </span>
                      <p className="text-[11px] text-zinc-500">
                        Total que deve ser pago via Pix
                      </p>
                    </div>
                    <span
                      className="text-2xl font-extrabold tabular-nums"
                      style={{ color: colorHex }}
                    >
                      {formatBRL(debt.amount)}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Botão Fechar no rodapé ───────────────────────────────────────── */}
          <div className="pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom,16px))]">
            <button
              onClick={onClose}
              className="w-full py-3.5 sm:py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700/90
                         border border-zinc-700 text-sm font-bold text-zinc-200
                         active:scale-[0.98] transition-all duration-150 shadow-lg"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(sheetContent, document.body);
};

// ── Sub-componentes ────────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
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
  <div className="flex justify-between items-center text-xs">
    <div className="flex items-center gap-1.5">
      {sign && (
        <span className={`text-sm font-bold w-3.5 text-center ${valueClass}`}>{sign}</span>
      )}
      {!sign && <span className="w-3.5" />}
      <span className="text-zinc-400 font-medium">{label}</span>
      {tooltip && (
        <span
          className="text-[11px] text-zinc-500 cursor-help"
          title={tooltip}
        >
          ⓘ
        </span>
      )}
    </div>
    <span className={`text-sm tabular-nums ${valueClass}`}>{value}</span>
  </div>
);
