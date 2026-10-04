import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { unzipSync, strFromU8 } from "fflate";
import { UPDATED_DOCUMENT_MODELS } from "../config/updatedDocumentModels.js";
import { DOCUMENT_TEMPLATES } from "../config/documentTemplates.js";
import { enriquecerModelos } from "./documentWorkspace.js";
import { gerarWordOficial } from "./wordTemplateDocx.js";
import { gerarPdfDoWordOficial } from "./wordModelLocalPdf.js";
import { PDFDocument } from "pdf-lib";

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const perfil = {
  nomeCliente: "Alexandra Maria de Souza Albuquerque dos Santos", nacionalidade: "brasileiro",
  estadoCivil: "casado", profissao: "advogado", cpfCnpj: "123.456.789-09", rg: "12.345.678-9",
  email: "cliente@example.com", endereco: "Rua das Flores, 123, Centro, São Paulo/SP",
  cep: "01001-000", cidade: "São Paulo", uf: "SP", bairro: "Centro", localEmissao: "São Paulo/SP",
  dataDocumento: "2026-10-04", dataEmissao: "2025-10-04", banco: "Banco Exemplo", numeroContrato: "987654",
  orgaoExpedidor: "SSP/SP", exercicios: "2023, 2024 e 2025", parentesco: "mae",
  nomeTitularComprovante: "Titular do Comprovante", cpfTitularComprovante: "987.654.321-00",
};
const textoDoc = (bytes) => Array.from(new DOMParser().parseFromString(strFromU8(unzipSync(bytes)["word/document.xml"]), "application/xml")
  .getElementsByTagNameNS(W, "p")).map(p => Array.from(p.getElementsByTagNameNS(W, "t")).map(n => n.textContent).join("")).join("\n");
function estrutura(bytes) {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
  for (const n of Array.from(doc.getElementsByTagNameNS(W, "t"))) n.textContent = "";
  for (const n of Array.from(doc.getElementsByTagNameNS(W, "highlight"))) {
    if (["yellow", "FFFF00"].includes(n.getAttributeNS(W, "val"))) n.setAttributeNS(W, "w:val", "none");
  }
  for (const n of Array.from(doc.getElementsByTagNameNS(W, "shd"))) {
    for (const atributo of ["fill", "color"]) {
      if ((n.getAttributeNS(W, atributo) || "").toUpperCase() === "FFFF00") n.setAttributeNS(W, `w:${atributo}`, "auto");
    }
  }
  return new XMLSerializer().serializeToString(doc);
}

test("os quatro modelos atualizados preservam os originais e preenchem os campos reais", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    if (String(path).startsWith("/modelos/")) assert.equal(options.cache, "no-store");
    return new Response(await readFile(new URL(`../../public${path}`, import.meta.url)));
  };
  try {
    for (const [modo, registro] of Object.entries(UPDATED_DOCUMENT_MODELS)) {
      const original = await readFile(new URL(`../../public${registro.templateDocx}`, import.meta.url));
      const arquivoPreservado = await readFile(new URL(`../../modelos-originais/atualizados-2026-10-04/${registro.templateDocx.split("/").at(-1).replace("-atualizado-2026-10-04", "")}`, import.meta.url));
      assert.deepEqual(original, arquivoPreservado);
      assert.equal(createHash("sha256").update(original).digest("hex"), registro.templateSha256);
      const modelo = modo === "procuracao" ? { modo, ...registro } : DOCUMENT_TEMPLATES.find(m => m.modo === modo);
      assert.equal(modelo.templateDocx, registro.templateDocx);
      for (const genero of ["feminino", "masculino"]) {
        const { bytes } = await gerarWordOficial({ ...perfil, genero }, modelo);
        const texto = textoDoc(bytes);
        assert.ok(texto.includes(perfil.nomeCliente), modo);
        assert.ok(texto.includes(perfil.cpfCnpj), modo);
        assert.ok(texto.includes(perfil.rg), modo);
        assert.ok(texto.includes(perfil.endereco), modo);
        assert.doesNotMatch(texto, /X{3,}|\[[^\]]+\]|Nome do titular(?! do comprovante)|Nome Completo Do Cliente/);
        assert.match(texto, genero === "feminino" ? /portadora/ : /portador/);
        const pacote = unzipSync(bytes);
        for (const [path, conteudo] of Object.entries(unzipSync(original))) {
          if (/^word\/.*\.xml$/i.test(path)) assert.equal(estrutura(pacote[path]), estrutura(conteudo), path);
          else assert.deepEqual(pacote[path], conteudo, path);
        }
        if (modo === "procuracao") {
          assert.match(texto, /Juliana Cristina Galzo/);
          assert.match(texto, /Banco Exemplo/);
          assert.match(texto, /987654/);
          assert.match(texto, /4 de outubro de 2025/);
          const pdf = await PDFDocument.load(await gerarPdfDoWordOficial(bytes));
          assert.ok(pdf.getPageCount() > 0);
        } else if (modo === "declaracao-isencao-comprovante-endereco") {
          assert.match(texto, /\( X \) Mãe/);
          assert.match(texto, /Nome do titular do comprovante: Titular do Comprovante/);
          assert.match(texto, /CPF do titular do comprovante: 987\.654\.321-00/);
          assert.equal((texto.match(/_{3,}/g) || []).length, 1, "somente a linha de assinatura permanece");
        } else if (modo === "declaracao-isencao-irpf") {
          assert.match(texto, /4 DE OUTUBRO DE 2026/);
          assert.match(texto, genero === "feminino" ? /Declara ser isenta da/ : /Declara ser isento da/);
          assert.match(texto, /2023, 2024 e 2025/);
        }
      }
    }
    for (const modo of ["declaracao-isencao-comprovante-endereco", "declaracao-ausencia-carteira-trabalho"]) {
      assert.equal(enriquecerModelos(DOCUMENT_TEMPLATES).find(m => m.modo === modo).categoria, "declaracoes");
    }
  } finally { globalThis.fetch = fetchOriginal; }
});

test("bloqueia arquivo antigo, campos ausentes e data contraditória", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]));
  try {
    await assert.rejects(gerarWordOficial(perfil, { modo: "procuracao", ...UPDATED_DOCUMENT_MODELS.procuracao }), /diverge do modelo atualizado/);
    const modelo = DOCUMENT_TEMPLATES.find(m => m.modo === "declaracao-isencao-irpf");
    await assert.rejects(gerarWordOficial({ ...perfil, genero: "feminino", dataDocumento: "2025-10-04" }, modelo), /termina em 2026/);
    await assert.rejects(gerarWordOficial({}, modelo), /campos obrigatórios/);
    const endereco = DOCUMENT_TEMPLATES.find(m => m.modo === "declaracao-isencao-comprovante-endereco");
    await assert.rejects(gerarWordOficial({ ...perfil, genero: "feminino", parentesco: "outro" }, endereco), /campo Outro/);
  } finally { globalThis.fetch = fetchOriginal; }
});
