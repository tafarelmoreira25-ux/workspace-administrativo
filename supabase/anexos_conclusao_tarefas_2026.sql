-- ANEXOS DE IMAGEM NA CONCLUSAO DE TAREFAS
-- Execute este arquivo no Supabase SQL Editor uma unica vez.
-- Mantem documentos no Google Drive e guarda apenas imagens de comprovacao de ate 5 MB no Storage privado.

begin;

alter table public.tarefas
  add column if not exists imagem_comprovacao_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprovacoes-tarefas',
  'comprovacoes-tarefas',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

drop policy if exists "comprovacoes_tarefas_insert_autenticado" on storage.objects;
create policy "comprovacoes_tarefas_insert_autenticado"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'comprovacoes-tarefas'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "comprovacoes_tarefas_select_autenticado" on storage.objects;
create policy "comprovacoes_tarefas_select_autenticado"
on storage.objects for select to authenticated
using (bucket_id = 'comprovacoes-tarefas');

create or replace function public.registrar_anexo_imagem_tarefa(
  p_tarefa_id bigint,
  p_imagem_path text
)
returns public.tarefas
language plpgsql
security definer
set search_path = public
as $$
declare
  tarefa_atual public.tarefas;
  tarefa_atualizada public.tarefas;
  usuario_id bigint := public.funcionario_id_autenticado();
  usuario_auth uuid := auth.uid();
  caminho_normalizado text := trim(coalesce(p_imagem_path, ''));
begin
  if caminho_normalizado = '' then
    raise exception 'Informe o caminho da imagem de comprovacao.';
  end if;

  if usuario_auth is null or caminho_normalizado !~ ('^' || usuario_auth::text || '/' || p_tarefa_id::text || '/') then
    raise exception 'Imagem de comprovacao invalida para esta tarefa.';
  end if;

  select * into tarefa_atual
  from public.tarefas
  where id = p_tarefa_id
  for update;

  if tarefa_atual.id is null then
    raise exception 'Tarefa nao encontrada.';
  end if;

  if not public.usuario_e_admin() and tarefa_atual.funcionaria_id is distinct from usuario_id then
    raise exception 'Esta tarefa nao esta atribuida ao usuario autenticado.';
  end if;

  update public.tarefas
  set imagem_comprovacao_path = caminho_normalizado,
      updated_at = now(),
      versao = coalesce(versao, 0) + 1
  where id = tarefa_atual.id
  returning * into tarefa_atualizada;

  perform public.registrar_evento_tarefa(
    tarefa_atualizada.id,
    'anexo_imagem',
    tarefa_atual.status,
    tarefa_atualizada.status,
    'Imagem de comprovacao anexada na conclusao.',
    jsonb_build_object('imagem_comprovacao_path', caminho_normalizado)
  );

  return tarefa_atualizada;
end;
$$;

revoke all on function public.registrar_anexo_imagem_tarefa(bigint, text) from public;
grant execute on function public.registrar_anexo_imagem_tarefa(bigint, text) to authenticated;

notify pgrst, 'reload schema';

commit;
