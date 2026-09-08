import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { gerarRelatorioAtualizacaoProcessualDocx } from "./relatorioProcessualDocx.js";

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function entradasZip(bytes) {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (readU32(bytes, i) === 0x06054b50) { eocd = i; break; }
  }
  assert.notEqual(eocd, -1, "DOCX gerado deve conter diretório ZIP válido");

  const total = readU16(bytes, eocd + 10);
  let cursor = readU32(bytes, eocd + 16);
  const resultado = new Map();

  for (let i = 0; i < total; i += 1) {
    assert.equal(readU32(bytes, cursor), 0x02014b50);
    const metodo = readU16(bytes, cursor + 10);
    const tamanhoCompactado = readU32(bytes, cursor + 20);
    const nomeTamanho = readU16(bytes, cursor + 28);
    const extraTamanho = readU16(bytes, cursor + 30);
    const comentarioTamanho = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    const nome = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nomeTamanho));
    const localNomeTamanho = readU16(bytes, localOffset + 26);
    const localExtraTamanho = readU16(bytes, localOffset + 28);
    const inicio = localOffset + 30 + localNomeTamanho + localExtraTamanho;
    const compactado = bytes.slice(inicio, inicio + tamanhoCompactado);
    const conteudo = metodo === 8 ? inflateRawSync(compactado) : compactado;
    resultado.set(nome, new TextDecoder().decode(conteudo));
    cursor += 46 + nomeTamanho + extraTamanho + comentarioTamanho;
  }

  return resultado;
}

test("gera relatório sem amarelo, sem placeholders e com assinatura próxima ao conteúdo", async () => {
  const template = await readFile(new URL("../../public/modelos/relatorio-atualizacao-processual.docx", import.meta.url));
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => new Response(template);

  try {
    const bytes = await gerarRelatorioAtualizacaoProcessualDocx({
      dataEmissao: "2026-09-08",
      numeroDocumento: "REL-VALIDACAO-001",
      numeroProcesso: "1234567-89.2026.8.26.0001",
      autorNome: "Cliente de Teste",
      reuNome: "Instituição de Teste",
      statusLabel: "Em andamento",
      statusDescricao: "Processo em acompanhamento.",
      ultimaMovimentacao: "Petição juntada.",
    });
    const arquivos = entradasZip(bytes);
    const documento = arquivos.get("word/document.xml");
    const rodape = arquivos.get("word/footer1.xml");
    const relacionamentos = arquivos.get("word/_rels/document.xml.rels");

    assert.ok(documento);
    assert.ok(rodape);
    assert.ok(relacionamentos);
    assert.doesNotMatch(`${documento}${rodape}`, /\{\{[^}]+\}\}/);
    assert.doesNotMatch(`${documento}${rodape}`, /<w:highlight\b/);
    assert.match(rodape, /08\/09\/2026/);
    assert.match(rodape, /REL-VALIDACAO-001/);
    assert.doesNotMatch(rodape, /<w:drawing>/);
    assert.match(documento, /name="Assinatura Platino"/);
    assert.match(documento, /<a:lum bright="0" contrast="30000"\/>/);
    assert.match(documento, /w:bottom="900"/);
    assert.match(relacionamentos, /Target="media\/image1\.png"/);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
