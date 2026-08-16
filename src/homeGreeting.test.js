import assert from "node:assert/strict";
import test from "node:test";
import { criarResumoBoasVindas } from "./homeGreeting.js";

const hoje = "2026-08-15";

function resumo(tarefasAbertas, tarefasConcluidas = 0) {
  return criarResumoBoasVindas({
    nome: "Thayla Venturini",
    tarefasAbertas,
    tarefasConcluidas,
    hoje,
  });
}

test("informa quando todas as tarefas estão em ordem", () => {
  const resultado = resumo([], 3);
  assert.equal(resultado.tom, "success");
  assert.match(resultado.mensagem, /Todas as tarefas estão em ordem/);
  assert.match(resultado.mensagem, /3 tarefas/);
});

test("prioriza tarefas atrasadas", () => {
  const resultado = resumo([
    { data_limite: "2026-08-14", prioridade: "normal" },
    { data_limite: hoje, prioridade: "critica" },
  ]);
  assert.equal(resultado.filtro, "atrasadas");
  assert.match(resultado.mensagem, /1 atrasada/);
});

test("destaca extrema urgência para hoje", () => {
  const resultado = resumo([
    { prazo_limite: "2026-08-15T18:00:00", prioridade: "urgente" },
    { data_limite: "2026-08-17", prioridade: "normal" },
  ]);
  assert.equal(resultado.tom, "critical");
  assert.equal(resultado.filtro, "vencem_hoje");
  assert.match(resultado.mensagem, /atenção máxima/);
});

test("diferencia vencimentos normais de hoje", () => {
  const resultado = resumo([
    { data_limite: hoje, prioridade: "normal" },
  ]);
  assert.equal(resultado.tom, "warning");
  assert.match(resultado.mensagem, /vence hoje/);
});

test("mantém tom tranquilo quando não existem atrasos ou urgências", () => {
  const resultado = resumo([
    { data_limite: "2026-08-20", prioridade: "normal" },
  ]);
  assert.equal(resultado.tom, "normal");
  assert.match(resultado.mensagem, /Não há atrasos nem urgências/);
});
