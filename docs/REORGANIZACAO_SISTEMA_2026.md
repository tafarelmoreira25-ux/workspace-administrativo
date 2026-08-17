# Reorganização do sistema Platino

## Decisões que passam a ser regra

1. Existem duas equipes operacionais: `Administrativo` e `Jurídico`.
2. `setor` identifica a equipe; `perfil` identifica o poder do usuário.
3. Os perfis são `supervisor` e `colaborador`.
4. As permissões de tela ficam em `funcionarios.permissoes`.
5. A categoria da tarefa possui um responsável padrão, mas o usuário pode trocar por outra pessoa da mesma equipe.
6. O frontend ajuda a escolher; o banco é quem bloqueia combinações inválidas.
7. Tarefas operacionais usam um único fluxo:
   `delegada → recebida → em_execucao → concluida`.
8. Espera, devolução e correção são desvios controlados desse fluxo, nunca alterações diretas de status.

## O que causou os erros

- `App.jsx` concentra login, permissões, equipe, tarefas, notificações e telas em mais de 6 mil linhas.
- Supervisor era inferido pelo nome, cargo e e-mail em lugares diferentes.
- O administrador podia receber o UUID do Auth no lugar do ID numérico de `funcionarios`.
- A sugestão de responsável era carregada por três efeitos concorrentes.
- O responsável sugerido sobrescrevia silenciosamente a escolha manual no momento de salvar.
- O frontend aceitava quatro setores, embora a operação descrita tenha somente duas equipes.
- O SQL antigo tinha e-mail administrativo diferente, políticas não idempotentes e uma restrição de apenas sete categorias.
- Fotos dependiam de e-mails antigos, mesmo quando já existiam imagens por nome ou `foto_url`.

## Primeira etapa implementada

- Regra central de equipes, perfis, permissões e sugestão em `src/lib/teamAccess.js`.
- Testes unitários das regras em `src/lib/teamAccess.test.js`.
- Uma única carga paralela de destinatários e responsáveis no formulário de delegação.
- Alternativas de responsável filtradas pela equipe executora.
- Seleção manual preservada; o responsável padrão não a sobrescreve ao salvar.
- Perfil do login carregado primeiro de `funcionarios`, inclusive para o supervisor.
- Permissões aplicadas à navegação do colaborador.
- Fallback de avatar por nome e tratamento de URL de foto quebrada.
- Biblioteca geral de documentos aberta ao entrar no módulo de PDF.
- SQL de responsáveis refeito de forma idempotente, com RLS e validação da equipe no banco.

## Ordem de publicação no Supabase

Antes de executar, faça backup do banco. Para a base atual, a sequência recomendada é:

1. `motor_operacional_tarefas_2026.sql`
2. `evolucao_gestao_base.sql`
3. `conclusao_direta_tarefas_2026.sql`
4. `responsaveis_por_funcao_2026.sql`

Depois, em **Equipe → Responsáveis por função**, revise as 19 ações e salve o responsável padrão de cada uma.

## Próximas etapas

### Etapa 2 — cadastro e acesso

- Tornar `perfil` editável no cadastro do integrante.
- Mostrar uma matriz simples de permissões por pessoa.
- Validar foto no cadastro e permitir upload, sem depender de URL externa.
- Criar uma tela de auditoria: quem alterou perfil, equipe ou permissão.

### Etapa 3 — execução guiada

- Extrair o fluxo de execução de `App.jsx` para um módulo próprio.
- Exibir uma etapa por vez: aceitar, iniciar, checklist, comprovação e concluir.
- Usar a auditoria de tarefas como linha do tempo única.
- Remover os status legados do frontend após migrar as tarefas antigas.

### Etapa 4 — documentos

- Manter a biblioteca como tela inicial.
- Separar biblioteca, formulário, prévia e histórico em rotas/componentes próprios.
- Definir permissões de modelos por equipe quando necessário.

### Etapa 5 — decomposição do App

- `modules/auth`
- `modules/team`
- `modules/tasks`
- `modules/clients`
- `modules/documents`
- `modules/notifications`

Cada módulo deve possuir componentes, serviço Supabase e testes próprios. O `App.jsx` final deve apenas restaurar a sessão e escolher o layout conforme o perfil.
