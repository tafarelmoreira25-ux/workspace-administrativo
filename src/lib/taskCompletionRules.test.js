import test from "node:test";
import assert from "node:assert/strict";
import { tarefaExigeComprovacao } from "./taskCompletionRules.js";

test("exige link para tarefas que entregam documentos", () => {
  assert.equal(tarefaExigeComprovacao({ tipo_tarefa_codigo: "DOCUMENTOS" }), true);
  assert.equal(tarefaExigeComprovacao({ tipo_tarefa_codigo: "PROCURACOES" }), true);
  assert.equal(tarefaExigeComprovacao({ titulo: "Declaração de hipossuficiência" }), true);
});

test("não exige link para solicitação de laudo pericial", () => {
  assert.equal(tarefaExigeComprovacao({ tipo_tarefa_codigo: "LAUDO" }), false);
  assert.equal(tarefaExigeComprovacao({ titulo: "Solicitar laudo pericial" }), false);
});

test("respeita a regra explícita registrada no banco", () => {
  assert.equal(tarefaExigeComprovacao({ tipo_tarefa_codigo: "DOCUMENTOS", requer_comprovacao: false }), false);
  assert.equal(tarefaExigeComprovacao({ tipo_tarefa_codigo: "LAUDO", requer_comprovacao: true }), true);
});
