-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Ele permite que cada funcionária autenticada atualize somente as tarefas
-- vinculadas ao cadastro dela pelo e-mail.

create or replace function public.funcionario_id_autenticado()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id::bigint
  from public.funcionarios
  where lower(email) = lower(auth.jwt() ->> 'email')
  limit 1;
$$;

revoke all on function public.funcionario_id_autenticado() from public;
grant execute on function public.funcionario_id_autenticado() to authenticated;

alter table public.tarefas enable row level security;
grant update (status) on public.tarefas to authenticated;

drop policy if exists "Funcionarias concluem as proprias tarefas" on public.tarefas;

create policy "Funcionarias concluem as proprias tarefas"
on public.tarefas
for update
to authenticated
using (
  funcionaria_id::bigint = public.funcionario_id_autenticado()
  or lower(auth.jwt() ->> 'email') = 'tafarel@platino.com'
)
with check (
  funcionaria_id::bigint = public.funcionario_id_autenticado()
  or lower(auth.jwt() ->> 'email') = 'tafarel@platino.com'
);

notify pgrst, 'reload schema';
