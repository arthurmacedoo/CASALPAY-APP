# Arquivos Consolidados - CasalPay (Auditoria Manus)

Abaixo estão os 5 arquivos principais atualizados com a lógica completa do `pixDestination`, prontos para análise.

### 1. `src/pages/AddExpense.tsx`
```tsx
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
import { OWNER_NAME, PARTNER_NAME, OWNER_EMOJI, PARTNER_EMOJI } from "../constants/couple";

const initialExpenseData: ExpenseFormData = {
  type: "expense",
  description: "",
  amount: "",
  paidBy: "Arthur",
  splitType: "50/50",
  date: getTodayDateString(),
  isInstallment: false,
  installmentCount: 2,
};

const initialSettlementData: SettlementFormData = {
  type: "settlement",
  description: "Pix de acerto",
  amount: "",
  from: "Zara",
  to: "Arthur",
  date: getTodayDateString(),
  pixDestination: "shared",
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
    if (form.type === "settlement") {
      setForm((f) => ({ ...f, description: "Pix de acerto" }));
    } else {
      if (form.description === "Pix de acerto") {
        setForm((f) => ({ ...f, description: "" }));
      }
    }
  }, [form.type]);

  const validate = () => {
    const newErrors: Partial<Record<keyof TransactionFormData, string>> = {};

    if (form.type === "expense" && !form.description.trim()) {
      newErrors.description = "A descrição é obrigatória";
    }

    if (!form.amount) {
      newErrors.amount = "O valor é obrigatório";
    } else if (parseToCents(form.amount) === 0) {
      newErrors.amount = "O valor deve ser maior que zero";
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
      let submitData = { ...form };
      if (submitData.type === "expense" && submitData.isInstallment) {
        submitData.splitType = submitData.paidBy === OWNER_NAME ? "100% Arthur" : "100% Zara";
      }

      if (isEditing && editTransaction) {
        await updateTransaction(editTransaction.id, submitData, cents);
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

  return (
    <main className="flex-1 overflow-y-auto pb-28">
      {/* Toast de sucesso */}
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-accent-green text-bg-main px-4 py-2 rounded-full font-medium shadow-lg animate-fade-in-up z-50 flex items-center gap-2">
          <span>✨</span> Salvo com sucesso!
        </div>
      )}

      {/* Título Principal */}
      <div className="px-5 pt-14 pb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {isEditing ? "Editar Registro" : "Novo Registro"}
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {isEditing 
            ? "Atualize os dados da transação" 
            : "Adicione uma nova despesa ou Pix"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 flex flex-col gap-6">
        {/* Toggle Tipo (Despesa vs Pix) */}
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
              onClick={() => {
                setForm((f) => f.type === "settlement" ? { ...initialExpenseData, date: f.date } : f);
                setErrors({});
              }}
            >
              🛒 Despesa
            </button>
            <button
              type="button"
              className={`relative z-10 flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-300 ${
                !isExpense ? "text-white" : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => {
                setForm((f) => f.type === "expense" ? { ...initialSettlementData, date: f.date } : f);
                setErrors({});
              }}
            >
              💸 Pix / Acerto
            </button>
          </div>
        )}

        {/* Valor (Sempre visível) */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Valor
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary font-medium">
              R$
            </span>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={form.amount}
              onChange={handleAmountChange}
              className={`w-full bg-bg-elevated border rounded-2xl pl-12 pr-4 py-4 text-3xl font-bold text-text-primary tabular-nums focus:outline-none focus:ring-2 transition-all ${
                errors.amount 
                  ? "border-red-500/50 focus:ring-red-500/20" 
                  : "border-border focus:border-accent-pink/50 focus:ring-accent-pink/20"
              }`}
            />
          </div>
          {errors.amount && (
            <p className="text-red-400 text-xs mt-1.5 ml-1">{errors.amount}</p>
          )}
        </div>

        {/* Descrição (Apenas Despesa) */}
        {form.type === "expense" && (
          <Input
            id="input-desc"
            label="O que foi comprado?"
            placeholder="Ex: Supermercado, Uber, iFood"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            error={errors.description}
          />
        )}

        {/* Parcelamento (Apenas Despesa) */}
        {form.type === "expense" && !isEditing && (
          <div className="flex flex-col gap-4 bg-bg-elevated p-4 rounded-2xl border border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">
                Compra Parcelada?
              </p>
              
              <button
                type="button"
                onClick={() => setForm((f) => f.type === "expense" ? { ...f, isInstallment: !f.isInstallment } : f)}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  form.isInstallment ? "bg-accent-pink" : "bg-[#2A2B36]"
                }`}
              >
                <div 
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                    form.isInstallment ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            {form.isInstallment && (
              <div className="pt-2 border-t border-border/50 animate-fade-in-up">
                <p className="text-xs text-text-muted mb-3">
                  Aviso: Compras parceladas são obrigatoriamente vinculadas individualmente à pessoa que passou o cartão (100% quem pagou).
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-text-secondary shrink-0">
                    Número de parcelas:
                  </span>
                  <input
                    type="number"
                    min="2"
                    max="48"
                    value={form.installmentCount || 2}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 2 && val <= 48) {
                        setForm((f) => f.type === "expense" ? { ...f, installmentCount: val } : f);
                      }
                    }}
                    className="flex-1 bg-bg-main border border-border rounded-lg px-3 py-2 text-text-primary text-center focus:outline-none focus:border-accent-pink"
                  />
                </div>
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
            {!form.isInstallment && (
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
                  🛒 Dia a Dia
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => f.type === "settlement" ? { ...f, pixDestination: "zara_card" } : f)}
                  className={`chip ${form.pixDestination === "zara_card" ? "chip-selected-purple" : ""}`}
                >
                  💳 Fatura Zara
                </button>
              </div>
            </div>
          </>
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
```

### 2. `src/hooks/useTransactions.ts`
```ts
import { useState, useEffect, useCallback } from "react";
import {
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  doc,
  collection,
} from "firebase/firestore";
import type { Transaction, TransactionFormData } from "../types";
import {
  transactionsRef,
  transactionDocRef,
  COUPLE_ID,
  db,
} from "../lib/firebase";
import { getMonthKey } from "../lib/calculations";

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  addTransaction: (data: TransactionFormData, amountCents: number) => Promise<void>;
  updateTransaction: (id: string, data: TransactionFormData, amountCents: number) => Promise<void>;
  deleteTransaction: (transaction: Transaction) => Promise<void>;
}

export function useTransactions(monthKey: string): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(
      transactionsRef(),
      where("monthKey", "==", monthKey),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: Transaction[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        setTransactions(docs);
        setLoading(false);
      },
      (err: any) => {
        console.error("Erro ao carregar transações:", err);
        if (err.code === "permission-denied") {
          setError(`Usuário autenticado, mas sem permissão no Firestore. (Talvez o doc couples/${COUPLE_ID} não exista ou UID não esteja em members)`);
        } else if (err.code === "unavailable") {
          setError("Firestore indisponível ou sem conexão.");
        } else if (err.code === "failed-precondition" && err.message?.includes("index")) {
          console.warn("Index URL:", err.message);
          setError("O banco de dados precisa finalizar a criação de um índice. Tente novamente em alguns minutos.");
        } else {
          setError(`Erro ao carregar dados: ${err.message}`);
        }
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [monthKey]);

  const addTransaction = useCallback(
    async (data: TransactionFormData, amountCents: number) => {
      const baseData = {
        description: data.description.trim(),
        coupleId: COUPLE_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (data.type === "expense" && data.isInstallment && data.installmentCount && data.installmentCount > 1) {
        const count = data.installmentCount;
        const baseAmount = Math.floor(amountCents / count);
        const remainder = amountCents % count;
        const groupId = doc(collection(db, "couples")).id;

        const [year, month, day] = data.date.split("-").map(Number);
        
        for (let i = 1; i <= count; i++) {
          const installmentAmount = i === 1 ? baseAmount + remainder : baseAmount;
          
          const targetMonthZeroIndex = month - 1 + (i - 1);
          const newYear = year + Math.floor(targetMonthZeroIndex / 12);
          const newMonthIndex = targetMonthZeroIndex % 12;
          const lastDayOfTargetMonth = new Date(newYear, newMonthIndex + 1, 0).getDate();
          const newDay = Math.min(day, lastDayOfTargetMonth);
          
          const newMonthStr = String(newMonthIndex + 1).padStart(2, "0");
          const newDayStr = String(newDay).padStart(2, "0");
          const newDateStr = `${newYear}-${newMonthStr}-${newDayStr}`;

          const docData = {
            ...baseData,
            amount: installmentAmount,
            date: newDateStr,
            monthKey: getMonthKey(newDateStr),
            type: "expense",
            paidBy: data.paidBy,
            splitType: data.splitType,
            installmentCount: count,
            currentInstallment: i,
            groupId: groupId,
            originalAmount: amountCents
          };

          await addDoc(transactionsRef(), docData);
        }
      } else {
        let docData;
        if (data.type === "expense") {
          docData = {
            ...baseData,
            amount: amountCents,
            date: data.date,
            monthKey: getMonthKey(data.date),
            type: "expense",
            paidBy: data.paidBy,
            splitType: data.splitType,
          };
        } else {
          docData = {
            ...baseData,
            amount: amountCents,
            date: data.date,
            monthKey: getMonthKey(data.date),
            type: "settlement",
            from: data.from,
            to: data.to,
            pixDestination: data.pixDestination || "shared",
          };
        }

        await addDoc(transactionsRef(), docData);
      }
    },
    []
  );

  const updateTransaction = useCallback(
    async (id: string, data: TransactionFormData, amountCents: number) => {
      const baseData = {
        description: data.description.trim(),
        amount: amountCents,
        date: data.date,
        monthKey: getMonthKey(data.date),
        updatedAt: serverTimestamp(),
      };

      let docData;
      if (data.type === "expense") {
        docData = {
          ...baseData,
          type: "expense",
          paidBy: data.paidBy,
          splitType: data.splitType,
        };
      } else {
        docData = {
          ...baseData,
          type: "settlement",
          from: data.from,
          to: data.to,
          pixDestination: data.pixDestination || "shared",
        };
      }

      await updateDoc(transactionDocRef(id), docData);
    },
    []
  );

  const deleteTransaction = useCallback(async (transaction: Transaction) => {
    if (transaction.type === "expense" && transaction.groupId) {
      const q = query(
        transactionsRef(),
        where("groupId", "==", transaction.groupId)
      );
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
    } else {
      await deleteDoc(transactionDocRef(transaction.id));
    }
  }, []);

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
```

### 3. `src/types/index.ts`
```ts
import type { Timestamp } from "firebase/firestore";

export type Person = "Arthur" | "Zara";
export type SplitType = "50/50" | "100% Arthur" | "100% Zara";

export interface ExpenseTransaction {
  id: string;
  type: "expense";
  description: string;
  amount: number;
  paidBy: Person;
  splitType: SplitType;
  date: string;
  monthKey: string;
  coupleId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  installmentCount?: number;
  currentInstallment?: number;
  groupId?: string;
  originalAmount?: number;
}

export interface SettlementTransaction {
  id: string;
  type: "settlement";
  description: string;
  amount: number;
  from: Person;
  to: Person;
  date: string;
  monthKey: string;
  coupleId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  pixDestination?: "shared" | "zara_card";
}

export type Transaction = ExpenseTransaction | SettlementTransaction;

export interface ExpenseFormData {
  type: "expense";
  description: string;
  amount: string;
  paidBy: Person;
  splitType: SplitType;
  date: string;
  isInstallment?: boolean;
  installmentCount?: number;
}

export interface SettlementFormData {
  type: "settlement";
  description: string;
  amount: string;
  from: Person;
  to: Person;
  date: string;
  pixDestination?: "shared" | "zara_card";
}

export type TransactionFormData = ExpenseFormData | SettlementFormData;

export interface BalanceSummary {
  totalExpensesByArthur: number;
  totalExpensesByZara: number;
  totalExpenses: number;
  totalSettledByArthur: number;
  totalSettledByZara: number;
  netBalance: number;
  expenseCount: number;
  settlementCount: number;
}

export type BalanceDirection = "zara-owes" | "arthur-owes" | "even";
```

### 4. `src/lib/calculations.ts`
```ts
import type { Transaction, ExpenseTransaction, SettlementTransaction, BalanceSummary } from "../types";

export function parseToCents(brlString: string): number | null {
  if (!brlString) return null;
  const digits = brlString.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10);
}

export function getMonthKey(dateString: string): string {
  const [year, month] = dateString.split("-");
  return `${year}-${month}`;
}

export function calculateExpenseDebt(t: ExpenseTransaction): number {
  if (t.splitType === "100% Arthur") {
    if (t.paidBy === "Arthur") return 0;
    if (t.paidBy === "Zara") return -t.amount;
  }

  if (t.splitType === "100% Zara") {
    if (t.paidBy === "Zara") return 0;
    if (t.paidBy === "Arthur") return t.amount;
  }

  if (t.splitType === "50/50") {
    const half = Math.floor(t.amount / 2);
    if (t.paidBy === "Arthur") return half;
    if (t.paidBy === "Zara") return -half;
  }

  return 0;
}

export function calculateSettlementEffect(t: SettlementTransaction): number {
  if (t.from === "Arthur" && t.to === "Zara") return t.amount;
  if (t.from === "Zara" && t.to === "Arthur") return -t.amount;
  return 0;
}

export function calculateBalance(transactions: Transaction[]): BalanceSummary {
  let totalExpensesByArthur = 0;
  let totalExpensesByZara = 0;
  let totalSettledByArthur = 0;
  let totalSettledByZara = 0;
  let expenseCount = 0;
  let settlementCount = 0;

  let rawDebt = 0; 

  const validTransactions = transactions.filter(t => t.pixDestination !== 'zara_card');

  for (const t of validTransactions) {
    if (t.type === "expense") {
      expenseCount++;
      if (t.paidBy === "Arthur") totalExpensesByArthur += t.amount;
      else totalExpensesByZara += t.amount;
      rawDebt += calculateExpenseDebt(t);
    } else {
      settlementCount++;
      if (t.from === "Arthur") totalSettledByArthur += t.amount;
      else totalSettledByZara += t.amount;
      rawDebt += calculateSettlementEffect(t);
    }
  }

  return {
    totalExpensesByArthur,
    totalExpensesByZara,
    totalExpenses: totalExpensesByArthur + totalExpensesByZara,
    totalSettledByArthur,
    totalSettledByZara,
    netBalance: rawDebt,
    expenseCount,
    settlementCount,
  };
}

export function generatePixSummary(
  balance: BalanceSummary,
  monthLabel: string
): string {
  if (balance.netBalance === 0) {
    return `Tudo quitado em ${monthLabel}! ✨`;
  }

  const isZaraOwes = balance.netBalance > 0;
  const amountStr = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(balance.netBalance) / 100);

  let text = `*Resumo de ${monthLabel}*\n\n`;

  if (isZaraOwes) {
    text += `Zara deve: ${amountStr}\n\n`;
    text += `Chave Pix do Arthur:\n08488390623\n\n`;
  } else {
    text += `Arthur deve: ${amountStr}\n\n`;
    text += `Chave Pix da Zara:\n11649175657\n\n`;
  }

  text += `_Enviado via CasalPay_`;
  return text;
}
```

### 5. `src/pages/History.tsx`
```tsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTransactions } from "../hooks/useTransactions";
import { calculateBalance } from "../lib/calculations";
import {
  getCurrentMonthKey,
  formatBRL,
  formatMonthLabel,
} from "../lib/formatters";
import { TransactionItem } from "../components/TransactionItem";
import { MonthSelector } from "../components/MonthSelector";
import type { Transaction } from "../types";

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"shared" | "zara">("shared");
  const { transactions, loading, error, deleteTransaction } =
    useTransactions(selectedMonth);

  const sharedTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isZaraCardExpense = t.splitType === '100% Zara' && t.paidBy === 'Zara';
      const isZaraCardPix = t.pixDestination === 'zara_card';
      return !isZaraCardExpense && !isZaraCardPix;
    });
  }, [transactions]);

  const zaraTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isZaraCardExpense = t.splitType === '100% Zara' && t.paidBy === 'Zara';
      const isZaraCardPix = t.pixDestination === 'zara_card';
      return isZaraCardExpense || isZaraCardPix;
    });
  }, [transactions]);

  const zaraInvoiceTotal = useMemo(() => {
    return zaraTransactions.reduce((acc, t) => {
      if (t.type === 'expense') return acc + t.amount;
      if (t.type === 'settlement') {
         if (t.from === 'Zara') return acc - t.amount;
         if (t.from === 'Arthur') return acc + t.amount;
      }
      return acc;
    }, 0);
  }, [zaraTransactions]);

  const filteredTransactions = useMemo(() => {
    const source = activeTab === "shared" ? sharedTransactions : zaraTransactions;
    if (!searchTerm.trim()) return source;
    const lower = searchTerm.toLowerCase();
    return source.filter(t => t.description.toLowerCase().includes(lower));
  }, [sharedTransactions, zaraTransactions, activeTab, searchTerm]);

  const balance = useMemo(
    () => calculateBalance(sharedTransactions),
    [sharedTransactions]
  );

  const handleEdit = (t: Transaction) => {
    navigate("/add", { state: { transaction: t } });
  };

  const handleDelete = async (t: Transaction) => {
    await deleteTransaction(t);
  };

  const monthLabel = formatMonthLabel(selectedMonth);

  return (
    <main className="flex-1 overflow-y-auto pb-24">
      {/* Header com Busca Expansível */}
      <div className="px-5 pt-14 pb-4 flex items-center justify-between min-h-[90px]">
        {!isSearchExpanded ? (
          <div className="animate-fade-in-up flex-1">
            <p className="text-text-muted text-sm font-medium">Todas as despesas</p>
            <h1 className="text-2xl font-bold text-text-primary mt-1">Histórico</h1>
          </div>
        ) : (
          <div className="animate-fade-in-up flex-1 mr-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-70">🔍</span>
            <input 
              autoFocus
              type="text" 
              placeholder="Buscar despesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-full pl-9 pr-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-pink transition-colors"
            />
          </div>
        )}
        
        <button 
          onClick={() => {
            if (isSearchExpanded) {
              setSearchTerm("");
            }
            setIsSearchExpanded(!isSearchExpanded);
          }}
          className="shrink-0 w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-secondary hover:text-accent-pink hover:border-accent-pink transition-colors"
        >
          {isSearchExpanded ? "✕" : "🔍"}
        </button>
      </div>

      {/* Seletor de mês */}
      <div className="px-5 mb-4">
        <MonthSelector
          selectedMonth={selectedMonth}
          onChange={setSelectedMonth}
        />
      </div>

      {/* Abas de Navegação (Posicionadas no topo) */}
      <div className="px-5 mb-4">
        <div className="relative flex bg-bg-elevated rounded-xl p-1 border border-border">
          {/* Sliding Pill Indicator */}
          <div
            className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-lg transition-all duration-300 ease-in-out shadow-sm ${
              activeTab === "shared" ? "translate-x-0 bg-accent-pink" : "translate-x-full bg-[#A855F7]"
            }`}
          />
          
          <button
            onClick={() => setActiveTab("shared")}
            className={`relative z-10 flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors duration-300 ${
              activeTab === "shared"
                ? "text-white"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Nossos Gastos
          </button>
          <button
            onClick={() => setActiveTab("zara")}
            className={`relative z-10 flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors duration-300 ${
              activeTab === "zara"
                ? "text-white"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Fatura Zara
          </button>
        </div>
      </div>

      {/* Saldo líquido do mês (apenas se estiver na aba Dia a Dia) */}
      {activeTab === "shared" && !loading && (
        <div className="px-5 mb-4">
          <div className="card">
            <p className="text-sm text-text-muted mb-3 font-medium">
              Resumo de {monthLabel}
            </p>
            
            <div className="bg-bg-elevated rounded-2xl p-5 text-center border border-border mb-3">
              <p className="text-xs text-text-muted mb-1 font-medium">Total Compartilhado</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">
                {formatBRL(balance.totalExpenses)}
              </p>
              <p className="text-xs text-text-muted mt-1">
                em {balance.expenseCount} compras
              </p>
            </div>

            <div
              className={`rounded-2xl p-3 text-center border ${
                balance.netBalance === 0
                  ? "bg-accent-green/10 border-accent-green/30"
                  : balance.netBalance > 0
                  ? "bg-accent-pink/10 border-accent-pink/30"
                  : "bg-accent-blue/10 border-accent-blue/30"
              }`}
            >
              <p className="text-xs text-text-muted mb-0.5">Saldo líquido</p>
              <p className={`font-semibold ${balance.netBalance === 0 ? "text-text-primary" : balance.netBalance > 0 ? "text-accent-pink" : "text-accent-blue"}`}>
                {balance.netBalance === 0 
                  ? "Tudo quitado" 
                  : balance.netBalance > 0 
                ? `Zara deve ${formatBRL(balance.netBalance)}`
                : `Arthur deve ${formatBRL(Math.abs(balance.netBalance))}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resumo da Fatura Zara (apenas se estiver na aba zara) */}
      {activeTab === "zara" && !loading && (
        <div className="px-5 mb-4 animate-fade-in-up">
          <div className="card text-center">
            <p className="text-sm text-text-muted mb-1 font-medium">
              Total da Fatura Zara
            </p>
            <p className="text-3xl font-bold text-text-primary tabular-nums">
              {formatBRL(Math.max(0, zaraInvoiceTotal))}
            </p>
            {zaraInvoiceTotal < 0 && (
              <p className="text-xs text-accent-green mt-1">Crédito de {formatBRL(Math.abs(zaraInvoiceTotal))} para a próxima fatura</p>
            )}
          </div>
        </div>
      )}

      {/* Lista de transações */}
      <div className="px-5">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="card h-24 animate-pulse bg-bg-elevated opacity-50"
              />
            ))}
          </div>
        ) : error ? (
          <div className="card flex flex-col items-center py-10 gap-3 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="text-text-secondary">{error}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="card flex flex-col items-center py-12 gap-3 text-center">
            <span className="text-4xl">📅</span>
            <p className="text-text-secondary font-medium">
              Sem despesas em {monthLabel}
            </p>
            <p className="text-text-muted text-sm max-w-xs">
              Selecione outro mês ou adicione uma nova despesa.
            </p>
          </div>
        ) : filteredTransactions.length === 0 && searchTerm ? (
          <div className="card flex flex-col items-center py-12 gap-3 text-center">
            <span className="text-4xl">🔍</span>
            <p className="text-text-secondary font-medium">
              Nenhum resultado encontrado
            </p>
            <p className="text-text-muted text-sm max-w-xs">
              Não encontramos despesas para "{searchTerm}".
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTransactions.map((t) => (
              <TransactionItem
                key={t.id}
                transaction={t}
                showActions
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
```
