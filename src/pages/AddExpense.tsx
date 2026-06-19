import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTransactions } from "../hooks/useTransactions";
import type {
  TransactionFormData,
  Transaction,
  ExpenseFormData,
  SettlementFormData,
} from "../types";
import { parseToCents, getMonthKey } from "../lib/calculations";
import { getTodayDateString, getCurrentMonthKey, formatBRL } from "../lib/formatters";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useGroupContext } from "../contexts/GroupContext";
import { useAuthContext } from "../contexts/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInitialExpense(defaultPayerUid: string, memberIds: string[]): ExpenseFormData {
  return {
    type: "expense",
    description: "",
    amount: "",
    paidByUserId: defaultPayerUid,
    splitBetweenUserIds: memberIds,
    splitMode: "equal",
    personalOwnerUserId: null,
    date: getTodayDateString(),
    isInstallment: false,
    installmentCount: 2,
  };
}

function makeInitialSettlement(
  defaultFromUid: string,
  defaultToUid: string
): SettlementFormData {
  return {
    type: "settlement",
    description: "Pix de acerto",
    amount: "",
    fromUserId: defaultFromUid,
    toUserId: defaultToUid,
    isPersonalInvoice: false,
    personalOwnerUserId: null,
    date: getTodayDateString(),
  };
}

function isPersonalSplitForm(form: TransactionFormData): boolean {
  if (form.type === "expense") return form.splitMode === "personal";
  return form.isPersonalInvoice;
}

// ─── Componente ───────────────────────────────────────────────────────────────

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
  const { user } = useAuthContext();

  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);

  // UID do usuário logado como pagador padrão
  const defaultPayerUid = user?.uid ?? (members[0]?.userId ?? "");
  // UID do outro membro como destinatário padrão
  const defaultRecipientUid = members.find((m) => m.userId !== defaultPayerUid)?.userId
    ?? members[0]?.userId
    ?? "";

  // ─── Inicialização do form (edição ou criação) ───────────────────────────
  const [form, setForm] = useState<TransactionFormData>(() => {
    if (editTransaction) {
      const displayAmount =
        editTransaction.type === "expense" && editTransaction.originalAmount
          ? editTransaction.originalAmount
          : editTransaction.amount;
      const isInstallment =
        editTransaction.type === "expense" &&
        (editTransaction.installmentCount ?? 0) > 1;

      if (editTransaction.type === "expense") {
        return {
          type: "expense",
          description: editTransaction.description,
          amount: (displayAmount / 100).toFixed(2).replace(".", ","),
          date: editTransaction.date,
          paidByUserId: editTransaction.paidByUserId ?? defaultPayerUid,
          splitBetweenUserIds: editTransaction.splitBetweenUserIds ?? memberIds,
          splitMode: editTransaction.splitMode ?? "equal",
          personalOwnerUserId: editTransaction.personalOwnerUserId ?? null,
          isInstallment,
          installmentCount: isInstallment ? (editTransaction.installmentCount ?? 2) : 2,
        } satisfies ExpenseFormData;
      } else {
        return {
          type: "settlement",
          description: editTransaction.description,
          amount: (displayAmount / 100).toFixed(2).replace(".", ","),
          date: editTransaction.date,
          fromUserId: editTransaction.fromUserId ?? defaultPayerUid,
          toUserId: editTransaction.toUserId ?? defaultRecipientUid,
          isPersonalInvoice: editTransaction.visibility === "personal",
          personalOwnerUserId: editTransaction.personalOwnerUserId ?? null,
        } satisfies SettlementFormData;
      }
    }
    return makeInitialExpense(defaultPayerUid, memberIds);
  });

  const [errors, setErrors] = useState<
    Partial<Record<keyof TransactionFormData | "personalOwnerUserId", string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset ao navegar para uma nova criação
  useEffect(() => {
    if (!isEditing) {
      setForm(makeInitialExpense(defaultPayerUid, memberIds));
      setErrors({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Auto-limpa personalOwnerUserId quando splitMode volta para "equal"
  useEffect(() => {
    if (form.type !== "expense") return;
    if (form.splitMode === "equal") {
      setForm((f) => f.type === "expense" ? { ...f, personalOwnerUserId: null } : f);
    }
  }, [form.type === "expense" ? form.splitMode : undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Validação ────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Partial<
      Record<keyof TransactionFormData | "personalOwnerUserId", string>
    > = {};

    if (!form.description.trim()) {
      newErrors.description = "Descreva o lançamento";
    }

    if (!parseToCents(form.amount)) {
      newErrors.amount = "Informe um valor válido maior que zero";
    }

    if (!form.date) {
      newErrors.date = "Informe a data";
    }

    if (
      form.type === "settlement" &&
      form.fromUserId === form.toUserId
    ) {
      newErrors.type = "Remetente e destinatário não podem ser iguais";
    }

    if (isPersonalSplitForm(form) && !form.personalOwnerUserId) {
      newErrors.personalOwnerUserId =
        "Selecione a quem pertence este gasto pessoal";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const cents = parseToCents(form.amount)!;
    setSaving(true);

    try {
      let submitData = { ...form };

      // Parcelado → sempre pessoal de quem pagou
      if (
        submitData.type === "expense" &&
        submitData.isInstallment
      ) {
        submitData = {
          ...submitData,
          splitMode: "personal",
          personalOwnerUserId:
            submitData.personalOwnerUserId ?? submitData.paidByUserId,
        };
      }

      if (isEditing && editTransaction) {
        await updateTransaction(editTransaction, submitData, cents);
      } else {
        await addTransaction(submitData, cents);
      }

      setShowSuccess(true);

      if (!isEditing) {
        setForm(
          form.type === "expense"
            ? makeInitialExpense(defaultPayerUid, memberIds)
            : makeInitialSettlement(defaultPayerUid, defaultRecipientUid)
        );
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

  // ─── Handler de valor monetário ───────────────────────────────────────────
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
  const showOwnerPicker = isPersonalSplitForm(form);

  // ─── Render ───────────────────────────────────────────────────────────────
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
            {isEditing
              ? "Editar registro"
              : isExpense
              ? "Registrar compra"
              : "Registrar Pix"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-5 flex flex-col gap-5" noValidate>

        {/* Toggle Tipo (Apenas criação) */}
        {!isEditing && (
          <div className="relative flex bg-bg-elevated p-1 rounded-xl">
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
              onClick={() =>
                setForm(makeInitialExpense(defaultPayerUid, memberIds))
              }
            >
              🛒 Despesa
            </button>
            <button
              type="button"
              className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-300 ${
                !isExpense ? "text-white" : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() =>
                setForm(makeInitialSettlement(defaultPayerUid, defaultRecipientUid))
              }
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

        {/* Parcelamento — só para despesas */}
        {isExpense && (
          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between bg-bg-elevated p-4 rounded-xl border border-border cursor-pointer">
              <span className="text-sm font-medium text-text-primary">
                Compra Parcelada?
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.type === "expense" ? (form.isInstallment ?? false) : false}
                onClick={() =>
                  setForm((f) =>
                    f.type === "expense"
                      ? { ...f, isInstallment: !f.isInstallment }
                      : f
                  )
                }
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                  form.type === "expense" && form.isInstallment
                    ? "bg-accent-pink"
                    : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    form.type === "expense" && form.isInstallment
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </label>

            {form.type === "expense" && form.isInstallment && (
              <div className="animate-fade-in-up flex flex-col gap-3 bg-bg-elevated p-4 rounded-xl border border-border">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="installment-count"
                    className="text-sm font-medium text-text-secondary"
                  >
                    Número de Parcelas
                  </label>
                  <select
                    id="installment-count"
                    className="w-full bg-bg-card border border-border rounded-lg p-3 text-text-primary focus:outline-none focus:border-accent-pink transition-colors"
                    value={form.installmentCount ?? 2}
                    onChange={(e) =>
                      setForm((f) =>
                        f.type === "expense"
                          ? { ...f, installmentCount: Number(e.target.value) }
                          : f
                      )
                    }
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 2).map((num) => (
                      <option key={num} value={num}>
                        {num}x
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preview de parcela */}
                {form.amount && parseToCents(form.amount) ? (
                  <div className="p-3 rounded-lg bg-accent-pink/10 border border-accent-pink/20">
                    {(() => {
                      const totalCents = parseToCents(form.amount) ?? 0;
                      const count = (form.type === "expense" && form.installmentCount) ?? 2;
                      const baseAmount = Math.floor(totalCents / count);
                      const remainder = totalCents % count;
                      if (remainder > 0) {
                        return (
                          <p className="text-xs text-accent-pink text-center font-medium">
                            A 1ª parcela será de {formatBRL(baseAmount + remainder)} e as
                            demais {formatBRL(baseAmount)}.
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

        {/* ── CAMPOS DE DESPESA ─────────────────────────────────────────────── */}
        {form.type === "expense" && (
          <>
            {/* Quem pagou — chips dinâmicos por UID */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-secondary">
                Quem passou o cartão?
              </p>
              <div className="flex gap-2 flex-wrap">
                {members.map((m) => {
                  const isSelected = form.paidByUserId === m.userId;
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() =>
                        setForm((f) =>
                          f.type === "expense"
                            ? { ...f, paidByUserId: m.userId }
                            : f
                        )
                      }
                      className={`chip ${isSelected ? "chip-selected-blue" : ""}`}
                    >
                      👤 {m.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Como dividir — SplitMode */}
            {!form.isInstallment && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-text-secondary">
                  Como dividir?
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) =>
                        f.type === "expense"
                          ? {
                              ...f,
                              splitMode: "equal",
                              splitBetweenUserIds: memberIds,
                              personalOwnerUserId: null,
                            }
                          : f
                      )
                    }
                    className={`chip text-xs active:scale-95 transition-all ${
                      form.splitMode === "equal" ? "chip-selected-green" : ""
                    }`}
                  >
                    ⚖️ Meio a Meio
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) =>
                        f.type === "expense"
                          ? {
                              ...f,
                              splitMode: "personal",
                              personalOwnerUserId: f.paidByUserId,
                            }
                          : f
                      )
                    }
                    className={`chip text-xs active:scale-95 transition-all ${
                      form.splitMode === "personal" ? "chip-selected-pink" : ""
                    }`}
                  >
                    💳 Só de um
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CAMPOS DE PIX/ACERTO ─────────────────────────────────────────── */}
        {form.type === "settlement" && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-secondary">
                Quem enviou o Pix?
              </p>
              <div className="flex gap-2 flex-wrap">
                {members.map((m) => {
                  const isSelected = form.fromUserId === m.userId;
                  const isOther = form.toUserId === m.userId;
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => {
                        const otherUid =
                          members.find((x) => x.userId !== m.userId)?.userId ?? "";
                        setForm((f) =>
                          f.type === "settlement"
                            ? { ...f, fromUserId: m.userId, toUserId: otherUid }
                            : f
                        );
                      }}
                      className={`chip ${
                        isSelected
                          ? "chip-selected-blue"
                          : isOther
                          ? "chip-selected-pink"
                          : ""
                      }`}
                    >
                      👤 {m.name}
                    </button>
                  );
                })}
              </div>
              {form.type === "settlement" && (
                <p className="text-xs text-text-muted">
                  Destino:{" "}
                  {members.find((m) => m.userId === form.toUserId)?.name ??
                    "—"}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-secondary">
                Destino do Acerto:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) =>
                      f.type === "settlement"
                        ? {
                            ...f,
                            isPersonalInvoice: false,
                            personalOwnerUserId: null,
                          }
                        : f
                    )
                  }
                  className={`chip ${
                    form.type === "settlement" && !form.isPersonalInvoice
                      ? "chip-selected-green"
                      : ""
                  }`}
                >
                  🛒 Gastos do dia a dia
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) =>
                      f.type === "settlement"
                        ? {
                            ...f,
                            isPersonalInvoice: true,
                            personalOwnerUserId: f.toUserId,
                          }
                        : f
                    )
                  }
                  className={`chip ${
                    form.type === "settlement" && form.isPersonalInvoice
                      ? "chip-selected-purple"
                      : ""
                  }`}
                >
                  💳 Abater Fatura
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── SELETOR DE DONO (gasto pessoal) ──────────────────────────────── */}
        {showOwnerPicker && (
          <div className="animate-fade-in-up flex flex-col gap-2 bg-bg-elevated border border-border rounded-xl p-4">
            <p className="text-sm font-semibold text-text-primary">
              A quem pertence este gasto pessoal?
            </p>
            <p className="text-xs text-text-muted mb-1">
              Vai aparecer só na fatura do membro selecionado.
            </p>
            <div className="flex gap-2 flex-wrap">
              {members.map((m) => {
                const isSelected = form.personalOwnerUserId === m.userId;
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, personalOwnerUserId: m.userId }))
                    }
                    className={`chip active:scale-95 transition-all ${
                      isSelected ? "chip-selected-pink" : ""
                    }`}
                  >
                    👤 {m.name}
                  </button>
                );
              })}
            </div>
            {errors.personalOwnerUserId && (
              <p className="text-accent-red text-xs mt-1">
                {errors.personalOwnerUserId}
              </p>
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
