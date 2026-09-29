import assert from "node:assert/strict";
import test from "node:test";
import {
  pertenceAExtrajudiciais,
  pertenceAProcessos,
  pertenceAProtocolos,
  pertenceAoProcessual,
} from "./processWorkflow.ts";

test("ação extrajudicial fica fora de Protocolos e Processual", () => {
  const acao = { numero_processo: null, fase_atual: "Extrajudicial", status_judicial: "EXTRAJUDICIAL", origem_registro: "acao_extrajudicial_manual" };
  assert.equal(pertenceAExtrajudiciais(acao), true);
  assert.equal(pertenceAProtocolos(acao), false);
  assert.equal(pertenceAoProcessual(acao), false);
});

test("ao ser encaminhada, a mesma ação sai dos extrajudiciais e entra em Protocolos", () => {
  const encaminhada = { numero_processo: null, fase_atual: "Solicitado para Ajuizamento", status_judicial: "AGUARDANDO_PROTOCOLO", origem_registro: "acao_extrajudicial_manual" };
  assert.equal(pertenceAExtrajudiciais(encaminhada), false);
  assert.equal(pertenceAProtocolos(encaminhada), true);
  assert.equal(pertenceAoProcessual(encaminhada), false);
});

test("caso em distribuição sem número pertence somente a Protocolos", () => {
  const humberto = { numero_processo: null, fase_atual: "Distribuição" };
  assert.equal(pertenceAProtocolos(humberto), true);
  assert.equal(pertenceAProcessos(humberto), false);
  assert.equal(pertenceAoProcessual(humberto), false);
});

test("ao receber número, caso deixa Protocolos e entra em Processos e Processual", () => {
  const humberto = { numero_processo: "1012345-00.2026.8.00.0000", fase_atual: "Distribuição" };
  assert.equal(pertenceAProtocolos(humberto), false);
  assert.equal(pertenceAProcessos(humberto), true);
  assert.equal(pertenceAoProcessual(humberto), true);
});

test("cliente sem número e fora do fluxo de ajuizamento não vira protocolo automaticamente", () => {
  assert.equal(pertenceAProtocolos({ numero_processo: "", fase_atual: "Cliente" }), false);
});
