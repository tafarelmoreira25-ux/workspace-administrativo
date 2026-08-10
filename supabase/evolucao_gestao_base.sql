-- CELIOS - EVOLUCAO DA BASE DE GESTAO
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Faça backup antes de executar em producao.

begin;

alter table public.funcionarios
  add column if not exists setor text,
  add column if not exists ativo boolean not null default true,
  add column if not exists data_admissao date,
  add column if not exists data_desligamento date,
  add column if not exists observacao_interna text,
  add column if not exists foto_url text,
  add column if not exists permissoes jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists funcionarios_ativo_setor_idx
on public.funcionarios (ativo, setor, nome);

-- Primeiro remove a validação antiga dos status.
do $$
declare
  restricao record;
begin
  for restricao in
    select conname
    from pg_constraint
    where conrelid = 'public.tarefas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format(
      'alter table public.tarefas drop constraint %I',
      restricao.conname
    );
  end loop;
end;
$$;

-- Depois converte o status legado sem apagar nenhuma tarefa.
update public.tarefas
set status = 'nova',
    updated_at = now()
where status = 'pendente';

-- Por fim, cria a nova validação com todos os status permitidos.
alter table public.tarefas
  add constraint tarefas_status_check
  check (
    status in (
      'nova',
      'em_andamento',
      'aguardando_cliente',
      'aguardando_banco',
      'aguardando_judiciario',
      'impedida',
      'concluida',
      'cancelada',
      'arquivada',
      'responsabilidade_mensal'
    )
  );

create index if not exists tarefas_gestao_idx
on public.tarefas (status, funcionaria_id, categoria, data_limite);

grant update (
  nome,
  email,
  cargo,
  setor,
  ativo,
  data_admissao,
  data_desligamento,
  observacao_interna,
  foto_url,
  permissoes,
  pontos,
  updated_at
) on public.funcionarios to authenticated;

grant update (
  status,
  funcionaria_id,
  exibir_tv
) on public.tarefas to authenticated;

create or replace function public.proteger_edicao_tarefa_funcionaria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.usuario_e_admin() then
    return new;
  end if;

  if new.funcionaria_id is distinct from old.funcionaria_id
     or new.exibir_tv is distinct from old.exibir_tv
     or new.status is distinct from old.status and new.status <> 'concluida' then
    raise exception 'A colaboradora somente pode concluir as proprias tarefas.';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_edicao_tarefa_funcionaria on public.tarefas;
create trigger proteger_edicao_tarefa_funcionaria
before update of status, funcionaria_id, exibir_tv on public.tarefas
for each row execute function public.proteger_edicao_tarefa_funcionaria();

-- A policy de update existente continua restringindo estas operacoes ao admin.
drop policy if exists "Supervisor gerencia funcionarios" on public.funcionarios;
create policy "Supervisor gerencia funcionarios"
on public.funcionarios for update to authenticated
using (public.usuario_e_admin())
with check (public.usuario_e_admin());

create or replace function public.funcionario_id_autenticado()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id::bigint
  from public.funcionarios
  where lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    and ativo = true
  limit 1;
$$;

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
  if p_status not in (
    'nova', 'em_andamento', 'aguardando_cliente', 'aguardando_banco',
    'aguardando_judiciario', 'impedida', 'concluida', 'cancelada', 'arquivada'
  ) then
    raise exception 'Status de tarefa invalido.';
  end if;

  update public.tarefas
  set titulo = trim(p_titulo),
      descricao = nullif(trim(coalesce(p_descricao, '')), ''),
      funcionaria_id = p_funcionaria_id,
      pontos_tarefa = greatest(coalesce(p_pontos_tarefa, 0), 0),
      data_limite = p_data_limite,
      status = p_status,
      prioridade = p_prioridade,
      categoria = p_categoria,
      apontamento = nullif(trim(coalesce(p_apontamento, '')), ''),
      exibir_tv = case when p_status = 'arquivada' then false else coalesce(p_exibir_tv, true) end,
      updated_at = now()
  where id = p_tarefa_id
  returning * into tarefa_atualizada;

  if tarefa_atualizada.id is null then
    raise exception 'Tarefa nao encontrada.';
  end if;
  return tarefa_atualizada;
end;
$$;

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
  if p_status not in (
    'nova', 'em_andamento', 'aguardando_cliente', 'aguardando_banco',
    'aguardando_judiciario', 'impedida', 'concluida', 'cancelada', 'arquivada'
  ) then
    raise exception 'Status invalido para tarefa manual.';
  end if;

  if p_tarefa_id is null then
    insert into public.tarefas (
      titulo, descricao, funcionaria_id, pontos_tarefa, data_limite, status,
      concluida_em, prioridade, categoria, apontamento, exibir_tv,
      tarefa_manual, responsavel_texto, updated_at
    ) values (
      trim(p_titulo), nullif(trim(coalesce(p_descricao, '')), ''), null, 0,
      p_data_limite, p_status,
      case when p_status = 'concluida' then now() else null end,
      p_prioridade, p_categoria, nullif(trim(coalesce(p_apontamento, '')), ''),
      case when p_status = 'arquivada' then false else coalesce(p_exibir_tv, true) end,
      true, nullif(trim(coalesce(p_responsavel_texto, '')), ''), now()
    ) returning * into tarefa_salva;
  else
    update public.tarefas
    set titulo = trim(p_titulo),
        descricao = nullif(trim(coalesce(p_descricao, '')), ''),
        funcionaria_id = null,
        pontos_tarefa = 0,
        data_limite = p_data_limite,
        status = p_status,
        prioridade = p_prioridade,
        categoria = p_categoria,
        apontamento = nullif(trim(coalesce(p_apontamento, '')), ''),
        exibir_tv = case when p_status = 'arquivada' then false else coalesce(p_exibir_tv, true) end,
        tarefa_manual = true,
        responsavel_texto = nullif(trim(coalesce(p_responsavel_texto, '')), ''),
        updated_at = now()
    where id = p_tarefa_id and tarefa_manual = true
    returning * into tarefa_salva;
  end if;

  if tarefa_salva.id is null then
    raise exception 'Tarefa manual nao encontrada.';
  end if;
  return tarefa_salva;
end;
$$;

revoke all on function public.atualizar_tarefa_supervisor(
  bigint, text, text, bigint, integer, date, text, text, text, text, boolean
) from public;
grant execute on function public.atualizar_tarefa_supervisor(
  bigint, text, text, bigint, integer, date, text, text, text, text, boolean
) to authenticated;

revoke all on function public.salvar_tarefa_manual_supervisor(
  bigint, text, text, text, date, text, text, text, text, boolean
) from public;
grant execute on function public.salvar_tarefa_manual_supervisor(
  bigint, text, text, text, date, text, text, text, text, boolean
) to authenticated;

create or replace function public.salvar_funcionario_supervisor(
  p_funcionario_id bigint,
  p_nome text,
  p_email text,
  p_cargo text,
  p_setor text,
  p_data_admissao date,
  p_foto_url text,
  p_permissoes jsonb,
  p_observacao_interna text
)
returns public.funcionarios
language plpgsql
security definer
set search_path = public
as $$
declare
  funcionario_salvo public.funcionarios;
  email_normalizado text := lower(trim(coalesce(p_email, '')));
begin
  if not public.usuario_e_admin() then
    raise exception 'Somente o supervisor pode gerenciar integrantes.';
  end if;
  if nullif(trim(coalesce(p_nome, '')), '') is null then
    raise exception 'O nome da integrante e obrigatorio.';
  end if;
  if email_normalizado = '' or position('@' in email_normalizado) < 2 then
    raise exception 'Informe um e-mail corporativo valido.';
  end if;
  if exists (
    select 1 from public.funcionarios
    where lower(trim(email)) = email_normalizado
      and (p_funcionario_id is null or id <> p_funcionario_id)
  ) then
    raise exception 'Ja existe uma integrante com este e-mail.';
  end if;

  if p_funcionario_id is null then
    insert into public.funcionarios (
      nome, email, cargo, setor, ativo, data_admissao, foto_url,
      permissoes, observacao_interna, pontos, updated_at
    ) values (
      trim(p_nome), email_normalizado, nullif(trim(coalesce(p_cargo, '')), ''),
      nullif(trim(coalesce(p_setor, '')), ''), true, p_data_admissao,
      nullif(trim(coalesce(p_foto_url, '')), ''), coalesce(p_permissoes, '{}'::jsonb),
      nullif(trim(coalesce(p_observacao_interna, '')), ''), 0, now()
    ) returning * into funcionario_salvo;
  else
    update public.funcionarios
    set nome = trim(p_nome),
        email = email_normalizado,
        cargo = nullif(trim(coalesce(p_cargo, '')), ''),
        setor = nullif(trim(coalesce(p_setor, '')), ''),
        data_admissao = p_data_admissao,
        foto_url = nullif(trim(coalesce(p_foto_url, '')), ''),
        permissoes = coalesce(p_permissoes, '{}'::jsonb),
        observacao_interna = nullif(trim(coalesce(p_observacao_interna, '')), ''),
        updated_at = now()
    where id = p_funcionario_id
    returning * into funcionario_salvo;
  end if;

  if funcionario_salvo.id is null then
    raise exception 'Integrante nao encontrada.';
  end if;
  return funcionario_salvo;
end;
$$;

create or replace function public.desligar_funcionario_supervisor(
  p_funcionario_id bigint,
  p_destino text,
  p_nova_funcionaria_id bigint,
  p_data_desligamento date,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_origem text;
  tarefas_processadas integer := 0;
begin
  if not public.usuario_e_admin() then
    raise exception 'Somente o supervisor pode desligar integrantes.';
  end if;
  if p_destino not in ('transferir', 'arquivar', 'cancelar') then
    raise exception 'Destino das tarefas invalido.';
  end if;

  select nome into nome_origem
  from public.funcionarios
  where id = p_funcionario_id and ativo = true
  for update;
  if nome_origem is null then
    raise exception 'Integrante ativa nao encontrada.';
  end if;

  if p_destino = 'transferir' then
    if p_nova_funcionaria_id is null or p_nova_funcionaria_id = p_funcionario_id
       or not exists (select 1 from public.funcionarios where id = p_nova_funcionaria_id and ativo = true) then
      raise exception 'Selecione uma integrante ativa diferente para receber as tarefas.';
    end if;
    update public.tarefas
    set funcionaria_id = p_nova_funcionaria_id, updated_at = now()
    where funcionaria_id = p_funcionario_id
      and status in ('nova', 'em_andamento', 'aguardando_cliente', 'aguardando_banco', 'aguardando_judiciario', 'impedida');
  elsif p_destino = 'arquivar' then
    update public.tarefas
    set status = 'arquivada', exibir_tv = false, updated_at = now()
    where funcionaria_id = p_funcionario_id
      and status in ('nova', 'em_andamento', 'aguardando_cliente', 'aguardando_banco', 'aguardando_judiciario', 'impedida');
  else
    update public.tarefas
    set status = 'cancelada', exibir_tv = false, updated_at = now()
    where funcionaria_id = p_funcionario_id
      and status in ('nova', 'em_andamento', 'aguardando_cliente', 'aguardando_banco', 'aguardando_judiciario', 'impedida');
  end if;
  get diagnostics tarefas_processadas = row_count;

  update public.funcionarios
  set ativo = false,
      data_desligamento = coalesce(p_data_desligamento, current_date),
      observacao_interna = concat_ws(E'\n', nullif(observacao_interna, ''),
        '[Desligamento ' || coalesce(p_data_desligamento, current_date)::text || '] ' ||
        coalesce(nullif(trim(p_observacao), ''), 'Sem observacao.')),
      updated_at = now()
  where id = p_funcionario_id;

  return jsonb_build_object(
    'funcionario_id', p_funcionario_id,
    'nome', nome_origem,
    'destino', p_destino,
    'tarefas_processadas', tarefas_processadas
  );
end;
$$;

revoke all on function public.salvar_funcionario_supervisor(
  bigint, text, text, text, text, date, text, jsonb, text
) from public;
grant execute on function public.salvar_funcionario_supervisor(
  bigint, text, text, text, text, date, text, jsonb, text
) to authenticated;

revoke all on function public.desligar_funcionario_supervisor(
  bigint, text, bigint, date, text
) from public;
grant execute on function public.desligar_funcionario_supervisor(
  bigint, text, bigint, date, text
) to authenticated;

notify pgrst, 'reload schema';
commit;

-- IMPORTANTE SOBRE AUTH:
-- O campo funcionarios.ativo bloqueia o perfil dentro do CeliOS e das policies.
-- Para impedir tambem a autenticacao, desative/ban o usuario em
-- Authentication > Users no painel do Supabase. Nunca exponha service_role no React.
