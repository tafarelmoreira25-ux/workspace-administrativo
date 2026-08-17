-- Permite que o supervisor conclua somente tarefas atribuídas a ele próprio.
-- Execute no SQL Editor depois de motor_operacional_tarefas_2026.sql.

begin;

alter table public.tarefas
  add column if not exists observacoes_devolutiva text,
  add column if not exists evidencia_url text,
  add column if not exists drive_document_url text;

-- Algumas bases antigas não possuem uma restrição UNIQUE em funcionarios.email.
-- Não usar ON CONFLICT(email), pois ele falharia e impediria a criação da RPC.
with funcionario_atualizado as (
  update public.funcionarios
  set nome = 'Tafarel Moreira',
      cargo = 'Supervisor',
      ativo = true
  where lower(trim(email)) = 'tafarel@platino.com'
  returning id
)
insert into public.funcionarios (nome, email, cargo, ativo)
select 'Tafarel Moreira', 'tafarel@platino.com', 'Supervisor', true
where not exists (select 1 from funcionario_atualizado);

create or replace function public.concluir_tarefa_propria_supervisor(
  p_tarefa_id bigint,
  p_observacoes text default null,
  p_drive_url text default null
)
returns public.tarefas
language plpgsql
security definer
set search_path = public
as $$
declare
  tarefa public.tarefas;
  tarefa_concluida public.tarefas;
  funcionario_id bigint := public.funcionario_id_autenticado();
  nome_funcionario text;
  email_autor text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if not public.usuario_e_admin() then
    raise exception 'Ação restrita à supervisão.';
  end if;

  select nome
  into nome_funcionario
  from public.funcionarios
  where id = funcionario_id;

  select *
  into tarefa
  from public.tarefas
  where id = p_tarefa_id
  for update;

  if tarefa.id is null then
    raise exception 'Tarefa não encontrada.';
  end if;

  if not (
    funcionario_id is not null
    and tarefa.funcionaria_id = funcionario_id
  ) and not (
    lower(trim(coalesce(tarefa.responsavel_texto, ''))) =
      lower(trim(coalesce(nome_funcionario, 'Tafarel Moreira')))
  ) then
    raise exception 'Esta tarefa não está atribuída ao supervisor autenticado.';
  end if;

  if tarefa.status not in (
    'pendente', 'nova', 'em_andamento', 'delegada', 'recebida',
    'em_execucao', 'aguardando_informacao', 'devolvida_correcao',
    'bloqueada', 'devolvida', 'aguardando_cliente', 'aguardando_banco',
    'aguardando_juridico', 'aguardando_judiciario', 'impedida', 'em_revisao'
  ) then
    raise exception 'A tarefa não está disponível para conclusão.';
  end if;

  if nullif(trim(coalesce(p_drive_url, '')), '') is not null
     and trim(p_drive_url) !~* '^https://(drive|docs)\.google\.com/' then
    raise exception 'Informe um link valido do Google Drive.';
  end if;

  perform set_config('platino.motor_operacional', '1', true);

  update public.tarefas
  set status = 'concluida',
      concluida_em = now(),
      conferida_em = now(),
      conferida_por_email = email_autor,
      observacoes_devolutiva = trim(p_observacoes),
      evidencia_url = coalesce(nullif(trim(coalesce(p_drive_url, '')), ''), evidencia_url),
      drive_document_url = coalesce(nullif(trim(coalesce(p_drive_url, '')), ''), drive_document_url),
      updated_at = now(),
      versao = coalesce(versao, 0) + 1
  where id = tarefa.id
  returning * into tarefa_concluida;

  perform public.registrar_evento_tarefa(
    tarefa_concluida.id,
    'concluir_supervisor',
    tarefa.status,
    'concluida',
    'Tratativa realizada e concluída pelo próprio supervisor responsável.',
    jsonb_build_object('autor_email', email_autor, 'drive_url', nullif(trim(coalesce(p_drive_url, '')), ''))
  );

  return tarefa_concluida;
end;
$$;

revoke all on function public.concluir_tarefa_propria_supervisor(bigint) from public;
grant execute on function public.concluir_tarefa_propria_supervisor(bigint) to authenticated;
grant execute on function public.concluir_tarefa_propria_supervisor(bigint, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
