-- Esteira Processual PLATINO
-- Execute depois de remover ou migrar a estrutura antiga de processos.
-- Cria Protocolos, Processos e o checklist de documentos da Elite.
-- Não armazena arquivos no Supabase Storage: a pasta oficial permanece no Drive.

begin;

create extension if not exists pgcrypto;

create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  pasta_cliente_id text,
  link_pasta_cliente text,
  autor_reu text,
  nome_cliente text not null,
  cpf_cliente text,
  banco_reu text,
  fase_atual text not null default 'Solicitado para Ajuizamento',
  status_judicial text,
  status_documentos text not null default 'Pendente',
  status_procuracao text not null default 'Pendente',
  documentos_elite_status text not null default 'Pendente',
  pasta_retornada boolean not null default false,
  status_prazo text,
  data_envio_elite timestamptz,
  data_protocolo_liberado timestamptz,
  data_distribuicao date,
  numero_processo text,
  vara text,
  justica_gratuita text not null default 'Não Solicitada',
  emenda_inicial text,
  link_processo text,
  link_consulta text,
  observacoes text,
  checklist_elite jsonb not null default '{}'::jsonb,
  origem_registro text not null default 'manual',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.processos drop constraint if exists processos_fase_atual_check;
alter table public.processos add constraint processos_fase_atual_check check (
  fase_atual in (
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

alter table public.processos drop constraint if exists processos_justica_gratuita_check;
alter table public.processos add constraint processos_justica_gratuita_check check (
  justica_gratuita in ('Deferida', 'Indeferida', 'Não Solicitada')
);

alter table public.processos add column if not exists pasta_cliente_id text;
alter table public.processos add column if not exists link_pasta_cliente text;
alter table public.processos add column if not exists autor_reu text;
alter table public.processos add column if not exists cpf_cliente text;
alter table public.processos add column if not exists status_judicial text;
alter table public.processos add column if not exists status_documentos text not null default 'Pendente';
alter table public.processos add column if not exists status_procuracao text not null default 'Pendente';
alter table public.processos add column if not exists documentos_elite_status text not null default 'Pendente';
alter table public.processos add column if not exists pasta_retornada boolean not null default false;
alter table public.processos add column if not exists data_protocolo_liberado timestamptz;
alter table public.processos add column if not exists data_distribuicao date;
alter table public.processos add column if not exists emenda_inicial text;
alter table public.processos add column if not exists link_processo text;
alter table public.processos add column if not exists link_consulta text;
alter table public.processos add column if not exists origem_registro text not null default 'manual';

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  data_registro timestamptz not null default now(),
  descricao text not null,
  tipo text not null default 'andamento',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.processos_documentos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  tipo_documento text not null check (
    tipo_documento in (
      'rg_cnh',
      'comprovante_residencia',
      'contrato_integra',
      'extratos_holerites',
      'procuracao_assinada'
    )
  ),
  status text not null default 'Pendente',
  link_drive text,
  observacao text,
  armazenamento_oficial text not null default 'Drive',
  conferido_by uuid default auth.uid() references auth.users(id) on delete set null,
  conferido_em timestamptz,
  bucket text,
  arquivo_path text,
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
  uploaded_at timestamptz,
  unique (processo_id, tipo_documento)
);

alter table public.processos_documentos add column if not exists status text not null default 'Pendente';
alter table public.processos_documentos add column if not exists link_drive text;
alter table public.processos_documentos add column if not exists observacao text;
alter table public.processos_documentos add column if not exists armazenamento_oficial text not null default 'Drive';
alter table public.processos_documentos add column if not exists conferido_by uuid default auth.uid() references auth.users(id) on delete set null;
alter table public.processos_documentos add column if not exists conferido_em timestamptz;
alter table public.processos_documentos alter column arquivo_path drop not null;
alter table public.processos_documentos alter column bucket drop not null;

create or replace function public.atualizar_updated_at_processos()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists processos_updated_at on public.processos;
create trigger processos_updated_at
before update on public.processos
for each row execute function public.atualizar_updated_at_processos();

create index if not exists processos_fase_idx on public.processos (fase_atual, updated_at desc);
create index if not exists processos_cliente_idx on public.processos (nome_cliente);
create index if not exists movimentacoes_processo_idx on public.movimentacoes (processo_id, data_registro desc);
create index if not exists processos_documentos_processo_idx on public.processos_documentos (processo_id);

alter table public.processos enable row level security;
alter table public.movimentacoes enable row level security;
alter table public.processos_documentos enable row level security;

revoke all on public.processos from anon;
revoke all on public.movimentacoes from anon;
revoke all on public.processos_documentos from anon;

grant select, insert, update, delete on public.processos to authenticated;
grant select, insert, update, delete on public.movimentacoes to authenticated;
grant select, insert, update, delete on public.processos_documentos to authenticated;

drop policy if exists "Equipe gerencia processos" on public.processos;
create policy "Equipe gerencia processos"
on public.processos for all to authenticated
using (true)
with check (true);

drop policy if exists "Equipe gerencia movimentacoes" on public.movimentacoes;
create policy "Equipe gerencia movimentacoes"
on public.movimentacoes for all to authenticated
using (true)
with check (true);

drop policy if exists "Equipe gerencia documentos de processos" on public.processos_documentos;
create policy "Equipe gerencia documentos de processos"
on public.processos_documentos for all to authenticated
using (true)
with check (true);

commit;
