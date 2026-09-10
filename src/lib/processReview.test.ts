import assert from "node:assert/strict";
import test from "node:test";
import { processoSemRevisao } from "./processReview.ts";

const referencia = new Date("2026-09-10T12:00:00Z");

test("Dashboard e Alertas usam a mesma regra de processo sem revisão", () => {
  const processos = [
    { numero_processo: "1012345-00.2026.8.00.0000", ultima_revisao: null },
    { numero_processo: "2", ultima_revisao: "2026-08-11" },
    { numero_processo: "3", ultima_revisao: "2026-09-09" },
    { numero_processo: null, ultima_revisao: null },
  ];
  const dashboard = processos.filter((item) => processoSemRevisao(item, referencia)).length;
  const alertas = processos.filter((item) => processoSemRevisao(item, referencia)).length;
  assert.equal(dashboard, 2);
  assert.equal(alertas, dashboard);
});
