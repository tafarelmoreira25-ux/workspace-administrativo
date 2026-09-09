import test from "node:test";
import assert from "node:assert/strict";
import {
  criarDescricaoHistoricoEmail,
  criarRascunhoEmail,
  criarUrlComposicaoGmail,
} from "./emailWorkspace.js";

test("cria rascunho com cliente e processo sem inventar dados", () => {
  const rascunho = criarRascunhoEmail({
    modeloId: "atualizacao",
    cliente: { nome_completo: "Maria da Silva" },
    processo: { numero_processo: "1234567-89.2026.8.26.0001" },
  });

  assert.match(rascunho.assunto, /1234567-89\.2026\.8\.26\.0001/);
  assert.match(rascunho.corpo, /Maria da Silva/);
  assert.match(rascunho.corpo, /\[Descreva aqui/);
});

test("mantém campos ausentes em aberto", () => {
  const rascunho = criarRascunhoEmail({ modeloId: "audiencia", cliente: {}, processo: null });
  assert.equal(rascunho.assunto, "Informações sobre audiência");
  assert.match(rascunho.corpo, /Data: \[preencher\]/);
  assert.doesNotMatch(rascunho.corpo, /undefined|null/);
});

test("gera URL segura para a composição no Gmail", () => {
  const url = new URL(criarUrlComposicaoGmail({
    destinatario: "cliente@example.com",
    assunto: "Atualização & retorno",
    corpo: "Olá, tudo bem?",
  }));
  assert.equal(url.hostname, "mail.google.com");
  assert.equal(url.searchParams.get("to"), "cliente@example.com");
  assert.equal(url.searchParams.get("su"), "Atualização & retorno");
  assert.equal(url.searchParams.get("body"), "Olá, tudo bem?");
});

test("limita o texto salvo no histórico", () => {
  const descricao = criarDescricaoHistoricoEmail({ assunto: "Teste", corpo: "a".repeat(13000) });
  assert.equal(descricao.length, 12000);
});
