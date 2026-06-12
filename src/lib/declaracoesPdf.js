import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGEM = 70;
const LARGURA = A4[0] - MARGEM * 2;
const PRETO = rgb(0, 0, 0);

function dataPorExtenso(data) {
  if (!data) return "";
  const valor = new Date(`${data}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(valor);
}

function formasGenero(genero) {
  if (genero === "masculino") {
    return {
      portador: "portador",
      inscrito: "inscrito",
      domiciliado: "domiciliado",
    };
  }

  if (genero === "feminino") {
    return {
      portador: "portadora",
      inscrita: "inscrita",
      domiciliado: "domiciliada",
    };
  }

  return {
    portador: "portador(a)",
    inscrito: "inscrito(a)",
    domiciliado: "domiciliado(a)",
  };
}

function quebrarTexto(texto, fonte, tamanho, larguraMaxima) {
  const lines = [];

  String(texto)
    .split("\n")
    .forEach((paragrafo) => {
      if (!paragrafo.trim()) {
        lines.push("");
        return;
      }

      const palavras = paragrafo.trim().split(/\s+/);
      let linha = "";

      palavras.forEach((palavra) => {
        const tentativa = linha ? `${linha} ${palavra}` : palavra;
        if (fonte.widthOfTextAtSize(tentativa, tamanho) <= larguraMaxima) {
          linha = tentativa;
        } else {
          if (linha) lines.push(linha);
          linha = palavra;
        }
      });

      if (linha) lines.push(linha);
    });

  return lines;
}

function desenharTexto({
  pagina,
  texto,
  fonte,
  tamanho,
  y,
  alturaLinha,
  largura = LARGURA,
  x = MARGEM,
  alinhamento = "left",
}) {
  const linhas = quebrarTexto(texto, fonte, tamanho, largura);

  linhas.forEach((linha) => {
    let posicaoX = x;
    const larguraLinha = fonte.widthOfTextAtSize(linha, tamanho);

    if (alinhamento === "center") {
      posicaoX = x + (largura - larguraLinha) / 2;
    } else if (alinhamento === "right") {
      posicaoX = x + largura - larguraLinha;
    }

    pagina.drawText(linha, {
      x: posicaoX,
      y,
      size: tamanho,
      font: fonte,
      color: PRETO,
    });
    y -= alturaLinha;
  });

  return y;
}

function desenharAssinatura(pagina, fontes, nome, y) {
  const larguraLinha = 280;
  const x = (A4[0] - larguraLinha) / 2;

  pagina.drawLine({
    start: { x, y },
    end: { x: x + larguraLinha, y },
    thickness: 0.8,
    color: PRETO,
  });

  desenharTexto({
    pagina,
    texto: nome.toUpperCase(),
    fonte: fontes.negrito,
    tamanho: 9,
    y: y - 17,
    alturaLinha: 12,
    largura: larguraLinha,
    x,
    alinhamento: "center",
  });
}

async function criarDocumento() {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage(A4);
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  return { pdf, pagina, fontes };
}

export async function gerarDeclaracaoIsencaoIrpfPdf(dados) {
  const { pdf, pagina, fontes } = await criarDocumento();
  const genero = formasGenero(dados.genero);
  
  // Iniciando um pouco mais abaixo do topo absoluto
  let y = A4[1] - 85; 

  y = desenharTexto({
    pagina,
    texto: "DECLARAÇÃO DE ISENÇÃO DO IMPOSTO DE RENDA PESSOA FÍSICA (IRPF)",
    fonte: fontes.negrito,
    tamanho: 13,
    y,
    alturaLinha: 16,
    alinhamento: "center",
  });

  // AUMENTADO: Mais espaço entre o Título e o Texto da declaração (era 30)
  y -= 60; 
  
  const declaracao =
    `Eu, ${dados.nomeCliente}, ${dados.nacionalidade}, ${dados.estadoCivil}, ` +
    `${dados.profissao}, ${genero.portador} da Cédula de Identidade R.G. nº ${dados.rg}, ` +
    `${genero.inscrito} no C.P.F./M.F. sob nº ${dados.cpfCnpj}, com endereço eletrônico: ` +
    `${dados.email}, residente e ${genero.domiciliado} na ${dados.endereco}. Declaro ser ` +
    `isento(a) da apresentação da Declaração do Imposto de Renda Pessoa Física (DIRPF) ` +
    `no(s) exercício(s) de ${dados.exercicios}, por não incorrer em nenhuma das hipóteses ` +
    "de obrigatoriedade estabelecidas pelas Instruções Normativas (IN) da Receita Federal " +
    "do Brasil (RFB). Esta declaração está em conformidade com a IN RFB nº 1548/2015 e a " +
    "Lei nº 7.115/83*. Declaro ainda, sob as penas da lei, serem verdadeiras todas as " +
    "informações acima prestadas.";

  y = desenharTexto({
    pagina,
    texto: declaracao,
    fonte: fontes.normal,
    tamanho: 9.5,
    y,
    alturaLinha: 16, // Aumentado levemente o espaçamento entre linhas do texto para encorpar
  });

  // AUMENTADO: Mais espaço antes da data/cidade (era 23)
  y -= 50; 
  
  y = desenharTexto({
    pagina,
    texto: `${dados.cidade.toUpperCase()}-${dados.uf.toUpperCase()}, ${dataPorExtenso(dados.dataEmissao).toUpperCase()}.`,
    fonte: fontes.normal,
    tamanho: 9.5,
    y,
    alturaLinha: 13,
    alinhamento: "center",
  });

  // AUMENTADO: Mais espaço antes da assinatura (era 34) para empurrá-la para baixo
  y -= 75; 
  desenharAssinatura(pagina, fontes, dados.nomeCliente, y);

  // AUMENTADO: Mais espaço após a assinatura antes do rodapé de leis (era 67)
  y -= 90; 
  
  const esclarecimento =
    "* Esclarecemos que a Receita Federal do Brasil não emite declaração de que o(a) " +
    "cidadão(ã) está isento(a) de apresentar a Declaração do Imposto de Renda da Pessoa " +
    "Física (DIRPF), pois a Instrução Normativa RFB nº 1548, de 25 de fevereiro de 2015, " +
    "regula que, a partir do ano de 2008, deixa de existir a Declaração Anual de Isento. " +
    "Ademais, a Lei nº 7.115/83 assegura que a isenção poderá ser comprovada mediante " +
    "declaração escrita e assinada pelo próprio interessado. Mais informações podem ser " +
    "obtidas na página da RFB na internet:\n" +
    "http://receita.economia.gov.br/orientacao/tributaria/declaracoes-e-demonstrativos/dai-declaracao-anual-de-isento";

  y = desenharTexto({
    pagina,
    texto: esclarecimento,
    fonte: fontes.normal,
    tamanho: 6.5,
    y,
    alturaLinha: 8.5,
  });

  y -= 12; // Aumentado um pouco
  y = desenharTexto({
    pagina,
    texto: "LEI Nº 7.115, DE 29 DE AGOSTO DE 1983.",
    fonte: fontes.negrito,
    tamanho: 7,
    y,
    alturaLinha: 9,
  });

  y = desenharTexto({
    pagina,
    texto:
      "Dispõe sobre prova documental nos casos que indica e dá outras providências.\n" +
      "O PRESIDENTE DA REPÚBLICA, faço saber que o Congresso Nacional decreta e eu sanciono a seguinte Lei:\n" +
      "Art. 1º - A declaração destinada a fazer prova de vida, residência, pobreza, dependência econômica, homonímia ou bons antecedentes, quando firmada pelo próprio interessado ou por procurador bastante, e sob as penas da Lei, presume-se verdadeira. Parágrafo único - O disposto neste artigo não se aplica para fins de prova em processo penal.\n" +
      "Art. 2º - Se comprovadamente falsa a declaração, sujeitar-se-á o declarante às sanções civis, administrativas e criminais previstas na legislação aplicável.\n" +
      "Art. 3º - A declaração mencionará expressamente a responsabilidade do declarante. Art. 4º - Esta Lei entra em vigor na data de sua publicação.\n" +
      "Art. 5º - Revogam-se as disposições em contrário.",
    fonte: fontes.normal,
    tamanho: 6.2,
    y,
    alturaLinha: 8,
  });

  // Ajustado o limite de segurança do rodapé
  if (y < 20) {
    throw new Error("Os dados informados ultrapassaram o espaço disponível no modelo.");
  }

  return pdf.save();
}

export async function gerarDeclaracaoHipossuficienciaPdf(dados) {
  const { pdf, pagina, fontes } = await criarDocumento();
  const genero = formasGenero(dados.genero);
  
  // Iniciando um pouco mais abaixo do topo (era 78)
  let y = A4[1] - 100; 

  y = desenharTexto({
    pagina,
    texto: "DECLARAÇÃO DE HIPOSSUFICIÊNCIA\nNOS TERMOS DA LEI 1.060/50",
    fonte: fontes.negrito,
    tamanho: 14,
    y,
    alturaLinha: 18,
    alinhamento: "center",
  });

  // AUMENTADO: Mais respiro abaixo do título (era 42)
  y -= 80; 
  
  const declaracao =
    `Eu, ${dados.nomeCliente}, ${dados.nacionalidade}, ${dados.estadoCivil}, ` +
    `${dados.profissao}, ${genero.portador} da Cédula de Identidade RG n.º ${dados.rg} ` +
    `${dados.orgaoExpedidor}, ${genero.inscrito} no CPF/MF sob n.º ${dados.cpfCnpj}, com ` +
    `endereço eletrônico: ${dados.email}, residente e ${genero.domiciliado} na: ` +
    `${dados.endereco}. Venho respeitosamente perante Vossa Excelência, por meio deste ` +
    "instrumento, declarar que não tenho condições financeiras para custear os encargos " +
    "atinentes a qualquer processo judicial, sem prejuízo da manutenção do meu próprio " +
    "sustento, requerendo, por tais razões, os BENEFÍCIOS DA JUSTIÇA GRATUITA, conforme " +
    "o art. 4º da Lei 1.060/50 c/c o art. 98 do Código de Processo Civil (CPC).";

  y = desenharTexto({
    pagina,
    texto: declaracao,
    fonte: fontes.normal,
    tamanho: 10.5,
    y,
    alturaLinha: 18, // Espaçamento entre linhas aumentado para encorpar o texto na página
  });

  // AUMENTADO: Espaço entre o parágrafo principal e a frase de efeito (era 24)
  y -= 40; 
  
  y = desenharTexto({
    pagina,
    texto: "Esta declaração presume-se verdadeira, sob as penas da Lei.",
    fonte: fontes.normal,
    tamanho: 10.5,
    y,
    alturaLinha: 16,
  });

  // Como a declaração de hipossuficiência não possui textos legais compridos embaixo,
  // podemos usar o marginTop dinâmico de forma fixa para jogá-la bem para baixo.
  // Fixando o Y da Cidade/Data e Assinatura para ficarem distribuídos no terço inferior da página.
  y = 260; 

  y = desenharTexto({
    pagina,
    texto: `${dados.cidade.toUpperCase()}-${dados.uf.toUpperCase()}, ${dataPorExtenso(dados.dataEmissao)}.`,
    fonte: fontes.normal,
    tamanho: 10,
    y,
    alturaLinha: 14,
    alinhamento: "center",
  });

  // Distância confortável entre a data e a linha de assinatura
  y -= 85; 
  desenharAssinatura(pagina, fontes, dados.nomeCliente, y);

  return pdf.save();
}
