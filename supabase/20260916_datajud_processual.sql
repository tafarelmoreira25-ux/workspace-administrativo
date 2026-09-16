-- Habilita a origem DataJud/CNJ enquanto a API do Escavador nao estiver liberada.

begin;

alter table if exists public.movimentacoes
  add column if not exists id_movimento_externo text,
  add column if not exists data_andamento timestamptz;

alter table if exists public.movimentacoes
  drop constraint if exists movimentacoes_origem_check;

alter table if exists public.movimentacoes
  add constraint movimentacoes_origem_check check (
    origem in ('manual', 'integration', 'api', 'import', 'ai', 'escavador', 'datajud')
  );

create unique index if not exists movimentacoes_origem_externa_id_unico
  on public.movimentacoes (processo_id, id_movimento_externo)
  where id_movimento_externo is not null;

create index if not exists movimentacoes_datajud_data_idx
  on public.movimentacoes (processo_id, data_andamento desc)
  where origem = 'datajud' and deleted_at is null;

commit;
