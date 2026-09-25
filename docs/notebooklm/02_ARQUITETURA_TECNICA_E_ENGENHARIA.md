# CasalPay — Arquitetura Técnica & Engenharia de Software 🛠️⚙️

---

## 1. Visão Geral da Stack Tecnológica

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript | Interface declarativa, tipagem estrita de ponta a ponta |
| **Build Tool** | Vite 6 | Compilação ultra-rápida, Hot Module Replacement (HMR) e empacotamento otimizado |
| **Estilização** | Tailwind CSS v4 | Utilitários modernos, OLED Dark Theme (`#16161F`), responsividade mobile |
| **PWA & Offline** | `vite-plugin-pwa`, Workbox | Instalação direta no celular, Service Worker com cache e execução offline |
| **Banco de Dados** | Firebase Cloud Firestore (v11) | Banco NoSQL em tempo real com listeners reativos (`onSnapshot`) |
| **Autenticação** | Firebase Authentication | Login seguro de usuários (Arthur & Zara) com persistência de sessão |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | Notificações em segundo plano para compras e atualizações de despesas |
| **Serverless Backend** | Vercel Serverless Functions | Endpoints de integração externa (`api/webhook-apple-pay.ts`) |
| **Hospedagem & CI/CD** | Vercel + GitHub | Deploy automático a cada push na branch `main` |

---

## 2. Estrutura do Banco de Dados (Firestore NoSQL)

A modelagem de dados do CasalPay utiliza uma estrutura multi-grupos escalável organizada em subcoleções:

```text
/groups/{groupId}
  ├── title, currency, memberIds: [uidArthur, uidZara], createdAt
  │
  ├── /members/{userId}
  │     ├── name, email, role: ("admin" | "member"), avatarUrl, pixKey
  │
  ├── /transactions/{transactionId}
  │     ├── title, amount (em centavos), date (YYYY-MM-DD), monthKey (YYYY-MM)
  │     ├── paidByUserId, category, type: ("expense" | "settlement")
  │     ├── splitType: ("split_equal" | "full_payer" | "full_other" | "percentage" | "fixed")
  │     ├── splitDetails: { [userId]: amountInCents }
  │     ├── isPersonalInvoice: boolean
  │     ├── targetMemberId: string (se for fatura pessoal)
  │     └── status: ("confirmed" | "pending")
  │
  ├── /goals/{goalId}
  │     ├── title, category, emoji, targetAmount, currentAmount, deadline (YYYY-MM)
  │     ├── status: ("in_progress" | "completed")
  │     └── contributionsByMember: { [userId]: totalEmCentavos }
  │
  ├── /goal_contributions/{contribId}
  │     ├── goalId, amount, contributorType: ("arthur" | "zara" | "split")
  │     ├── memberAmounts: { [userId]: centavos }, date, monthKey, note
  │
  ├── /goal_withdrawals/{withdrawalId}
  │     ├── goalId, amount, reason, contributorType, withdrawnByUserId, date
  │
  └── /fcm_tokens/{tokenId}
        └── token, userId, updatedAt
```

### Regras de Segurança do Firestore (`firestore.rules`)
* Regras declarativas baseadas em permissão no documento pai:
* Subcoleções herdam permissão com regra wildcard `match /{document=**}`: apenas membros pertencentes ao array `memberIds` do grupo podem ler e escrever dados, garantindo privacidade absoluta entre diferentes grupos e usuários externos.

---

## 3. Pipeline de Automação: Apple Pay & Webhooks

```mermaid
flowchart LR
    A["📱 Cartão no Apple Pay"] --> B["⚡ Atalho iOS (Shortcuts)"]
    B --> C["🌐 Webhook Vercel (/api/webhook-apple-pay)"]
    C --> D["🛡️ Sanitização (Data/Mês/Valor)"]
    D --> E["🔥 Firestore (/transactions)"]
    E --> F["🔔 Push Notification FCM"]
    F --> G["📥 Caixa de Pendentes no App"]
```

1. **Gatilho:** Uma compra com cartão de crédito via iPhone dispara um Atalho pessoal do iOS (*Personal Automation*).
2. **Endpoint Seguro:** O atalho faz um `POST` no endpoint Serverless da Vercel (`/api/webhook-apple-pay.ts`).
3. **Higienização e Proteção:**
   - Tratamento de bugs comuns do iOS Shortcuts (ex: atalhos que enviam minutos no lugar do mês como `2026-36-23`).
   - O CasalPay sanitiza os dados garantindo ano válido (2020–2050), mês válido (01–12) e dia válido (01–31).
4. **Gravação e Push:** A transação é salva com status `pending` e uma notificação push via FCM alerta o outro membro do casal.

---

## 4. Engenharia Financeira: Integridade em Centavos

O CasalPay **proíbe o uso de números de ponto flutuante (floats)** para armazenar ou somar dinheiro:
* R$ 150,50 é armazenado no banco como o inteiro `15050`.
* A função `parseToCents` converte qualquer string de entrada (mesmo colada com símbolos bancários, espaços ou caracteres invisíveis `\u00A0` do iOS) para centavos exatos.
* A função `maskCurrencyInput` implementa digitação decimal estilo POS (maquininha de cartão):
  - `"1"` ➔ `0,01`
  - `"15"` ➔ `0,15`
  - `"150"` ➔ `1,50`
  - `"1500"` ➔ `15,00`
  - `"150000"` ➔ `1.500,00`
* Funções puras e desacopladas no módulo `src/lib/calculations.ts` realizam o fechamento contábil e compensação cruzada com cobertura de testes unitários automatizados.

---

## 5. Gerenciamento de Estado e Reatividade

* **`GroupContext` & `AuthContext`:** Contextos centrais que mantêm o estado de autenticação e o grupo ativo por toda a árvore de componentes.
* **`useTransactions(monthKey)`:** Escuta em tempo real (`onSnapshot`) as transações do mês selecionado, aplicando cache reativo e query bailing.
* **`useGoals()`:** Hook híbrido com sincronização bidirecional no Firestore e fallback resiliente em `LocalStorage`, garantindo operação imediata mesmo em transições de rede ou modo offline.
* **`useMemo` para Otimização de Busca:** O componente `InvoiceSearchSheet` utiliza memoização de buscas com histórico persistente, permitindo busca instantânea em faturas longas com centenas de itens sem refazer renderizações pesadas.
