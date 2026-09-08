-- Etapa 9 — Controle Gerencial e Auditoria
-- Migration segura e aditiva: cria entidades gerenciais sem apagar dados existentes.

begin;

create extension if not exists pgcrypto;

create table if not exists public.processual_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid null,
  processo_id uuid null references public.processos(id) on delete set null,
  cliente_nome text,
  categoria text not null,
  data date not null default current_date,
  descricao text not null,
  responsabilidade text not null default 'Não identificado',
  impacto text,
  providencia text,
  prazo date,
  resolvido boolean not null default false,
  data_resolucao date,
  evidencia text,
  anexo_url text,
  responsavel text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processual_custas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid null,
  processo_id uuid null references public.processos(id) on delete set null,
  cliente_nome text,
  tipo text not null,
  valor numeric(12,2) not null default 0,
  solicitacao date,
  vencimento date,
  status text not null default 'Pendente',
  pagamento date,
  comprovante_url text,
  responsavel text,
  observacao text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processual_etiquetas (
  id uuid primary key default gen_random_uuid(),
  entidade_tipo text not null,
  entidade_id uuid,
  etiqueta text not null,
  origem text not null default 'manual',
  ativa boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processual_auditoria_geral (
  id uuid primary key default gen_random_uuid(),
  usuario text,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  antes jsonb,
  depois jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.processual_ocorrencias drop constraint if exists processual_ocorrencias_categoria_check;
alter table public.processual_ocorrencias add constraint processual_ocorrencias_categoria_check check (
  categoria in (
    'Custas',
    'Documentação',
    'Emenda',
    'Prazo',
    'Pasta retornada',
    'Falha operacional',
    'Falha cliente',
    'Falha prestador',
    'Divergência documental',
    'Comunicação',
    'Outro'
  )
);

alter table public.processual_ocorrencias drop constraint if exists processual_ocorrencias_responsabilidade_check;
alter table public.processual_ocorrencias add constraint processual_ocorrencias_responsabilidade_check check (
  responsabilidade in ('Cliente', 'Platino', 'Elite', 'Advogado', 'Terceiro', 'Não identificado')
);

alter table public.processual_custas drop constraint if exists processual_custas_status_check;
alter table public.processual_custas add constraint processual_custas_status_check check (
  status in ('Pendente', 'Cliente informado', 'Pago', 'Não pago', 'Vencido', 'Dispensado')
);

alter table public.processual_etiquetas drop constraint if exists processual_etiquetas_origem_check;
alter table public.processual_etiquetas add constraint processual_etiquetas_origem_check check (
  origem in ('manual', 'automatica')
);

create or replace function public.atualizar_updated_at_gerencial_processual()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists processual_ocorrencias_updated_at on public.processual_ocorrencias;
create trigger processual_ocorrencias_updated_at
before update on public.processual_ocorrencias
for each row execute function public.atualizar_updated_at_gerencial_processual();

drop trigger if exists processual_custas_updated_at on public.processual_custas;
create trigger processual_custas_updated_at
before update on public.processual_custas
for each row execute function public.atualizar_updated_at_gerencial_processual();

drop trigger if exists processual_etiquetas_updated_at on public.processual_etiquetas;
create trigger processual_etiquetas_updated_at
before update on public.processual_etiquetas
for each row execute function public.atualizar_updated_at_gerencial_processual();

create index if not exists processual_ocorrencias_processo_idx
  on public.processual_ocorrencias (processo_id, data desc)
  where deleted_at is null;

create index if not exists processual_ocorrencias_categoria_idx
  on public.processual_ocorrencias (categoria, responsabilidade, resolvido, prazo)
  where deleted_at is null;

create index if not exists processual_custas_processo_idx
  on public.processual_custas (processo_id, vencimento, status)
  where deleted_at is null;

create index if not exists processual_custas_status_idx
  on public.processual_custas (status, vencimento)
  where deleted_at is null;

create index if not exists processual_etiquetas_entidade_idx
  on public.processual_etiquetas (entidade_tipo, entidade_id, ativa);

create index if not exists processual_auditoria_entidade_idx
  on public.processual_auditoria_geral (entidade, entidade_id, created_at desc);

do $$
begin
  if to_regclass('public.processos') is not null then
    create index if not exists processos_busca_gerencial_idx
      on public.processos (nome_cliente, cpf_cliente, numero_processo, banco_reu);
  end if;

  if to_regclass('public.clientes') is not null then
    create index if not exists clientes_busca_gerencial_idx
      on public.clientes (nome_completo, cpf, id_crm);
  end if;
end;
$$;

alter table public.processual_ocorrencias enable row level security;
alter table public.processual_custas enable row level security;
alter table public.processual_etiquetas enable row level security;
alter table public.processual_auditoria_geral enable row level security;

revoke all on public.processual_ocorrencias from anon;
revoke all on public.processual_custas from anon;
revoke all on public.processual_etiquetas from anon;
revoke all on public.processual_auditoria_geral from anon;

grant select, insert, update on public.processual_ocorrencias to authenticated;
grant select, insert, update on public.processual_custas to authenticated;
grant select, insert, update on public.processual_etiquetas to authenticated;
grant select, insert on public.processual_auditoria_geral to authenticated;

drop policy if exists "Equipe gerencia ocorrencias processuais" on public.processual_ocorrencias;
create policy "Equipe gerencia ocorrencias processuais"
on public.processual_ocorrencias for all to authenticated
using (true)
with check (true);

drop policy if exists "Equipe gerencia custas processuais" on public.processual_custas;
create policy "Equipe gerencia custas processuais"
on public.processual_custas for all to authenticated
using (true)
with check (true);

drop policy if exists "Equipe gerencia etiquetas processuais" on public.processual_etiquetas;
create policy "Equipe gerencia etiquetas processuais"
on public.processual_etiquetas for all to authenticated
using (true)
with check (true);

drop policy if exists "Equipe registra auditoria geral processual" on public.processual_auditoria_geral;
create policy "Equipe registra auditoria geral processual"
on public.processual_auditoria_geral for insert to authenticated
with check (true);

drop policy if exists "Equipe consulta auditoria geral processual" on public.processual_auditoria_geral;
create policy "Equipe consulta auditoria geral processual"
on public.processual_auditoria_geral for select to authenticated
using (true);

commit;
