import assert from "node:assert/strict";
import test from "node:test";
import {
  pertenceAProcessos,
  pertenceAProtocolos,
  pertenceAoProcessual,
} from "./processWorkflow.ts";

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
