-- Preparada para aplicacao manual. Esta migration nao altera dados nem tabelas.
-- Leitura de homologacoes fica disponivel a qualquer usuario autenticado do sistema.
-- Escritas continuam sujeitas a workspace_usuario_ativo(); anon continua sem acesso.

begin;

do $$
begin
  if to_regclass('public.clientes_homologacoes') is not null then
    execute 'drop policy if exists "Workspace ativo consulta homologacoes" on public.clientes_homologacoes';
    execute 'drop policy if exists "Equipe autenticada consulta homologacoes" on public.clientes_homologacoes';
    execute $policy$
      create policy "Equipe autenticada consulta homologacoes"
      on public.clientes_homologacoes
      for select
      to authenticated
      using (auth.uid() is not null)
    $policy$;
  end if;
end
$$;

revoke all on public.clientes_homologacoes from anon;

commit;
