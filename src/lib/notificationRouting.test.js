import test from "node:test";
import assert from "node:assert/strict";
import { destinoDaNotificacao } from "./notificationRouting.js";

test("abre a tarefa vinculada para uma nova solicitação", () => {
  assert.deepEqual(destinoDaNotificacao({ tipo: "nova_tarefa", tarefa_id: 52 }), {
    aba: "tarefas", secao: "tarefas", tarefaId: 52,
  });
});

test("leva conclusões ao histórico", () => {
  assert.deepEqual(destinoDaNotificacao({ tipo: "concluida", tarefa_id: 18 }, true), {
    aba: "historico", secao: "historico", tarefaId: 18,
  });
  assert.equal(destinoDaNotificacao({ tipo: "concluida", tarefa_id: 18 }, false).aba, "acompanhamento");
});

test("direciona urgências conforme o perfil", () => {
  assert.deepEqual(destinoDaNotificacao({ tipo: "nova_urgencia" }, true), {
    aba: "urgencias", secao: "urgencias",
  });
  assert.deepEqual(destinoDaNotificacao({ tipo: "nova_urgencia" }, false), {
    aba: "tarefas", secao: "urgencias",
  });
});

test("abre feedback na área apropriada", () => {
  assert.equal(destinoDaNotificacao({ tipo: "novo_feedback" }, false).aba, "feedbacks");
  assert.equal(destinoDaNotificacao({ tipo: "novo_feedback" }, true).aba, "equipe");
});

test("abre o perfil indicado na carteira Hunter", () => {
  assert.deepEqual(destinoDaNotificacao({
    tipo: "perfil_hunter_delegado",
    referencia_tipo: "prospeccao_hunter",
    referencia_id: 31,
  }), {
    aba: "hunter", secao: "hunter", referenciaId: 31,
  });
});
