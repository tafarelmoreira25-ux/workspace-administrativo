-- PLATINO TASKMANAGER V1.0 · CAMADA DE SIMPLIFICACAO
-- Execute depois de motor_operacional_tarefas_2026.sql.
-- Migracao aditiva: preserva tarefas, historico e estados tecnicos existentes.
begin;

alter table public.tarefas
  add column if not exists fase_esteira smallint,
  add column if not exists codigo_taskmanager text,
  add column if not exists pendencia_codigo text,
  add column if not exists pendencia_detalhes text,
  add column if not exists pendencia_aberta_em timestamptz,
  add column if not exists pendencia_resolvida_em timestamptz;

alter table public.tarefas drop constraint if exists tarefas_fase_esteira_check;
alter table public.tarefas add constraint tarefas_fase_esteira_check
  check (fase_esteira between 1 and 9);

create table if not exists public.taskmanager_catalogo (
  codigo text primary key,
  nome text not null,
  fase_esteira smallint not null check (fase_esteira between 1 and 9),
  departamento_responsavel text not null,
  gatilho text not null,
  documentos_obrigatorios jsonb not null default '[]'::jsonb,
  sla_minutos integer check (sla_minutos is null or sla_minutos > 0),
  pasta_drive text not null,
  requer_validacao_supervisor boolean not null default false,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.taskmanager_catalogo
  (codigo,nome,fase_esteira,departamento_responsavel,gatilho,documentos_obrigatorios,sla_minutos,pasta_drive,requer_validacao_supervisor)
values
  ('T01','Validar contrato e abrir pasta',1,'Administrativo','Comercial envia contrato assinado','["Contrato Platino assinado"]',1440,'01_CONTRATO_E_ASSINATURAS',false),
  ('T02','Conferir documentos e preencher termos',2,'Administrativo / Juridico','T01 concluida','["RG ou CNH","CCB ou contrato bancario","Ultima parcela paga","Comprovante de endereco com ate 60 dias","CRV"]',1440,'02_DOCUMENTOS_INICIAIS',false),
  ('T03','Executar requerimento GOV.BR',3,'Administrativo','Solicitacao do Juridico','["Requerimento","Protocolo GOV"]',120,'03_NOTIFICACOES_E_TERMOS',false),
  ('T04','Compilar comprovantes de protocolo',4,'Administrativo','Protocolo ou e-mail externo emitido','["PDF do protocolo","Comprovante de envio"]',240,'04_PROTOCOLOS_OFICIAIS',false),
  ('T05','Solicitar laudo tecnico individual',5,'Juridico / Contabilidade','CRM alterado para Laudo Fechado','["Evidencias da tratativa","Contrato bancario individualizado"]',2880,'05_EVIDENCIAS_DE_ATENDIMENTO',false),
  ('T06','Montar kit judicial',6,'Juridico','Laudo conferido','["Laudo","Procuracao","Declaracoes aplicaveis"]',1440,'06_LAUDOS_E_CALCULOS',false),
  ('T07','Distribuir e acompanhar acao',7,'Processual','Pasta marcada Pronto para o Processual','["Peticao","Documentos judiciais","Comprovante de distribuicao"]',480,'07_DOCUMENTOS_JUDICIAIS',false),
  ('T08','Concluir audiencia e valores finais',8,'Juridico / Processual','Audiencia agendada','["Ata","Termo de acordo ou decisao"]',1440,'09_ATAS_E_DECISOES',false),
  ('T09','Encerrar financeiro e arquivar',9,'Administrativo','Processo ou acordo encerrado','["Guias","Comprovantes financeiros","Checklist de encerramento"]',1440,'08_FINANCEIRO_E_CUSTAS',false),
  ('CHARGEBACK','Preparar defesa de chargeback',5,'Administrativo / Supervisao','Notificacao da intermediadora','["Logs Clicksign","Hash SHA256","IP","Token","PDF da defesa"]',4320,'05_EVIDENCIAS_DE_ATENDIMENTO',true)
on conflict (codigo) do update set
  nome=excluded.nome,
  fase_esteira=excluded.fase_esteira,
  departamento_responsavel=excluded.departamento_responsavel,
  gatilho=excluded.gatilho,
  documentos_obrigatorios=excluded.documentos_obrigatorios,
  sla_minutos=excluded.sla_minutos,
  pasta_drive=excluded.pasta_drive,
  requer_validacao_supervisor=excluded.requer_validacao_supervisor,
  ativo=excluded.ativo,
  updated_at=now();

create or replace function public.inferir_fase_taskmanager(
  p_codigo text,
  p_categoria text,
  p_titulo text,
  p_descricao text
) returns smallint language sql immutable as $$
  select case
    when lower(concat_ws(' ',p_codigo,p_categoria,p_titulo,p_descricao)) ~ 'audiencia|audiência|homolog|conciliacao|conciliação|ata' then 8
    when lower(concat_ws(' ',p_codigo,p_categoria,p_titulo,p_descricao)) ~ 'financeir|encerramento|custas|pagamento final' then 9
    when lower(concat_ws(' ',p_codigo,p_categoria,p_titulo,p_descricao)) ~ 'processual|judicial|procurac|distribui|citacao|citação|forum|fórum' then 7
    when lower(concat_ws(' ',p_codigo,p_categoria,p_titulo,p_descricao)) ~ 'laudo|parecer|contabil|contábil|kit judicial' then 6
    when lower(concat_ws(' ',p_codigo,p_categoria,p_titulo,p_descricao)) ~ 'evidencia|evidência|whatsapp|diligencia|diligência|acompanhamento|retorno' then 5
    when lower(concat_ws(' ',p_codigo,p_categoria,p_titulo,p_descricao)) ~ 'protocolo|comprovante de envio|certidao|certidão' then 4
    when lower(concat_ws(' ',p_codigo,p_categoria,p_titulo,p_descricao)) ~ 'gov|notific|extrajudicial|requerimento|termo' then 3
    when lower(concat_ws(' ',p_codigo,p_categoria,p_titulo,p_descricao)) ~ 'documentos iniciais|ccb|crv|comprovante de endereco|comprovante de endereço|ultima parcela|última parcela' then 2
    else 1
  end::smallint;
$$;

create or replace function public.preencher_fase_taskmanager()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.fase_esteira is null then
    new.fase_esteira := public.inferir_fase_taskmanager(
      new.codigo_etapa,
      new.categoria,
      new.titulo,
      new.descricao
    );
  end if;
  return new;
end $$;

drop trigger if exists preencher_fase_taskmanager on public.tarefas;
create trigger preencher_fase_taskmanager
before insert or update of codigo_etapa,categoria,titulo,descricao,fase_esteira
on public.tarefas for each row execute function public.preencher_fase_taskmanager();

update public.tarefas
set fase_esteira = public.inferir_fase_taskmanager(codigo_etapa,categoria,titulo,descricao)
where fase_esteira is null;

create or replace view public.tarefas_taskmanager_v1
with (security_invoker=true) as
select
  t.*,
  case
    when t.status in ('concluida','arquivada','cancelada') then 'Concluida'
    when t.status in ('devolvida_conferencia','em_revisao') then 'Validacao_Supervisor'
    when t.status in ('aguardando_informacao','aguardando_cliente','aguardando_banco','aguardando_juridico','aguardando_judiciario','impedida','bloqueada','devolvida','devolvida_correcao') then 'Pendente_Bloqueada'
    when t.status in ('em_execucao','em_andamento') then 'Em_Andamento'
    else 'Fila'
  end as status_taskmanager,
  case
    when t.status in ('concluida','arquivada','cancelada') then 'encerrado'
    when coalesce(t.prazo_limite,t.data_limite::timestamptz) < now() then 'estourado'
    when coalesce(t.prazo_limite,t.data_limite::timestamptz) <= now() + interval '24 hours' then 'vermelho'
    when coalesce(t.prazo_limite,t.data_limite::timestamptz) <= now() + interval '48 hours' then 'amarelo'
    else 'verde'
  end as nivel_sla
from public.tarefas t;

create index if not exists tarefas_taskmanager_fase_status_idx
  on public.tarefas(fase_esteira,status,prazo_limite);

alter table public.taskmanager_catalogo enable row level security;
revoke all on public.taskmanager_catalogo from anon;
grant select on public.taskmanager_catalogo,public.tarefas_taskmanager_v1 to authenticated;

drop policy if exists "Equipe consulta catalogo TaskManager" on public.taskmanager_catalogo;
create policy "Equipe consulta catalogo TaskManager"
on public.taskmanager_catalogo for select to authenticated using (true);

comment on column public.tarefas.fase_esteira is
  'Fase operacional de 1 a 9. O status tecnico continua no campo status.';
comment on view public.tarefas_taskmanager_v1 is
  'Traduz estados tecnicos para os cinco estados simples exibidos aos usuarios.';

select pg_notify('pgrst','reload schema');
commit;
