import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularMetricasHunter,
  validarConclusaoProspecao,
  validarProspecaoHunter,
} from "./hunterLeads.js";

const perfilCompleto = {
  nomeCliente: "Cliente teste",
  whatsapp: "11999999999",
  documentoSugerido: "Certidão",
  analiseBreve: "Cliente com interesse e capacidade de pagamento.",
  clienteComProcesso: false,
  numeroProcesso: "",
  situacaoProcesso: "",
  consultorId: "12",
};

test("valida os dados obrigatórios do perfil Hunter", () => {
  assert.equal(validarProspecaoHunter(perfilCompleto, true), null);
  assert.match(
    validarProspecaoHunter({ ...perfilCompleto, whatsapp: "" }, true),
    /WhatsApp/,
  );
});

test("exige dados processuais quando existe processo judicial", () => {
  assert.match(
    validarProspecaoHunter({
      ...perfilCompleto,
      clienteComProcesso: true,
      numeroProcesso: "",
    }),
    /número do processo/i,
  );
});

test("exige motivo para resultado sem pagamento", () => {
  assert.equal(validarConclusaoProspecao("realizou_pagamento", ""), null);
  assert.match(
    validarConclusaoProspecao("nao_realizou_pagamento", "não"),
    /motivo/i,
  );
});

test("calcula conversão com base apenas nas tratativas concluídas", () => {
  assert.deepEqual(calcularMetricasHunter([
    { status: "concluida", resultado: "realizou_pagamento" },
    { status: "concluida", resultado: "nao_realizou_pagamento" },
    { status: "delegada", resultado: null },
  ]), {
    total: 3,
    pendentes: 1,
    concluidos: 2,
    positivos: 1,
    negativos: 1,
    conversao: 50,
  });
});
