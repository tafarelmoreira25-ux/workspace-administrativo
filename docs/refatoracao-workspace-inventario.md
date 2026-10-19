# Refatoração do workspace jurídico

## Ponto de restauração

- Branch de trabalho: `refactor/sistema-juridico-minimalista` (base `504a67c`).
- Tag de restauração: `restorepoint/pre-refactor-504a67c`.
- Alterações que já estavam no working tree antes desta tarefa: `.git/refactor-working-tree.patch`.

## Inventário anterior às alterações

- Dependências de produção: React 19, React DOM 19, `@supabase/supabase-js` e `pdf-lib`.
- Build e ferramenta: Vite 8 e plugin React. Não há roteador dedicado; a navegação era feita por estado em `src/App.jsx`.
- Entradas carregadas sob demanda: clientes, carteira processual, esteira, agenda operacional, gerencial, busca global, dashboard, homologação e gerador. Treinamentos eram importados diretamente.
- Autenticação: Supabase Auth; perfil consultado em `funcionarios` por e-mail e estado `ativo`. O cliente frontend usa somente `VITE_SUPABASE_ANON_KEY`.
- RLS e autorização: as migrações legadas incluem políticas autenticadas amplas, políticas por equipe e políticas próprias para equipe/feedback/planner. Algumas políticas legadas permitem `using (true)`. A nova migração remove as políticas conhecidas mais amplas de clientes e histórico e instala regras para usuário cadastrado e ativo; anon não recebe acesso.
- RPCs SECURITY DEFINER encontrados: `usuario_e_admin`, `funcionario_id_autenticado`, `feedback_pertence_ao_usuario`, rotinas de importação/listagem/salvamento de processos protocolados e rotinas de geração de histórico extrajudicial. Nenhuma nova RPC é necessária para o fluxo principal.
- Tabelas presentes nas migrações: `funcionarios`, `clientes`, `clientes_historico`, `processos`, `movimentacoes`, `processos_documentos`, `homologacoes` e tabelas auxiliares de homologação, documentos/modelos, auditoria, agenda/tarefas, feedback/planner, protocolos e importações. As migrações legadas também definem tabelas de integração DataJud/Escavador.
- Triggers encontrados: atualização de `updated_at`, sincronização de campos legados de cliente/processo, classificação/proteção de movimentações, criação de histórico extrajudicial, protocolo extrajudicial e auditoria de homologação/documentos.
- Risco observado no inventário: há modelos de dados duplicados entre `clientes`/`processos`/`homologacoes`; por isso a migração nova mantém as tabelas antigas e registra pendências por CPF, sem reconciliar por nome nem atualizar fichas que poderiam acionar triggers legados.

## Fluxo novo

`clientes.id` permanece a identidade canônica. Campos operacionais foram adicionados ao cadastro e `clientes_historico` recebe movimentos com etapa. Homologações leves ficam em `clientes_homologacoes`. A tela Processual filtra o mesmo cadastro pelo número judicial. Os menus de gestão antigos foram retirados do ponto de entrada da aplicação.

## Limites de validação deste ambiente

As dependências estão presentes, mas `node`/`npm` não estão disponíveis no PATH do ambiente. Portanto não foi possível executar lint, testes, build ou obter métricas comparáveis de bundle. A migração ainda precisa ser aplicada em uma base de homologação e validada com uma conta ativa e uma conta inativa antes de qualquer publicação.
