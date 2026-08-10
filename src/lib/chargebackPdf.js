import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGEM_ESQUERDA = 85.05;
const MARGEM_DIREITA = 77.95;
const LARGURA_TEXTO = A4[0] - MARGEM_ESQUERDA - MARGEM_DIREITA;
const PRETO = rgb(0, 0, 0);
const AZUL_PLATINO = rgb(0, 56 / 255, 168 / 255);
const AZUL_TITULO = rgb(23 / 255, 54 / 255, 93 / 255);

function dataCurta(data) {
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${data}T12:00:00`),
  );
}

function dataPorExtenso(data) {
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
}

function textoInformado(valor) {
  return String(valor || "").trim();
}

function valorMonetario(valor) {
  return textoInformado(valor).replace(/^R\$\s*/i, "");
}

function criarLinhas(segmentos, fontes, tamanho, larguraMaxima) {
  const palavras = [];

  segmentos.forEach((segmento) => {
    textoInformado(segmento.texto)
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
    const larguraPalavra = palavra.fonte.widthOfTextAtSize(
      palavra.texto,
      tamanho,
    );
    const larguraEspaco =
      linha.length > 0
        ? linha[linha.length - 1].fonte.widthOfTextAtSize(" ", tamanho)
        : 0;

    if (
      linha.length &&
      largura + larguraEspaco + larguraPalavra > larguraMaxima
    ) {
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
  tamanho = 10,
  alturaLinha = 12,
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

function desenharIdentidadeVisual(pagina, fontes) {
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

  const titulo = "CONTESTAÇÃO DE CHARGEBACK";
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

function desenharLinhaDeDados(pagina, fontes, y, esquerda, direita) {
  const yEsquerda = desenharParagrafo({
    pagina,
    fontes,
    y,
    largura: 282,
    segmentos: esquerda,
  });
  const yDireita = desenharParagrafo({
    pagina,
    fontes,
    y,
    x: 377,
    largura: A4[0] - MARGEM_DIREITA - 377,
    segmentos: direita,
  });

  return Math.min(yEsquerda, yDireita);
}

export async function gerarChargebackPdf(dados) {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage(A4);
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  desenharIdentidadeVisual(pagina, fontes);

  const nomeCliente = textoInformado(dados.nomeCliente);
  const cpfCliente = textoInformado(dados.cpfCnpj);
  const responsavel =
    textoInformado(dados.responsavelDocumento) ||
    textoInformado(dados.responsavel);
  const localEmissao = textoInformado(dados.localEmissao);
  let y = 704;

  y = desenharLinhaDeDados(
    pagina,
    fontes,
    y,
    [
      { texto: "Cliente:" },
      { texto: nomeCliente, negrito: true },
    ],
    [
      { texto: "CPF:" },
      { texto: cpfCliente, negrito: true },
    ],
  );

  y -= 4;
  y = desenharLinhaDeDados(
    pagina,
    fontes,
    y,
    [
      { texto: "Data do pagamento:" },
      { texto: dataCurta(dados.dataPagamento), negrito: true },
    ],
    [
      { texto: "Valor: R$" },
      { texto: valorMonetario(dados.valorPagamento), negrito: true },
    ],
  );

  const paragrafos = [
    [
      {
        texto:
          "Prezados, em atenção ao pedido de estorno/chargeback apresentado pelo cliente acima identificado, a",
      },
      { texto: "Platino Soluções Financeiras", negrito: true },
      {
        texto:
          "vem, por meio desta, apresentar sua contestação formal, requerendo o indeferimento do estorno, tendo em vista a legitimidade da contratação e da cobrança realizada.",
      },
    ],
    [
      {
        texto:
          "O valor questionado decorre de contrato de prestação de serviços de assessoria para revisão contratual, regularmente firmado entre as partes. O cliente, na qualidade de contratante, teve ciência prévia das condições do serviço, valores, etapas do atendimento e obrigações assumidas, manifestando sua concordância por meio de contrato, termo de consentimento e demais documentos de aceite.",
      },
    ],
    [
      {
        texto:
          "A transação foi realizada de forma voluntária, autorizada e rastreável, por meio regular de pagamento, não havendo qualquer elemento que caracterize fraude, uso indevido do cartão, contratação por terceiro não autorizado ou desconhecimento da operação pelo titular.",
      },
    ],
    [
      {
        texto:
          "Também não há fundamento para alegação de desacordo comercial, uma vez que a empresa iniciou a prestação dos serviços contratados, realizando atos técnicos e administrativos relacionados ao procedimento, tais como análise inicial, atendimento, conferência documental, orientações ao cliente, cálculos, tratativas judiciais ou movimentações internas vinculadas à revisão contratual, conforme documentos comprobatórios disponíveis.",
      },
    ],
    [
      {
        texto:
          "Ressalta-se que a continuidade do serviço depende também da colaboração do contratante, especialmente quanto ao fornecimento de documentos, informações e autorizações necessárias. No presente caso, o pedido de cancelamento/chargeback ocorreu de forma unilateral, sem demonstração de falha na prestação do serviço e após o início da execução contratual.",
      },
    ],
    [
      {
        texto:
          "Dessa forma, o estorno integral dos valores pagos, após a contratação formal e início da prestação dos serviços, configuraria prejuízo indevido à contratada e vantagem injustificada ao contratante, contrariando a boa-fé objetiva e a vedação ao enriquecimento sem causa.",
      },
    ],
    [
      {
        texto:
          "Para comprovação da regularidade da cobrança, poderão ser apresentados: contrato assinado, termo de consentimento, comprovante da transação, registros de atendimento, comunicações com o cliente, protocolos, relatórios, cálculos, documentos internos de movimentação e demais evidências da execução do serviço.",
      },
    ],
    [
      {
        texto:
          "Diante do exposto, requer-se o indeferimento do chargeback, com a manutenção da cobrança, tendo em vista que:",
      },
    ],
  ];

  paragrafos.forEach((segmentos) => {
    y -= 10;
    y = desenharParagrafo({
      pagina,
      fontes,
      y,
      alinhamento: "left",
      segmentos,
    });
  });

  y -= 4;
  [
    "I. houve contratação válida e documentada;",
    "II. o pagamento foi autorizado e rastreável;",
    "III. não há indícios de fraude;",
    "IV. o serviço foi iniciado e efetivamente prestado;",
    "V. não houve falha ou vício por parte da contratada;",
    "VI. o cancelamento decorreu de ato unilateral do próprio cliente.",
  ].forEach((item) => {
    y = desenharParagrafo({
      pagina,
      fontes,
      y,
      segmentos: [{ texto: item, negrito: true }],
    });
  });

  y = Math.min(y - 10, 190);
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 14,
    segmentos: [{ texto: "Cordialmente,", negrito: true }],
  });

  y -= 6;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 14,
    segmentos: [
      { texto: responsavel, negrito: true },
      { texto: " - Representante autorizado" },
    ],
  });

  y -= 8;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 14,
    alinhamento: "center",
    segmentos: [
      {
        texto: `${localEmissao}, ${dataPorExtenso(dados.dataEmissao)}.`,
      },
    ],
  });

  y -= 24;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 14,
    alinhamento: "center",
    segmentos: [
      { texto: "PLATINO SOLUÇÕES FINANCEIRAS", negrito: true },
    ],
  });
  desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 14,
    alinhamento: "center",
    segmentos: [{ texto: "CNPJ nº 52.807.405/0001-30", negrito: true }],
  });

  if (y < 62) {
    throw new Error(
      "Os dados informados ultrapassaram o espaço disponível no modelo.",
    );
  }

  return pdf.save();
}
