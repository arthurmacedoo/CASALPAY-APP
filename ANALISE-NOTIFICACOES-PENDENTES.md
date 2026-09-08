# Notificações de despesas pendentes

## Implementação

A aplicação agora possui dois avisos relacionados ao fluxo Apple Pay:

| Momento | Mensagem | Destinatário | Ação ao tocar |
|---|---|---|---|
| Após o webhook ou sincronização offline salvar uma compra | **✅ Sua despesa foi registrada** — a compra foi registrada em Pendentes e aguarda confirmação | O usuário indicado por `deviceUser` (`Arthur` ou `Zara`); se o nome não for reconhecido, o grupo recebe o aviso como fallback | Abre diretamente `/?view=pending` |
| Todos os dias às 23h no fuso do usuário | **🟢 Pendências aguardando revisão** — informa a quantidade restante | Todos os dispositivos registrados no grupo que possui pendências | Abre diretamente `/?view=pending` |

O backend usa payload **data-only** e um único service worker exibe a notificação em segundo plano. Isso evita que o Firebase e o service worker mostrem duas notificações para o mesmo evento. No aplicativo aberto, o aviso aparece como um toast verde com o selo `✅`.

O selo visual usado em background está em `public/pending-badge.svg`. O clique da notificação também foi conectado à aba **Pendentes**, sem depender da aba que estava aberta anteriormente.

## Lembrete diário

O cron consulta `groups/*/transactions` usando `status == "pending"`. Se não houver pendências, ele encerra sem enviar mensagem. Se houver pendências, agrupa por grupo e envia uma única notificação consolidada por grupo. Tokens inválidos são removidos durante o envio; se não houver token registrado, o resultado fica marcado como `no_tokens`.

O cron foi configurado para `0 3 * * *`. A Vercel interpreta Cron Jobs em UTC, portanto esse horário corresponde a 23h no fuso UTC-4 considerado nesta sessão.[1]

## Requisitos para receber

A pessoa precisa abrir o aplicativo em um navegador compatível, conceder permissão de notificações, instalar/registrar o dispositivo quando aplicável e manter o token FCM registrado no grupo. No caso da compra Apple Pay, o atalho deve continuar enviando `deviceUser: "Zara"` para que o aviso seja direcionado aos dispositivos registrados para Zara.

A entrega imediata é best-effort: a despesa é salva mesmo se o FCM estiver indisponível. O endpoint registra no log a quantidade de tokens encontrados e de envios aceitos.

## Validação realizada

O frontend compilou com `npm run build`. O lint terminou sem erros, mantendo quatro avisos preexistentes em contextos/hooks. As funções serverless passaram por typecheck isolado com TypeScript. O teste autenticado de envio real não foi executado nesta sessão porque o clone não possui `.env*`, credenciais de Firebase ou sessão autenticada.

## Teste manual recomendado

Abra o CasalPay no dispositivo da Zara, autorize notificações e confirme que o dispositivo aparece registrado. Depois envie uma compra de teste pelo webhook com `deviceUser: "Zara"`. A compra deve aparecer em **Pendentes**, e o dispositivo deve exibir **Sua despesa foi registrada** com o selo verde. Com o aplicativo aberto, o mesmo evento deve aparecer como toast verde, sem duplicação.

Para validar o lembrete, crie uma pendência e execute o endpoint de cron com o `CRON_SECRET` configurado no ambiente. Não é necessário esperar o horário agendado para esse teste. Sem pendências, o endpoint deve retornar sem enviar notificações; com pendências, deve informar a quantidade por grupo.

## Referência

[1]: https://vercel.com/docs/cron-jobs — documentação oficial da Vercel, que informa que o fuso horário dos Cron Jobs é sempre UTC.
