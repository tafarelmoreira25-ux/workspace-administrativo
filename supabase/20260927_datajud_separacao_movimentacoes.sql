-- Mantem movimentos externos idempotentes sem alterar registros manuais.
begin;

drop index if exists public.movimentacoes_origem_externa_id_unico;

create unique index movimentacoes_origem_externa_id_unico
  on public.movimentacoes (processo_id, id_movimento_externo);

create or replace function public.proteger_movimentacao_automatica()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.origem in ('datajud', 'escavador') and auth.role() = 'authenticated' then
    raise exception 'Movimentacoes automaticas sao somente para consulta.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists proteger_movimentacao_automatica_trigger on public.movimentacoes;
create trigger proteger_movimentacao_automatica_trigger
  before update or delete on public.movimentacoes
  for each row execute function public.proteger_movimentacao_automatica();

commit;
