-- Cadastro e atualização de clientes com link da pasta no Google Drive.
-- Execute no Supabase SQL Editor depois de central_tarefas_modulos_2026.sql.
begin;

alter table public.clientes
  add column if not exists cpf text,
  add column if not exists numero_contrato text,
  add column if not exists numero_processo text,
  add column if not exists departamento_atual text,
  add column if not exists crm_referencia text,
  add column if not exists pasta_drive_url text,
  add column if not exists pasta_drive_nome text,
  add column if not exists ultima_movimentacao timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.salvar_cliente_central(
  p_cliente_id bigint,
  p_nome text,
  p_cpf text default null,
  p_numero_contrato text default null,
  p_numero_processo text default null,
  p_departamento_atual text default null,
  p_crm_referencia text default null,
  p_pasta_drive_url text default null,
  p_pasta_drive_nome text default null
) returns public.clientes
language plpgsql
security definer
set search_path=public
as $$
declare
  cliente public.clientes;
  codigo_cliente text;
  nome_final text := nullif(trim(coalesce(p_nome,'')), '');
  drive_final text := nullif(trim(coalesce(p_pasta_drive_url,'')), '');
begin
  if not public.usuario_e_admin() and public.funcionario_id_autenticado() is null then
    raise exception 'Usuário da equipe não identificado.';
  end if;

  if nome_final is null then
    raise exception 'Informe o nome do cliente.';
  end if;

  if drive_final is not null and drive_final !~* '^https://(drive|docs)\.google\.com/' then
    raise exception 'Informe um link válido do Google Drive.';
  end if;

  if p_cliente_id is null then
    if exists (
      select 1 from public.clientes
      where lower(trim(nome)) = lower(nome_final) and ativo
    ) then
      raise exception 'Já existe um cliente ativo com este nome. Use Editar para atualizar o cadastro.';
    end if;

    perform pg_advisory_xact_lock(hashtext('cliente-cadastro-central-' || to_char(current_date,'YYYYMMDD')));
    codigo_cliente := 'CLI-' || to_char(current_date,'YYYYMMDD') || '-' || lpad(
      (select (count(*) + 1)::text from public.clientes where created_at::date = current_date),
      3,
      '0'
    );

    insert into public.clientes (
      codigo_interno, nome, cpf, numero_contrato, numero_processo,
      departamento_atual, crm_referencia, pasta_drive_url, pasta_drive_nome,
      ultima_movimentacao, updated_at
    ) values (
      codigo_cliente, nome_final, nullif(trim(coalesce(p_cpf,'')), ''),
      nullif(trim(coalesce(p_numero_contrato,'')), ''),
      nullif(trim(coalesce(p_numero_processo,'')), ''),
      nullif(trim(coalesce(p_departamento_atual,'')), ''),
      nullif(trim(coalesce(p_crm_referencia,'')), ''), drive_final,
      nullif(trim(coalesce(p_pasta_drive_nome,'')), ''), now(), now()
    ) returning * into cliente;
  else
    select * into cliente from public.clientes where id = p_cliente_id for update;
    if cliente.id is null then
      raise exception 'Cliente não encontrado.';
    end if;

    update public.clientes set
      nome = nome_final,
      cpf = nullif(trim(coalesce(p_cpf,'')), ''),
      numero_contrato = nullif(trim(coalesce(p_numero_contrato,'')), ''),
      numero_processo = nullif(trim(coalesce(p_numero_processo,'')), ''),
      departamento_atual = nullif(trim(coalesce(p_departamento_atual,'')), ''),
      crm_referencia = nullif(trim(coalesce(p_crm_referencia,'')), ''),
      pasta_drive_url = drive_final,
      pasta_drive_nome = nullif(trim(coalesce(p_pasta_drive_nome,'')), ''),
      ultima_movimentacao = now(),
      updated_at = now()
    where id = cliente.id
    returning * into cliente;
  end if;

  return cliente;
end;
$$;

revoke all on function public.salvar_cliente_central(bigint,text,text,text,text,text,text,text,text) from public;
grant execute on function public.salvar_cliente_central(bigint,text,text,text,text,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
