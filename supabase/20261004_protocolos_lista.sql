-- Apply before deploying the Protocolos frontend. Invoker preserves processos RLS.
begin;
create or replace view public.protocolos_lista with (security_invoker = true) as
select id, nome_cliente, coalesce(nullif(id_crm, ''), protocolo_extrajudicial) as id_crm,
  coalesce(nullif(banco_reu, ''), reu) as banco_reu, updated_at,
  case
    when protocolo_status = 'Liberado' then 'Distribuição'
    when coalesce(documentacao_status, status_documentos) = 'Irregular' or pasta_retornada then 'Análise de Documentos'
    when procuracao_status in ('Aguardando assinatura', 'Pendente', 'Atrasado')
      or status_procuracao in ('Aguardando assinatura', 'Pendente', 'Atrasado')
      or declaracao_hipossuficiencia_status in ('Aguardando assinatura', 'Pendente', 'Atrasado')
      or declaracao_ir_status in ('Aguardando assinatura', 'Pendente', 'Atrasado') then 'Aguardando Assinatura'
    else 'Cadastro/Procuração'
  end as etapa,
  greatest(0, floor(extract(epoch from (now() - coalesce(updated_at, sla_iniciado_em, data_envio_elite, created_at))) / 86400))::integer as dias_na_etapa,
  case when fase_atual = 'SLA' then 'Em distribuição' else fase_atual end as status_principal
from public.processos
where (numero_processo is null or numero_processo = '')
  and fase_atual in ('Solicitado para Ajuizamento', 'Documentação', 'Procuração', 'CRM', 'Enviado para Elite', 'SLA', 'Pasta Retornada', 'Pré-Distribuição', 'Distribuição', 'Documentos Pendentes', 'Documentos Concluídos');
revoke all on public.protocolos_lista from anon;
grant select on public.protocolos_lista to authenticated;
create index if not exists processos_protocolos_lista_ordem_idx
  on public.processos (updated_at desc, id)
  where (numero_processo is null or numero_processo = '')
    and fase_atual in ('Solicitado para Ajuizamento', 'Documentação', 'Procuração', 'CRM', 'Enviado para Elite', 'SLA', 'Pasta Retornada', 'Pré-Distribuição', 'Distribuição', 'Documentos Pendentes', 'Documentos Concluídos');
commit;
