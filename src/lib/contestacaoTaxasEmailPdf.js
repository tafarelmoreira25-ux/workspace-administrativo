import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MODELO_URL = `${import.meta.env.BASE_URL}modelos/contestacao-taxas-email.pdf`;
const PRETO = rgb(0, 0, 0);

const CAMPOS = {
  banco: { pagina: 0, x: 130.05, topo: 180.55, tamanho: 12, largura: 200.95 },
  nomeCliente: {
    pagina: 0,
    x: 360,
    topo: 266.5,
    tamanho: 12,
    largura: 81.65,
    negrito: true,
  },
  cpfCnpj: { pagina: 0, x: 97.8, topo: 280.5, tamanho: 12, largura: 105.3 },
  valorSeguro: {
    pagina: 0,
    x: 154.75,
    topo: 415.9,
    tamanho: 11,
    largura: 72,
  },
  valorRegistroContrato: {
    pagina: 0,
    x: 212.8,
    topo: 436.3,
    tamanho: 11,
    largura: 63.4,
  },
  valorTarifaAvaliacao: {
    pagina: 0,
    x: 208.5,
    topo: 455.65,
    tamanho: 11,
    largura: 63.4,
  },
  valorIof: {
    pagina: 0,
    x: 141.85,
    topo: 475,
    tamanho: 11,
    largura: 63.4,
  },
  valorIofAdicional: {
    pagina: 0,
    x: 184.85,
    topo: 494.35,
    tamanho: 11,
    largura: 63.4,
  },
};

function texto(valor) {
  return String(valor || "").trim();
}

function valorMonetario(valor) {
  return texto(valor).replace(/^R\$\s*/i, "");
}

function tamanhoAjustado(fonte, valor, tamanho, largura) {
  let tamanhoFinal = tamanho;

  while (
    tamanhoFinal > 6 &&
    fonte.widthOfTextAtSize(valor, tamanhoFinal) > largura
  ) {
    tamanhoFinal -= 0.25;
  }

  return tamanhoFinal;
}

function desenharCampo(paginas, fontes, configuracao, valor) {
  const pagina = paginas[configuracao.pagina];
  const fonte = configuracao.negrito ? fontes.negrito : fontes.normal;
  const conteudo = texto(valor);
  const tamanho = tamanhoAjustado(
    fonte,
    conteudo,
    configuracao.tamanho,
    configuracao.largura,
  );

  pagina.drawText(conteudo, {
    x: configuracao.x,
    y: pagina.getHeight() - configuracao.topo - tamanho,
    size: tamanho,
    font: fonte,
    color: PRETO,
  });
}

function dataPorExtenso(data) {
  if (!data) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00`));
}

export async function gerarContestacaoTaxasEmailPdf(dados) {
  const resposta = await fetch(MODELO_URL);
  if (!resposta.ok) {
    throw new Error("Não foi possível carregar o modelo de contestação das taxas.");
  }

  const pdf = await PDFDocument.load(await resposta.arrayBuffer());
  const paginas = pdf.getPages();
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };

  desenharCampo(paginas, fontes, CAMPOS.banco, dados.banco);
  desenharCampo(paginas, fontes, CAMPOS.nomeCliente, dados.nomeCliente);
  desenharCampo(paginas, fontes, CAMPOS.cpfCnpj, dados.cpfCnpj);
  desenharCampo(
    paginas,
    fontes,
    CAMPOS.valorSeguro,
    valorMonetario(dados.valorSeguro),
  );
  desenharCampo(
    paginas,
    fontes,
    CAMPOS.valorRegistroContrato,
    valorMonetario(dados.valorRegistroContrato),
  );
  desenharCampo(
    paginas,
    fontes,
    CAMPOS.valorTarifaAvaliacao,
    valorMonetario(dados.valorTarifaAvaliacao),
  );
  desenharCampo(
    paginas,
    fontes,
    CAMPOS.valorIof,
    valorMonetario(dados.valorIof),
  );
  desenharCampo(
    paginas,
    fontes,
    CAMPOS.valorIofAdicional,
    valorMonetario(dados.valorIofAdicional),
  );

  const paginaData = paginas[1];
  const data = `São Paulo, ${dataPorExtenso(dados.dataEmissao)}.`;
  const tamanhoData = 12;
  const larguraData = fontes.normal.widthOfTextAtSize(data, tamanhoData);
  paginaData.drawText(data, {
    x: (paginaData.getWidth() - larguraData) / 2,
    y: paginaData.getHeight() - 538.4 - tamanhoData,
    size: tamanhoData,
    font: fontes.normal,
    color: PRETO,
  });

  return pdf.save();
}
