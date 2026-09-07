-- Remoção dos módulos descontinuados do Workspace Platino.
-- PREPARADO LOCALMENTE; ainda não executado nem validado no banco remoto.
-- Execute no SQL Editor do projeto correto após exportar os dados que deseja guardar.
-- Apaga definitivamente as tabelas listadas e todos os registros contidos nelas.
-- Preserva Authentication, perfis de acesso, documentos, planner e feedbacks.
-- Usa RESTRICT: uma dependência não prevista interrompe e reverte a transação.
-- Não altera Storage nem a Edge Function sincronizar-clientes-drive.
-- Se houver bloqueio, execute diagnosticar_dependencias_modulos.sql (somente leitura).

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create temporary table escopo_remocao_modulos (
  tipo text not null,
  nome text not null,
  primary key (tipo, nome)
) on commit drop;

insert into escopo_remocao_modulos select 'table', unnest(array[
    'alertas_esteira',
    'atualizacoes_gerais',
    'chamadas_atencao',
    'clientes',
    'esteiras_eventos',
    'instancias_esteira',
    'modelos_esteira',
    'modelos_etapas',
    'modelos_tarefa',
    'notificacoes_operacionais',
    'processos',
    'processos_andamentos',
    'prospeccoes_hunter',
    'prospeccoes_hunter_historico',
    'relatorios_processuais',
    'responsaveis_por_funcao',
    'status_processual_clientes',
    'status_processual_historico',
    'tarefas',
    'tarefas_auditoria',
    'tarefas_comentarios',
    'tarefas_prazos_historico',
    'taskmanager_catalogo',
    'tipos_tarefa_sla',
    'tratativas',
    'urgencias',
    'urgencias_eventos'
  ]);
insert into escopo_remocao_modulos select 'function', unnest(array[
    'aplicar_modelo_tarefa_supervisor',
    'atualizar_responsavel_funcao',
    'atualizar_tarefa_supervisor',
    'auditar_alteracao_prazo',
    'auditar_tarefa_esteira',
    'bloquear_avanco_sem_documentos',
    'carregar_responsaveis_por_funcao',
    'concluir_tarefa_e_liberar_proxima',
    'concluir_tarefa_pop',
    'concluir_tarefa_propria_supervisor',
    'confirmar_relatorio_processual',
    'criar_subprocesso_esteira_interno',
    'criar_urgencia',
    'definir_comprovacao_tarefa',
    'delegar_tarefa_operacional',
    'desligar_funcionario_supervisor',
    'devolver_tarefa',
    'enviar_chamada_atencao',
    'gerar_id_tarefa_pop',
    'gerenciar_instancia_esteira_supervisor',
    'gerenciar_tarefa_esteira_supervisor',
    'inferir_fase_taskmanager',
    'iniciar_esteira_administrativa',
    'listar_atualizacoes_gerais',
    'listar_clientes_central',
    'listar_clientes_drive_ativos',
    'listar_clientes_drive_disponiveis',
    'listar_destinatarios_tarefa',
    'listar_pastas_clientes_tarefas',
    'listar_prospeccoes_hunter',
    'listar_status_processual',
    'marcar_notificacao_lida',
    'movimentar_prospeccao_hunter',
    'movimentar_tarefa_operacional',
    'movimentar_urgencia',
    'notificar_conclusao_grupo_whatsapp',
    'notificar_mudanca_status_processual',
    'notificar_tarefa',
    'obter_responsavel_por_categoria',
    'preencher_fase_taskmanager',
    'proteger_devolucao_sem_justificativa',
    'proteger_edicao_tarefa_funcionaria',
    'publicar_atualizacao_geral',
    'registrar_andamento_supervisor',
    'registrar_anexo_imagem_tarefa',
    'registrar_conclusao_tarefa',
    'registrar_evento_tarefa',
    'registrar_perda_prazo',
    'salvar_checklist_documentos',
    'salvar_cliente_central',
    'salvar_funcionario_supervisor',
    'salvar_modelo_tarefa_supervisor',
    'salvar_processo_supervisor',
    'salvar_prospeccao_hunter',
    'salvar_rascunho_processual',
    'salvar_status_processual',
    'salvar_tarefa_manual_supervisor',
    'salvar_todos_responsaveis_funcao',
    'sincronizar_catalogo_clientes_drive',
    'sincronizar_clientes_drive',
    'sincronizar_comprovacao_drive_tarefa',
    'tipo_tarefa_exige_documento',
    'usuario_pode_editar_status_processual',
    'usuario_pode_visualizar_status_processual',
    'validar_equipe_responsavel_tarefa',
    'validar_tarefa_grupo_whatsapp'
  ]);
insert into escopo_remocao_modulos select 'view', unnest(array[
    'alertas_esteira_calculados',
    'central_dashboard',
    'tarefas_operacionais_resumo',
    'tarefas_taskmanager_v1'
  ]);

-- Inventário explícito dos objetos existentes que serão removidos.
select e.tipo, e.nome
from escopo_remocao_modulos e
where (e.tipo in ('table', 'view') and to_regclass(format('public.%I', e.nome)) is not null)
   or (e.tipo = 'function' and exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = e.nome and p.prokind = 'f'
   ))
order by e.tipo, e.nome;

-- O documento mantém cliente_nome, CPF, contrato e seus arquivos.
-- Remove apenas a antiga ligação com o cadastro que será apagado.
alter table if exists public.documentos_juridicos drop column if exists cliente_id restrict;

-- Retira automações e políticas somente das tabelas destinadas à exclusão.
-- Isso permite remover as funções chamadas por esses objetos sem CASCADE.
do $$
declare alvo record;
begin
  for alvo in
    select t.tgname, c.relname from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join escopo_remocao_modulos e on e.nome = c.relname and e.tipo = 'table'
    where n.nspname = 'public' and not t.tgisinternal
  loop
    execute format('drop trigger %I on public.%I restrict', alvo.tgname, alvo.relname);
  end loop;
  for alvo in
    select p.policyname, p.tablename from pg_policies p
    join escopo_remocao_modulos e on e.nome = p.tablename and e.tipo = 'table'
    where p.schemaname = 'public'
  loop
    execute format('drop policy %I on public.%I restrict', alvo.policyname, alvo.tablename);
  end loop;
end;
$$;

-- Resolve dependências entre os objetos explicitamente listados.
-- As tabelas são removidas juntas para acomodar referências mútuas.
do $$
declare
  alvo record;
  lista_tabelas text;
  progresso boolean;
  pendentes text;
  ultimo_erro text;
  detalhe_erro text;
  bloqueios text[];
begin
  loop
    progresso := false;
    bloqueios := array[]::text[];
    for alvo in
      select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join escopo_remocao_modulos e on e.nome = c.relname and e.tipo = 'view'
      where n.nspname = 'public' and c.relkind = 'v'
    loop
      begin
        execute format('drop view public.%I restrict', alvo.relname);
        progresso := true;
      exception when dependent_objects_still_exist then
        get stacked diagnostics
          ultimo_erro = message_text,
          detalhe_erro = pg_exception_detail;
        bloqueios := array_append(bloqueios, format(
          'View public.%I: %s%s%s', alvo.relname, ultimo_erro,
          E'\n', coalesce(nullif(detalhe_erro, ''), 'Sem detalhe adicional.')
        ));
      end;
    end loop;

    for alvo in
      select p.proname, pg_get_function_identity_arguments(p.oid) argumentos
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      join escopo_remocao_modulos e on e.nome = p.proname and e.tipo = 'function'
      where n.nspname = 'public' and p.prokind = 'f'
    loop
      begin
        execute format('drop function public.%I(%s) restrict', alvo.proname, alvo.argumentos);
        progresso := true;
      exception when dependent_objects_still_exist then
        get stacked diagnostics
          ultimo_erro = message_text,
          detalhe_erro = pg_exception_detail;
        bloqueios := array_append(bloqueios, format(
          'Função public.%I(%s): %s%s%s', alvo.proname, alvo.argumentos,
          ultimo_erro, E'\n', coalesce(nullif(detalhe_erro, ''), 'Sem detalhe adicional.')
        ));
      end;
    end loop;

    select string_agg(format('public.%I', c.relname), ', ') into lista_tabelas
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join escopo_remocao_modulos e on e.nome = c.relname and e.tipo = 'table'
    where n.nspname = 'public' and c.relkind in ('r','p');
    if lista_tabelas is not null then
      begin
        execute 'drop table ' || lista_tabelas || ' restrict';
        progresso := true;
      exception when dependent_objects_still_exist then
        get stacked diagnostics
          ultimo_erro = message_text,
          detalhe_erro = pg_exception_detail;
        bloqueios := array_append(bloqueios, format(
          'Tabelas: %s%s%s', ultimo_erro,
          E'\n', coalesce(nullif(detalhe_erro, ''), 'Sem detalhe adicional.')
        ));
      end;
    end if;

    select string_agg(e.tipo || ': ' || e.nome, ', ') into pendentes
    from escopo_remocao_modulos e
    where (e.tipo in ('table','view') and to_regclass(format('public.%I', e.nome)) is not null)
       or (e.tipo = 'function' and exists (
         select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = e.nome and p.prokind = 'f'
       ));
    exit when pendentes is null;
    if not progresso then
      raise exception using
        message = 'Limpeza revertida. Dependências que bloquearam a remoção:'
          || E'\n' || array_to_string(bloqueios, E'\n\n'),
        detail = 'Objetos pendentes: ' || pendentes,
        hint = 'Execute diagnosticar_dependencias_modulos.sql e revise os objetos apontados antes de ampliar a remoção.';
    end if;
  end loop;
end;
$$;

-- Recompõe a indexação dos documentos sem depender do cadastro de clientes.
do $$
begin
  if to_regclass('public.documentos_juridicos') is not null then
    create index if not exists documentos_juridicos_cliente_idx
      on public.documentos_juridicos (cliente_nome, created_at desc);
  end if;
end;
$$;

commit;
