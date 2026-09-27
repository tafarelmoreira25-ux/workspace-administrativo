-- Historico administrativo extrajudicial padrao.
-- Insere o lote em processos existentes e reaplica automaticamente em novos processos.

begin;

alter table if exists public.movimentacoes
  alter column data_registro drop not null,
  add column if not exists ordem_historico integer,
  add column if not exists fase text,
  add column if not exists ordem_fase integer,
  add column if not exists ordem_movimentacao integer,
  add column if not exists possui_anexo boolean not null default false;

alter table if exists public.movimentacoes
  drop constraint if exists movimentacoes_categoria_check;

alter table if exists public.movimentacoes
  add constraint movimentacoes_categoria_check check (
    categoria in (
      'Movimentacao processual',
      'Movimentação processual',
      'ACAO EXTRAJUDICIAL - ADMINISTRATIVA',
      'AÇÃO EXTRAJUDICIAL - ADMINISTRATIVA',
      'Atendimento',
      'Tarefa',
      'Prazo',
      'Documento',
      'Custas',
      'Ocorrencia',
      'Ocorrência',
      'Protocolo',
      'Alteracao cadastral',
      'Alteração cadastral',
      'Relatorio',
      'Relatório',
      'Sistema'
    )
  );

create unique index if not exists movimentacoes_historico_admin_uidx
  on public.movimentacoes (processo_id, ordem_historico)
  where origem = 'import' and fonte = 'Historico administrativo extrajudicial padrao' and deleted_at is null;

create index if not exists movimentacoes_ordem_historico_idx
  on public.movimentacoes (processo_id, ordem_historico)
  where ordem_historico is not null and deleted_at is null;

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

  if v_processo.id is null then
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
    anexo_url,
    created_by_nome
  )
  select
    v_processo.id,
    null::timestamptz,
    item.ordem,
    case when item.ordem <= 25 then 'extrajudicial_administrativa' else 'transicao_judicial' end,
    case when item.ordem <= 25 then 1 else 2 end,
    item.ordem,
    'historico administrativo',
    'AÇÃO EXTRAJUDICIAL - ADMINISTRATIVA',
    case
      when item.ordem = 1 then item.titulo || ': ' || coalesce(nullif(v_processo.id_crm, ''), nullif(v_processo.pasta_cliente_id, ''), v_processo.id::text)
      else item.titulo
    end,
    case
      when item.ordem = 1 then item.descricao || ': ' || coalesce(nullif(v_processo.id_crm, ''), nullif(v_processo.pasta_cliente_id, ''), v_processo.id::text)
      else item.descricao
    end,
    case
      when item.ordem = 1 then item.descricao || ': ' || coalesce(nullif(v_processo.id_crm, ''), nullif(v_processo.pasta_cliente_id, ''), v_processo.id::text)
      else item.descricao
    end,
    item.responsavel,
    'Historico administrativo extrajudicial padrao',
    'Normal',
    'import',
    item.possui_anexo,
    case when item.possui_anexo then 'drive://arquivo-do-cliente' else null end,
    'Sistema'
  from (
    values
      (1, 'PLATINO ASSESSORIA', 'Ação registrada', 'Ação registrada', false),
      (2, 'PLATINO ASSESSORIA', 'Análise preliminar APROVADA - BACEN', 'Análise preliminar APROVADA - BACEN', false),
      (3, 'PLATINO ASSESSORIA', 'Contrato assinado', 'Contrato assinado', true),
      (4, 'PLATINO ASSESSORIA', 'Grupo aberto', 'Grupo aberto', false),
      (5, 'PLATINO ASSESSORIA', 'Notificação extrajudicial enviada ao destino da parte adversa', 'Notificação extrajudicial enviada ao destino da parte adversa', true),
      (6, 'PLATINO ASSESSORIA', 'Requerimento das taxas registrado nas plataformas de consumidor', 'Requerimento das taxas registrado nas plataformas de consumidor', true),
      (7, 'CÂMARA CCMA', 'Instituição financeira intimada', 'Instituição financeira intimada', false),
      (8, 'CAMARA CCMA', 'Diligência inicial com representante do Banco realizada via Meet', 'Diligência inicial com representante do Banco realizada via Meet', false),
      (9, 'CAMARA CCMA', 'Proposta de acordo em análise', 'Proposta de acordo em análise', false),
      (10, 'CAMARA CCMA', 'Requerimento de todos documentos do cliente', 'Requerimento de todos documentos do cliente (contrato, CCB, cédula de crédito, orçamento de compra, histórico de parcelas, Saldo devedor atualizado, Proposta de quitação)', true),
      (11, 'PLATINO ASSESSORIA', 'Intimação via AR ao endereço registrado da agência', 'Intimação via AR ao endereço registrado da agência', true),
      (12, 'PLATINO ASSESSORIA', 'Contraproposta de acordo - Solicitação de Parecer Técnico', 'Contraproposta de acordo - Solicitação de Parecer Técnico', true),
      (13, 'CAMARA CCMA', 'Dilação - Aumento de Prazo', 'Dilação - Aumento de Prazo', false),
      (14, 'PLATINO ASSESSORIA', 'Parecer Técnico', 'Parecer Técnico (Obs: É aceito o Laudo Pericial realizado pela Advogada especializada?)', false),
      (15, 'Parte Contraria (Elio Washington de Camargo, Representante autorizado)', 'Negativa', 'Negativa. O perito contador precisa obrigatoriamente ser bacharel em Ciências Contábeis com registro ativo e regular no Conselho Regional de Contabilidade (CRC) na categoria de contador. (IMPARCIAL)', true),
      (16, 'PLATINO ASSESSORIA', 'DILAÇÃO DE PRAZO', 'DILAÇÃO DE PRAZO', false),
      (17, 'PLATINO ASSESSORIA', 'COMPROVANTE DE PEGAMENTO: PARECER TÉCNICO REGISTRADO', 'COMPROVANTE DE PEGAMENTO: PARECER TÉCNICO REGISTRADO', true),
      (18, 'PLATINO ASSESSORIA', 'PARECER TÉCNICO (LAUDO PERICIAL) REGISTRADO', 'PARECER TÉCNICO (LAUDO PERICIAL) REGISTRADO', true),
      (19, 'CAMARA CCMA', 'REGISTRO DE DILIGÊNCIA REALIZADO', 'REGISTRO DE DILIGÊNCIA REALIZADO', false),
      (20, 'Parte Contraria (Elio Washington de Camargo, Representante autorizado)', 'Negativa', 'Negativa.', false),
      (21, 'PLATINO ASSESSORIA', 'INTIMAÇÃO ENCAMINHADA VIA E-MAIL', 'INTIMAÇÃO ENCAMINHADA VIA E-MAIL', true),
      (22, 'PLATINO ASSESSORIA', 'INTIMAÇÃO ELETRONICA ENVIADA - VIA AR ONLINE', 'INTIMAÇÃO ELETRONICA ENVIADA - VIA AR ONLINE', true),
      (23, 'PLATINO ASSESSORIA', 'CONTRAPROPOSTA ENCAMINHADA', 'CONTRAPROPOSTA ENCAMINHADA', true),
      (24, 'CAMARA CCMA', 'PRAZO DE CONCILIAÇÃO FINALIZADO', 'PRAZO DE CONCILIAÇÃO FINALIZADO motivo: ausência/abandono/inércia', false),
      (25, 'CAMARA CCMA', 'REGISTROS DE DILIGÊNCIA ENTRE A PLATINO ASSESSORIA', 'REGISTROS DE DILIGÊNCIA ENTRE A PLATINO ASSESSORIA', true),
      (26, 'CAMARA CCMA', 'ALTERAÇÃO DE ESFERAS', 'ALTERAÇÃO DE ESFERAS: AÇÃO ADMINISTRATIVA -> PROCEDIMENTO COMUM CIVEL', false),
      (27, 'CAMARA CCMA', 'INICIO DE DISTRIBUIÇÃO', 'INICIO DE DISTRIBUIÇÃO', false),
      (28, 'PLATINO ASSESSORIA', 'PETIÇÃO INICIAL FINALIZADA', 'PETIÇÃO INICIAL FINALIZADA', true),
      (29, 'PLATINO ASSESSORIA', 'PROCESSO ENVIADO AO TRIBUNAL DA JUSTIÇA BRASILEIRA VIA PJE PARA DISTRIBUIÇÃO POR SORTEIO.', 'PROCESSO ENVIADO AO TRIBUNAL DA JUSTIÇA BRASILEIRA VIA PJE PARA DISTRIBUIÇÃO POR SORTEIO.', false)
  ) as item(ordem, responsavel, titulo, descricao, possui_anexo)
  on conflict (processo_id, ordem_historico)
  where origem = 'import' and fonte = 'Historico administrativo extrajudicial padrao' and deleted_at is null
  do update set
    data_registro = null,
    fase = excluded.fase,
    ordem_fase = excluded.ordem_fase,
    ordem_movimentacao = excluded.ordem_movimentacao,
    tipo = excluded.tipo,
    categoria = excluded.categoria,
    titulo = excluded.titulo,
    descricao = excluded.descricao,
    resumo_cliente = excluded.resumo_cliente,
    responsavel = excluded.responsavel,
    fonte = excluded.fonte,
    importancia = excluded.importancia,
    origem = excluded.origem,
    possui_anexo = excluded.possui_anexo,
    anexo_url = excluded.anexo_url,
    deleted_at = null,
    deleted_by = null;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

create or replace function public.inserir_historico_administrativo_extrajudicial_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.inserir_historico_administrativo_extrajudicial(new.id);
  return new;
end;
$$;

drop trigger if exists processos_historico_administrativo_extrajudicial_ai on public.processos;
create trigger processos_historico_administrativo_extrajudicial_ai
after insert on public.processos
for each row
execute function public.inserir_historico_administrativo_extrajudicial_trigger();

select public.inserir_historico_administrativo_extrajudicial(id)
from public.processos;

commit;
