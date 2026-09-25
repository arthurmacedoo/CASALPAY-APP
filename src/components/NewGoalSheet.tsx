import React, { useState } from "react";
import { createPortal } from "react-dom";
import { parseToCents } from "../lib/calculations";
import { maskCurrencyInput, formatBRLRaw, getCurrentMonthKey, formatDeadline } from "../lib/formatters";

interface NewGoalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    category: string;
    emoji: string;
    targetAmount: number;
    initialAmount?: number;
    deadline?: string;
  }) => Promise<void>;
}

const PRESET_EMOJIS = [
  { emoji: "🛡️", category: "Segurança", label: "Reserva" },
  { emoji: "✈️", category: "Viagem", label: "Viagem" },
  { emoji: "🏠", category: "Moradia", label: "Casa" },
  { emoji: "🚗", category: "Veículo", label: "Carro" },
  { emoji: "💍", category: "Casal", label: "Casamento" },
  { emoji: "🎉", category: "Lazer", label: "Festa" },
  { emoji: "💻", category: "Bens", label: "Tech" },
  { emoji: "📈", category: "Investimento", label: "Futuro" },
];

const getFutureMonth = (addMonths: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + addMonths);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getEndOfTheYear = (): string => {
  const year = new Date().getFullYear();
  return `${year}-12`;
};

export const NewGoalSheet: React.FC<NewGoalSheetProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [selectedEmoji, setSelectedEmoji] = useState("✈️");
  const [selectedCategory, setSelectedCategory] = useState("Viagem");
  const [title, setTitle] = useState("");
  const [targetAmountStr, setTargetAmountStr] = useState("");
  const [initialAmountStr, setInitialAmountStr] = useState("");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (item: typeof PRESET_EMOJIS[0]) => {
    setSelectedEmoji(item.emoji);
    setSelectedCategory(item.category);
    if (!title) {
      setTitle(`${item.label} do Casal`);
    }
  };

  const handleAddPresetTarget = (cents: number) => {
    const current = parseToCents(targetAmountStr) || 0;
    const next = current + cents;
    setTargetAmountStr(formatBRLRaw(next));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetCents = parseToCents(targetAmountStr);
    if (!title.trim()) {
      setError("Por favor, digite um nome para a meta.");
      return;
    }
    if (!targetCents || targetCents <= 0) {
      setError("Por favor, informe um valor alvo válido maior que zero.");
      return;
    }

    const initialCents = initialAmountStr ? parseToCents(initialAmountStr) || 0 : 0;

    setSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        category: selectedCategory,
        emoji: selectedEmoji,
        targetAmount: targetCents,
        initialAmount: initialCents,
        deadline: deadline.trim() || undefined,
      });
      // Limpa e fecha
      setTitle("");
      setTargetAmountStr("");
      setInitialAmountStr("");
      setDeadline("");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao criar a meta.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      style={{ zIndex: 9999 }}
      onClick={onClose}
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in-up"
    >
      <div
        className="w-full sm:max-w-md bg-[#16161F] border border-[#2A2A3E] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{selectedEmoji}</span>
            <h2 className="text-lg font-bold text-text-primary">Nova Meta do Casal</h2>
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Seletor de Emojis / Tipo */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">
              Escolha uma Categoria
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_EMOJIS.map((item) => {
                const isSelected = selectedEmoji === item.emoji;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSelectPreset(item)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-2xl border transition-all active:scale-95 ${
                      isSelected
                        ? "bg-accent-pink/15 border-accent-pink text-white shadow-sm"
                        : "bg-bg-elevated border-border/60 text-text-secondary hover:border-border"
                    }`}
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-[11px] font-medium tracking-tight">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nome da Meta */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
              Nome do Sonho / Meta
            </label>
            <input
              type="text"
              placeholder="ex: Férias em Paris, Reserva 6 Meses..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg-elevated border border-border/80 focus:border-accent-pink rounded-2xl px-4 py-3 text-base text-text-primary outline-none transition-colors"
            />
          </div>

          {/* Valor Alvo */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
              Valor Alvo (R$)
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={targetAmountStr}
              onChange={(e) => setTargetAmountStr(maskCurrencyInput(e.target.value))}
              className="w-full bg-bg-elevated border border-border/80 focus:border-accent-pink rounded-2xl px-4 py-3 text-base font-bold text-text-primary outline-none transition-colors tabular-nums"
            />

            {/* Chips Rápidos de Alvo */}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleAddPresetTarget(100000)} // +R$ 1.000
                className="flex-1 py-1.5 rounded-xl bg-bg-elevated border border-border/60 hover:border-accent-pink/40 text-[11px] font-semibold text-text-secondary active:scale-95 transition-all"
              >
                + R$ 1 mil
              </button>
              <button
                type="button"
                onClick={() => handleAddPresetTarget(500000)} // +R$ 5.000
                className="flex-1 py-1.5 rounded-xl bg-bg-elevated border border-border/60 hover:border-accent-pink/40 text-[11px] font-semibold text-text-secondary active:scale-95 transition-all"
              >
                + R$ 5 mil
              </button>
              <button
                type="button"
                onClick={() => handleAddPresetTarget(1000000)} // +R$ 10.000
                className="flex-1 py-1.5 rounded-xl bg-bg-elevated border border-border/60 hover:border-accent-pink/40 text-[11px] font-semibold text-text-secondary active:scale-95 transition-all"
              >
                + R$ 10 mil
              </button>
            </div>
          </div>

          {/* Valor Inicial Opcional */}
          <div>
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1.5">
              Valor Já Guardado (Opcional)
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={initialAmountStr}
              onChange={(e) => setInitialAmountStr(maskCurrencyInput(e.target.value))}
              className="w-full bg-bg-elevated border border-border/80 focus:border-accent-pink rounded-2xl px-4 py-3 text-base text-text-primary outline-none transition-colors tabular-nums"
            />
          </div>

          {/* Prazo Estimado (Seleção de Mês/Ano) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Prazo Estimado (Mês)
              </label>
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline("")}
                  className="text-[11px] text-accent-pink hover:underline font-semibold"
                >
                  ✕ Sem prazo
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="month"
                min={getCurrentMonthKey()}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10 [color-scheme:dark]"
              />
              <div className="w-full bg-bg-elevated border border-border/80 rounded-2xl px-4 py-3 text-base flex items-center justify-between pointer-events-none">
                <span className={deadline ? "text-text-primary font-semibold" : "text-text-muted"}>
                  {deadline ? `🗓️ ${formatDeadline(deadline)}` : "Toque para selecionar o mês..."}
                </span>
                <span className="text-text-muted text-base">📅</span>
              </div>
            </div>

            {/* Chips Rápidos de Mês */}
            <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setDeadline(getFutureMonth(3))}
                className="shrink-0 px-2.5 py-1 rounded-xl bg-bg-elevated border border-border/60 hover:border-accent-pink/40 text-[11px] font-semibold text-text-secondary active:scale-95 transition-all"
              >
                + 3 meses
              </button>
              <button
                type="button"
                onClick={() => setDeadline(getFutureMonth(6))}
                className="shrink-0 px-2.5 py-1 rounded-xl bg-bg-elevated border border-border/60 hover:border-accent-pink/40 text-[11px] font-semibold text-text-secondary active:scale-95 transition-all"
              >
                + 6 meses
              </button>
              <button
                type="button"
                onClick={() => setDeadline(getEndOfTheYear())}
                className="shrink-0 px-2.5 py-1 rounded-xl bg-bg-elevated border border-border/60 hover:border-accent-pink/40 text-[11px] font-semibold text-text-secondary active:scale-95 transition-all"
              >
                Dez/{new Date().getFullYear()}
              </button>
              <button
                type="button"
                onClick={() => setDeadline(getFutureMonth(12))}
                className="shrink-0 px-2.5 py-1 rounded-xl bg-bg-elevated border border-border/60 hover:border-accent-pink/40 text-[11px] font-semibold text-text-secondary active:scale-95 transition-all"
              >
                + 1 ano
              </button>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl bg-bg-elevated border border-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-accent-pink to-[#A855F7] text-white text-sm font-bold shadow-lg shadow-accent-pink/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {submitting ? <span className="spinner" /> : "Criar Meta 🎯"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
