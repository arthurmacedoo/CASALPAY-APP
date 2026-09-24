# Instruções do Projeto CasalPay

## 📌 Regra Obrigatória: Atualização de Patch, Changelog e Commit

Esta regra é **exclusiva deste projeto** e deve ser seguida sempre que concluirmos uma nova rodada de alterações, correções de bugs ou melhorias:

### 1. Atualizar o Patch da Versão (ex: 1.2.1 → 1.2.2)
- Incrementar a versão no `package.json` (`"version": "1.2.x"`).
- Atualizar `src/constants/version.ts` com a nova versão (`APP_VERSION`), data atualizada e nome do release.
- Registrar a versão e a lista do que mudou no `CHANGELOG.md`.

### 2. Mensagem do Commit com a Lista de Atualizações
- O commit deve obrigatoriamente informar o novo patch e listar claramente o que foi feito.
- Exemplo:
  ```
  release(v1.2.2): Correções de interface e faturas pendentes

  - Correção no botão confirmar fatura para manter na aba pendentes
  - Sanitização de datas corrompidas do atalho iOS
  - Exibição da versão ativa no rodapé da Home e Configurações
  ```

### 3. Exibir Sempre no Final da Resposta para o Usuário
No final de cada interação em que houver commit/atualização, apresentar explicitamente:
1. **Nova versão do app**: de `vX.Y.A` para `vX.Y.B` (patch).
2. **Resumo das melhorias e correções feitas**.
3. **Confirmação do commit e envio ao GitHub**.
