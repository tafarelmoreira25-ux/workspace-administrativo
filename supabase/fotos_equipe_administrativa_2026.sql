-- Fotos oficiais e cargos da Equipe Administrativa.
-- Execute no SQL Editor do Supabase depois de evolucao_gestao_base.sql.
-- Script idempotente: pode ser executado novamente sem duplicar perfis.

begin;

with equipe(nome, email, cargo, perfil, foto_url, permissoes) as (
  values
    (
      'Yasmin',
      'yasmin@adm.com',
      'Auxiliar Administrativo',
      'colaborador',
      '/assets/equipe/yasmin-oficial.png',
      '{"tarefas":true,"delegar":true,"acompanhar_equipe":true,"clientes":true,"planner":true,"documentos":true}'::jsonb
    ),
    (
      'Thayla',
      'thayla@adm.com',
      'Auxiliar Administrativo',
      'colaborador',
      '/assets/equipe/thayla-oficial.png',
      '{"tarefas":true,"delegar":true,"acompanhar_equipe":true,"clientes":true,"planner":true,"documentos":true}'::jsonb
    ),
    (
      'Tafa',
      'tafa@adm.com',
      'Supervisor Administrativo',
      'supervisor',
      '/assets/equipe/tafa-oficial.png',
      '{"tarefas":true,"delegar":true,"acompanhar_equipe":true,"clientes":true,"planner":true,"documentos":true,"gestao_equipe":true}'::jsonb
    )
), atualizados as (
  update public.funcionarios f
  set nome = e.nome,
      cargo = e.cargo,
      setor = 'Administrativo',
      perfil = e.perfil,
      ativo = true,
      permissoes = e.permissoes,
      foto_url = e.foto_url,
      updated_at = now()
  from equipe e
  where lower(trim(f.email)) = e.email
  returning f.id
)
insert into public.funcionarios (
  nome, email, cargo, setor, perfil, ativo, permissoes, pontos, foto_url,
  updated_at
)
select
  e.nome,
  e.email,
  e.cargo,
  'Administrativo',
  e.perfil,
  true,
  e.permissoes,
  0,
  e.foto_url,
  now()
from equipe e
where not exists (
  select 1
  from public.funcionarios f
  where lower(trim(f.email)) = e.email
);

-- A conta administrativa principal também recebe a foto e o cargo oficiais.
update public.funcionarios
set cargo = 'Supervisor Administrativo',
    setor = 'Administrativo',
    perfil = 'supervisor',
    foto_url = '/assets/equipe/tafa-oficial.png',
    updated_at = now()
where lower(trim(email)) = 'tafarel@platino.com';

commit;

select id, nome, email, cargo, setor, perfil, ativo, foto_url
from public.funcionarios
where lower(trim(email)) in (
  'yasmin@adm.com',
  'thayla@adm.com',
  'tafa@adm.com',
  'tafarel@platino.com'
)
order by email;
