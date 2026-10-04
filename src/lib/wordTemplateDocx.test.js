import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { gerarWordOficial } from "./wordTemplateDocx.js";

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;

test("a procuração preenche os runs e retira o amarelo sem alterar a formatação restante", async () => {
  const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const original = `<w:document xmlns:w="${ns}"><w:body><w:p><w:pPr><w:jc w:val="both"/><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">OUTORGANTE: </w:t></w:r><w:r><w:rPr><w:highlight w:val="yellow"/><w:sz w:val="24"/></w:rPr><w:t>XXXXXXXXX</w:t></w:r><w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>XXXXXXXXX</w:t></w:r><w:r><w:t>, texto fixo.</w:t></w:r></w:p></w:body></w:document>`;
  const estilos = strToU8(`<w:styles xmlns:w="${ns}"><w:style w:styleId="Campo"><w:rPr><w:highlight w:val="yellow"/><w:shd w:val="clear" w:fill="FFFF00"/><w:color w:val="FF0000"/></w:rPr></w:style></w:styles>`);
  const imagem = new Uint8Array([1, 2, 3]);
  const bytes = zipSync({ "word/document.xml": strToU8(original), "word/styles.xml": estilos, "word/media/logo.png": imagem });
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => new Response(bytes);
  try {
    const resultado = await gerarWordOficial({ nomeCliente: "Maria Silva" }, { modo: "procuracao", templateDocx: "/modelos/teste.docx" });
    const arquivos = unzipSync(resultado.bytes);
    const doc = new DOMParser().parseFromString(strFromU8(arquivos["word/document.xml"]), "application/xml");
    const runs = Array.from(doc.getElementsByTagNameNS(ns, "r"));
    assert.equal(runs[0].textContent, "OUTORGANTE: ");
    assert.equal(runs[0].getElementsByTagNameNS(ns, "b").length, 1);
    assert.equal(runs[1].textContent, "Maria Silva");
    assert.equal(runs[1].getElementsByTagNameNS(ns, "b").length, 0);
    assert.equal(runs[1].getElementsByTagNameNS(ns, "highlight")[0].getAttributeNS(ns, "val"), "none");
    assert.equal(runs[1].getElementsByTagNameNS(ns, "sz")[0].getAttributeNS(ns, "val"), "24");
    assert.equal(runs[3].textContent, ", texto fixo.");
    const estilosFinais = strFromU8(arquivos["word/styles.xml"]);
    assert.match(estilosFinais, /w:highlight w:val="none"/);
    assert.match(estilosFinais, /w:shd w:val="clear" w:fill="auto"/);
    assert.match(estilosFinais, /w:color w:val="FF0000"/);
    assert.match(strFromU8(unzipSync(bytes)["word/styles.xml"]), /w:highlight w:val="yellow"/);
    assert.deepEqual(arquivos["word/media/logo.png"], imagem);
    assert.match(strFromU8(arquivos["word/document.xml"]), /w:jc w:val="both"/);
    assert.match(strFromU8(arquivos["word/document.xml"]), /w:spacing w:after="160"/);
  } finally { globalThis.fetch = fetchOriginal; }
});
