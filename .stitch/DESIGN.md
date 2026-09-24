---
name: CasalPay
colors:
  surface: '#0D0D14'
  surface-dim: '#0A0A0F'
  surface-bright: '#16161F'
  surface-container-lowest: '#08080C'
  surface-container-low: '#0D0D14'
  surface-container: '#16161F'
  surface-container-high: '#1E1E2C'
  surface-container-highest: '#28283A'
  on-surface: '#F0F0F8'
  on-surface-variant: '#9090B0'
  inverse-surface: '#F0F0F8'
  inverse-on-surface: '#16161F'
  outline: '#2A2A3E'
  outline-variant: '#3A3A52'
  surface-tint: '#E879A0'
  primary: '#E879A0'
  on-primary: '#FFFFFF'
  primary-container: '#331B26'
  on-primary-container: '#FFD9E2'
  inverse-primary: '#E879A0'
  secondary: '#7B8FFF'
  on-secondary: '#FFFFFF'
  secondary-container: '#1C2242'
  on-secondary-container: '#DCE2FF'
  tertiary: '#4ADE80'
  on-tertiary: '#052E16'
  tertiary-container: '#143823'
  on-tertiary-container: '#86EFAC'
  error: '#F87171'
  on-error: '#450A0A'
  error-container: '#371414'
  on-error-container: '#FECACA'
  background: '#0D0D14'
  on-background: '#F0F0F8'
  surface-variant: '#1E1E2C'
typography:
  display-lg:
    fontFamily: Inter, -apple-system, SF Pro Display, sans-serif
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Inter, -apple-system, SF Pro Display, sans-serif
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter, -apple-system, SF Pro Display, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter, -apple-system, SF Pro Display, sans-serif
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter, -apple-system, SF Pro Display, sans-serif
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter, -apple-system, SF Pro Text, sans-serif
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter, -apple-system, SF Pro Text, sans-serif
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter, -apple-system, SF Pro Text, sans-serif
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter, -apple-system, SF Pro Text, sans-serif
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter, -apple-system, SF Pro Text, sans-serif
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter, -apple-system, SF Pro Text, sans-serif
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.5rem
  DEFAULT: 0.75rem
  md: 1rem
  lg: 1.5rem
  xl: 2rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

# Design System: CasalPay

## 1. Visual Theme & Atmosphere
CasalPay é um aplicativo mobile-first (PWA) de finanças compartilhadas e gestão de faturas exclusivo para casais. Sua identidade visual é construída sobre um tema escuro profundo (OLED Dark Mode) refinado, acolhedor e altamente legível sob qualquer condição de luz. O design substitui a frieza dos bancos tradicionais por uma experiência emocional, cúmplice e elegante.

A atmosfera visual combina o preto profundo (`#0D0D14`) com cards em camadas translúcidas e foscas (`#16161F` e `#1E1E2C`), realçados por toques de cor personalizados: Rosa Suave (`#E879A0`) para ela (Zara), Azul Elétrico suave (`#7B8FFF`) para ele (Arthur), Verde Menta (`#4ADE80`) para liquidações e saldo positivo, e Âmbar Quente (`#FBBF24`) para compras recebidas do Apple Pay. Elementos arredondados generosos (`rounded-3xl`), botões estilo pílula e uma barra de navegação inferior flutuante completam uma interface ergonomicamente projetada para uso com uma só mão em smartphones como iPhone 13 e iPhone 15 Pro Max.

## 2. Color Palette & Roles

### Base & Superfícies (Dark Elevation)
- **Background Principal:** `#0D0D14` — O preto base do aplicativo.
- **Card Superfície:** `#16161F` — Fundo de cards de gastos, métricas e listagens.
- **Superfície Elevada:** `#1E1E2C` — Cards interativos, seletores de abas e modais.
- **Bordas Estruturais:** `#2A2A3E` (padrão) e `#3A3A52` (bordas em destaque).

### Cores de Acento & Identidade do Casal
- **Rosa Casal (Zara / Namorada):** `#E879A0` — Cor primária do app, botão ativo da navegação, identificação da parceira.
- **Azul Acento (Arthur):** `#7B8FFF` — Identificação do parceiro, detalhes de cobrança mútua.
- **Roxo Acento (Faturas Especiais):** `#A855F7` — Faturas pessoais dedicadas.
- **Verde Positivo (Acerto / Pix / Sucesso):** `#4ADE80` — Saldo zerado, confirmações de pagamento e botões de fatura rápida.
- **Âmbar Dourado (Apple Pay / Pendentes):** `#FBBF24` — Alertas de revisão, compras capturadas em tempo real.
- **Vermelho Alerta (Débitos):** `#F87171` — Valores devidos e botões destrutivos.

### Hierarquia de Texto
- **Texto Primário:** `#F0F0F8` — Títulos, saldos em destaque e valores monetários.
- **Texto Secundário:** `#9090B0` — Subtítulos, descrições de despesas e membros.
- **Texto Suave (Muted):** `#5A5A78` — Legendas, datas e textos de rodapé.

## 3. Typography Rules
A tipografia utiliza a fonte nativa **Inter / SF Pro Display**, garantindo renderização ultra nítida em telas Retina do iPhone.
- **Valores e Saldos:** Fonte em negrito (`font-bold`) tabular (`tabular-nums`) para perfeita leitura financeira.
- **Títulos de Seção:** Tamanhos médios (`18px` a `20px`) com peso semibold.
- **Badges e Tags:** Texto reduzido (`10px` a `11px`), em caixa alta ou semibold, dentro de pílulas `rounded-full`.

## 4. Component Stylings

### Bottom Navigation Bar (Barra Inferior)
- Posição fixa no rodapé da tela (`fixed bottom-0 left-0 right-0`), com área segura para o botão Home do iPhone (`safe-bottom`).
- 4 abas simétricas: **Início** (Home), **Adicionar** (+), **Histórico** (Relógio) e **Mensagens** (Coração).
- Indicador deslizante em pílula suave rosa (`#E879A0`) destacando a aba ativa.

### Segmented Controls (Seletores de Abas Superiores)
- Três abas de alternância rápida na Home: **Nossos Gastos**, **Fatura** e **Pendentes** (com contador numérico dinâmico).
- Fundo em container arredondado com efeito de pílula deslizante animada.

### Cards de Despesa & Transação
- Fundo `#16161F` com borda sutil `#2A2A3E`, cantos arredondados de `24px` (`rounded-3xl`).
- Avatar circular com a inicial do membro responsável (`Arthur` ou `Zara`).
- Valor monetário alinhado à direita com destaque visual de cor conforme o pagador.

### Caixa de Entrada / Apple Pay
- Card especial com borda lateral âmbar/dourada (`border-l-4 border-l-amber-400`).
- Botão rápido de um clique *"⚡ Confirmar Fatura"* em verde translúcido e botão *"✏️ Revisar"* em rosa translúcido.

### Bottom Sheet (Gaveta Deslizante)
- Superfície que desliza a partir do rodapé com fundo escuro e desfoque de vidro (`backdrop-blur-xl`).
- Puxador central (drag handle) cinza no topo da gaveta para fechar ao deslizar.

## 5. Layout Principles
- **Mobile First Estrito:** O container principal é restrito à largura ergonômica de celular (`max-w-md mx-auto w-full`).
- **Touch Targets Generosos:** Botões e áreas de toque com no mínimo 44px de altura para facilitar o uso no trânsito ou no dia a dia.
- **Espaçamento e Respiro:** Padding lateral de `16px` (`px-4`) e espaçamento vertical suave entre cards de `12px` (`gap-3`).
