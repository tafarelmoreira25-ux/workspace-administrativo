# Consulta DataJud

O numero CNJ determina o tribunal consultado. Descricoes livres do cadastro,
como `TJMG - Justiça de Primeira Instância` e `TJSP - 12`, nao podem ser
usadas diretamente no endpoint. Os codigos estaduais 03/04 correspondem a
AP/AM e 11/13 a MT/MG. A funcao anterior tinha esses pares invertidos.

A consulta tem duas tentativas de no maximo 12 segundos em caso de erro de
rede, timeout, HTTP 429 ou HTTP 5xx. Recusa de chave e endpoint inexistente
nao sao repetidos. O frontend mostra a mensagem especifica da Edge Function.

## Publicacao

Na raiz do projeto, com uma sessao Supabase autenticada:

```powershell
npx supabase login
npx supabase functions deploy processual-datajud-sync --project-ref ledjqodwccotuxdrkjgk --use-api
```

Publique tambem o frontend pelo fluxo habitual do projeto. Atualizar somente
o frontend nao aplica a correcao de roteamento: ela fica na Edge Function.

`DATAJUD_API_KEY` e opcional e deve ser configurada somente nos segredos da
Edge Function se o CNJ substituir a chave publica. Nunca use prefixo `VITE_`.

## Verificacao

Execute `npm run check`, que inclui as regressoes de DataJud. Depois da
publicacao, consulte um processo com numero CNJ valido no sistema e confirme
o tribunal retornado, as movimentacoes e a ausencia de duplicacao em uma
segunda consulta.

Em 04/10/2026 a leitura do Supabase funcionou e confirmou descricoes de
tribunal incompatíveis com o roteamento anterior. A consulta direta ao CNJ
expirou apos 25 segundos neste ambiente. Isso nao comprova indisponibilidade
global. A publicacao e a consulta ponta a ponta continuam pendentes de uma
sessao autenticada para administrar as Edge Functions; a chave de servico
do banco nao substitui essa autenticacao.

Referencias oficiais:

- [Numeracao unica CNJ](https://www.cnj.jus.br/programas-e-acoes/numeracao-unica/)
- [Endpoints DataJud](https://datajud-wiki.cnj.jus.br/api-publica/endpoints/)
- [Publicacao de Edge Functions](https://supabase.com/docs/guides/functions/deploy)
