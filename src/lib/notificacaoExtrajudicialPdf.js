import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGEM_ESQUERDA = 85.05;
const MARGEM_DIREITA = 77.95;
const LARGURA_TEXTO = A4[0] - MARGEM_ESQUERDA - MARGEM_DIREITA;
const TOPO_CORPO = 704;
const BASE_CORPO = 66;
const TAMANHO_TEXTO = 12;
const ALTURA_LINHA = 14.95;
const AZUL_PLATINO = rgb(0, 56 / 255, 168 / 255);
const AZUL_TITULO = rgb(23 / 255, 54 / 255, 93 / 255);
const PRETO = rgb(0, 0, 0);

function dataPorExtenso(data) {
  if (!data) return "";
  const valor = new Date(`${data}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(valor);
}

function valorInformado(valor) {
  return String(valor || "").trim();
}

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

  const titulo = "NOTIFICAÇÃO EXTRAJUDICIAL";
  const larguraTitulo = fontes.normal.widthOfTextAtSize(titulo, 16);
  pagina.drawText(titulo, {
    x: (A4[0] - larguraTitulo) / 2,
    y: 751,
    size: 16,
    font: fontes.normal,
    color: AZUL_TITULO,
  });

  pagina.drawLine({
    start: { x: MARGEM_ESQUERDA, y: 738 },
    end: { x: A4[0] - MARGEM_DIREITA, y: 738 },
    thickness: 1.5,
    color: rgb(160 / 255, 160 / 255, 160 / 255),
  });

  const rodapeLinha1 =
    "Rua Fontoura Xavier, nº 1308 - Itaquera - São Paulo/SP - CEP: 08295-300";
  const rodapeLinha2 = "E-mail: platinoassessoriafinanceira@gmail.com";

  [rodapeLinha1, rodapeLinha2].forEach((linha, indice) => {
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

function adicionarPagina(contexto) {
  const pagina = contexto.pdf.addPage(A4);
  desenharCabecalhoERodape(pagina, contexto.fontes);
  contexto.pagina = pagina;
  contexto.y = TOPO_CORPO;
}

function garantirEspaco(contexto, altura) {
  if (contexto.y - altura < BASE_CORPO) {
    adicionarPagina(contexto);
  }
}

function desenharParagrafo(
  contexto,
  {
    segmentos,
    tamanho = TAMANHO_TEXTO,
    alturaLinha = ALTURA_LINHA,
    antes = 5,
    depois = 5,
    alinhamento = "left",
    largura = LARGURA_TEXTO,
    x = MARGEM_ESQUERDA,
    manterJunto = false,
  },
) {
  const linhas = criarLinhas(segmentos, contexto.fontes, tamanho, largura);
  const alturaTotal = antes + linhas.length * alturaLinha + depois;

  if (manterJunto) {
    garantirEspaco(contexto, alturaTotal);
  }

  contexto.y -= antes;

  linhas.forEach((linha, indiceLinha) => {
    garantirEspaco(contexto, alturaLinha);

    if (!linha.palavras.length) {
      contexto.y -= alturaLinha;
      return;
    }

    const larguraPalavras = linha.palavras.reduce(
      (total, palavra) =>
        total + palavra.fonte.widthOfTextAtSize(palavra.texto, tamanho),
      0,
    );
    const quantidadeEspacos = Math.max(0, linha.palavras.length - 1);
    const ultimaLinha = indiceLinha === linhas.length - 1;
    const espacoPadrao = contexto.fontes.normal.widthOfTextAtSize(" ", tamanho);
    const justificar =
      alinhamento === "justify" &&
      !ultimaLinha &&
      !linha.quebraForcada &&
      quantidadeEspacos > 0;
    const espaco = justificar
      ? (largura - larguraPalavras) / quantidadeEspacos
      : espacoPadrao;
    const larguraLinha =
      larguraPalavras + espacoPadrao * quantidadeEspacos;

    let posicaoX = x;
    if (alinhamento === "center") {
      posicaoX = x + (largura - larguraLinha) / 2;
    } else if (alinhamento === "right") {
      posicaoX = x + largura - larguraLinha;
    }

    linha.palavras.forEach((palavra, indicePalavra) => {
      if (indicePalavra) posicaoX += espaco;
      contexto.pagina.drawText(palavra.texto, {
        x: posicaoX,
        y: contexto.y,
        size: tamanho,
        font: palavra.fonte,
        color: PRETO,
      });
      posicaoX += palavra.fonte.widthOfTextAtSize(palavra.texto, tamanho);
    });

    contexto.y -= alturaLinha;
  });

  contexto.y -= depois;
}

function desenharTexto(contexto, texto, opcoes = {}) {
  desenharParagrafo(contexto, {
    segmentos: [{ texto }],
    ...opcoes,
  });
}

export async function gerarNotificacaoExtrajudicialPdf(dados) {
  const pdf = await PDFDocument.create();
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  const contexto = { pdf, fontes, pagina: null, y: TOPO_CORPO };
  adicionarPagina(contexto);

  const nomeCliente = valorInformado(dados.nomeCliente);
  const cpfCliente = valorInformado(dados.cpfCnpj);
  const banco = valorInformado(dados.banco).toUpperCase();
  const cnpjBanco = valorInformado(dados.cnpjBanco);
  const enderecoBanco = valorInformado(dados.enderecoBanco);
  const cidade = valorInformado(dados.cidade);
  const uf = valorInformado(dados.uf).toUpperCase();
  const valorFinanciamento = valorInformado(dados.valorFinanciamento);
  const valorFinanciamentoExtenso = valorInformado(
    dados.valorFinanciamentoExtenso,
  );
  const quantidadeParcelas = valorInformado(dados.quantidadeParcelas);
  const valorParcela = valorInformado(dados.valorParcela);
  const valorParcelaExtenso = valorInformado(dados.valorParcelaExtenso);

  desenharTexto(
    contexto,
    `${cidade}/${uf}, ${dataPorExtenso(dados.dataEmissao)}.`,
    { antes: 0, depois: 15 },
  );

  desenharParagrafo(contexto, {
    segmentos: [
      { texto: "À\n" },
      { texto: `${banco}\n`, negrito: true },
      { texto: "CNPJ nº " },
      { texto: `${cnpjBanco}\n`, negrito: true },
      { texto: enderecoBanco },
    ],
    antes: 0,
    depois: 4,
    manterJunto: true,
  });

  desenharParagrafo(contexto, {
    segmentos: [
      {
        texto:
          "Comunicação de Representação para Tratativas de Revisão Contratual",
        negrito: true,
      },
    ],
    tamanho: 12,
    antes: 18,
    depois: 4,
    manterJunto: true,
  });

  desenharParagrafo(contexto, {
    segmentos: [
      { texto: "Cliente/Notificante:", negrito: true },
      { texto: ` ${nomeCliente}\n` },
      { texto: "CPF:", negrito: true },
      { texto: ` ${cpfCliente}` },
    ],
    manterJunto: true,
  });

  desenharParagrafo(contexto, {
    segmentos: [
      { texto: "Representante Extrajudicial/Intermediadora:", negrito: true },
      { texto: " Platino Assessoria Financeira\n" },
      { texto: "CNPJ:", negrito: true },
      { texto: " 52.807.405/0001-30" },
    ],
    manterJunto: true,
  });

  desenharParagrafo(contexto, {
    segmentos: [
      { texto: "Instituição Financeira Notificada:", negrito: true },
      { texto: ` ${banco}\n` },
      { texto: "CNPJ:", negrito: true },
      { texto: ` ${cnpjBanco}` },
    ],
    manterJunto: true,
  });

  desenharParagrafo(contexto, {
    segmentos: [
      { texto: "A " },
      { texto: "PLATINO ASSESSORIA FINANCEIRA,", negrito: true },
      {
        texto:
          "pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ",
      },
      { texto: "52.807.405/0001-30,", negrito: true },
      {
        texto:
          "neste ato atuando por meio de representante devidamente autorizado, conforme instrumento de procuração anexo, em nome de ",
      },
      { texto: `${nomeCliente},`, negrito: true },
      { texto: "inscrito no CPF sob o nº " },
      { texto: `${cpfCliente},`, negrito: true },
      { texto: "vem, respeitosamente, apresentar a presente " },
      { texto: "NOTIFICAÇÃO EXTRAJUDICIAL,", negrito: true },
      {
        texto:
          "com a finalidade de comunicar a esta instituição financeira sua atuação como representante/intermediadora nas tratativas administrativas e extrajudiciais relacionadas à revisão contratual do cliente acima qualificado.",
      },
    ],
    alinhamento: "justify",
  });

  desenharParagrafo(contexto, {
    segmentos: [
      {
        texto:
          "A presente comunicação refere-se ao contrato de financiamento firmado entre o cliente e esta instituição financeira, relacionado ao financiamento de veículo no valor de ",
      },
      {
        texto: `R$ ${valorFinanciamento} (${valorFinanciamentoExtenso}),`,
        negrito: true,
      },
      { texto: "pactuado em " },
      {
        texto: `${quantidadeParcelas} parcelas mensais`,
        negrito: true,
      },
      { texto: " de " },
      {
        texto: `R$ ${valorParcela} (${valorParcelaExtenso}),`,
        negrito: true,
      },
      {
        texto:
          "ou conforme demais condições constantes no respectivo instrumento contratual.",
      },
    ],
    alinhamento: "justify",
  });

  desenharParagrafo(contexto, {
    segmentos: [
      {
        texto:
          "Por meio desta, fica formalmente comunicado que, a partir de ",
      },
      {
        texto: `${dataPorExtenso(dados.dataInicioRepresentacao)},`,
        negrito: true,
      },
      {
        texto:
          "a Platino Assessoria Financeira passará a ser responsável por todas as intermediações administrativas e extrajudiciais decorrentes da relação contratual originada do contrato firmado entre as partes.",
      },
    ],
    alinhamento: "justify",
  });

  desenharParagrafo(contexto, {
    segmentos: [
      {
        texto:
          "Dessa forma, todas as tratativas, comunicações, solicitações, documentos, esclarecimentos e demais informações referentes ao processo de análise e revisão contratual deverão ser direcionados à ",
      },
      { texto: "Platino Assessoria Financeira,", negrito: true },
      {
        texto:
          "que atuará como responsável extrajudicial pelo acompanhamento, intermediação e representação do referido cliente perante esta instituição financeira.",
      },
    ],
    alinhamento: "justify",
    depois: 25,
  });

  desenharTexto(
    contexto,
    "Para fins de análise técnica, conferência das condições pactuadas e regular acompanhamento da demanda, solicita-se, desde já, o envio de cópia integral do contrato de financiamento, incluindo eventuais anexos, aditivos, demonstrativos, proposta de crédito, condições gerais, planilha de evolução contratual e demais documentos vinculados à contratação.",
    { alinhamento: "justify" },
  );

  desenharTexto(
    contexto,
    "O documento solicitado deverá ser encaminhado, preferencialmente em formato eletrônico, para o seguinte endereço de e-mail:",
    { alinhamento: "justify" },
  );

  desenharTexto(contexto, "platinoassessoriafinanceira@gmail.com", {
    depois: 5,
  });

  desenharTexto(
    contexto,
    "Alternativamente, poderá ser encaminhado por correspondência física ao seguinte endereço:",
    { alinhamento: "justify" },
  );

  desenharTexto(
    contexto,
    "Rua Fontoura Xavier, nº 1308 - Itaquera - São Paulo/SP - CEP: 08295-300.",
  );

  desenharTexto(
    contexto,
    "Caso o fornecimento da cópia contratual dependa do pagamento de eventual taxa administrativa, solicita-se que a instituição financeira informe, por escrito, através do e-mail acima indicado:",
    { alinhamento: "justify" },
  );

  desenharTexto(
    contexto,
    "I. o valor a ser pago;\nII. a forma de pagamento disponível;\nIII. a cláusula contratual ou fundamento que autorize a cobrança.",
    { manterJunto: true },
  );

  desenharParagrafo(contexto, {
    segmentos: [
      {
        texto:
          "O não envio da documentação solicitada no prazo de ",
      },
      { texto: "7 (sete) dias úteis,", negrito: true },
      {
        texto:
          "contados do recebimento desta notificação, poderá ser interpretado como recusa tácita de fornecimento, autorizando a adoção das medidas administrativas e/ou judiciais cabíveis para obtenção dos documentos necessários à análise contratual, sem prejuízo de eventual apuração de danos decorrentes da não disponibilização de documento essencial à verificação dos direitos do consumidor.",
      },
    ],
    alinhamento: "justify",
  });

  desenharParagrafo(contexto, {
    segmentos: [
      {
        texto:
          "Por fim, requer-se que toda e qualquer comunicação relacionada ao contrato, à revisão contratual, às tratativas administrativas ou à documentação solicitada seja direcionada exclusivamente aos canais oficiais da ",
      },
      { texto: "Platino Assessoria Financeira,", negrito: true },
      {
        texto:
          "enquanto vigente a autorização conferida pelo cliente.",
      },
    ],
    alinhamento: "justify",
  });

  desenharTexto(
    contexto,
    "Sem mais para o momento, renovamos nossos votos de elevada consideração e permanecemos à disposição para o regular prosseguimento das tratativas.",
    { alinhamento: "justify" },
  );

  desenharTexto(contexto, "Cordialmente,", { depois: 5 });

  garantirEspaco(contexto, 70);
  desenharParagrafo(contexto, {
    segmentos: [
      { texto: "PLATINO ASSESSORIA FINANCEIRA\n", negrito: true },
      { texto: "CNPJ nº 52.807.405/0001-30\n", negrito: true },
      { texto: "Representante autorizado" },
    ],
    alinhamento: "center",
    antes: 1.5,
    depois: 0,
    manterJunto: true,
  });

  return pdf.save();
}
