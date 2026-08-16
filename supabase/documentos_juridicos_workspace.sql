-- PLATINO WORKSPACE - DOCUMENTOS JURIDICOS E RASTREABILIDADE
-- Execute uma vez no SQL Editor do Supabase.

begin;

create table if not exists public.documentos_juridicos (
  id uuid primary key default gen_random_uuid(),
  nome_documento text not null,
  nome_arquivo text not null,
  modelo_id text not null,
  modelo_nome text not null,
  categoria text,
  cliente_id bigint references public.clientes(id) on delete set null,
  cliente_nome text,
  cpf_cnpj text,
  numero_contrato text,
  numero_processo text,
  responsavel_nome text not null,
  departamento text,
  destino text,
  versao integer not null default 1 check (versao > 0),
  status text not null default 'gerado' check (status in (
    'rascunho', 'gerado', 'aguardando_assinatura', 'assinado', 'cancelado'
  )),
  arquivo_principal_path text,
  arquivos_paths jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid(),
  created_by_email text not null default lower(coalesce(auth.jwt()->>'email', '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documentos_juridicos_nome_idx
  on public.documentos_juridicos (lower(nome_documento));
create index if not exists documentos_juridicos_cliente_idx
  on public.documentos_juridicos (cliente_id, created_at desc);
create index if not exists documentos_juridicos_criador_idx
  on public.documentos_juridicos (created_by, created_at desc);

-- Nomes de exibição da biblioteca. Apenas gestores podem alterá-los e toda a
-- equipe consulta a mesma nomenclatura ao selecionar os modelos.
create table if not exists public.modelos_juridicos_config (
  modelo_id text primary key,
  nome_exibicao text not null check (char_length(trim(nome_exibicao)) between 3 and 100),
  atualizado_por uuid not null default auth.uid(),
  atualizado_em timestamptz not null default now()
);

create or replace function public.atualizar_modelo_juridico_config()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome_exibicao = trim(regexp_replace(new.nome_exibicao, '\\s+', ' ', 'g'));
  new.atualizado_por = auth.uid();
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists modelos_juridicos_config_updated_at on public.modelos_juridicos_config;
create trigger modelos_juridicos_config_updated_at
before insert or update on public.modelos_juridicos_config
for each row execute function public.atualizar_modelo_juridico_config();

alter table public.modelos_juridicos_config enable row level security;
revoke all on public.modelos_juridicos_config from anon;
grant select, insert, update on public.modelos_juridicos_config to authenticated;

drop policy if exists "Equipe consulta nomes dos modelos juridicos" on public.modelos_juridicos_config;
create policy "Equipe consulta nomes dos modelos juridicos"
on public.modelos_juridicos_config for select to authenticated
using (true);

drop policy if exists "Gestor configura nomes dos modelos juridicos" on public.modelos_juridicos_config;
create policy "Gestor configura nomes dos modelos juridicos"
on public.modelos_juridicos_config for all to authenticated
using (public.usuario_e_admin())
with check (public.usuario_e_admin());

create or replace function public.atualizar_updated_at_documentos_juridicos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documentos_juridicos_updated_at on public.documentos_juridicos;
create trigger documentos_juridicos_updated_at
before update on public.documentos_juridicos
for each row execute function public.atualizar_updated_at_documentos_juridicos();

alter table public.documentos_juridicos enable row level security;
revoke all on public.documentos_juridicos from anon;
grant select, insert, update on public.documentos_juridicos to authenticated;

drop policy if exists "Equipe consulta documentos juridicos" on public.documentos_juridicos;
create policy "Equipe consulta documentos juridicos"
on public.documentos_juridicos for select to authenticated
using (true);

drop policy if exists "Equipe cria documentos juridicos" on public.documentos_juridicos;
create policy "Equipe cria documentos juridicos"
on public.documentos_juridicos for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "Criador ou admin atualiza documento juridico" on public.documentos_juridicos;
create policy "Criador ou admin atualiza documento juridico"
on public.documentos_juridicos for update to authenticated
using (created_by = auth.uid() or public.usuario_e_admin())
with check (created_by = auth.uid() or public.usuario_e_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-juridicos', 'documentos-juridicos', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Equipe consulta arquivos juridicos" on storage.objects;
create policy "Equipe consulta arquivos juridicos"
on storage.objects for select to authenticated
using (bucket_id = 'documentos-juridicos');

drop policy if exists "Equipe envia arquivos juridicos" on storage.objects;
create policy "Equipe envia arquivos juridicos"
on storage.objects for insert to authenticated
with check (bucket_id = 'documentos-juridicos');

notify pgrst, 'reload schema';
commit;

select id, nome_documento, modelo_nome, cliente_nome, responsavel_nome,
       versao, status, destino, created_at
from public.documentos_juridicos
order by created_at desc
limit 20;
