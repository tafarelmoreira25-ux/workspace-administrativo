-- Importa os registros visíveis da planilha HUNTER_3 para a Carteira Hunter.
-- Execute depois de carteira_hunter_clientes_2026.sql.
-- Todos os seis registros fornecidos estão marcados como PAGOU.
-- WhatsApp e dados ausentes são registrados como não informados, sem invenção.
-- Script idempotente: pode ser executado novamente com segurança.

begin;

do $$
declare
  v_hunter_id bigint;
  v_consultor_id bigint;
  v_consultor_email text;
  v_prospeccao_id bigint;
  registro record;
begin
  select f.id
    into v_hunter_id
  from public.funcionarios f
  where lower(trim(f.email)) = 'giullian@platino.com'
    and f.ativo is not false
  limit 1;

  if v_hunter_id is null then
    raise exception 'Giullian não foi encontrada. Execute cadastrar_equipe_juridico.sql antes desta importação.';
  end if;

  for registro in
    select *
    from (values
      ('Hemenegildo Laurindo de Oliveira de Lima', 'Jana',    '2026-08-07 09:00:00-03'::timestamptz, '4000920-19.2025.8.26.0457', 'CITAÇÃO',   'R$ 3.580,00'),
      ('Jose Almeida Silva Filho',                  'Jana',    '2026-08-10 09:00:00-03'::timestamptz, '4000482-91.2026.8.26.0704', 'CITAÇÃO',   'R$ 1.200,00'),
      ('Aline Cristina Moreira',                    'Soraya',  '2026-08-11 09:00:00-03'::timestamptz, '1029285-33.2026.8.13.0079', 'AUDIÊNCIA', 'R$ 7.000,37'),
      ('Luciano Dombroski',                         'Jana',    '2026-08-14 09:00:00-03'::timestamptz, '5000959-55.2026.8.24.0930', 'CITAÇÃO',   'R$ 8.658,47'),
      ('Roney de Souza Martins',                    'Jana',    '2026-08-11 10:00:00-03'::timestamptz, '4004132-18.2026.8.26.0003', 'AUDIÊNCIA', 'R$ 5.995,64'),
      ('Maria do Socorro Farache Barroso',          'Jana',    '2026-08-14 10:00:00-03'::timestamptz, '0243828-76.2026.8.04.1000', null,         null)
    ) as dados(nome_cliente, consultora, data_registro, numero_processo, produto, valor)
  loop
    v_consultor_id := null;
    v_consultor_email := null;

    select f.id, f.email
      into v_consultor_id, v_consultor_email
    from public.funcionarios f
    where f.ativo is not false
      and lower(trim(f.nome)) like lower(registro.consultora) || '%'
    order by
      case when lower(trim(f.nome)) = lower(registro.consultora) then 0 else 1 end,
      f.id
    limit 1;

    v_prospeccao_id := null;
    select p.id
      into v_prospeccao_id
    from public.prospeccoes_hunter p
    where p.hunter_id = v_hunter_id
      and (
        p.numero_processo = registro.numero_processo
        or lower(trim(p.nome_cliente)) = lower(trim(registro.nome_cliente))
      )
    order by p.id
    limit 1;

    if v_prospeccao_id is null then
      insert into public.prospeccoes_hunter (
        hunter_id,
        consultor_id,
        nome_cliente,
        whatsapp,
        documento_sugerido,
        cliente_com_processo,
        numero_processo,
        situacao_processo,
        analise_breve,
        status,
        resultado,
        motivo_nao_pagamento,
        observacao_consultor,
        criada_por_email,
        delegada_em,
        tratativa_iniciada_em,
        concluida_em,
        created_at,
        updated_at
      ) values (
        v_hunter_id,
        v_consultor_id,
        registro.nome_cliente,
        'Não informado na planilha histórica',
        coalesce(registro.produto, 'Produto não informado na planilha'),
        true,
        registro.numero_processo,
        'Protocolado. Pagamento confirmado na planilha Hunter_3.' ||
          case when registro.valor is not null then ' Valor: ' || registro.valor || '.' else '' end,
        'Importado da planilha histórica Hunter_3. Consultora informada na planilha: ' ||
          registro.consultora || '. Data do registro: ' ||
          to_char(registro.data_registro at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') ||
          '. Resultado informado: pagamento realizado.',
        'concluida',
        'realizou_pagamento',
        null,
        'Pagamento confirmado no controle histórico da Hunter.' ||
          case when registro.valor is not null then ' Valor registrado: ' || registro.valor || '.' else '' end,
        'giullian@platino.com',
        registro.data_registro + interval '10 minutes',
        registro.data_registro + interval '20 minutes',
        registro.data_registro + interval '1 hour',
        registro.data_registro,
        registro.data_registro + interval '1 hour'
      )
      returning id into v_prospeccao_id;
    else
      update public.prospeccoes_hunter
      set consultor_id = coalesce(v_consultor_id, consultor_id),
          documento_sugerido = coalesce(registro.produto, 'Produto não informado na planilha'),
          cliente_com_processo = true,
          numero_processo = registro.numero_processo,
          situacao_processo = 'Protocolado. Pagamento confirmado na planilha Hunter_3.' ||
            case when registro.valor is not null then ' Valor: ' || registro.valor || '.' else '' end,
          analise_breve = 'Importado da planilha histórica Hunter_3. Consultora informada na planilha: ' ||
            registro.consultora || '. Data do registro: ' ||
            to_char(registro.data_registro at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') ||
            '. Resultado informado: pagamento realizado.',
          status = 'concluida',
          resultado = 'realizou_pagamento',
          motivo_nao_pagamento = null,
          observacao_consultor = 'Pagamento confirmado no controle histórico da Hunter.' ||
            case when registro.valor is not null then ' Valor registrado: ' || registro.valor || '.' else '' end,
          delegada_em = registro.data_registro + interval '10 minutes',
          tratativa_iniciada_em = registro.data_registro + interval '20 minutes',
          concluida_em = registro.data_registro + interval '1 hour',
          created_at = registro.data_registro,
          updated_at = registro.data_registro + interval '1 hour'
      where id = v_prospeccao_id;
    end if;

    insert into public.prospeccoes_hunter_historico (
      prospeccao_id,
      evento,
      status_anterior,
      status_novo,
      dados,
      autor_email,
      created_at
    )
    select
      v_prospeccao_id,
      historico.evento,
      historico.status_anterior,
      historico.status_novo,
      jsonb_build_object(
        'origem', 'planilha_hunter_3',
        'consultora_informada', registro.consultora,
        'produto', registro.produto,
        'valor', registro.valor,
        'numero_processo', registro.numero_processo
      ),
      historico.autor_email,
      historico.criado_em
    from (values
      ('perfil_salvo',       null::text,       'em_organizacao', 'giullian@platino.com',                         registro.data_registro),
      ('perfil_delegado',    'em_organizacao', 'delegada',       'giullian@platino.com',                         registro.data_registro + interval '10 minutes'),
      ('tratativa_iniciada', 'delegada',       'em_tratativa',   coalesce(v_consultor_email, 'consultor-historico'), registro.data_registro + interval '20 minutes'),
      ('tratativa_concluida','em_tratativa',   'concluida',      coalesce(v_consultor_email, 'consultor-historico'), registro.data_registro + interval '1 hour')
    ) as historico(evento, status_anterior, status_novo, autor_email, criado_em)
    where not exists (
      select 1
      from public.prospeccoes_hunter_historico existente
      where existente.prospeccao_id = v_prospeccao_id
        and existente.evento = historico.evento
    );
  end loop;
end;
$$;

commit;

select
  p.id,
  p.nome_cliente,
  c.nome as consultor_cadastrado,
  p.numero_processo,
  p.documento_sugerido,
  p.resultado,
  p.observacao_consultor,
  p.concluida_em
from public.prospeccoes_hunter p
left join public.funcionarios c on c.id = p.consultor_id
where p.hunter_id = (
  select id
  from public.funcionarios
  where lower(trim(email)) = 'giullian@platino.com'
  limit 1
)
  and p.numero_processo in (
    '4000920-19.2025.8.26.0457',
    '4000482-91.2026.8.26.0704',
    '1029285-33.2026.8.13.0079',
    '5000959-55.2026.8.24.0930',
    '4004132-18.2026.8.26.0003',
    '0243828-76.2026.8.04.1000'
  )
order by p.created_at;
