# Workspace Administrativo Platino

## Como abrir o sistema

Este projeto usa React com Vite. A extensão **Go Live / Live Server** não
processa JSX e não deve ser usada para abrir o código-fonte.

No terminal, dentro da pasta interna `tafa-performance`, execute:

```bash
npm install
npm start
```

Crie o arquivo local de configuração sem versioná-lo:

```bash
Copy-Item .env.example .env.local
```

Preencha em `.env.local` a URL e a chave pública `anon` do seu projeto
Supabase. Nunca use a chave `service_role` no frontend.

Abra o endereço exibido pelo terminal, normalmente `http://localhost:5173`.

Para testar a versão final:

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

### Recuperação de senha

No painel do Supabase, abra **Authentication → URL Configuration** e configure:

- **Site URL**: a URL principal publicada na Vercel.
- **Redirect URLs**: a URL principal da Vercel, as URLs de preview que pretende
  testar e `http://localhost:5173` para desenvolvimento local.

Sem essas URLs autorizadas, o e-mail pode ser enviado, mas o link de
recuperação não conseguirá retornar ao sistema.

Execute uma vez no SQL Editor do Supabase:

`supabase/configurar_sistema.sql`

Execute também `supabase/documentos_juridicos_workspace.sql` para o gerador de documentos.

Os PDFs são gerados localmente no navegador com `pdf-lib`, a partir de uma
cópia preenchida do DOCX oficial, preservando suas propriedades. A geração
fica bloqueada quando falta o original, há mapeamento pendente ou a
equivalência visual ainda não foi validada. Os geradores antigos foram removidos.
A prévia e
o download usam o mesmo gerador. Essa geração não exige Microsoft 365,
segredos do Microsoft Graph nem publicação de uma função de conversão no Supabase.

Se a exclusão de uma atividade apresentar `permission denied for table processual_tarefas`, execute `supabase/20261002_corrigir_exclusao_tarefas.sql` no SQL Editor, após `configurar_sistema.sql` e `compatibilidade_modulos_processuais_legado.sql`. O script permite excluir tarefas somente a usuários autenticados vinculados à equipe interna e inclui uma consulta para verificar as permissões. Não exclui atividades ao ser aplicado.

Execute `supabase/esteira_processual_platino.sql` para habilitar a nova Esteira Processual PLATINO, depois de concluir a limpeza das tabelas antigas de processos.

## Comunicação por Gmail e revisão com Gemini

Na ficha do cliente, o botão **Preparar e-mail** cria mensagens a partir de
modelos, relaciona opcionalmente um processo, permite copiar o texto e abre a
tela de composição do Gmail. O envio permanece sempre sob confirmação humana.
Quando marcada, a preparação é registrada em `processual_atendimentos` como
rascunho, sem afirmar que a mensagem foi enviada.

O botão **Analisar e-mail/PDF** aceita texto colado e um PDF de até 8 MB. O
Gemini devolve resumo, pedido, dados extraídos, pendências, eventual prazo
mencionado e pontos para conferência. Nada é salvo até o usuário confirmar.

A revisão pelo Gemini é executada exclusivamente na Edge Function
`assistente-juridico`; a chave não é exposta no bundle do navegador. Para
ativá-la, associe o projeto com a CLI do Supabase e execute:

```bash
npx supabase secrets set GEMINI_API_KEY=SUA_CHAVE GEMINI_MODEL=gemini-3.8-flash
npx supabase functions deploy assistente-juridico
```

Use um projeto Gemini com faturamento e tratamento de dados adequado a
informações jurídicas. A resposta da IA é apenas uma sugestão e precisa ser
revisada antes do envio.

## Recursos disponíveis

Login e recuperação de senha, início, documentos PDF, Esteira Processual PLATINO, treinamentos, planner pessoal e consulta de feedbacks.

Os scripts SQL configuram a base atual. Alterar os arquivos locais não altera um banco Supabase já publicado.

## Segurança

Os arquivos `.env` e `.env.local` não devem ser enviados ao Git. O projeto
contém um `.env.example` apenas com os nomes das configurações necessárias.

## Publicação na Vercel

Como o repositório possui uma pasta externa e outra interna com o mesmo nome,
configure **Root Directory** como `tafa-performance`, apontando para a pasta que
contém este `package.json`.

Use as seguintes configurações:

- Framework Preset: **Vite**.
- Build Command: `npm run build`.
- Output Directory: `dist`.

Cadastre em **Settings → Environment Variables**, para Production, Preview e
Development:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ADMIN_EMAIL`

Todas as variáveis iniciadas por `VITE_` são incluídas no bundle do navegador.
Por isso, `VITE_SUPABASE_ANON_KEY` deve conter somente a chave pública `anon`;
nunca use `service_role`.
