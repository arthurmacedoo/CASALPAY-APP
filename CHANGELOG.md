# Changelog - CasalPay 💑

Todas as alterações notáveis, correções e novos recursos deste projeto serão documentados neste arquivo seguindo o padrão [Semantic Versioning (SemVer)](https://semver.org/).

---

## [1.2.1] - 2026-09-24
### ⚡ Hotfix Fatura Pendente & Apple Pay
- **🐛 Correção do Botão Confirmar Fatura**: Ao clicar em "⚡ Confirmar Fatura" diretamente na aba de Pendentes, a ação não redireciona mais para a fatura. O usuário permanece na aba de Pendentes para continuar revisando os demais itens.
- **🔔 Feedback Visual Flutuante (Toast)**: Adicionada notificação flutuante com confirmação em tempo real (`⚡ "[Compra]" adicionada à fatura de [Nome]!`) com animação e auto-dismiss.
- **🛡️ Higienização de Datas e Mês (Apple Pay)**: Correção contra atalhos do iOS Shortcuts que enviavam minutos no lugar do mês (`yyyy-mm-dd` gerando meses corrompidos como `2026-36-23`). Agora o app preserva o dia real da compra e garante a alocação no mês correto vigente (`2026-09`).
- **🪄 Auto-Heal no Banco de Dados**: Adicionada rotina automática de reparo para resgatar compras que haviam sido salvas em meses inválidos (`monthKey > 2026-12`) e restaurá-las para a fatura do mês atual.
- **🔒 Blindagem do Webhook Apple Pay**: Endpoint da Vercel (`api/webhook-apple-pay.ts`) reforçado com validação estrita de mês (1 a 12) e dia (1 a 31), com sanitização inteligente.
- **🏷️ Indicador de Versão Visível na UI**:
  - Badge pulsante no rodapé da tela inicial (`Home.tsx`) exibindo a versão ativa.
  - Indicador de versão completa e release date no menu de Configurações do Grupo (`GroupSettingsSheet.tsx`).
  - Facilita conferência imediata em testes em múltiplos celulares (ex: iPhone 15 Pro Max e iPhone 13).

---

## [1.2.0] - 2026-09-08
### 💳 Fatura Inteligente & Apple Pay
- **Integração Apple Pay**: Captura de transações em tempo real via webhook e atalhos iOS Shortcuts.
- **Caixa de Pendentes**: Aba dedicada para compras recebidas via webhook aguardando confirmação rápida ou revisão detalhada.
- **Fatura Pessoal e Cartão de Crédito**: Separação entre "Nossos Gastos" compartilhados e faturas individuais de cada membro.
- **Compensação Mútua de Dívidas**: Painel de detalhamento de compensação mútua e abatimento de faturas com gaveta animada (*DebtDetailSheet*).
- **Simulador de Transações**: Botão de testes integrado na aba de Pendentes para testes locais sem necessidade de passar cartão físico.

---

## [1.1.0] - 2026-09-01
### 🚀 Lançamento Base CasalPay
- Divisão de despesas compartilhadas (50/50, percentual ou valores fixos).
- Saldo dinâmico entre membros do casal.
- Geração de resumo e código Pix copia-e-cola com liquidação automática.
- Suporte a múltiplos grupos e alternador de workspace.
- Suporte offline PWA com manifest e service worker.
