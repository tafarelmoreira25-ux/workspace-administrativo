-- Remove somente os gatilhos redundantes criados pela migration anterior.
-- Os gatilhos legados ativos continuam responsáveis pela compatibilidade.
begin;

drop trigger if exists clientes_workspace_sync on public.clientes;
drop trigger if exists processos_workspace_sync on public.processos;
drop function if exists public.sincronizar_cliente_workspace();
drop function if exists public.sincronizar_processo_workspace();

notify pgrst, 'reload schema';
commit;
