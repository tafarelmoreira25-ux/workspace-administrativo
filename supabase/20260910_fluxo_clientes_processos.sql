-- Compatibilidade incremental entre o schema legado e a ficha jurídica atual.
-- Não remove tabelas, colunas, políticas ou dados existentes.
begin;

create table if not exists public.clientes_historico (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  tipo text not null default 'evento',
  descricao text not null,
  origem text,
  processo_id bigint references public.processos(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists clientes_historico_cliente_idx
  on public.clientes_historico (cliente_id, created_at desc);

alter table public.clientes_historico enable row level security;
revoke all on public.clientes_historico from anon;
grant select, insert, update on public.clientes_historico to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'clientes_historico' and policyname = 'Equipe interna consulta histórico de clientes') then
    create policy "Equipe interna consulta histórico de clientes" on public.clientes_historico for select to authenticated using (public.funcionario_id_autenticado() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'clientes_historico' and policyname = 'Equipe interna cria histórico de clientes') then
    create policy "Equipe interna cria histórico de clientes" on public.clientes_historico for insert to authenticated with check (public.funcionario_id_autenticado() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'clientes_historico' and policyname = 'Equipe interna edita histórico de clientes') then
    create policy "Equipe interna edita histórico de clientes" on public.clientes_historico for update to authenticated using (public.funcionario_id_autenticado() is not null) with check (public.funcionario_id_autenticado() is not null);
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
