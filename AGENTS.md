# Gerador de documentos jurídicos

Estas regras são obrigatórias em toda inclusão ou manutenção de modelos do gerador:

- O arquivo DOCX recebido é a fonte oficial. Preserve o original sem sobrescrevê-lo e preencha uma cópia.
- Preserve integralmente texto, estrutura e identidade visual do Word: fontes, tamanhos, estilos, cores, alinhamentos, margens, recuos, espaçamentos, tabelas, imagens, logotipos, cabeçalhos, rodapés, seções, quebras de página e espaços de assinatura.
- Por instrução do usuário, gere os PDFs localmente com `pdf-lib`, seguindo o fluxo anterior do projeto, sem Microsoft Graph/365 nem serviço remoto de conversão. Use a cópia preenchida do modelo como fonte do texto e da formatação; preserve os geradores locais anteriores onde não houver mapeamento DOCX utilizável. Não resuma nem altere o conteúdo silenciosamente e não use canvas como fonte do PDF final.
- Todo destaque amarelo é um campo variável ou marcador de concordância. Considere campos fragmentados entre vários `runs` do Word, inclusive pontuação não destacada. Remova o amarelo somente depois de preencher e validar todos os campos.
- Não invente informações e não emita arquivos com placeholders, destaques amarelos ou campos obrigatórios vazios.
- Use exclusivamente o sexo feminino ou masculino informado no cadastro/formulário; nunca deduza pelo nome. Aplique concordância somente às palavras referentes à pessoa correspondente e nunca por substituição global indiscriminada.
- Preserve termos referentes a empresas, instituições, assessoria, ações, parcelas, textos legais genéricos e outras pessoas. Em documentos com várias pessoas, trate a concordância de cada uma separadamente.
- Nacionalidade, estado civil e profissão devem concordar quando a palavra admitir flexão, sem alterar palavras invariáveis.
- Dados repetidos devem usar uma única origem e permanecer consistentes, respeitando a caixa de cada ocorrência.
- Antes da geração, detecte e exponha conflitos entre os dados informados e textos fixos do modelo (por exemplo, parcela, ano ou exercícios). Nunca altere texto fixo silenciosamente nem gere documento contraditório.
- Valide cada modelo com perfis feminino e masculino, nomes longos, campos repetidos, datas, valores e números por extenso. Compare visualmente o PDF com o DOCX e verifique texto, formatação, paginação, assinaturas, ausência de cortes/sobreposições, marcadores e amarelos.
- Se o DOCX original estiver ausente, contiver dados reais fixos, ou houver mapeamento ambíguo, registre a pendência e não crie um substituto por conta própria.

Fluxo permanente: **receber o modelo -> identificar os campos variáveis -> preencher uma cópia -> aplicar concordância contextual -> validar conflitos e pendências -> gerar o PDF localmente com pdf-lib -> conferir texto e apresentação**.
