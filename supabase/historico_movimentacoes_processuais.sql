-- Etapa 6 — Histórico e Movimentações Processuais
-- Migration segura: amplia movimentacoes e processos sem apagar dados.
-- Execute no SQL Editor após as migrations de clientes/protocolos/processos.

begin;

alter table if exists public.movimentacoes
  add column if not exists categoria text not null default 'Movimentação processual',
  add column if not exists titulo text,
  add column if not exists descricao_tecnica text,
  add column if not exists resumo_cliente text,
  add column if not exists responsavel text,
  add column if not exists fonte text not null default 'Manual',
  add column if not exists link text,
  add column if not exists importancia text not null default 'Normal',
  add column if not exists anexo_url text,
  add column if not exists proxima_providencia text,
  add column if not exists proxima_revisao date,
  add column if not exists criar_tarefa_relacionada boolean not null default false,
  add column if not exists origem text not null default 'manual',
  add column if not exists created_by_nome text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

alter table if exists public.processos
  add column if not exists ultima_revisao_por text,
  add column if not exists ultima_revisao_observacao text,
  add column if not exists ultima_revisao_em timestamptz;

do $$
begin
  if to_regclass('public.movimentacoes') is not null then
    alter table public.movimentacoes drop constraint if exists movimentacoes_categoria_check;
    alter table public.movimentacoes add constraint movimentacoes_categoria_check check (
      categoria in (
        'Movimentação processual',
        'Atendimento',
        'Tarefa',
        'Prazo',
        'Documento',
        'Custas',
        'Ocorrência',
        'Protocolo',
        'Alteração cadastral',
        'Relatório',
        'Sistema'
      )
    );

    alter table public.movimentacoes drop constraint if exists movimentacoes_importancia_check;
    alter table public.movimentacoes add constraint movimentacoes_importancia_check check (
      importancia in ('Normal', 'Relevante', 'Crítico')
    );

    alter table public.movimentacoes drop constraint if exists movimentacoes_origem_check;
    alter table public.movimentacoes add constraint movimentacoes_origem_check check (
      origem in ('manual', 'integration', 'api', 'import', 'ai')
    );

    create index if not exists movimentacoes_timeline_idx
      on public.movimentacoes (processo_id, deleted_at, data_registro desc);

    create index if not exists movimentacoes_categoria_idx
      on public.movimentacoes (categoria, importancia, data_registro desc)
      where deleted_at is null;
  end if;
end;
$$;

commit;
