# Modelos recebidos em 04/10/2026

Os quatro DOCX do Desktop são a fonte oficial. Cópias integrais foram arquivadas em
`modelos-originais/atualizados-2026-10-04/`. O gerador preenche uma cópia e usa o conversor
local existente com pdf-lib. Os documentos não foram recriados.

## Caminhos ativos

| Documento | Arquivo servido em `public/modelos/` | Configuração |
| --- | --- | --- |
| Procuração Ad Judicia | `procuracao-ad-judicia-atualizado-2026-10-04.docx` | `MODELO_PROCURACAO`, em `src/GeradorDocumentos.jsx` |
| Isenção de Imposto de Renda | `declaracao-isencao-irpf-atualizado-2026-10-04.docx` | `DOCUMENT_TEMPLATES`, modo `declaracao-isencao-irpf` |
| Isenção de Comprovante de Endereço | `declaracao-isencao-comprovante-endereco-atualizado-2026-10-04.docx` | `DOCUMENT_TEMPLATES`, modo `declaracao-isencao-comprovante-endereco` |
| Ausência de Carteira de Trabalho | `declaracao-ausencia-carteira-trabalho-atualizado-2026-10-04.docx` | `DOCUMENT_TEMPLATES`, modo `declaracao-ausencia-carteira-trabalho` |

`src/config/updatedDocumentModels.js` centraliza caminhos e hashes SHA-256. O carregamento
usa `cache: no-store` e valida os bytes antes do preenchimento. Se o arquivo servido for
substituído por outra versão, a geração é bloqueada. Os caminhos antigos permanecem
como histórico e não são usados por esses quatro modelos.

## Campos mapeados

- Procuração: nome do titular no outorgante e assinatura; nacionalidade, estado civil,
  profissão, gênero, RG, CPF, e-mail, endereço, CEP, banco, contrato e cidade/UF/data.
  Nome, OAB, e-mail e endereço da advogada permanecem fixos conforme o original.
- IRPF: identificação, qualificação, gênero, endereço/CEP, cidade/UF/data e assinatura.
  Os exercícios de 2023, 2024 e 2025 são texto fixo; divergências são bloqueadas.
- Endereço: nome, CPF, RG, endereço, bairro, cidade, estado, CEP, opção de parentesco,
  descrição de Outro, nome e CPF do titular do comprovante e local/data. A opção
  selecionada recebe X; Outro exige descrição. A linha de assinatura é preservada.
- Carteira de trabalho: nome no corpo e assinatura, nacionalidade, estado civil,
  profissão, gênero, RG, CPF, e-mail, endereço completo e local/data.

## Datas fixas dos arquivos recebidos

A procuração recebida contém `Estado, XX de XXXXXXX de 2025.`. O gerador preserva
2025 e bloqueia data de emissão de outro ano. Alterar esse ano exige atualizar o
original ou instrução expressa; ele não deve ser corrigido silenciosamente.
As três declarações fixam 2026 na assinatura e bloqueiam datas de outros anos.

## Verificação

`src/lib/updatedDocumentModels.test.js` confere hashes, igualdade entre cópias oficiais,
preenchimento dos quatro modelos com perfis feminino e masculino, nomes longos,
dados repetidos, parentesco e assinatura. Compara a estrutura XML preservando runs,
fontes, estilos, margens, tabelas e partes binárias, admitindo apenas texto variável
e remoção do amarelo na cópia final. Testa também a conversão da procuração em PDF
e os bloqueios de integridade, campos ausentes e conflitos de data.

A suíte existente de documentos verifica a conversão e estrutura das declarações.
Não foi atribuída validação visual: LibreOffice não está instalado no ambiente.
A publicação deve incluir tanto o código quanto os quatro arquivos de `public/modelos/`.
