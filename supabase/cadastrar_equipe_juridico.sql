-- Perfis internos do sistema: os endereços abaixo servem apenas para login
-- e identificação no Workspace Administrativo. Não são caixas de e-mail.
-- Execute no SQL Editor do Supabase após configurar o sistema.

alter table public.funcionarios
  add column if not exists perfil text not null default 'colaborador';

with equipe(nome, email, cargo, perfil, foto_url, permissoes, observacao_interna) as (
  values
    ('Nicolas', 'nicolas@platino.com', 'Supervisor', 'supervisor', '/assets/equipe/nicolas-oficial.png', '{"tarefas":true,"delegar":true,"acompanhar_equipe":true,"clientes":true,"planner":true,"documentos":true,"gestao_equipe":true}'::jsonb, 'Supervisor da Equipe Jurídico.'),
    ('Tabata', 'tabata@platino.com', 'Consultora jurídica', 'colaborador', '/assets/equipe/tabata-oficial.png', '{"tarefas":true,"delegar":true,"acompanhar_equipe":true,"clientes":true,"planner":true,"documentos":true}'::jsonb, 'Consultora jurídica da Equipe Jurídico.'),
    ('Elaine', 'elaine@platino.com', 'Consultora jurídica', 'colaborador', '/assets/equipe/elaine-oficial.png', '{"tarefas":true,"delegar":true,"acompanhar_equipe":true,"clientes":true,"planner":true,"documentos":true}'::jsonb, 'Consultora jurídica da Equipe Jurídico.'),
    ('Janaina', 'janaina@platino.com', 'Consultora jurídica', 'colaborador', '/assets/equipe/janaina-oficial.png', '{"tarefas":true,"delegar":true,"acompanhar_equipe":true,"clientes":true,"planner":true,"documentos":true}'::jsonb, 'Consultora jurídica da Equipe Jurídico.'),
    ('Giullian', 'giullian@platino.com', 'Hunter', 'colaborador', '/assets/equipe/giullian-oficial.png', '{"tarefas":true,"delegar":true,"acompanhar_equipe":true,"clientes":true,"planner":true,"documentos":true,"carteira_hunter":true}'::jsonb, 'Hunter da Equipe Jurídico. Localiza clientes potenciais e encaminha perfis aos consultores.')
), atualizados as (
  update public.funcionarios f
  set nome = e.nome,
      cargo = e.cargo,
      setor = 'Jurídico',
      perfil = e.perfil,
      ativo = true,
      permissoes = e.permissoes,
      foto_url = coalesce(e.foto_url, f.foto_url),
      observacao_interna = e.observacao_interna,
      updated_at = now()
  from equipe e
  where lower(trim(f.email)) = e.email
  returning f.id
)
insert into public.funcionarios (
  nome, email, cargo, setor, perfil, ativo, permissoes, pontos, foto_url,
  observacao_interna, updated_at
)
select
  e.nome,
  e.email,
  e.cargo,
  'Jurídico',
  e.perfil,
  true,
  e.permissoes,
  0,
  e.foto_url,
  e.observacao_interna,
  now()
from equipe e
where not exists (
  select 1
  from public.funcionarios f
  where lower(trim(f.email)) = e.email
);
