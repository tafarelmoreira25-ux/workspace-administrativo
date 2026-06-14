import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const A4 = [595.28, 841.89];
export const MARGEM_ESQUERDA = 85.05;
export const MARGEM_DIREITA = 77.95;
export const LARGURA_TEXTO =
  A4[0] - MARGEM_ESQUERDA - MARGEM_DIREITA;

const PRETO = rgb(0, 0, 0);
const AZUL_PLATINO = rgb(0, 56 / 255, 168 / 255);
const AZUL_TITULO = rgb(23 / 255, 54 / 255, 93 / 255);

function criarLinhas(segmentos, fontes, tamanho, larguraMaxima) {
  const tokens = [];

  segmentos.forEach((segmento) => {
    String(segmento.texto ?? "")
      .split(/(\n|\s+)/)
      .forEach((parte) => {
        if (parte === "\n") {
          tokens.push({ quebra: true });
        } else if (parte.trim()) {
          tokens.push({
            texto: parte,
            fonte: segmento.negrito ? fontes.negrito : fontes.normal,
          });
        }
      });
  });

  const linhas = [];
  let palavras = [];
  let largura = 0;

  function concluirLinha(quebraForcada = false) {
    linhas.push({ palavras, quebraForcada });
    palavras = [];
    largura = 0;
  }

  tokens.forEach((token) => {
    if (token.quebra) {
      concluirLinha(true);
      return;
    }

    const larguraPalavra = token.fonte.widthOfTextAtSize(token.texto, tamanho);
    const larguraEspaco =
      palavras.length > 0
        ? palavras[palavras.length - 1].fonte.widthOfTextAtSize(" ", tamanho)
        : 0;

    if (
      palavras.length &&
      largura + larguraEspaco + larguraPalavra > larguraMaxima
    ) {
      concluirLinha(false);
    }

    palavras.push(token);
    largura +=
      (palavras.length > 1
        ? palavras[palavras.length - 2].fonte.widthOfTextAtSize(" ", tamanho)
        : 0) + larguraPalavra;
  });

  if (palavras.length || linhas.length === 0) {
    concluirLinha(false);
  }

  return linhas;
}

function desenharIdentidadeVisual(pagina, fontes, titulo) {
  pagina.drawRectangle({
    x: 0,
    y: 0,
    width: 24,
    height: A4[1],
    color: AZUL_PLATINO,
  });

  const marca = "PLATINO SOLUÇÕES FINANCEIRAS";
  const larguraMarca = fontes.normal.widthOfTextAtSize(marca, 8);
  pagina.drawText(marca, {
    x: (A4[0] - larguraMarca) / 2,
    y: 809,
    size: 8,
    font: fontes.normal,
    color: PRETO,
  });

  const tamanhoTitulo = 14;
  const larguraTitulo = fontes.normal.widthOfTextAtSize(titulo, tamanhoTitulo);
  pagina.drawText(titulo, {
    x: (A4[0] - larguraTitulo) / 2,
    y: 751,
    size: tamanhoTitulo,
    font: fontes.normal,
    color: AZUL_TITULO,
  });

  pagina.drawLine({
    start: { x: MARGEM_ESQUERDA, y: 738 },
    end: { x: A4[0] - MARGEM_DIREITA, y: 738 },
    thickness: 1.5,
    color: rgb(160 / 255, 160 / 255, 160 / 255),
  });

  [
    "Rua Fontoura Xavier, nº 1308 - Itaquera - São Paulo/SP - CEP: 08295-300",
    "E-mail: platinoassessoriafinanceira@gmail.com",
  ].forEach((linha, indice) => {
    const largura = fontes.normal.widthOfTextAtSize(linha, 9);
    pagina.drawText(linha, {
      x: (A4[0] - largura) / 2,
      y: indice === 0 ? 31 : 19,
      size: 9,
      font: fontes.normal,
      color: PRETO,
    });
  });
}

export async function criarDocumentoPlatinoCompleto(titulo) {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage(A4);
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };

  desenharIdentidadeVisual(pagina, fontes, titulo);
  return { pdf, pagina, fontes, yInicial: 704 };
}

export function desenharParagrafoPlatino({
  pagina,
  segmentos,
  fontes,
  y,
  tamanho = 11,
  alturaLinha = 14,
  alinhamento = "left",
  x = MARGEM_ESQUERDA,
  largura = LARGURA_TEXTO,
}) {
  const linhas = criarLinhas(segmentos, fontes, tamanho, largura);

  linhas.forEach((linha, indiceLinha) => {
    if (!linha.palavras.length) {
      y -= alturaLinha;
      return;
    }

    const larguraPalavras = linha.palavras.reduce(
      (total, palavra) =>
        total + palavra.fonte.widthOfTextAtSize(palavra.texto, tamanho),
      0,
    );
    const quantidadeEspacos = Math.max(0, linha.palavras.length - 1);
    const espacoPadrao = fontes.normal.widthOfTextAtSize(" ", tamanho);
    const ultimaLinha = indiceLinha === linhas.length - 1;
    const espaco =
      alinhamento === "justify" &&
      !ultimaLinha &&
      !linha.quebraForcada &&
      quantidadeEspacos
        ? (largura - larguraPalavras) / quantidadeEspacos
        : espacoPadrao;
    const larguraLinha =
      larguraPalavras + quantidadeEspacos * espacoPadrao;

    let posicaoX = x;
    if (alinhamento === "center") {
      posicaoX = x + (largura - larguraLinha) / 2;
    } else if (alinhamento === "right") {
      posicaoX = x + largura - larguraLinha;
    }

    linha.palavras.forEach((palavra, indicePalavra) => {
      if (indicePalavra) posicaoX += espaco;
      pagina.drawText(palavra.texto, {
        x: posicaoX,
        y,
        size: tamanho,
        font: palavra.fonte,
        color: PRETO,
      });
      posicaoX += palavra.fonte.widthOfTextAtSize(palavra.texto, tamanho);
    });

    y -= alturaLinha;
  });

  return y;
}

export function desenharAssinaturaPlatino(
  pagina,
  fontes,
  nome,
  y,
  tamanho = 12,
) {
  const larguraLinha = 250;
  const x = (A4[0] - larguraLinha) / 2;

  pagina.drawLine({
    start: { x, y },
    end: { x: x + larguraLinha, y },
    thickness: 0.8,
    color: PRETO,
  });

  desenharParagrafoPlatino({
    pagina,
    fontes,
    y: y - 19,
    x,
    largura: larguraLinha,
    tamanho,
    alturaLinha: tamanho + 2,
    alinhamento: "center",
    segmentos: [{ texto: String(nome || "").toUpperCase(), negrito: true }],
  });
}

export function dataPorExtenso(data) {
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
}
