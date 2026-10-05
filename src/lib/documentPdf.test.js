import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { unzipSync, strFromU8, strToU8, zipSync } from "fflate";
import { PDFDocument, PDFPage } from "pdf-lib";
import { gerarPdfDoWordOficial } from "./wordModelLocalPdf.js";
import { gerarWordOficial } from "./wordTemplateDocx.js";
import { DOCUMENT_TEMPLATES } from "../config/documentTemplates.js";
import { gerarPdfModelo, pendenciaModeloOriginal } from "./documentPdf.js";

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

test("os três recibos geram uma página paisagem com assinatura azul e carimbo sem distorção", async () => {
  const fetchOriginal = globalThis.fetch;
  const drawImage = PDFPage.prototype.drawImage;
  const imagens = [];
  globalThis.fetch = async path => new Response(await readFile(new URL('../../public' + path, import.meta.url)));
  PDFPage.prototype.drawImage = function(image, options) {
    if (image.tipoDocumento) imagens.push({ image, options });
    return drawImage.call(this, image, options);
  };
  try {
    for (const modo of ["recibo-servicos-boleto", "recibo-servicos-cartao", "recibo-servicos-pix"]) {
      const modelo = DOCUMENT_TEMPLATES.find(m => m.modo === modo);
      assert.equal(pendenciaModeloOriginal(modelo), '');
      const pdf = await PDFDocument.load(await gerarPdfModelo(dadosTeste(modelo, 'feminino'), modelo));
      assert.equal(pdf.getPageCount(), 1, modo);
      assert.ok(pdf.getPage(0).getWidth() > pdf.getPage(0).getHeight());
    }
    assert.equal(imagens.filter(i => i.image.tipoDocumento === 'assinatura').length, 3);
    assert.equal(imagens.filter(i => i.image.tipoDocumento === 'carimbo').length, 3);
    for (const { image, options } of imagens) {
      assert.ok(image.width > 1000 && image.height > 1000);
      assert.ok(Math.abs(options.width / options.height - image.width / image.height) < .0001);
      assert.ok(options.y >= 0);
    }
  } finally { globalThis.fetch = fetchOriginal; PDFPage.prototype.drawImage = drawImage; }
});

test('distrato mantém três páginas de conteúdo e assinaturas nas duas colunas', async () => {
  const fetchOriginal = globalThis.fetch;
  const drawText = PDFPage.prototype.drawText;
  const rotulos = [];
  globalThis.fetch = async path => new Response(await readFile(new URL('../../public' + path, import.meta.url)));
  PDFPage.prototype.drawText = function(text, options) {
    if (text === 'CONTRATANTE' || text === 'CONTRATADA') rotulos.push({ text, x: options.x, y: options.y, page: this });
    return drawText.call(this, text, options);
  };
  try {
    const modelo = DOCUMENT_TEMPLATES.find(m => m.modo === 'distrato-com-multa');
    const pdf = await PDFDocument.load(await gerarPdfModelo(dadosTeste(modelo, 'feminino'), modelo));
    assert.equal(pdf.getPageCount(), 3);
    const contratante = rotulos.filter(t => t.text === 'CONTRATANTE').at(-1);
    const contratada = rotulos.filter(t => t.text === 'CONTRATADA').at(-1);
    assert.equal(contratante.page, contratada.page);
    assert.ok(contratada.x - contratante.x > 200);
    assert.ok(Math.abs(contratante.y - contratada.y) < 20);
  } finally { globalThis.fetch = fetchOriginal; PDFPage.prototype.drawText = drawText; }
});

test('cada seção conserva suas margens e volta à largura inteira depois das colunas', async () => {
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const secao = (left, cols = '') => `<w:sectPr><w:type w:val="continuous"/><w:pgSz w:w="12000" w:h="16000"/><w:pgMar w:top="800" w:left="${left}" w:right="800" w:bottom="800"/><w:cols ${cols}/></w:sectPr>`;
  const p = (text, section = '') => `<w:p><w:pPr>${section}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const bytes = zipSync({ 'word/document.xml': strToU8(`<w:document xmlns:w="${w}"><w:body>` +
    p('Principal', secao(1600)) + p('ColunaA') + p('ColunaB') + p('ColunaC') + p('ColunaD', secao(600, 'w:num="2" w:space="400"')) +
    p('Final') + secao(600) + '</w:body></w:document>') });
  const fetchOriginal = globalThis.fetch;
  const drawText = PDFPage.prototype.drawText;
  const textos = [];
  globalThis.fetch = async path => new Response(await readFile(new URL('../../public' + path, import.meta.url)));
  PDFPage.prototype.drawText = function(text, options) { textos.push({ text, ...options }); return drawText.call(this, text, options); };
  try {
    const pdf = await PDFDocument.load(await gerarPdfDoWordOficial(bytes));
    assert.equal(pdf.getPageCount(), 1);
    const find = text => textos.find(t => t.text === text);
    assert.equal(find('Principal').x, 80);
    assert.equal(find('ColunaA').x, 30);
    assert.equal(find('ColunaC').x, 305);
    assert.equal(find('ColunaA').y, find('ColunaC').y);
    assert.equal(find('Final').x, 30);
    assert.ok(find('Final').y < find('ColunaB').y);
  } finally { globalThis.fetch = fetchOriginal; PDFPage.prototype.drawText = drawText; }
});

test('substitui a assinatura de uma imagem composta sem apagar sua linha', async () => {
  const fetchOriginal = globalThis.fetch;
  const drawImage = PDFPage.prototype.drawImage;
  const drawLine = PDFPage.prototype.drawLine;
  const assinaturas = [], linhas = [];
  globalThis.fetch = async path => new Response(await readFile(new URL('../../public' + path, import.meta.url)));
  PDFPage.prototype.drawImage = function(image, options) {
    if (image.tipoDocumento === 'assinatura') assinaturas.push(options);
    return drawImage.call(this, image, options);
  };
  PDFPage.prototype.drawLine = function(options) { linhas.push(options); return drawLine.call(this, options); };
  try {
    const bytes = await readFile(new URL('../../public/modelos/termo-ciencia-autorizacao-seguranca.docx', import.meta.url));
    await gerarPdfDoWordOficial(bytes);
    assert.equal(assinaturas.length, 1);
    assert.ok(linhas.some(l => l.end.x - l.start.x > assinaturas[0].width * 2 && l.thickness > 0 && l.thickness < 1));
  } finally { globalThis.fetch = fetchOriginal; PDFPage.prototype.drawImage = drawImage; PDFPage.prototype.drawLine = drawLine; }
});

test('substitui Aptos ausente e fontes locais indisponíveis preservando as variantes', async () => {
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const bytes = zipSync({
    'word/document.xml': strToU8(`<w:document xmlns:w="${w}"><w:body><w:p>${['', '<w:b/>', '<w:i/>', '<w:b/><w:i/>'].map(estilo => `<w:r><w:rPr><w:rFonts w:ascii="Aptos"/>${estilo}<w:sz w:val="24"/></w:rPr><w:t>Texto </w:t></w:r>`).join('')}</w:p><w:sectPr/></w:body></w:document>`),
  });
  const fetchOriginal = globalThis.fetch;
  const drawText = PDFPage.prototype.drawText;
  const textos = [];
  globalThis.fetch = async path => String(path).includes('calibri')
    ? new Response('', { status: 404 })
    : new Response(await readFile(new URL('../../public' + path, import.meta.url)));
  PDFPage.prototype.drawText = function(texto, opcoes) {
    textos.push({ fonte: opcoes.font.name, tamanho: opcoes.size });
    return drawText.call(this, texto, opcoes);
  };
  try {
    const pdf = await PDFDocument.load(await gerarPdfDoWordOficial(bytes));
    assert.equal(pdf.getPageCount(), 1);
    assert.equal(textos.length, 4);
    assert.ok(textos.every(t => /Arial/i.test(t.fonte) && t.tamanho === 12));
    assert.match(textos[1].fonte, /Bold/);
    assert.match(textos[2].fonte, /Italic/);
    assert.match(textos[3].fonte, /BoldItalic/);
  } finally {
    globalThis.fetch = fetchOriginal;
    PDFPage.prototype.drawText = drawText;
  }
});

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
    exercicios: "2024, 2025 e 2026", responsavel: "Responsável de teste", dataEmissao: "2026-10-04",
    dataDocumento: "2026-10-04", parentesco: "mae",
    numeroParcela: "12", numeroParcelaExtenso: "doze", quantidadeParcelasExtenso: "doze", dataVencimento: "2026-10-10", numeroProcesso: "0000000-00.2026.8.26.0000",
    horarioAssinatura: "10:30", horarioTransacao: "10:15:30", generoTitularCartao: genero, generoTitularResidencia: genero,
  };
}

test("modelos preservam a estrutura original e geram PDF com fontes disponíveis", async (t) => {
  const fetchOriginal = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async (path) => {
    assert.ok(String(path).startsWith("/modelos/") || String(path).startsWith("/assets/fonts/") || String(path).startsWith("/assets/documentos/"), `Acesso externo inesperado: ${path}`);
    chamadas.push(path);
    const bytes = await readFile(new URL(`../../public${path}`, import.meta.url));
    return new Response(bytes);
  };
  try {
    assert.equal(DOCUMENT_TEMPLATES.length, 43);
    for (const modelo of DOCUMENT_TEMPLATES) {
      await t.test(modelo.nome, async () => {
        for (const genero of ["feminino", "masculino"]) {
          const dados = dadosTeste(modelo, genero);
          if (!modelo.templateDocx || modelo.revisaoWordPendente) {
            await assert.rejects(gerarPdfModelo(dados, modelo), /Geração bloqueada:/);
            continue;
          }
          const original = unzipSync(new Uint8Array(await readFile(new URL('../../public' + modelo.templateDocx, import.meta.url))));
          const copia = unzipSync((await gerarWordOficial(dados, modelo)).bytes);
          assert.deepEqual(Object.keys(copia).sort(), Object.keys(original).sort());
          for (const [path, bytes] of Object.entries(original)) {
            if (/^word\/.*\.xml$/i.test(path)) {
              assert.equal(estruturaSemTexto(copia[path]), estruturaSemTexto(bytes), path);
            } else {
              assert.deepEqual(copia[path], bytes, path);
            }
          }
          let pdfBytes;
          try {
            pdfBytes = await gerarPdfModelo(dados, modelo);
          } catch (error) {
            assert.match(error.message, /Geração bloqueada: o modelo declara/);
          }
          if (pdfBytes) {
            const pdf = await PDFDocument.load(pdfBytes);
            assert.ok(pdf.getPageCount() > 0);
          }
        }
      });
    }
    assert.ok(chamadas.length > 0);
  } finally { globalThis.fetch = fetchOriginal; }
});

function estruturaSemTexto(bytes) {
  const doc = new DOMParser().parseFromString(strFromU8(bytes), 'application/xml');
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  for (const node of Array.from(doc.getElementsByTagNameNS(ns, 't'))) node.textContent = '';
  for (const node of Array.from(doc.getElementsByTagNameNS(ns, 'highlight'))) {
    if (['yellow', 'FFFF00'].includes(node.getAttributeNS(ns, 'val'))) node.setAttributeNS(ns, 'w:val', 'none');
  }
  for (const node of Array.from(doc.getElementsByTagNameNS(ns, 'shd'))) {
    for (const attr of ['fill', 'color']) {
      if ((node.getAttributeNS(ns, attr) || '').toUpperCase() === 'FFFF00') node.setAttributeNS(ns, `w:${attr}`, 'auto');
    }
  }
  return new XMLSerializer().serializeToString(doc);
}

test('bloqueia modelos sem original mesmo quando existe gerador antigo', async () => {
  await assert.rejects(gerarPdfModelo({}, { nome: 'Modelo antigo', modo: 'citacao-judicial' }), /modelo original DOCX/);
});

test('modelo com original não exige liberação manual e pendências reais bloqueiam antes de carregar arquivos', async () => {
  const modelo = { templateDocx: '/modelos/teste.docx' };
  assert.equal(pendenciaModeloOriginal(modelo), '');
  assert.equal(pendenciaModeloOriginal({ ...modelo, validacaoVisualPdf: false }), '');
  assert.equal(pendenciaModeloOriginal({ ...modelo, validacaoVisualPdf: true }), '');
  assert.match(pendenciaModeloOriginal({ ...modelo, revisaoWordPendente: 'Mapeamento pendente' }), /Mapeamento pendente/);
  const fetchOriginal = globalThis.fetch;
  let acessos = 0;
  globalThis.fetch = async () => { acessos++; throw new Error('Carregamento indevido'); };
  try {
    await assert.rejects(gerarPdfModelo({}, { ...modelo, revisaoWordPendente: 'Mapeamento pendente' }), /Mapeamento pendente/);
    assert.equal(acessos, 0);
  } finally { globalThis.fetch = fetchOriginal; }
});

test('procuração e notificação antigas não estão disponíveis', () => {
  assert.ok(!DOCUMENT_TEMPLATES.some(m => ['procuracao', 'notificacao-extrajudicial'].includes(m.modo)));
});

test('converte Calibri Light real pelo tema, preserva itálico e tamanho e não desenha amarelo', async () => {
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const a = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const bytes = zipSync({
    'word/document.xml': strToU8(`<w:document xmlns:w="${w}"><w:body><w:p><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/><w:sz w:val="28"/><w:highlight w:val="yellow"/></w:rPr><w:t>Maria</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Calibri Light"/><w:i/><w:sz w:val="24"/></w:rPr><w:t>Silva</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440"/></w:sectPr></w:body></w:document>`),
    'word/theme/theme1.xml': strToU8(`<a:theme xmlns:a="${a}"><a:themeElements><a:fontScheme><a:minorFont><a:latin typeface="Calibri Light"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`),
  });
  const fetchOriginal = globalThis.fetch;
  const drawText = PDFPage.prototype.drawText;
  const drawRectangle = PDFPage.prototype.drawRectangle;
  const textos = [];
  const fundos = [];
  globalThis.fetch = async path => {
    assert.ok(String(path).startsWith('/assets/fonts/'));
    return new Response(await readFile(new URL('../../public' + path, import.meta.url)));
  };
  PDFPage.prototype.drawText = function (texto, opcoes) { textos.push({ texto, fonte: opcoes.font.name, tamanho: opcoes.size }); return drawText.call(this, texto, opcoes); };
  PDFPage.prototype.drawRectangle = function (opcoes) { fundos.push(opcoes); return drawRectangle.call(this, opcoes); };
  try {
    const pdf = await PDFDocument.load(await gerarPdfDoWordOficial(bytes));
    assert.equal(pdf.getPageCount(), 1);
    assert.equal(pdf.getPage(0).getWidth(), 11906 / 20);
    assert.equal(pdf.getPage(0).getHeight(), 16838 / 20);
    assert.deepEqual(textos.map(t => [t.texto, t.tamanho]), [['Maria', 14], ['Silva', 12]]);
    assert.match(textos[0].fonte, /Calibri.*Light/i);
    assert.match(textos[1].fonte, /Calibri.*Light.*Italic/i);
    assert.ok(!fundos.some(f => f.color?.red === 1 && f.color?.green === 1 && f.color?.blue === 0));
  } finally {
    globalThis.fetch = fetchOriginal;
    PDFPage.prototype.drawText = drawText;
    PDFPage.prototype.drawRectangle = drawRectangle;
  }
});


test('preserva espacos de assinatura, nota no corpo e marcador do DOCX', async () => {
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const paragrafo = texto => '<w:p><w:r><w:t>' + texto + '</w:t></w:r></w:p>';
  const bytes = zipSync({
    'word/document.xml': strToU8('<w:document xmlns:w="' + w + '"><w:body>' +
      paragrafo('\u25cf Primeiro') + paragrafo('') + paragrafo('') + paragrafo('') +
      paragrafo('____________') + paragrafo('Documento emitido em teste') +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440"/></w:sectPr></w:body></w:document>'),
    'word/styles.xml': strToU8('<w:styles xmlns:w="' + w + '"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri Light"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>'),
  });
  const fetchOriginal = globalThis.fetch;
  const drawText = PDFPage.prototype.drawText;
  const textos = [];
  globalThis.fetch = async path => new Response(await readFile(new URL('../../public' + path, import.meta.url)));
  PDFPage.prototype.drawText = function(texto, opcoes) {
    textos.push({ texto, y: opcoes.y });
    return drawText.call(this, texto, opcoes);
  };
  try {
    await gerarPdfDoWordOficial(bytes);
    assert.equal(textos[0].texto, '\u25cf');
    const assinatura = textos.find(t => t.texto === '____________');
    assert.ok(Math.abs(textos[0].y - assinatura.y - 4 * 11 * 1.15) < .01);
    const nota = textos.find(t => t.texto === 'Documento');
    assert.ok(Math.abs(assinatura.y - nota.y - 11 * 1.15) < .01);
  } finally {
    globalThis.fetch = fetchOriginal;
    PDFPage.prototype.drawText = drawText;
  }
});


test('respeita familias diferentes e variantes do original sem exigir Calibri Light', async () => {
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const bytes = zipSync({
    'word/document.xml': strToU8('<w:document xmlns:w="' + w + '"><w:body><w:p>' +
      '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t>Maria </w:t></w:r>' +
      '<w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:b/><w:i/><w:sz w:val="20"/></w:rPr><w:t>Silva</w:t></w:r>' +
      '</w:p><w:sectPr/></w:body></w:document>'),
  });
  const fetchOriginal = globalThis.fetch;
  const drawText = PDFPage.prototype.drawText;
  const textos = [];
  const acessos = [];
  globalThis.fetch = async path => {
    acessos.push(path);
    return new Response(await readFile(new URL('../../public' + path, import.meta.url)));
  };
  PDFPage.prototype.drawText = function(texto, opcoes) {
    textos.push({ texto, fonte: opcoes.font.name, tamanho: opcoes.size });
    return drawText.call(this, texto, opcoes);
  };
  try {
    await gerarPdfDoWordOficial(bytes);
    assert.match(textos[0].fonte, /TimesNewRoman/i);
    assert.match(textos[1].fonte, /Arial.*BoldItalic/i);
    assert.deepEqual(textos.map(t => t.tamanho), [12, 10]);
    assert.equal(acessos.length, 2);
    assert.ok(acessos.every(p => !p.includes('calibri')));
  } finally {
    globalThis.fetch = fetchOriginal;
    PDFPage.prototype.drawText = drawText;
  }
});
