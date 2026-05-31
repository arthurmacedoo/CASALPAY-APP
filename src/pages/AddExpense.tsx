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
import { getTodayDateString, getCurrentMonthKey } from "../lib/formatters";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { OWNER_NAME, PARTNER_NAME, OWNER_EMOJI, PARTNER_EMOJI } from "../constants/couple";

const initialExpenseData: ExpenseFormData = {
  type: "expense",
  description: "",
  amount: "",
  paidBy: "Arthur",
  splitType: "50/50",
  date: getTodayDateString(),
};

const initialSettlementData: SettlementFormData = {
  type: "settlement",
  description: "Pix de acerto",
  amount: "",
  from: "Zara",
  to: "Arthur",
  date: getTodayDateString(),
};

export const AddExpensePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editTransaction = location.state?.transaction as Transaction | undefined;
  const isEditing = Boolean(editTransaction);

  const monthKey = editTransaction
    ? getMonthKey(editTransaction.date)
    : getCurrentMonthKey();

  const { addTransaction, updateTransaction } = useTransactions(monthKey);

  const [form, setForm] = useState<TransactionFormData>(
    editTransaction
      ? {
          ...editTransaction,
          amount: (editTransaction.amount / 100).toFixed(2).replace(".", ","),
        } as TransactionFormData
      : initialExpenseData
  );

  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormData, string>>>({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setForm({ ...initialExpenseData, date: getTodayDateString() });
      setErrors({});
    }
  }, [location.key, isEditing]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof TransactionFormData, string>> = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const cents = parseToCents(form.amount)!;
    setSaving(true);

    try {
      if (isEditing && editTransaction) {
        await updateTransaction(editTransaction.id, form, cents);
      } else {
        await addTransaction(form, cents);
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

  const isExpense = form.type === "expense";

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
          <div className="flex bg-bg-elevated p-1 rounded-xl">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                isExpense ? "bg-accent-pink text-white shadow" : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setForm({ ...initialExpenseData, date: form.date })}
            >
              🛒 Despesa
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                !isExpense ? "bg-accent-purple text-white shadow" : "text-text-secondary hover:text-text-primary"
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
          inputMode="decimal"
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          error={errors.amount}
          hint="Use vírgula ou ponto como separador decimal"
        />

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
                  onClick={() => setForm((f) => f.type === "expense" ? { ...f, paidBy: OWNER_NAME } : f)}
                  className={`chip ${form.paidBy === OWNER_NAME ? "chip-selected-blue" : ""}`}
                >
                  {OWNER_EMOJI} {OWNER_NAME}
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "expense" ? { ...f, paidBy: PARTNER_NAME } : f)}
                  className={`chip ${form.paidBy === PARTNER_NAME ? "chip-selected-pink" : ""}`}
                >
                  {PARTNER_EMOJI} {PARTNER_NAME}
                </button>
              </div>
            </div>

            {/* Como dividir */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-secondary">
                Como dividir?
              </p>
              <div className="flex gap-2 flex-wrap">
                {(["50/50", "100% Arthur", "100% Zara"] as SplitType[]).map((type) => {
                  const labels: Record<SplitType, string> = {
                    "50/50": "⚖️ Meio a Meio",
                    "100% Arthur": `${OWNER_EMOJI} Só ${OWNER_NAME}`,
                    "100% Zara": `${PARTNER_EMOJI} Só ${PARTNER_NAME}`,
                  };
                  const isSelected = form.splitType === type;
                  const colorClass =
                    type === "50/50"
                      ? "chip-selected-green"
                      : type === "100% Arthur"
                      ? "chip-selected-blue"
                      : "chip-selected-pink";

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((f) => f.type === "expense" ? { ...f, splitType: type } : f)}
                      className={`chip text-xs ${isSelected ? colorClass : ""}`}
                    >
                      {labels[type]}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* CAMPOS ESPECÍFICOS DE PIX/ACERTO */}
        {form.type === "settlement" && (
          <div className="flex flex-col gap-4 bg-bg-elevated p-4 rounded-2xl border border-border">
            <div>
              <p className="text-sm font-medium text-text-secondary mb-2">Quem enviou o Pix?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "settlement" ? { ...f, from: OWNER_NAME, to: PARTNER_NAME } : f)}
                  className={`chip ${form.from === OWNER_NAME ? "chip-selected-blue" : ""}`}
                >
                  {OWNER_EMOJI} {OWNER_NAME}
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "settlement" ? { ...f, from: PARTNER_NAME, to: OWNER_NAME } : f)}
                  className={`chip ${form.from === PARTNER_NAME ? "chip-selected-pink" : ""}`}
                >
                  {PARTNER_EMOJI} {PARTNER_NAME}
                </button>
              </div>
            </div>
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
