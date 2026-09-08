with fonte_processos as (
  select distinct i.processo_id
  from public.importacoes_processos_protocolados_linhas i
  where i.fonte = 'google-sheets:1wHKxXyz3RZf72tgvMHR9W5LhWeuMu9K9k5TbfRiRloA:PROCESSOS'
    and i.erro is null
    and i.processo_id is not null
),
fonte_clientes as (
  select distinct p.cliente_id
  from public.processos_clientes p
  join fonte_processos f on f.processo_id = p.id
)
select jsonb_build_object(
  'resumo', jsonb_build_object(
    'linhas_persistidas', (
      select count(*) from public.importacoes_processos_protocolados_linhas i
      where i.fonte = 'google-sheets:1wHKxXyz3RZf72tgvMHR9W5LhWeuMu9K9k5TbfRiRloA:PROCESSOS'
        and i.erro is null
    ),
    'erros', (
      select count(*) from public.importacoes_processos_protocolados_linhas i
      where i.fonte = 'google-sheets:1wHKxXyz3RZf72tgvMHR9W5LhWeuMu9K9k5TbfRiRloA:PROCESSOS'
        and i.erro is not null
    ),
    'clientes_criados', (
      select count(*) from fonte_clientes f
      join public.clientes c on c.id = f.cliente_id
      where c.origem = 'importacao_processos_protocolados'
    ),
    'clientes_existentes_reutilizados', (
      select count(*) from fonte_clientes f
      join public.clientes c on c.id = f.cliente_id
      where c.origem is distinct from 'importacao_processos_protocolados'
    ),
    'processos_desta_fonte', (select count(*) from fonte_processos),
    'processos_incompletos', (
      select count(*) from fonte_processos f
      join public.processos_clientes p on p.id = f.processo_id
      where p.incompleto
    ),
    'processos_sem_numero', (
      select count(*) from fonte_processos f
      join public.processos_clientes p on p.id = f.processo_id
      where p.numero_processo_normalizado is null
    ),
    'total_processos_banco', (select count(*) from public.processos_clientes)
  ),
  'status', (
    select jsonb_object_agg(coalesce(s.status_categoria, 'nao_informado'), s.quantidade)
    from (
      select p.status_categoria, count(*) as quantidade
      from fonte_processos f
      join public.processos_clientes p on p.id = f.processo_id
      group by p.status_categoria
      order by p.status_categoria
    ) s
  ),
  'amostras', jsonb_build_object(
    'arquivado', (
      select to_jsonb(x) from (
        select p.id, c.nome as cliente, p.numero_processo, p.status_original
        from fonte_processos f join public.processos_clientes p on p.id = f.processo_id
        join public.clientes c on c.id = p.cliente_id
        where p.status_categoria = 'arquivado' order by p.id limit 1
      ) x
    ),
    'tramitando', (
      select to_jsonb(x) from (
        select p.id, c.nome as cliente, p.numero_processo, p.status_original
        from fonte_processos f join public.processos_clientes p on p.id = f.processo_id
        join public.clientes c on c.id = p.cliente_id
        where p.status_categoria = 'tramitando' order by p.id limit 1
      ) x
    ),
    'improcedente', (
      select to_jsonb(x) from (
        select p.id, c.nome as cliente, p.numero_processo, p.status_original
        from fonte_processos f join public.processos_clientes p on p.id = f.processo_id
        join public.clientes c on c.id = p.cliente_id
        where p.status_categoria = 'improcedente' order by p.id limit 1
      ) x
    ),
    'procedente', (
      select to_jsonb(x) from (
        select p.id, c.nome as cliente, p.numero_processo, p.status_original
        from fonte_processos f join public.processos_clientes p on p.id = f.processo_id
        join public.clientes c on c.id = p.cliente_id
        where p.status_categoria = 'procedente' order by p.id limit 1
      ) x
    ),
    'incompleto', (
      select to_jsonb(x) from (
        select p.id, c.nome as cliente, p.numero_processo, p.status_original, p.incompleto
        from fonte_processos f join public.processos_clientes p on p.id = f.processo_id
        join public.clientes c on c.id = p.cliente_id
        where p.incompleto order by p.id limit 1
      ) x
    ),
    'cliente_multiplos_processos', (
      select to_jsonb(x) from (
        select c.id as cliente_id, c.nome as cliente, count(*) as quantidade,
          array_agg(p.numero_processo order by p.numero_processo) as processos
        from fonte_processos f join public.processos_clientes p on p.id = f.processo_id
        join public.clientes c on c.id = p.cliente_id
        group by c.id, c.nome having count(*) > 1
        order by count(*) desc, c.id limit 1
      ) x
    ),
    'duplicado_consolidado', (
      select to_jsonb(x) from (
        select p.id, c.nome as cliente, p.numero_processo, p.fontes_linhas
        from fonte_processos f join public.processos_clientes p on p.id = f.processo_id
        join public.clientes c on c.id = p.cliente_id
        where cardinality(p.fontes_linhas) > 1 order by p.id limit 1
      ) x
    ),
    'inicio_fonte', (
      select to_jsonb(x) from (
        select p.id, c.nome as cliente, p.numero_processo, p.fontes_linhas
        from fonte_processos f join public.processos_clientes p on p.id = f.processo_id
        join public.clientes c on c.id = p.cliente_id
        where 2 = any(p.fontes_linhas) limit 1
      ) x
    ),
    'final_fonte', (
      select to_jsonb(x) from (
        select p.id, c.nome as cliente, p.numero_processo, p.fontes_linhas
        from fonte_processos f join public.processos_clientes p on p.id = f.processo_id
        join public.clientes c on c.id = p.cliente_id
        where 319 = any(p.fontes_linhas) limit 1
      ) x
    )
  )
) as relatorio;
