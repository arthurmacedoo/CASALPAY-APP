# Análise — Pendentes não entram na fatura após confirmação

## Resumo executivo

O projeto foi clonado em `C:\Users\TOTEM\Desktop\PROJETOS\CASALPAY-APP`, na branch local `fix/confirm-pending-invoice`. A falha foi reproduzida de forma determinística no fluxo de dados e a correção foi aplicada em quatro arquivos.

O problema não era uma falha de autenticação do Firestore. Havia uma combinação de inconsistências no modelo da transação: o webhook gravava o `groupId` do casal em um campo reservado para o agrupamento de parcelas, e a compra pendente chegava sem `personalOwnerUserId`. Na confirmação, o frontend podia tratar a despesa como parcelada e, quando o dono da fatura não era gravado, o filtro da aba pessoal não a exibia.

## Causa identificada

### 1. `groupId` do grupo era confundido com grupo de parcelas

O endpoint Apple Pay gravava o identificador do grupo no campo `groupId`. No frontend, qualquer despesa com `groupId` truthy era considerada uma parcela antiga. Assim, uma compra simples vinda do webhook entrava no caminho que apagava o documento original e recriava a transação em lote.

Esse comportamento era destrutivo e podia trocar o ID do documento, perder metadados do webhook e deixar o item fora da lista esperada durante a atualização. O código agora só considera uma transação como parcelada quando ela tem `groupId` **e** `installmentCount > 1`.[1] [2]

### 2. A compra pendente não tinha dono explícito da fatura

O webhook cria corretamente a compra como `visibility: "personal"`, mas usa `personalOwnerUserId: null`, pois o endpoint não conhece o UID do usuário autenticado no aplicativo. Antes da correção, o formulário preservava esse `null`; portanto, a despesa dependia de uma seleção manual adicional para ser indexada na fatura.

Agora, ao abrir uma compra pendente, o usuário autenticado assume o dono da fatura por padrão. A pessoa ainda pode escolher o outro membro antes de confirmar. Dessa forma, o botão de confirmação não conclui uma despesa pessoal sem proprietário.[3]

### 3. Documentos antigos sem dono explícito podiam continuar invisíveis

A aba pessoal filtra por `personalOwnerUserId === currentMember.userId`. Foi adicionado um fallback somente para documentos pessoais antigos sem esse campo: quando `paidByUserId` coincide com o membro atual, a compra volta a ser exibida. Quando `personalOwnerUserId` existe, ele continua sendo a fonte de verdade; portanto, o fallback não altera despesas atribuídas explicitamente ao outro membro.[4]

## Alterações aplicadas

| Arquivo | Alteração |
|---|---|
| `api/webhook-apple-pay.ts` | Substituição de `groupId` por `coupleId` no documento da compra pendente e também no fallback. O campo `groupId` fica reservado ao grupo de parcelas. |
| `src/hooks/useTransactions.ts` | Detecção de parcelas exige `groupId` e `installmentCount > 1`; confirmações simples atualizam o documento original e removem eventual `groupId` inválido com `deleteField()`. |
| `src/pages/AddExpense.tsx` | Ao revisar uma pendência, o dono da fatura é preenchido por padrão com o usuário autenticado ou com o pagador já conhecido. |
| `src/lib/transactionVisibility.ts` | Fallback de compatibilidade para despesas pessoais antigas sem `personalOwnerUserId`, usando `paidByUserId`. |

## Reprodução determinística

Antes da alteração, o caso equivalente a uma compra pendente criada pelo webhook produzia estes resultados:

```json
{
  "wasInstallment": true,
  "willBeInstallment": false,
  "invoiceVisibleWithoutOwner": false
}
```

Isso confirma que o `groupId` do casal era interpretado como parcelamento e que uma transação pessoal sem proprietário não satisfazia o filtro da fatura.

Depois da alteração, o mesmo cenário passou a produzir:

```json
{
  "treatedAsInstallment": false,
  "defaultInvoiceOwner": "zara-uid",
  "invoiceVisibleAfterConfirmation": true,
  "legacyInvoiceRecovered": true,
  "status": "confirmed"
}
```

O teste temporário usado nessa reprodução foi removido do repositório após a validação.

## Validações executadas

| Validação | Resultado |
|---|---|
| `npm run build` | Aprovado. TypeScript e Vite compilaram, e o PWA foi gerado. |
| `npm run lint` | Aprovado sem erros. Permanecem quatro avisos preexistentes de Fast Refresh e dependência de Hook. |
| Reprodução determinística pendente → confirmada → fatura | Aprovada. |
| Teste integrado contra Firebase real | Não executado nesta sessão: o clone não possui arquivos `.env*`, não há emulador Firestore configurado e não foi usada sessão autenticada. |

## Como testar no ambiente real

1. Publique a branch com as quatro alterações ou execute o build pelo processo normal de deploy.
2. Envie uma compra de teste para o webhook usando uma data do mês corrente e o segredo já configurado no ambiente. Não coloque o segredo no repositório nem neste relatório.
3. Confirme que a compra aparece em **Pendentes**.
4. Abra **Revisar**. O membro autenticado deve aparecer selecionado como dono da fatura; se necessário, altere para o outro membro.
5. Pressione **Atualizar/Confirmar**. A compra deve sair de **Pendentes** e aparecer em **Minha Fatura** no mesmo mês da data da compra.
6. No Firestore, verifique que o mesmo documento possui `status: "confirmed"`, `visibility: "personal"`, `personalOwnerUserId` com o UID correto, `coupleId` com o ID do grupo e não possui `groupId` usado como marcador de parcela.
7. Para uma compra de mês diferente do atual, consulte o mês correspondente no **Histórico**. A Home consulta o mês corrente por design; isso não significa que uma compra confirmada de outro mês tenha sido perdida.

## Observação de segurança e manutenção

A branch original `main` não foi alterada. As mudanças estão em `fix/confirm-pending-invoice`, com o working tree contendo os quatro arquivos corrigidos, este relatório e o patch `CASALPAY-APP-pending-invoice-fix.patch`. O `npm ci` também reportou vulnerabilidades de dependências já existentes no projeto; elas não foram alteradas porque não fazem parte da causa deste defeito.

## Referências internas

[1]: `api/webhook-apple-pay.ts` — criação de documentos pendentes e fallback do webhook.
[2]: `src/hooks/useTransactions.ts` — detecção de parcelamento e atualização da transação.
[3]: `src/pages/AddExpense.tsx` — inicialização do formulário de revisão e submissão.
[4]: `src/lib/transactionVisibility.ts` — filtro da fatura pessoal.
