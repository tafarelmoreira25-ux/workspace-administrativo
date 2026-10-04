-- Complemento aditivo para tratativas quinzenais e anexos privados.
begin;

alter table public.homologacao_movimentacoes
  add column if not exists tipo_contato text,
  add column if not exists valor_original numeric(14,2),
  add column if not exists valor_ofertado numeric(14,2),
  add column if not exists percentual_desconto numeric(8,2),
  add column if not exists anexos jsonb not null default '[]'::jsonb;

create or replace function public.homologacao_calcular_tratativa()
returns trigger language plpgsql as $$
begin
  if new.tipo_contato is not null then
    if new.tipo_contato not in ('Assessoria','Banco','Portal','Acordo','Quitação')
      or new.valor_original is null or new.valor_original <= 0
      or new.valor_ofertado is null or new.valor_ofertado < 0
      or length(trim(new.descricao)) = 0 then
      raise exception 'Informe tipo de contato, valores válidos e observações';
    end if;
    new.percentual_desconto = round((1 - new.valor_ofertado / new.valor_original) * 100, 2);
    new.prazo_retorno = (new.data_hora at time zone 'America/Sao_Paulo')::date + 15;
  end if;
  return new;
end;
$$;
drop trigger if exists calcular_tratativa on public.homologacao_movimentacoes;
create trigger calcular_tratativa before insert or update on public.homologacao_movimentacoes
  for each row execute function public.homologacao_calcular_tratativa();

-- Resumo e histórico são gravados na mesma transação. Lançamentos retroativos
-- não substituem a última tratativa; lock da ficha serializa inserções concorrentes.
create or replace function public.homologacao_resumir_tratativa()
returns trigger language plpgsql security invoker as $$
declare ultima public.homologacao_movimentacoes;
begin
  if new.tipo_contato is null then return new; end if;
  perform 1 from public.homologacoes where id = new.homologacao_id for update;
  select * into ultima from public.homologacao_movimentacoes
    where homologacao_id = new.homologacao_id and tipo_contato is not null
    order by data_hora desc, created_at desc, id desc limit 1;
  update public.homologacoes set
    ultima_movimentacao = greatest(ultima_movimentacao, ultima.data_hora),
    data_prevista_retorno = ultima.prazo_retorno,
    valor_quitacao_hoje = ultima.valor_ofertado,
    updated_by_nome = new.updated_by_nome,
    origem_alteracao = 'tratativa_quinzenal'
    where id = new.homologacao_id;
  return new;
end;
$$;
drop trigger if exists resumir_tratativa on public.homologacao_movimentacoes;
create trigger resumir_tratativa after insert or update on public.homologacao_movimentacoes
  for each row execute function public.homologacao_resumir_tratativa();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('homologacao-anexos','homologacao-anexos',false,10485760,
  array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Mantém o acesso da equipe autenticada e respeita o RLS da ficha correspondente.
drop policy if exists homologacao_anexos_select on storage.objects;
create policy homologacao_anexos_select on storage.objects for select to authenticated
  using (bucket_id = 'homologacao-anexos' and exists (
    select 1 from public.homologacoes where id::text = (storage.foldername(name))[1]));
drop policy if exists homologacao_anexos_insert on storage.objects;
create policy homologacao_anexos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'homologacao-anexos' and exists (
    select 1 from public.homologacoes where id::text = (storage.foldername(name))[1]));
drop policy if exists homologacao_anexos_delete on storage.objects;
create policy homologacao_anexos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'homologacao-anexos' and owner_id = auth.uid()::text);

commit;
