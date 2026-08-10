-- Workspace Platino · POP da Esteira de Tratativas v1.0 (2026)
-- Execute depois de configurar_sistema.sql, evolucao_esteiras_administrativas.sql
-- e gamificacao_devolucao_checklist.sql.
begin;

-- Tafarel e Nicolas sao os supervisores operacionais definidos pelo POP.
update public.funcionarios set cargo='Supervisor', updated_at=now()
where lower(nome) like '%tafarel%' or lower(nome) like '%nicolas%';

create or replace function public.usuario_e_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select lower(trim(coalesce(auth.jwt()->>'email','')))='tafarel@platino.com'
    or exists (
      select 1 from public.funcionarios f
      where lower(trim(f.email))=lower(trim(coalesce(auth.jwt()->>'email','')))
        and f.ativo is not false
        and (lower(f.nome) like '%tafarel%' or lower(f.nome) like '%nicolas%')
        and lower(coalesce(f.cargo,'')) like '%supervisor%'
    );
$$;

revoke all on function public.usuario_e_admin() from public;
grant execute on function public.usuario_e_admin() to authenticated;

alter table public.tarefas drop constraint if exists tarefas_categoria_check;
alter table public.tarefas add constraint tarefas_categoria_check check (
  categoria is null or categoria in (
    'CONTRATO','NOTIFICAÇÃO EXTRAJUDICIAL','GOV','NOTIFICAÇÃO DE REQUERIMENTO (E-MAIL)',
    'CANCELAMENTO DE SEGURO','DOCUMENTOS','AUXILIAR CLIENTE','PROCURAÇÕES',
    'ENCAMINHAR PROCESSUAL','ATUALIZAÇÃO PROCESSUAL','CITAÇÃO','LAUDO','TERMOS',
    'AGENDAR AUDIÊNCIA','DISTRATO','CERTIDÃO','HOMOLOGAÇÃO','CLIENTE SOLICITA RETORNO','OUTROS',
    'ENC. PROCESSUAL','AUDIÊNCIA','SEGUROS'
  )
);

alter table public.clientes
  add column if not exists pasta_drive_url text,
  add column if not exists pasta_drive_nome text,
  add column if not exists status_operacional text not null default 'ativo',
  add column if not exists crm_referencia text,
  add column if not exists documentos_iniciais_completos boolean not null default false,
  add column if not exists crm_atualizado boolean not null default false,
  add column if not exists planilha_atualizada boolean not null default false;

alter table public.tarefas
  add column if not exists id_externo text,
  add column if not exists nome_cliente text,
  add column if not exists etapa_esteira text,
  add column if not exists acao_operacional text,
  add column if not exists setor_solicitante text,
  add column if not exists observacoes_devolutiva text,
  add column if not exists nome_arquivo_evidencia text,
  add column if not exists drive_arquivado boolean not null default false,
  add column if not exists crm_atualizado boolean not null default false,
  add column if not exists planilha_atualizada boolean not null default false,
  add column if not exists arquivar_cliente_alerta boolean not null default false;

alter table public.tarefas
  alter column solicitante_email set default lower(coalesce(auth.jwt()->>'email',''));

create unique index if not exists tarefas_id_externo_uidx
on public.tarefas(id_externo) where id_externo is not null;

create or replace function public.gerar_id_tarefa_pop()
returns trigger language plpgsql set search_path=public as $$
declare sequencia integer;
begin
  if new.id_externo is null then
    perform pg_advisory_xact_lock(hashtext('tarefa-pop-' || to_char(current_date,'YYYYMMDD')));
    select count(*) + 1 into sequencia from public.tarefas
      where id_externo like 'TSK-' || to_char(current_date,'YYYYMMDD') || '-%';
    new.id_externo := 'TSK-' || to_char(current_date,'YYYYMMDD') || '-' || lpad(sequencia::text,3,'0');
  end if;
  return new;
end $$;

drop trigger if exists gerar_id_tarefa_pop on public.tarefas;
create trigger gerar_id_tarefa_pop before insert on public.tarefas
for each row execute function public.gerar_id_tarefa_pop();

create or replace function public.concluir_tarefa_pop(
  p_tarefa_id bigint, p_observacoes text, p_nome_arquivo text,
  p_drive_url text, p_crm_atualizado boolean, p_planilha_atualizada boolean,
  p_resultado text default 'nao_se_aplica'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare tarefa public.tarefas; retorno jsonb; nome_normalizado text;
begin
  select * into tarefa from public.tarefas where id=p_tarefa_id for update;
  if tarefa.id is null then raise exception 'Tarefa nao encontrada.'; end if;
  if not public.usuario_e_admin() and tarefa.funcionaria_id is distinct from public.funcionario_id_autenticado() then
    raise exception 'Tarefa nao autorizada.';
  end if;
  if nullif(trim(coalesce(p_observacoes,'')),'') is null then
    raise exception 'Tarefa nao pode ser concluida. Informe a devolutiva do que foi executado.';
  end if;
  nome_normalizado := trim(coalesce(p_nome_arquivo,''));
  if nome_normalizado !~* '^\d{4}-\d{2}-\d{2}(_[A-Z0-9]+(-[A-Z0-9]+)*){4}\.[A-Z0-9]{2,5}$' then
    raise exception 'Tarefa nao pode ser concluida. Nomenclatura invalida: use DATA_CLIENTE_TIPO-DE-DOCUMENTO_STATUS_RESPONSAVEL.extensao.';
  end if;
  if trim(coalesce(p_drive_url,'')) !~* '^https://(drive|docs)\.google\.com/' then
    raise exception 'Tarefa nao pode ser concluida. Informe o link do arquivo no Google Drive.';
  end if;
  if coalesce(p_crm_atualizado,false) is false or coalesce(p_planilha_atualizada,false) is false then
    raise exception 'Tarefa nao pode ser concluida. Atualize o CRM e a Planilha Geral.';
  end if;

  update public.tarefas set observacoes_devolutiva=trim(p_observacoes),
    nome_arquivo_evidencia=nome_normalizado,evidencia_url=trim(p_drive_url),
    drive_arquivado=true,crm_atualizado=true,planilha_atualizada=true,
    arquivar_cliente_alerta=lower(coalesce(titulo,'') || ' ' || coalesce(descricao,''))
      ~ '(distrato|desistência|desistencia|fim de serviço|fim de servico|encerramento)',updated_at=now()
  where id=p_tarefa_id returning * into tarefa;

  if tarefa.origem='esteira' then
    retorno := public.concluir_tarefa_e_liberar_proxima(tarefa.id,trim(p_drive_url),p_resultado);
  else
    update public.tarefas set status='concluida',concluida_em=now() where id=tarefa.id returning * into tarefa;
    retorno := jsonb_build_object('tarefa_concluida',to_jsonb(tarefa),'proxima_tarefa',null);
  end if;
  return retorno;
end $$;

revoke all on function public.concluir_tarefa_pop(bigint,text,text,text,boolean,boolean,text) from public;
grant execute on function public.concluir_tarefa_pop(bigint,text,text,text,boolean,boolean,text) to authenticated;

comment on function public.concluir_tarefa_pop is
'Aplica as validacoes obrigatorias de nomenclatura, Drive, CRM, Planilha e devolutiva do POP 1.0.';

commit;
