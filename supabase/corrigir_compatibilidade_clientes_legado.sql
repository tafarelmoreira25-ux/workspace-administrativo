-- Compatibilidade entre o cadastro legado e o módulo atual de clientes.
-- Migration aditiva e idempotente: não remove tabelas nem dados.

begin;

alter table public.clientes
  add column if not exists nome_completo text,
  add column if not exists rg text,
  add column if not exists data_nascimento date,
  add column if not exists email text,
  add column if not exists endereco text,
  add column if not exists id_crm text,
  add column if not exists link_pasta_cliente text,
  add column if not exists responsavel text,
  add column if not exists observacoes text,
  add column if not exists created_by text,
  add column if not exists updated_by text;

-- Recupera no módulo atual os dados que já existem no cadastro legado.
update public.clientes
set nome_completo = nome
where nullif(btrim(nome_completo), '') is null
  and nullif(btrim(nome), '') is not null;

update public.clientes
set link_pasta_cliente = pasta_drive_url
where nullif(btrim(link_pasta_cliente), '') is null
  and nullif(btrim(pasta_drive_url), '') is not null;

update public.clientes
set id_crm = crm_referencia
where nullif(btrim(id_crm), '') is null
  and nullif(btrim(crm_referencia), '') is not null;

create or replace function public.sincronizar_campos_clientes_legado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.nome_completo := coalesce(nullif(btrim(new.nome_completo), ''), nullif(btrim(new.nome), ''));
    new.nome := coalesce(nullif(btrim(new.nome), ''), new.nome_completo);
  else
    if new.nome_completo is distinct from old.nome_completo then
      new.nome := coalesce(nullif(btrim(new.nome_completo), ''), new.nome);
    elsif new.nome is distinct from old.nome then
      new.nome_completo := coalesce(nullif(btrim(new.nome), ''), new.nome_completo);
    else
      new.nome_completo := coalesce(nullif(btrim(new.nome_completo), ''), nullif(btrim(new.nome), ''));
      new.nome := coalesce(nullif(btrim(new.nome), ''), new.nome_completo);
    end if;
  end if;

  if tg_op = 'INSERT' or new.link_pasta_cliente is distinct from old.link_pasta_cliente then
    new.pasta_drive_url := coalesce(nullif(btrim(new.link_pasta_cliente), ''), new.pasta_drive_url);
  elsif new.pasta_drive_url is distinct from old.pasta_drive_url then
    new.link_pasta_cliente := coalesce(nullif(btrim(new.pasta_drive_url), ''), new.link_pasta_cliente);
  end if;

  if tg_op = 'INSERT' or new.id_crm is distinct from old.id_crm then
    new.crm_referencia := coalesce(nullif(btrim(new.id_crm), ''), new.crm_referencia);
  elsif new.crm_referencia is distinct from old.crm_referencia then
    new.id_crm := coalesce(nullif(btrim(new.crm_referencia), ''), new.id_crm);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists clientes_sincronizar_campos_legado on public.clientes;
create trigger clientes_sincronizar_campos_legado
before insert or update on public.clientes
for each row execute function public.sincronizar_campos_clientes_legado();

create index if not exists clientes_nome_completo_idx
  on public.clientes (lower(nome_completo));

alter table public.clientes enable row level security;

grant select, insert, update on public.clientes to authenticated;
revoke delete on public.clientes from authenticated;

drop policy if exists "Clientes autenticados podem cadastrar" on public.clientes;
drop policy if exists "Clientes autenticados podem consultar" on public.clientes;
drop policy if exists "Clientes autenticados podem editar" on public.clientes;
drop policy if exists "Supervisor consulta clientes" on public.clientes;
drop policy if exists "Equipe gerencia clientes" on public.clientes;
drop policy if exists "Equipe interna consulta clientes" on public.clientes;
drop policy if exists "Equipe interna cria clientes" on public.clientes;
drop policy if exists "Equipe interna edita clientes" on public.clientes;

create policy "Equipe interna consulta clientes"
on public.clientes for select to authenticated
using (public.funcionario_id_autenticado() is not null);

create policy "Equipe interna cria clientes"
on public.clientes for insert to authenticated
with check (public.funcionario_id_autenticado() is not null);

create policy "Equipe interna edita clientes"
on public.clientes for update to authenticated
using (public.funcionario_id_autenticado() is not null)
with check (public.funcionario_id_autenticado() is not null);

notify pgrst, 'reload schema';

commit;
