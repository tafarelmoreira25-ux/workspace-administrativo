-- Escopo de feedbacks para o gestor do sistema e o supervisor do Jurídico.
-- Tafarel consulta e registra feedbacks de todas as equipes.
-- Nicolas consulta e registra somente feedbacks da Equipe Jurídico.
-- Script idempotente: pode ser executado novamente com segurança.
-- Execute depois de configurar_sistema.sql (a tabela feedbacks deve existir).

begin;

create or replace function public.usuario_e_gestor_sistema()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', ''))) in (
    'tafarel@platino.com',
    'tafa@adm.com'
  );
$$;

create or replace function public.usuario_e_supervisor_juridico()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'nicolas@platino.com'
    and exists (
      select 1
      from public.funcionarios f
      where lower(trim(f.email)) = 'nicolas@platino.com'
        and f.ativo is not false
        and (
          lower(coalesce(f.setor, '')) like '%jurid%'
          or lower(coalesce(f.cargo, '')) like '%supervisor%'
        )
    );
$$;

create or replace function public.funcionario_e_da_equipe_juridica(
  p_funcionaria_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.funcionarios f
    where f.id = p_funcionaria_id
      and (
        lower(coalesce(f.setor, '')) like '%jurid%'
        or lower(coalesce(f.cargo, '')) like '%jurid%'
        or lower(trim(coalesce(f.email, ''))) in (
          'nicolas@platino.com',
          'tabata@platino.com',
          'elaine@platino.com',
          'janaina@platino.com',
          'giullian@platino.com'
        )
      )
  );
$$;

create or replace function public.feedback_pertence_ao_usuario(
  p_funcionaria_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.funcionarios f
    where f.id = p_funcionaria_id
      and lower(trim(f.email)) =
        lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

revoke all on function public.usuario_e_gestor_sistema() from public;
revoke all on function public.usuario_e_supervisor_juridico() from public;
revoke all on function public.funcionario_e_da_equipe_juridica(bigint) from public;
revoke all on function public.feedback_pertence_ao_usuario(bigint) from public;
grant execute on function public.usuario_e_gestor_sistema() to authenticated;
grant execute on function public.usuario_e_supervisor_juridico() to authenticated;
grant execute on function public.funcionario_e_da_equipe_juridica(bigint) to authenticated;
grant execute on function public.feedback_pertence_ao_usuario(bigint) to authenticated;

alter table public.feedbacks enable row level security;

drop policy if exists "Equipe consulta feedbacks permitidos" on public.feedbacks;
drop policy if exists "Funcionaria consulta feedbacks recebidos" on public.feedbacks;
create policy "Funcionaria consulta feedbacks recebidos"
on public.feedbacks for select to authenticated
using (
  public.usuario_e_gestor_sistema()
  or public.feedback_pertence_ao_usuario(funcionaria_id)
  or (
    public.usuario_e_supervisor_juridico()
    and public.funcionario_e_da_equipe_juridica(funcionaria_id)
  )
);

drop policy if exists "Supervisor registra feedbacks" on public.feedbacks;
create policy "Supervisor registra feedbacks"
on public.feedbacks for insert to authenticated
with check (
  public.usuario_e_gestor_sistema()
  or (
    public.usuario_e_supervisor_juridico()
    and public.funcionario_e_da_equipe_juridica(funcionaria_id)
  )
);

commit;

notify pgrst, 'reload schema';

select
  public.usuario_e_gestor_sistema() as gestor_sistema,
  public.usuario_e_supervisor_juridico() as supervisor_juridico;
