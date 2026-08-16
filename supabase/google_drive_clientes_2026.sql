-- Integração Drive-first para clientes da Platino.
-- Execute depois de clientes_cadastro_drive_2026.sql.
-- Os documentos permanecem no Google Drive; o Supabase guarda somente o índice.
begin;

alter table public.clientes
  add column if not exists drive_folder_id text,
  add column if not exists drive_parent_folder_id text,
  add column if not exists drive_status text not null default 'manual',
  add column if not exists drive_modified_time timestamptz,
  add column if not exists drive_last_synced_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_drive_status_check'
      and conrelid = 'public.clientes'::regclass
  ) then
    alter table public.clientes
      add constraint clientes_drive_status_check
      check (drive_status in ('manual','ativo','arquivado','ausente'));
  end if;
end $$;

create unique index if not exists clientes_drive_folder_id_uidx
  on public.clientes(drive_folder_id)
  where drive_folder_id is not null;

create index if not exists clientes_drive_busca_idx
  on public.clientes(drive_status, nome);

create or replace function public.sincronizar_clientes_drive(
  p_pastas jsonb,
  p_pasta_pai_id text,
  p_sincronizado_em timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  cliente_id bigint;
  folder_id text;
  nome_pasta text;
  nome_cliente text;
  folder_url text;
  modificada_em timestamptz;
  total_inseridos integer := 0;
  total_atualizados integer := 0;
  total_ausentes integer := 0;
begin
  if jsonb_typeof(coalesce(p_pastas, '[]'::jsonb)) <> 'array' then
    raise exception 'A lista de pastas do Drive deve ser um array.';
  end if;
  if nullif(trim(coalesce(p_pasta_pai_id, '')), '') is null then
    raise exception 'A pasta principal de clientes ativos é obrigatória.';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_pastas, '[]'::jsonb))
  loop
    folder_id := nullif(trim(coalesce(item->>'id', '')), '');
    nome_pasta := nullif(trim(coalesce(item->>'name', '')), '');
    folder_url := coalesce(
      nullif(trim(coalesce(item->>'webViewLink', '')), ''),
      'https://drive.google.com/drive/folders/' || folder_id
    );
    modificada_em := nullif(item->>'modifiedTime', '')::timestamptz;

    if folder_id is null or nome_pasta is null then
      continue;
    end if;

    -- Padrão atual: "2026 - NOME DO CLIENTE - ATIVO".
    nome_cliente := regexp_replace(nome_pasta, '^\s*[0-9]{4}\s*[-–—]\s*', '', 'i');
    nome_cliente := regexp_replace(nome_cliente, '^\s*[._-]+\s*', '', 'i');
    nome_cliente := regexp_replace(nome_cliente, '\s*[-–—]\s*ATIV[OA]\s*$', '', 'i');
    nome_cliente := regexp_replace(trim(nome_cliente), '\s{2,}', ' ', 'g');
    if nome_cliente = '' then nome_cliente := nome_pasta; end if;

    cliente_id := null;
    select c.id into cliente_id
    from public.clientes c
    where c.drive_folder_id = folder_id
       or c.identificador_origem = folder_id
       or c.pasta_drive_url ilike '%' || folder_id || '%'
    order by (c.drive_folder_id = folder_id) desc, c.id desc
    limit 1;

    if cliente_id is null then
      select c.id into cliente_id
      from public.clientes c
      where lower(trim(c.nome)) = lower(trim(nome_cliente))
        and c.ativo is not false
      order by c.id desc
      limit 1;
    end if;

    if cliente_id is null then
      insert into public.clientes(
        codigo_interno, nome, origem, identificador_origem, ativo,
        pasta_drive_url, pasta_drive_nome, drive_folder_id,
        drive_parent_folder_id, drive_status, drive_modified_time,
        drive_last_synced_at, ultima_movimentacao, updated_at
      ) values (
        'DRV-' || upper(substr(md5(folder_id), 1, 16)),
        nome_cliente, 'google_drive', folder_id, true,
        folder_url, nome_pasta, folder_id,
        trim(p_pasta_pai_id), 'ativo', modificada_em,
        p_sincronizado_em, now(), now()
      );
      total_inseridos := total_inseridos + 1;
    else
      update public.clientes set
        nome = nome_cliente,
        origem = 'google_drive',
        identificador_origem = folder_id,
        ativo = true,
        pasta_drive_url = folder_url,
        pasta_drive_nome = nome_pasta,
        drive_folder_id = folder_id,
        drive_parent_folder_id = trim(p_pasta_pai_id),
        drive_status = 'ativo',
        drive_modified_time = modificada_em,
        drive_last_synced_at = p_sincronizado_em,
        updated_at = now()
      where id = cliente_id;
      total_atualizados := total_atualizados + 1;
    end if;
  end loop;

  update public.clientes set
    drive_status = 'ausente',
    updated_at = now()
  where drive_parent_folder_id = trim(p_pasta_pai_id)
    and drive_status = 'ativo'
    and drive_last_synced_at is distinct from p_sincronizado_em;
  get diagnostics total_ausentes = row_count;

  return jsonb_build_object(
    'inseridos', total_inseridos,
    'atualizados', total_atualizados,
    'ausentes', total_ausentes,
    'total_recebido', jsonb_array_length(coalesce(p_pastas, '[]'::jsonb)),
    'sincronizado_em', p_sincronizado_em
  );
end;
$$;

create or replace function public.listar_clientes_drive_ativos(
  p_busca text default null,
  p_limite integer default 30
) returns table(
  id bigint,
  nome text,
  pasta_drive_url text,
  pasta_drive_nome text,
  drive_folder_id text,
  drive_modified_time timestamptz,
  drive_last_synced_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.nome, c.pasta_drive_url, c.pasta_drive_nome,
    c.drive_folder_id, c.drive_modified_time, c.drive_last_synced_at
  from public.clientes c
  where c.ativo is not false
    and c.drive_status = 'ativo'
    and c.drive_folder_id is not null
    and (
      nullif(trim(coalesce(p_busca, '')), '') is null
      or c.nome ilike '%' || trim(p_busca) || '%'
      or c.pasta_drive_nome ilike '%' || trim(p_busca) || '%'
    )
    and (public.usuario_e_admin() or public.funcionario_id_autenticado() is not null)
  order by c.nome
  limit greatest(1, least(coalesce(p_limite, 30), 100));
$$;

revoke all on function public.sincronizar_clientes_drive(jsonb,text,timestamptz) from public;
grant execute on function public.sincronizar_clientes_drive(jsonb,text,timestamptz) to service_role;
revoke all on function public.listar_clientes_drive_ativos(text,integer) from public;
grant execute on function public.listar_clientes_drive_ativos(text,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
