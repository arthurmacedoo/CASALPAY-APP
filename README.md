# DualPay (antigo CasalPay) 💑 💳

Um aplicativo Progress Web App (PWA) moderno, focado em ajudar casais modernos a gerenciarem suas despesas financeiras conjuntas de forma justa, rápida e transparente.

A plataforma calcula instantaneamente a divisão de contas, processa pagamentos desiguais e gera um extrato final simplificado, eliminando a dor de cabeça de fechar as contas no final do mês. 

Este projeto foi construído como um MVP (Minimum Viable Product) com alto potencial de escalabilidade para um modelo SaaS (Software as a Service) voltado para casais de todas as idades.

## ✨ Por que o DualPay?
A gestão financeira é um dos maiores desafios para casais. O DualPay resolve isso com uma interface intuitiva, cálculos exatos de dívidas e um fluxo de acertos mensais focado em produtividade. Não importa se a conta do mercado foi dividida 50/50 ou se um pagou o jantar inteiro: o sistema faz o balanceamento no final e mostra quem deve a quem.

---

## 🚀 Funcionalidades Principais (MVP)

- **Controle de Acesso Fechado:** Acesso restrito a um par de usuários (casal), com ambiente totalmente isolado via regras rígidas no Firestore.
- **Registro Flexível de Despesas:** Informe quem pagou, o valor exato e a proporção da divisão (50/50, 100% Ele, 100% Ela).
- **Acertos Intermediários (Pix):** Registre transferências entre o casal ao longo do mês. O sistema abate o valor da dívida automaticamente.
- **Divisão Milimétrica:** Tratamento automático de dízimas e centavos (ex: R$ 10,01 dividido por 2), garantindo que ninguém perca 1 centavo na divisão.
- **Resumo Inteligente:** Geração de um resumo de fechamento do mês pronto para copiar e colar no WhatsApp, contendo a chave Pix e o saldo final exato.
- **Experiência Nativa (PWA):** Instalação direta no celular sem necessidade de passar pelas lojas de aplicativos (App Store ou Google Play), com suporte offline cacheado.
- **Integração Apple Pay (Offline-First):** Captura automática de compras via Atalhos do iOS com fila offline no dispositivo e sincronização idempotente.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS (Design System Moderno)
- **Backend/Database:** Firebase (Auth, Firestore)
- **Deployment & Hosting:** Vercel
- **Build Tool:** Vite
- **PWA:** Vite PWA Plugin + Workbox

---

## 📱 Integração Apple Pay (Online & Offline)

Com a nova API simplificada, a automação no iPhone funciona de forma **ultra simples**, capturando a compra do Apple Pay instantaneamente.

---

### ⚙️ Como configurar a Automação no iPhone (Zara e Arthur)

#### 1. Criar o Atalho de Compra
No aplicativo **Atalhos (Shortcuts)** do iPhone:
1. Vá na aba **Automação** → toque em **+** (Nova Automação).
2. Escolha o gatilho **Transação** (ou **Carteira / Wallet** no iOS 17+).
3. Marque **Qualquer Cartão** e **Executar Imediatamente** (desmarque "Notificar ao Executar" para rodar silenciosamente em segundo plano).
4. Adicione as ações:
   - **Obter Valor da Transação** / **Comerciante** / **Data** a partir da *Entrada do Atalho*.
   - **Acrescentar ao Arquivo:** Salve 1 linha JSON simples no arquivo `Shortcuts/CasalPay/outbox.txt`. *(Garante que a compra não se perca se você estiver sem internet)*.
   - **Obter Conteúdo da URL (POST):**
     - **URL:** `https://casalpay.vercel.app/api/webhook-apple-pay?secret=SUA_SENHA_AQUI`
     - **Método:** `POST`
     - **Corpo (JSON):**
       ```json
       {
         "amount": "Entrada do Atalho -> Valor",
         "description": "Entrada do Atalho -> Comerciante",
         "date": "Data Atual (yyyy-MM-dd)",
         "deviceUser": "Zara"
       }
       ```
   - **Se o envio for bem-sucedido:** Apague a linha recém-enviada do `outbox.txt`.

---

#### 2. Criar a Automação de Sincronização Offline (Para quando reconectar a internet)
No aplicativo **Atalhos**:
1. Crie uma nova Automação Pessoal com o gatilho **"Ao Conectar ao Wi-Fi"** ou **"Ao Abrir o App CasalPay"**.
2. Ação:
   - **Obter arquivo de texto:** `Shortcuts/CasalPay/outbox.txt`.
   - Se o arquivo contiver linhas:
     - **Obter Conteúdo da URL (POST):**
       - **URL:** `https://casalpay.vercel.app/api/sync-apple-pay-outbox?secret=SUA_SENHA_AQUI`
       - **Corpo (JSON):** `{ "events": [ Linhas do outbox.txt ] }`
     - Limpar/Apagar o arquivo `outbox.txt`.

---

### Endpoints do Backend

#### `POST /api/webhook-apple-pay`
Processa um único evento. Idempotente quando `clientEventId` é fornecido.

```jsonc
// Request
{
  "amount": "R$ 39,69",         // obrigatório — aceita formatos sujos
  "description": "COMPER 82",  // opcional — usa "Compra Apple Pay" se ausente
  "date": "2026-06-12",        // opcional — usa hoje se ausente
  "clientEventId": "zara_2026-06-12T15:30:00_R$39,69_COMPER82",  // recomendado
  "deviceUser": "Zara",        // opcional — rastreabilidade
  "source": "ios-shortcut-apple-pay",  // opcional
  "capturedAt": "2026-06-12T15:30:00-03:00"  // opcional
}

// Response — novo evento
{ "ok": true, "id": "abc123", "idempotent": true }

// Response — evento duplicado (reenvio)
{ "ok": true, "duplicate": true, "id": "abc123", "idempotent": true }

// Response — sem clientEventId (aviso)
{ "ok": true, "id": "def456", "idempotent": false, "warning": "clientEventId ausente..." }

// Response — valor irrecuperável (fallback)
{ "ok": false, "fallback": true, "id": "ghi789", "reason": "Valor irrecuperável: \"abc\"" }
```

#### `POST /api/sync-apple-pay-outbox`
Processa um lote de até 100 eventos offline. Cada um é idempotente.

```jsonc
// Request
{
  "events": [
    { "clientEventId": "evt1", "amount": "39.69", "description": "COMPER 82", "date": "2026-06-12" },
    { "clientEventId": "evt1", "amount": "39.69", "description": "COMPER 82", "date": "2026-06-12" }  // duplicata
  ]
}

// Response
{
  "ok": true,
  "total": 2,
  "created": 1,
  "duplicates": 1,
  "failed": 0,
  "results": [
    { "clientEventId": "evt1", "status": "created",   "id": "abc123" },
    { "clientEventId": "evt1", "status": "duplicate", "id": "abc123" }
  ]
}
```

---

### Estrutura Firestore

```
couples/
  {coupleId}/
    transactions/
      {transactionId}    ← despesas normais
    apple_pay_events/
      {sanitizedEventId} ← índice de idempotência
        transactionId: string
        amountCents: number
        description: string
        date: string
        processedAt: Timestamp
    fcm_tokens/
      {deviceName}
        token: string
```

> **Regra de ouro:** O arquivo `apple-pay-outbox.jsonl` no iPhone é a fonte de verdade offline. O backend nunca apaga esse arquivo — a deduplicação garante que reenvios sejam harmless. Nunca pague duas vezes pela mesma compra.

---

*(Este software é mantido com os mais altos padrões de código para servir como base de uma futura startup financeira focada em relacionamentos).*

