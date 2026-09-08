import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGEM_ESQUERDA = 85.05;
const MARGEM_DIREITA = 70.85;
const LARGURA_TEXTO = A4[0] - MARGEM_ESQUERDA - MARGEM_DIREITA;
const TOPO_CORPO = 690;
const BASE_CORPO = 78;
const TAMANHO_TEXTO = 11.5;
const ALTURA_LINHA = 14.1;
const PRETO = rgb(0, 0, 0);
const AZUL_PLATINO = rgb(0, 56 / 255, 168 / 255);
const AZUL_TITULO = rgb(23 / 255, 54 / 255, 93 / 255);

function texto(valor) {
  return String(valor || "").trim();
}

function valorMonetario(valor) {
  const informado = texto(valor);
  return informado.startsWith("R$") ? informado : `R$ ${informado}`;
}

function dataPorExtenso(data) {
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
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

  const titulos = [
    "NOTIFICAÇÃO EXTRAJUDICIAL –",
    "REVISÃO CONTRATUAL E CONTESTAÇÃO DE ENCARGOS",
  ];

  titulos.forEach((titulo, indice) => {
    const tamanho = indice === 0 ? 14 : 12.5;
    const largura = fontes.normal.widthOfTextAtSize(titulo, tamanho);
    pagina.drawText(titulo, {
      x: (A4[0] - largura) / 2,
      y: indice === 0 ? 761 : 742,
      size: tamanho,
      font: fontes.normal,
      color: AZUL_TITULO,
    });
  });

  pagina.drawLine({
    start: { x: MARGEM_ESQUERDA, y: 727 },
    end: { x: A4[0] - MARGEM_DIREITA, y: 727 },
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

function adicionarPagina(contexto) {
  const pagina = contexto.pdf.addPage(A4);

  if (contexto.fundo) {
    pagina.drawImage(contexto.fundo, {
      x: 43.5,
      y: 254,
      width: 523.3,
      height: 621.5,
      opacity: 0.34,
    });
  }

  desenharCabecalhoERodape(pagina, contexto.fontes);
  contexto.pagina = pagina;
  contexto.y = TOPO_CORPO;
}

function garantirEspaco(contexto, altura) {
  if (contexto.y - altura < BASE_CORPO) adicionarPagina(contexto);
}

function desenharParagrafo(
  contexto,
  {
    segmentos,
    tamanho = TAMANHO_TEXTO,
    alturaLinha = ALTURA_LINHA,
    antes = 4,
    depois = 5,
    alinhamento = "left",
    x = MARGEM_ESQUERDA,
    largura = LARGURA_TEXTO,
    manterJunto = false,
  },
) {
  const linhas = criarLinhas(segmentos, contexto.fontes, tamanho, largura);
  const alturaTotal = antes + linhas.length * alturaLinha + depois;
  if (manterJunto) garantirEspaco(contexto, alturaTotal);

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
    const espacoPadrao = contexto.fontes.normal.widthOfTextAtSize(" ", tamanho);
    const ultimaLinha = indiceLinha === linhas.length - 1;
    const justificar =
      alinhamento === "justify" &&
      !ultimaLinha &&
      !linha.quebraForcada &&
      quantidadeEspacos > 0;
    const espaco = justificar
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

function desenharTexto(contexto, textoInformado, opcoes = {}) {
  desenharParagrafo(contexto, {
    segmentos: [{ texto: textoInformado }],
    ...opcoes,
  });
}

async function carregarImagem(caminho) {
  const resposta = await fetch(caminho);
  if (!resposta.ok) {
    throw new Error("Não foi possível carregar a identidade visual do modelo.");
  }
  return resposta.arrayBuffer();
}

export async function gerarContestacaoTaxasEmailPdfComAssets(
  dados,
  { fundoBytes, assinaturaBytes } = {},
) {
  const pdf = await PDFDocument.create();
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  const fundo = fundoBytes ? await pdf.embedJpg(fundoBytes) : null;
  const assinatura = assinaturaBytes
    ? await pdf.embedPng(assinaturaBytes)
    : null;
  const contexto = {
    pdf,
    fontes,
    fundo,
    assinatura,
    pagina: null,
    y: TOPO_CORPO,
  };

  adicionarPagina(contexto);

  const banco = texto(dados.banco).toUpperCase();
  const nomeCliente = texto(dados.nomeCliente);
  const cpf = texto(dados.cpfCnpj);

  desenharParagrafo(contexto, {
    segmentos: [
      { texto: "À\n" },
      { texto: banco, negrito: true },
    ],
    antes: 0,
    depois: 12,
    manterJunto: true,
  });

  desenharTexto(contexto, "Prezados Senhores,", {
    antes: 0,
    depois: 9,
  });

  desenharParagrafo(contexto, {
    segmentos: [
      {
        texto:
          "A Platino Soluções Financeiras Ltda., pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 52.807.405/0001-30, com sede na Rua Fontoura Xavier, nº 1308, Itaquera, São Paulo/SP, na qualidade de representante do(a) Sr(a). ",
      },
      { texto: `${nomeCliente},`, negrito: true },
      { texto: " inscrito no CPF nº " },
      { texto: `${cpf},`, negrito: true },
      {
        texto:
          " vem, por meio da presente, apresentar NOTIFICAÇÃO EXTRAJUDICIAL, com fundamento nos princípios da boa-fé objetiva, da transparência contratual e da proteção ao consumidor, previstos no Código de Defesa do Consumidor.",
      },
    ],
    alinhamento: "justify",
  });

  desenharTexto(
    contexto,
    "Após análise do contrato de financiamento celebrado entre o consumidor e essa instituição financeira, foram identificados encargos cuja legalidade e razoabilidade demandam revisão, especialmente no que se refere à cobrança do seguinte valor:",
    { alinhamento: "justify" },
  );

  [
    ["Seguro", dados.valorSeguro],
    ["Registro de contrato", dados.valorRegistroContrato],
    ["Tarifa de avaliação", dados.valorTarifaAvaliacao],
    ["Tarifa de cadastro", dados.valorTarifaCadastro],
    ["IOF", dados.valorIof],
    ["IOF adicional", dados.valorIofAdicional],
    ["Demais Tarifas", dados.valorDemaisTarifas],
  ].forEach(([rotulo, valor], indice, itens) => {
    desenharParagrafo(contexto, {
      segmentos: [
        { texto: `• ${rotulo}: ` },
        { texto: valorMonetario(valor), negrito: true },
      ],
      tamanho: 11,
      alturaLinha: 13,
      x: MARGEM_ESQUERDA + 18,
      largura: LARGURA_TEXTO - 18,
      antes: indice === 0 ? 3 : 0,
      depois: indice === itens.length - 1 ? 7 : 1,
      manterJunto: true,
    });
  });

  [
    "Diante disso, requer-se a revisão do referido contrato, com a suspensão da exigibilidade dos valores contestados até a conclusão da análise administrativa, bem como a reavaliação dos encargos financeiros e das taxas de juros aplicadas, visando à exclusão de eventuais cobranças abusivas ou excessivamente onerosas.",
    "Requer-se, ainda, a apuração e restituição dos valores eventualmente pagos de forma indevida pelo consumidor, nos termos da legislação aplicável, especialmente do artigo 42 do Código de Defesa do Consumidor (Lei nº 8.078/1990), sem prejuízo de outros direitos que possam ser reconhecidos após análise detalhada da relação contratual.",
  ].forEach((paragrafo) => {
    desenharTexto(contexto, paragrafo, { alinhamento: "justify" });
  });

  garantirEspaco(contexto, 230);

  [
    "A presente notificação tem por finalidade buscar uma solução consensual e extrajudicial para a controvérsia, evitando a adoção de medidas administrativas e judiciais cabíveis, preservando-se, assim, os princípios da cooperação e da boa-fé entre as partes.",
    "Solicitamos manifestação formal dessa instituição financeira no prazo de 10 (dez) dias úteis, contados do recebimento desta notificação, informando as providências adotadas e eventual proposta para composição amigável da demanda.",
    "Permanecemos à disposição para o envio de documentos complementares e para quaisquer esclarecimentos que se façam necessários.",
  ].forEach((paragrafo) => {
    desenharTexto(contexto, paragrafo, { alinhamento: "justify" });
  });

  desenharTexto(
    contexto,
    `São Paulo, ${dataPorExtenso(dados.dataEmissao)}.`,
    {
      alinhamento: "center",
      antes: 8,
      depois: 10,
      manterJunto: true,
    },
  );

  garantirEspaco(contexto, 92);
  const larguraAssinatura = 66;
  const xAssinatura = (A4[0] - larguraAssinatura) / 2;

  if (contexto.assinatura) {
    contexto.pagina.drawImage(contexto.assinatura, {
      x: xAssinatura,
      y: contexto.y - 38,
      width: larguraAssinatura,
      height: 52,
    });
  }

  contexto.y -= 43;
  contexto.pagina.drawLine({
    start: { x: 145, y: contexto.y },
    end: { x: A4[0] - 145, y: contexto.y },
    thickness: 0.8,
    color: PRETO,
  });

  const linhasAssinatura = [
    "PLATINO SOLUÇÕES FINANCEIRAS",
    "CNPJ nº 52.807.405/0001-30",
  ];
  contexto.y -= 18;
  linhasAssinatura.forEach((linha) => {
    const larguraLinha = contexto.fontes.negrito.widthOfTextAtSize(linha, 10.5);
    contexto.pagina.drawText(linha, {
      x: (A4[0] - larguraLinha) / 2,
      y: contexto.y,
      size: 10.5,
      font: contexto.fontes.negrito,
      color: PRETO,
    });
    contexto.y -= 12.5;
  });

  return pdf.save();
}

export async function gerarContestacaoTaxasEmailPdf(dados) {
  const [fundoBytes, assinaturaBytes] = await Promise.all([
    carregarImagem("/modelos/contestacao-taxas-email-fundo.jpg"),
    carregarImagem("/modelos/contestacao-taxas-email-assinatura.png"),
  ]);

  return gerarContestacaoTaxasEmailPdfComAssets(dados, {
    fundoBytes,
    assinaturaBytes,
  });
}
