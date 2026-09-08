-- Etapa 8 — Integração com Gerador de Documentos
-- Migration segura e aditiva. Não recria o Gerador e não apaga documentos existentes.

begin;

alter table if exists public.documentos_juridicos
  add column if not exists cliente_id uuid,
  add column if not exists processo_id uuid,
  add column if not exists tipo_documento text,
  add column if not exists assinado boolean not null default false,
  add column if not exists comunicado_em timestamptz,
  add column if not exists comunicado_canal text,
  add column if not exists comunicado_observacao text,
  add column if not exists substitui_documento_id uuid,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.clientes') is not null
    and to_regclass('public.documentos_juridicos') is not null
    and not exists (
      select 1 from pg_constraint
      where conname = 'documentos_juridicos_cliente_id_fkey'
    )
  then
    alter table public.documentos_juridicos
      add constraint documentos_juridicos_cliente_id_fkey
      foreign key (cliente_id) references public.clientes(id)
      on delete set null;
  end if;

  if to_regclass('public.processos') is not null
    and to_regclass('public.documentos_juridicos') is not null
    and not exists (
      select 1 from pg_constraint
      where conname = 'documentos_juridicos_processo_id_fkey'
    )
  then
    alter table public.documentos_juridicos
      add constraint documentos_juridicos_processo_id_fkey
      foreign key (processo_id) references public.processos(id)
      on delete set null;
  end if;
end;
$$;

alter table if exists public.documentos_juridicos drop constraint if exists documentos_juridicos_status_processual_check;
alter table if exists public.documentos_juridicos add constraint documentos_juridicos_status_processual_check check (
  status is null or status in (
    'Gerado',
    'gerado',
    'Aguardando assinatura',
    'aguardando_assinatura',
    'Assinado',
    'Anexado',
    'Enviado',
    'Substituído',
    'Cancelado'
  )
);

create or replace function public.atualizar_updated_at_documentos_juridicos()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documentos_juridicos_updated_at on public.documentos_juridicos;
create trigger documentos_juridicos_updated_at
before update on public.documentos_juridicos
for each row execute function public.atualizar_updated_at_documentos_juridicos();

create index if not exists documentos_juridicos_cliente_processo_idx
  on public.documentos_juridicos (cliente_id, processo_id, created_at desc);

create index if not exists documentos_juridicos_status_idx
  on public.documentos_juridicos (status, assinado, created_at desc);

commit;
