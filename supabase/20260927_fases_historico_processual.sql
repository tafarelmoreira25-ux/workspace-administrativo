-- Organiza o historico por jornada sem reordenar nem alterar o conteudo judicial.
begin;

alter table public.movimentacoes
  add column if not exists fase text,
  add column if not exists ordem_fase integer,
  add column if not exists ordem_movimentacao integer;

create or replace function public.classificar_fase_movimentacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.origem = 'import'
     and new.fonte = 'Historico administrativo extrajudicial padrao'
     and new.ordem_historico between 1 and 29 then
    new.fase := case when new.ordem_historico <= 25 then 'extrajudicial_administrativa' else 'transicao_judicial' end;
    new.ordem_fase := case when new.ordem_historico <= 25 then 1 else 2 end;
    new.ordem_movimentacao := new.ordem_historico;
  else
    new.fase := coalesce(new.fase, 'judicial');
    new.ordem_fase := coalesce(new.ordem_fase, 3);
  end if;
  return new;
end;
$$;

drop trigger if exists movimentacoes_classificar_fase_biu on public.movimentacoes;
create trigger movimentacoes_classificar_fase_biu
before insert or update of origem, fonte, ordem_historico, fase, ordem_fase, ordem_movimentacao
on public.movimentacoes
for each row execute function public.classificar_fase_movimentacao();

update public.movimentacoes
set
  fase = case
    when origem = 'import' and fonte = 'Historico administrativo extrajudicial padrao' and ordem_historico <= 25 then 'extrajudicial_administrativa'
    when origem = 'import' and fonte = 'Historico administrativo extrajudicial padrao' and ordem_historico <= 29 then 'transicao_judicial'
    else 'judicial'
  end,
  ordem_fase = case
    when origem = 'import' and fonte = 'Historico administrativo extrajudicial padrao' and ordem_historico <= 25 then 1
    when origem = 'import' and fonte = 'Historico administrativo extrajudicial padrao' and ordem_historico <= 29 then 2
    else 3
  end,
  ordem_movimentacao = case
    when origem = 'import' and fonte = 'Historico administrativo extrajudicial padrao' then ordem_historico
    else ordem_movimentacao
  end;

update public.movimentacoes m
set
  titulo = 'Ação registrada: ' || coalesce(nullif(p.id_crm, ''), nullif(p.pasta_cliente_id, ''), p.id::text),
  descricao = 'Ação registrada: ' || coalesce(nullif(p.id_crm, ''), nullif(p.pasta_cliente_id, ''), p.id::text),
  resumo_cliente = 'Ação registrada: ' || coalesce(nullif(p.id_crm, ''), nullif(p.pasta_cliente_id, ''), p.id::text)
from public.processos p
where m.processo_id = p.id
  and m.origem = 'import'
  and m.fonte = 'Historico administrativo extrajudicial padrao'
  and m.ordem_historico = 1;

create index if not exists movimentacoes_fase_ordem_idx
  on public.movimentacoes (processo_id, ordem_fase, ordem_movimentacao)
  where deleted_at is null;

commit;
