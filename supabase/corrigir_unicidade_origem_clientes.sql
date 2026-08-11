-- Corrige a delegacao de tarefas para clientes criados manualmente.
--
-- A constraint antiga usa UNIQUE NULLS NOT DISTINCT, fazendo com que apenas
-- um cliente possa ter (origem, identificador_origem) = (NULL, NULL).
-- Clientes criados pela delegacao nao possuem esses dois dados, portanto a
-- segunda inclusao falha com erro de chave duplicada.

begin;

alter table public.clientes
  drop constraint if exists clientes_origem_identificador_origem_key;

-- Mantem a protecao contra duplicidade para clientes que realmente vieram de
-- uma fonte externa e possuem um identificador nessa fonte.
create unique index if not exists clientes_origem_identificador_origem_uidx
  on public.clientes (origem, identificador_origem)
  where origem is not null
    and identificador_origem is not null;

commit;

-- Verificacao informativa: deve retornar o novo indice parcial.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'clientes'
  and indexname = 'clientes_origem_identificador_origem_uidx';
