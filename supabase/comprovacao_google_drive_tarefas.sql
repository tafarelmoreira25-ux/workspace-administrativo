-- COMPROVACAO DE TAREFAS VIA GOOGLE DRIVE
-- Execute uma vez no SQL Editor, depois de pop_esteira_tratativas_2026.sql
-- e motor_operacional_tarefas_2026.sql.

begin;

alter table public.tarefas
  add column if not exists drive_document_url text;

-- Preserva as comprovações já registradas no campo legado.
update public.tarefas
set drive_document_url = evidencia_url
where nullif(trim(coalesce(drive_document_url, '')), '') is null
  and nullif(trim(coalesce(evidencia_url, '')), '') is not null;

create or replace function public.sincronizar_comprovacao_drive_tarefa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.drive_document_url, '')), '') is not null then
    new.drive_document_url = trim(new.drive_document_url);
    new.evidencia_url = new.drive_document_url;
  elsif nullif(trim(coalesce(new.evidencia_url, '')), '') is not null then
    new.evidencia_url = trim(new.evidencia_url);
    new.drive_document_url = new.evidencia_url;
  end if;
  return new;
end;
$$;

drop trigger if exists sincronizar_comprovacao_drive_tarefa on public.tarefas;
create trigger sincronizar_comprovacao_drive_tarefa
before insert or update of evidencia_url, drive_document_url on public.tarefas
for each row execute function public.sincronizar_comprovacao_drive_tarefa();

comment on column public.tarefas.drive_document_url is
'Link do arquivo ou da pasta de comprovação no Google Drive. Substitui upload local.';

notify pgrst, 'reload schema';

commit;
