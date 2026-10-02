# Padrão global de formulários

O padrão visual de entrada de dados está em `src/formDesignSystem.css`, importado
uma vez por `src/main.jsx`. Cores, bordas, altura, tipografia, espaçamentos e estados
usam tokens `--form-*`. O seletor `#root` mantém esse padrão mesmo quando um módulo
carrega seu CSS sob demanda. As exclusões do seletor básico usam `:where` para
permitir que os estados de foco, erro, desabilitado e somente leitura prevaleçam.

## Componentes

Usar `src/components/common/FormControls.jsx` em novos formulários:

- `FormSection`: seção sem alterar os títulos existentes; `as="form"` preserva envio.
- `FormGrid`: grid responsivo de campos, preservando classes de largura existentes.
- `FormField`: label que envolve o controle ou recebe `htmlFor`; acrescenta o
  indicador obrigatório apenas quando o controle já é obrigatório e o label ainda
  não contém asterisco.
- `Input`: todos os tipos nativos, inclusive data, moeda com máscara existente,
  número, telefone, CPF/CNPJ, busca, arquivo, checkbox e rádio.
- `Select` e `Textarea`: seleção e texto de várias linhas.
- `FormActions`: ações com quebra de linha em telas pequenas.

Os componentes repassam props, eventos, refs, valores, máscaras e validações. Não
convertem números nem alteram dados, APIs ou regras. Erros existentes permanecem
junto ao campo; usar `aria-invalid` e `aria-describedby` para associá-los. Campos
desabilitados e `readOnly` mantêm seus comportamentos nativos.

```jsx
import { FormSection, FormGrid, FormField, Input, FormActions } from "./components/common/FormControls";

<FormSection as="form" onSubmit={salvar}>
  <h3>{tituloExistente}</h3>
  <FormGrid>
    <FormField>
      <span>{rotuloExistente}</span>
      <Input value={valor} onChange={alterar} required={obrigatorio} />
    </FormField>
  </FormGrid>
  <FormActions>{acoesExistentes}</FormActions>
</FormSection>
```

## Cobertura da migração

A varredura encontrou e migrou 308 declarações de controles em 14 arquivos.
Os campos dinâmicos do gerador de documentos e dos formulários genéricos também
passam pelos componentes globais.

| Arquivo/módulo | Áreas cobertas |
| --- | --- |
| App | Login, recuperação e troca de senha |
| ClientesModule | Cadastro, edição, processos, atendimentos e histórico do cliente |
| CarteiraProcessual | Extrajudiciais, processos judiciais, movimentações e atividades |
| EsteiraKanban | Protocolos e todas as etapas de encaminhamento |
| PainelJudicial | Ficha processual, dados bancários, contrato, tarefas e atendimentos |
| HomologacaoQuitacaoModule | Cadastro, contrato, propostas, reuniões, diligências e quitação |
| OperacionalProcessualModule | Agenda, tarefas, atendimentos e filtros |
| GerencialProcessualModule | Ocorrências, custas, status e filtros |
| GeradorDocumentos | Dados pessoais, contato, endereço, contrato, campos dinâmicos e uploads |
| EmailComposer | Preparação de e-mail |
| ContentAnalyzer | Análise de e-mail/PDF |
| ModelLibraryModal | Pesquisa e filtros de modelos |
| GlobalSearch | Busca global |
| TreinamentosOperacionais | Pesquisa e seleção de área |

Containers destinados ao preenchimento usam seções contínuas. Cards de status,
indicadores, resultados, ações e resumo informativo mantêm sua função. O cadastro
de homologação foi dividido em Cliente, Dados do contrato, Documentos e Negociações
usando a terminologia já existente no módulo.

Grids com campos curtos usam duas ou três colunas; dados processuais mantêm seus
spans proporcionais. Até 960px, os grids extensos usam duas colunas; até 600px,
os campos e ações se reorganizam sem spans fora do grid. Inputs usam fonte de 16px
em telas pequenas e foco perceptível, inclusive em modo de alto contraste.

## Verificação

`npm run check` executa lint, testes e build. Os testes de `FormControls.test.mjs`
verificam props nativas, eventos, refs, validação, uploads, associação do label e
envio de formulário. Também fazem uma varredura de todos os arquivos JSX/TSX para
impedir a introdução de controles fora dos componentes globais.

A comparação com o código anterior confirmou a preservação dos atributos e
eventos em 623 declarações de campos, labels e formulários. A verificação visual
em navegador não foi realizada nesta sessão, pois nenhum navegador estava
disponível. As verificações de código não substituem essa revisão visual.
