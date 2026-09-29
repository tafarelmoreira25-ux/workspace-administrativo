-- Separa a carteira extrajudicial sem perder o historico do processo.
-- Fluxo: Extrajudiciais -> Protocolos/SLA -> Processual apos numero liberado.

begin;

alter table public.processos
  add column if not exists data_inicio_extrajudicial date,
  add column if not exists protocolo_status text default 'Aguardando',
  add column if not exists motivo_ajuizamento text;

alter table public.processos
  drop constraint if exists processos_fase_atual_check;

-- Converte eventuais encaminhamentos feitos pela versao anterior para o
-- fluxo correto, sem trocar o id do processo nem seus relacionamentos.
update public.processos
set status_judicial = case when nullif(btrim(numero_processo), '') is null then 'AGUARDANDO_PROTOCOLO' else 'TRAMITANDO' end,
    fase_atual = case when nullif(btrim(numero_processo), '') is null then 'Solicitado para Ajuizamento' else 'Distribuição' end,
    protocolo_status = case when nullif(btrim(numero_processo), '') is null then 'Aguardando' else 'Liberado' end
where status_judicial = 'TRANSICAO_JUDICIAL'
   or fase_atual = 'Transição para o Judicial';

-- Nao recria uma lista fechada para fase_atual. A base historica possui
-- outras fases legitimas e elas devem ser preservadas sem conversao.

-- Restaura qualquer registro que uma versao anterior desta migracao tenha
-- arquivado. Nenhuma movimentacao historica deve ser removida neste fluxo.
update public.movimentacoes
set deleted_at = null,
    deleted_by = null
where deleted_by = 'Migração: fluxo extrajudicial independente';

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
       or (
         v_processo.status_judicial is null
         and v_processo.origem_registro = 'acao_extrajudicial_manual'
         and v_processo.fase_atual = 'Extrajudicial'
       )
     ) then
    return 0;
  end if;

  insert into public.movimentacoes (
    processo_id, data_registro, ordem_historico, fase, ordem_fase,
    ordem_movimentacao, tipo, categoria, titulo, descricao, resumo_cliente,
    responsavel, fonte, importancia, origem, possui_anexo, created_by_nome
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

drop function if exists public.encaminhar_acao_extrajudicial_ao_judicial(bigint, text, date, date, text, text, text, text);

create or replace function public.encaminhar_acao_extrajudicial_ao_protocolo(
  p_processo_id bigint,
  p_data_encaminhamento date default current_date,
  p_motivo_ajuizamento text default 'Tentativa extrajudicial frustrada',
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
    or (
      v_processo.status_judicial is null
      and v_processo.origem_registro = 'acao_extrajudicial_manual'
      and v_processo.fase_atual = 'Extrajudicial'
    )
  ) then
    raise exception 'Este cadastro não está na fase extrajudicial.';
  end if;

  update public.processos
  set
    status_judicial = 'AGUARDANDO_PROTOCOLO',
    fase_atual = 'Solicitado para Ajuizamento',
    protocolo_status = 'Aguardando',
    motivo_ajuizamento = coalesce(nullif(btrim(p_motivo_ajuizamento), ''), motivo_ajuizamento),
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
    processo_id, data_registro, fase, ordem_fase, ordem_movimentacao, tipo,
    categoria, titulo, descricao, resumo_cliente, responsavel, fonte,
    importancia, origem, created_by_nome
  ) values (
    p_processo_id,
    coalesce(p_data_encaminhamento, current_date)::timestamptz,
    'transicao_judicial',
    2,
    v_ordem,
    'encaminhamento para protocolo',
    'Movimentação processual',
    'Ação encaminhada para Protocolos',
    'Tentativa extrajudicial encerrada. A ação foi encaminhada ao fluxo de protocolo e distribuição.',
    'A ação foi encaminhada para protocolo.',
    p_responsavel,
    'Transição Extrajudiciais/Protocolos',
    'Relevante',
    'manual',
    p_responsavel
  );

  return v_processo;
end;
$$;

revoke all on function public.encaminhar_acao_extrajudicial_ao_protocolo(bigint, date, text, text) from public, anon;
grant execute on function public.encaminhar_acao_extrajudicial_ao_protocolo(bigint, date, text, text) to authenticated;

commit;
