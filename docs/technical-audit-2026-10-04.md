# Auditoria técnica — 4 de outubro de 2026

## Resultado e limites

Limpeza incremental aplicada, com lint, 84 testes e build aprovados. Nenhum arquivo inteiro ou dependência foi excluído por esta auditoria. Foram removidos 86 linhas de uma implementação de checklist sem consumidores, corrigidos recursos globais de desenvolvimento, canceladas consultas de busca obsoletas e separado o treinamento do carregamento inicial. Um erro preexistente no relatório de importação foi corrigido.

Não houve alterações em banco de dados, migrations, permissões, cálculos de prazo, conteúdo jurídico, modelos DOCX/PDF ou CSS. Nenhuma importação real foi executada. Testes automatizados e build não comprovam o funcionamento dos fluxos autenticados em produção nem a equivalência visual dos documentos.

## A — Proteção e linha de base

- Workspace externo: `C:/Users/User/Documents/Tafarel/tafa-performance`.
- Raiz real da aplicação e do Git: `C:/Users/User/Documents/Tafarel/tafa-performance/tafa-performance`.
- Branch: `main`. HEAD inicial: `03e2814` (`AT41.1`). Durante a execução, passou externamente a `6c97d44` (`At41.2`). Esta auditoria não fez commit.
- Gerenciador: npm; lock correto: `tafa-performance/package-lock.json`. O lock externo tem `packages: {}` e não corresponde à aplicação; foi preservado.
- Node observado: 24.16.0; npm: 11.13.0. `npm ls --depth=0` não reportou dependências inválidas ou ausentes.
- Ferramentas: Vite 8.0.16 instalado, plugin React, ESLint. Deploy configurado para Vercel, incluindo manifesto de versão e tratamento de chunks de deploy antigos.
- Entrada: `index.html` → `src/main.jsx` → `src/App.jsx`. Não há roteador separado; o workspace usa identificadores de abas, `React.lazy`, `Suspense` e `Activity` para preservar telas visitadas.
- Comandos: `dev`, `start`, `lint`, `test`, `build`, `check`, `preview`, `import:processos`, `import:processos:dry-run`. Não há comando de typecheck, `tsconfig.json` ou TypeScript instalado.

Já havia alterações em AGENTS, package.json, README, documentação e gerador DOCX/PDF, fontes não rastreadas e exclusões de geradores antigos. Tudo foi preservado. As exclusões desses geradores não são resultado desta auditoria.

Backups locais, não versionados, criados antes das alterações desta auditoria:

- `.tmp/audit-backup-1791109514357.zip`: estado da inspeção inicial, incluindo os geradores que existiam naquele momento.
- `.tmp/audit-resumed-backup-1791110238333.zip`: estado ao retomar, com código, modelos, recursos, dados e configurações. Exclui `.env`, logs, Git, node_modules, dist, .tmp e .tools; não constitui backup do banco ou do ambiente inteiro.
- `.tmp/audit-resumed-git-status.txt` e `.tmp/audit-resumed-git-diff.patch`: estado e diff anteriores às alterações desta auditoria.

Linha de base renovada: lint aprovado; 79 testes aprovados, zero falhas; build aprovado em 4,03 s informados pelo Vite. Avisos: import dinâmico ineficaz em documentPdf e chunk de PDF acima de 500 kB. Testes levaram aproximadamente 27,47 s nesta execução; o primeiro levantamento levou 51,01 s, demonstrando variabilidade do ambiente.

## Inventário, referências e funcionalidades

O arquivo `technical-audit-inventory.json` contém a estrutura de arquivos de manutenção, classificações, recursos públicos, grafo local e evidências de CSS. Dependências instaladas, Git, dist e .tmp são resumidos, sem incluir seus milhares de arquivos gerados no grafo de aplicação.

Foi feita análise sintática de JS, JSX, TS, TSX e MJS com o parser já instalado, incluindo imports estáticos, imports dinâmicos literais, reexports e referências de CSS. Foram examinados os pontos de entrada da aplicação, testes, scripts CLI, configurações e Edge Functions. A análise não encontrou imports locais quebrados ou ciclos. Não encontrou `import.meta.glob` ou imports dinâmicos por nome na aplicação. O import não literal de FormControls.test.mjs é uma URL de dados construída a partir do componente transformado e foi conferido.

Nenhum módulo de aplicação foi classificado para exclusão integral. `processReview.ts` não é alcançado pela entrada do navegador, mas é consumido por `processReview.test.ts`: preservar. O nome do teste menciona Dashboard/Alertas, mas o teste compara a função isolada; não prova que esses componentes usem essa regra.

Foram confirmados no código:

| Funcionalidade | Implementação e dependências preservadas |
| --- | --- |
| Login, recuperação e permissões | App.jsx, userAccess.js, supabase.js; inscrição de autenticação com unsubscribe |
| Área de trabalho e indicadores | DashboardModule, GerencialProcessualModule, cálculos da esteira |
| Clientes e carteira | ClientesModule, CarteiraProcessual, processDataSync, histórico administrativo |
| Extrajudiciais, protocolos, processos | CarteiraProcessual, EsteiraProcessualPlatino, EsteiraKanban, PainelJudicial, processWorkflow |
| Agenda e atividades | OperacionalProcessualModule, tarefas e atendimentos |
| Homologação e quitação | HomologacaoQuitacaoModule e migrations específicas |
| Gerador jurídico | GeradorDocumentos, documentTemplates, documentWorkspace, wordTemplateDocx, wordModelLocalPdf, modelos e fontes |
| Treinamento | TreinamentosOperacionais, trainingResources, links externos preservados |
| Comunicação e análise | EmailComposer, ContentAnalyzer, emailWorkspace, assistente-juridico |
| Integrações | Edge Functions DataJud e Escavador, Supabase e migrations |
| Importação histórica | scripts Node/PowerShell, JSON fonte, SQL e checkpoints de .tmp |

Os scripts de administração e migrations podem executar fora do navegador: não foram descartados por ausência de imports. Recursos públicos foram comparados com caminhos literais, index.html, CSS, configuração e documentação; os resultados sem referência direta continuam preservados por poderem ser acessados por URL ou usados no trabalho de modelos. Não foram visitados links de treinamento nem feitas consultas externas de produção.

## B — Classificação e diagnóstico

| Item | Classificação | Evidência e decisão |
| --- | --- | --- |
| CHECKLIST_ELITE, tipos associados e três funções em esteiraProcessual.ts | Seguro para remover | Referências exclusivamente dentro do próprio bloco; nenhum consumidor em componentes, scripts, testes ou documentação; não havia glob/import por nome. Removido apenas esse bloco e seu import de Supabase. |
| Import dinâmico de documentPdf no gerador | Precisa de correção | O mesmo módulo já era importado estaticamente. Unificado no import estático; bibliotecas pesadas continuam dinâmicas dentro de gerarPdfModelo. |
| TreinamentosOperacionais carregado estaticamente | Precisa de correção | Código e CSS eram carregados no login; aba só é utilizada após navegação. Agora lazy + Suspense. |
| GlobalSearch | Precisa de correção | A flag `ativo` evitava atualizar estado antigo, mas não cancelava quatro consultas em andamento. Adicionado AbortController e reinicialização de carregamento para termo curto. |
| Recursos globais de main.jsx | Precisa de correção | Listener de visibilidade anônimo e interval sem descarte do módulo. Adicionado dispose de HMR para três listeners, interval e avisos pendentes. |
| scripts/*.mjs | Precisa de correção | ESLint não os incluía. Cobertura adicionada com globals de Node; revelou ReferenceError no retorno de samples. Corrigido e testado. |
| App.css | Precisa de refatoração | 118.494 bytes, 3.447 linhas na inspeção inicial; estilos e overrides acumulados. A análise de CSS encontrou 24 candidatos a regras idênticas no conjunto de folhas. Nenhuma regra removida: a posição na cascata pode determinar o resultado. |
| documentWorkspace.css | Precisa de refatoração | 37.537 bytes em 73 linhas; linha máxima de 5.285 caracteres. Preservado; reformatar ou modularizar exige revisão semântica/visual e não foi necessário para as correções atuais. |
| PainelJudicial, ClientesModule, CarteiraProcessual, HomologacaoQuitacao | Precisa de refatoração | Componentes extensos misturam carregamento, ações, formulários e apresentação. Divisão futura por responsabilidade, sem movimentação ampla nesta auditoria. |
| Consultas gerenciais | Investigar | Dashboard limita processos a 2.000; gerencial carrega seis fontes com limites de 800/1.200; homologação e opções usam limites de 500. Volume e truncamento devem ser medidos no banco antes de alterar regras/contadores. |
| Busca em carteira e protocolos | Preservar | Já têm debounce, range no servidor e paginação; não foram substituídos por carregamento integral. Ainda há risco de respostas fora de ordem em outros carregadores. |
| Activity e telas visitadas | Preservar | Preserva estado/rascunhos. Retenção de DOM e estado pode aumentar memória conforme se visitam módulos; desmontar telas mudaria o comportamento e não foi aplicado. |
| processReview.ts | Preservar / investigar integração | Consumido por teste; presença fora do bundle não prova abandono. |
| Tipos TS e exports sem consumidor externo | Preservar | Vários são referenciados internamente ou por posições de tipo. Candidatos sintáticos não foram tratados automaticamente como código morto. |
| Recuperação de senha no Login | Investigar | solicitarRecuperacao aparece apenas na definição e em `void solicitarRecuperacao`; não há botão conectado. Não removida por fazer parte de autenticação. |
| DOCX, PDFs, fontes, imagens, modelos-originais | Preservar | Documentos jurídicos, fontes oficiais e referências históricas; acesso por URL e fluxo externo possível. |
| .tools | Preservar | Aproximadamente 92,8 MB, inclusive Node portátil versionado. Pode atender execução fora do npm; excluído da observação/busca, sem remoção do histórico ou dos arquivos. |
| .tmp | Preservar | Contém caches e artefatos, mas também checkpoints e relatórios de importação; excluir em massa poderia perder evidências operacionais. Agora também contém backups da auditoria. |
| lock externo e .git externo | Investigar | Não pertencem à raiz Git válida da aplicação; preservados. |

Não se constatou biblioteca declarada sem uso: React/React DOM, Supabase, fflate, pdf-lib e fontkit são ativos; Vite, plugins e ESLint são ferramentas; xmldom é usado nos testes; @types/react e @types/react-dom fornecem tipagens. Nenhum package-lock foi alterado.

## Diagnóstico separado de desempenho

### Aplicação

Há oportunidades comprovadas no carregamento inicial e em trabalho assíncrono obsoleto, corrigidas nesta auditoria. O maior chunk, wordModelLocalPdf, permanece em cerca de 1,145 MB minificado e 510,62 kB gzip: contém PDF/fontkit e já é carregado sob demanda. Dividir artificialmente o bundle não reduz necessariamente o trabalho de conversão. Não foi alterado o conversor que preserva o original.

Unzip/ZIP e processamento XML/fontes são feitos no navegador e podem ocupar a thread principal. Um worker pode ser estudado, mas exige separar o uso de DOMParser/XMLSerializer e verificar geração e formatação. Não há perfil do navegador para quantificar esse bloqueio nesta auditoria.

Consultas de vários módulos carregam centenas ou milhares de linhas. Filtros principais já usam useMemo, e busca de listas principais já usa debounce/paginação. Não foi adicionada memoização indiscriminada. Modelos/fontes são buscados novamente em algumas gerações; cache exigiria política de invalidação e validação dos documentos, portanto foi preservado.

Há timers de timeout em importação de clientes que não são cancelados em todos os caminhos, e outros carregadores não possuem abort/controle de ordem. Registrados para evolução; o cancelamento aplicado nesta etapa cobre a busca global. O toast de App também usa timeout sem coordenação entre avisos. Não há evidência de que isso explique toda a lentidão.

### Ambiente

Na inspeção inicial, node_modules tinha 6.484 arquivos (~121,4 MB); dist, 87 arquivos (~37,2 MB); .tmp, 845 arquivos (~179,5 MB); .tools, 16 arquivos (~92,8 MB). Valores em bytes decimais e antes de acumular backups posteriores.

Foram configuradas exclusões específicas de busca e observação para node_modules, dist, .tmp e .tools, além de logs na busca. O Explorer continua exibindo arquivos; fonte, templates, dados e migrations não foram excluídos. A configuração foi aplicada na pasta externa aberta e na raiz interna, mantendo `liveServer.settings.port: 5501` externo. ESLint também deixa de analisar .tmp, .tools e tmp gerados e passa a verificar scripts MJS.

Em um retrato posterior, 16 processos Code somavam aproximadamente 2.541 MiB de working set; três processos Codex, 288 MiB; três Node, 144 MiB. Working sets podem compartilhar páginas e não são uma medida exata de memória física exclusiva. Não houve medição de CPU em intervalo, associação de PID a extensão ou encerramento de processos. A inspeção de detalhes por CIM não estava autorizada no ambiente. Não é possível afirmar qual extensão ou processo causa lentidão com esses dados.

## C/D — Alterações executadas e risco

| Arquivo | Alteração desta auditoria | Risco / verificação |
| --- | --- | --- |
| src/App.jsx | Treinamento lazy e Suspense | Baixo; build e grafo; validar abertura da aba em navegador |
| src/GeradorDocumentos.jsx | Import estático de gerarPdfModelo; removido import dinâmico redundante | Baixo; build sem aviso de import ineficaz; bibliotecas PDF permanecem dinâmicas |
| src/components/gerencial/GlobalSearch.tsx | Abort das quatro consultas e reset do carregamento | Baixo; testes de término, respostas antigas e falha parcial |
| src/main.jsx | Descarte de listeners, interval e avisos no HMR | Baixo; teste de descarte e reexecução sem duplicação |
| src/lib/esteiraProcessual.ts | Removido bloco isolado de checklist e import de Supabase | Baixo; grafo sem consumidores; comparação com backup confirmou cálculos intactos |
| scripts/import-processos-protocolados.mjs | Corrigida propriedade incompleto e exportada seleção de amostras para teste | Correção necessária; teste de relatório sem banco |
| scripts/import-processos-protocolados.test.mjs | Regressão de relatório com incompleto, duplicidade e múltiplos processos | Teste local |
| scripts/runtime-lifecycle.test.mjs (novo) | Quatro testes focados em HMR e busca | Mock de ambiente/hooks e consultas; não substitui teste React no navegador |
| eslint.config.js | Ignore de artefatos e lint de scripts MJS | Lint completo aprovado; TS/TSX permanecem fora do lint atual |
| package.json | Incluído teste de ciclo de vida em npm test | Preservada lista preexistente; nenhum lock/dependência alterado |
| .gitignore | Permite versionar .vscode/settings.json | Não oculta código nem exclui arquivos |
| .vscode/settings.json (novo, raiz interna) | Exclusões de busca e observação | Configuração de desenvolvimento; verificar efeito após reabrir VS Code |
| ../.vscode/settings.json | Mesmas exclusões na pasta externa aberta | Preservada configuração de Live Server; fora do Git interno |
| docs/technical-audit-2026-10-04.md (novo) | Relatório | Documentação |
| docs/technical-audit-inventory.json (novo) | Inventário, grafo e classificação | Documentação, sem segredos ou conteúdo de .env |

Arquivos inteiros removidos nesta auditoria: **nenhum**. Dependências removidas: **nenhuma**. O bloco removido continha `CHECKLIST_ELITE`, `ChecklistEliteId`, `RegistroChecklistElite`, `ArquivosChecklistElite`, `RegistrosChecklistElite`, `checklistEliteCompleto`, `registrarChecklistEliteDrive` e `enviarChecklistElite`. Os tipos gerais do processo, campos persistidos de checklist e cálculos ativos foram mantidos.

Alterações externas observadas enquanto a auditoria rodava: remoções de textos/cabeçalhos em App, CarteiraProcessual, ClientesModule, DashboardModule, EsteiraKanban e HomologacaoQuitacaoModule, além do commit de trabalho preexistente. Não foram feitas ou revertidas por esta auditoria. O diff final contém trabalho compartilhado; não usar sua totalidade como descrição exclusiva desta limpeza.

## E — Validação e medidas

| Verificação | Antes da limpeza retomada | Depois |
| --- | --- | --- |
| npm run lint | Passou, com MJS não coberto | Passou, incluindo scripts MJS |
| npm test | 79 passaram, zero falhas | 84 passaram, zero falhas |
| npm run build | Passou; dois tipos de aviso | Passou; permanece apenas aviso de chunk grande |
| npm run check | Etapas iniciais executadas separadamente | Executado integralmente; exit 0 |
| npm run import:processos:dry-run | Não necessário à medição inicial | Exit 0, nenhuma escrita |
| Referências locais e ciclos | Nenhuma falha/ciclo no grafo | Rechecado após a limpeza |
| Cálculos de prazo | Implementação do backup | Comparação textual confirmou bloco inalterado |
| git diff --check | — | Sem erros de whitespace; avisos LF/CRLF do Git |
| Typecheck | Não configurado | Não executado; build remove tipos, não os verifica |
| Navegador autenticado, integrações e PDF visual | Não executados | Pendentes de validação manual |

O dry-run encontrou 319 linhas de fonte: 317 válidas, duas inválidas, 313 processos únicos esperados e quatro duplicidades consolidadas. Dados inválidos não foram corrigidos ou apagados por esta auditoria. O teste novo verifica o retorno de amostras do relatório; não simula a transação real completa da importação.

Comparação de assets antes e após as próprias alterações, na primeira build de limpeza, antes das mudanças externas de apresentação:

| Asset inicial | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| JavaScript index | 427.034 bytes | 418.595 bytes | 8.439 bytes (1,98%) |
| CSS index | 103.184 bytes | 98.708 bytes | 4.476 bytes (4,34%) |

Treinamento passou a ter chunk JS de 8.922 bytes e CSS de 4.477 bytes, carregados ao abrir a aba. Isso reduz transferência inicial; não representa remoção equivalente do total de funcionalidades/bundle. A build conjunta posterior informou index JS de aproximadamente 418,50 kB; essa diferença adicional inclui edições externas.

Vite informou 4,03 s na linha de base renovada, 1,35 s na primeira build de limpeza e 1,16 s na build conjunta final. São execuções únicas com aquecimento de caches e carga variável; não permitem atribuir aceleração nessa proporção às mudanças. Não foram medidos FPS, tempo de resposta do banco, consumo exclusivo de memória, tempo de conversão PDF ou abertura do VS Code.

Evidências locais: `.tmp/audit-resumed-{lint,test,build}.log`, `.tmp/audit-final-check.log`, `.tmp/audit-import-dry-run.log`, `.tmp/audit-graph.json`, `.tmp/audit-css.json`, `.tmp/audit-resumed-baseline-assets.json` e `.tmp/audit-final-assets.json`. O scanner usou ferramentas já instaladas e fica em `.tmp/audit-scan.cjs`; não adiciona dependência ao projeto.

## Pendências, validação manual e manutenção

1. Conferir login, recuperação e permissões com perfis reais; não remover recuperação de senha apenas por estar desconectada no formulário atual.
2. Abrir todas as abas, especialmente Treinamentos, Documentos, Carteira, Protocolos, Homologação e Agenda; verificar preservação de estado ao alternar.
3. Buscar, apagar o termo e navegar enquanto consultas estão pendentes; conferir resultados e ausência de spinner preso.
4. Exercitar HMR e deploy com chunks antigos; confirmar que avisos não se duplicam e que rascunhos continuam protegidos.
5. Comparar visualmente DOCX/PDF com originais pelos critérios de AGENTS.md. Bloqueios preexistentes de modelo pendente, fontes ou `validacaoVisualPdf` permanecem; esta auditoria não os removeu.
6. Validar integrações DataJud, Escavador, Gemini e operações de Supabase no ambiente adequado. Não foram acessadas nesta manutenção local.
7. Medir planos/latências de consultas e totais reais antes de ajustar limites, índices ou contadores. Evitar trocar limites por contagens supostamente equivalentes.
8. Estudar extração de responsabilidades dos componentes maiores em alterações pequenas, com testes de fluxo; consolidar CSS apenas com provas de cascata e comparação visual.
9. Configurar typecheck e lint de TS/TSX em trabalho próprio; o lint atual não garante tipos ou hooks nesses arquivos. O parser e o build só garantem análise/transpilação sintática.
10. Usar `npm run check` antes de revisão/deploy; preservar a cobertura de scripts MJS que detectou a falha de relatório.
11. Revisar periodicamente uso de dependências e caminhos de assets incluindo scripts, testes, public e referências por strings; remover apenas com evidência documentada.
12. Estabelecer retenção para logs, PDFs de teste, backups e caches, mantendo checkpoints/relatórios de importação. Não apagar .tmp indiscriminadamente.
13. Investigar processos/extensões do VS Code com medição em intervalo e profiler apropriado; reabrir o workspace para conferir as exclusões. Esta auditoria não mudou configuração global de extensões nem encerrou processos.
14. Manter Node portátil, templates, SQL e documentos históricos até confirmar seu ciclo de uso externo. O custo de armazenamento não prova abandono.

Riscos restantes: falta de teste de integração no navegador/banco, ausência de typecheck, truncamento potencial de consultas, conversão PDF na thread principal, retenção de estado de telas visitadas, CSS acumulado e mudanças simultâneas no workspace. Nenhum desses riscos autoriza exclusão por suposição.
