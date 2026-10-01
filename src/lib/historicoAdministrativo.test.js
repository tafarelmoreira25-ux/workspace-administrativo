import test from "node:test";
import assert from "node:assert/strict";
import { agruparTimelineProcessual } from "./historicoAdministrativo.js";

const itens = [
  { id: "extra-1", fase: "extrajudicial_administrativa", ordemFase: 1, ordemMovimentacao: 1 },
  { id: "extra-2", fase: "extrajudicial_administrativa", ordemFase: 1, ordemMovimentacao: 2 },
  { id: "transicao", fase: "transicao_judicial", ordemFase: 2, ordemMovimentacao: 26 },
  { id: "judicial-antigo", fase: "judicial", ordemFase: 3, data: "2026-09-20T12:00:00Z" },
  { id: "judicial-recente", fase: "judicial", ordemFase: 3, data: "2026-09-28T12:00:00Z" },
];

test("mostra fases e movimentos mais recentes primeiro por padrão", () => {
  const fases = agruparTimelineProcessual(itens);
  assert.deepEqual(fases.map((fase) => fase.id), ["judicial", "transicao_judicial", "extrajudicial_administrativa"]);
  assert.deepEqual(fases[0].itens.map((item) => item.id), ["judicial-recente", "judicial-antigo"]);
  assert.deepEqual(fases[2].itens.map((item) => item.id), ["extra-2", "extra-1"]);
});

test("permite consultar a jornada do mais antigo para o mais recente", () => {
  const fases = agruparTimelineProcessual(itens, false);
  assert.deepEqual(fases.map((fase) => fase.id), ["extrajudicial_administrativa", "transicao_judicial", "judicial"]);
  assert.deepEqual(fases[0].itens.map((item) => item.id), ["extra-1", "extra-2"]);
  assert.deepEqual(fases[2].itens.map((item) => item.id), ["judicial-antigo", "judicial-recente"]);
});
