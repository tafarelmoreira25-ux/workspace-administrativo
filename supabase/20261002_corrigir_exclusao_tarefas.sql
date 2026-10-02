-- Executar no SQL Editor do Supabase após configurar_sistema.sql e
-- compatibilidade_modulos_processuais_legado.sql.
-- Corrige a exclusão de atividades na ficha e na agenda sem remover registros.
begin;

alter table public.processual_tarefas enable row level security;
revoke all on public.processual_tarefas from anon;
grant delete on public.processual_tarefas to authenticated;

drop policy if exists "Equipe interna exclui tarefas" on public.processual_tarefas;
create policy "Equipe interna exclui tarefas"
on public.processual_tarefas for delete to authenticated
using (public.funcionario_id_autenticado() is not null);

-- A política restritiva também limita eventuais políticas permissivas antigas.
drop policy if exists "Exclusao de tarefas restrita a equipe interna" on public.processual_tarefas;
create policy "Exclusao de tarefas restrita a equipe interna"
on public.processual_tarefas as restrictive for delete to authenticated
using (public.funcionario_id_autenticado() is not null);

commit;

-- Verificação: authenticated_pode_excluir e exclusao_restrita devem ser true;
-- anon_pode_excluir deve ser false. Nenhuma atividade é excluída por este script.
select
  has_table_privilege('authenticated', 'public.processual_tarefas', 'DELETE')
    as authenticated_pode_excluir,
  has_table_privilege('anon', 'public.processual_tarefas', 'DELETE')
    as anon_pode_excluir,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'processual_tarefas'
      and policyname = 'Exclusao de tarefas restrita a equipe interna'
      and permissive = 'RESTRICTIVE' and cmd = 'DELETE'
      and roles = array['authenticated']::name[]
  ) as exclusao_restrita;
