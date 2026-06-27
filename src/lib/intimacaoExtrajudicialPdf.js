import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGEM_ESQUERDA = 85.05;
const MARGEM_DIREITA = 77.95;
const LARGURA_TEXTO = A4[0] - MARGEM_ESQUERDA - MARGEM_DIREITA;
const PRETO = rgb(0, 0, 0);
const AZUL_PLATINO = rgb(0, 56 / 255, 168 / 255);
const AZUL_TITULO = rgb(23 / 255, 54 / 255, 93 / 255);
const TAMANHO_TEXTO = 11;
const ALTURA_LINHA = 14;

function dataPorExtenso(data) {
  if (!data) return "";
  const valor = new Date(`${data}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(valor);
}

function dataCurta(data) {
  if (!data) return "";
  const valor = new Date(`${data}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR").format(valor);
}

function criarLinhas(segmentos, fontes, tamanho, larguraMaxima) {
  const palavras = [];

  segmentos.forEach((segmento) => {
    String(segmento.texto ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((texto) => {
        palavras.push({
          texto,
          fonte: segmento.negrito ? fontes.negrito : fontes.normal,
        });
      });
  });

  const linhas = [];
  let linha = [];
  let largura = 0;

  palavras.forEach((palavra) => {
    const larguraPalavra = palavra.fonte.widthOfTextAtSize(palavra.texto, tamanho);
    const larguraEspaco =
      linha.length > 0
        ? linha[linha.length - 1].fonte.widthOfTextAtSize(" ", tamanho)
        : 0;

    if (linha.length && largura + larguraEspaco + larguraPalavra > larguraMaxima) {
      linhas.push(linha);
      linha = [];
      largura = 0;
    }

    linha.push(palavra);
    largura += (linha.length > 1 ? larguraEspaco : 0) + larguraPalavra;
  });

  if (linha.length) linhas.push(linha);
  return linhas;
}

function desenharParagrafo({
  pagina,
  segmentos,
  fontes,
  y,
  tamanho = TAMANHO_TEXTO,
  alturaLinha = ALTURA_LINHA,
  alinhamento = "left",
  x = MARGEM_ESQUERDA,
  largura = LARGURA_TEXTO,
}) {
  const linhas = criarLinhas(segmentos, fontes, tamanho, largura);

  linhas.forEach((linha, indiceLinha) => {
    const larguraPalavras = linha.reduce(
      (total, palavra) =>
        total + palavra.fonte.widthOfTextAtSize(palavra.texto, tamanho),
      0,
    );
    const quantidadeEspacos = Math.max(0, linha.length - 1);
    const espacoPadrao = fontes.normal.widthOfTextAtSize(" ", tamanho);
    const ultimaLinha = indiceLinha === linhas.length - 1;
    const espaco =
      alinhamento === "justify" && !ultimaLinha && quantidadeEspacos
        ? Math.max(
            espacoPadrao,
            (largura - larguraPalavras) / quantidadeEspacos,
          )
        : espacoPadrao;
    const larguraLinha = larguraPalavras + quantidadeEspacos * espacoPadrao;

    let posicaoX = x;
    if (alinhamento === "center") {
      posicaoX = x + (largura - larguraLinha) / 2;
    } else if (alinhamento === "right") {
      posicaoX = x + largura - larguraLinha;
    }

    linha.forEach((palavra, indicePalavra) => {
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

function desenharCabecalhoERodape(pagina, fontes) {
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

  const titulo = "INTIMAÇÃO EXTRAJUDICIAL";
  const larguraTitulo = fontes.normal.widthOfTextAtSize(titulo, 14);
  pagina.drawText(titulo, {
    x: (A4[0] - larguraTitulo) / 2,
    y: 751,
    size: 14,
    font: fontes.normal,
    color: AZUL_TITULO,
  });

  pagina.drawLine({
    start: { x: MARGEM_ESQUERDA, y: 738 },
    end: { x: A4[0] - MARGEM_DIREITA, y: 738 },
    thickness: 1.5,
    color: rgb(160 / 255, 160 / 255, 160 / 255),
  });

  const rodape = [
    "Rua Fontoura Xavier, nº 1308 - Itaquera - São Paulo/SP - CEP: 08295-300",
    "E-mail: platinoassessoriafinanceira@gmail.com",
  ];

  rodape.forEach((linha, indice) => {
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

function desenharItem(pagina, fontes, y, rotulo, valor) {
  pagina.drawCircle({
    x: MARGEM_ESQUERDA + 4,
    y: y + 4,
    size: 2.4,
    color: PRETO,
  });

  return desenharParagrafo({
    pagina,
    fontes,
    y,
    x: MARGEM_ESQUERDA + 18,
    largura: LARGURA_TEXTO - 18,
    segmentos: [
      { texto: `${rotulo}: R$` },
      { texto: valor, negrito: true },
    ],
  });
}

export async function gerarIntimacaoExtrajudicialPdf(dados) {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage(A4);
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  desenharCabecalhoERodape(pagina, fontes);

  const banco = String(dados.banco || "").trim();
  const cnpjBanco = String(dados.cnpjBanco || "").trim();
  const enderecoBanco = String(dados.enderecoBanco || "").trim();
  const nomeCliente = String(dados.nomeCliente || "").trim();
  let y = 704;

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [{ texto: "A" }],
  });
  y -= 2;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [{ texto: banco, negrito: true }],
  });
  y -= 2;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      { texto: "CNPJ:" },
      { texto: cnpjBanco, negrito: true },
    ],
  });
  y -= 2;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [{ texto: enderecoBanco }],
  });

  y -= 28;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "Reportando ao meu contrato de financiamento junto a V.Sa, celebrado em",
      },
      { texto: `${dataCurta(dados.dataContrato)},`, negrito: true },
      {
        texto:
          "nos termos das cláusulas contratuais nele contidas, faço uso da presente para lhe",
      },
      { texto: "NOTIFICAR", negrito: true },
      {
        texto:
          "da abusividade contratual quanto ao cumprimento do referido contrato.",
      },
    ],
  });

  y -= 20;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "Assim, no prazo de até 5 (cinco) dias úteis do recebimento desta, seja avaliada a possível redução da taxa de juros remuneratórios contratuais, expurgo de tarifas ou seguros embutidos, se o caso, bem como um",
      },
      { texto: "possível acordo.", negrito: true },
    ],
  });

  y -= 20;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "O pedido em epígrafe tem como discussão matéria atinente à revisão contratual em razão das cobranças abusivas, onde se verificou:",
      },
    ],
  });

  y -= 18;
  y = desenharItem(
    pagina,
    fontes,
    y,
    "Valor da parcela corrigido",
    String(dados.valorParcelaCorrigido || "").trim(),
  );
  y -= 12;
  y = desenharItem(
    pagina,
    fontes,
    y,
    "Redução da parcela",
    String(dados.reducaoParcela || "").trim(),
  );
  y -= 12;
  y = desenharItem(
    pagina,
    fontes,
    y,
    "Estorno",
    String(dados.valorEstorno || "").trim(),
  );
  y -= 12;
  y = desenharItem(
    pagina,
    fontes,
    y,
    "Redução total",
    String(dados.reducaoTotal || "").trim(),
  );

  y = Math.min(y - 66, 210);
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "center",
    segmentos: [
      {
        texto: `São Paulo, ${dataPorExtenso(dados.dataEmissao)}.`,
      },
    ],
  });

  y = Math.min(y - 52, 145);
  const larguraAssinatura = 250;
  const xAssinatura = (A4[0] - larguraAssinatura) / 2;
  pagina.drawLine({
    start: { x: xAssinatura, y },
    end: { x: xAssinatura + larguraAssinatura, y },
    thickness: 0.8,
    color: PRETO,
  });

  y -= 19;
  desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "center",
    x: xAssinatura,
    largura: larguraAssinatura,
    segmentos: [{ texto: nomeCliente.toUpperCase(), negrito: true }],
  });

  if (y < 80) {
    throw new Error(
      "Os dados informados ultrapassaram o espaço disponível no modelo.",
    );
  }

  return pdf.save();
}
