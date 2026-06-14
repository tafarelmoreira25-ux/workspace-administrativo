-- PAINEL DE TAREFAS PARA TV E APONTAMENTOS
-- Execute todo este arquivo no SQL Editor do Supabase.

begin;

alter table public.tarefas
  add column if not exists prioridade text not null default 'normal',
  add column if not exists apontamento text,
  add column if not exists exibir_tv boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  restricao record;
begin
  for restricao in
    select conname
    from pg_constraint
    where conrelid = 'public.tarefas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%prioridade%'
  loop
    execute format(
      'alter table public.tarefas drop constraint %I',
      restricao.conname
    );
  end loop;
end;
$$;

alter table public.tarefas
  add constraint tarefas_prioridade_check
  check (prioridade in ('normal', 'alta', 'urgente'));

create index if not exists tarefas_painel_tv_idx
on public.tarefas (exibir_tv, status, prioridade, data_limite);

create or replace function public.atualizar_tarefa_supervisor(
  p_tarefa_id bigint,
  p_titulo text,
  p_descricao text,
  p_funcionaria_id bigint,
  p_pontos_tarefa integer,
  p_data_limite date,
  p_status text,
  p_prioridade text,
  p_apontamento text,
  p_exibir_tv boolean
)
returns public.tarefas
language plpgsql
security definer
set search_path = public
as $$
declare
  tarefa_atualizada public.tarefas;
begin
  if not public.usuario_e_admin() then
    raise exception 'Somente o supervisor pode editar a tarefa.';
  end if;

  if nullif(trim(p_titulo), '') is null then
    raise exception 'O titulo da tarefa e obrigatorio.';
  end if;

  update public.tarefas
  set
    titulo = trim(p_titulo),
    descricao = nullif(trim(coalesce(p_descricao, '')), ''),
    funcionaria_id = p_funcionaria_id,
    pontos_tarefa = greatest(coalesce(p_pontos_tarefa, 0), 0),
    data_limite = p_data_limite,
    status = p_status,
    prioridade = p_prioridade,
    apontamento = nullif(trim(coalesce(p_apontamento, '')), ''),
    exibir_tv = coalesce(p_exibir_tv, true),
    updated_at = now()
  where id = p_tarefa_id
  returning * into tarefa_atualizada;

  if tarefa_atualizada.id is null then
    raise exception 'Tarefa nao encontrada.';
  end if;

  return tarefa_atualizada;
end;
$$;

revoke all on function public.atualizar_tarefa_supervisor(
  bigint, text, text, bigint, integer, date, text, text, text, boolean
) from public;
grant execute on function public.atualizar_tarefa_supervisor(
  bigint, text, text, bigint, integer, date, text, text, text, boolean
) to authenticated;

create or replace function public.registrar_conclusao_tarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'concluida'
     and new.status <> 'concluida'
     and not public.usuario_e_admin() then
    raise exception 'Uma tarefa concluida nao pode voltar para pendente.';
  end if;

  if old.status <> 'concluida' and new.status = 'concluida' then
    new.concluida_em := coalesce(new.concluida_em, now());

    update public.funcionarios
    set pontos = coalesce(pontos, 0) + coalesce(new.pontos_tarefa, 0)
    where id = new.funcionaria_id;
  elsif old.status = 'concluida' and new.status <> 'concluida' then
    update public.funcionarios
    set pontos = greatest(
      0,
      coalesce(pontos, 0) - coalesce(old.pontos_tarefa, 0)
    )
    where id = old.funcionaria_id;

    new.concluida_em := null;
  elsif old.status = 'concluida' and new.status = 'concluida'
     and (
       old.funcionaria_id is distinct from new.funcionaria_id
       or old.pontos_tarefa is distinct from new.pontos_tarefa
     ) then
    update public.funcionarios
    set pontos = greatest(
      0,
      coalesce(pontos, 0) - coalesce(old.pontos_tarefa, 0)
    )
    where id = old.funcionaria_id;

    update public.funcionarios
    set pontos = coalesce(pontos, 0) + coalesce(new.pontos_tarefa, 0)
    where id = new.funcionaria_id;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ao_concluir_tarefa on public.tarefas;
create trigger ao_concluir_tarefa
before update of status, funcionaria_id, pontos_tarefa on public.tarefas
for each row
execute function public.registrar_conclusao_tarefa();

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tarefas'
  ) then
    alter publication supabase_realtime add table public.tarefas;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
