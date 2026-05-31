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

---

## 🔮 Roadmap e Visão de Futuro (Para Comercialização)
Este projeto está pronto para receber novas funcionalidades e se tornar um produto comercial robusto:

- [ ] **Integração Open Finance:** Conexão com bancos para importar transações automaticamente.
- [ ] **Categorização Inteligente:** Gráficos e categorias (Mercado, Lazer, Contas) para o casal entender onde estão gastando mais.
- [ ] **Metas Conjuntas:** Criação de caixinhas para viagens, casamento, ou móveis novos com acompanhamento de progresso.
- [ ] **Notificações Push:** Alertas sobre vencimentos e lembretes amigáveis para acertos financeiros ("O fechamento do mês chegou!").
- [ ] **Multicasais / Família:** Expansão para dividir contas em repúblicas, viagens com amigos ou famílias.
- [ ] **Exportação em PDF/Excel:** Para auditorias e relatórios de fim de ano.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS (Design System Moderno)
- **Backend/Database:** Firebase (Auth, Firestore)
- **Deployment & Hosting:** Vercel
- **Build Tool:** Vite
- **PWA:** Vite PWA Plugin + Workbox

---

## 🔒 Segurança e Instalação (Guia Técnico)

A arquitetura de segurança atual impede que usuários não cadastrados como "par" leiam ou modifiquem qualquer dado. 

### 1. Requisitos de Ambiente
Crie um arquivo `.env` na raiz do projeto:
```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_id
VITE_FIREBASE_APP_ID=seu_app_id
VITE_COUPLE_ID=identificador_unico_do_casal
```

### 2. Configuração Firestore
No Firestore, é necessário criar um documento dentro da coleção `couples` com o mesmo ID inserido em `VITE_COUPLE_ID`. O documento deve conter os UIDs permitidos:
```json
{
  "members": {
    "UID_PARCEIRO_A": true,
    "UID_PARCEIRO_B": true
  }
}
```

### 3. Regras de Proteção de Dados (Firestore Rules)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isCoupleMember(coupleId) {
      return request.auth != null &&
        get(/databases/$(database)/documents/couples/$(coupleId)).data.members[request.auth.uid] == true;
    }
    match /couples/{coupleId} {
      allow read, update: if isCoupleMember(coupleId);
      match /transactions/{transactionId} {
        allow read, create, update, delete: if isCoupleMember(coupleId);
      }
    }
  }
}
```

---

## 📱 Instalação PWA
- **iOS:** Acesse via Safari -> Compartilhar -> "Adicionar à Tela de Início".
- **Android:** Acesse via Chrome -> Menu -> "Adicionar à Tela Inicial".

---

*(Este software é mantido com os mais altos padrões de código para servir como base de uma futura startup financeira focada em relacionamentos).*
