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

## 📱 Apple Pay Offline — Arquitetura de Outbox

> **Problema:** Quando o iPhone está sem internet ao fazer uma compra, o Atalho não consegue enviar o POST para a Vercel e a transação se perde.
>
> **Solução:** O Atalho grava o evento localmente *antes* de tentar enviar. Um segundo Atalho de sincronização reprocessa a fila quando a internet voltar. O backend é **idempotente**: reenvios do mesmo evento não criam duplicatas.

### Fluxo Completo

```
[Compra Apple Pay]
       ↓
[Atalho 1: CasalPay Apple Pay]
  1. Gera clientEventId único
  2. Grava linha JSON em: Arquivos/Atalhos/CasalPay/apple-pay-outbox.jsonl  ← ANTES da rede
  3. Tenta POST /api/webhook-apple-pay
     ✓ Online  → despesa vai para Pendentes no app
     ✗ Offline → linha fica no arquivo (sem erro visível)

[Atalho 2: CasalPay Sync Outbox]
  1. Lê apple-pay-outbox.jsonl
  2. POST /api/sync-apple-pay-outbox com { events: [...] }
  3. Mostra resumo: X criados | Y duplicados | Z falhas

[Backend Firestore]
  couples/{coupleId}/apple_pay_events/{clientEventId}
       ↓ (chave de idempotência — impede duplicatas)
  couples/{coupleId}/transactions/{id}
```

---

### Atalho 1 — "CasalPay Apple Pay" (gatilho de compra)

Configure este Atalho para **disparar automaticamente** a cada notificação de aprovação de compra do Nubank/banco (usando Automações → App → Abrir).

#### Variáveis de entrada
| Campo | Fonte |
|---|---|
| `amount` | Texto da notificação Apple Pay (ex: `R$ 39,69`) |
| `description` | Nome do estabelecimento |
| `date` | Data atual (`Data` → formatar como `YYYY-MM-DD`) |

#### Passos do Atalho

```
1. [Receber entrada] Texto — valor da notificação
2. [Variável] → amount = entrada recebida
3. [Data] → Hoje → Formatar como "yyyy-MM-dd" → date
4. [Texto] → description = "Nome do estabelecimento" (ou variável da notificação)

5. [Texto] → Montar clientEventId:
   "zara_" + date + "T" + [Hora atual → HH:mm:ss] + "_" + amount + "_" + description
   (substitua espaços/barras por "_" com Substituir Texto)

6. [Dicionário] → Montar payload JSON:
   {
     "clientEventId": [clientEventId],
     "amount": [amount],
     "description": [description],
     "date": [date],
     "deviceUser": "Zara",
     "source": "ios-shortcut-apple-pay",
     "capturedAt": [Data/Hora atual ISO]
   }

7. [Acrescentar ao arquivo de texto]
   Arquivo: Atalhos/CasalPay/apple-pay-outbox.jsonl
   Texto: [Dicionário como JSON] + nova linha
   ⚠️ ESTE PASSO É ANTES DA REDE — garante que o evento não se perca

8. [Obter conteúdo do URL]
   URL: https://casalpay.vercel.app/api/webhook-apple-pay
   Método: POST
   Headers:
     Authorization: Bearer casalpayarthurzara
     Content-Type: application/json
   Corpo: [Dicionário como JSON]
   Permitir falha: ✓ (não travar o Atalho se offline)

9. [Se] resultado da URL contém "ok" → [Notificação] "✅ Compra registrada"
   [Senão]                              → [Notificação] "📥 Salvo offline — sincronize depois"
```

---

### Atalho 2 — "CasalPay Sync Outbox" (sincronização)

#### Passos do Atalho

```
1. [Obter arquivo de texto]
   Arquivo: Atalhos/CasalPay/apple-pay-outbox.jsonl

2. [Dividir texto] → Separador: Nova linha
   → Lista de linhas JSON

3. [Repetir com cada item da lista]
   → Se item não estiver vazio:
     [Obter conteúdo do URL]
       URL: https://casalpay.vercel.app/api/sync-apple-pay-outbox
       Método: POST
       Headers:
         Authorization: Bearer casalpayarthurzara
         Content-Type: application/json
       Corpo: { "events": [ [item JSON] ] }

4. [Variável] → Contar: criados / duplicados / falhas a partir das respostas

5. [Notificação] "Sync concluído: X criados, Y duplicados, Z falhas"
```

> **Dica:** Para envio em lote de uma vez (mais eficiente), colete todas as linhas em um array e envie um único POST para `/api/sync-apple-pay-outbox` com `{ "events": [linha1, linha2, ...] }`.

#### Automações recomendadas (Atalhos → Automação Pessoal)
| Gatilho | Ação |
|---|---|
| Abrir app CasalPay | Executar "CasalPay Sync Outbox" |
| Wi-Fi conectado | Executar "CasalPay Sync Outbox" |
| Saída do Modo Avião | Executar "CasalPay Sync Outbox" |
| Todos os dias às 08:00 | Executar "CasalPay Sync Outbox" |
| Todos os dias às 22:00 | Executar "CasalPay Sync Outbox" |

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

