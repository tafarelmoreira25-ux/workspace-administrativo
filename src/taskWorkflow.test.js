import assert from "node:assert/strict";
import test from "node:test";
import {
  obterEtapaTaskManager,
  obterStatusTaskManager,
} from "./taskWorkflow.js";

const statusTraduzidos = [
    ["delegada", "fila"],
    ["recebida", "fila"],
    ["em_execucao", "em-andamento"],
    ["aguardando_informacao", "pendente-bloqueada"],
    ["devolvida_correcao", "pendente-bloqueada"],
    ["devolvida_conferencia", "validacao-supervisor"],
    ["concluida", "concluida"],
];

for (const [statusTecnico, statusEsperado] of statusTraduzidos) {
  test(`traduz ${statusTecnico} para ${statusEsperado}`, () => {
    assert.equal(obterStatusTaskManager({ status: statusTecnico }).chave, statusEsperado);
  });
}

test("prioriza a fase informada pelo banco", () => {
  assert.equal(obterEtapaTaskManager({ fase_esteira: 7, titulo: "Contrato" }).numero, 7);
});

const fasesInferidas = [
    ["Validar contrato e abrir pasta", 1],
    ["Conferir os 5 documentos iniciais e CRV", 2],
    ["Executar requerimento no GOV.BR", 3],
    ["Salvar PDF do protocolo", 4],
    ["Registrar evidências de WhatsApp", 5],
    ["Solicitar laudo contábil", 6],
    ["Distribuir ação no fórum", 7],
    ["Agendar audiência de conciliação", 8],
    ["Encerramento financeiro", 9],
];

for (const [titulo, faseEsperada] of fasesInferidas) {
  test(`infere a fase de ${titulo}`, () => {
    assert.equal(obterEtapaTaskManager({ titulo }).numero, faseEsperada);
  });
}
