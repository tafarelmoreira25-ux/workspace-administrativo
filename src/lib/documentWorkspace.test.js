import assert from "node:assert/strict";
import test from "node:test";
import { DOCUMENT_TEMPLATES, valorInicialCampo } from "../config/documentTemplates.js";
import {
  agruparCampos,
  enriquecerModelos,
  erroCampo,
  filtrarModelos,
  enderecoCompletoComCep,
  listarConflitosFixos,
  normalizarNomeArquivo,
  rascunhoValido,
  sugerirNomeDocumento,
} from "./documentWorkspace.js";

const modelos = enriquecerModelos(DOCUMENT_TEMPLATES);

test("organiza todos os modelos na biblioteca jurídica", () => {
  assert.equal(modelos.length, DOCUMENT_TEMPLATES.length);
  assert.ok(modelos.every((modelo) => modelo.categoria && modelo.categoriaNome));
});

test("todos os modelos são entregues em PDF", () => {
  assert.ok(modelos.every((modelo) => modelo.formato !== "docx"));
});

test("o conjunto da procuração usa cada modelo oficial correto", () => {
  assert.equal(
    modelos.find((modelo) => modelo.modo === "procuracao").templateDocx,
    "/modelos/procuracoes/procuracao-ad-judicia-2026.docx",
  );
  assert.equal(
    modelos.find((modelo) => modelo.modo === "declaracao-hipossuficiencia").templateDocx,
    "/modelos/declaracoes/declaracao-hipossuficiencia-2026.docx",
  );
  assert.equal(
    modelos.find((modelo) => modelo.modo === "declaracao-isencao-irpf").templateDocx,
    "/modelos/declaracoes/declaracao-isencao-irpf-2026.docx",
  );
  assert.equal(
    modelos.find((modelo) => modelo.modo === "requerimento-postergacao-parcela").templateDocx,
    "/modelos/requerimentos/requerimento-postergacao-parcela-2026.docx",
  );
});

test("bloqueia dados que contradizem textos fixos dos modelos oficiais", () => {
  const requerimento = modelos.find((modelo) => modelo.modo === "requerimento-postergacao-parcela");
  assert.equal(listarConflitosFixos(requerimento, {
    numeroParcela: "10",
    dataVencimento: "2027-01-10",
    dataDocumento: "2026-10-04",
  }).length, 1);
  assert.equal(listarConflitosFixos(requerimento, {
    numeroParcela: "10",
    dataVencimento: "2026-01-10",
    dataDocumento: "2026-10-04",
  }).length, 0);

  const irpf = modelos.find((modelo) => modelo.modo === "declaracao-isencao-irpf");
  assert.equal(listarConflitosFixos(irpf, {
    exercicios: "2023, 2024 e 2025",
    dataDocumento: "2025-10-04",
  }).length, 0);
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

test("mantém somente rascunhos com menos de 24 horas", () => {
  const agora = new Date("2026-08-17T12:00:00.000Z").getTime();
  const base = {
    schema: 2,
    dados: { modeloId: "procuracao-ad-judicia" },
  };
  assert.equal(
    rascunhoValido({ ...base, salvoEm: "2026-08-16T12:00:01.000Z" }, agora),
    true,
  );
  assert.equal(
    rascunhoValido({ ...base, salvoEm: "2026-08-16T12:00:00.000Z" }, agora),
    false,
  );
});

test("reutiliza o CEP da procuração nas declarações sem duplicá-lo", () => {
  assert.equal(
    enderecoCompletoComCep({ endereco: "Rua das Flores, 100", cep: "01234-567" }),
    "Rua das Flores, 100 - CEP: 01234-567",
  );
  assert.equal(
    enderecoCompletoComCep({ endereco: "Rua das Flores, 100 - CEP: 01234-567", cep: "01234-567" }),
    "Rua das Flores, 100 - CEP: 01234-567",
  );
});
