-- Mantem a acao extrajudicial independente da distribuicao judicial.
-- Novos cadastros extrajudiciais recebem apenas o registro inicial; a
-- transicao ao judicial acontece exclusivamente por uma acao explicita.

begin;

alter table public.processos
  add column if not exists data_inicio_extrajudicial date;

alter table public.processos
  drop constraint if exists processos_fase_atual_check;

alter table public.processos
  add constraint processos_fase_atual_check check (
    fase_atual in (
      'Extrajudicial',
      'Transição para o Judicial',
      'Solicitado para Ajuizamento',
      'Documentos Pendentes',
      'Documentos Concluídos',
      'Pré-Distribuição',
      'Enviado para Elite',
      'Pasta Retornada',
      'Protocolo Liberado',
      'Tramitando',
      'Arquivado',
      'Improcedente'
    )
  );

create or replace function public.inserir_historico_administrativo_extrajudicial(p_processo_id bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_processo public.processos%rowtype;
  v_total integer := 0;
begin
  select * into v_processo
  from public.processos
  where id = p_processo_id;

  if v_processo.id is null
     or not (
       v_processo.status_judicial = 'EXTRAJUDICIAL'
       or (v_processo.status_judicial is null and v_processo.origem_registro = 'acao_extrajudicial_manual')
     ) then
    return 0;
  end if;

  insert into public.movimentacoes (
    processo_id,
    data_registro,
    ordem_historico,
    fase,
    ordem_fase,
    ordem_movimentacao,
    tipo,
    categoria,
    titulo,
    descricao,
    resumo_cliente,
    responsavel,
    fonte,
    importancia,
    origem,
    possui_anexo,
    created_by_nome
  ) values (
    v_processo.id,
    coalesce(v_processo.data_inicio_extrajudicial::timestamptz, v_processo.created_at, now()),
    1,
    'extrajudicial_administrativa',
    1,
    1,
    'historico administrativo',
    'AÇÃO EXTRAJUDICIAL - ADMINISTRATIVA',
    'Ação registrada: ' || coalesce(nullif(v_processo.id_crm, ''), nullif(v_processo.pasta_cliente_id, ''), v_processo.id::text),
    'Ação registrada: ' || coalesce(nullif(v_processo.id_crm, ''), nullif(v_processo.pasta_cliente_id, ''), v_processo.id::text),
    'Ação registrada: ' || coalesce(nullif(v_processo.id_crm, ''), nullif(v_processo.pasta_cliente_id, ''), v_processo.id::text),
    v_processo.responsavel,
    'Historico administrativo extrajudicial padrao',
    'Normal',
    'import',
    false,
    'Sistema'
  )
  on conflict (processo_id, ordem_historico)
  where origem = 'import'
    and fonte = 'Historico administrativo extrajudicial padrao'
    and deleted_at is null
  do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- A migracao anterior criava antecipadamente todo o roteiro, inclusive a
-- distribuicao. Em acoes que continuam extrajudiciais, arquiva os passos
-- artificiais ainda nao ocorridos e preserva o primeiro registro.
update public.movimentacoes m
set
  deleted_at = coalesce(m.deleted_at, now()),
  deleted_by = coalesce(m.deleted_by, 'Migração: fluxo extrajudicial independente')
from public.processos p
where p.id = m.processo_id
  and (
    p.status_judicial = 'EXTRAJUDICIAL'
    or (p.status_judicial is null and p.origem_registro = 'acao_extrajudicial_manual')
  )
  and m.origem = 'import'
  and m.fonte = 'Historico administrativo extrajudicial padrao'
  and m.ordem_historico between 2 and 29
  and m.deleted_at is null;

create or replace function public.encaminhar_acao_extrajudicial_ao_judicial(
  p_processo_id bigint,
  p_numero_processo text default null,
  p_data_encaminhamento date default current_date,
  p_data_distribuicao date default null,
  p_tribunal text default null,
  p_comarca text default null,
  p_vara text default null,
  p_responsavel text default null
)
returns public.processos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_processo public.processos%rowtype;
  v_ordem integer;
begin
  select * into v_processo
  from public.processos
  where id = p_processo_id
  for update;

  if v_processo.id is null then
    raise exception 'Ação extrajudicial não localizada.';
  end if;

  if not (
    v_processo.status_judicial = 'EXTRAJUDICIAL'
    or (v_processo.status_judicial is null and v_processo.origem_registro = 'acao_extrajudicial_manual')
  ) then
    raise exception 'Este cadastro não está na fase extrajudicial.';
  end if;

  update public.processos
  set
    status_judicial = 'TRANSICAO_JUDICIAL',
    fase_atual = 'Transição para o Judicial',
    numero_processo = coalesce(nullif(btrim(p_numero_processo), ''), numero_processo),
    data_distribuicao = coalesce(p_data_distribuicao, data_distribuicao),
    tribunal = coalesce(nullif(btrim(p_tribunal), ''), tribunal),
    comarca = coalesce(nullif(btrim(p_comarca), ''), comarca),
    vara = coalesce(nullif(btrim(p_vara), ''), vara),
    updated_by = coalesce(nullif(btrim(p_responsavel), ''), updated_by)
  where id = p_processo_id
  returning * into v_processo;

  select coalesce(max(ordem_movimentacao), 25) + 1
  into v_ordem
  from public.movimentacoes
  where processo_id = p_processo_id
    and fase = 'transicao_judicial'
    and deleted_at is null;

  insert into public.movimentacoes (
    processo_id,
    data_registro,
    fase,
    ordem_fase,
    ordem_movimentacao,
    tipo,
    categoria,
    titulo,
    descricao,
    resumo_cliente,
    responsavel,
    fonte,
    importancia,
    origem,
    created_by_nome
  ) values (
    p_processo_id,
    coalesce(p_data_encaminhamento, current_date)::timestamptz,
    'transicao_judicial',
    2,
    v_ordem,
    'encaminhamento judicial',
    'Movimentação processual',
    'Ação encaminhada ao judicial',
    case
      when nullif(btrim(p_numero_processo), '') is not null
        then 'Ação extrajudicial encaminhada ao judicial. Processo: ' || btrim(p_numero_processo)
      else 'Ação extrajudicial encaminhada ao judicial, aguardando distribuição.'
    end,
    'A ação foi encaminhada ao judicial.',
    p_responsavel,
    'Transição extrajudicial/judicial',
    'Relevante',
    'manual',
    p_responsavel
  );

  return v_processo;
end;
$$;

revoke all on function public.encaminhar_acao_extrajudicial_ao_judicial(bigint, text, date, date, text, text, text, text) from public, anon;
grant execute on function public.encaminhar_acao_extrajudicial_ao_judicial(bigint, text, date, date, text, text, text, text) to authenticated;

commit;
