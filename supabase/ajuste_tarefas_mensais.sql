-- AJUSTE PARA TAREFAS FIXAS MENSAIS
-- Execute todo este arquivo no SQL Editor do Supabase.

begin;

create or replace function public.usuario_e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    = 'tafarel@platino.com';
$$;

revoke all on function public.usuario_e_admin() from public;
grant execute on function public.usuario_e_admin() to authenticated;

create or replace function public.funcionario_id_autenticado()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id::bigint
  from public.funcionarios
  where lower(trim(email)) =
    lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  limit 1;
$$;

revoke all on function public.funcionario_id_autenticado() from public;
grant execute on function public.funcionario_id_autenticado() to authenticated;

-- Remove somente validacoes antigas que limitam os valores da coluna status.
do $$
declare
  restricao record;
begin
  for restricao in
    select conname
    from pg_constraint
    where conrelid = 'public.tarefas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format(
      'alter table public.tarefas drop constraint %I',
      restricao.conname
    );
  end loop;
end;
$$;

alter table public.tarefas
  add constraint tarefas_status_check
  check (
    status in ('pendente', 'concluida', 'responsabilidade_mensal')
  );

create index if not exists tarefas_responsabilidades_mensais_idx
on public.tarefas (funcionaria_id, data_limite, id)
where status = 'responsabilidade_mensal';

alter table public.tarefas enable row level security;

revoke all on public.tarefas from anon;
grant select, insert, delete on public.tarefas to authenticated;
grant update (status) on public.tarefas to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "Equipe consulta tarefas permitidas"
on public.tarefas;
create policy "Equipe consulta tarefas permitidas"
on public.tarefas for select to authenticated
using (
  public.usuario_e_admin()
  or funcionaria_id = public.funcionario_id_autenticado()
);

drop policy if exists "Supervisor delega tarefas"
on public.tarefas;
create policy "Supervisor delega tarefas"
on public.tarefas for insert to authenticated
with check (public.usuario_e_admin());

drop policy if exists "Supervisor exclui tarefas"
on public.tarefas;
create policy "Supervisor exclui tarefas"
on public.tarefas for delete to authenticated
using (public.usuario_e_admin());

notify pgrst, 'reload schema';

commit;

-- Confirmacao: deve retornar true quando executado pelo sistema com a conta
-- tafarel@platino.com.
select
  'Ajuste aplicado. Saia e entre novamente no sistema.' as resultado;
