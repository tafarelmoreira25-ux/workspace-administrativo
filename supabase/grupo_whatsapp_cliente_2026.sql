-- Tarefa especial: abertura do grupo de WhatsApp do cliente.
-- Execute depois de motor_operacional_tarefas_2026.sql,
-- cadastrar_equipe_juridico.sql e responsaveis_por_funcao_2026.sql.
-- Script idempotente: pode ser executado novamente com segurança.

begin;

insert into public.tipos_tarefa_sla (
  codigo,
  nome,
  sla_minutos,
  checklist_padrao,
  ativo,
  updated_at
)
values (
  'ABRIR_GRUPO_WHATSAPP',
  'ABRIR GRUPO NO WHATSAPP',
  60,
  '["Grupo criado","Cliente adicionado","Consultor responsável adicionado","Mensagem inicial enviada"]'::jsonb,
  true,
  now()
)
on conflict (codigo) do update
set nome = excluded.nome,
    sla_minutos = excluded.sla_minutos,
    checklist_padrao = excluded.checklist_padrao,
    ativo = true,
    updated_at = now();

create or replace function public.validar_tarefa_grupo_whatsapp()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  email_solicitante text;
  equipe_responsavel text;
begin
  if new.tipo_tarefa_codigo is distinct from 'ABRIR_GRUPO_WHATSAPP' then
    return new;
  end if;

  email_solicitante := lower(trim(coalesce(new.solicitante_email, '')));

  if tg_op = 'INSERT' and email_solicitante not in (
    'nicolas@platino.com',
    'tafarel@platino.com'
  ) then
    raise exception 'Somente Nicolas ou Tafarel podem delegar a tarefa de abrir grupo no WhatsApp.';
  end if;

  select lower(trim(coalesce(f.setor, f.cargo, '')))
    into equipe_responsavel
  from public.funcionarios f
  where f.id = new.funcionaria_id
    and f.ativo is not false;

  if equipe_responsavel is null or equipe_responsavel not like '%jurídic%'
     and equipe_responsavel not like '%juridic%' then
    raise exception 'A tarefa de abrir grupo no WhatsApp deve ser delegada a uma pessoa ativa da Equipe Jurídico.';
  end if;

  new.setor_executor := 'Jurídico';
  return new;
end;
$$;

drop trigger if exists validar_tarefa_grupo_whatsapp_trigger on public.tarefas;
create trigger validar_tarefa_grupo_whatsapp_trigger
before insert or update of tipo_tarefa_codigo, funcionaria_id, setor_executor
on public.tarefas
for each row
execute function public.validar_tarefa_grupo_whatsapp();

commit;

select codigo, nome, sla_minutos, checklist_padrao, ativo
from public.tipos_tarefa_sla
where codigo = 'ABRIR_GRUPO_WHATSAPP';
