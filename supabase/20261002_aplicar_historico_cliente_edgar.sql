-- Aplica o roteiro administrativo de 25 movimentacoes ao processo
-- extrajudicial do cliente Edgar, sem duplicar registros existentes.
-- Requer a migracao 20261001_historico_25_registros_extrajudiciais.sql.

begin;

do $$
declare
  v_processo public.processos%rowtype;
  v_quantidade integer;
  v_total integer;
begin
  select count(*)
  into v_quantidade
  from public.processos
  where nome_cliente ilike '%edgar%'
    and (
      origem_registro = 'acao_extrajudicial_manual'
      or status_judicial in ('EXTRAJUDICIAL', 'AGUARDANDO_PROTOCOLO')
    );

  if v_quantidade = 0 then
    raise exception 'Nenhum processo extrajudicial do cliente Edgar foi localizado.';
  end if;

  if v_quantidade > 1 then
    raise exception 'Foram localizados % processos extrajudiciais para Edgar. Use o ID exato para evitar alterar o cadastro errado.', v_quantidade;
  end if;

  select *
  into v_processo
  from public.processos
  where nome_cliente ilike '%edgar%'
    and (
      origem_registro = 'acao_extrajudicial_manual'
      or status_judicial in ('EXTRAJUDICIAL', 'AGUARDANDO_PROTOCOLO')
    )
  limit 1
  for update;

  v_total := public.inserir_historico_administrativo_extrajudicial(v_processo.id);

  if v_total = 0 then
    raise exception 'A funcao de historico instalada no Supabase esta desatualizada. Execute primeiro 20261001_historico_25_registros_extrajudiciais.sql e depois execute novamente este arquivo. Processo Edgar: %.', v_processo.id;
  end if;

  raise notice 'Historico extrajudicial aplicado ao processo % (%). Registros processados: %.',
    v_processo.id,
    v_processo.nome_cliente,
    v_total;
end;
$$;

commit;

-- Confirmacao: deve retornar 25 registros ativos.
select
  p.id as processo_id,
  p.nome_cliente,
  p.id_crm,
  p.protocolo_extrajudicial,
  count(m.id) as total_movimentacoes_extrajudiciais
from public.processos p
join public.movimentacoes m
  on m.processo_id = p.id
 and m.fase = 'extrajudicial_administrativa'
 and m.origem = 'import'
 and m.fonte = 'Historico administrativo extrajudicial padrao'
 and m.deleted_at is null
where p.nome_cliente ilike '%edgar%'
group by p.id, p.nome_cliente, p.id_crm, p.protocolo_extrajudicial
order by p.id;
