-- Etapa 4: Protocolos, esteira de ajuizamento e SLA.
-- Migration incremental e não destrutiva.
-- Não remove dados, não reseta banco e não altera o Gerador de Documentos.

begin;

create extension if not exists pgcrypto;

create table if not exists public.feriados_processuais (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  descricao text not null,
  abrangencia text not null default 'nacional',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text
);

alter table public.feriados_processuais enable row level security;
revoke all on public.feriados_processuais from anon;
grant select, insert, update, delete on public.feriados_processuais to authenticated;

drop policy if exists "Equipe gerencia feriados processuais" on public.feriados_processuais;
create policy "Equipe gerencia feriados processuais"
on public.feriados_processuais for all to authenticated
using (true)
with check (true);

do $$
begin
  if to_regclass('public.processos') is not null then
    alter table public.processos add column if not exists id_crm text;
    alter table public.processos add column if not exists produto text;
    alter table public.processos add column if not exists numero_contrato text;
    alter table public.processos add column if not exists motivo_ajuizamento text;
    alter table public.processos add column if not exists responsavel text;
    alter table public.processos add column if not exists updated_by text;

    alter table public.processos add column if not exists documentacao_status text not null default 'Pendente';
    alter table public.processos add column if not exists documentacao_motivo text;
    alter table public.processos add column if not exists documentacao_faltantes text;
    alter table public.processos add column if not exists documentacao_responsabilidade text;
    alter table public.processos add column if not exists documentacao_observacao text;
    alter table public.processos add column if not exists documentacao_data date;

    alter table public.processos add column if not exists procuracao_status text not null default 'Elaborando';
    alter table public.processos add column if not exists declaracao_hipossuficiencia_status text not null default 'Elaborando';
    alter table public.processos add column if not exists declaracao_ir_status text not null default 'Elaborando';
    alter table public.processos add column if not exists procuracoes_outros text;

    alter table public.processos add column if not exists crm_documentos_status text not null default 'Pendente';
    alter table public.processos add column if not exists crm_documentos_data timestamptz;
    alter table public.processos add column if not exists crm_documentos_responsavel text;
    alter table public.processos add column if not exists crm_documentos_usuario text;

    alter table public.processos add column if not exists sla_iniciado_em timestamptz;
    alter table public.processos add column if not exists sla_encerrado_em timestamptz;
    alter table public.processos add column if not exists sla_dias_uteis_utilizados integer;

    alter table public.processos add column if not exists pasta_retorno_status text not null default 'Não retornada';
    alter table public.processos add column if not exists pasta_retorno_data date;
    alter table public.processos add column if not exists pasta_retorno_motivo text;
    alter table public.processos add column if not exists pasta_retorno_descricao text;
    alter table public.processos add column if not exists pasta_retorno_responsabilidade text;
    alter table public.processos add column if not exists pasta_retorno_documento_faltante text;
    alter table public.processos add column if not exists pasta_retorno_data_regularizacao date;
    alter table public.processos add column if not exists pasta_retorno_data_reenvio date;
    alter table public.processos add column if not exists pasta_retorno_observacao text;
    alter table public.processos add column if not exists pasta_retorno_impacto_sla text not null default 'não altera';

    alter table public.processos add column if not exists protocolo_status text not null default 'Aguardando';
    alter table public.processos add column if not exists protocolo_data_liberacao timestamptz;
    alter table public.processos add column if not exists tribunal text;
    alter table public.processos add column if not exists comarca text;

    alter table public.processos drop constraint if exists processos_documentacao_status_check;
    alter table public.processos add constraint processos_documentacao_status_check
      check (documentacao_status in ('Pendente', 'Regular', 'Irregular'));

    alter table public.processos drop constraint if exists processos_procuracao_status_check;
    alter table public.processos add constraint processos_procuracao_status_check
      check (procuracao_status in ('Elaborando', 'Aguardando assinatura', 'Assinado', 'Pendente', 'Atrasado'));

    alter table public.processos drop constraint if exists processos_declaracao_hipossuficiencia_status_check;
    alter table public.processos add constraint processos_declaracao_hipossuficiencia_status_check
      check (declaracao_hipossuficiencia_status in ('Elaborando', 'Aguardando assinatura', 'Assinado', 'Pendente', 'Atrasado'));

    alter table public.processos drop constraint if exists processos_declaracao_ir_status_check;
    alter table public.processos add constraint processos_declaracao_ir_status_check
      check (declaracao_ir_status in ('Elaborando', 'Aguardando assinatura', 'Assinado', 'Pendente', 'Atrasado'));

    alter table public.processos drop constraint if exists processos_crm_documentos_status_check;
    alter table public.processos add constraint processos_crm_documentos_status_check
      check (crm_documentos_status in ('Pendente', 'Concluído'));

    alter table public.processos drop constraint if exists processos_documentos_elite_status_check;
    alter table public.processos add constraint processos_documentos_elite_status_check
      check (documentos_elite_status in ('Pendente', 'Enviado'));

    alter table public.processos drop constraint if exists processos_pasta_retorno_status_check;
    alter table public.processos add constraint processos_pasta_retorno_status_check
      check (pasta_retorno_status in ('Não retornada', 'Retornada', 'Em regularização', 'Reenviada'));

    alter table public.processos drop constraint if exists processos_pasta_retorno_responsabilidade_check;
    alter table public.processos add constraint processos_pasta_retorno_responsabilidade_check
      check (pasta_retorno_responsabilidade is null or pasta_retorno_responsabilidade in ('Cliente', 'Platino', 'Elite', 'Advogado', 'Terceiro', 'Indefinido'));

    alter table public.processos drop constraint if exists processos_pasta_retorno_impacto_sla_check;
    alter table public.processos add constraint processos_pasta_retorno_impacto_sla_check
      check (pasta_retorno_impacto_sla in ('não altera', 'pausa', 'reinicia'));

    alter table public.processos drop constraint if exists processos_protocolo_status_check;
    alter table public.processos add constraint processos_protocolo_status_check
      check (protocolo_status in ('Aguardando', 'Liberado'));

    create index if not exists processos_protocolos_busca_idx
      on public.processos (nome_cliente, cpf_cliente, id_crm, banco_reu);
    create index if not exists processos_sla_idx
      on public.processos (data_envio_elite, protocolo_status, sla_encerrado_em);
    create index if not exists processos_protocolo_status_idx
      on public.processos (protocolo_status, updated_at desc);
  end if;
end;
$$;

create table if not exists public.processos_auditoria (
  id uuid primary key default gen_random_uuid(),
  processo_id text not null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  usuario text,
  created_at timestamptz not null default now()
);

create index if not exists processos_auditoria_processo_idx
  on public.processos_auditoria (processo_id, created_at desc);

alter table public.processos_auditoria enable row level security;
revoke all on public.processos_auditoria from anon;
grant select, insert on public.processos_auditoria to authenticated;

drop policy if exists "Equipe consulta auditoria de processos" on public.processos_auditoria;
create policy "Equipe consulta auditoria de processos"
on public.processos_auditoria for select to authenticated
using (true);

drop policy if exists "Equipe registra auditoria de processos" on public.processos_auditoria;
create policy "Equipe registra auditoria de processos"
on public.processos_auditoria for insert to authenticated
with check (true);

notify pgrst, 'reload schema';
commit;
