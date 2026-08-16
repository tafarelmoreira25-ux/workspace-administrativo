import assert from "node:assert/strict";
import test from "node:test";
import { DOCUMENT_TEMPLATES, valorInicialCampo } from "../config/documentTemplates.js";
import {
  agruparCampos,
  enriquecerModelos,
  erroCampo,
  filtrarModelos,
  normalizarNomeArquivo,
  sugerirNomeDocumento,
} from "./documentWorkspace.js";

const modelos = enriquecerModelos(DOCUMENT_TEMPLATES);

test("organiza todos os modelos na biblioteca jurídica", () => {
  assert.equal(modelos.length, DOCUMENT_TEMPLATES.length);
  assert.ok(modelos.every((modelo) => modelo.categoria && modelo.categoriaNome));
});

test("filtra modelos por finalidade sem depender de acentos", () => {
  const encontrados = filtrarModelos(modelos, {
    busca: "revisao contratual",
    categoria: "todos",
    favoritos: [],
    recentes: [],
  });
  assert.ok(encontrados.some((modelo) => modelo.modo === "procuracao"));
});

test("gera nome legível e arquivo técnico seguro", () => {
  const modelo = modelos.find((item) => item.modo === "procuracao");
  const nome = sugerirNomeDocumento(
    modelo,
    { nomeCliente: "João da Silva", numeroContrato: "45872", dataEmissao: "2026-08-16" },
    { tipo: true, cliente: true, contrato: true, processo: false, cpf: false, data: true, numero: false, versao: true },
    "20260816-12345",
    1,
  );
  assert.match(nome, /João da Silva/);
  assert.equal(normalizarNomeArquivo(nome), "Procuracao_para_Acao_Revisional_Joao_da_Silva_Contrato_45872_16-08-2026.pdf");
});

test("agrupa os campos obrigatórios em seções reutilizáveis", () => {
  const modelo = modelos.find((item) => item.modo === "procuracao");
  const grupos = agruparCampos(modelo.campos);
  assert.ok(grupos.some((grupo) => grupo.id === "pessoais"));
  assert.equal(grupos.flatMap((grupo) => grupo.campos).length, modelo.campos.length);
});

test("deixa a nacionalidade em branco e mantém o órgão expedidor junto do RG", () => {
  const modelo = modelos.find((item) => item.modo === "procuracao");
  const grupos = agruparCampos(modelo.campos);
  const pessoais = grupos.find((grupo) => grupo.id === "pessoais");
  assert.equal(valorInicialCampo({ nome: "nacionalidade" }), "");
  assert.ok(pessoais.campos.some((campo) => campo.nome === "rg"));
  assert.ok(pessoais.campos.some((campo) => campo.nome === "orgaoExpedidor"));
});

test("valida CPF incompleto com mensagem específica", () => {
  assert.equal(
    erroCampo({ nome: "cpfCnpj", rotulo: "CPF", obrigatorio: true }, "123"),
    "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.",
  );
});
