# Homologação e Quitação

A listagem usa cards responsivos em toda a largura do conteúdo. A consulta inicial
seleciona somente ID, cliente, banco, contrato, status e datas do acompanhamento,
sem auditoria, histórico ou arquivos. Clientes e processos para o cadastro de uma
nova homologação são carregados somente ao abrir esse formulário.

Ao abrir um cliente, o drawer busca a ficha completa e as coleções pelo ID da
homologação. Ele mostra carregamento, erro com nova tentativa e ignora respostas
de fichas fechadas ou substituídas. A primeira aba é o histórico. As demais abas
existentes continuam disponíveis. Os diálogos nativos controlam foco, tecla Esc
e interação com a página atrás do painel.

## Banco de dados

Aplicar `supabase/20261004_homologacao_tratativas.sql` após as migrations existentes
de Homologação e Quitação. Ela é aditiva e preserva registros históricos. Não foi
executada automaticamente em nenhum ambiente remoto.

A tratativa usa `homologacao_movimentacoes` com tipo legado `Diligência` e campos
adicionais para tipo de contato, dívida original, oferta, desconto e anexos.
O banco valida os valores, calcula o desconto e prevê o retorno em 15 dias,
considerando a data da diligência em America/Sao_Paulo. Ofertas maiores que a dívida
original produzem um desconto negativo. O resumo da ficha é atualizado na mesma
transação; registros retroativos preservam a tratativa mais recente.

O formulário exige ao menos um anexo e aceita PDF, PNG, JPEG e WebP de até 10 MB por arquivo.
O bucket `homologacao-anexos` é privado e os caminhos usam o ID da homologação.
As políticas exigem usuário autenticado com acesso à ficha. Uma URL temporária
de 60 segundos é criada somente ao clicar no anexo. Se a inserção falhar, o
formulário tenta remover os arquivos enviados e preserva os campos para nova
tentativa. O upload e a inserção não formam uma transação única: uma interrupção
de rede ou fechamento do aplicativo durante o envio pode deixar arquivos sem
registro associado.

## Validação

`npm test` inclui testes de consulta inicial, abertura do histórico, respostas
atrasadas, erro da ficha e gravação/limpeza de anexos. Os testes do módulo usam
API simulada; a migration e o upload devem ser conferidos no ambiente Supabase
de destino após sua aplicação.
