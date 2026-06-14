-- PAINEL DE TAREFAS PARA TV E APONTAMENTOS
-- Execute todo este arquivo no SQL Editor do Supabase.

begin;

alter table public.tarefas
  add column if not exists prioridade text not null default 'normal',
  add column if not exists apontamento text,
  add column if not exists exibir_tv boolean not null default true,
  add column if not exists tarefa_manual boolean not null default false,
  add column if not exists responsavel_texto text,
  add column if not exists categoria text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.tarefas
  alter column funcionaria_id drop not null;

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

alter table public.tarefas
  drop constraint if exists tarefas_categoria_check;

alter table public.tarefas
  add constraint tarefas_categoria_check
  check (
    categoria is null
    or categoria in (
      'GOV',
      'PROCURAÇÕES',
      'ENC. PROCESSUAL',
      'AUDIÊNCIA',
      'SEGUROS'
    )
  );

create index if not exists tarefas_painel_tv_idx
on public.tarefas (
  exibir_tv,
  status,
  categoria,
  prioridade,
  data_limite
);

drop function if exists public.atualizar_tarefa_supervisor(
  bigint, text, text, bigint, integer, date, text, text, text, boolean
);

create or replace function public.atualizar_tarefa_supervisor(
  p_tarefa_id bigint,
  p_titulo text,
  p_descricao text,
  p_funcionaria_id bigint,
  p_pontos_tarefa integer,
  p_data_limite date,
  p_status text,
  p_prioridade text,
  p_categoria text,
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
    categoria = p_categoria,
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
  bigint, text, text, bigint, integer, date, text, text, text, text, boolean
) from public;
grant execute on function public.atualizar_tarefa_supervisor(
  bigint, text, text, bigint, integer, date, text, text, text, text, boolean
) to authenticated;

drop function if exists public.salvar_tarefa_manual_supervisor(
  bigint, text, text, text, date, text, text, text, boolean
);

create or replace function public.salvar_tarefa_manual_supervisor(
  p_tarefa_id bigint,
  p_titulo text,
  p_descricao text,
  p_responsavel_texto text,
  p_data_limite date,
  p_status text,
  p_prioridade text,
  p_categoria text,
  p_apontamento text,
  p_exibir_tv boolean
)
returns public.tarefas
language plpgsql
security definer
set search_path = public
as $$
declare
  tarefa_salva public.tarefas;
begin
  if not public.usuario_e_admin() then
    raise exception 'Somente o supervisor pode gerenciar tarefas manuais.';
  end if;

  if nullif(trim(p_titulo), '') is null then
    raise exception 'O titulo da tarefa e obrigatorio.';
  end if;

  if p_status not in ('pendente', 'concluida') then
    raise exception 'Status invalido para tarefa manual.';
  end if;

  if p_tarefa_id is null then
    insert into public.tarefas (
      titulo,
      descricao,
      funcionaria_id,
      pontos_tarefa,
      data_limite,
      status,
      concluida_em,
      prioridade,
      categoria,
      apontamento,
      exibir_tv,
      tarefa_manual,
      responsavel_texto,
      updated_at
    )
    values (
      trim(p_titulo),
      nullif(trim(coalesce(p_descricao, '')), ''),
      null,
      0,
      p_data_limite,
      p_status,
      case when p_status = 'concluida' then now() else null end,
      p_prioridade,
      p_categoria,
      nullif(trim(coalesce(p_apontamento, '')), ''),
      coalesce(p_exibir_tv, true),
      true,
      nullif(trim(coalesce(p_responsavel_texto, '')), ''),
      now()
    )
    returning * into tarefa_salva;
  else
    update public.tarefas
    set
      titulo = trim(p_titulo),
      descricao = nullif(trim(coalesce(p_descricao, '')), ''),
      funcionaria_id = null,
      pontos_tarefa = 0,
      data_limite = p_data_limite,
      status = p_status,
      prioridade = p_prioridade,
      categoria = p_categoria,
      apontamento = nullif(trim(coalesce(p_apontamento, '')), ''),
      exibir_tv = coalesce(p_exibir_tv, true),
      tarefa_manual = true,
      responsavel_texto =
        nullif(trim(coalesce(p_responsavel_texto, '')), ''),
      updated_at = now()
    where id = p_tarefa_id
      and tarefa_manual = true
    returning * into tarefa_salva;
  end if;

  if tarefa_salva.id is null then
    raise exception 'Tarefa manual nao encontrada.';
  end if;

  return tarefa_salva;
end;
$$;

revoke all on function public.salvar_tarefa_manual_supervisor(
  bigint, text, text, text, date, text, text, text, text, boolean
) from public;
grant execute on function public.salvar_tarefa_manual_supervisor(
  bigint, text, text, text, date, text, text, text, text, boolean
) to authenticated;

create or replace function public.registrar_conclusao_tarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.tarefa_manual, false) then
    if old.status <> 'concluida' and new.status = 'concluida' then
      new.concluida_em := coalesce(new.concluida_em, now());
    elsif old.status = 'concluida' and new.status <> 'concluida' then
      new.concluida_em := null;
    end if;

    new.funcionaria_id := null;
    new.pontos_tarefa := 0;
    new.updated_at := now();
    return new;
  end if;

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
