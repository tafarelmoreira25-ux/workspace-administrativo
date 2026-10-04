-- Execute no SQL Editor do Supabase antes do script. Usa o schema atual
-- de clientes/processos e a ficha de cliente (Abrir Pasta).
begin;
create or replace function public.sync_processual_one_off(
  p_nome text, p_numero text, p_reu text default null, p_simular boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_numero text := regexp_replace(coalesce(p_numero, ''), '[^0-9]', '', 'g');
  v_cliente public.clientes;
  v_total integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acesso restrito a service_role.';
  end if;
  if length(v_numero) <> 20 or nullif(btrim(p_nome), '') is null then
    raise exception 'Nome ou número de processo inválido.';
  end if;
  -- Serializa execuções deste seed; evita duplicação e clientes órfãos.
  -- O bloqueio também impede INSERTs concorrentes na tabela de processos.
  if not p_simular then
    lock table public.clientes, public.processos in share row exclusive mode;
  end if;
  if exists (select 1 from public.processos
    where regexp_replace(coalesce(numero_processo, ''), '[^0-9]', '', 'g') = v_numero) then
    return jsonb_build_object('acao', 'pulado');
  end if;
  select count(*) into v_total from public.clientes
    where lower(regexp_replace(btrim(nome_completo), '\s+', ' ', 'g')) =
      lower(regexp_replace(btrim(p_nome), '\s+', ' ', 'g'));
  if v_total > 1 then
    raise exception 'Mais de um cliente com esse nome; informe o vínculo correto antes de importar.';
  end if;
  if p_simular then return jsonb_build_object('acao', 'previsto'); end if;
  select * into v_cliente from public.clientes
    where lower(regexp_replace(btrim(nome_completo), '\s+', ' ', 'g')) =
      lower(regexp_replace(btrim(p_nome), '\s+', ' ', 'g'));
  if v_cliente.id is null then
    insert into public.clientes (codigo_interno, nome, nome_completo, origem)
      values ('CLI-SYNC-' || v_numero, btrim(p_nome), btrim(p_nome), 'Processual') returning * into v_cliente;
  end if;
  insert into public.processos (
    cliente_id, nome_cliente, autor_reu, banco_reu, numero_processo,
    fase_atual, protocolo_status, status_judicial, origem_registro
  ) values (
    v_cliente.id, v_cliente.nome_completo,
    btrim(p_nome) || case when nullif(btrim(p_reu), '') is null then '' else ' X ' || btrim(p_reu) end,
    nullif(btrim(p_reu), ''), p_numero,
    'Protocolo Liberado', 'Liberado', null, 'sync_processual_one_off'
  );
  return jsonb_build_object('acao', 'criado', 'cliente_id', v_cliente.id);
end;
$$;
revoke all on function public.sync_processual_one_off(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.sync_processual_one_off(text, text, text, boolean) to service_role;
notify pgrst, 'reload schema';
commit;
