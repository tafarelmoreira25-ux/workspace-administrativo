-- Etapa 7 — Tarefas, Agenda, Prazos e Atendimentos
-- Migration segura e aditiva. Não remove dados nem altera tabelas antigas.

begin;

create extension if not exists pgcrypto;

create table if not exists public.processual_tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid null,
  processo_id uuid null references public.processos(id) on delete set null,
  movimentacao_id uuid null references public.movimentacoes(id) on delete set null,
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
  cliente_id uuid null,
  processo_id uuid null references public.processos(id) on delete set null,
  movimentacao_id uuid null references public.movimentacoes(id) on delete set null,
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

alter table public.processual_tarefas drop constraint if exists processual_tarefas_tipo_check;
alter table public.processual_tarefas add constraint processual_tarefas_tipo_check check (
  tipo in (
    'Contato cliente',
    'Revisar processo',
    'Verificar protocolo',
    'Cobrar assinatura',
    'Solicitar documento',
    'Custas',
    'Reunião',
    'Audiência',
    'Prazo processual',
    'Tarefa interna',
    'Outro'
  )
);

alter table public.processual_tarefas drop constraint if exists processual_tarefas_prioridade_check;
alter table public.processual_tarefas add constraint processual_tarefas_prioridade_check check (
  prioridade in ('Baixa', 'Normal', 'Alta', 'Crítica')
);

alter table public.processual_tarefas drop constraint if exists processual_tarefas_status_check;
alter table public.processual_tarefas add constraint processual_tarefas_status_check check (
  status in ('Pendente', 'Em andamento', 'Concluída', 'Cancelada', 'Atrasada')
);

alter table public.processual_atendimentos drop constraint if exists processual_atendimentos_canal_check;
alter table public.processual_atendimentos add constraint processual_atendimentos_canal_check check (
  canal in ('WhatsApp', 'Telefone', 'E-mail', 'Reunião', 'Presencial', 'Outro')
);

create or replace function public.atualizar_updated_at_processual_operacional()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists processual_tarefas_updated_at on public.processual_tarefas;
create trigger processual_tarefas_updated_at
before update on public.processual_tarefas
for each row execute function public.atualizar_updated_at_processual_operacional();

drop trigger if exists processual_atendimentos_updated_at on public.processual_atendimentos;
create trigger processual_atendimentos_updated_at
before update on public.processual_atendimentos
for each row execute function public.atualizar_updated_at_processual_operacional();

create index if not exists processual_tarefas_agenda_idx
  on public.processual_tarefas (data, horario, status, prioridade);

create index if not exists processual_tarefas_processo_idx
  on public.processual_tarefas (processo_id, data desc);

create index if not exists processual_atendimentos_data_idx
  on public.processual_atendimentos (data desc, hora desc);

create index if not exists processual_atendimentos_processo_idx
  on public.processual_atendimentos (processo_id, data desc);

alter table public.processual_tarefas enable row level security;
alter table public.processual_atendimentos enable row level security;

revoke all on public.processual_tarefas from anon;
revoke all on public.processual_atendimentos from anon;

grant select, insert, update, delete on public.processual_tarefas to authenticated;
grant select, insert, update, delete on public.processual_atendimentos to authenticated;

drop policy if exists "Equipe gerencia tarefas processuais" on public.processual_tarefas;
create policy "Equipe gerencia tarefas processuais"
on public.processual_tarefas for all to authenticated
using (true)
with check (true);

drop policy if exists "Equipe gerencia atendimentos processuais" on public.processual_atendimentos;
create policy "Equipe gerencia atendimentos processuais"
on public.processual_atendimentos for all to authenticated
using (true)
with check (true);

commit;
