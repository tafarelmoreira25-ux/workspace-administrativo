import {
  criarDocumentoPlatinoCompleto,
  dataPorExtenso,
  desenharAssinaturaPlatino,
  desenharParagrafoPlatino,
} from "./documentoPlatinoCompletoPdf.js";

function texto(valor) {
  return String(valor || "").trim();
}

function valorMonetario(valor) {
  return texto(valor).replace(/^R\$\s*/i, "");
}

export async function gerarTermoCienciaPagamentoPdf(dados) {
  const { pdf, pagina, fontes, yInicial } =
    await criarDocumentoPlatinoCompleto("TERMO DE CIENCIA DE PAGAMENTO");
  const nomeCliente = texto(dados.nomeCliente);
  let y = yInicial;

  const corpo = [
    [
      {
        texto:
          "Pelo presente instrumento particular, de um lado: PLATINO SOLUCOES FINANCEIRAS, pessoa juridica de direito privado, inscrita no CNPJ sob o no 52.807.405/0001-30, doravante denominada simplesmente ASSESSORIA. E, de outro lado:",
      },
      { texto: `${nomeCliente},`, negrito: true },
      { texto: "inscrito no CPF sob o no" },
      { texto: `${texto(dados.cpfCnpj)},`, negrito: true },
      { texto: "doravante denominado simplesmente CLIENTE." },
    ],
    [
      {
        texto:
          "O presente termo tem por objeto o reconhecimento, pelo CLIENTE, da responsabilidade pelo pagamento do valor total de R$",
      },
      {
        texto: `${valorMonetario(dados.valorTotal)} (${texto(dados.valorTotalExtenso)}),`,
        negrito: true,
      },
      { texto: "parcelado em" },
      { texto: `${texto(dados.quantidadeParcelas)} vezes`, negrito: true },
      { texto: "no cartao." },
    ],
    [
      { texto: "Referente aos custos de" },
      { texto: `${texto(dados.produto)},`, negrito: true },
      {
        texto:
          "relacionados ao procedimento de revisao do contrato de financiamento.",
      },
    ],
  ];

  corpo.forEach((segmentos, indice) => {
    if (indice > 0) y -= 12;
    y = desenharParagrafoPlatino({
      pagina,
      fontes,
      y,
      tamanho: 12,
      alturaLinha: 14.5,
      alinhamento: "justify",
      segmentos,
    });
  });

  y = Math.min(y - 72, 360);
  y = desenharParagrafoPlatino({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 14,
    alinhamento: "center",
    segmentos: [
      {
        texto: `${texto(dados.localEmissao)}, ${dataPorExtenso(dados.dataEmissao)}.`,
      },
    ],
  });

  y -= 54;
  desenharAssinaturaPlatino(pagina, fontes, nomeCliente, y, 12);

  if (y < 68) {
    throw new Error(
      "Os dados informados ultrapassaram o espaco disponivel no modelo.",
    );
  }

  return pdf.save();
}
