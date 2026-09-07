-- Diagnóstico SOMENTE LEITURA: não remove nem altera dados ou permissões.
-- Execute no SQL Editor e envie as linhas cujo campo
-- situacao = DEPENDÊNCIA PARA CONFERIR.
-- Algumas funções/views e o vínculo de documentos já são tratados pela limpeza;
-- o resultado também permite identificar os objetos adicionais do banco remoto.
-- Inclui dependências das tabelas, índices e tipos de linha (inclusive arrays).
-- Referências: https://www.postgresql.org/docs/current/catalog-pg-depend.html

with escopo(nome) as (
  select unnest(array[
    'alertas_esteira',
    'atualizacoes_gerais',
    'chamadas_atencao',
    'clientes',
    'esteiras_eventos',
    'instancias_esteira',
    'modelos_esteira',
    'modelos_etapas',
    'modelos_tarefa',
    'notificacoes_operacionais',
    'processos',
    'processos_andamentos',
    'prospeccoes_hunter',
    'prospeccoes_hunter_historico',
    'relatorios_processuais',
    'responsaveis_por_funcao',
    'status_processual_clientes',
    'status_processual_historico',
    'tarefas',
    'tarefas_auditoria',
    'tarefas_comentarios',
    'tarefas_prazos_historico',
    'taskmanager_catalogo',
    'tipos_tarefa_sla',
    'tratativas',
    'urgencias',
    'urgencias_eventos'
  ])
), tabelas as (
  select c.oid, c.relname, c.reltype
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join escopo e on e.nome = c.relname
  where n.nspname = 'public' and c.relkind in ('r', 'p')
), alvos as (
  select relname, 'pg_class'::regclass as classe, oid as objeto from tabelas
  union
  select relname, 'pg_type'::regclass, reltype from tabelas
  union
  select t.relname, 'pg_type'::regclass, p.typarray
  from tabelas t join pg_type p on p.oid = t.reltype
  where p.typarray <> 0
  union
  select t.relname, 'pg_class'::regclass, i.indexrelid
  from tabelas t join pg_index i on i.indrelid = t.oid
), dependencias as (
  select distinct
    a.relname as tabela_a_remover,
    pg_describe_object(d.classid, d.objid, d.objsubid) as objeto_dependente,
    -- Uma view aparece no catálogo como sua regra _RETURN.
    coalesce(r.ev_class, k.conrelid, p.polrelid, g.tgrelid,
      case when d.classid = 'pg_class'::regclass then d.objid end) as relacao_dona
  from alvos a
  join pg_depend d on d.refclassid = a.classe and d.refobjid = a.objeto
  left join pg_rewrite r on d.classid = 'pg_rewrite'::regclass and r.oid = d.objid
  left join pg_constraint k on d.classid = 'pg_constraint'::regclass and k.oid = d.objid
  left join pg_policy p on d.classid = 'pg_policy'::regclass and p.oid = d.objid
  left join pg_trigger g on d.classid = 'pg_trigger'::regclass and g.oid = d.objid
  where d.deptype = 'n'
)
select
  d.tabela_a_remover,
  d.objeto_dependente,
  case when c.oid is not null then format('%I.%I', n.nspname, c.relname) end
    as tabela_ou_view_dependente,
  case when t.oid is not null
    then 'TABELA JÁ LISTADA PARA REMOÇÃO'
    else 'DEPENDÊNCIA PARA CONFERIR'
  end as situacao
from dependencias d
left join pg_class c on c.oid = d.relacao_dona
left join pg_namespace n on n.oid = c.relnamespace
left join tabelas t on t.oid = d.relacao_dona
order by situacao, tabela_a_remover, objeto_dependente;
