import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularMetricasStatusProcessual,
  situacaoPrazoProcessual,
  validarStatusProcessual,
} from "./processStatus.js";

const formularioValido = {
  cliente: { id: 10 },
  statusDocumentos: "corretos",
  statusProcuracao: "encaminhada",
  statusProtocolo: "pendente",
  numeroProcesso: "",
};

test("exige número do processo quando o cliente foi protocolado", () => {
  assert.equal(
    validarStatusProcessual({ ...formularioValido, statusProtocolo: "protocolado" }),
    "Informe o número do processo para marcar como Protocolado.",
  );
  assert.equal(
    validarStatusProcessual({ ...formularioValido, statusProtocolo: "protocolado", numeroProcesso: "0001234-10.2026.8.26.0001" }),
    null,
  );
});

test("calcula o prazo de quinze dias da geração do protocolo", () => {
  assert.deepEqual(
    situacaoPrazoProcessual("2026-08-20", new Date("2026-08-17T12:00:00")),
    { dias: 3, rotulo: "3 dia(s) restante(s)", vencido: false },
  );
  assert.deepEqual(
    situacaoPrazoProcessual("2026-08-15", new Date("2026-08-17T12:00:00")),
    { dias: -2, rotulo: "Prazo vencido há 2 dia(s)", vencido: true },
  );
});

test("resume os status processuais com as três cores principais", () => {
  assert.deepEqual(calcularMetricasStatusProcessual([
    { status_protocolo: "protocolado" },
    { status_protocolo: "pendente" },
    { status_protocolo: "em_geracao" },
    { status_protocolo: "pasta_retornou" },
  ]), {
    total: 4,
    protocolados: 1,
    pendentes: 1,
    emGeracao: 1,
    pastasRetornadas: 1,
  });
});
