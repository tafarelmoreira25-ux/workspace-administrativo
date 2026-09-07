import test from "node:test";
import assert from "node:assert/strict";
import {
  filtrarTreinamentos,
} from "./trainingResources.js";

test("filtra a central por equipe e palavra-chave", () => {
  const resultados = filtrarTreinamentos({ busca: "certidão", equipe: "Administrativo" });
  assert.ok(resultados.some((item) => item.id === "esteira-adm-pdf"));
  assert.ok(resultados.every((item) => ["Administrativo", "Todas"].includes(item.equipe)));
});
