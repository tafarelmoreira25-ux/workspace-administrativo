-- Etapa 5: Processos judiciais e ficha individual.
-- Migration incremental e não destrutiva.
-- Não remove dados e não obriga processos legados a passarem pela esteira de protocolo.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.processos') is not null then
    alter table public.processos add column if not exists autor text;
    alter table public.processos add column if not exists reu text;
    alter table public.processos add column if not exists tipo_acao text;
    alter table public.processos add column if not exists link_pasta_cliente text;
    alter table public.processos add column if not exists link_consulta text;
    alter table public.processos add column if not exists situacao text not null default 'Pendente de protocolo';
    alter table public.processos add column if not exists fase_judicial text not null default 'Pré-ajuizamento';
    alter table public.processos add column if not exists resultado text not null default 'Sem julgamento';
    alter table public.processos add column if not exists ultima_movimentacao text;
    alter table public.processos add column if not exists ultima_movimentacao_data timestamptz;
    alter table public.processos add column if not exists ultima_revisao date;
    alter table public.processos add column if not exists proxima_revisao date;
    alter table public.processos add column if not exists proximo_prazo date;
    alter table public.processos add column if not exists emenda_status text not null default 'Não solicitada';
    alter table public.processos add column if not exists custas_status text;
    alter table public.processos add column if not exists com_pendencia boolean not null default false;
    alter table public.processos add column if not exists sem_revisao boolean not null default true;
    alter table public.processos add column if not exists recursal boolean not null default false;
    alter table public.processos add column if not exists ultimo_atendimento text;
    alter table public.processos add column if not exists ultimo_relatorio_enviado text;

    alter table public.processos drop constraint if exists processos_situacao_check;
    alter table public.processos add constraint processos_situacao_check check (
      situacao in ('Pendente de protocolo', 'Em andamento', 'Suspenso / Sobrestado', 'Encerrado')
    );

    alter table public.processos drop constraint if exists processos_fase_judicial_check;
    alter table public.processos add constraint processos_fase_judicial_check check (
      fase_judicial in (
        'Pré-ajuizamento',
        'Distribuição',
        'Petição inicial',
        'Análise inicial',
        'Emenda',
        'Citação',
        'Contestação',
        'Réplica',
        'Instrução',
        'Audiência',
        'Conclusos',
        'Sentença',
        'Fase recursal',
        'Cumprimento',
        'Execução',
        'Trânsito em julgado',
        'Baixa',
        'Arquivado'
      )
    );

    alter table public.processos drop constraint if exists processos_resultado_check;
    alter table public.processos add constraint processos_resultado_check check (
      resultado in (
        'Sem julgamento',
        'Procedente',
        'Parcialmente procedente',
        'Improcedente',
        'Extinto sem resolução do mérito',
        'Extinto com resolução do mérito',
        'Acordo homologado',
        'Cancelamento da distribuição',
        'Outro'
      )
    );

    alter table public.processos drop constraint if exists processos_justica_gratuita_processos_check;
    alter table public.processos add constraint processos_justica_gratuita_processos_check check (
      justica_gratuita in ('Não analisada', 'Deferida', 'Indeferida', 'Não Solicitada')
    );

    alter table public.processos drop constraint if exists processos_emenda_status_check;
    alter table public.processos add constraint processos_emenda_status_check check (
      emenda_status in ('Não solicitada', 'Solicitada', 'Pendente', 'Juntada', 'Prazo decorrido', 'Não se aplica')
    );

    create index if not exists processos_grid_busca_idx
      on public.processos (nome_cliente, cpf_cliente, id_crm, numero_processo, banco_reu);
    create index if not exists processos_situacao_fase_idx
      on public.processos (situacao, fase_judicial, resultado, updated_at desc);
    create index if not exists processos_prazos_idx
      on public.processos (proximo_prazo, ultima_revisao, proxima_revisao);
    create index if not exists processos_responsavel_idx
      on public.processos (responsavel, updated_at desc);
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
