-- O protocolo extrajudicial segue o formato ID_CRM/ANO, por exemplo 72528/2026.

begin;

alter table public.processos
  add column if not exists protocolo_extrajudicial text;

create or replace function public.definir_protocolo_extrajudicial()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ano text;
  v_id_crm text;
begin
  if new.origem_registro = 'acao_extrajudicial_manual'
     or new.status_judicial in ('EXTRAJUDICIAL', 'AGUARDANDO_PROTOCOLO')
     or nullif(btrim(new.protocolo_extrajudicial), '') is not null then
    v_id_crm := coalesce(nullif(btrim(new.id_crm), ''), nullif(btrim(new.pasta_cliente_id), ''));
    if v_id_crm is null then
      new.protocolo_extrajudicial := null;
    else
      v_ano := extract(year from coalesce(new.data_inicio_extrajudicial::timestamp, new.created_at, now()))::integer::text;
      new.protocolo_extrajudicial := regexp_replace(v_id_crm, '/[0-9]{4}$', '') || '/' || v_ano;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists processos_definir_protocolo_extrajudicial_biu on public.processos;
create trigger processos_definir_protocolo_extrajudicial_biu
before insert or update of id_crm, pasta_cliente_id, data_inicio_extrajudicial, origem_registro, status_judicial, protocolo_extrajudicial
on public.processos
for each row execute function public.definir_protocolo_extrajudicial();

update public.processos
set protocolo_extrajudicial = regexp_replace(coalesce(nullif(btrim(id_crm), ''), nullif(btrim(pasta_cliente_id), '')), '/[0-9]{4}$', '') || '/' ||
  extract(year from coalesce(data_inicio_extrajudicial::timestamp, created_at, now()))::integer::text
where coalesce(nullif(btrim(id_crm), ''), nullif(btrim(pasta_cliente_id), '')) is not null
  and (
    origem_registro = 'acao_extrajudicial_manual'
    or status_judicial in ('EXTRAJUDICIAL', 'AGUARDANDO_PROTOCOLO')
  );

create index if not exists processos_protocolo_extrajudicial_idx
  on public.processos (protocolo_extrajudicial)
  where protocolo_extrajudicial is not null;

commit;
