import test from "node:test";
import assert from "node:assert/strict";
import {
  filtrarTreinamentos,
  recomendarTreinamentosParaTarefa,
} from "./trainingResources.js";

test("recomenda o treinamento de audiência para a tarefa correspondente", () => {
  const [primeiro] = recomendarTreinamentosParaTarefa({
    categoria: "AGENDAR AUDIÊNCIA",
    titulo: "Agendar audiência extrajudicial",
    setor_executor: "Administrativo",
  });
  assert.equal(primeiro.id, "esteira-adm-pdf");
});

test("recomenda o treinamento processual para atualização judicial", () => {
  const [primeiro] = recomendarTreinamentosParaTarefa({
    categoria: "ATUALIZAÇÃO PROCESSUAL",
    descricao: "Ler as movimentações e atualizar o cliente sobre o processo",
    setor_executor: "Processual",
  });
  assert.equal(primeiro.id, "treinamento-processual");
});

test("recomenda script de atendimento para abertura de grupo", () => {
  const [primeiro] = recomendarTreinamentosParaTarefa({
    categoria: "ABRIR GRUPO NO WHATSAPP",
    descricao: "Criar grupo e orientar o cliente",
    setor_executor: "Jurídico",
  });
  assert.equal(primeiro.id, "script-atendimento");
});

test("filtra a central por equipe e palavra-chave", () => {
  const resultados = filtrarTreinamentos({ busca: "certidão", equipe: "Administrativo" });
  assert.ok(resultados.some((item) => item.id === "esteira-adm-pdf"));
  assert.ok(resultados.every((item) => ["Administrativo", "Todas"].includes(item.equipe)));
});
