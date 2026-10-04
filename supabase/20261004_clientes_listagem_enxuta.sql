-- Aplicar antes de publicar o frontend de Clientes.
-- Uma chamada GET /rest/v1/rpc/listar_clientes_resumo; cadastros completos
-- continuam em /rest/v1/clientes?id=eq.<id> somente ao abrir a pasta.
begin;

create index if not exists clientes_listagem_nome_id_idx
  on public.clientes (nome_completo, id);
create index if not exists processos_cliente_id_idx
  on public.processos (cliente_id);

create or replace function public.listar_clientes_resumo(
  p_busca text default '',
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with parametros as (
    select '%' || replace(replace(replace(left(btrim(coalesce(p_busca, '')), 120),
      E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' as termo,
      greatest(1, least(coalesce(p_limit, 30), 100)) as limite,
      greatest(0, coalesce(p_offset, 0)) as deslocamento
  ), filtrados as not materialized (
    select c.id, c.nome_completo, c.id_crm
    from public.clientes c cross join parametros args
    where args.termo = '%%'
      or c.nome_completo ilike args.termo
      or c.cpf ilike args.termo
      or c.id_crm ilike args.termo
      or exists (
        select 1 from public.processos p
        where p.cliente_id = c.id and p.numero_processo ilike args.termo
      )
  ), pagina as (
    select * from filtrados
    order by nome_completo, id
    limit (select limite from parametros)
    offset (select deslocamento from parametros)
  ), resumo as (
    select c.id, c.nome_completo, c.id_crm,
      array_remove(array[
        case when esferas.extrajudicial then 'extrajudicial' end,
        case when esferas.judicial then 'judicial' end
      ], null) as esferas
    from pagina c
    cross join lateral (
      -- Mesma regra de pertenceAExtrajudiciais em src/lib/processWorkflow.ts.
      -- Calculada somente para os clientes da página, sem serializar processos.
      select bool_or(p.extrajudicial) as extrajudicial,
        bool_or(not p.extrajudicial) as judicial
      from (
        select coalesce(p.status_judicial = 'EXTRAJUDICIAL'
          or (coalesce(p.status_judicial, '') = ''
            and p.origem_registro = 'acao_extrajudicial_manual'
            and p.fase_atual = 'Extrajudicial'), false) as extrajudicial
        from public.processos p where p.cliente_id = c.id
      ) p
    ) esferas
  )
  select jsonb_build_object(
    'clientes', coalesce((select jsonb_agg(to_jsonb(r) order by r.nome_completo, r.id) from resumo r), '[]'::jsonb),
    'total', (select count(*) from filtrados)
  );
$$;

-- SECURITY INVOKER mantém as políticas RLS de clientes e processos.
revoke all on function public.listar_clientes_resumo(text, integer, integer) from public, anon;
grant execute on function public.listar_clientes_resumo(text, integer, integer) to authenticated;
notify pgrst, 'reload schema';

commit;
