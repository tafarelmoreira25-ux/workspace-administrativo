# Gerador de documentos jurídicos

Estas regras são obrigatórias em toda inclusão ou manutenção de modelos do gerador:

- O arquivo DOCX recebido é a fonte oficial. Preserve o original sem sobrescrevê-lo e preencha uma cópia.
- Preserve integralmente texto, estrutura e identidade visual do Word: fontes, tamanhos, estilos, cores, alinhamentos, margens, recuos, espaçamentos, tabelas, imagens, logotipos, cabeçalhos, rodapés, seções, quebras de página e espaços de assinatura.
- O modelo original PLATINO é a fonte absoluta da verdade. Preencha uma cópia, sem recriar o documento, padronizar sua aparência ou aplicar decisões estéticas automáticas. Preserve as propriedades individuais de cada run; substitua somente o trecho variável, inclusive quando fragmentado entre runs, sem reconstruir parágrafos.
- Gere PDFs localmente com `pdf-lib`, sem Microsoft Graph/365 nem serviço remoto de conversão, exclusivamente a partir da cópia preenchida do DOCX original. Não use geradores antigos ou genéricos como alternativa. Bloqueie a geração se faltar o original, houver mapeamento pendente, ou a conversão precisar substituir fontes ou propriedades do modelo. Não use canvas como fonte do PDF final.
- O modelo determina a formatação; o código apenas preenche os dados. Não imponha fonte, tamanho, alinhamento, margens ou espaçamento globais aos documentos. Um mesmo parágrafo pode combinar rótulos em negrito, campos destacados e texto normal; cada modelo mantém sua própria identidade visual.
- A fonte de cada documento deve seguir o DOCX original, incluindo as variantes de cada run, os estilos e o tema. Nao exija uma familia unica e nao bloqueie por divergencia em relacao a Calibri Light. Use a fonte real declarada pelo modelo, sem substituicao ou simulacao de estilos.
- O amarelo serve somente para identificar campos variáveis no modelo original. Preserve-o no original; na cópia final, depois de preencher e validar os campos, remova os destaques e sombreamentos amarelos, inclusive os herdados de estilos, cabeçalhos e rodapés. O DOCX preenchido e o PDF gerado NÃO devem exibir amarelo. Preserve todas as demais propriedades e cores.
- Não invente informações e não emita arquivos com placeholders, campos obrigatórios vazios ou marcadores amarelos visíveis.
- Use exclusivamente o sexo feminino ou masculino informado no cadastro/formulário; nunca deduza pelo nome. Aplique concordância somente às palavras referentes à pessoa correspondente e nunca por substituição global indiscriminada.
- Preserve termos referentes a empresas, instituições, assessoria, ações, parcelas, textos legais genéricos e outras pessoas. Em documentos com várias pessoas, trate a concordância de cada uma separadamente.
- Nacionalidade, estado civil e profissão devem concordar quando a palavra admitir flexão, sem alterar palavras invariáveis.
- Dados repetidos devem usar uma única origem e permanecer consistentes, respeitando a caixa de cada ocorrência.
- Antes da geração, detecte e exponha conflitos entre os dados informados e textos fixos do modelo (por exemplo, parcela, ano ou exercícios). Nunca altere texto fixo silenciosamente nem gere documento contraditório.
- Valide cada modelo com perfis feminino e masculino, nomes longos, campos repetidos, datas, valores e números por extenso. Antes da entrega, compare visual e estruturalmente o resultado com o original: páginas, margens, títulos, runs, fontes, destaques, espaçamentos, quebras, tabelas, imagens, logotipos e assinaturas. Não entregue documentos divergentes, cortados, sobrepostos ou com páginas em branco extras.
- Não altere margens, fontes ou posição de assinaturas para encaixar texto. Para campos maiores, preserve o espaço disponível e faça somente ajustes locais mínimos quando indispensáveis. Nunca altere cláusulas, ordem, títulos, elementos gráficos ou identidade visual sem instrução expressa.
- Só marque `validacaoVisualPdf: true` em um modelo depois de comparar visualmente os PDFs dos perfis de validação com o DOCX original e registrar as evidências. Testes estruturais isolados não comprovam equivalência visual.
- Se o DOCX original estiver ausente, contiver dados reais fixos, ou houver mapeamento ambíguo, registre a pendência e não crie um substituto por conta própria.

Fluxo permanente: **receber o modelo -> identificar os campos variáveis -> preencher uma cópia -> aplicar concordância contextual -> validar conflitos e pendências -> gerar o PDF localmente com pdf-lib -> conferir texto e apresentação**.
