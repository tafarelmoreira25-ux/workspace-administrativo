# Arquitetura do Gerador de Documentos

## Decisão

Os commits históricos `93d03602e1da`, `6da68d461cb5` e `2fc6c1af0ae3` mostram um catálogo de modelos ligado por `modo` a renderizadores PDF específicos. Cada renderizador desenhava seu documento localmente com `pdf-lib`; não era uma conversão genérica de DOCX. A biblioteca antiga não foi reativada. `src/lib/documentGeneratorRegistry.js` mantém o catálogo vazio e define o ponto de registro para modelos novos.

O renderizador genérico que lia XML do DOCX e rasterizava páginas em canvas foi removido. Ele não preservava com segurança tabelas, imagens, estilos, seções e quebras do Word. O preenchimento DOCX legado também foi removido porque seus mapeamentos estavam vinculados aos modelos antigos.

## Cadastro de um novo modelo

Após receber o DOCX oficial, registre um item próprio no catálogo com identificador, nome, categoria, campos do formulário e função `renderPdf(dados)`. O renderizador específico usa o DOCX como referência visual; o mecanismo de PDF produz um novo documento e não converte automaticamente o arquivo Word. Nenhum modelo entra na biblioteca até passar pela comparação visual e validação de campos e conteúdo.

O catálogo atual está vazio. Selecionar um DOCX na interface apenas o mantém no controle de arquivo do navegador durante a sessão; isso não cadastra, envia ou converte o modelo.

## LibreOffice

LibreOffice é software gratuito e de código aberto, com exportação PDF pela linha de comando (`soffice`). Não foi encontrada instalação executável (`soffice`/`libreoffice`) no ambiente desta revisão, e um navegador não executa esse binário.

A Vercel já documenta execução de containers com `Dockerfile.vercel`, então LibreOffice pode ser avaliado numa imagem própria da Vercel ou num serviço/worker separado. O runtime containerizado tem cobrança de CPU ativo; LibreOffice ser gratuito não torna gratuita a infraestrutura de execução. A implementação exigiria empacotar e operar o binário e medir tamanho, memória, duração e tráfego dos DOCX; a documentação atual também registra limite de 4,5 MB para payload de função. A conversão pelo LibreOffice deve ser comparada com o Word para cada documento, pois a equivalência de layout não está garantida. O projeto não configura nem depende desse conversor.

Referências: [licença e gratuidade do LibreOffice](https://www.libreoffice.org/faq/), [exportação PDF por linha de comando do LibreOffice](https://help.libreoffice.org/latest/en-US/text/shared/guide/pdf_params.html), [containers na Vercel](https://vercel.com/kb/guide/docker), [limite de payload da Vercel](https://vercel.com/docs/errors/function_payload_too_large). A possibilidade de executar este conversor específico em container da Vercel é uma inferência do suporte a imagens OCI e do comando `soffice`; nenhum deployment ou teste de compatibilidade foi feito.

## Persistência e segurança

PDFs gerados, formulários preenchidos e histórico de geração permanecem locais e são baixados pelo usuário. Não gravar esses dados no Supabase ou Storage. Não publicar DOCX que contenham dados pessoais reais ou material confidencial.

## Verificação nesta revisão

- Revisados os caminhos de geração nos três commits históricos.
- Removidos o renderizador genérico de DOCX e o preenchimento legado vinculado à biblioteca desativada.
- A biblioteca de renderizadores permanece sem entradas; ainda não há DOCX novo para mapear, gerar e comparar.
- Node.js, npm e LibreOffice não estão instalados neste ambiente; lint, testes, build e comparação de PDF não puderam ser executados.
