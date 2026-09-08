# Workspace Administrativo Platino

## Como abrir o sistema

Este projeto usa React com Vite. A extensÃ£o **Go Live / Live Server** nÃ£o
processa JSX e nÃ£o deve ser usada para abrir o cÃ³digo-fonte.

No terminal, dentro da pasta interna `tafa-performance`, execute:

```bash
npm install
npm start
```

Crie o arquivo local de configuraÃ§Ã£o sem versionÃ¡-lo:

```bash
Copy-Item .env.example .env.local
```

Preencha em `.env.local` a URL e a chave pÃºblica `anon` do seu projeto
Supabase. Nunca use a chave `service_role` no frontend.

Abra o endereÃ§o exibido pelo terminal, normalmente `http://localhost:5173`.

Para testar a versÃ£o final:

```bash
npm run check
npm run preview
```

O comando `npm run check` executa lint, testes automatizados e build.

## Importação da carteira processual histórica

A importação é executada no backend em lotes de 25 registros, com upsert,
checkpoint e relatório. Ela não consulta tribunais nem depende do navegador.

1. Execute `supabase/processos_protocolados_historicos_2026.sql` no banco.
2. Defina `SUPABASE_SERVICE_ROLE_KEY` apenas no `.env` local do ambiente de
   importação. Essa chave nunca deve ser publicada ou exposta ao Vite.
3. Valide a fonte com `npm run import:processos:dry-run`.
4. Execute `npm run import:processos`.

O snapshot integral da fonte fica em
`data/processos-protocolados-fonte.json`. O progresso e o relatório são
gravados em `.tmp/importacao-processos-checkpoint.json` e
`.tmp/importacao-processos-relatorio.json`.

## Configuração do Supabase

### RecuperaÃ§Ã£o de senha

No painel do Supabase, abra **Authentication â†’ URL Configuration** e configure:

- **Site URL**: a URL principal publicada na Vercel.
- **Redirect URLs**: a URL principal da Vercel, as URLs de preview que pretende
  testar e `http://localhost:5173` para desenvolvimento local.

Sem essas URLs autorizadas, o e-mail pode ser enviado, mas o link de
recuperaÃ§Ã£o nÃ£o conseguirÃ¡ retornar ao sistema.

Execute uma vez no SQL Editor do Supabase:

`supabase/configurar_sistema.sql`

Execute tambÃ©m `supabase/documentos_juridicos_workspace.sql` para o gerador de documentos.

Execute `supabase/esteira_processual_platino.sql` para habilitar a nova Esteira Processual PLATINO, depois de concluir a limpeza das tabelas antigas de processos.

## Recursos disponÃ­veis

Login e recuperaÃ§Ã£o de senha, inÃ­cio, documentos PDF, Esteira Processual PLATINO, treinamentos, planner pessoal e consulta de feedbacks.

Os scripts SQL configuram a base atual. Alterar os arquivos locais nÃ£o altera um banco Supabase jÃ¡ publicado.

## SeguranÃ§a

Os arquivos `.env` e `.env.local` nÃ£o devem ser enviados ao Git. O projeto
contÃ©m um `.env.example` apenas com os nomes das configuraÃ§Ãµes necessÃ¡rias.

## PublicaÃ§Ã£o na Vercel

Como o repositÃ³rio possui uma pasta externa e outra interna com o mesmo nome,
configure **Root Directory** como `tafa-performance`, apontando para a pasta que
contÃ©m este `package.json`.

Use as seguintes configuraÃ§Ãµes:

- Framework Preset: **Vite**.
- Build Command: `npm run build`.
- Output Directory: `dist`.

Cadastre em **Settings â†’ Environment Variables**, para Production, Preview e
Development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_EMAIL`

Todas as variÃ¡veis iniciadas por `VITE_` sÃ£o incluÃ­das no bundle do navegador.
Por isso, `VITE_SUPABASE_ANON_KEY` deve conter somente a chave pÃºblica `anon`;
nunca use `service_role`.
