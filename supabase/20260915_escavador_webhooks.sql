-- Preparação da ingestão idempotente de movimentações do Escavador.
-- Execute no SQL Editor do Supabase antes de publicar a Edge Function.

begin;

alter table if exists public.movimentacoes
  add column if not exists id_movimento_externo text,
  add column if not exists data_andamento timestamptz;

alter table if exists public.movimentacoes
  drop constraint if exists movimentacoes_origem_check;

alter table if exists public.movimentacoes
  add constraint movimentacoes_origem_check check (
    origem in ('manual', 'integration', 'api', 'import', 'ai', 'escavador')
  );

create unique index if not exists movimentacoes_escavador_id_unico
  on public.movimentacoes (processo_id, id_movimento_externo);

create index if not exists movimentacoes_data_andamento_idx
  on public.movimentacoes (processo_id, data_andamento desc)
  where origem = 'escavador' and deleted_at is null;

commit;
