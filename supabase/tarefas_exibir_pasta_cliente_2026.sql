-- Permite que o executor veja a pasta do cliente vinculada à própria tarefa.
-- Não amplia o acesso ao Drive: o Google continua validando as permissões da conta.
begin;

alter table public.clientes
  add column if not exists drive_path text;

create or replace function public.listar_pastas_clientes_tarefas(
  p_cliente_ids bigint[]
) returns table(
  cliente_id bigint,
  nome text,
  pasta_drive_url text,
  pasta_drive_nome text,
  drive_status text,
  drive_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    c.id as cliente_id,
    c.nome,
    c.pasta_drive_url,
    c.pasta_drive_nome,
    c.drive_status,
    c.drive_path
  from public.clientes c
  where c.id = any(coalesce(p_cliente_ids, array[]::bigint[]))
    and exists (
      select 1
      from public.tarefas t
      where t.cliente_id = c.id
        and (
          public.usuario_e_admin()
          or t.funcionaria_id = public.funcionario_id_autenticado()
          or lower(coalesce(t.solicitante_email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
        )
    )
  order by c.nome;
$$;

revoke all on function public.listar_pastas_clientes_tarefas(bigint[]) from public;
grant execute on function public.listar_pastas_clientes_tarefas(bigint[]) to authenticated;

notify pgrst, 'reload schema';
commit;
