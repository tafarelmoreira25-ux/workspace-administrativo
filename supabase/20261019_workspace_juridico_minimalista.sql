-- Workspace jurídico minimalista. Migration aditiva: preserva tabelas e registros legados.
-- A identidade canônica continua sendo public.clientes.id; nenhuma reconciliação por nome é feita.
begin;

alter table public.clientes
  add column if not exists banco text,
  add column if not exists numero_acao_extrajudicial text,
  add column if not exists numero_processo_judicial text,
  add column if not exists representante text,
  add column if not exists ativo boolean not null default true;

alter table public.clientes_historico
  add column if not exists etapa text,
  add column if not exists updated_at timestamptz not null default now();
alter table public.funcionarios add column if not exists ativo boolean not null default true;

do $$
begin
  if to_regclass('public.modelos_juridicos_config') is not null then
    alter table public.modelos_juridicos_config add column if not exists ativo boolean not null default false;
    update public.modelos_juridicos_config set ativo = false where ativo is distinct from false;
  end if;
end;
$$;

create index if not exists clientes_judicial_idx
  on public.clientes (numero_processo_judicial) where numero_processo_judicial is not null;
create index if not exists clientes_extrajudicial_idx
  on public.clientes (numero_acao_extrajudicial) where numero_acao_extrajudicial is not null;
create index if not exists clientes_historico_timeline_idx
  on public.clientes_historico (cliente_id, created_at desc);

create or replace function public.proteger_id_cliente_workspace()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.id is distinct from old.id then
    raise exception 'O ID canônico do cliente é imutável.';
  end if;
  return new;
end;
$$;
drop trigger if exists clientes_id_imutavel_workspace on public.clientes;
create trigger clientes_id_imutavel_workspace
before update of id on public.clientes
for each row execute function public.proteger_id_cliente_workspace();

create or replace function public.proteger_cpf_duplicado_workspace()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_cpf text;
begin
  v_cpf := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  if length(v_cpf) = 11 then
    perform pg_advisory_xact_lock(hashtextextended(v_cpf, 0));
    if exists (select 1 from public.clientes c where c.id is distinct from new.id
      and regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = v_cpf) then
      raise exception 'Já existe um cadastro de cliente com este CPF.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists clientes_cpf_unico_workspace on public.clientes;
create trigger clientes_cpf_unico_workspace
before insert or update of cpf on public.clientes
for each row execute function public.proteger_cpf_duplicado_workspace();

create table if not exists public.clientes_homologacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  data date not null default current_date,
  divida numeric(14,2),
  saldo_atual numeric(14,2),
  parcelas_atrasadas integer check (parcelas_atrasadas is null or parcelas_atrasadas >= 0),
  desconto numeric(14,2),
  observacao text check (observacao is null or char_length(observacao) <= 500),
  desfecho text check (desfecho is null or desfecho in ('Quitado', 'Distrato')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists clientes_homologacoes_timeline_idx
  on public.clientes_homologacoes (cliente_id, data desc, created_at desc);

create or replace function public.workspace_usuario_ativo()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.funcionarios f
    where lower(trim(f.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
      and coalesce(f.ativo, true) = true
  );
$$;
revoke all on function public.workspace_usuario_ativo() from public, anon;
grant execute on function public.workspace_usuario_ativo() to authenticated;

alter table public.clientes enable row level security;
alter table public.clientes_historico enable row level security;
alter table public.clientes_homologacoes enable row level security;
revoke all on public.clientes, public.clientes_historico, public.clientes_homologacoes from anon, authenticated;
grant select, insert on public.clientes to authenticated;
revoke update on public.clientes from authenticated;
grant update (nome_completo, cpf, banco, numero_acao_extrajudicial, numero_processo_judicial, representante, ativo, updated_at, updated_by) on public.clientes to authenticated;
grant select, insert on public.clientes_historico, public.clientes_homologacoes to authenticated;

do $$
declare t text; policy_row record;
begin
  foreach t in array array['documentos_juridicos', 'modelos_juridicos_config'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
      for policy_row in
        select policyname from pg_policies where schemaname = 'public' and tablename = t
      loop
        execute format('drop policy %I on public.%I', policy_row.policyname, t);
      end loop;
    end if;
  end loop;
end;
$$;

do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('clientes', 'clientes_historico', 'clientes_homologacoes')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

create policy "Workspace ativo consulta clientes" on public.clientes
  for select to authenticated using (public.workspace_usuario_ativo());
create policy "Workspace ativo cria clientes" on public.clientes
  for insert to authenticated with check (public.workspace_usuario_ativo());
create policy "Workspace ativo edita clientes" on public.clientes
  for update to authenticated using (public.workspace_usuario_ativo()) with check (public.workspace_usuario_ativo());
create policy "Workspace ativo consulta historico" on public.clientes_historico
  for select to authenticated using (public.workspace_usuario_ativo());
create policy "Workspace ativo cria historico" on public.clientes_historico
  for insert to authenticated with check (public.workspace_usuario_ativo());
create policy "Workspace ativo consulta homologacoes" on public.clientes_homologacoes
  for select to authenticated using (public.workspace_usuario_ativo());
create policy "Workspace ativo cria homologacoes" on public.clientes_homologacoes
  for insert to authenticated with check (public.workspace_usuario_ativo());

-- Ponto explícito de reconciliação: legado permanece intacto até revisão por CPF ou identificador de processo.
create table if not exists public.workspace_reconciliacao_pendencias (
  id bigint generated always as identity primary key,
  tabela_origem text not null,
  registro_origem text not null,
  identificador_confiavel text,
  motivo text not null default 'Revisão manual necessária; nenhum vínculo por nome será inferido.',
  criada_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolvida_por uuid references auth.users(id) on delete set null,
  unique (tabela_origem, registro_origem)
);
alter table public.workspace_reconciliacao_pendencias enable row level security;
revoke all on public.workspace_reconciliacao_pendencias from anon, authenticated;
grant select, update (resolvida_em, resolvida_por) on public.workspace_reconciliacao_pendencias to authenticated;
create policy "Admin ativo revisa reconciliacao" on public.workspace_reconciliacao_pendencias
  for all to authenticated using (public.workspace_usuario_ativo() and public.usuario_e_admin())
  with check (public.workspace_usuario_ativo() and public.usuario_e_admin());

-- Coloca fichas antigas sem vínculo em fila de reconciliação usando somente CPF.
-- A fila não altera processos: gatilhos legados podem criar eventos automáticos.
do $$
begin
  if to_regclass('public.processos') is not null
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='processos' and column_name='cliente_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='processos' and column_name='cpf_cliente')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='processos' and column_name='id') then
    execute $sql$
      insert into public.workspace_reconciliacao_pendencias(tabela_origem, registro_origem, identificador_confiavel)
      select 'processos', p.id::text, nullif(regexp_replace(coalesce(p.cpf_cliente, ''), '\D', '', 'g'), '')
      from public.processos p
      where p.cliente_id is null
        and length(regexp_replace(coalesce(p.cpf_cliente, ''), '\D', '', 'g')) = 11
      on conflict (tabela_origem, registro_origem) do nothing
    $sql$;
  end if;
  if to_regclass('public.homologacoes') is not null then
    execute $sql$
      insert into public.workspace_reconciliacao_pendencias(tabela_origem, registro_origem, identificador_confiavel)
      select 'homologacoes', h.id::text, nullif(regexp_replace(coalesce(h.cpf_cnpj, ''), '\D', '', 'g'), '')
      from public.homologacoes h
      where h.cliente_id is null or h.cliente_id::text !~ '^[0-9a-fA-F-]{36}$'
      on conflict (tabela_origem, registro_origem) do nothing
    $sql$;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
