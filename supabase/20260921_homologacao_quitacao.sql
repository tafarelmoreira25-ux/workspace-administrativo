-- Homologacao e Quitacao
-- Estrutura aditiva: ficha principal, historico, propostas, reunioes, diligencias,
-- documentos, quitacao e historico de status.

begin;

create extension if not exists pgcrypto;

create table if not exists public.homologacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint null,
  processo_id bigint null,
  cliente_nome text not null,
  cpf_cnpj text,
  telefone text,
  numero_contrato text,
  instituicao_financeira text,
  assessoria_banco text,
  representante_nome text,
  representante_contato text,
  veiculo text,
  placa text,
  valor_parcela numeric(14,2),
  quantidade_parcelas integer,
  parcelas_atraso integer,
  saldo_devedor_atualizado numeric(14,2),
  valor_previsto_minuta numeric(14,2),
  link_pasta_cliente text,
  negociador_responsavel text,
  data_inicio date not null default current_date,
  status text not null default 'Aguardando primeiro contato',
  ultima_movimentacao timestamptz,
  proxima_providencia text,
  data_prevista_retorno date,
  prioridade text not null default 'Normal',
  responsavel_atual text,
  motivo_pendencia text,
  resultado_final text,
  origem_alteracao text,
  versao integer not null default 1,
  auditoria jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homologacao_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  homologacao_id uuid not null references public.homologacoes(id) on delete cascade,
  data_hora timestamptz not null default now(),
  tipo text not null,
  canal text,
  pessoa_contatada text,
  instituicao text,
  contato_utilizado text,
  protocolo text,
  descricao text not null,
  resultado_contato text,
  pendencia_identificada text,
  proxima_providencia text,
  responsavel_proxima text,
  prazo_retorno date,
  arquivos_evidencias text,
  origem_alteracao text,
  versao integer not null default 1,
  auditoria jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homologacao_propostas (
  id uuid primary key default gen_random_uuid(),
  homologacao_id uuid not null references public.homologacoes(id) on delete cascade,
  data_proposta date,
  saldo_banco numeric(14,2),
  valor_cliente numeric(14,2),
  valor_banco numeric(14,2),
  valor_contraproposta numeric(14,2),
  valor_final numeric(14,2),
  percentual_desconto numeric(8,2),
  quantidade_parcelas integer,
  valor_entrada numeric(14,2),
  valor_parcelas numeric(14,2),
  vencimento date,
  validade date,
  parcelas_atraso integer,
  encargos text,
  condicoes_quitacao text,
  representante text,
  decisao text not null default 'Em análise',
  justificativa text,
  comprovante_url text,
  origem_alteracao text,
  versao integer not null default 1,
  auditoria jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homologacao_reunioes (
  id uuid primary key default gen_random_uuid(),
  homologacao_id uuid not null references public.homologacoes(id) on delete cascade,
  data_hora timestamptz,
  participantes text,
  representante_instituicao text,
  local_plataforma text,
  link_reuniao text,
  pauta text,
  assuntos_discutidos text,
  deliberacoes text,
  compromissos text,
  prazos_definidos text,
  ata_gravacao_url text,
  proxima_reuniao timestamptz,
  origem_alteracao text,
  versao integer not null default 1,
  auditoria jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homologacao_diligencias (
  id uuid primary key default gen_random_uuid(),
  homologacao_id uuid not null references public.homologacoes(id) on delete cascade,
  tipo_diligencia text,
  solicitante text,
  destinatario text,
  data_solicitacao date,
  prazo date,
  finalidade text,
  resultado text,
  custos numeric(14,2),
  comprovante_url text,
  situacao text,
  origem_alteracao text,
  versao integer not null default 1,
  auditoria jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homologacao_documentos (
  id uuid primary key default gen_random_uuid(),
  homologacao_id uuid not null references public.homologacoes(id) on delete cascade,
  categoria text not null,
  nome text not null,
  url text,
  obrigatorio_quitacao boolean not null default false,
  ausencia_justificada boolean not null default false,
  justificativa_ausencia text,
  origem_alteracao text,
  versao integer not null default 1,
  auditoria jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homologacao_quitacoes (
  id uuid primary key default gen_random_uuid(),
  homologacao_id uuid not null unique references public.homologacoes(id) on delete cascade,
  valor_pago numeric(14,2),
  data_pagamento date,
  forma_pagamento text,
  instituicao_recebedora text,
  identificacao_boleto text,
  comprovante_pagamento_url text,
  confirmacao_instituicao_url text,
  termo_quitacao_url text,
  data_baixa_gravame date,
  situacao_gravame text,
  documento_final_url text,
  observacoes_encerramento text,
  justificativa_documentos_ausentes text,
  autorizado_por text,
  origem_alteracao text,
  versao integer not null default 1,
  auditoria jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.homologacao_status_historico (
  id uuid primary key default gen_random_uuid(),
  homologacao_id uuid not null references public.homologacoes(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  motivo text,
  origem_alteracao text,
  versao integer not null default 1,
  auditoria jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.homologacoes drop constraint if exists homologacoes_status_check;
alter table public.homologacoes add constraint homologacoes_status_check check (status in (
  'Aguardando primeiro contato','Contato iniciado','Aguardando retorno da instituição','Em negociação','Proposta recebida','Proposta enviada ao cliente','Aguardando decisão do cliente','Proposta aceita','Aguardando minuta','Minuta recebida','Aguardando assinatura','Aguardando boleto','Aguardando pagamento','Pagamento realizado','Aguardando confirmação de quitação','Contrato quitado','Negociação sem acordo','Encaminhado ao Processual','Suspenso','Cancelado'
));

alter table public.homologacoes drop constraint if exists homologacoes_prioridade_check;
alter table public.homologacoes add constraint homologacoes_prioridade_check check (prioridade in ('Baixa','Normal','Alta','Crítica'));

alter table public.homologacao_movimentacoes drop constraint if exists homologacao_movimentacoes_tipo_check;
alter table public.homologacao_movimentacoes add constraint homologacao_movimentacoes_tipo_check check (tipo in (
  'Contato com o cliente','Contato com a instituição financeira','Ligação','WhatsApp','E-mail','Diligência','Reunião','Audiência extrajudicial','Proposta recebida','Contraproposta apresentada','Minuta recebida','Documento enviado','Assinatura realizada','Boleto recebido','Pagamento informado','Confirmação de quitação','Observação interna'
));

alter table public.homologacao_propostas drop constraint if exists homologacao_propostas_decisao_check;
alter table public.homologacao_propostas add constraint homologacao_propostas_decisao_check check (decisao in ('Aceita','Recusada','Vencida','Em análise'));

create or replace function public.homologacao_touch_audit()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.versao = coalesce(old.versao, 0) + 1;
  new.auditoria = coalesce(old.auditoria, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'changed_at', now(),
    'changed_by', auth.uid(),
    'origem_alteracao', coalesce(new.origem_alteracao, old.origem_alteracao),
    'versao_anterior', old.versao
  ));
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'homologacoes','homologacao_movimentacoes','homologacao_propostas',
    'homologacao_reunioes','homologacao_diligencias','homologacao_documentos',
    'homologacao_quitacoes','homologacao_status_historico'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_audit', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.homologacao_touch_audit()', t || '_touch_audit', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', 'Equipe gerencia ' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'Equipe gerencia ' || t, t);
  end loop;
end $$;

create index if not exists homologacoes_cliente_idx on public.homologacoes (cliente_id, updated_at desc);
create index if not exists homologacoes_status_idx on public.homologacoes (status, prioridade, updated_at desc);
create index if not exists homologacao_movimentacoes_homologacao_idx on public.homologacao_movimentacoes (homologacao_id, data_hora desc);
create index if not exists homologacao_propostas_homologacao_idx on public.homologacao_propostas (homologacao_id, data_proposta desc);
create index if not exists homologacao_documentos_homologacao_idx on public.homologacao_documentos (homologacao_id, created_at desc);

commit;
