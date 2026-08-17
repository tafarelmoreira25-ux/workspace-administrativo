-- Amplia o catálogo do Drive para clientes ativos e históricos.
-- Execute depois de google_drive_clientes_2026.sql.
begin;

alter table public.clientes
  add column if not exists drive_path text;

create or replace function public.sincronizar_catalogo_clientes_drive(
  p_pastas jsonb,
  p_pasta_raiz_id text,
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
  parent_folder_id text;
  status_drive text;
  caminho_drive text;
  modificada_em timestamptz;
  total_inseridos integer := 0;
  total_atualizados integer := 0;
  total_ausentes integer := 0;
  total_ativos integer := 0;
  total_arquivados integer := 0;
begin
  if jsonb_typeof(coalesce(p_pastas, '[]'::jsonb)) <> 'array' then
    raise exception 'A lista de pastas do Drive deve ser um array.';
  end if;
  if nullif(trim(coalesce(p_pasta_raiz_id, '')), '') is null then
    raise exception 'A pasta raiz do Drive é obrigatória.';
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_pastas, '[]'::jsonb))
  loop
    folder_id := nullif(trim(coalesce(item->>'id', '')), '');
    nome_pasta := nullif(trim(coalesce(item->>'name', '')), '');
    parent_folder_id := nullif(trim(coalesce(item->>'parentFolderId', '')), '');
    status_drive := lower(trim(coalesce(item->>'driveStatus', 'ativo')));
    caminho_drive := nullif(trim(coalesce(item->>'drivePath', '')), '');
    folder_url := coalesce(
      nullif(trim(coalesce(item->>'webViewLink', '')), ''),
      'https://drive.google.com/drive/folders/' || folder_id
    );
    modificada_em := nullif(item->>'modifiedTime', '')::timestamptz;

    if folder_id is null or nome_pasta is null then continue; end if;
    if status_drive not in ('ativo', 'arquivado') then status_drive := 'arquivado'; end if;

    nome_cliente := regexp_replace(nome_pasta, '^\s*[0-9]{4}\s*[-–—]\s*', '', 'i');
    nome_cliente := regexp_replace(nome_cliente, '^\s*[._-]+\s*', '', 'i');
    nome_cliente := regexp_replace(nome_cliente, '\s*[-–—]\s*(ATIV[OA]|INATIV[OA]|ARQUIVAD[OA]|ENCERRAD[OA])\s*$', '', 'i');
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

    -- Pelo nome, associa apenas um cadastro manual à pasta ativa.
    -- Pastas históricas com IDs diferentes permanecem separadas.
    if cliente_id is null and status_drive = 'ativo' then
      select c.id into cliente_id
      from public.clientes c
      where lower(trim(c.nome)) = lower(trim(nome_cliente))
        and c.drive_folder_id is null
        and c.ativo is not false
      order by c.id desc
      limit 1;
    end if;

    if cliente_id is null then
      insert into public.clientes(
        codigo_interno, nome, origem, identificador_origem, ativo,
        pasta_drive_url, pasta_drive_nome, drive_folder_id,
        drive_parent_folder_id, drive_status, drive_modified_time,
        drive_last_synced_at, drive_path, ultima_movimentacao, updated_at
      ) values (
        'DRV-' || upper(substr(md5(folder_id), 1, 16)),
        nome_cliente, 'google_drive', folder_id, status_drive = 'ativo',
        folder_url, nome_pasta, folder_id,
        parent_folder_id, status_drive, modificada_em,
        p_sincronizado_em, caminho_drive, now(), now()
      );
      total_inseridos := total_inseridos + 1;
    else
      update public.clientes set
        nome = nome_cliente,
        origem = 'google_drive',
        identificador_origem = folder_id,
        ativo = status_drive = 'ativo',
        pasta_drive_url = folder_url,
        pasta_drive_nome = nome_pasta,
        drive_folder_id = folder_id,
        drive_parent_folder_id = parent_folder_id,
        drive_status = status_drive,
        drive_modified_time = modificada_em,
        drive_last_synced_at = p_sincronizado_em,
        drive_path = caminho_drive,
        updated_at = now()
      where id = cliente_id;
      total_atualizados := total_atualizados + 1;
    end if;

    if status_drive = 'ativo' then total_ativos := total_ativos + 1;
    else total_arquivados := total_arquivados + 1;
    end if;
  end loop;

  update public.clientes set
    drive_status = 'ausente',
    ativo = false,
    updated_at = now()
  where origem = 'google_drive'
    and drive_status in ('ativo', 'arquivado')
    and drive_last_synced_at is distinct from p_sincronizado_em;
  get diagnostics total_ausentes = row_count;

  return jsonb_build_object(
    'inseridos', total_inseridos,
    'atualizados', total_atualizados,
    'ausentes', total_ausentes,
    'ativos', total_ativos,
    'arquivados', total_arquivados,
    'total_recebido', jsonb_array_length(coalesce(p_pastas, '[]'::jsonb)),
    'sincronizado_em', p_sincronizado_em
  );
end;
$$;

create or replace function public.listar_clientes_drive_disponiveis(
  p_busca text default null,
  p_limite integer default 30
) returns table(
  id bigint,
  nome text,
  pasta_drive_url text,
  pasta_drive_nome text,
  drive_folder_id text,
  drive_status text,
  drive_path text,
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
    c.drive_folder_id, c.drive_status, c.drive_path,
    c.drive_modified_time, c.drive_last_synced_at
  from public.clientes c
  where (
      nullif(trim(coalesce(p_busca, '')), '') is null
      or c.nome ilike '%' || trim(p_busca) || '%'
      or c.pasta_drive_nome ilike '%' || trim(p_busca) || '%'
      or c.drive_path ilike '%' || trim(p_busca) || '%'
      or c.codigo_interno ilike '%' || trim(p_busca) || '%'
    )
    and (public.usuario_e_admin() or public.funcionario_id_autenticado() is not null)
  order by
    (c.drive_status = 'ativo' and c.drive_folder_id is not null) desc,
    (c.drive_status = 'arquivado' and c.drive_folder_id is not null) desc,
    c.nome,
    c.drive_path
  limit greatest(1, least(coalesce(p_limite, 30), 100));
$$;

revoke all on function public.sincronizar_catalogo_clientes_drive(jsonb,text,timestamptz) from public;
grant execute on function public.sincronizar_catalogo_clientes_drive(jsonb,text,timestamptz) to service_role;
revoke all on function public.listar_clientes_drive_disponiveis(text,integer) from public;
grant execute on function public.listar_clientes_drive_disponiveis(text,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
