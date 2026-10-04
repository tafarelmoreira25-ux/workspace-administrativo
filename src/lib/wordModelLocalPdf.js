import { unzipSync } from "fflate";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { DOCUMENT_FONTS } from "../config/documentFonts.js";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const EMU = 12700;
const texto = (bytes) => new TextDecoder().decode(bytes);
const numero = (v, fallback = 0) => v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback;
const filhos = (n, nome) => Array.from(n?.childNodes || []).filter((c) => c.namespaceURI === W && (!nome || c.localName === nome));
const primeiro = (n, nome, ns = W) => n?.getElementsByTagNameNS(ns, nome)[0];
const atributo = (n, nome, ns = W) => n?.getAttributeNS(ns, nome) || n?.getAttribute(nome) || "";
const val = (n, nome) => atributo(primeiro(n, nome), "val");
const ligada = (n) => n && !["0", "false", "off", "none"].includes(atributo(n, "val"));
const cor = (hex = "000000") => /^[a-f\d]{6}$/i.test(hex) ? rgb(...[0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)) : rgb(0, 0, 0);

function xml(arquivos, caminho) {
  if (!arquivos[caminho]) return null;
  const doc = new DOMParser().parseFromString(texto(arquivos[caminho]), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error(`XML inválido: ${caminho}.`);
  // Choice e Fallback descrevem o mesmo objeto em formatos diferentes.
  const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
  for (const n of Array.from(doc.getElementsByTagNameNS(MC, "AlternateContent"))) {
    if (n.getElementsByTagNameNS(MC, "Choice").length) {
      for (const fallback of Array.from(n.getElementsByTagNameNS(MC, "Fallback"))) fallback.parentNode.removeChild(fallback);
    }
  }
  return doc;
}

function relacoes(arquivos, parte) {
  const pasta = parte.split("/").slice(0, -1).join("/");
  const doc = xml(arquivos, `${pasta}/_rels/${parte.split("/").at(-1)}.rels`);
  return new Map(Array.from(doc?.getElementsByTagNameNS(REL, "Relationship") || [])
    .filter((n) => n.getAttribute("TargetMode") !== "External")
    .map((n) => {
      const target = n.getAttribute("Target");
      const path = target.startsWith("/") ? [] : parte.split("/").slice(0, -1);
      for (const p of target.split("/")) {
        if (p === "..") path.pop(); else if (p && p !== ".") path.push(p);
      }
      return [n.getAttribute("Id"), path.join("/")];
    }));
}

function formatoTexto(node, base = {}, tema = {}) {
  const result = { ...base };
  const f = primeiro(node, "rFonts");
  if (f) result.familia = tema[atributo(f, "asciiTheme") || atributo(f, "hAnsiTheme")] || atributo(f, "ascii") || atributo(f, "hAnsi") || base.familia;
  if (primeiro(node, "sz")) result.tamanho = numero(val(node, "sz"), 22) / 2;
  for (const [tag, key] of [["b", "negrito"], ["i", "italico"], ["u", "sublinhado"], ["strike", "riscado"]]) {
    if (primeiro(node, tag)) result[key] = Boolean(ligada(primeiro(node, tag)));
  }
  if (primeiro(node, "color")) result.cor = val(node, "color");
  if (primeiro(node, "highlight")) result.destaque = val(node, "highlight");
  if (primeiro(node, "shd")) result.fundo = atributo(primeiro(node, "shd"), "fill");
  return result;
}

function estilosDoModelo(arquivos) {
  const doc = xml(arquivos, "word/styles.xml");
  const temaDoc = xml(arquivos, "word/theme/theme1.xml");
  const tema = {};
  for (const tipo of ["major", "minor"]) {
    const fonte = atributo(primeiro(primeiro(temaDoc, `${tipo}Font`, A), "latin", A), "typeface", A);
    for (const sufixo of ["Ascii", "HAnsi"]) tema[`${tipo}${sufixo}`] = fonte;
  }
  const estilos = new Map(Array.from(doc?.getElementsByTagNameNS(W, "style") || []).map((n) => [atributo(n, "styleId"), n]));
  const resolver = (id, vistos = new Set()) => {
    const n = estilos.get(id);
    if (!n || vistos.has(id)) return [];
    vistos.add(id); return [...resolver(val(n, "basedOn"), vistos), n];
  };
  return {
    padrao: primeiro(doc, "docDefaults"), resolver, tema,
    normal: Array.from(estilos.values()).find((n) => atributo(n, "type") === "paragraph" && atributo(n, "default") === "1"),
  };
}

function lerParagrafo(node, estilos) {
  const pPr = filhos(node, "pPr")[0];
  const cadeia = [estilos.padrao, ...estilos.resolver(atributo(estilos.normal, "styleId")), ...estilos.resolver(val(pPr, "pStyle")), node];
  let base = { tamanho: 11, familia: "", cor: "000000" };
  const props = { alinhamento: "left", antes: 0, depois: 0, esquerda: 0, direita: 0, primeira: 0, linha: 1.15 };
  for (const parte of cadeia) {
    base = formatoTexto(parte === node ? primeiro(pPr, "rPr") : primeiro(parte, "rPr"), base, estilos.tema);
    const pr = parte === node ? pPr : primeiro(parte, "pPr");
    if (!pr) continue;
    const spacing = primeiro(pr, "spacing"); const ind = primeiro(pr, "ind");
    if (val(pr, "jc")) props.alinhamento = val(pr, "jc");
    for (const [tag, key] of [["before", "antes"], ["after", "depois"]]) if (atributo(spacing, tag)) props[key] = numero(atributo(spacing, tag)) / 20;
    if (atributo(spacing, "line")) {
      props.linhaFixa = ["exact", "atLeast"].includes(atributo(spacing, "lineRule"));
      props.linha = numero(atributo(spacing, "line")) / (props.linhaFixa ? 20 : 240);
    }
    for (const [tag, key] of [["left", "esquerda"], ["right", "direita"], ["firstLine", "primeira"]]) if (atributo(ind, tag)) props[key] = numero(atributo(ind, tag)) / 20;
    if (atributo(ind, "hanging")) props.primeira = -numero(atributo(ind, "hanging")) / 20;
    for (const [tag, key] of [["pageBreakBefore", "quebraAntes"], ["keepLines", "manterLinhas"]]) if (primeiro(pr, tag)) props[key] = Boolean(ligada(primeiro(pr, tag)));
  }
  const marcadores = Array.from(node.getElementsByTagName("*")).filter((n) => n.namespaceURI === W && (n.localName === "lastRenderedPageBreak" || (n.localName === "t" && n.textContent.trim())));
  // Mantém inícios de página registrados no modelo; quebras no meio de texto
  // continuam sendo calculadas com os dados preenchidos.
  if (marcadores[0]?.localName === "lastRenderedPageBreak" && base.tamanho >= 14) props.quebraAntes = true;
  const segmentos = [];
  for (const run of Array.from(node.getElementsByTagNameNS(W, "r"))) {
    let ancestor = run.parentNode;
    while (ancestor && ancestor !== node && !(ancestor.namespaceURI === W && ancestor.localName === "p")) ancestor = ancestor.parentNode;
    if (ancestor !== node) continue;
    const pr = filhos(run, "rPr")[0]; let formato = { ...base };
    for (const estilo of estilos.resolver(val(pr, "rStyle"))) formato = formatoTexto(primeiro(estilo, "rPr"), formato, estilos.tema);
    formato = formatoTexto(pr, formato, estilos.tema);
    if (ligada(primeiro(pr, "vanish"))) continue;
    for (const filho of filhos(run)) {
      if (filho.localName === "t") segmentos.push({ ...formato, texto: filho.textContent });
      if (filho.localName === "tab") segmentos.push({ ...formato, texto: "    " });
      if (filho.localName === "br") segmentos.push({ ...formato, texto: atributo(filho, "type") === "page" ? "\f" : "\n" });
    }
  }
  return { ...props, segmentos, base, node };
}

async function fontesDoModelo(pdf, arquivos, estilos) {
  pdf.registerFontkit(fontkit);
  const fontes = new Map(); const refs = relacoes(arquivos, "word/fontTable.xml");
  for (const n of Array.from(xml(arquivos, "word/fontTable.xml")?.getElementsByTagNameNS(W, "font") || [])) {
    for (const [tag, sufixo] of [["embedRegular", "00"], ["embedBold", "10"], ["embedItalic", "01"], ["embedBoldItalic", "11"]]) {
      const embed = primeiro(n, tag); const bytes = arquivos[refs.get(atributo(embed, "id", R))];
      if (!bytes) continue;
      const dados = new Uint8Array(bytes);
      const chave = (atributo(embed, "fontKey").replace(/[^a-f\d]/gi, "").match(/.{2}/g) || []).map((b) => parseInt(b, 16)).reverse();
      if (chave.length === 16) for (let i = 0; i < Math.min(32, dados.length); i++) dados[i] ^= chave[i % 16];
      fontes.set(`${atributo(n, "name").toLowerCase()}:${sufixo}`, await pdf.embedFont(dados, { subset: true }));
    }
  }
  const necessarias = new Set();
  for (const parte of Object.keys(arquivos).filter(p => /^word\/(document|header\d*|footer\d*)\.xml$/.test(p))) {
    for (const p of Array.from(xml(arquivos, parte)?.getElementsByTagNameNS(W, "p") || [])) {
      for (const s of lerParagrafo(p, estilos).segmentos.filter(s => s.texto)) {
        necessarias.add(String(s.familia || "").toLowerCase() + ':' + (s.negrito ? '1' : '0') + (s.italico ? '1' : '0'));
      }
    }
  }
  const indisponiveis = new Set();
  const carregar = async (chave) => {
    if (fontes.has(chave)) return fontes.get(chave);
    if (!DOCUMENT_FONTS[chave] || indisponiveis.has(chave)) return null;
    try {
      const resposta = await fetch('/assets/fonts/' + DOCUMENT_FONTS[chave]);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const fonte = await pdf.embedFont(await resposta.arrayBuffer(), { subset: true });
      fontes.set(chave, fonte);
      return fonte;
    } catch {
      indisponiveis.add(chave);
      return null;
    }
  };
  for (const chave of necessarias) {
    if (await carregar(chave)) continue;
    const variante = chave.split(':').at(-1);
    const alternativas = [...new Set([
      ...['calibri', 'arial', 'times new roman'].map(f => `${f}:${variante}`),
      ...Object.keys(DOCUMENT_FONTS).filter(k => k.endsWith(`:${variante}`)),
    ])];
    for (const alternativa of alternativas) {
      const fonte = await carregar(alternativa);
      if (fonte) { fontes.set(chave, fonte); break; }
    }
  }
  return (s) => {
    const f = String(s.familia || "").toLowerCase(); const key = `${f}:${s.negrito ? 1 : 0}${s.italico ? 1 : 0}`;
    const fonte = fontes.get(key);
    if (!fonte) throw new Error(`Não foi possível carregar uma fonte local disponível (${s.negrito ? "negrito" : "normal"}${s.italico ? ", itálico" : ""}) para gerar o PDF.`);
    return fonte;
  };
}

function montarLinhas(p, largura, fonte) {
  const linhas = []; let tokens = []; let usado = 0; let espaco = 0;
  const concluir = (forcada = false) => { linhas.push({ tokens, largura: usado, forcada }); tokens = []; usado = 0; espaco = 0; };
  for (const s of p.segmentos) {
    for (const palavra of s.texto.split(/(\f|\n|\s+)/).filter(Boolean)) {
      if (palavra === "\f") { if (tokens.length) concluir(true); linhas.push({ quebraPagina: true }); continue; }
      if (palavra === "\n") { concluir(true); continue; }
      const font = fonte(s);
      if (/^\s+$/.test(palavra)) { espaco += font.widthOfTextAtSize(palavra.replace(/\s/g, " "), s.tamanho); continue; }
      const limite = Math.max(20, largura - (linhas.length === 0 ? p.primeira : 0));
      if (tokens.length && usado + espaco + font.widthOfTextAtSize(palavra, s.tamanho) > limite) concluir();
      let trecho = "";
      const adicionar = () => {
        const w = font.widthOfTextAtSize(trecho, s.tamanho);
        tokens.push({ ...s, texto: trecho, font, largura: w, espaco: tokens.length ? espaco : 0 });
        usado += w + (tokens.length > 1 ? espaco : 0); espaco = 0;
      };
      for (const letra of palavra) {
        if (trecho && font.widthOfTextAtSize(trecho + letra, s.tamanho) > limite) { adicionar(); concluir(); trecho = ""; }
        trecho += letra;
      }
      if (trecho) adicionar();
    }
  }
  if (tokens.length || !linhas.length) concluir();
  return linhas;
}

const alturaLinha = (l, p) => {
  const tamanho = Math.max(p.base.tamanho, ...(l.tokens || []).map((t) => t.tamanho));
  return p.linhaFixa ? Math.max(p.linha, tamanho) : tamanho * p.linha;
};

function desenharLinha(pagina, l, p, x, topo, largura, indice, ultima) {
  const tokens = l.tokens || []; const tamanho = Math.max(p.base.tamanho, ...tokens.map((t) => t.tamanho));
  let cursor = x + (indice === 0 ? p.primeira : 0); const disponivel = largura - (indice === 0 ? p.primeira : 0);
  if (p.alinhamento === "center") cursor += Math.max(0, (disponivel - l.largura) / 2);
  if (p.alinhamento === "right") cursor += Math.max(0, disponivel - l.largura);
  const justificar = ["both", "distribute"].includes(p.alinhamento) && !ultima && !l.forcada;
  const extra = justificar && tokens.length > 1 ? Math.max(0, (disponivel - l.largura) / (tokens.length - 1)) : 0;
  for (const t of tokens) {
    cursor += t.espaco + (t.espaco ? extra : 0); const y = pagina.getHeight() - topo - tamanho;
    pagina.drawText(t.texto, { x: cursor, y, size: t.tamanho, font: t.font, color: cor(t.cor) });
    for (const dy of [t.sublinhado ? -1.5 : null, t.riscado ? t.tamanho * .3 : null].filter((v) => v !== null)) pagina.drawLine({ start: { x: cursor, y: y + dy }, end: { x: cursor + t.largura, y: y + dy }, thickness: .5, color: cor(t.cor) });
    cursor += t.largura;
  }
}

async function imagensDaParte(pdf, arquivos, parte) {
  const imagens = new Map();
  for (const [id, caminho] of relacoes(arquivos, parte)) {
    const bytes = arquivos[caminho]; if (!bytes || !/\.(png|jpe?g)$/i.test(caminho)) continue;
    imagens.set(id, /\.png$/i.test(caminho) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes));
  }
  return imagens;
}

function desenharImagens(pagina, node, imagens, config, topo, x = config.esquerda, estilos, fonte) {
  let altura = 0;
  for (const drawing of Array.from(node?.getElementsByTagNameNS(W, "drawing") || [])) {
    const anchor = primeiro(drawing, "anchor", WP); const inline = primeiro(drawing, "inline", WP);
    const extent = primeiro(anchor || inline, "extent", WP);
    const pos = (tag, padrao) => {
      const pr = primeiro(anchor, tag, WP); const rel = pr?.getAttribute("relativeFrom");
      const base = tag === "positionH" ? (rel === "page" ? 0 : x) : (rel === "page" ? 0 : rel === "margin" ? config.topo : topo);
      const alinhamento = primeiro(pr, "align", WP)?.textContent;
      if (alinhamento === "center" && tag === "positionH") return (config.largura - numero(extent?.getAttribute("cx")) / EMU) / 2;
      if (alinhamento === "right" && tag === "positionH") return config.largura - (rel === "page" ? 0 : config.direita) - numero(extent?.getAttribute("cx")) / EMU;
      return anchor ? base + numero(primeiro(pr, "posOffset", WP)?.textContent) / EMU : padrao;
    };
    const left = pos("positionH", x); const top = pos("positionV", topo);
    const grouped = Boolean(primeiro(drawing, "grpSpPr", "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"));
    for (const pic of Array.from(drawing.getElementsByTagNameNS(PIC, "pic"))) {
      const image = imagens.get(atributo(primeiro(pic, "blip", A), "embed", R)); if (!image) continue;
      const transform = primeiro(pic, "xfrm", A); const ext = primeiro(transform, "ext", A); const off = primeiro(transform, "off", A);
      const width = numero(ext?.getAttribute("cx") || extent?.getAttribute("cx"), image.width * EMU) / EMU;
      const height = numero(ext?.getAttribute("cy") || extent?.getAttribute("cy"), image.height * EMU) / EMU;
      pagina.drawImage(image, { x: left + (grouped ? numero(off?.getAttribute("x")) / EMU : 0), y: config.altura - top - height - (grouped ? numero(off?.getAttribute("y")) / EMU : 0), width, height });
      if (inline) altura = Math.max(altura, height);
    }
    if (estilos && fonte) {
      const width = numero(extent?.getAttribute("cx")) / EMU;
      let cursor = top;
      for (const caixa of Array.from(drawing.getElementsByTagNameNS(W, "txbxContent"))) {
        for (const n of filhos(caixa, "p")) {
          const p = lerParagrafo(n, estilos); cursor += p.antes;
          const linhas = montarLinhas(p, Math.max(20, width), fonte);
          linhas.forEach((l, i) => { desenharLinha(pagina, l, p, left, cursor, width, i, i === linhas.length - 1); cursor += alturaLinha(l, p); });
          cursor += p.depois;
        }
      }
    }
  }
  return altura;
}

// Geração local com pdf-lib, como no fluxo anterior. Lê a cópia preenchida do modelo.
export async function gerarPdfDoWordOficial(bytesDocx) {
  if (typeof DOMParser === "undefined") throw new Error("O gerador de PDF requer um leitor XML compatível.");
  const arquivos = unzipSync(bytesDocx instanceof Uint8Array ? bytesDocx : new Uint8Array(bytesDocx));
  const doc = xml(arquivos, "word/document.xml"); if (!doc) throw new Error("O conteúdo do modelo não pôde ser lido.");
  const pdf = await PDFDocument.create(); const estilos = estilosDoModelo(arquivos); const fonte = await fontesDoModelo(pdf, arquivos, estilos);
  const corpo = primeiro(doc, "body"); const secao = filhos(corpo, "sectPr")[0] || primeiro(doc, "sectPr");
  const size = primeiro(secao, "pgSz"); const margin = primeiro(secao, "pgMar");
  const config = { largura: numero(atributo(size, "w"), 11906) / 20, altura: numero(atributo(size, "h"), 16838) / 20 };
  for (const [tag, key, padrao] of [["top", "topo", 1417], ["bottom", "baixo", 1417], ["left", "esquerda", 1701], ["right", "direita", 1701], ["header", "cabecalho", 708], ["footer", "rodape", 708]]) config[key] = numero(atributo(margin, tag), padrao) / 20;
  const largura = config.largura - config.esquerda - config.direita;
  const refs = relacoes(arquivos, "word/document.xml"); const imagens = await imagensDaParte(pdf, arquivos, "word/document.xml"); const partes = [];
  for (const tipo of ["header", "footer"]) {
    const ref = Array.from(doc.getElementsByTagNameNS(W, `${tipo}Reference`)).find((n) => atributo(n, "type") === "default");
    const caminho = refs.get(atributo(ref, "id", R));
    if (caminho) partes.push({ tipo, doc: xml(arquivos, caminho), imagens: await imagensDaParte(pdf, arquivos, caminho) });
  }
  const visual = texto(arquivos["word/document.xml"]) + partes.map((p) => new XMLSerializer().serializeToString(p.doc)).join("");
  const barraAzul = /00359E|0038A8|Retângulo 2/i.test(visual);
  let pagina; let y;
  const novaPagina = () => {
    pagina = pdf.addPage([config.largura, config.altura]); y = config.topo;
    if (barraAzul) pagina.drawRectangle({ x: 0, y: 0, width: 20.25, height: config.altura, color: cor("00359E") });
    for (const parte of partes) {
      const ps = filhos(parte.doc.documentElement, "p").map((n) => lerParagrafo(n, estilos));
      const height = ps.reduce((h, p) => h + p.antes + p.depois + montarLinhas(p, largura, fonte).reduce((s, l) => s + alturaLinha(l, p), 0), 0);
      let cursor = parte.tipo === "header" ? config.cabecalho : config.altura - config.rodape - height;
      for (const p of ps) {
        cursor += p.antes; desenharImagens(pagina, p.node, parte.imagens, config, cursor, config.esquerda, estilos, fonte);
        const linhas = montarLinhas(p, largura, fonte);
        linhas.forEach((l, i) => { desenharLinha(pagina, l, p, config.esquerda, cursor, largura, i, i === linhas.length - 1); cursor += alturaLinha(l, p); });
        cursor += p.depois;
      }
    }
  };
  const desenharParagrafo = (node, x = config.esquerda, width = largura) => {
    const p = lerParagrafo(node, estilos); const linhas = montarLinhas(p, width - p.esquerda - p.direita, fonte);
    const temTexto = linhas.some((l) => l.tokens?.length);
    const height = p.antes + p.depois + linhas.reduce((h, l) => h + alturaLinha(l, p), 0);
    if (temTexto && (p.quebraAntes || (p.manterLinhas && y + height > config.altura - config.baixo)) && y > config.topo + 1) novaPagina();
    y += p.antes; const imageHeight = desenharImagens(pagina, node, imagens, config, y, x, estilos, fonte);
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]; if (l.quebraPagina) { novaPagina(); continue; }
      const h = alturaLinha(l, p); if (l.tokens?.length && y + h > config.altura - config.baixo) novaPagina();
      desenharLinha(pagina, l, p, x + p.esquerda, y, width - p.esquerda - p.direita, i, i === linhas.length - 1); y += h;
    }
    y += Math.max(0, imageHeight - (height - p.antes - p.depois)) + p.depois;
  };
  novaPagina();
  const nodes = filhos(corpo);
  // A posi??o de assinaturas e notas segue os par?grafos do DOCX.
  for (const node of nodes) {
    if (node.localName === "p") desenharParagrafo(node);
    else if (node.localName === "tbl") {
      for (const row of filhos(node, "tr")) {
        const cells = filhos(row, "tc"); const topo = y; let fim = y; let x = config.esquerda;
        const widths = cells.map((c) => numero(atributo(primeiro(c, "tcW"), "w"), largura * 20 / cells.length) / 20);
        const total = widths.reduce((a, b) => a + b, 0);
        for (let i = 0; i < cells.length; i++) {
          y = topo; const w = widths[i] * largura / total;
          for (const p of filhos(cells[i], "p")) desenharParagrafo(p, x + 4, w - 8);
          fim = Math.max(fim, y); x += w;
        }
        y = fim;
      }
    }
  }
  pdf.setProducer("Platino Workspace Administrativo — pdf-lib"); pdf.setCreator("Gerador local de documentos Platino");
  return pdf.save();
}
