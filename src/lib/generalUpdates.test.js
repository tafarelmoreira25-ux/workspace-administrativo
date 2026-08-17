import test from "node:test";
import assert from "node:assert/strict";
import {
  destinoDaAtualizacaoGeral,
  filtrarAtualizacoesGeraisAtivas,
  tempoDecorridoAtualizacao,
} from "./generalUpdates.js";

test("mantém no mural somente atualizações que ainda não venceram", () => {
  const agora = new Date("2026-08-17T15:00:00-03:00");
  const ativas = filtrarAtualizacoesGeraisAtivas([
    { id: 1, created_at: "2026-08-17T13:00:00-03:00", expira_em: "2026-08-17T18:00:00-03:00" },
    { id: 2, created_at: "2026-08-17T08:00:00-03:00", expira_em: "2026-08-17T13:00:00-03:00" },
  ], agora);
  assert.deepEqual(ativas.map((item) => item.id), [1]);
});

test("formata há quanto tempo a atualização foi publicada", () => {
  assert.equal(
    tempoDecorridoAtualizacao("2026-08-17T13:35:00-03:00", new Date("2026-08-17T15:00:00-03:00")),
    "há 1h 25min",
  );
});

test("direciona post-its para o módulo correspondente", () => {
  assert.equal(destinoDaAtualizacaoGeral({ destino: "status_processual" }), "status_processual");
  assert.equal(destinoDaAtualizacaoGeral({ destino: "tarefas" }), "tarefas");
});
