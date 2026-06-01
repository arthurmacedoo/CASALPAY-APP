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

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS (Design System Moderno)
- **Backend/Database:** Firebase (Auth, Firestore)
- **Deployment & Hosting:** Vercel
- **Build Tool:** Vite
- **PWA:** Vite PWA Plugin + Workbox

---

*(Este software é mantido com os mais altos padrões de código para servir como base de uma futura startup financeira focada em relacionamentos).*
