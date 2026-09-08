-- Estrutura central de Clientes do Platino Workspace.
-- Migration incremental e não destrutiva.
-- Não remove dados, não reseta tabelas e não apaga a estrutura antiga.
-- Reforça a regra: cliente não é processo.

begin;

create extension if not exists pgcrypto;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  cpf text,
  rg text,
  data_nascimento date,
  telefone text,
  email text,
  endereco text,
  id_crm text,
  responsavel text,
  observacoes text,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.clientes add column if not exists nome_completo text;
alter table public.clientes add column if not exists cpf text;
alter table public.clientes add column if not exists rg text;
alter table public.clientes add column if not exists data_nascimento date;
alter table public.clientes add column if not exists telefone text;
alter table public.clientes add column if not exists email text;
alter table public.clientes add column if not exists endereco text;
alter table public.clientes add column if not exists id_crm text;
alter table public.clientes add column if not exists responsavel text;
alter table public.clientes add column if not exists observacoes text;
alter table public.clientes add column if not exists created_at timestamptz not null default now();
alter table public.clientes add column if not exists created_by text;
alter table public.clientes add column if not exists updated_at timestamptz not null default now();
alter table public.clientes add column if not exists updated_by text;

create index if not exists clientes_nome_idx on public.clientes (lower(nome_completo));
create index if not exists clientes_cpf_idx on public.clientes (cpf);
create index if not exists clientes_id_crm_idx on public.clientes (id_crm);

create or replace function public.atualizar_updated_at_clientes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clientes_updated_at on public.clientes;
create trigger clientes_updated_at
before update on public.clientes
for each row execute function public.atualizar_updated_at_clientes();

-- Histórico geral do cliente. Não substitui movimentações processuais.
create table if not exists public.clientes_historico (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null default 'evento',
  descricao text not null,
  origem text,
  processo_id uuid,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists clientes_historico_cliente_idx
  on public.clientes_historico (cliente_id, created_at desc);

-- Vínculo futuro: processo pertence a um cliente, mas cliente não é processo.
do $$
begin
  if to_regclass('public.processos') is not null then
    alter table public.processos add column if not exists cliente_id uuid;
    alter table public.processos add column if not exists responsavel text;

    if not exists (
      select 1 from pg_constraint
      where conname = 'processos_cliente_id_fkey'
        and conrelid = 'public.processos'::regclass
    ) then
      alter table public.processos
        add constraint processos_cliente_id_fkey
        foreign key (cliente_id) references public.clientes(id)
        on delete set null;
    end if;

    create index if not exists processos_cliente_id_idx
      on public.processos (cliente_id, updated_at desc);
  end if;
end;
$$;

-- Vínculo opcional dos documentos ao cliente, mantendo os campos atuais por nome/CPF.
do $$
begin
  if to_regclass('public.documentos_juridicos') is not null then
    alter table public.documentos_juridicos add column if not exists cliente_id uuid;

    if not exists (
      select 1 from pg_constraint
      where conname = 'documentos_juridicos_cliente_id_fkey'
        and conrelid = 'public.documentos_juridicos'::regclass
    ) then
      alter table public.documentos_juridicos
        add constraint documentos_juridicos_cliente_id_fkey
        foreign key (cliente_id) references public.clientes(id)
        on delete set null;
    end if;

    create index if not exists documentos_juridicos_cliente_id_idx
      on public.documentos_juridicos (cliente_id, created_at desc);
  end if;
end;
$$;

alter table public.clientes enable row level security;
alter table public.clientes_historico enable row level security;

revoke all on public.clientes from anon;
revoke all on public.clientes_historico from anon;

grant select, insert, update, delete on public.clientes to authenticated;
grant select, insert, update, delete on public.clientes_historico to authenticated;

drop policy if exists "Equipe gerencia clientes" on public.clientes;
create policy "Equipe gerencia clientes"
on public.clientes for all to authenticated
using (true)
with check (true);

drop policy if exists "Equipe gerencia historico de clientes" on public.clientes_historico;
create policy "Equipe gerencia historico de clientes"
on public.clientes_historico for all to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
commit;
