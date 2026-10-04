-- Requer tarefas_agenda_atendimentos.sql e controle_gerencial_auditoria.sql.
-- SECURITY INVOKER preserva as políticas RLS de cada tabela.
begin;
create or replace function public.agenda_atividades_consolidada()
returns jsonb
language sql stable security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(lista) order by lista.data,
    lista.horario nulls last, lista.origem, lista.registro->>'id'), '[]'::jsonb)
  from (
    select 'tarefa'::text origem, to_jsonb(t) registro, t.data, t.horario
    from public.processual_tarefas t
    union all
    select 'atendimento', to_jsonb(a), a.data, a.hora
    from public.processual_atendimentos a
    union all
    select 'ocorrencia', to_jsonb(o), coalesce(o.prazo, o.data), null::time
    from public.processual_ocorrencias o where o.deleted_at is null
  ) lista;
$$;
revoke all on function public.agenda_atividades_consolidada() from public, anon;
grant execute on function public.agenda_atividades_consolidada() to authenticated;
commit;
