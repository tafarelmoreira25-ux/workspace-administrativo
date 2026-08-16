import {
  criarDocumentoVisual,
  desenharAssinatura,
  desenharParagrafo,
} from "./documentoVisualPdf.js";

function dataPorExtenso(data) {
  if (!data) return "";
  const valor = new Date(`${data}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
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
      inscrito: "inscrita",
      domiciliado: "domiciliada",
    };
  }

  return {
    portador: "portador(a)",
    inscrito: "inscrito(a)",
    domiciliado: "domiciliado(a)",
  };
}

export async function gerarDeclaracaoHipossuficienciaPdf(dados) {
  const { pdf, pagina, fontes, yInicial } = await criarDocumentoVisual(
    "DECLARAÇÃO DE HIPOSSUFICIÊNCIA\nNOS TERMOS DA LEI 1.060/50",
  );
  const genero = formasGenero(dados.genero);
  const nome = dados.nomeCliente?.trim() || "";
  let y = yInicial;

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "justify",
    segmentos: [
      { texto: "Eu," },
      { texto: `${nome},`, negrito: true },
      {
        texto:
          `${dados.nacionalidade}, ${dados.estadoCivil}, ${dados.profissao}, ` +
          `${genero.portador} da Cédula de Identidade RG nº ${dados.rg} ` +
          `${dados.orgaoExpedidor}, ${genero.inscrito} no CPF/MF sob nº ` +
          `${dados.cpfCnpj}, com endereço eletrônico: ${dados.email}, residente e ` +
          `${genero.domiciliado} na ${dados.endereco}. Venho respeitosamente perante ` +
          "Vossa Excelência, por meio deste instrumento, declarar que não tenho " +
          "condições financeiras para custear os encargos atinentes a qualquer processo " +
          "judicial, sem prejuízo da manutenção do meu próprio sustento, requerendo, por " +
          "tais razões, os BENEFÍCIOS DA JUSTIÇA GRATUITA, conforme o art. 4º da Lei " +
          "1.060/50 c/c o art. 98 do Código de Processo Civil (CPC).",
      },
    ],
  });

  y -= 28;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      {
        texto:
          "Esta declaração presume-se verdadeira, sob as penas da Lei.",
      },
    ],
  });

  y = Math.min(y - 55, 270);
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "center",
    segmentos: [
      {
        texto:
          `${dados.cidade || ""}-${String(dados.uf || "").toUpperCase()}, ` +
          `${dataPorExtenso(dados.dataEmissao)}.`,
      },
    ],
  });

  y -= 62;
  desenharAssinatura(pagina, fontes, nome, y);

  return pdf.save();
}

export async function gerarDeclaracaoIsencaoIrpfPdf(dados) {
  const { pdf, pagina, fontes, yInicial } = await criarDocumentoVisual(
    "DECLARAÇÃO DE ISENÇÃO DO IMPOSTO DE RENDA\nPESSOA FÍSICA (IRPF)",
  );
  const genero = formasGenero(dados.genero);
  const nome = dados.nomeCliente?.trim() || "";
  let y = yInicial;

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 11,
    alturaLinha: 14,
    alinhamento: "justify",
    segmentos: [
      { texto: "Eu," },
      { texto: `${nome},`, negrito: true },
      {
        texto:
          `${dados.nacionalidade}, ${dados.estadoCivil}, ${dados.profissao}, ` +
          `${genero.portador} da Cédula de Identidade R.G. nº ${dados.rg}, ${dados.orgaoExpedidor}, ` +
          `${genero.inscrito} no C.P.F./M.F. sob nº ${dados.cpfCnpj}, com endereço ` +
          `eletrônico: ${dados.email}, residente e ${genero.domiciliado} na ` +
          `${dados.endereco}. Declaro ser isento(a) da apresentação da Declaração do ` +
          "Imposto de Renda Pessoa Física (DIRPF) no(s) exercício(s) de " +
          `${dados.exercicios}, por não incorrer em nenhuma das hipóteses de ` +
          "obrigatoriedade estabelecidas pelas Instruções Normativas (IN) da Receita " +
          "Federal do Brasil (RFB). Esta declaração está em conformidade com a IN RFB " +
          "nº 1548/2015 e a Lei nº 7.115/83*. Declaro ainda, sob as penas da lei, serem " +
          "verdadeiras todas as informações acima prestadas.",
      },
    ],
  });

  y -= 22;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 11,
    alturaLinha: 14,
    alinhamento: "center",
    segmentos: [
      {
        texto:
          `${dados.cidade || ""}-${String(dados.uf || "").toUpperCase()}, ` +
          `${dataPorExtenso(dados.dataEmissao)}.`,
      },
    ],
  });

  y -= 46;
  desenharAssinatura(pagina, fontes, nome, y);

  y -= 78;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 7.3,
    alturaLinha: 8.8,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "* Esclarecemos que a Receita Federal do Brasil não emite declaração de que " +
          "o(a) cidadão(ã) está isento(a) de apresentar a Declaração do Imposto de Renda " +
          "da Pessoa Física (DIRPF), pois a Instrução Normativa RFB nº 1548, de 25 de " +
          "fevereiro de 2015, regula que, a partir do ano de 2008, deixa de existir a " +
          "Declaração Anual de Isento. Ademais, a Lei nº 7.115/83 assegura que a isenção " +
          "poderá ser comprovada mediante declaração escrita e assinada pelo próprio " +
          "interessado. Mais informações podem ser obtidas na página da RFB na internet: " +
          "http://receita.economia.gov.br/orientacao/tributaria/declaracoes-e-demonstrativos/dai-declaracao-anual-de-isento",
      },
    ],
  });

  y -= 8;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 7.5,
    alturaLinha: 9,
    segmentos: [
      {
        texto: "LEI Nº 7.115, DE 29 DE AGOSTO DE 1983.",
        negrito: true,
      },
    ],
  });

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    tamanho: 7,
    alturaLinha: 8.5,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "Dispõe sobre prova documental nos casos que indica e dá outras providências. " +
          "O PRESIDENTE DA REPÚBLICA, faço saber que o Congresso Nacional decreta e eu " +
          "sanciono a seguinte Lei: Art. 1º - A declaração destinada a fazer prova de " +
          "vida, residência, pobreza, dependência econômica, homonímia ou bons " +
          "antecedentes, quando firmada pelo próprio interessado ou por procurador " +
          "bastante, e sob as penas da Lei, presume-se verdadeira. Parágrafo único - O " +
          "disposto neste artigo não se aplica para fins de prova em processo penal. " +
          "Art. 2º - Se comprovadamente falsa a declaração, sujeitar-se-á o declarante às " +
          "sanções civis, administrativas e criminais previstas na legislação aplicável. " +
          "Art. 3º - A declaração mencionará expressamente a responsabilidade do " +
          "declarante. Art. 4º - Esta Lei entra em vigor na data de sua publicação. " +
          "Art. 5º - Revogam-se as disposições em contrário.",
      },
    ],
  });

  if (y < 28) {
    throw new Error(
      "Os dados informados ultrapassaram o espaço disponível no modelo.",
    );
  }

  return pdf.save();
}
