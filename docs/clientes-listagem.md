# Listagem de Clientes

Antes de publicar o frontend, executar `supabase/20261004_clientes_listagem_enxuta.sql` no SQL Editor do projeto Supabase. O script é incremental, cria índices e a função `listar_clientes_resumo`, sem alterar cadastros. A função usa `SECURITY INVOKER` para respeitar as políticas RLS do usuário autenticado.

A listagem faz uma única chamada GET à RPC, com `p_busca`, `p_limit=30` e `p_offset`. O banco aplica filtros, ordenação estável por nome/ID e `LIMIT/OFFSET`. Retorna `{ clientes: [{ id, nome_completo, id_crm, esferas }], total }`, inclusive o total quando a página fica vazia. CPF participa da busca no banco e não é retornado. A busca por número de processo usa `EXISTS`, sem o antigo limite intermediário de 500 vínculos.

As esferas são calculadas apenas para os clientes da página, usando os processos vinculados pelo `cliente_id` e a regra de `processWorkflow.ts`. Clientes com ambas as esferas recebem duas tags; clientes sem processos recebem “Sem processo vinculado”. Registros encaminhados ao protocolo pertencem à esfera judicial.

Ao abrir a pasta, o frontend consulta o cadastro completo por ID. Depois carrega os processos, documentos, atendimentos e histórico somente desse cliente, com o limite existente de 60 registros por coleção. A edição permanece dentro da pasta. Fechar ou abrir outra pasta invalida respostas anteriores.

Validação em ambiente conectado: conferir a RPC na aba Network, confirmar que a lista tem no máximo 30 registros e só os quatro campos previstos, navegar pelas páginas, buscar por CPF/número de processo e abrir uma pasta. Medir tempo de resposta e usar `EXPLAIN (ANALYZE, BUFFERS)` na consulta SQL com o volume real. O tempo final depende do banco, das políticas RLS e da rede; não há garantia de milissegundos sem medição.
