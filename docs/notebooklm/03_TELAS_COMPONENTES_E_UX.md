# CasalPay — Mapa de Telas, Componentes & Experiência do Usuário (UX) 📱✨

---

## 1. Navegação Principal (`BottomNav.tsx`)
A navegação do app utiliza uma barra inferior fixa (*bottom navigation bar*), projetada ergonomicamente para uso com uma só mão:
* **🏠 Início (Home):** Visão geral consolidada do mês, saldos líquidos e resumo de fechamento.
* **💳 Fatura:** Extrato mensal detalhado de despesas pessoais, gastos do casal, caixa de pendentes e busca instantânea.
* **🎯 Metas:** Painel de investimentos e patrimônio conjunto do casal (sonhos a médio e longo prazo).
* **➕ Botão Flutuante Central:** Acesso rápido de qualquer tela para adicionar uma nova despesa ou registrar um acerto Pix.

---

## 2. Mapa Detalhado de Telas

### 2.1. Tela Inicial (`Home.tsx`)
* **Card de Saldo Consolidado:**
  - Indica claramente quem deve a quem no momento: *"Arthur deve R$ 120,50 para Zara"* ou *"Tudo acertado! 🎉"*.
  - Efeito glow com cores da marca e opção de ocultar valores (olhinho 👁️/🙈) para privacidade em locais públicos.
* **Gráfico de Proporção de Gastos:**
  - Barra visual bipartida demonstrando a participação percentual de cada membro nas despesas do mês corrente.
* **Ações Rápidas:**
  - **Botão Pix Copia-e-Cola:** Abre o modal com QR Code e chave Pix para liquidação imediata da dívida calculada.
  - **Gerador de Resumo WhatsApp:** Cria um texto com emojis e formatação impecável para envio no chat do casal.
* **Indicador de Versão Ativa:**
  - Badge pulsante no rodapé (ex: `✨ v1.5.0`) confirmando a versão exata do software em execução no celular.

---

### 2.2. Tela de Fatura & Extrato (`Invoices / Home`)
* **Navegação Temporal por Meses:**
  - Carrossel horizontal permitindo navegar para meses anteriores e futuros (`2026-08`, `2026-09`, `2026-10`).
* **Caixa de Pendentes (Apple Pay):**
  - Lista de compras recebidas automaticamente do iPhone aguardando categorização.
  - Botão de confirmação rápida com notificação flutuante tipo pílula centralizada (*Toast*) sem redirecionamentos indesejados.
* **Busca Inteligente com Histórico (`InvoiceSearchSheet.tsx`):**
  - Acionada pelo ícone de lupa na barra da fatura.
  - Apresenta histórico de termos buscados recentemente salvos localmente no aparelho.
  - Filtragem instantânea via `useMemo` com suporte a busca por nome da loja/estabelecimento, categoria ou valor em centavos.
  - Contadores de correspondências encontradas e botão de limpeza de histórico.

---

### 2.3. Tela de Metas & Sonhos (`Goals.tsx`)
* **Hero Card: Patrimônio Total Guardado:**
  - Valor total consolidado somando todas as metas ativas e concluídas do casal.
  - Barra comparativa demonstrando a proporção acumulada guardada por Arthur vs Zara.
  - Métrica de aportes realizados no mês atual (+ R$).
* **Filtros de Visualização:**
  - Abas rápidas: *Todas*, *Em aberto* e *Concluídas*.
* **Cards de Metas (`GoalCard.tsx`):**
  - Ícone emoji temático (🛡️, ✈️, 🏠, 💍, etc.).
  - Barra de progresso percentual dinâmica com animação de preenchimento.
  - Indicador de valor guardado, meta final e saldo restante.
  - Prazo estimado formatado de forma amigável (ex: `🗓️ Dez/2026`).
* **Criador de Metas (`NewGoalSheet.tsx`):**
  - Grade de categorias predefinidas com seleção por toque.
  - Campo de valor com máscara numérica estilo maquininha POS (`maskCurrencyInput`).
  - Chips de incremento rápido (+ R$ 1 mil, + R$ 5 mil, + R$ 10 mil).
  - Seletor nativo de mês/ano com container visual estilizado, placeholder visível no iOS e chips de atalho rápido (+3 meses, +6 meses, Dez/ano, +1 ano).
* **Gaveta de Detalhes da Meta (`GoalDetailSheet.tsx`):**
  - Histórico cronológico unificado exibindo tanto aportes (`+ R$`) quanto resgates (`- R$`) com identificação visual do autor da movimentação.
  - Modal de novo aporte com divisão flexível (100% Arthur, 100% Zara ou 50/50).
  - Modal de resgate com proteção matemática contra saldos negativos e dedução proporcional exata entre cotas.
  - Opção de exclusão da meta com confirmação.

---

### 2.4. Modal de Lançamento de Despesa (`AddExpense.tsx`)
* Campo monetário de alta precisão com entrada da direita para a esquerda.
* Seleção de data com atalhos para "Hoje" e "Ontem".
* Seleção visual de quem efetuou o pagamento.
* Painel de divisão inteligente: 50/50, percentuais calculados dinamicamente ou valores personalizados.
* Opção de marcar a despesa como fatura pessoal ou gasto compartilhado do casal.

---

### 2.5. Menu de Configurações do Grupo (`GroupSettingsSheet.tsx`)
* Alternador de espaços de trabalho (permite isolar o grupo oficial do casal de viagens com amigos ou grupos de teste).
* Gerenciamento de chaves Pix dos membros.
* Exibição detalhada da versão do aplicativo, build e data de compilação.
