import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGEM_ESQUERDA = 85.05;
const MARGEM_DIREITA = 77.95;
const LARGURA_TEXTO = A4[0] - MARGEM_ESQUERDA - MARGEM_DIREITA;
const PRETO = rgb(0, 0, 0);
const AZUL_PLATINO = rgb(0, 56 / 255, 168 / 255);
const AZUL_TITULO = rgb(23 / 255, 54 / 255, 93 / 255);

function texto(valor) {
  return String(valor || "").trim();
}

function dataPorExtenso(data) {
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
}

function formatarData(data) {
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${data}T12:00:00`),
  );
}

function flexoesGenero(genero) {
  if (genero === "feminino") {
    return { inscrito: "inscrita", informado: "informada" };
  }

  if (genero === "masculino") {
    return { inscrito: "inscrito", informado: "informado" };
  }

  return { inscrito: "inscrito(a)", informado: "informado(a)" };
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
    const larguraEspaco = palavras.length
      ? palavras.at(-1).fonte.widthOfTextAtSize(" ", tamanho)
      : 0;

    if (
      palavras.length &&
      largura + larguraEspaco + larguraPalavra > larguraMaxima
    ) {
      concluirLinha();
    }

    palavras.push(token);
    largura +=
      (palavras.length > 1
        ? palavras.at(-2).fonte.widthOfTextAtSize(" ", tamanho)
        : 0) + larguraPalavra;
  });

  if (palavras.length || linhas.length === 0) concluirLinha();
  return linhas;
}

function desenharParagrafo({
  pagina,
  fontes,
  segmentos,
  y,
  tamanho = 9.6,
  alturaLinha = 11.15,
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
    const justificar =
      alinhamento === "justify" &&
      !ultimaLinha &&
      !linha.quebraForcada &&
      quantidadeEspacos > 0;
    const espaco = justificar
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

  const titulo = "TERMO DE CIÊNCIA, AUTORIZAÇÃO E CONFIRMAÇÃO DE SEGURANÇA";
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

async function carregarAssinatura() {
  const resposta = await fetch(
    "/modelos/termo-ciencia-seguranca-assinatura.png",
  );
  if (!resposta.ok) {
    throw new Error("Não foi possível carregar a assinatura do modelo.");
  }
  return resposta.arrayBuffer();
}

export async function gerarTermoCienciaSegurancaPdfComAssets(
  dados,
  { assinaturaBytes } = {},
) {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage(A4);
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  const assinatura = assinaturaBytes
    ? await pdf.embedPng(assinaturaBytes)
    : null;

  desenharIdentidadeVisual(pagina, fontes);

  const nomeCliente = texto(dados.nomeCliente);
  const cpf = texto(dados.cpfCnpj);
  const banco = texto(dados.banco);
  const protocolo = texto(dados.numeroProtocolo);
  const flexoes = flexoesGenero(dados.genero);
  let y = 704;

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 10,
    alturaLinha: 12,
    segmentos: [
      { texto: `São Paulo/SP, ${dataPorExtenso(dados.dataEmissao)}.` },
    ],
  });

  y -= 5;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 14,
    segmentos: [
      {
        texto: "Abertura de Reclamação Administrativa via GOV.BR",
        negrito: true,
      },
    ],
  });

  y -= 10;
  const dadosAbertura = [
    ["Cliente:", nomeCliente],
    ["CPF:", cpf],
    ["Data da abertura da reclamação:", formatarData(dados.dataAberturaReclamacao)],
    ["Plataforma utilizada:", "GOV.BR / Consumidor.gov.br"],
    ["Instituição reclamada:", banco],
    ["Número de protocolo:", protocolo],
  ];

  dadosAbertura.forEach(([rotulo, valor]) => {
    y = desenharParagrafo({
      pagina,
      fontes,
      y,
      tamanho: 10,
      alturaLinha: 11.5,
      segmentos: [
        { texto: rotulo, negrito: true },
        { texto: ` ${valor}` },
      ],
    });
  });

  y -= 9;
  const paragrafos = [
    [
      { texto: "Eu, " },
      { texto: nomeCliente, negrito: true },
      { texto: `, ${flexoes.inscrito} no CPF sob o nº ` },
      { texto: cpf, negrito: true },
      {
        texto:
          ", declaro, para os devidos fins, que estou ciente e autorizo a Platino Assessoria Financeira a realizar, mediante minha autorização e com base nas informações por mim fornecidas, a abertura de reclamação administrativa na plataforma GOV.BR / Consumidor.gov.br, com o objetivo de contestar taxas, valores, encargos, juros ou demais condições relacionadas à revisão do meu contrato.",
      },
    ],
    [
      {
        texto: `Declaro que fui previamente ${flexoes.informado} sobre a natureza do serviço prestado, estando ciente de que a atuação da empresa se limita à abertura e registro da reclamação administrativa, bem como ao repasse do respectivo número de protocolo para meu acompanhamento.`,
      },
    ],
    [
      {
        texto:
          "Confirmo que autorizei o uso do acesso GOV.BR exclusivamente para a finalidade específica de registrar a reclamação administrativa mencionada neste termo, não autorizando qualquer outra utilização diversa da finalidade aqui descrita.",
      },
    ],
    [
      {
        texto:
          "Após a conclusão do procedimento, declaro que recebi o número de protocolo da reclamação, por meio do qual poderei acompanhar diretamente os próximos passos, respostas, manifestações e atualizações junto à plataforma competente.",
      },
    ],
    [
      {
        texto: `Declaro, ainda, que fui ${flexoes.informado} de que, após a finalização da abertura da reclamação, a empresa realizou o encerramento da sessão utilizada, deslogando o acesso e não mantendo salvo qualquer dado de login, senha, código de verificação, token, autenticação, print, arquivo ou registro que permita novo acesso à minha conta pessoal GOV.BR.`,
      },
    ],
    [
      { texto: "A " },
      { texto: "Platino Soluções Financeiras", negrito: true },
      {
        texto:
          " informa que adota medidas de segurança e confidencialidade para preservação dos dados pessoais do cliente, utilizando as informações fornecidas apenas para a finalidade autorizada neste termo, em observância às boas práticas de proteção de dados e à ",
      },
      { texto: "Lei Geral de Proteção de Dados - LGPD.", negrito: true },
    ],
  ];

  paragrafos.forEach((segmentos) => {
    y = desenharParagrafo({
      pagina,
      fontes,
      y,
      tamanho: 9.6,
      alturaLinha: 11.15,
      alinhamento: "justify",
      segmentos,
    });
    y -= 5;
  });

  const linhaAssinaturaY = Math.min(y - 15, 143);
  const larguraAssinatura = 162;
  const xCliente = MARGEM_ESQUERDA + 8;
  const xEmpresa = A4[0] - MARGEM_DIREITA - larguraAssinatura - 8;

  pagina.drawLine({
    start: { x: xCliente, y: linhaAssinaturaY },
    end: { x: xCliente + larguraAssinatura, y: linhaAssinaturaY },
    thickness: 0.8,
    color: PRETO,
  });

  if (assinatura) {
    const alturaImagem = 173;
    const proporcaoLinha = (524 - 307) / 524;
    pagina.drawImage(assinatura, {
      x: xEmpresa,
      y: linhaAssinaturaY - proporcaoLinha * alturaImagem,
      width: larguraAssinatura,
      height: alturaImagem,
    });
  } else {
    pagina.drawLine({
      start: { x: xEmpresa, y: linhaAssinaturaY },
      end: { x: xEmpresa + larguraAssinatura, y: linhaAssinaturaY },
      thickness: 0.8,
      color: PRETO,
    });
  }

  desenharParagrafo({
    pagina,
    fontes,
    y: linhaAssinaturaY - 17,
    x: xCliente,
    largura: larguraAssinatura,
    tamanho: 9,
    alturaLinha: 10.5,
    alinhamento: "center",
    segmentos: [{ texto: nomeCliente.toUpperCase(), negrito: true }],
  });

  desenharParagrafo({
    pagina,
    fontes,
    y: linhaAssinaturaY - 17,
    x: xEmpresa,
    largura: larguraAssinatura,
    tamanho: 9,
    alturaLinha: 10.5,
    alinhamento: "center",
    segmentos: [
      { texto: "PLATINO SOLUÇÕES FINANCEIRAS\n", negrito: true },
      { texto: "CNPJ nº 52.807.405/0001-30", negrito: true },
    ],
  });

  if (linhaAssinaturaY < 90 || y < 152) {
    throw new Error(
      "Os dados informados ultrapassaram o espaço disponível no modelo.",
    );
  }

  return pdf.save();
}

export async function gerarTermoCienciaSegurancaPdf(dados) {
  const assinaturaBytes = await carregarAssinatura();
  return gerarTermoCienciaSegurancaPdfComAssets(dados, { assinaturaBytes });
}
