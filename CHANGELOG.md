# Changelog - CasalPay 💑

Todas as alterações notáveis, correções e novos recursos deste projeto serão documentados neste arquivo seguindo o padrão [Semantic Versioning (SemVer)](https://semver.org/).

---

## [1.5.1] - 2026-09-25
### 🔒 Concorrência Atômica, Sincronização Offline e Blindagem de Segurança
- **⚛️ Mutações Atômicas em Metas (`runTransaction`)**:
  - Refatoração das operações `addContribution` e `withdrawGoal` para execução atômica via `runTransaction` do Firestore.
  - Elimina risco de sobreposição de dados (*lost updates*) caso Arthur e Zara realizem aportes ou resgates simultaneamente em seus aparelhos.
  - O cálculo do saldo acumulado (`currentAmount`) e o rateio por membro (`contributionsByMember`) passam a ser resolvidos diretamente no banco com garantia ACID, mantendo fallback resiliente em `LocalStorage`.
- **📶 Tratamento de Snapshot Offline com Metadata**:
  - Inclusão de `includeMetadataChanges: true` e verificação de `snapshot.metadata.fromCache` e `snapshot.metadata.hasPendingWrites` nos listeners de metas, aportes e resgates.
  - Protege contra a sobrescrita acidental de alterações locais quando o aparelho transita entre modos offline e online.
- **🛡️ Blindagem Estrita do Webhook Apple Pay**:
  - Remoção de autenticação via query string (`req.query.secret` e `req.query.token`) no endpoint `/api/webhook-apple-pay.ts` e `/api/sync-apple-pay-outbox.ts`.
  - Exigência mandatória do cabeçalho HTTP seguro `Authorization: Bearer <WEBHOOK_SECRET>`, eliminando vazamento de credenciais em logs de acesso e histórico de URLs.
  - Preservação do fallback de grupo exclusivo configurado para o casal (`process.env.VITE_COUPLE_ID || "arthur-namorada-2026"`).
- **🔐 Proteção Rigorosa de Grupos nas Regras do Firestore**:
  - Atualização de `allow get` em `match /groups/{groupId}` para validar explicitamente `request.auth.uid in resource.data.memberIds`.
  - Impede que usuários autenticados externos consultem grupos dos quais não são membros, preservando a cascata para todas as subcoleções.

---

## [1.5.0] - 2026-09-25
### 🎯 Metas & Investimentos do Casal, Busca na Fatura e Experiência Mobile
- **🎯 Nova Aba Metas & Investimentos**:
  - Aba inovadora dedicada ao planejamento financeiro de médio e longo prazo do casal (viagens, reserva de emergência, casamentos, reformas e bens).
  - **Isolamento Financeiro Total**: Transações e saldos de metas são 100% segregados do fluxo mensal de faturas e divisão de despesas rotineiras, garantindo integridade contábil mútua.
  - **Distribuição de Aportes**: Suporte a aportes individuais (Arthur 100%, Zara 100%) ou divididos igualmente (50/50), com cálculo percentual exato em centavos.
  - **Modo Sandbox Resiliente**: Arquitetura híbrida que opera perfeitamente mesmo em modo offline/local via LocalStorage caso as regras do Firestore estejam em implantação.
- **🔍 Busca Inteligente & Histórico na Fatura**:
  - Modal flutuante acionado pela lupa na fatura (`InvoiceSearchSheet`) otimizado com `useMemo` para busca instantânea por título, categoria e valor.
  - Histórico de buscas recentes persistente com atalhos de remoção e limpeza.
  - Navegação entre meses da fatura com contadores de itens encontrados.
- **💳 Entrada Monetária Estilo Maquininha (POS)**:
  - Campo de valor com digitação decimal da direita para a esquerda (`maskCurrencyInput`), idêntico à experiência de maquininhas de cartão, eliminando falhas de preenchimento.
- **📅 Seletor Nativo de Prazos por Mês**:
  - Seletor de mês nativo (`type="month"`) para estimativa de conclusão da meta, acompanhado de chips de seleção rápida (+3 meses, +6 meses, Dezembro e +1 ano).
- **📜 Histórico Unificado de Movimentações (Aportes & Resgates)**:
  - Registro cronológico detalhado diferenciando aportes (`+ R$`) e resgates (`- R$`) com identificação visual do membro responsável.
  - Modal de resgate com dedução proporcional exata e proteção contra saldos negativos.
- **📱 Polimento Mobile & Correções de Arquitetura**:
  - Correção estrita na ordem de execução de Hooks (`Rules of Hooks`) no fechamento de modais.
  - Fechamento imediato de modais e gavetas ao clicar no backdrop externo.
  - Prevenção de auto-zoom indesejado no iOS Safari com fontes `text-base` em campos de entrada.
  - Higienização profunda de valores no `parseToCents` para suportar colagens com `R$`, espaços e caracteres invisíveis de atalhos do iOS.

---

## [1.2.2] - 2026-09-24
### 🎨 Centralização Toast & Correções UI
- **🐛 Correção de Alinhamento do Toast**: O aviso flutuante de confirmação da fatura não é mais empurrado para a lateral da tela. Agora ele utiliza um container flexível de largura total (`left-0 right-0 flex justify-center`) que elimina colisões de CSS transform, garantindo alinhamento perfeitamente centralizado em qualquer dispositivo (iPhone 13, iPhone 15 Pro Max ou simulador Desktop).
- **✨ Ajuste Estético e de Texto**: Removida duplicidade do ícone de raio (`⚡ ⚡`) no texto da mensagem, adotando formato dinâmico tipo pílula com bordas arredondadas e sombra suave.
- **🏷️ Atualização do Patch SemVer**: Versão incrementada para `v1.2.2` com sincronização dos arquivos de metadados e exibição no rodapé da Home e Configurações.

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
