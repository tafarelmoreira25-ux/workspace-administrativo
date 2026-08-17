import {
  A4,
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

export async function gerarProcuracaoPdf(dados) {
  const { pdf, pagina, fontes, yInicial } = await criarDocumentoVisual(
    "PROCURAÇÃO AD JUDICIA",
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
      { texto: "OUTORGANTE:", negrito: true },
      { texto: `${nome},`, negrito: true },
      {
        texto:
          `${dados.nacionalidade}, ${dados.estadoCivil}, ${dados.profissao}, ` +
          `${genero.portador} da Cédula de Identidade R.G. nº ${dados.rg}, ${dados.orgaoExpedidor}, ` +
          `${genero.inscrito} no C.P.F./M.F. sob nº ${dados.cpfCnpj}, com endereço ` +
          `eletrônico: ${dados.email}, residente e ${genero.domiciliado} na ` +
          `${dados.endereco} - CEP: ${dados.cep}.`,
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
      { texto: "OUTORGADO:", negrito: true },
      { texto: "Juliana Cristina Galzo,", negrito: true },
      {
        texto:
          "brasileira, divorciada, advogada inscrita na OAB/SP 524.585, com " +
          "endereço eletrônico: brajulianacgalzo@gmail.com, com escritório profissional " +
          "situado na Av. Cachoeira Paulista, nº 131, sala 3, Cidade Patriarca, " +
          "São Paulo - SP, CEP: 03551-000, onde recebe intimações e notificações.",
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
      { texto: "PODERES:", negrito: true },
      { texto: "Por este instrumento particular de procuração, o(a)" },
      { texto: "OUTORGANTE", negrito: true },
      { texto: "confere ao(à)" },
      { texto: "OUTORGADO(A)", negrito: true },
      {
        texto:
          "os mais amplos, gerais e ilimitados poderes para o foro em geral, em " +
          "qualquer juízo, instância ou tribunal, podendo propor quaisquer ações, " +
          "defesas, recursos, contrapor, aditar, desistir, confessar, transigir, firmar " +
          "compromissos ou acordos, requerer e retirar alvarás, receber valores, dar e " +
          "quitar recibos, requerer falências, concordatas ou recuperações judiciais, " +
          "assim como praticar todos e quaisquer atos necessários e convenientes ao bom " +
          "e fiel cumprimento do presente mandato.",
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
      { texto: "OBJETIVO:", negrito: true },
      {
        texto:
          "Os poderes ora concedidos destinam-se exclusivamente ao ingresso de Ação " +
          "de Revisão de Contrato, contra o",
      },
      { texto: `Banco ${dados.banco},`, negrito: true },
      { texto: "e nº de contrato" },
      { texto: `${dados.numeroContrato},`, negrito: true },
      { texto: "bem como na defesa de seus interesses." },
    ],
  });

  y -= 34;
  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    alinhamento: "center",
    segmentos: [
      { texto: `${dados.cidade}, ${dataPorExtenso(dados.dataEmissao)}.` },
    ],
  });

  y = Math.min(y - 60, 170);
  desenharAssinatura(pagina, fontes, nome, y);

  if (y < 90 || y > A4[1]) {
    throw new Error(
      "Os dados informados ultrapassaram o espaço disponível no modelo.",
    );
  }

  return pdf.save();
}
