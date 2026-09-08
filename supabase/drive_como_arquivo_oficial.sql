-- Ajuste seguro: Drive como arquivo oficial.
-- Não cria bucket, não envia arquivo ao Storage e não remove dados existentes.
-- Use esta migration se as tabelas já existem no Supabase remoto.

begin;

alter table if exists public.clientes
  add column if not exists link_pasta_cliente text;

alter table if exists public.processos
  add column if not exists link_pasta_cliente text,
  add column if not exists link_consulta text;

do $$
begin
  if to_regclass('public.processos_documentos') is not null then
    alter table public.processos_documentos
      add column if not exists status text not null default 'Pendente',
      add column if not exists link_drive text,
      add column if not exists observacao text,
      add column if not exists armazenamento_oficial text not null default 'Drive',
      add column if not exists conferido_by uuid default auth.uid() references auth.users(id) on delete set null,
      add column if not exists conferido_em timestamptz;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'processos_documentos' and column_name = 'arquivo_path'
    ) then
      alter table public.processos_documentos alter column arquivo_path drop not null;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'processos_documentos' and column_name = 'bucket'
    ) then
      alter table public.processos_documentos alter column bucket drop not null;
    end if;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.documentos_juridicos') is not null then
    alter table public.documentos_juridicos
      add column if not exists armazenamento_oficial text not null default 'Drive',
      add column if not exists link_pasta_cliente text;

    comment on column public.documentos_juridicos.arquivo_principal_path is
      'Legado/opcional. Novos PDFs gerados pelo Gerador de Documentos não são armazenados no Supabase; o arquivo oficial fica no Drive.';
  end if;
end;
$$;

commit;
