-- Libera a consulta de todas as tarefas para integrantes autenticados.
-- As permissoes de alterar, concluir e excluir tarefas continuam restritas.
begin;

drop policy if exists "Equipe consulta tarefas permitidas" on public.tarefas;
create policy "Equipe consulta tarefas permitidas"
on public.tarefas for select to authenticated
using (public.usuario_e_admin() or public.funcionario_id_autenticado() is not null);

drop policy if exists "Equipe consulta funcionarios" on public.funcionarios;
create policy "Equipe consulta funcionarios"
on public.funcionarios for select to authenticated
using (public.usuario_e_admin() or public.funcionario_id_autenticado() is not null);

commit;

select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('tarefas', 'funcionarios')
  and policyname in ('Equipe consulta tarefas permitidas', 'Equipe consulta funcionarios')
order by tablename;
