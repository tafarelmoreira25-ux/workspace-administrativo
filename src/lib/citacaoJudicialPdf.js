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

function qualificacaoPorGenero(genero) {
  if (genero === "feminino") return "qualificada";
  if (genero === "masculino") return "qualificado";
  return "qualificado(a)";
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

  const titulo = "CITAÇÃO DA PARTE RÉ";
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

export async function gerarCitacaoJudicialPdf(dados) {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage(A4);
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  desenharCabecalhoERodape(pagina, fontes);

  const nomeCliente = String(dados.nomeCliente || "").trim();
  const banco = String(dados.banco || "").trim();
  const numeroProcesso = String(dados.numeroProcesso || "").trim();
  const cidade = String(dados.cidade || "").trim();
  const qualificado = qualificacaoPorGenero(dados.genero);
  let y = 704;

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      { texto: "Protocolo nº:" },
      { texto: numeroProcesso, negrito: true },
    ],
  });

  y -= 30;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "justify",
    segmentos: [
      { texto: `${nomeCliente},`, negrito: true },
      {
        texto:
          `já devidamente ${qualificado} nos autos da AÇÃO REVISIONAL DE CONTRATO DE FINANCIAMENTO que move em face de`,
      },
      { texto: `${banco},`, negrito: true },
      {
        texto:
          "por intermédio de seu procurador infra-assinado, vem, respeitosamente, requerer a nova citação da parte ré, com a finalidade de impulsionar o regular andamento processual.",
      },
    ],
  });

  y -= 18;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "O processo em epígrafe versa sobre matéria de natureza eminentemente jurídica, inexistindo, portanto, necessidade de dilação probatória. Verifica-se que, tanto na petição inicial quanto na contestação, não houve indicação de necessidade de produção de outras provas pelas partes, circunstância que autoriza o julgamento antecipado do mérito.",
      },
    ],
  });

  y -= 18;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      {
        texto:
          "Nesse sentido, dispõe o artigo 355 do Código de Processo Civil:",
      },
    ],
  });

  y -= 18;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      {
        texto:
          "Art. 355. O juiz julgará antecipadamente o pedido, proferindo sentença com resolução de mérito, quando:",
      },
    ],
  });

  y -= 18;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      {
        texto:
          "I - Não houver necessidade de produção de outras provas;",
      },
    ],
  });

  y -= 18;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "No caso em tela, os pedidos formulados estão amparados em matéria essencialmente jurídica e documental, sendo desnecessária a abertura de fase instrutória ou a produção de novas provas.",
      },
    ],
  });

  y -= 18;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "Diante disso, requer-se o julgamento antecipado do mérito, nos termos do artigo 355, inciso I, do Código de Processo Civil.",
      },
    ],
  });

  y -= 18;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [{ texto: "Termos em que," }],
  });

  y -= 8;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [{ texto: "Pede deferimento." }],
  });

  y -= 40;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "center",
    segmentos: [
      {
        texto: `${cidade}, ${dataPorExtenso(dados.dataEmissao)}.`,
      },
    ],
  });

  y -= 46;
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
