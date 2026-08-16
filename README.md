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

Se o sistema ja estava configurado antes da criacao do painel da equipe,
execute tambem:

`supabase/painel_tv_tarefas.sql`

Para ativar o POP e a Central de Tarefas, execute nesta ordem:

`supabase/evolucao_esteiras_administrativas.sql`

`supabase/gamificacao_devolucao_checklist.sql`

`supabase/pop_esteira_tratativas_2026.sql`

`supabase/motor_operacional_tarefas_2026.sql`

`supabase/central_tarefas_modulos_2026.sql`

`supabase/concluir_tarefa_propria_supervisor.sql`

`supabase/taskmanager_v1_simplificacao.sql`

Essa migração gera IDs no formato `TSK-AAAAMMDD-001` e impede a conclusão
sem devolutiva, nome de arquivo padronizado, link do Google Drive e confirmação
das atualizações no CRM e na Planilha Geral.

O POP reconhece **Tafarel** e **Nicolas** como supervisores. Os demais membros
continuam visualizando somente as tarefas atribuídas ao próprio cadastro e
podem delegar tarefas para outro usuário, responder ou devolver uma demanda
com justificativa registrada. O solicitante é identificado automaticamente.

O motor operacional adiciona a relação **Cliente → Tratativa → Tarefas**, SLAs
por tipo, aceite formal, execução, espera justificada, devolução para
conferência, aprovação/correção humana, notificações e auditoria imutável.
Documentos cumpridos não são enviados como PDF ao Workspace: o arquivo fica no
Drive e o executor informa o link no campo de evidência. Tarefas operacionais
não utilizam pontos.

O último script permite que o supervisor marque como concluídas somente as
tarefas atribuídas ao próprio cadastro, mantendo data e auditoria da conclusão.

A camada TaskManager V1 mantém os estados técnicos para auditoria, mas mostra
ao usuário somente cinco etapas: **Fila**, **Em andamento**, **Pendente /
Bloqueada**, **Validação do supervisor** e **Concluída**. Ela também classifica
cada tarefa em uma das nove fases operacionais e disponibiliza o catálogo T01
a T09 sem apagar tarefas antigas.

As regras determinísticas e o prompt auxiliar da IA ficam separados em:

- `docs/SYSTEM_RULES_OPERACAO_2026.md`
- `docs/AI_SYSTEM_PROMPT_OPERACAO_2026.md`

Depois, no menu **Authentication > Users**, crie três usuários:

- O supervisor com o e-mail `tafarel@platino.com`.
- As duas colaboradoras com os mesmos e-mails cadastrados na tabela
  `funcionarios`.

Cadastre também as duas colaboradoras na tabela `funcionarios`. Exemplo:

```sql
insert into public.funcionarios (nome, email, cargo)
values
  ('NOME DA COLABORADORA 1', 'email1@empresa.com', 'Administrativo'),
  ('NOME DA COLABORADORA 2', 'email2@empresa.com', 'Jurídico')
on conflict (email) do update
set nome = excluded.nome, cargo = excluded.cargo;
```

O script configura as permissões para o supervisor delegar tarefas e enviar
feedbacks profissionais. Cada colaboradora consulta somente as próprias
tarefas, os feedbacks destinados ao seu cadastro e as responsabilidades fixas
do mês. No acesso do supervisor, a área **Tarefas do Mês** permite substituir,
reordenar ou remover a lista mensal de cada colaboradora.

## Documentos PDF padrão

1. Converta o documento oficial para PDF mantendo logotipo e textos fixos.
2. Coloque o arquivo em `public/modelos`.
3. Cadastre os campos e coordenadas em
   `src/config/documentTemplates.js`.

O sistema também aceita PDFs com campos de formulário. Nesse caso, configure
`campoFormulario` em vez das coordenadas.

## Painel da equipe na TV

No acesso do supervisor, abra **Painel da TV** no menu ou use o botão
**Abrir na TV** dentro da gestão de tarefas. O painel exibe tarefas urgentes,
pendentes e as conclusões mais recentes. As alterações chegam em tempo real e
o painel também faz uma sincronização de segurança a cada 15 segundos, sem
precisar recarregar a página.

O supervisor pode editar prioridade, prazo, responsável, status, pontos,
apontamento e a visibilidade de cada tarefa no painel.

Também é possível selecionar **Manual da TV** para registrar atividades que
não pertencem ao fluxo de uma colaboradora. Essas tarefas aceitam responsável
ou setor em texto livre, aparecem somente para o supervisor e não geram
pontuação.

As tarefas podem ser organizadas nas categorias **GOV**, **PROCURAÇÕES**,
**ENC. PROCESSUAL**, **AUDIÊNCIA**, **SEGUROS**, **LAUDO** e
**NOTIFICAÇÃO EXTRAJUDICIAL**. A categoria aparece no painel da TV e pode ser
usada como filtro na gestão do supervisor.

O modelo original da procuração está arquivado em:

`modelos-originais/procuracao-dra-juliane.docx`

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
