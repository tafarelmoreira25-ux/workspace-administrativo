import assert from "node:assert/strict";
import test from "node:test";
import {
  criarOpcoesIniciaisProcuracao,
  listarDocumentosProcuracao,
  mensagemConjuntoGerado,
} from "./procuracaoConjunto.js";

test("marca as duas declarações por padrão", () => {
  assert.deepEqual(criarOpcoesIniciaisProcuracao("2026-08-16"), {
    gerarHipossuficiencia: true,
    gerarIsencaoIrpf: true,
    exercicios: "2024, 2025 e 2026",
  });
});

test("sempre mantém a procuração no conjunto", () => {
  assert.deepEqual(
    listarDocumentosProcuracao({
      gerarHipossuficiencia: false,
      gerarIsencaoIrpf: false,
    }),
    ["procuracao"],
  );
});

test("inclui somente as declarações selecionadas", () => {
  assert.deepEqual(
    listarDocumentosProcuracao({
      gerarHipossuficiencia: true,
      gerarIsencaoIrpf: false,
    }),
    ["procuracao", "hipossuficiencia"],
  );
});

test("informa a quantidade de arquivos gerados", () => {
  assert.equal(
    mensagemConjuntoGerado(["procuracao", "hipossuficiencia", "isencao-irpf"]),
    "3 documentos do conjunto da Procuração gerados em PDFs separados!",
  );
});
