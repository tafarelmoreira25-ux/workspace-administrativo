# Sincronização única de Processual

Fonte preservada em `data/sync-processual-fonte.txt`; array em `data/sync-processual-clientes.json`.
O anexo tem 344 registros, não 345: uma linha é continuação. Sete registros não possuem número CNJ com 20 dígitos. Não se valida o dígito verificador CNJ; números são preservados com pontuação normalizada.

1. No SQL Editor do projeto Supabase, execute `supabase/20261004_sync_processual_one_off.sql`. Requer as migrations atuais de clientes, processos e compatibilidade legado já instaladas.
2. No `.env` local, configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A chave deve ser de backend, sem prefixo `VITE_`, e não deve ser commitada.
3. Na raiz do projeto (pasta que contém `package.json`), execute:

```powershell
node scripts/sync-processual.mjs --parse-only
node scripts/sync-processual.mjs --dry-run
node scripts/sync-processual.mjs
```

Se necessário, execute `npm install` antes. Requer Node com `process.loadEnvFile` (Node 22+).

A RPC compara números sem pontuação em `processos`, inclusive registros fora da etapa atual. Existentes são pulados sem atualização. Ausentes reutilizam um cliente com nome exato (ignorando caixa/espaços); vários clientes com esse nome geram erro para revisão. Sem CPF não é possível distinguir homônimos com certeza.

Cliente e processo são criados atomicamente. Escritas são serializadas com bloqueio breve das duas tabelas por registro. O cliente fornece a ficha “Abrir Pasta”; o vínculo é `cliente_id`. Não cria pasta física no Google Drive: a fonte não contém links ou IDs de Drive. Número judicial disponibiliza o registro em Processual, com fase `Protocolo Liberado`, sem inventar status judicial. O script não atualiza processos existentes com os status/observações da fonte.

Registros sem número válido ficam pendentes, não são cadastrados somente pelo nome. Preencha/corrija a fonte e rode novamente. Ao final há totais de criados, pulados, pendentes, erros e previstos. Código de saída 1 indica erros ou pendências. Reexecução pula processos já criados; a diferença 345 − 267 não garante 78 inclusões.

No Processual, Protocolo é o próprio número judicial. A listagem usa `numero_processo` nas duas colunas; o seed marca `protocolo_status` como `Liberado` quando cria o processo. Não exige um protocolo separado nem informa ausência de protocolo quando o número já existe.

Validação local: `node --test scripts/sync-processual.test.mjs`. A aplicação da migration e a execução real no Supabase devem ser feitas no ambiente de destino; os testes locais não validam seu schema remoto.
