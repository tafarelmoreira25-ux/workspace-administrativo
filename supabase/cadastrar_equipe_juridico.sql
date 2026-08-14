-- Perfis internos do sistema: os endereços abaixo servem apenas para login
-- e identificação no Workspace Administrativo. Não são caixas de e-mail.
-- Execute no SQL Editor do Supabase após configurar o sistema.

with equipe(nome, email, cargo, observacao_interna) as (
  values
    ('Nicolas', 'nicolas@platino.com', 'Supervisor', 'Supervisor da equipe Jurídico.'),
    ('Tabata', 'tabata@platino.com', 'Consultora', 'Consultora da equipe Jurídico.'),
    ('Elaine', 'elaine@platino.com', 'Consultora', 'Consultora da equipe Jurídico.'),
    ('Janaina', 'janaina@platino.com', 'Consultora', 'Consultora da equipe Jurídico.'),
    ('Giullian', 'giullian@platino.com', 'Hunter', 'Hunter da equipe Jurídico.')
), atualizados as (
  update public.funcionarios f
  set nome = e.nome,
      cargo = e.cargo,
      setor = 'Jurídico',
      ativo = true,
      permissoes = '{"tarefas": true, "planner": true, "documentos": true}'::jsonb,
      observacao_interna = e.observacao_interna,
      updated_at = now()
  from equipe e
  where lower(trim(f.email)) = e.email
  returning f.id
)
insert into public.funcionarios (
  nome, email, cargo, setor, ativo, permissoes, pontos,
  observacao_interna, updated_at
)
select
  e.nome,
  e.email,
  e.cargo,
  'Jurídico',
  true,
  '{"tarefas": true, "planner": true, cumentos": true}'::jsonb,
  0,
  e.observacao_interna,
  now()
from equipe e
where not exists (
  select 1
  from public.funcionarios f
  where lower(trim(f.email)) = e.email
);
