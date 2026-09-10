import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { gerarRelatorioAtualizacaoProcessualPdf } from "./relatorioAtualizacaoProcessualPdf.js";

test("gera relatório processual em PDF A4 com paginação natural", async () => {
  const bytes = await gerarRelatorioAtualizacaoProcessualPdf({
    numeroProcesso: "1012345-00.2026.8.00.0000",
    autorNome: "Humberto Pereira Beltran",
    reuNome: "Instituição financeira",
    statusLabel: "Tramitando",
    statusDescricao: "Processo em acompanhamento.",
    ultimaMovimentacao: "Publicação registrada para análise.",
    proximosPassos: "Elaborar manifestação.",
  });
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 1);
  for (const pagina of pdf.getPages()) {
    const { width, height } = pagina.getSize();
    assert.ok(Math.abs(width - 595.28) < 0.1);
    assert.ok(Math.abs(height - 841.89) < 0.1);
  }
});
