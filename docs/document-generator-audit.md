# Auditoria do gerador de documentos Word/PDF

Data da revisão: 2026-10-04.

## Padrão adotado

Por instrução do usuário em 04/10/2026, a geração voltou ao mecanismo local com `pdf-lib`, identificado na versão `c4ee42e` do projeto. A dependência do Microsoft Graph foi removida.

A prévia e o download usam a mesma função `gerarPdfModelo`. Os modelos que já possuíam gerador PDF próprio voltaram a usar esse código. Para os demais, o sistema preenche uma cópia do DOCX oficial, aplica concordância contextual, valida os campos e desenha texto selecionável, imagens e formatação no PDF com `pdf-lib`. Os originais não são sobrescritos e os dados não são enviados a um serviço de conversão.

O mecanismo local é um gerador de PDF do projeto, não um motor completo de layout do Word. Formas complexas, tabelas com células mescladas e novas seções/colunas exigem conferência ao cadastrar novos modelos. A posterior inclusão de um modelo não implica suporte automático a todo recurso do DOCX.

## Modelos adicionados nesta revisão

- Requerimento de Postergação de Parcela, incluindo o requerimento e o Termo de Garantia e Acordo de Postergação de Obrigação Financeira no mesmo DOCX.
- Declaração de Isenção do Imposto de Renda Pessoa Física (IRPF), substituída pelo anexo Word mais recente.

Os anexos foram copiados integralmente para `modelos-originais/` e `public/modelos/`; os arquivos externos recebidos não foram sobrescritos. Os hashes SHA-256 das cópias conferiram com os anexos.

## Modelos revisados e aptos ao fluxo Word

35 dos 40 modelos cadastrados possuem DOCX oficial configurado e passaram pela validação automática de preenchimento:

- 6 distratos;
- Procuração;
- Declaração de Hipossuficiência;
- Declaração de Isenção de IRPF;
- Requerimento de Postergação de Parcela;
- Notificação Extrajudicial principal;
- Citação da Parte Ré;
- Intimação Extrajudicial;
- Contestação de Chargeback;
- 5 termos da pasta `termos`;
- 3 recibos da pasta `recibos`;
- 6 notificações administrativas da pasta `notificacoes`;
- 2 modelos de liminar;
- Termo de Compromisso de Pagamento;
- Termo de Ciência, Autorização e Confirmação de Segurança;
- Declaração de Ausência de Carteira de Trabalho;
- Recibo de Prestação de Serviços;
- Termo de Recompra / Repagamento.

## Pendências registradas

Os cinco modelos abaixo continuam nos geradores PDF anteriores, disponíveis localmente, e exibem um aviso referente ao mapeamento do Word original. Esses avisos não exigem configuração Microsoft. Nenhum DOCX substituto foi inventado:

- **Contestação das taxas - E-mail:** o DOCX possui cinco campos de encargos, enquanto o formulário possui sete; é preciso definir onde entram tarifa de cadastro e demais tarifas.
- **Termo de Ciência de Pagamento:** o único Word localizado contém dados reais de cliente, banco, contrato e processo, sem marcações variáveis.
- **Certidão de Diligência e Contato Profissional:** o DOCX solicita instituição financeira e consultor, ausentes no formulário; a vara também aparece como texto fixo.
- **Relatório de Negociação e Acordo / Homologação:** o DOCX possui quatro caixas de manifestação (`[   ]`), mas o formulário atual tem um único campo livre; é preciso definir a regra de seleção.
- **Relatório de Atualização Processual:** não foi localizado um DOCX original utilizável; existe somente um arquivo temporário de bloqueio do Word.

## Inconsistências fixas e decisões

- Por decisão do usuário, a ocorrência não destacada `Parcela nº 09` da cláusula 1.2 do termo passou a ser variável e usa o mesmo número informado nas demais ocorrências.
- O Requerimento mantém 2026 como ano fixo no vencimento inicial e nas duas datas de assinatura. O sistema bloqueia valores de data com outro ano.
- A Declaração de IRPF mantém os exercícios fixos de 2023, 2024 e 2025 e o ano fixo 2025 na assinatura. O sistema bloqueia exercícios ou data divergentes.
- A Procuração mantém o ano fixo 2025 do Word original e bloqueia data divergente.

## Validações da revisão anterior (histórico)

- Feminino e masculino nos dois modelos adicionados.
- Nome longo, CPF/CNPJ fragmentados em vários `runs`, campos repetidos, data, parcela, valor e valor por extenso.
- Parcela 12 preenchida de forma idêntica nas três ocorrências do requerimento/termo, inclusive na antiga ocorrência fixa da cláusula 1.2.
- Concordância contextual: Sra./Sr., inscrita/inscrito, titular, DEVEDORA/DEVEDOR, portadora/portador, domiciliada/domiciliado e isenta/isento.
- Ausência de destaque amarelo e de placeholders pendentes.
- Preservação das duas mídias do Requerimento e de todas as partes internas dos DOCX.
- Geração estrutural bem-sucedida dos 35 modelos Word configurados.
- Conversão local pelo Microsoft Word dos quatro cenários principais. O Requerimento permaneceu com 2 páginas e a Declaração de IRPF com 1 página, tanto no original quanto nas cópias com perfil feminino/masculino e nome longo.
- Inspeção visual da página preenchida do Requerimento: texto, alinhamentos, margens, quebras e fim de página sem corte ou sobreposição.
- `npm run lint`, 42 testes automatizados e `npm run build` concluídos com sucesso.

## Validação do fluxo local

- Teste de geração dos 40 modelos, com perfis feminino e masculino e nome longo, rejeitando qualquer requisição fora dos arquivos locais `/modelos/`.
- Verificação do cabeçalho PDF, leitura das páginas resultantes e teste de texto selecionável, concordância e parcelas repetidas da postergação.
- Renderização local dos PDFs dos 40 modelos com dados fictícios para conferência visual. Os arquivos de revisão ficam em `.tmp/pdf-review/` e não são versionados.
- Ajustes de cabeçalho com logotipo, objetos duplicados `Choice/Fallback`, caixas de texto, caracteres de lista e reserva de assinatura.
- A postergação mantém requerimento e termo em duas páginas. O número da parcela é compartilhado por todas as ocorrências; as duas assinaturas do termo ficam juntas.
- Nos recibos de boleto/cartão/PIX, cidade, data e horário de assinatura são campos explícitos, evitando marcadores remanescentes e horário inventado. Preencher esses campos não realiza uma assinatura eletrônica.
- A suíte `npm run check` inclui os testes da geração local.

## Publicação

Para esta mudança, basta publicar o frontend atualizado. Não é necessário executar SQL, cadastrar segredos Microsoft ou publicar uma Edge Function de conversão. O Supabase continua sendo usado para os recursos já existentes de login e registros do sistema.
