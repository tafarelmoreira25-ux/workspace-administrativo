-- Compatibiliza os módulos processuais atuais com as chaves bigint do banco legado.
-- Migration aditiva e idempotente. Não apaga registros nem substitui dados preenchidos.

begin;

create extension if not exists pgcrypto;

-- PROCESSOS -----------------------------------------------------------------

alter table public.processos alter column numero drop not null;

alter table public.processos
  add column if not exists cliente_id bigint references public.clientes(id) on delete set null,
  add column if not exists processo_cliente_historico_id bigint references public.processos_clientes(id) on delete set null,
  add column if not exists pasta_cliente_id text,
  add column if not exists nome_cliente text,
  add column if not exists cpf_cliente text,
  add column if not exists autor_reu text,
  add column if not exists autor text,
  add column if not exists reu text,
  add column if not exists banco_reu text,
  add column if not exists produto text,
  add column if not exists numero_contrato text,
  add column if not exists motivo_ajuizamento text,
  add column if not exists fase_atual text default 'Solicitado para Ajuizamento',
  add column if not exists status_judicial text,
  add column if not exists status_documentos text default 'Pendente',
  add column if not exists status_procuracao text default 'Pendente',
  add column if not exists documentos_elite_status text default 'Pendente',
  add column if not exists documentacao_status text default 'Pendente',
  add column if not exists documentacao_motivo text,
  add column if not exists documentacao_faltantes text,
  add column if not exists documentacao_responsabilidade text,
  add column if not exists documentacao_observacao text,
  add column if not exists documentacao_data date,
  add column if not exists procuracao_status text default 'Elaborando',
  add column if not exists declaracao_hipossuficiencia_status text default 'Elaborando',
  add column if not exists declaracao_ir_status text default 'Elaborando',
  add column if not exists procuracoes_outros text,
  add column if not exists crm_documentos_status text default 'Pendente',
  add column if not exists crm_documentos_data timestamptz,
  add column if not exists crm_documentos_responsavel text,
  add column if not exists crm_documentos_usuario text,
  add column if not exists pasta_retornada boolean default false,
  add column if not exists pasta_retorno_status text default 'Não retornada',
  add column if not exists pasta_retorno_data date,
  add column if not exists pasta_retorno_motivo text,
  add column if not exists pasta_retorno_descricao text,
  add column if not exists pasta_retorno_responsabilidade text,
  add column if not exists pasta_retorno_documento_faltante text,
  add column if not exists pasta_retorno_data_regularizacao date,
  add column if not exists pasta_retorno_data_reenvio date,
  add column if not exists pasta_retorno_observacao text,
  add column if not exists pasta_retorno_impacto_sla text default 'não altera',
  add column if not exists protocolo_status text default 'Aguardando',
  add column if not exists protocolo_data_liberacao timestamptz,
  add column if not exists status_prazo text,
  add column if not exists data_envio_elite timestamptz,
  add column if not exists sla_iniciado_em timestamptz,
  add column if not exists sla_encerrado_em timestamptz,
  add column if not exists sla_dias_uteis_utilizados integer,
  add column if not exists data_protocolo_liberado timestamptz,
  add column if not exists data_distribuicao date,
  add column if not exists numero_processo text,
  add column if not exists comarca text,
  add column if not exists justica_gratuita text,
  add column if not exists emenda_inicial text,
  add column if not exists emenda_status text,
  add column if not exists link_processo text,
  add column if not exists id_crm text,
  add column if not exists responsavel text,
  add column if not exists updated_by text,
  add column if not exists checklist_elite jsonb default '{}'::jsonb,
  add column if not exists origem_registro text default 'manual',
  add column if not exists created_by text,
  add column if not exists situacao text,
  add column if not exists fase_judicial text,
  add column if not exists resultado text,
  add column if not exists ultima_movimentacao text,
  add column if not exists ultima_movimentacao_data timestamptz,
  add column if not exists ultima_revisao date,
  add column if not exists ultima_revisao_por text,
  add column if not exists ultima_revisao_observacao text,
  add column if not exists ultima_revisao_em timestamptz,
  add column if not exists proxima_revisao date,
  add column if not exists custas_status text,
  add column if not exists com_pendencia boolean default false,
  add column if not exists sem_revisao boolean default true,
  add column if not exists recursal boolean default false,
  add column if not exists ultimo_atendimento text,
  add column if not exists ultimo_relatorio_enviado text;

create unique index if not exists processos_historico_origem_uidx
  on public.processos (processo_cliente_historico_id)
  where processo_cliente_historico_id is not null;

update public.processos
set nome_cliente = coalesce(nullif(btrim(nome_cliente), ''), nullif(btrim(cliente), '')),
    numero_processo = coalesce(nullif(btrim(numero_processo), ''), nullif(btrim(numero), '')),
    autor = coalesce(nullif(btrim(autor), ''), nullif(btrim(cliente), '')),
    reu = coalesce(nullif(btrim(reu), ''), nullif(btrim(parte_contraria), '')),
    banco_reu = coalesce(nullif(btrim(banco_reu), ''), nullif(btrim(parte_contraria), '')),
    autor_reu = coalesce(nullif(btrim(autor_reu), ''), concat_ws(' X ', nullif(btrim(cliente), ''), nullif(btrim(parte_contraria), ''))),
    fase_atual = coalesce(nullif(btrim(fase_atual), ''), nullif(btrim(fase), ''), 'Solicitado para Ajuizamento'),
    status_judicial = coalesce(nullif(btrim(status_judicial), ''), nullif(btrim(status), '')),
    situacao = coalesce(nullif(btrim(situacao), ''), case when lower(status) in ('arquivado','encerrado') then 'Encerrado' else 'Em andamento' end),
    fase_judicial = coalesce(nullif(btrim(fase_judicial), ''), nullif(btrim(fase), ''));

create or replace function public.sincronizar_campos_processos_legado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome_cliente := coalesce(nullif(btrim(new.nome_cliente), ''), nullif(btrim(new.cliente), ''));
  new.cliente := coalesce(nullif(btrim(new.cliente), ''), new.nome_cliente);
  new.numero_processo := coalesce(nullif(btrim(new.numero_processo), ''), nullif(btrim(new.numero), ''));
  new.numero := coalesce(nullif(btrim(new.numero), ''), new.numero_processo);
  new.autor := coalesce(nullif(btrim(new.autor), ''), new.nome_cliente);
  new.reu := coalesce(nullif(btrim(new.reu), ''), nullif(btrim(new.banco_reu), ''), nullif(btrim(new.parte_contraria), ''));
  new.parte_contraria := coalesce(nullif(btrim(new.parte_contraria), ''), new.reu, nullif(btrim(new.banco_reu), ''));
  new.banco_reu := coalesce(nullif(btrim(new.banco_reu), ''), new.reu);
  new.autor_reu := coalesce(nullif(btrim(new.autor_reu), ''), concat_ws(' X ', new.autor, new.reu));
  new.fase_atual := coalesce(nullif(btrim(new.fase_atual), ''), nullif(btrim(new.fase), ''), 'Solicitado para Ajuizamento');
  new.fase := coalesce(nullif(btrim(new.fase), ''), new.fase_atual, 'conhecimento');
  new.status_judicial := coalesce(nullif(btrim(new.status_judicial), ''), nullif(btrim(new.status), ''));
  new.status := coalesce(nullif(btrim(new.status), ''), new.status_judicial, 'ativo');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists processos_sincronizar_campos_legado on public.processos;
create trigger processos_sincronizar_campos_legado
before insert or update on public.processos
for each row execute function public.sincronizar_campos_processos_legado();

-- Relaciona eventual processo legado que já tenha o mesmo número importado.
update public.processos p
set processo_cliente_historico_id = pc.id,
    cliente_id = coalesce(p.cliente_id, pc.cliente_id)
from public.processos_clientes pc
where p.processo_cliente_historico_id is null
  and pc.numero_processo_normalizado is not null
  and regexp_replace(coalesce(p.numero_processo, p.numero, ''), '\s+', '', 'g') = pc.numero_processo_normalizado
  and not exists (
    select 1 from public.processos vinculado
    where vinculado.processo_cliente_historico_id = pc.id
  );

-- Disponibiliza a carteira histórica em todas as abas do módulo atual.
insert into public.processos (
  cliente_id, processo_cliente_historico_id, numero, numero_processo,
  cliente, nome_cliente, autor, reu, parte_contraria, banco_reu, autor_reu,
  data_distribuicao, tribunal, comarca, vara, status_judicial, fase_atual,
  situacao, fase_judicial, resultado, justica_gratuita, emenda_inicial,
  emenda_status, link_processo, link_consulta, observacoes, origem_registro
)
select
  pc.cliente_id,
  pc.id,
  pc.numero_processo,
  pc.numero_processo,
  c.nome_completo,
  c.nome_completo,
  c.nome_completo,
  pc.reu,
  pc.reu,
  pc.reu,
  concat_ws(' X ', c.nome_completo, pc.reu),
  pc.data_distribuicao,
  pc.tribunal,
  pc.comarca,
  pc.vara,
  pc.status_original,
  case
    when lower(pc.status_categoria) = 'arquivado' then 'Arquivado'
    else 'Tramitando'
  end,
  case when lower(pc.status_categoria) = 'arquivado' then 'Encerrado' else 'Em andamento' end,
  case when lower(pc.status_categoria) = 'arquivado' then 'Arquivado' else null end,
  case
    when lower(pc.status_categoria) = 'procedente' then 'Procedente'
    when lower(pc.status_categoria) = 'parcialmente_procedente' then 'Parcialmente procedente'
    when lower(pc.status_categoria) = 'improcedente' then 'Improcedente'
    else null
  end,
  pc.justica_gratuita,
  pc.emenda_inicial,
  pc.emenda_inicial,
  pc.link_processo,
  pc.link_processo,
  pc.observacoes,
  'importacao_processos_protocolados'
from public.processos_clientes pc
join public.clientes c on c.id = pc.cliente_id
where not exists (
  select 1 from public.processos p
  where p.processo_cliente_historico_id = pc.id
);

-- Reaplica somente a classificação derivada, inclusive nas reexecuções.
-- O texto jurídico original continua preservado integralmente em status_judicial.
update public.processos p
set fase_atual = case when lower(pc.status_categoria) = 'arquivado' then 'Arquivado' else 'Tramitando' end,
    situacao = case when lower(pc.status_categoria) = 'arquivado' then 'Encerrado' else 'Em andamento' end,
    fase_judicial = case when lower(pc.status_categoria) = 'arquivado' then 'Arquivado' else null end,
    resultado = case
      when lower(pc.status_categoria) = 'procedente' then 'Procedente'
      when lower(pc.status_categoria) = 'parcialmente_procedente' then 'Parcialmente procedente'
      when lower(pc.status_categoria) = 'improcedente' then 'Improcedente'
      else null
    end,
    status_judicial = pc.status_original
from public.processos_clientes pc
where p.processo_cliente_historico_id = pc.id;

create index if not exists processos_cliente_id_idx on public.processos (cliente_id, updated_at desc);
create index if not exists processos_numero_processo_idx on public.processos (numero_processo);
create index if not exists processos_busca_atual_idx on public.processos (nome_cliente, cpf_cliente, banco_reu);

-- HISTÓRICO, DOCUMENTOS E AUDITORIA -----------------------------------------

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id bigint not null references public.processos(id) on delete cascade,
  data_registro timestamptz not null default now(),
  descricao text not null,
  tipo text not null default 'andamento',
  categoria text default 'Movimentação processual',
  titulo text,
  descricao_tecnica text,
  resumo_cliente text,
  responsavel text,
  fonte text default 'Manual',
  link text,
  importancia text default 'Normal',
  anexo_url text,
  proxima_providencia text,
  proxima_revisao date,
  criar_tarefa_relacionada boolean default false,
  origem text default 'manual',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.processos_auditoria (
  id uuid primary key default gen_random_uuid(),
  processo_id text not null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  usuario text,
  created_at timestamptz not null default now()
);

create table if not exists public.processos_documentos (
  id uuid primary key default gen_random_uuid(),
  processo_id bigint not null references public.processos(id) on delete cascade,
  tipo_documento text not null,
  status text not null default 'Pendente',
  link_drive text,
  observacao text,
  armazenamento_oficial text not null default 'Drive',
  conferido_by uuid default auth.uid() references auth.users(id) on delete set null,
  conferido_em timestamptz,
  bucket text,
  arquivo_path text,
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
  uploaded_at timestamptz,
  unique (processo_id, tipo_documento)
);

create table if not exists public.feriados_processuais (
  id uuid primary key default gen_random_uuid(),
  data date not null unique,
  descricao text not null,
  abrangencia text not null default 'nacional',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.documentos_juridicos (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint references public.clientes(id) on delete set null,
  processo_id bigint references public.processos(id) on delete set null,
  nome_documento text not null,
  nome_arquivo text not null,
  modelo_id text not null,
  modelo_nome text not null,
  categoria text,
  tipo_documento text,
  cliente_nome text,
  cpf_cnpj text,
  numero_contrato text,
  numero_processo text,
  link_pasta_cliente text,
  responsavel_nome text not null,
  departamento text,
  destino text,
  versao integer not null default 1,
  status text default 'Gerado',
  assinado boolean not null default false,
  arquivo_principal_path text,
  arquivos_paths jsonb not null default '[]'::jsonb,
  armazenamento_oficial text not null default 'Drive',
  metadata jsonb not null default '{}'::jsonb,
  comunicado_em timestamptz,
  comunicado_canal text,
  comunicado_observacao text,
  substitui_documento_id uuid references public.documentos_juridicos(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_email text default lower(coalesce(auth.jwt()->>'email', '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modelos_juridicos_config (
  modelo_id text primary key,
  nome_exibicao text not null,
  atualizado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now()
);

-- OPERACIONAL ---------------------------------------------------------------

create table if not exists public.processual_tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint references public.clientes(id) on delete set null,
  processo_id bigint references public.processos(id) on delete set null,
  movimentacao_id uuid references public.movimentacoes(id) on delete set null,
  cliente_nome text,
  processo_numero text,
  titulo text not null,
  descricao text,
  tipo text not null default 'Tarefa interna',
  data date not null,
  horario time,
  responsavel text,
  prioridade text not null default 'Normal',
  status text not null default 'Pendente',
  lembrete text,
  observacao text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processual_atendimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint references public.clientes(id) on delete set null,
  processo_id bigint references public.processos(id) on delete set null,
  movimentacao_id uuid references public.movimentacoes(id) on delete set null,
  cliente_nome text not null,
  processo_numero text,
  data date not null,
  hora time,
  canal text not null default 'WhatsApp',
  tipo text,
  descricao text not null,
  responsavel text,
  anexo_url text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- GERENCIAL -----------------------------------------------------------------

create table if not exists public.processual_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint references public.clientes(id) on delete set null,
  processo_id bigint references public.processos(id) on delete set null,
  cliente_nome text,
  categoria text not null,
  data date not null default current_date,
  descricao text not null,
  responsabilidade text not null default 'Não identificado',
  impacto text,
  providencia text,
  prazo date,
  resolvido boolean not null default false,
  data_resolucao date,
  evidencia text,
  anexo_url text,
  responsavel text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processual_custas (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint references public.clientes(id) on delete set null,
  processo_id bigint references public.processos(id) on delete set null,
  cliente_nome text,
  tipo text not null,
  valor numeric(12,2) not null default 0,
  solicitacao date,
  vencimento date,
  status text not null default 'Pendente',
  pagamento date,
  comprovante_url text,
  responsavel text,
  observacao text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  deleted_at timestamptz,
  deleted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processual_etiquetas (
  id uuid primary key default gen_random_uuid(),
  entidade_tipo text not null,
  entidade_id text,
  etiqueta text not null,
  origem text not null default 'manual',
  ativa boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processual_auditoria_geral (
  id uuid primary key default gen_random_uuid(),
  usuario text,
  acao text not null,
  entidade text not null,
  entidade_id text,
  antes jsonb,
  depois jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Atualização automática de datas.
create or replace function public.atualizar_updated_at_workspace_processual()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'documentos_juridicos', 'processual_tarefas', 'processual_atendimentos',
    'processual_ocorrencias', 'processual_custas', 'processual_etiquetas'
  ] loop
    execute format('drop trigger if exists %I on public.%I', tabela || '_updated_at', tabela);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.atualizar_updated_at_workspace_processual()',
      tabela || '_updated_at', tabela
    );
  end loop;
end;
$$;

create index if not exists movimentacoes_processo_idx on public.movimentacoes (processo_id, data_registro desc);
create index if not exists processos_documentos_processo_idx on public.processos_documentos (processo_id);
create index if not exists documentos_juridicos_cliente_processo_idx on public.documentos_juridicos (cliente_id, processo_id, created_at desc);
create index if not exists processual_tarefas_agenda_idx on public.processual_tarefas (data, horario, status, prioridade);
create index if not exists processual_atendimentos_data_idx on public.processual_atendimentos (data desc, hora desc);
create index if not exists processual_ocorrencias_processo_idx on public.processual_ocorrencias (processo_id, data desc) where deleted_at is null;
create index if not exists processual_custas_status_idx on public.processual_custas (status, vencimento) where deleted_at is null;

-- Somente funcionários ativos da base interna podem acessar estes módulos.
do $$
declare
  tabela text;
  politica record;
begin
  foreach tabela in array array[
    'processos', 'movimentacoes', 'processos_documentos', 'processos_auditoria',
    'feriados_processuais', 'documentos_juridicos', 'processual_tarefas',
    'processual_atendimentos', 'processual_ocorrencias', 'processual_custas',
    'processual_etiquetas', 'processual_auditoria_geral'
  ] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('revoke all on public.%I from anon', tabela);
    execute format('revoke delete on public.%I from authenticated', tabela);
    execute format('grant select, insert, update on public.%I to authenticated', tabela);
    if tabela = 'processual_tarefas' then
      execute format('grant delete on public.%I to authenticated', tabela);
    end if;

    for politica in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = tabela
    loop
      execute format('drop policy %I on public.%I', politica.policyname, tabela);
    end loop;

    execute format(
      'create policy "Equipe interna consulta registros" on public.%I for select to authenticated using (public.funcionario_id_autenticado() is not null)',
      tabela
    );
    execute format(
      'create policy "Equipe interna cria registros" on public.%I for insert to authenticated with check (public.funcionario_id_autenticado() is not null)',
      tabela
    );
    execute format(
      'create policy "Equipe interna edita registros" on public.%I for update to authenticated using (public.funcionario_id_autenticado() is not null) with check (public.funcionario_id_autenticado() is not null)',
      tabela
    );
    if tabela = 'processual_tarefas' then
      execute format(
        'create policy "Equipe interna exclui tarefas" on public.%I for delete to authenticated using (public.funcionario_id_autenticado() is not null)',
        tabela
      );
    end if;
  end loop;
end;
$$;

alter table public.modelos_juridicos_config enable row level security;
revoke all on public.modelos_juridicos_config from anon;
revoke delete on public.modelos_juridicos_config from authenticated;
grant select on public.modelos_juridicos_config to authenticated;
grant insert, update on public.modelos_juridicos_config to authenticated;

do $$
declare
  politica record;
begin
  for politica in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'modelos_juridicos_config'
  loop
    execute format('drop policy %I on public.modelos_juridicos_config', politica.policyname);
  end loop;
end;
$$;

drop policy if exists "Equipe interna consulta modelos" on public.modelos_juridicos_config;
create policy "Equipe interna consulta modelos"
on public.modelos_juridicos_config for select to authenticated
using (public.funcionario_id_autenticado() is not null);

drop policy if exists "Gestor configura modelos" on public.modelos_juridicos_config;
create policy "Gestor configura modelos"
on public.modelos_juridicos_config for all to authenticated
using (public.usuario_e_admin())
with check (public.usuario_e_admin());

-- As duas tabelas legadas usam identidade bigint; o INSERT via API precisa da sequência.
do $$
declare
  sequencia text;
begin
  sequencia := pg_get_serial_sequence('public.clientes', 'id');
  if sequencia is not null then execute format('grant usage, select on sequence %s to authenticated', sequencia); end if;
  sequencia := pg_get_serial_sequence('public.processos', 'id');
  if sequencia is not null then execute format('grant usage, select on sequence %s to authenticated', sequencia); end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
