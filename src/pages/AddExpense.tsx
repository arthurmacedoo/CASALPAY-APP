import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTransactions } from "../hooks/useTransactions";
import type {
  TransactionFormData,
  SplitType,
  Transaction,
  ExpenseFormData,
  SettlementFormData,
} from "../types";
import { parseToCents, getMonthKey } from "../lib/calculations";
import { getTodayDateString, getCurrentMonthKey, formatBRL } from "../lib/formatters";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useGroupContext } from "../contexts/GroupContext";

const initialExpenseData: ExpenseFormData = {
  type: "expense",
  description: "",
  amount: "",
  paidBy: "owner",
  splitType: "50/50",
  date: getTodayDateString(),
  isInstallment: false,
  installmentCount: 2,
  personalOwnerUserId: null,
};

const initialSettlementData: SettlementFormData = {
  type: "settlement",
  description: "Pix de acerto",
  amount: "",
  from: "partner",
  to: "owner",
  date: getTodayDateString(),
  pixDestination: "shared",
  personalOwnerUserId: null,
};

/** Retorna true quando a divisão exige um dono pessoal explícito */
function isPersonalSplit(form: TransactionFormData): boolean {
  if (form.type === "expense") {
    return form.splitType === "100% owner" || form.splitType === "100% partner";
  }
  return form.pixDestination === "zara_card";
}

export const AddExpensePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editTransaction = location.state?.transaction as Transaction | undefined;
  const isEditing = Boolean(editTransaction);

  const monthKey = editTransaction
    ? getMonthKey(editTransaction.date)
    : getCurrentMonthKey();

  const { addTransaction, updateTransaction } = useTransactions(monthKey);
  const { members } = useGroupContext();

  const member1 = members[0];
  const member2 = members[1];

  const [form, setForm] = useState<TransactionFormData>(
    editTransaction
      ? (() => {
          const displayAmount = editTransaction.type === "expense" && editTransaction.originalAmount
            ? editTransaction.originalAmount
            : editTransaction.amount;
          const isInstallment = editTransaction.type === "expense" && (editTransaction.installmentCount ?? 0) > 1;
          return {
            ...editTransaction,
            amount: (displayAmount / 100).toFixed(2).replace(".", ","),
            isInstallment,
            installmentCount: isInstallment ? (editTransaction.installmentCount ?? 2) : 2,
            personalOwnerUserId: editTransaction.personalOwnerUserId ?? null,
          } as TransactionFormData;
        })()
      : initialExpenseData
  );

  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormData | "personalOwnerUserId", string>>>({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setForm({ ...initialExpenseData, date: getTodayDateString() });
      setErrors({});
    }
  }, [location.key, isEditing]);

  // Auto-seleciona o dono quando a divisão muda para pessoal
  useEffect(() => {
    if (form.type !== "expense") return;
    if (form.splitType === "100% owner") {
      setForm(f => ({ ...f, personalOwnerUserId: member1?.userId ?? null }));
    } else if (form.splitType === "100% partner") {
      setForm(f => ({ ...f, personalOwnerUserId: member2?.userId ?? null }));
    } else {
      setForm(f => ({ ...f, personalOwnerUserId: null }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type === "expense" ? form.splitType : undefined, member1?.userId, member2?.userId]);

  // Auto-seleciona Zara quando pixDestination é zara_card
  useEffect(() => {
    if (form.type !== "settlement") return;
    if (form.pixDestination === "zara_card") {
      setForm(f => ({ ...f, personalOwnerUserId: member2?.userId ?? null }));
    } else {
      setForm(f => ({ ...f, personalOwnerUserId: null }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type === "settlement" ? form.pixDestination : undefined, member2?.userId]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof TransactionFormData | "personalOwnerUserId", string>> = {};

    if (!form.description.trim()) {
      newErrors.description = "Descreva o lançamento";
    }

    const cents = parseToCents(form.amount);
    if (!cents) {
      newErrors.amount = "Informe um valor válido maior que zero";
    }

    if (!form.date) {
      newErrors.date = "Informe a data";
    }

    if (form.type === "settlement" && form.from === form.to) {
      newErrors.type = "Remetente e destinatário não podem ser iguais";
    }

    // Bloqueio: gasto pessoal sem dono definido
    if (isPersonalSplit(form) && !form.personalOwnerUserId) {
      newErrors.personalOwnerUserId = "Selecione a quem pertence este gasto pessoal";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const cents = parseToCents(form.amount)!;
    setSaving(true);

    try {
    let submitData = { ...form };

      // Regra de negócio: parcelado sempre é 100% de quem pagou
      if (submitData.type === "expense" && submitData.isInstallment) {
        submitData.splitType = submitData.paidBy === "owner" ? "100% owner" : "100% partner";
        // Infere dono para parcelas se a UI não forneceu
        if (!submitData.personalOwnerUserId) {
          submitData.personalOwnerUserId = submitData.paidBy === "owner"
            ? member1?.userId ?? null
            : member2?.userId ?? null;
        }
      }

      if (isEditing && editTransaction) {
        // A inteligência de apagar+recriar parcelas vive no hook
        await updateTransaction(editTransaction, submitData, cents);
      } else {
        await addTransaction(submitData, cents);
      }

      setShowSuccess(true);

      if (!isEditing) {
        setForm(form.type === "expense" 
          ? { ...initialExpenseData, date: form.date } 
          : { ...initialSettlementData, date: form.date });
        setErrors({});
      }

      setTimeout(() => {
        setShowSuccess(false);
        if (isEditing) navigate(-1);
      }, 1200);
    } catch (err) {
      console.error("Erro ao salvar:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      setForm((f) => ({ ...f, amount: "" }));
      return;
    }
    const numericValue = parseInt(digits, 10);
    const stringValue = numericValue.toString().padStart(3, "0");
    const integerPart = stringValue.slice(0, -2);
    const decimalPart = stringValue.slice(-2);
    setForm((f) => ({ ...f, amount: `${integerPart},${decimalPart}` }));
  };

  const isExpense = form.type === "expense";
  const showOwnerPicker = isPersonalSplit(form);

  return (
    <main className="flex-1 overflow-y-auto pb-28">
      {/* Toast de sucesso */}
      {showSuccess && (
        <div className="toast fixed top-0 left-0 right-0 z-50 bg-accent-green text-white text-center py-4 font-semibold text-sm shadow-lg">
          {isEditing ? "✓ Lançamento atualizado!" : "✓ Lançamento salvo!"}
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-14 pb-6 flex items-center gap-3">
        {isEditing && (
          <button
            onClick={() => navigate(-1)}
            className="text-text-muted hover:text-text-primary transition-colors p-1 text-xl"
          >
            ←
          </button>
        )}
        <div>
          <p className="text-text-muted text-sm font-medium">
            {isEditing ? "Editando" : "Novo"} lançamento
          </p>
          <h1 className="text-2xl font-bold text-text-primary mt-0.5">
            {isEditing ? "Editar registro" : (isExpense ? "Registrar compra" : "Registrar Pix")}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-5 flex flex-col gap-5" noValidate>
        
        {/* Toggle Tipo (Apenas criação) */}
        {!isEditing && (
          <div className="relative flex bg-bg-elevated p-1 rounded-xl">
            {/* Sliding Pill Indicator */}
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-lg transition-all duration-300 ease-in-out shadow-md ${
                isExpense ? "translate-x-0 bg-accent-pink" : "translate-x-full bg-violet-500"
              }`}
            />
            
            <button
              type="button"
              className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-300 ${
                isExpense ? "text-white" : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setForm({ ...initialExpenseData, date: form.date })}
            >
              🛒 Despesa
            </button>
            <button
              type="button"
              className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-300 ${
                !isExpense ? "text-white" : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setForm({ ...initialSettlementData, date: form.date })}
            >
              💸 Pix / Acerto
            </button>
          </div>
        )}

        {errors.type && <p className="text-accent-red text-sm">{errors.type}</p>}

        {/* Descrição */}
        <Input
          id="input-description"
          label={isExpense ? "O que foi comprado?" : "Descrição (opcional)"}
          placeholder={isExpense ? "Ex: Mercado, Uber..." : "Pix de acerto"}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          error={errors.description}
          autoComplete="off"
          autoCapitalize="words"
        />

        {/* Valor */}
        <Input
          id="input-amount"
          label="Valor total (R$)"
          placeholder="0,00"
          value={form.amount}
          inputMode="numeric"
          onChange={handleAmountChange}
          error={errors.amount}
        />

        {/* Toggle Parcelamento — visível para qualquer despesa (nova ou em edição) */}
        {isExpense && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between bg-bg-elevated p-4 rounded-xl border border-border cursor-pointer">
              <span className="text-sm font-medium text-text-primary">Compra Parcelada?</span>
              <button
                type="button"
                role="switch"
                aria-checked={form.isInstallment || false}
                onClick={() => setForm((f) => f.type === "expense" ? { ...f, isInstallment: !f.isInstallment } : f)}
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                  form.isInstallment ? 'bg-accent-pink' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    form.isInstallment ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            {form.isInstallment && (
              <div className="animate-fade-in-up flex flex-col gap-3 bg-bg-elevated p-4 rounded-xl border border-border">
                <div className="flex flex-col gap-1">
                  <label htmlFor="installment-count" className="text-sm font-medium text-text-secondary">
                    Número de Parcelas
                  </label>
                  <select
                    id="installment-count"
                    className="w-full bg-bg-card border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:border-accent-pink transition-colors"
                    value={form.installmentCount || 2}
                    onChange={(e) => setForm((f) => f.type === "expense" ? { ...f, installmentCount: Number(e.target.value) } : f)}
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 2).map(num => (
                      <option key={num} value={num}>{num}x</option>
                    ))}
                  </select>
                </div>
                
                {/* Preview de Parcela */}
                {form.amount && parseToCents(form.amount) ? (
                  <div className="p-3 rounded-lg bg-accent-pink/10 border border-accent-pink/20">
                    {(() => {
                      const totalCents = parseToCents(form.amount) || 0;
                      const count = form.installmentCount || 2;
                      const baseAmount = Math.floor(totalCents / count);
                      const remainder = totalCents % count;
                      
                      if (remainder > 0) {
                        return (
                          <p className="text-xs text-accent-pink text-center font-medium">
                            A 1ª parcela será de {formatBRL(baseAmount + remainder)} e as demais {formatBRL(baseAmount)}.
                          </p>
                        );
                      }
                      
                      return (
                        <p className="text-xs text-accent-pink text-center font-medium">
                          Serão registradas {count} parcelas de {formatBRL(baseAmount)}.
                        </p>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* CAMPOS ESPECÍFICOS DE DESPESA */}
        {form.type === "expense" && (
          <>
            {/* Quem pagou */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-secondary">
                Quem passou o cartão?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "expense" ? { ...f, paidBy: "owner" } : f)}
                  className={`chip ${form.paidBy === "owner" ? "chip-selected-blue" : ""}`}
                >
                  {member1 ? `👤 ${member1.name}` : "Membro 1"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "expense" ? { ...f, paidBy: "partner" } : f)}
                  className={`chip ${form.paidBy === "partner" ? "chip-selected-pink" : ""}`}
                >
                  {member2 ? `👤 ${member2.name}` : "Membro 2"}
                </button>
              </div>
            </div>

            {/* Como dividir */}
            {!form.isInstallment && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-text-secondary">
                  Como dividir?
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(["50/50", "100% owner", "100% partner"] as SplitType[]).map((type) => {
                    const labels: Record<SplitType, string> = {
                      "50/50": "⚖️ Meio a Meio",
                      "100% owner": `Só ${member1?.name || "Membro 1"}`,
                      "100% partner": `Só ${member2?.name || "Membro 2"}`,
                    };
                    const isSelected = form.splitType === type;
                    const colorClass =
                      type === "50/50"
                        ? "chip-selected-green"
                        : type === "100% owner"
                        ? "chip-selected-blue"
                        : "chip-selected-pink";

                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((f) => f.type === "expense" ? { ...f, splitType: type } : f)}
                        className={`chip text-xs active:scale-95 transition-all ${isSelected ? colorClass : ""}`}
                      >
                        {labels[type]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* CAMPOS ESPECÍFICOS DE PIX/ACERTO */}
        {form.type === "settlement" && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-secondary">
                Quem enviou o Pix?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "settlement" ? { ...f, from: "owner", to: "partner" } : f)}
                  className={`chip ${form.from === "owner" ? "chip-selected-blue" : ""}`}
                >
                  {member1 ? `👤 ${member1.name}` : "Membro 1"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "settlement" ? { ...f, from: "partner", to: "owner" } : f)}
                  className={`chip ${form.from === "partner" ? "chip-selected-pink" : ""}`}
                >
                  {member2 ? `👤 ${member2.name}` : "Membro 2"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-secondary">
                Destino do Acerto:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "settlement" ? { ...f, pixDestination: "shared" } : f)}
                  className={`chip ${(!form.pixDestination || form.pixDestination === "shared") ? "chip-selected-green" : ""}`}
                >
                  🛒 Gastos do dia a dia
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "settlement" ? { ...f, pixDestination: "zara_card" } : f)}
                  className={`chip ${form.pixDestination === "zara_card" ? "chip-selected-purple" : ""}`}
                >
                  💳 Abater Fatura Zara
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── SELETOR DE DONO (aparece quando é um gasto pessoal) ── */}
        {showOwnerPicker && (
          <div className="animate-fade-in-up flex flex-col gap-2 bg-bg-elevated border border-border rounded-xl p-4">
            <p className="text-sm font-semibold text-text-primary">
              A quem pertence este gasto pessoal?
            </p>
            <p className="text-xs text-text-muted mb-1">
              Vai aparecer só na fatura do membro selecionado.
            </p>
            <div className="flex gap-2 flex-wrap">
              {members.map((m, index) => {
                const isFirst = index === 0;
                const chipClass = isFirst ? "chip-selected-blue" : "chip-selected-pink";
                const isSelected = form.personalOwnerUserId === m.userId;
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, personalOwnerUserId: m.userId }))}
                    className={`chip active:scale-95 transition-all ${isSelected ? chipClass : ""}`}
                  >
                    👤 {m.name}
                  </button>
                );
              })}
            </div>
            {errors.personalOwnerUserId && (
              <p className="text-accent-red text-xs mt-1">{errors.personalOwnerUserId}</p>
            )}
          </div>
        )}

        {/* Data */}
        <Input
          id="input-date"
          label="Data"
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          error={errors.date}
        />

        {/* Botão salvar */}
        <div className="pt-2 pb-4">
          <Button
            type="submit"
            id="btn-save-expense"
            fullWidth
            loading={saving}
            className={`text-lg py-5 ${isExpense ? "" : "bg-violet-600 hover:bg-violet-500"}`}
          >
            {saving
              ? "Salvando..."
              : isEditing
              ? "✓ Atualizar"
              : isExpense
              ? "💾 Salvar despesa"
              : "💸 Registrar Pix"}
          </Button>

          {isEditing && (
            <Button
              type="button"
              variant="ghost"
              fullWidth
              onClick={() => navigate(-1)}
              className="mt-3"
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </main>
  );
};
