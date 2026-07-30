-- Perfis internos do sistema: os endereços abaixo servem apenas para login
-- e identificação no Workspace Administrativo. Não são caixas de e-mail.
-- Execute no SQL Editor do Supabase após configurar o sistema.

insert into public.funcionarios (
  nome,
  email,
  cargo,
  setor,
  ativo,
  permissoes,
  pontos,
  observacao_interna,
  updated_at
)
values
  ('Nicolas', 'nicolas@platino.com', 'Supervisor', 'Jurídico', true,
   '{"tarefas": true, "planner": true, "documentos": true}'::jsonb, 0,
   'Supervisor da equipe Jurídico.', now()),
  ('Tabata', 'tabata@platino.com', 'Consultora', 'Jurídico', true,
   '{"tarefas": true, "planner": true, "documentos": true}'::jsonb, 0,
   'Consultora da equipe Jurídico.', now()),
  ('Elaine', 'elaine@platino.com', 'Consultora', 'Jurídico', true,
   '{"tarefas": true, "planner": true, "documentos": true}'::jsonb, 0,
   'Consultora da equipe Jurídico.', now()),
  ('Janaina', 'janaina@platino.com', 'Consultora', 'Jurídico', true,
   '{"tarefas": true, "planner": true, "documentos": true}'::jsonb, 0,
   'Consultora da equipe Jurídico.', now()),
  ('Giullian', 'giullian@platino.com', 'Hunter', 'Jurídico', true,
   '{"tarefas": true, "planner": true, "documentos": true}'::jsonb, 0,
   'Hunter da equipe Jurídico.', now())
on conflict (email) do update
set nome = excluded.nome,
    cargo = excluded.cargo,
    setor = excluded.setor,
    ativo = true,
    permissoes = excluded.permissoes,
    observacao_interna = excluded.observacao_interna,
    updated_at = now();

