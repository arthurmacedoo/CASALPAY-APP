# CasalPay — Revisão Completa do Projeto

## Contexto do Projeto
Aplicativo PWA para dividir despesas financeiras entre um casal (Arthur e Namorada).
No dia a dia, quando um deles paga uma compra, registram no app quem pagou, o valor e como dividir.
No fim do mês, o app mostra o saldo líquido e quem deve fazer o Pix para quem.

## Stack Técnica
- **Frontend:** React 18 + Vite + TypeScript (strict)
- **Estilo:** Tailwind CSS v3
- **Backend/DB:** Firebase Firestore (realtime) + Firebase Anonymous Auth
- **PWA:** vite-plugin-pwa (service worker + manifest)
- **Deploy alvo:** Vercel

## Regras de Negócio
- Valores armazenados em **centavos** (inteiros) para evitar float
- Lógica financeira isolada em `src/lib/calculations.ts`
- Autenticação anônima automática (sem login/senha)
- `coupleId` como "senha" compartilhada entre os dois celulares via variável de ambiente
- Tipos de divisão: 50/50, 100% Arthur, 100% Namorada, Pix Antecipado
- "Pix Antecipado" = um dos dois envia Pix ao outro para abater dívida antes do fechamento

---

## Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## src/types/index.ts
```typescript
import { Timestamp } from "firebase/firestore";

export type PaidBy = "Arthur" | "Namorada";
export type SplitType = "50/50" | "100% Arthur" | "100% Namorada" | "Pix Antecipado";

export interface Transaction {
  id: string;
  description: string;
  /** Valor em centavos (evitar problemas de ponto flutuante) */
  amount: number;
  paidBy: PaidBy;
  splitType: SplitType;
  date: string; // "2026-05-30"
  monthKey: string; // "2026-05"
  coupleId: string;
  /** true quando é um Pix de adiantamento entre o casal (reduz dívida) */
  isAdvancePayment?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TransactionFormData {
  description: string;
  amount: string; // string para facilitar o input; convertido em centavos na submissão
  paidBy: PaidBy;
  splitType: SplitType;
  date: string;
}

export interface BalanceSummary {
  /** Quanto a Namorada deve ao Arthur (positivo = ela deve) */
  namoradaOwesArthur: number;
  /** Quanto Arthur deve à Namorada (positivo = ele deve) */
  arthurOwesNamorada: number;
  /** Saldo líquido: positivo = Namorada deve ao Arthur; negativo = Arthur deve à Namorada */
  netBalance: number;
  totalPaidByArthur: number;
  totalPaidByNamorada: number;
  transactionCount: number;
}

export type BalanceDirection = "namorada-owes" | "arthur-owes" | "even";
```

---

## src/lib/calculations.ts
```typescript
import type { BalanceSummary, Transaction } from "../types";

/**
 * Calcula quanto UMA transação gera de dívida para cada parte.
 * Retorna a dívida líquida: positivo = Namorada deve ao Arthur.
 */
export function calculateTransactionDebt(transaction: Transaction): number {
  const { amount, paidBy, splitType } = transaction;

  // Pix Antecipado: quem pagou (enviou o Pix) reduziu a dívida do outro
  if (splitType === "Pix Antecipado") {
    if (paidBy === "Namorada") return -amount; // Namorada pagou adiantado → Arthur já recebeu
    if (paidBy === "Arthur") return amount;    // Arthur pagou adiantado → Namorada já recebeu
  }

  if (paidBy === "Arthur") {
    if (splitType === "50/50") return amount / 2;
    if (splitType === "100% Namorada") return amount;
    if (splitType === "100% Arthur") return 0;
  }

  if (paidBy === "Namorada") {
    if (splitType === "50/50") return -(amount / 2);
    if (splitType === "100% Arthur") return -amount;
    if (splitType === "100% Namorada") return 0;
  }

  return 0;
}

/**
 * Calcula o resumo financeiro completo de uma lista de transações.
 */
export function calculateBalance(transactions: Transaction[]): BalanceSummary {
  let namoradaOwesArthur = 0;
  let arthurOwesNamorada = 0;
  let totalPaidByArthur = 0;
  let totalPaidByNamorada = 0;

  for (const t of transactions) {
    if (t.paidBy === "Arthur") {
      totalPaidByArthur += t.amount;
    } else {
      totalPaidByNamorada += t.amount;
    }

    const debt = calculateTransactionDebt(t);
    if (debt > 0) {
      namoradaOwesArthur += debt;
    } else {
      arthurOwesNamorada += Math.abs(debt);
    }
  }

  const netBalance = namoradaOwesArthur - arthurOwesNamorada;

  return {
    namoradaOwesArthur,
    arthurOwesNamorada,
    netBalance,
    totalPaidByArthur,
    totalPaidByNamorada,
    transactionCount: transactions.length,
  };
}

export function generatePixSummary(balance: BalanceSummary, monthLabel: string): string {
  const absBalance = Math.abs(balance.netBalance);
  const formatted = formatCentsToBRL(absBalance);

  if (balance.netBalance === 0) {
    return `Fechamento de ${monthLabel}: Tudo certo, nenhum Pix necessário! ✅`;
  }
  if (balance.netBalance > 0) {
    return `Fechamento de ${monthLabel}: Namorada deve R$ ${formatted} para Arthur. 💙`;
  }
  return `Fechamento de ${monthLabel}: Arthur deve R$ ${formatted} para a Namorada. 🩷`;
}

function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export function getMonthKey(date: string): string {
  return date.slice(0, 7);
}
```

---

## src/lib/formatters.ts
```typescript
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatBRLRaw(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function formatMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long" });
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
  }
  return months;
}

export function formatSplitType(splitType: string): string {
  switch (splitType) {
    case "50/50": return "Dividido 50/50";
    case "100% Arthur": return "Só do Arthur";
    case "100% Namorada": return "Só da Namorada";
    case "Pix Antecipado": return "Pix Antecipado 💸";
    default: return splitType;
  }
}
```

---

## src/lib/firebase.ts
```typescript
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, doc, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("Persistência offline desabilitada: múltiplas abas abertas.");
  } else if (err.code === "unimplemented") {
    console.warn("Persistência offline não suportada neste browser.");
  }
});

export const transactionsRef = () => collection(db, "transactions");
export const transactionDocRef = (id: string) => doc(db, "transactions", id);
export const COUPLE_ID = import.meta.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";
```

---

## src/hooks/useAuth.ts
```typescript
import { useState, useEffect } from "react";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "../lib/firebase";

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Erro no login anônimo:", err);
          setError("Não foi possível conectar ao servidor.");
          setLoading(false);
        }
      }
    });
    return unsubscribe;
  }, []);

  return { user, loading, error };
}
```

---

## src/hooks/useTransactions.ts
```typescript
import { useState, useEffect, useCallback } from "react";
import { query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import type { Transaction, TransactionFormData } from "../types";
import { transactionsRef, transactionDocRef, COUPLE_ID } from "../lib/firebase";
import { getMonthKey } from "../lib/calculations";

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  addTransaction: (data: TransactionFormData, amountCents: number) => Promise<void>;
  updateTransaction: (id: string, data: TransactionFormData, amountCents: number) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
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
      where("coupleId", "==", COUPLE_ID),
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
      (err) => {
        console.error("Erro ao carregar transações:", err);
        setError("Erro ao carregar os dados. Verifique sua conexão.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [monthKey]);

  const addTransaction = useCallback(async (data: TransactionFormData, amountCents: number) => {
    await addDoc(transactionsRef(), {
      description: data.description.trim(),
      amount: amountCents,
      paidBy: data.paidBy,
      splitType: data.splitType,
      date: data.date,
      monthKey: getMonthKey(data.date),
      coupleId: COUPLE_ID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const updateTransaction = useCallback(async (id: string, data: TransactionFormData, amountCents: number) => {
    await updateDoc(transactionDocRef(id), {
      description: data.description.trim(),
      amount: amountCents,
      paidBy: data.paidBy,
      splitType: data.splitType,
      date: data.date,
      monthKey: getMonthKey(data.date),
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    await deleteDoc(transactionDocRef(id));
  }, []);

  return { transactions, loading, error, addTransaction, updateTransaction, deleteTransaction };
}
```

---

## src/App.tsx
```tsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { BottomNav } from "./components/BottomNav";
import { HomePage } from "./pages/Home";
import { AddExpensePage } from "./pages/AddExpense";
import { HistoryPage } from "./pages/History";

const LoadingScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-6">
    <div className="text-5xl animate-soft-pulse">💑</div>
    <div>
      <p className="text-text-primary font-semibold text-lg text-center">CasalPay</p>
      <p className="text-text-muted text-sm text-center mt-1">Conectando...</p>
    </div>
    <span className="spinner" />
  </div>
);

const ErrorScreen: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-8">
    <span className="text-4xl">😕</span>
    <p className="text-text-primary font-semibold text-center">Não foi possível conectar</p>
    <p className="text-text-muted text-sm text-center">{message}</p>
    <button onClick={() => window.location.reload()} className="text-accent-pink font-medium text-sm mt-2">
      Tentar novamente
    </button>
  </div>
);

const App: React.FC = () => {
  const { user, loading, error } = useAuth();

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (!user) return <LoadingScreen />;

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen min-h-dvh safe-top">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/add" element={<AddExpensePage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
};

export default App;
```

---

## src/pages/Home.tsx
```tsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTransactions } from "../hooks/useTransactions";
import { calculateBalance, generatePixSummary } from "../lib/calculations";
import { getCurrentMonthKey, formatMonthLabel } from "../lib/formatters";
import { BalanceCard } from "../components/BalanceCard";
import { TransactionItem } from "../components/TransactionItem";
import { Button } from "../components/ui/Button";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const currentMonth = getCurrentMonthKey();
  const { transactions, loading, error, deleteTransaction } = useTransactions(currentMonth);
  const [copied, setCopied] = useState(false);

  const balance = useMemo(() => calculateBalance(transactions), [transactions]);
  const recentTransactions = transactions.slice(0, 5);

  const handleCopyPix = async () => {
    const monthLabel = formatMonthLabel(currentMonth);
    const text = generatePixSummary(balance, monthLabel);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-5 gap-4">
        <span className="text-4xl">😕</span>
        <p className="text-text-secondary text-center">{error}</p>
        <Button onClick={() => window.location.reload()} size="sm" variant="secondary">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto pb-24">
      <div className="px-5 pt-14 pb-6">
        <p className="text-text-muted text-sm font-medium">Olá, casal! 💑</p>
        <h1 className="text-2xl font-bold text-text-primary mt-1">Sua fatura do mês</h1>
      </div>

      <div className="px-5 flex flex-col gap-4">
        {loading ? (
          <div className="card flex items-center justify-center py-12">
            <span className="spinner" />
          </div>
        ) : (
          <BalanceCard balance={balance} monthKey={currentMonth} onCopyPix={handleCopyPix} copied={copied} />
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-text-primary">Últimas despesas</h2>
            {transactions.length > 5 && (
              <button onClick={() => navigate("/history")} className="text-sm text-accent-pink font-medium">
                Ver todas →
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-20 animate-pulse bg-bg-elevated opacity-50" />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="card flex flex-col items-center py-10 gap-3 text-center">
              <span className="text-4xl">🛍️</span>
              <p className="text-text-secondary font-medium">Nenhuma despesa ainda</p>
              <p className="text-text-muted text-sm max-w-xs">
                Adicione a primeira compra do mês e acompanhe quem deve a quem.
              </p>
              <Button size="sm" onClick={() => navigate("/add")} className="mt-2">
                + Adicionar despesa
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentTransactions.map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  showActions
                  onEdit={(tx) => navigate("/add", { state: { transaction: tx } })}
                  onDelete={(id) => deleteTransaction(id)}
                />
              ))}
            </div>
          )}
        </div>

        {!loading && transactions.length > 0 && (
          <Button id="btn-add-expense-home" fullWidth onClick={() => navigate("/add")} className="mt-2">
            + Adicionar despesa
          </Button>
        )}
      </div>
    </main>
  );
};
```

---

## src/pages/AddExpense.tsx (resumido — arquivo completo com 289 linhas)
```tsx
// Campos: descrição, valor (em reais com vírgula), quem pagou (Arthur/Namorada),
// como dividir (50/50 | 100% Arthur | 100% Namorada | Pix Antecipado), data
// Validação client-side, conversão para centavos na submissão
// Suporte a modo edição (recebe transaction via react-router location.state)
// Toast de sucesso, navegação automática de volta ao editar
```

---

## src/pages/History.tsx
```tsx
// Seletor de mês (últimos 6 meses)
// Resumo financeiro do mês: total gasto, Arthur pagou, Namorada pagou, saldo líquido
// Lista de todas as transações com botões Editar / Excluir (com confirmação)
// Estados: loading skeleton, erro, lista vazia, lista com itens
```

---

## src/components/BalanceCard.tsx
```tsx
// Card principal da tela Home
// Mostra: saldo do mês, valor líquido (quem deve a quem), totais de cada um
// Botão "Copiar resumo do Pix" (gera texto formatado para WhatsApp)
// Cores dinâmicas: verde (zerado), rosa (namorada deve), azul (Arthur deve)
```

---

## src/components/TransactionItem.tsx
```tsx
// Card de uma transação individual
// Mostra: emoji do pagador, descrição, data, tipo de divisão, valor, dívida gerada
// Props opcionais: showActions, onEdit, onDelete
// Botão excluir requer confirmação dupla (anti-acidente)
```

---

## src/components/BottomNav.tsx
```tsx
// Barra de navegação fixa no rodapé (mobile-first)
// 3 abas: Início, Adicionar (botão rosa destacado central), Histórico
// Ícones SVG próprios, safe-area para iPhone
```

---

## src/components/MonthSelector.tsx
```tsx
// Chips horizontais com scroll para selecionar entre os últimos 6 meses
// Usado na página Histórico
```

---

## src/components/ui/Button.tsx e Input.tsx
```tsx
// Button: variantes primary/secondary/ghost/danger, sizes sm/md/lg, loading state
// Input: label, error state, hint text, encapsula input nativo com estilos
```

---

## vite.config.ts — PWA Manifest
```typescript
// PWA manifest: name="CasalPay", theme_color="#0D0D14" (dark)
// Ícones: 192x192 e 512x512
// Shortcut: /add (Adicionar Despesa)
// Workbox cache: js, css, html, png, svg
// registerType: autoUpdate
```

---

## package.json — Dependências principais
```json
{
  "dependencies": {
    "firebase": "^12.14.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.5.2",
    "tailwindcss": "^3.4.17",
    "typescript": "~5.8.3",
    "vite": "^6.3.5",
    "vite-plugin-pwa": "^0.22.3"
  }
}
```

---

## Perguntas para revisão da IA

Por favor, analise o projeto acima e responda:

1. **Arquitetura:** A separação de responsabilidades (lib/calculations.ts isolado da UI) está bem feita?
2. **Lógica financeira:** A função `calculateTransactionDebt` e o tipo "Pix Antecipado" estão corretos?
3. **Segurança:** O uso de `coupleId` como filtro + Anonymous Auth é suficiente para proteger dados de um casal privado? Alguma melhoria recomendada?
4. **Firebase:** `enableIndexedDbPersistence` está deprecated no Firebase 12. O que usar no lugar?
5. **PWA:** A configuração está adequada para instalação no iPhone (Safari) e Android?
6. **UX/Mobile:** Alguma melhoria de usabilidade para uso diário em celular?
7. **Performance:** Há algum vazamento de memória ou problema de re-render desnecessário?
8. **TypeScript:** Algum tipo fraco ou `any` implícito que deveria ser melhorado?
9. **Bugs potenciais:** Você identifica algum edge case ou bug que possa surgir no uso real?
10. **Melhorias sugeridas:** Quais features ou refatorações valeriam a pena para um v1.1?
