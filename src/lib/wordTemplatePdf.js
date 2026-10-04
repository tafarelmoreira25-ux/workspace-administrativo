import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const TWIPS_POR_PONTO = 20;
const ESCALA_CANVAS = 1.75;
const FAMILIA_MODELO = "PlatinoModeloOficial";
const AZUL_PLATINO = "#00359e";

const textoUtf8 = (bytes) => new TextDecoder().decode(bytes);
const numero = (valor, fallback = 0) => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : fallback;
};

function atributo(no, nome, namespace = W_NS) {
  return no?.getAttributeNS(namespace, nome) || no?.getAttribute(`w:${nome}`) || no?.getAttribute(nome) || "";
}

function xmlDosArquivos(arquivos, caminho) {
  const bytes = arquivos[caminho];
  if (!bytes) return null;
  const documento = new DOMParser().parseFromString(textoUtf8(bytes), "application/xml");
  return documento.getElementsByTagName("parsererror").length ? null : documento;
}

function desofuscarFonte(bytes, chave) {
  const resultado = new Uint8Array(bytes);
  const hexadecimal = String(chave || "").replace(/[^0-9a-f]/gi, "");
  const chaveBytes = (hexadecimal.match(/.{2}/g) || []).map((item) => Number.parseInt(item, 16)).reverse();
  if (chaveBytes.length !== 16) return resultado;
  for (let indice = 0; indice < Math.min(32, resultado.length); indice += 1) {
    resultado[indice] ^= chaveBytes[indice % chaveBytes.length];
  }
  return resultado;
}

function mapaRelacionamentos(documento) {
  const mapa = new Map();
  if (!documento) return mapa;
  Array.from(documento.getElementsByTagNameNS(REL_NS, "Relationship")).forEach((relacao) => {
    mapa.set(relacao.getAttribute("Id"), relacao.getAttribute("Target"));
  });
  return mapa;
}

async function carregarFontesDoModelo(arquivos) {
  if (typeof FontFace === "undefined" || !globalThis.document?.fonts) return false;
  const tabela = xmlDosArquivos(arquivos, "word/fontTable.xml");
  const relacoes = mapaRelacionamentos(xmlDosArquivos(arquivos, "word/_rels/fontTable.xml.rels"));
  if (!tabela) return false;
  const fontes = Array.from(tabela.getElementsByTagNameNS(W_NS, "font"));
  const century = fontes.find((fonte) => /century gothic/i.test(atributo(fonte, "name")));
  if (!century) return false;

  const definicoes = [
    { tag: "embedRegular", peso: "400" },
    { tag: "embedBold", peso: "700" },
  ];
  let carregadas = 0;
  for (const definicao of definicoes) {
    const no = century.getElementsByTagNameNS(W_NS, definicao.tag)[0];
    const destino = relacoes.get(no?.getAttributeNS(R_NS, "id"));
    const caminho = destino ? `word/${destino.replace(/^\.\//, "")}` : "";
    if (!no || !arquivos[caminho]) continue;
    const bytes = desofuscarFonte(arquivos[caminho], atributo(no, "fontKey"));
    const face = new FontFace(FAMILIA_MODELO, bytes, { style: "normal", weight: definicao.peso });
    await face.load();
    document.fonts.add(face);
    carregadas += 1;
  }
  return carregadas > 0;
}

function configuracaoPagina(documento) {
  const secao = documento.getElementsByTagNameNS(W_NS, "sectPr")[0];
  const tamanho = secao?.getElementsByTagNameNS(W_NS, "pgSz")[0];
  const margens = secao?.getElementsByTagNameNS(W_NS, "pgMar")[0];
  return {
    largura: numero(atributo(tamanho, "w"), 11906) / TWIPS_POR_PONTO,
    altura: numero(atributo(tamanho, "h"), 16838) / TWIPS_POR_PONTO,
    margemTopo: numero(atributo(margens, "top"), 1417) / TWIPS_POR_PONTO,
    margemDireita: numero(atributo(margens, "right"), 1701) / TWIPS_POR_PONTO,
    margemInferior: numero(atributo(margens, "bottom"), 1417) / TWIPS_POR_PONTO,
    margemEsquerda: numero(atributo(margens, "left"), 1701) / TWIPS_POR_PONTO,
    margemCabecalho: numero(atributo(margens, "header"), 708) / TWIPS_POR_PONTO,
    margemRodape: numero(atributo(margens, "footer"), 708) / TWIPS_POR_PONTO,
  };
}

function propriedadeLigada(no, nome) {
  const propriedade = no?.getElementsByTagNameNS(W_NS, nome)[0];
  if (!propriedade) return false;
  const valor = atributo(propriedade, "val").toLowerCase();
  return !["0", "false", "off", "none"].includes(valor);
}

function segmentosDoParagrafo(paragrafo) {
  const estiloParagrafo = paragrafo.getElementsByTagNameNS(W_NS, "pPr")[0];
  const estiloTexto = estiloParagrafo?.getElementsByTagNameNS(W_NS, "rPr")[0];
  const tamanhoPadrao = numero(atributo(estiloTexto?.getElementsByTagNameNS(W_NS, "sz")[0], "val"), 22) / 2;
  const segmentos = [];
  Array.from(paragrafo.getElementsByTagNameNS(W_NS, "r")).forEach((run) => {
    const estilo = run.getElementsByTagNameNS(W_NS, "rPr")[0];
    const tamanho = numero(atributo(estilo?.getElementsByTagNameNS(W_NS, "sz")[0], "val"), tamanhoPadrao * 2) / 2;
    const negrito = propriedadeLigada(estilo, "b") || (!estilo && propriedadeLigada(estiloTexto, "b"));
    let texto = "";
    Array.from(run.childNodes).forEach((filho) => {
      if (filho.namespaceURI !== W_NS) return;
      if (filho.localName === "t") texto += filho.textContent || "";
      else if (filho.localName === "tab") texto += "    ";
      else if (filho.localName === "br") texto += atributo(filho, "type") === "page" ? "\f" : "\n";
    });
    if (texto) segmentos.push({ texto, tamanho: tamanho || 11, negrito });
  });
  return segmentos;
}

function dadosDoParagrafo(paragrafo) {
  const propriedades = paragrafo.getElementsByTagNameNS(W_NS, "pPr")[0];
  const alinhamento = atributo(propriedades?.getElementsByTagNameNS(W_NS, "jc")[0], "val") || "left";
  const espacamento = propriedades?.getElementsByTagNameNS(W_NS, "spacing")[0];
  const recuo = propriedades?.getElementsByTagNameNS(W_NS, "ind")[0];
  return {
    segmentos: segmentosDoParagrafo(paragrafo),
    alinhamento,
    antes: numero(atributo(espacamento, "before"), 0) / TWIPS_POR_PONTO,
    depois: numero(atributo(espacamento, "after"), 0) / TWIPS_POR_PONTO,
    recuoEsquerda: numero(atributo(recuo, "left"), 0) / TWIPS_POR_PONTO,
    recuoDireita: numero(atributo(recuo, "right"), 0) / TWIPS_POR_PONTO,
    primeiraLinha: numero(atributo(recuo, "firstLine"), 0) / TWIPS_POR_PONTO,
    quebraAntes: Boolean(propriedades?.getElementsByTagNameNS(W_NS, "pageBreakBefore").length),
  };
}

function paragrafosDiretos(documento) {
  const corpo = documento.getElementsByTagNameNS(W_NS, "body")[0];
  return Array.from(corpo?.childNodes || [])
    .filter((no) => no.namespaceURI === W_NS && no.localName === "p")
    .map(dadosDoParagrafo);
}

function paragrafosDeParte(documento) {
  if (!documento) return [];
  return Array.from(documento.getElementsByTagNameNS(W_NS, "p"))
    .map(dadosDoParagrafo)
    .filter((paragrafo) => paragrafo.segmentos.some((segmento) => segmento.texto.trim()));
}

function tokenizar(segmentos) {
  const tokens = [];
  for (const segmento of segmentos) {
    const partes = segmento.texto.split(/(\f|\n|\s+)/);
    for (const parte of partes) {
      if (!parte) continue;
      if (parte === "\f") tokens.push({ quebraPagina: true });
      else if (parte === "\n") tokens.push({ quebraLinha: true });
      else if (/^\s+$/.test(parte)) tokens.push({ espaco: true });
      else tokens.push({ ...segmento, texto: parte });
    }
  }
  return tokens;
}

function fonteCanvas(token, familiaDisponivel) {
  const familia = familiaDisponivel ? `"${FAMILIA_MODELO}"` : '"Century Gothic", Arial, sans-serif';
  return `${token.negrito ? "700" : "400"} ${token.tamanho || 11}px ${familia}`;
}

function montarLinhas(ctx, paragrafo, largura, familiaDisponivel) {
  const linhas = [];
  let palavras = [];
  let larguraAtual = 0;
  let espacoPendente = false;
  const concluir = (forcada = false) => {
    linhas.push({ palavras, forcada, largura: larguraAtual });
    palavras = [];
    larguraAtual = 0;
    espacoPendente = false;
  };
  for (const token of tokenizar(paragrafo.segmentos)) {
    if (token.quebraPagina) { concluir(true); linhas.push({ quebraPagina: true }); continue; }
    if (token.quebraLinha) { concluir(true); continue; }
    if (token.espaco) { espacoPendente = palavras.length > 0; continue; }
    ctx.font = fonteCanvas(token, familiaDisponivel);
    const larguraPalavra = ctx.measureText(token.texto).width;
    ctx.font = fonteCanvas({ ...token, texto: " " }, familiaDisponivel);
    const larguraEspaco = espacoPendente ? ctx.measureText(" ").width : 0;
    if (palavras.length && larguraAtual + larguraEspaco + larguraPalavra > largura) concluir(false);
    palavras.push({ ...token, espacoAntes: palavras.length ? larguraEspaco : 0 });
    larguraAtual += (palavras.length > 1 ? larguraEspaco : 0) + larguraPalavra;
    espacoPendente = false;
  }
  if (palavras.length || linhas.length === 0) concluir(false);
  return linhas;
}

function criarCanvas(configuracao, barraAzul) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(configuracao.largura * ESCALA_CANVAS);
  canvas.height = Math.round(configuracao.altura * ESCALA_CANVAS);
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.scale(ESCALA_CANVAS, ESCALA_CANVAS);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, configuracao.largura, configuracao.altura);
  if (barraAzul) {
    ctx.fillStyle = AZUL_PLATINO;
    ctx.fillRect(0, 0, 20.25, configuracao.altura);
  }
  ctx.fillStyle = "#000";
  return { canvas, ctx };
}

function desenharLinha(ctx, linha, paragrafo, x, y, largura, familiaDisponivel, ultimaLinha) {
  if (!linha.palavras.length) return;
  const alinhamento = paragrafo.alinhamento;
  const totalPalavras = linha.palavras.reduce((soma, palavra) => {
    ctx.font = fonteCanvas(palavra, familiaDisponivel);
    return soma + ctx.measureText(palavra.texto).width;
  }, 0);
  const lacunas = Math.max(0, linha.palavras.length - 1);
  const justificar = ["both", "distribute"].includes(alinhamento) && !ultimaLinha && !linha.forcada && lacunas > 0;
  const espacoJustificado = justificar ? Math.max(0, (largura - totalPalavras) / lacunas) : 0;
  let cursor = x;
  if (["center", "centre"].includes(alinhamento)) cursor += Math.max(0, (largura - linha.largura) / 2);
  else if (alinhamento === "right") cursor += Math.max(0, largura - linha.largura);
  linha.palavras.forEach((palavra, indice) => {
    if (indice) cursor += justificar ? espacoJustificado : palavra.espacoAntes;
    ctx.font = fonteCanvas(palavra, familiaDisponivel);
    ctx.fillText(palavra.texto, cursor, y);
    cursor += ctx.measureText(palavra.texto).width;
  });
}

function textoDaParte(paragrafos) {
  return paragrafos.map((paragrafo) => paragrafo.segmentos.map((segmento) => segmento.texto).join("").trim()).filter(Boolean);
}

function desenharCabecalhoRodape(pagina, configuracao, cabecalho, rodape, familiaDisponivel) {
  const { ctx } = pagina;
  const desenhar = (linhas, yInicial, passo) => linhas.slice(0, 3).forEach((texto, indice) => {
    const token = { tamanho: 8.5, negrito: false };
    ctx.font = fonteCanvas(token, familiaDisponivel);
    const largura = ctx.measureText(texto).width;
    ctx.fillText(texto, Math.max(28, (configuracao.largura - largura) / 2), yInicial + indice * passo);
  });
  desenhar(textoDaParte(cabecalho), Math.max(14, configuracao.margemCabecalho), 10);
  const linhasRodape = textoDaParte(rodape);
  desenhar(linhasRodape, configuracao.altura - Math.max(14, configuracao.margemRodape) - Math.max(0, linhasRodape.length - 1) * 10, 10);
}

function canvasParaPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error("Não foi possível renderizar a página do modelo oficial.")); return; }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

export async function gerarPdfDoWordOficial(bytesDocx) {
  if (!globalThis.document?.createElement || typeof DOMParser === "undefined") {
    throw new Error("A conversão do modelo oficial para PDF requer um navegador compatível.");
  }
  const arquivos = unzipSync(bytesDocx instanceof Uint8Array ? bytesDocx : new Uint8Array(bytesDocx));
  const documento = xmlDosArquivos(arquivos, "word/document.xml");
  if (!documento) throw new Error("O conteúdo do modelo oficial não pôde ser lido.");
  const familiaDisponivel = await carregarFontesDoModelo(arquivos).catch(() => false);
  const configuracao = configuracaoPagina(documento);
  const cabecalho = paragrafosDeParte(xmlDosArquivos(arquivos, Object.keys(arquivos).find((caminho) => /^word\/header\d+\.xml$/i.test(caminho))));
  const rodape = paragrafosDeParte(xmlDosArquivos(arquivos, Object.keys(arquivos).find((caminho) => /^word\/footer\d+\.xml$/i.test(caminho))));
  const xmlVisual = Object.entries(arquivos)
    .filter(([caminho]) => /^word\/(document|header\d+|footer\d+)\.xml$/i.test(caminho))
    .map(([, bytes]) => textoUtf8(bytes)).join("");
  const barraAzul = /00359E/i.test(xmlVisual) || /Retângulo 2|RetÃ¢ngulo 2/i.test(xmlVisual);
  const paginas = [];
  let pagina;
  const novaPagina = () => {
    pagina = criarCanvas(configuracao, barraAzul);
    pagina.y = configuracao.margemTopo;
    desenharCabecalhoRodape(pagina, configuracao, cabecalho, rodape, familiaDisponivel);
    paginas.push(pagina);
  };
  novaPagina();

  for (const paragrafo of paragrafosDiretos(documento)) {
    if (paragrafo.quebraAntes && pagina.y > configuracao.margemTopo + 1) novaPagina();
    pagina.y += paragrafo.antes;
    const x = configuracao.margemEsquerda + paragrafo.recuoEsquerda;
    const largura = configuracao.largura - x - configuracao.margemDireita - paragrafo.recuoDireita;
    const linhas = montarLinhas(pagina.ctx, paragrafo, largura, familiaDisponivel);
    if (!paragrafo.segmentos.length) {
      pagina.y += 12 + paragrafo.depois;
      continue;
    }
    for (let indice = 0; indice < linhas.length; indice += 1) {
      const linha = linhas[indice];
      if (linha.quebraPagina) { novaPagina(); continue; }
      const tamanho = Math.max(9, ...linha.palavras.map((palavra) => palavra.tamanho || 11));
      const alturaLinha = tamanho * 1.22;
      if (pagina.y + alturaLinha > configuracao.altura - configuracao.margemInferior) novaPagina();
      pagina.y += tamanho;
      desenharLinha(
        pagina.ctx,
        linha,
        paragrafo,
        x + (indice === 0 ? paragrafo.primeiraLinha : 0),
        pagina.y,
        largura - (indice === 0 ? paragrafo.primeiraLinha : 0),
        familiaDisponivel,
        indice === linhas.length - 1,
      );
      pagina.y += alturaLinha - tamanho;
    }
    pagina.y += paragrafo.depois;
  }

  const pdf = await PDFDocument.create();
  for (const paginaCanvas of paginas) {
    const imagem = await pdf.embedPng(await canvasParaPng(paginaCanvas.canvas));
    const paginaPdf = pdf.addPage([configuracao.largura, configuracao.altura]);
    paginaPdf.drawImage(imagem, { x: 0, y: 0, width: configuracao.largura, height: configuracao.altura });
  }
  pdf.setProducer("Platino Workspace Administrativo");
  pdf.setCreator("Gerador de Documentos Platino");
  return pdf.save();
}

