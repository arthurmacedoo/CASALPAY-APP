# CasalPay (DualPay) — Visão do Produto & Regras de Negócio 💑💳

---

## 1. O que é o CasalPay?
O **CasalPay** é uma plataforma financeira moderna desenvolvida como **Progressive Web App (PWA)**, criada para resolver a dor de cabeça da gestão financeira de casais. O aplicativo equilibra com precisão matemática despesas conjuntas, faturas de cartão de crédito e investimentos a longo prazo, garantindo transparência, justiça e zero atrito financeiro na vida a dois.

---

## 2. A Dor que o Produto Resolve
Na vida em casal, dividir contas não se resume a rachar a conta do restaurante:
1. **Assimetria de Gastos:** Um parceiro paga o supermercado, outro abastece o carro, compras online são parceladas no cartão de um deles, gerando confusão contábil.
2. **Mistura de Gastos Pessoais vs Gastos do Casal:** Compras feitas no cartão de um parceiro que eram para o casal frequentemente são esquecidas ou cobradas de forma injusta.
3. **Resíduo de Centavos e Arredondamentos:** Sistemas que usam floats (`0.1 + 0.2 = 0.30000000000000004`) geram erros acumulados. No CasalPay, **100% dos valores são calculados em centavos inteiros (integers)**.
4. **Falta de Planejamento Conjunto:** Casais têm sonhos (viagens, casamentos, reservas de emergência) que não devem ser misturados com o dinheiro das compras do supermercado do mês vigente.

---

## 3. Pilares e Módulos Principais

### 3.1. "Nossos Gastos" (Despesas Compartilhadas da Rotina)
* Permite o registro de qualquer despesa rotineira (ex: Mercado, Aluguel, Farmácia, Lazer).
* Para cada despesa, seleciona-se:
  - **Quem pagou:** Arthur ou Zara.
  - **Categoria:** Alimentação, Moradia, Transporte, Lazer, Saúde, Pets, etc.
  - **Tipo de Divisão:**
    - **50% / 50%:** Dividido igualmente. Caso o valor em centavos seja ímpar (ex: R$ 10,01), o centavo ímpar é alocado com critério determinístico garantindo soma 100% exata.
    - **100% Arthur ou 100% Zara:** Despesa assumida integralmente por um membro.
    - **Proporção Personalizada (%):** Ex: 60/40 ou 70/30 baseado em renda.
    - **Valores Fixos:** Valores nominais definidos para cada um.

### 3.2. Fatura Pessoal e Cartão de Crédito
* Cada membro possui sua própria fatura dentro do app.
* Compras capturadas via Apple Pay ou inseridas manualmente que pertencem ao titular do cartão são alocadas na sua fatura do mês.
* Itens da fatura que foram compras conjuntas podem ser promovidos para divisão compartilhada com um único toque.

### 3.3. Motor de Compensação Mútua (Abatimento Cruzado de Dívidas)
* O CasalPay possui um algoritmo inteligente de compensação:
  - Se Arthur deve R$ 300,00 para Zara em despesas da casa, mas Zara gastou R$ 100,00 no cartão de crédito do Arthur que Arthur já pagou, o sistema **abate automaticamente** as dívidas cruzadas.
  - O resultado final mostra apenas **uma única transferência líquida**: *"Arthur transfere R$ 200,00 para Zara via Pix"*.
* Isso elimina transferências bancárias desnecessárias de ida e volta.

### 3.4. Acertos e Liquidação via Pix Copia-e-Cola
* Geração instantânea de texto formatado pronto para envio no WhatsApp do parceiro com resumo dos gastos e saldo devedor.
* Geração do código Pix Copia-e-Cola (padrão EMV BR Code do Banco Central) com valor exato em centavos e chave Pix cadastrada do parceiro credor.
* Ao pagar, registra-se a liquidação (*Settlement*) que zera o saldo do mês mantendo o histórico auditável.

### 3.5. Aba Metas & Investimentos (Patrimônio do Casal)
* **Isolamento Financeiro Rigoroso:** O patrimônio guardado e as metas do casal são 100% segregados do fluxo mensal de faturas. Guardar R$ 1.000 para uma viagem não afeta o cálculo do que um parceiro deve ao outro no supermercado daquele mês.
* **Metas por Categorias:** Viagem (✈️), Reserva de Emergência (🛡️), Casa/Reforma (🏠), Casamento (💍), Carro (🚗), Tecnologia (💻) e Futuro (📈).
* **Distribuição de Aportes:**
  - Aporte 100% Arthur.
  - Aporte 100% Zara.
  - Aporte Conjunto (50/50).
* **Histórico Unificado de Movimentações:** Registra entradas (+ R$) e saídas (- R$), identificando o membro responsável pelo aporte ou resgate.
* **Resgates Proporcionais:** Validação estrita de saldos individuais; no resgate conjunto, a dedução é feita de forma rigorosamente proporcional às cotas guardadas por cada um.
* **Prazos Inteligentes:** Seletor nativo de mês/ano com botões de atalho rápido (+3 meses, +6 meses, Dezembro, +1 ano).

### 3.6. Caixa de Pendentes (Apple Pay Automation)
* Compras realizadas em cartões físicos/virtuais registradas no Apple Wallet ativam um Atalho do iOS (*iOS Shortcuts*) que envia uma notificação instantânea para o webhook do CasalPay.
* A transação entra na **Caixa de Pendentes** em tempo real aguardando a decisão rápida do casal:
  - "Confirmar para minha fatura pessoal" ⚡
  - "Dividir como despesa do casal" 🤝
  - "Ignorar / Excluir" 🗑️

---

## 4. Filosofia de Design e Experiência do Usuário
* **OLED Dark Theme:** Fundo `#16161F`, cartões elevados, sombras suaves e detalhes em degradê Rosa Neon (`#E879A0`) e Azul Elétrico (`#3B82F6`).
* **Ergonomia Móvel:** Modais tipo folha (*bottom sheets*) acionados por gestos, fechamento ao tocar no fundo, zero layout shift e fontes que impedem auto-zoom no iOS Safari.
* **Máscara de Cartão POS:** Digitação de moeda da direita para a esquerda, exatamente igual a maquininhas de cartão bancárias.
