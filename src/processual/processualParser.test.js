import assert from "node:assert/strict";
import test from "node:test";

import {
  criarDadosProcessuaisVazios,
  organizarResumoProcessual,
} from "./processualParser.js";

const DATA_FIXA = new Date("2026-08-17T12:34:00");

test("cria somente os campos do modelo processual oficial", () => {
  const dados = criarDadosProcessuaisVazios("Tafarel Moreira", DATA_FIXA);
  assert.equal(dados.representante_responsavel, "Tafarel Moreira");
  assert.equal(dados.data_consulta, "2026-08-17");
  assert.equal(dados.hora_consulta, "12:34");
  assert.equal("juiz_responsavel" in dados, false);
  assert.equal("observacao_interna" in dados, false);
});

test("interpreta o resumo rotulado usado como base do formulário", () => {
  const texto = `
NÚMERO DO PROCESSO / PROTOCOLO
1001234-56.2026.8.26.0001
ORIGEM / TRIBUNAL / VARA
TJSP - 3ª Vara Cível de São Paulo/SP
SEGREDO OU SIGILO
Não
JUSTIÇA GRATUITA
Sim
DATA DA DISTRIBUIÇÃO
15/08/2026
NOME DO CLIENTE
Maria da Silva
RÉU / INSTITUIÇÃO FINANCEIRA
Banco Exemplo S.A.
ADVOGADO(A) DO CLIENTE
Dra. Ana Souza - OAB/SP 123456
ADVOGADO(A) DO RÉU / INSTITUIÇÃO FINANCEIRA
Dr. João Santos - OAB/SP 654321
ASSUNTO / NATUREZA DA AÇÃO
Revisão contratual
STATUS ATUAL
Aguardando decisão
DATA DA ÚLTIMA MOVIMENTAÇÃO
16/08/2026
DESCRIÇÃO DA ÚLTIMA MOVIMENTAÇÃO
Autos conclusos para decisão.
PRÓXIMOS PASSOS
Aguardar manifestação do Juízo.
LINK DOS ANEXOS/DOCUMENTOS DO PROCESSO
https://drive.google.com/documento
LINK PARA CONSULTA DAS MOVIMENTAÇÕES
https://pje.tjsp.jus.br/processo
`;
  const resultado = organizarResumoProcessual(texto, "Tafarel Moreira", DATA_FIXA);
  assert.equal(resultado.dados.numero_processo, "1001234-56.2026.8.26.0001");
  assert.equal(resultado.dados.nome_cliente, "Maria da Silva");
  assert.equal(resultado.dados.reu, "Banco Exemplo S.A.");
  assert.equal(resultado.dados.data_distribuicao, "2026-08-15");
  assert.equal(resultado.dados.data_ultima_movimentacao, "2026-08-16");
  assert.equal(resultado.dados.link_movimentacoes, "https://pje.tjsp.jus.br/processo");
  assert.equal(resultado.dados.link_anexos_documentos, "https://drive.google.com/documento");
});

test("localiza dados relevantes em texto corrido de sistema judicial", () => {
  const texto = `
Processo nº 1012345-67.2026.8.26.0100
Tribunal de Justiça de São Paulo - 5ª Vara Cível da Comarca de São Paulo
Autor: Carlos Pereira
Réu: Banco Modelo S.A.
Advogado do cliente: Dra. Fernanda Lima - OAB/SP 112233
Assunto: Revisão de contrato bancário
Segredo de Justiça: Não
Justiça Gratuita: deferida
Distribuído em: 10/08/2026
Situação atual: Em andamento
Movimentações
14/08/2026 - Petição juntada aos autos
16/08/2026 - Despacho proferido pelo Juízo
Consulta: https://esaj.tjsp.jus.br/processo/1012345
`;
  const { dados } = organizarResumoProcessual(texto, "Rafael Moreira", DATA_FIXA);
  assert.equal(dados.numero_processo, "1012345-67.2026.8.26.0100");
  assert.match(dados.origem, /Tribunal de Justiça/);
  assert.equal(dados.nome_cliente, "Carlos Pereira");
  assert.equal(dados.reu, "Banco Modelo S.A.");
  assert.equal(dados.segredo_sigilo, "Não");
  assert.equal(dados.justica_gratuita, "Sim");
  assert.equal(dados.data_ultima_movimentacao, "2026-08-16");
  assert.match(dados.descricao_ultima_movimentacao, /Despacho proferido/);
});
