---
name: release-versioning
description: Protocolo obrigatório de versionamento semântico, atualização de changelog e controle de release para o CasalPay. Sempre que preparar um commit ou atualização, analisa a versão atual, aplica o incremento SemVer correto, sincroniza os arquivos de versão e garante visibilidade na UI.
when_to_use: "Sempre que preparar uma nova atualização, commit ou release no projeto CasalPay, ou quando o usuário solicitar subir uma nova versão ou perguntar sobre a versão do app."
allowed-tools: Read, Bash, Write, Edit, Grep
effort: medium
---

# 🚀 Protocolo de Versionamento e Release — CasalPay

Este protocolo é **obrigatório** em qualquer ciclo de atualização ou entrega de código para garantir que versões nunca fiquem defasadas, que o usuário saiba exatamente qual versão está rodando em seus dispositivos (como no iPhone da namorada ou no seu), e que haja rastreabilidade completa do que mudou.

---

## 📌 Checklist do Protocolo (Passo a Passo)

Sempre que concluir um conjunto de melhorias ou correções antes de commitar/subir para o Git:

```
[ ] 1. Identificar a versão atual em package.json e src/constants/version.ts
[ ] 2. Determinar o incremento SemVer adequado (PATCH, MINOR ou MAJOR)
[ ] 3. Atualizar package.json ("version": "X.Y.Z")
[ ] 4. Atualizar src/constants/version.ts (APP_VERSION, APP_BUILD, APP_RELEASE_NAME, APP_RELEASE_DATE)
[ ] 5. Registrar detalhadamente as melhorias e correções no CHANGELOG.md
[ ] 6. Verificar se a versão está visível na UI (Home e Configurações) para testes em celular
[ ] 7. Executar `npm run build` para garantir zero erros de compilação
[ ] 8. Commitar com mensagem semântica incluindo [vX.Y.Z] e realizar push para origin/main
```

---

## 🏷️ 1. Critérios de Incremento SemVer

| Tipo | Formato | Quando Aplicar | Exemplos no CasalPay |
|---|---|---|---|
| **PATCH** | `x.y.Z` (ex: `1.2.0` → `1.2.1`) | Correções de bugs, ajustes de CSS/layout, sanitização de dados, hotfixes. | Correção de redirecionamento do botão de fatura, correção de formato de data de webhook. |
| **MINOR** | `x.Y.0` (ex: `1.2.1` → `1.3.0`) | Novas funcionalidades completas, novas telas, novas integrações sem quebrar compatibilidade. | Adição de suporte a novo banco, nova tela de metas de casal, novo método de rateio. |
| **MAJOR** | `X.0.0` (ex: `1.3.0` → `2.0.0`) | Reformulação visual total, migração de banco de dados, quebra de contratos de API. | Migração completa de arquitetura ou redesign integral do produto. |

---

## 📂 2. Arquivos Obrigatórios de Sincronização

### A. `package.json`
Atualizar o campo `"version"`:
```json
{
  "name": "casalpay",
  "version": "1.2.1"
}
```

### B. `src/constants/version.ts`
Manter as 4 constantes atualizadas:
```ts
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "1.2.1";
export const APP_BUILD = import.meta.env.VITE_APP_BUILD ?? "bfb574b"; // Hash curto do git ou timestamp
export const APP_RELEASE_NAME = "Hotfix Fatura Pendente & Apple Pay";
export const APP_RELEASE_DATE = "24/09/2026";
```

### C. `CHANGELOG.md`
Adicionar uma nova seção no topo seguindo o formato:
```markdown
## [X.Y.Z] - AAAA-MM-DD
### 🎯 Nome da Release
- **🐛 Correções**: Descrição clara do que foi consertado.
- **🚀 Funcionalidades / Melhorias**: O que foi adicionado ou otimizado.
- **📱 Experiência Mobile / UI**: Mudanças na visualização para os usuários no iPhone/Android.
```

---

## 📱 3. Visibilidade da Versão no Dispositivo

Para permitir que o usuário verifique no celular (ex: Safari PWA no iPhone) se a versão foi realmente atualizada após o deploy:

1. **Rodapé da Home (`src/pages/Home.tsx`)**:
   Badge discreto com ponto verde pulsante:
   `🟢 v1.2.1 · [Nome da Release]`
2. **Painel de Configurações (`src/components/GroupSettingsSheet.tsx`)**:
   Exibição completa no rodapé da folha de configurações:
   `CasalPay v1.2.1 (build)`
   `Data e nome da release`

---

## 🧪 4. Validação e Entrega

1. **Compilação**:
   ```bash
   npm run build
   ```
2. **Git Commit**:
   ```bash
   git add .
   git commit -m "feat/fix: descrição da mudança [v1.2.1]"
   git push origin main
   ```
3. **Comunicação com o Usuário**:
   Sempre informar:
   - O novo número da versão (`vX.Y.Z`).
   - O resumo das melhorias incluídas.
   - Onde conferir no celular para confirmar a atualização.
