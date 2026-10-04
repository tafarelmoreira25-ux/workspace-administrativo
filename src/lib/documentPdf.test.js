import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { PDFDocument, PDFPage } from "pdf-lib";
import { DOCUMENT_TEMPLATES } from "../config/documentTemplates.js";
import { gerarPdfModelo } from "./documentPdf.js";

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

function dadosTeste(modelo, genero) {
  const dados = Object.fromEntries(modelo.campos.map((c) => [c.nome,
    c.tipo === "date" ? "2026-10-04" : c.tipo === "number" ? "12" : c.tipo === "select" ? c.opcoes[0].valor :
      /cpf/i.test(c.nome) ? "123.456.789-09" : /cnpj/i.test(c.nome) ? "12.345.678/0001-90" :
        /extenso/i.test(c.nome) ? "mil duzentos e cinquenta reais" : /valor|total|saldo|reducao/i.test(c.nome) ? "1.250,00" : "Informação de teste",
  ]));
  return {
    ...dados, genero, nomeCliente: "Alexandra Maria de Souza Albuquerque", nomeContratante: "Alexandra Maria de Souza Albuquerque",
    nacionalidade: "brasileira", estadoCivil: "solteira", profissao: "advogada", email: "teste@example.com",
    rg: "12.345.678-9", orgaoExpedidor: "SSP/SP", cep: "01001-000", cidade: "São Paulo", uf: "SP",
    cidadeEstado: "São Paulo/SP", localEmissao: "São Paulo/SP", banco: "Banco de Teste",
    exercicios: "2023, 2024 e 2025", responsavel: "Responsável de teste", dataEmissao: "2026-10-04",
    dataDocumento: modelo.modo === "declaracao-isencao-irpf" ? "2025-10-04" : "2026-10-04",
    numeroParcela: "12", numeroParcelaExtenso: "doze", quantidadeParcelasExtenso: "doze", dataVencimento: "2026-10-10", numeroProcesso: "0000000-00.2026.8.26.0000",
    horarioAssinatura: "10:30",
  };
}

test("todos os 40 modelos geram PDF local sem acessar serviços externos", async (t) => {
  const fetchOriginal = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async (path) => {
    assert.ok(String(path).startsWith("/modelos/"), `Acesso externo inesperado: ${path}`);
    chamadas.push(path);
    const bytes = await readFile(new URL(`../../public${path}`, import.meta.url));
    return new Response(bytes);
  };
  try {
    assert.equal(DOCUMENT_TEMPLATES.length, 40);
    for (const modelo of DOCUMENT_TEMPLATES) {
      await t.test(modelo.nome, async () => {
        for (const genero of ["feminino", "masculino"]) {
          const bytes = await gerarPdfModelo(dadosTeste(modelo, genero), modelo);
          assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
          const pdf = await PDFDocument.load(bytes);
          assert.ok(pdf.getPageCount() > 0);
          assert.ok(pdf.getPages().every((p) => p.getWidth() > 0 && p.getHeight() > 0));
        }
      });
    }
    assert.ok(chamadas.length > 0);
  } finally { globalThis.fetch = fetchOriginal; }
});

test("o PDF preserva texto preenchido, concordância e parcelas repetidas sem rasterizar páginas", async () => {
  const modelo = DOCUMENT_TEMPLATES.find((m) => m.modo === "requerimento-postergacao-parcela");
  const fetchOriginal = globalThis.fetch;
  const drawOriginal = PDFPage.prototype.drawText;
  const textos = [];
  globalThis.fetch = async (path) => new Response(await readFile(new URL(`../../public${path}`, import.meta.url)));
  PDFPage.prototype.drawText = function (texto, opts) { textos.push(texto); return drawOriginal.call(this, texto, opts); };
  try {
    const bytes = await gerarPdfModelo(dadosTeste(modelo, "feminino"), modelo);
    const conteudo = textos.join(" ");
    assert.match(conteudo, /Alexandra Maria de Souza Albuquerque/i);
    assert.match(conteudo, /DEVEDORA/);
    assert.ok((conteudo.match(/12/g) || []).length >= 3);
    assert.doesNotMatch(conteudo, /XXX{3}|\[NOME|\[CPF/);
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 2, "O requerimento e o termo devem manter duas páginas com ambas as assinaturas.");
    assert.ok(textos.length > 100, "O documento precisa conter texto PDF, não uma imagem da página.");
  } finally { globalThis.fetch = fetchOriginal; PDFPage.prototype.drawText = drawOriginal; }
});
