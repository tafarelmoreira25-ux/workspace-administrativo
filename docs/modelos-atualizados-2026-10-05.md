# Modelos recebidos — 05/10/2026

## Resultado

O lote inicial tinha 35 arquivos. Na importação, a pasta tinha 34: o arquivo LIMINAR LAUDO não estava mais presente e não foi importado. Foram adicionados nove modelos novos e atualizadas doze entradas existentes. Doze arquivos binariamente idênticos foram pulados, assim como a segunda cópia de finalização/conciliação cuja equivalência estrutural e visual foi confirmada.

As seis categorias recebidas são usadas no gerador. Os modelos antigos que não fazem parte deste lote foram mantidos nas suas categorias. A geração conjunta da procuração com hipossuficiência e IRPF permanece disponível; procuração e IRPF agora usam as datas e os exercícios de seus originais atuais.

## Preservação e geração

Os originais do lote atual foram arquivados integralmente em `modelos-originais/atualizados-2026-10-05/`, mantendo categorias e nomes. As cópias servidas em `public/modelos/` têm SHA-256 registrado em `src/config/updatedDocumentModels.js`. Nenhum arquivo da pasta externa foi editado.

Foi mantido o fluxo existente: copiar e preencher o DOCX por substituições contextuais entre runs, remover somente o amarelo da cópia e gerar PDF localmente com pdf-lib. Não há Microsoft Graph, Microsoft 365 nem conversão remota. As partes binárias do DOCX são preservadas. No PDF, as versões antigas identificadas da assinatura empresarial e do carimbo foram substituídas pelas imagens posteriormente enviadas pelo usuário. Os PNGs recebidos são preservados em `assets/`; as cópias transparentes do gerador estão em `public/assets/documentos/`.

A parametrização de gênero usa a seleção explícita. Na declaração de residência, declarante e titular da residência têm identificação e gênero independentes. No pagamento com cartão de terceiro, CPF do contratante e CPF do titular permanecem separados, inclusive na assinatura. Valores das cinco cobranças são independentes; total de parcelas, parcelas pagas e valor da parcela não compartilham substituições.

## Correção da paginação após o teste

Os três recibos possuem orientação paisagem e seções contínuas com duas colunas. A primeira integração bloqueou esses modelos após encontrar uma segunda página quase vazia. O conversor existente agora lê as margens de cada seção e distribui as colunas contínuas; os três recibos geram uma página paisagem e o bloqueio foi removido. Não foram reduzidas fontes nem alteradas margens do DOCX para forçar o encaixe.

As imagens empresariais são identificadas por SHA-256, mantendo a proporção e a transparência dos PNGs recebidos. A assinatura é posicionada pelo bloco empresarial e pela linha de assinatura, depois da paginação, para acompanhar o texto em vez de ficar isolada no rodapé. Os distratos conferidos geram três páginas, conforme a contagem registrada no DOCX, com conteúdo e duas colunas de assinatura na última página. O script Python para processamento direto de PDFs está documentado em `docs/processar-pdfs.md`; a pasta recebida contém DOCX, portanto o lote sobre PDFs oficiais depende do fornecimento desses PDFs.

## Repetição de finalização/conciliação

Os arquivos 4 e 5 têm o mesmo texto e todas as partes não relacionadas a metadados iguais. O XML principal só difere em identificadores de edição e números absolutos de ordem das imagens. Normalizando esses números pela sua ordem relativa, as estruturas são idênticas. As prévias resultaram iguais. O arquivo 4 é a opção ativa; ambos os originais foram preservados.

## Conferência

Os testes verificam integridade das cópias, campos obrigatórios, conflito de exercícios/anos, perfis feminino e masculino, nomes longos, dados repetidos, campos com valores distintos, estrutura XML e imagens intactas. Testes da interface verificam acesso pelas categorias e presença separada das cinco novas notificações.

Verificação após as correções: a suíte principal passou com 138 testes, seguida por quatro testes focais da versão final do layout, sem falhas. Os seis testes Python passaram, incluindo preservação dos streams, transparência, rotação, fallback, colisões e lote com subpastas. O comando em lote também foi executado sobre dois PDFs de teste com os PNGs reais enviados, seguido de renderização e conferência visual. `npm run test:datajud` passou com dez testes. `npm run lint` e `npm run build` foram concluídos. A conferência de SHA-256 confirmou os 34 originais recebidos, as 33 cópias únicas servidas e os dois PNGs recebidos intactos.

Foram geradas e inspecionadas as páginas das prévias do original não preenchido e dos dois perfis, usando o conversor local existente. As evidências temporárias ficam em `tmp/modelos-audit/pdfs/`, `tmp/modelos-audit/renders/` e `tmp/modelos-audit/pdf-report.json`. Essa comparação não equivale a uma renderização independente do DOCX por um editor nativo: LibreOffice não está instalado. Nenhum modelo foi marcado com `validacaoVisualPdf: true`.

## Inventário final

| Categoria | Arquivo recebido | Resultado |
| --- | --- | --- |
| DISTRATOS | DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS - MODELO COM MULTA 2026.docx | Já existente — inclusão pulada |
| DISTRATOS | DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS - MODELO SEM MULTA 2026.docx | Já existente — inclusão pulada |
| DISTRATOS | DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS - MODELO _7_dias_estorno_total_2026.docx | Já existente — inclusão pulada |
| DISTRATOS | DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS - MODELO_com_devolucao_2026.docx | Já existente — inclusão pulada |
| DISTRATOS | DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS - MODELO_sem_devolucao_2026.docx | Já existente — inclusão pulada |
| DISTRATOS | DISTRATO DE CONTRATO DE PRESTAÇÃO DE SERVIÇOS - MODELO_inexecucao_ausencia_resposta_2026.docx | Já existente — inclusão pulada |
| INTIMAÇÃO JUDICIAL | LIMINAR INTIMAÇÃO - DAS DESPESAS COM DILIGÊNCIAS EXTRAJUDICIAIS.docx | Já existente — inclusão pulada |
| INTIMAÇÃO JUDICIAL | MODELO - CITAÇÃO JUDICIAL.docx | Modelo atualizado |
| INTIMAÇÃO JUDICIAL | PETIÇÃO - DECRETAÇÃO DA REVELIA COM REQUERIMENTO DO JULGAMENTO.docx | Modelo novo adicionado |
| NOTIFICAÇÃO EXTRAJUDICIAL | 1 - NOTIFICAÇÃO EXTRAJUDICIAL PARA EXIBIÇÃO DE DOCUMENTOS BANCÁRIOS.docx | Modelo novo adicionado |
| NOTIFICAÇÃO EXTRAJUDICIAL | 2 - NOTIFICAÇÃO EXTRAJUDICIAL PARA CONTESTAÇÃO DE COBRANÇAS E REVISÃO CONTRATUAL.docx | Modelo novo adicionado |
| NOTIFICAÇÃO EXTRAJUDICIAL | 3 - INTIMAÇÃO PARA FORMALIZAÇÃO DE ACORDO EXTRAJUDICIAL.docx | Modelo novo adicionado |
| NOTIFICAÇÃO EXTRAJUDICIAL | 4 - NOTIFICAÇÃO EXTRAJUDICIAL FINALIZAÇÃO DAS TRATATIVAS FORMALIZANDO A CONCILIAÇÃO.docx | Modelo atualizado |
| NOTIFICAÇÃO EXTRAJUDICIAL | 5 - Notificação extrajudicial_Intimacao_finalizacao_conciliacao.docx | Repetição equivalente ao arquivo 4 — inclusão pulada |
| NOTIFICAÇÃO EXTRAJUDICIAL | 6 - MANIFESTAÇÃO PARA COMPOSIÇÃO DE ACORDO EXTRAJUDICIAL.docx | Modelo novo adicionado |
| NOTIFICAÇÃO EXTRAJUDICIAL | MODELO -NOTIFICAÇÃO DE RESPALDO PARECER TECNICO - 2026.docx | Modelo novo adicionado |
| NOTIFICAÇÃO EXTRAJUDICIAL | Notificação extrajudicial__prosseguimento_acao.docx | Já existente — inclusão pulada |
| NOTIFICAÇÃO EXTRAJUDICIAL | Notificação extrajudicial__via_oficial_justica.docx | Já existente — inclusão pulada |
| NOTIFICAÇÃO EXTRAJUDICIAL | Requerimento de Postergação de Parcela.docx | Modelo atualizado |
| PROCURAÇÃO E DECLARAÇÃO | 1 - PROCURAÇÃO AD JUDICIA 2026.docx | Modelo atualizado |
| PROCURAÇÃO E DECLARAÇÃO | 2 - Declaracao_Hipossuficiencia_2026.docx | Modelo atualizado |
| PROCURAÇÃO E DECLARAÇÃO | Declaração Isenção de imposto de renda.docx | Modelo atualizado |
| PROCURAÇÃO E DECLARAÇÃO | MODELO - DECLARAÇÃO DE ENDEREÇO- ASSINAR PELO GOV.docx | Modelo novo adicionado |
| PROCURAÇÃO E DECLARAÇÃO | MODELO - DECLARAÇÃO DE ISENÇÃO DE COMPROVANTE DE ENDEREÇO.docx | Modelo atualizado |
| RECIBOS DE PRESTAÇÃO DE SERVIÇOS | Recibo_Prestacao_Servicos_Boleto_Bancario.docx | Modelo atualizado — PDF em uma página paisagem |
| RECIBOS DE PRESTAÇÃO DE SERVIÇOS | Recibo_Prestacao_Servicos_Cartao_Credito.docx | Modelo atualizado — PDF em uma página paisagem |
| RECIBOS DE PRESTAÇÃO DE SERVIÇOS | Recibo_Prestacao_Servicos_PIX.docx | Modelo atualizado — PDF em uma página paisagem |
| TERMOS DE CIENCIA | TERMO DE AUTORIZAÇÃO PARA PAGAMENTO COM CARTÃO DE TERCEIRO.docx | Modelo atualizado |
| TERMOS DE CIENCIA | TERMO DE CIENCIA AO ACESSO DO PORTAL GOV.docx | Modelo novo adicionado |
| TERMOS DE CIENCIA | TERMO DE CIÊNCIA DA COMPRA NO CRÉDITO.docx | Modelo atualizado |
| TERMOS DE CIENCIA | TERMO DE ENTREGA DO LAUDO PERICIAL - PARECER TÉCNICO E DECLARAÇÃO DE RESPONSABILIDADE.docx | Modelo novo adicionado |
| TERMOS DE CIENCIA | TERMO DE PRODUTO 2026.docx | Já existente — inclusão pulada |
| TERMOS DE CIENCIA | TERMO DE RECONHECIMENTO DE RECOMPRA.docx | Já existente — inclusão pulada |
| TERMOS DE CIENCIA | TERMO DE RESPONSABILIDADE E COMPROMISSO - PARCELAS EM ATRASO.docx | Já existente — inclusão pulada |
