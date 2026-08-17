-- Conclusão direta pela pessoa responsável e link obrigatório apenas para entregas documentais.
-- Execute depois de motor_operacional_tarefas_2026.sql e pop_esteira_tratativas_2026.sql.
begin;

alter table public.tarefas
  add column if not exists requer_comprovacao boolean not null default false,
  add column if not exists drive_document_url text;

create or replace function public.tipo_tarefa_exige_documento(p_tipo_codigo text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select upper(trim(coalesce(p_tipo_codigo, ''))) = any(array[
    'CONTRATO',
    'NOTIFICACAO_EXTRAJUDICIAL',
    'NOTIFICACAO_EMAIL',
    'DOCUMENTOS',
    'PROCURACOES',
    'CITACAO',
    'TERMOS',
    'DISTRATO',
    'CERTIDAO',
    'HOMOLOGACAO'
  ]::text[]);
$$;

create or replace function public.definir_comprovacao_tarefa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.requer_comprovacao := public.tipo_tarefa_exige_documento(new.tipo_tarefa_codigo);
  return new;
end;
$$;

drop trigger if exists definir_comprovacao_tarefa on public.tarefas;
create trigger definir_comprovacao_tarefa
before insert or update of tipo_tarefa_codigo on public.tarefas
for each row execute function public.definir_comprovacao_tarefa();

update public.tarefas
set requer_comprovacao = public.tipo_tarefa_exige_documento(tipo_tarefa_codigo)
where requer_comprovacao is distinct from public.tipo_tarefa_exige_documento(tipo_tarefa_codigo);

-- LAUDO representa a solicitação/acompanhamento do laudo pericial, não a entrega
-- obrigatória de um documento produzido pela equipe.
update public.tipos_tarefa_sla
set checklist_padrao = '["Solicitação do laudo registrada","Responsável ou perito acionado","Prazo ou retorno informado","CRM atualizado"]'::jsonb,
    updated_at = now()
where codigo = 'LAUDO';

update public.tarefas
set criterios_conclusao = '["Solicitação do laudo registrada","Responsável ou perito acionado","Prazo ou retorno informado","CRM atualizado"]'::jsonb,
    updated_at = now()
where tipo_tarefa_codigo = 'LAUDO'
  and status not in ('concluida','cancelada','arquivada');

create or replace function public.movimentar_tarefa_operacional(
  p_tarefa_id bigint,p_acao text,p_motivo text default null,p_checklist jsonb default null,
  p_observacoes text default null,p_nome_arquivo text default null,p_drive_url text default null,
  p_crm_atualizado boolean default false,p_planilha_atualizada boolean default false
) returns public.tarefas language plpgsql security definer set search_path=public as $$
declare
  t public.tarefas;
  anterior text;
  uid bigint:=public.funcionario_id_autenticado();
  email_autor text:=lower(coalesce(auth.jwt()->>'email',''));
  destino text;
  descricao_evento text;
  evento text;
  link_drive text := nullif(trim(coalesce(p_drive_url,'')), '');
  nome_arquivo text := nullif(trim(coalesce(p_nome_arquivo,'')), '');
begin
  select * into t from public.tarefas where id=p_tarefa_id for update;
  if t.id is null then raise exception 'Tarefa nao encontrada.'; end if;
  anterior:=t.status;

  if p_acao in ('aceitar','iniciar','aguardar','concluir','devolver_conferencia','devolver_solicitante')
     and not public.usuario_e_admin() and t.funcionaria_id is distinct from uid then
    raise exception 'Tarefa nao atribuida ao usuario.';
  end if;
  if p_acao in ('aprovar','corrigir','cancelar') and not public.usuario_e_admin() then
    raise exception 'Acao restrita a supervisao.';
  end if;

  if p_acao='aceitar' and t.status='delegada' then
    destino:='recebida'; descricao_evento:='Tarefa aceita pelo responsavel.'; t.aceita_em:=now(); evento:='aceitar';
  elsif p_acao='iniciar' and t.status in ('recebida','devolvida_correcao','aguardando_informacao') then
    destino:='em_execucao'; descricao_evento:='Execucao iniciada.'; t.execucao_iniciada_em:=coalesce(t.execucao_iniciada_em,now()); evento:='iniciar';
  elsif p_acao='aguardar' and t.status in ('recebida','em_execucao') then
    if char_length(trim(coalesce(p_motivo,'')))<10 then raise exception 'Informe o motivo da espera.'; end if;
    destino:='aguardando_informacao'; descricao_evento:='Tarefa aguardando informacao: '||trim(p_motivo); t.bloqueio_motivo:=trim(p_motivo); evento:='aguardar';
  elsif p_acao='devolver_solicitante' and t.status in ('delegada','recebida','em_execucao','aguardando_informacao') then
    if char_length(trim(coalesce(p_motivo,'')))<10 then raise exception 'Justificativa obrigatoria.'; end if;
    destino:='devolvida'; descricao_evento:='Tarefa devolvida ao solicitante: '||trim(p_motivo); evento:='devolver_solicitante';
  elsif p_acao in ('concluir','devolver_conferencia') and t.status='em_execucao' then
    if link_drive is not null and link_drive !~* '^https://(drive|docs)\.google\.com/' then
      raise exception 'O link informado deve ser do Google Drive.';
    end if;

    destino:='concluida';
    descricao_evento:='Tarefa executada e concluida pelo responsavel.';
    evento:='concluir';
    t.checklist_execucao:=coalesce(p_checklist,'{}'::jsonb);
    t.observacoes_devolutiva:=trim(p_observacoes);
    t.nome_arquivo_evidencia:=case when link_drive is not null then nome_arquivo else null end;
    t.evidencia_url:=coalesce(link_drive,t.evidencia_url);
    t.drive_document_url:=coalesce(link_drive,t.drive_document_url);
    t.crm_atualizado:=coalesce(p_crm_atualizado,false);
    t.planilha_atualizada:=coalesce(p_planilha_atualizada,false);
    t.drive_arquivado:=link_drive is not null;
    t.concluida_em:=now();
  elsif p_acao='aprovar' and t.status='devolvida_conferencia' then
    destino:='concluida'; descricao_evento:='Tarefa conferida e aprovada.'; t.conferida_em:=now(); t.conferida_por_email:=email_autor; t.concluida_em:=now(); evento:='aprovar';
  elsif p_acao='corrigir' and t.status='devolvida_conferencia' then
    if char_length(trim(coalesce(p_motivo,'')))<10 then raise exception 'Descreva a correcao necessaria.'; end if;
    destino:='devolvida_correcao'; descricao_evento:='Correcao solicitada: '||trim(p_motivo); evento:='corrigir';
  elsif p_acao='cancelar' and t.status<>'concluida' then
    destino:='cancelada'; descricao_evento:='Tarefa cancelada: '||trim(coalesce(p_motivo,'Sem continuidade')); evento:='cancelar';
  else
    raise exception 'Transicao % invalida para o status %.',p_acao,t.status;
  end if;

  perform set_config('platino.motor_operacional','1',true);
  if destino='devolvida' then perform set_config('platino.devolucao_validada','1',true); end if;

  update public.tarefas set
    status=destino,aceita_em=t.aceita_em,execucao_iniciada_em=t.execucao_iniciada_em,
    bloqueio_motivo=t.bloqueio_motivo,devolvida_conferencia_em=t.devolvida_conferencia_em,
    checklist_execucao=t.checklist_execucao,observacoes_devolutiva=t.observacoes_devolutiva,
    nome_arquivo_evidencia=t.nome_arquivo_evidencia,evidencia_url=t.evidencia_url,
    drive_document_url=t.drive_document_url,crm_atualizado=t.crm_atualizado,
    planilha_atualizada=t.planilha_atualizada,drive_arquivado=t.drive_arquivado,
    conferida_em=t.conferida_em,conferida_por_email=t.conferida_por_email,
    concluida_em=t.concluida_em,updated_at=now(),versao=versao+1
  where id=t.id returning * into t;

  perform public.registrar_evento_tarefa(
    t.id,evento,anterior,destino,descricao_evento,
    jsonb_build_object('motivo',p_motivo,'autor_email',email_autor,'drive_url',link_drive)
  );
  if destino='devolvida' then
    perform public.notificar_tarefa(t.id,null,t.solicitante_email,destino,'Tarefa devolvida',descricao_evento);
  elsif destino='concluida' then
    perform public.notificar_tarefa(t.id,null,t.solicitante_email,'concluida','Tarefa concluida',descricao_evento);
  elsif destino='devolvida_correcao' then
    perform public.notificar_tarefa(t.id,t.funcionaria_id,null,'correcao','Correcao solicitada',descricao_evento);
  end if;
  return t;
end;
$$;

-- As versoes anteriores usavam parametros com DEFAULT. O PostgreSQL exige
-- remover as assinaturas antes de recria-las com a nova definicao.
drop function if exists public.concluir_tarefa_pop(bigint,text,text,text,boolean,boolean,text);
drop function if exists public.concluir_tarefa_pop(bigint,text,text,text,boolean,boolean,text,jsonb);

create function public.concluir_tarefa_pop(
  p_tarefa_id bigint, p_observacoes text, p_nome_arquivo text,
  p_drive_url text, p_crm_atualizado boolean, p_planilha_atualizada boolean,
  p_resultado text, p_checklist jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  tarefa public.tarefas;
  retorno jsonb;
  status_anterior text;
  nome_normalizado text := nullif(trim(coalesce(p_nome_arquivo,'')), '');
  link_drive text := nullif(trim(coalesce(p_drive_url,'')), '');
begin
  select * into tarefa from public.tarefas where id=p_tarefa_id for update;
  if tarefa.id is null then raise exception 'Tarefa nao encontrada.'; end if;
  status_anterior := tarefa.status;
  if not public.usuario_e_admin() and tarefa.funcionaria_id is distinct from public.funcionario_id_autenticado() then
    raise exception 'Tarefa nao autorizada.';
  end if;
  if link_drive is not null and link_drive !~* '^https://(drive|docs)\.google\.com/' then
    raise exception 'O link informado deve ser do Google Drive.';
  end if;

  update public.tarefas set
    observacoes_devolutiva=trim(p_observacoes),
    nome_arquivo_evidencia=case when link_drive is not null then nome_normalizado else nome_arquivo_evidencia end,
    evidencia_url=coalesce(link_drive,evidencia_url),
    drive_document_url=coalesce(link_drive,drive_document_url),
    drive_arquivado=link_drive is not null,
    crm_atualizado=coalesce(p_crm_atualizado,false),
    planilha_atualizada=coalesce(p_planilha_atualizada,false),
    arquivar_cliente_alerta=lower(coalesce(titulo,'') || ' ' || coalesce(descricao,''))
      ~ '(distrato|desistência|desistencia|fim de serviço|fim de servico|encerramento)',updated_at=now()
  where id=p_tarefa_id returning * into tarefa;

  if tarefa.origem='esteira' then
    retorno := public.concluir_tarefa_e_liberar_proxima(tarefa.id,link_drive,p_resultado);
  else
    perform set_config('platino.motor_operacional','1',true);
    update public.tarefas set status='concluida',concluida_em=now() where id=tarefa.id returning * into tarefa;
    perform public.registrar_evento_tarefa(
      tarefa.id,'concluir',status_anterior,'concluida','Tarefa executada e concluida pelo responsavel.',
      jsonb_build_object('drive_url',link_drive,'observacoes',trim(p_observacoes))
    );
    retorno := jsonb_build_object('tarefa_concluida',to_jsonb(tarefa),'proxima_tarefa',null);
  end if;
  return retorno;
end;
$$;

-- Compatibilidade imediata com versoes do frontend que ainda enviam 7 parametros.
create or replace function public.concluir_tarefa_pop(
  p_tarefa_id bigint, p_observacoes text, p_nome_arquivo text,
  p_drive_url text, p_crm_atualizado boolean, p_planilha_atualizada boolean,
  p_resultado text
) returns jsonb language sql security definer set search_path=public as $$
  select public.concluir_tarefa_pop(
    p_tarefa_id, p_observacoes, p_nome_arquivo, p_drive_url,
    p_crm_atualizado, p_planilha_atualizada, p_resultado, null::jsonb
  );
$$;

-- Entregas que já estavam aguardando uma conferência que deixou de ser necessária
-- são finalizadas, preservando todos os dados e evidências registrados.
do $$
declare registro record;
begin
  perform set_config('platino.motor_operacional','1',true);
  for registro in
    update public.tarefas
    set status='concluida', concluida_em=coalesce(concluida_em,now()), updated_at=now(), versao=versao+1
    where origem='operacional' and status='devolvida_conferencia'
    returning id
  loop
    perform public.registrar_evento_tarefa(
      registro.id,'conclusao_direta','devolvida_conferencia','concluida',
      'Tarefa concluida conforme a nova regra de autonomia da equipe.',
      jsonb_build_object('migracao','conclusao_direta_tarefas_2026')
    );
  end loop;
end;
$$;

revoke all on function public.tipo_tarefa_exige_documento(text) from public;
grant execute on function public.tipo_tarefa_exige_documento(text) to authenticated, service_role;
revoke all on function public.movimentar_tarefa_operacional(bigint,text,text,jsonb,text,text,text,boolean,boolean) from public;
grant execute on function public.movimentar_tarefa_operacional(bigint,text,text,jsonb,text,text,text,boolean,boolean) to authenticated;
revoke all on function public.concluir_tarefa_pop(bigint,text,text,text,boolean,boolean,text,jsonb) from public;
grant execute on function public.concluir_tarefa_pop(bigint,text,text,text,boolean,boolean,text,jsonb) to authenticated;
revoke all on function public.concluir_tarefa_pop(bigint,text,text,text,boolean,boolean,text) from public;
grant execute on function public.concluir_tarefa_pop(bigint,text,text,text,boolean,boolean,text) to authenticated;

comment on function public.concluir_tarefa_pop(bigint,text,text,text,boolean,boolean,text,jsonb) is
'Conclui a tarefa diretamente sem exigir checklist, observacao ou evidencia.';

-- Faz o PostgREST reconhecer imediatamente as assinaturas e regras atualizadas.
notify pgrst, 'reload schema';
commit;
