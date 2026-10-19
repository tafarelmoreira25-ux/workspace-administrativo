# Gerador de documentos jurídicos

Estas regras se aplicam somente ao Gerador de Documentos:

- A biblioteca começa vazia. Não reative nem trate como oficiais os modelos antigos guardados em backup.
- O DOCX recebido é a referência visual oficial. Preserve-o sem sobrescrever e mantenha os originais fora de diretórios públicos quando contiverem dados pessoais ou informação confidencial.
- A arquitetura ativa é de um renderizador PDF local e específico para cada novo modelo, com seus próprios campos, validações e regras de diagramação. O `pdf-lib` pode ser usado para desenhar PDFs individuais; isso não converte automaticamente DOCX nem garante fidelidade a qualquer Word.
- Use o Word como referência para reproduzir e revisar o layout. Preserve texto, fontes, tamanhos, estilos, cores, alinhamentos, margens, recuos, espaçamentos, tabelas, imagens, logotipos, cabeçalhos, rodapés, seções, quebras de página e assinaturas que existam no novo original. Identifique limites do renderizador e ajuste aquele modelo antes de ativá-lo.
- Não reescreva nem resuma conteúdo jurídico, não invente dados e não gere arquivos com campos obrigatórios vazios ou placeholders.
- Trate todo destaque amarelo como campo variável ou marcador de concordância, inclusive quando o texto estiver fragmentado entre vários `runs`. Mapeie os campos e pontuação de cada modelo antes de habilitá-lo.
- Use somente o sexo informado no formulário; nunca deduza pelo nome. Aplique concordância apenas à pessoa correspondente, sem substituição global. Preserve menções a empresas, instituições, ações, parcelas, textos legais e outras pessoas. Nacionalidade, estado civil e profissão concordam quando flexionáveis.
- Mantenha campos repetidos consistentes e detecte conflitos entre dados preenchidos e texto fixo (por exemplo, parcela, ano ou exercícios). Exponha conflitos e bloqueie a geração até serem resolvidos; nunca altere texto fixo silenciosamente.
- Valide cada novo modelo com perfis feminino e masculino, nomes longos, campos repetidos, datas, valores e números por extenso. Compare o PDF com o DOCX e confira texto, formatação, paginação, assinaturas, cortes, sobreposições, placeholders e destaques antes de ativá-lo.
- Se o DOCX estiver ausente, contiver dados pessoais fixos, ou houver mapeamento ambíguo, registre a pendência e não crie um substituto.
- Gere o PDF localmente e entregue-o para download. Não salve PDFs gerados, rascunhos ou histórico no Supabase ou Storage.
- Não use Microsoft Graph, Microsoft 365, Word Online, OneDrive nem credenciais externas. LibreOffice pode ser avaliado em execução local, container ou worker, mas a compatibilidade de layout deve ser validada por modelo; não presuma que o resultado seja idêntico ao Word.

Fluxo: **receber DOCX -> identificar campos e regras -> criar formulário e renderizador específicos -> validar conteúdo e concordância -> comparar visualmente com o original -> ativar e permitir download**.
