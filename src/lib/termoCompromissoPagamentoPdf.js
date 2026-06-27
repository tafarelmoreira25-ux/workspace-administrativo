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

export async function gerarTermoCompromissoPagamentoPdf(dados) {
  const { pdf, pagina, fontes, yInicial } =
    await criarDocumentoPlatinoCompleto(
      "TERMO DE COMPROMISSO DE PAGAMENTO",
    );
  const nomeCliente = texto(dados.nomeCliente);
  let y = yInicial;

  const corpo = [
    {
      segmentos: [
        {
          texto:
            "Pelo presente instrumento particular, de um lado: PLATINO SOLUÇÕES FINANCEIRAS, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 52.807.405/0001-30, doravante denominada simplesmente ASSESSORIA. E, de outro lado:",
        },
        { texto: `${nomeCliente},`, negrito: true },
        { texto: " inscrito no CPF sob o nº " },
        { texto: `${texto(dados.cpfCnpj)},`, negrito: true },
        {
          texto:
            "doravante denominado simplesmente CLIENTE. Têm entre si, justo e acordado, o presente Termo de Compromisso de Pagamento, que será regido pelas cláusulas e condições abaixo.",
        },
      ],
    },
    {
      titulo: "CLÁUSULA PRIMEIRA - DO OBJETO",
      paragrafos: [
        [
          {
            texto:
              "1.1. O presente termo tem por objeto o reconhecimento, pelo CLIENTE, da responsabilidade pelo pagamento do valor total de R$",
          },
          {
            texto: `${valorMonetario(dados.valorTotal)} (${texto(dados.valorTotalExtenso)}),`,
            negrito: true,
          },
          { texto: " referente aos custos de " },
          { texto: `${texto(dados.servico)},`, negrito: true },
          {
            texto:
              "relacionados ao procedimento de revisão do contrato de financiamento.",
          },
        ],
        [
          {
            texto:
              "1.2. O CLIENTE declara estar ciente da natureza do serviço, dos valores envolvidos e da obrigação de pagamento assumida perante a ASSESSORIA.",
          },
        ],
      ],
    },
    {
      titulo: "CLÁUSULA SEGUNDA - DA RESPONSABILIDADE PELO PAGAMENTO",
      paragrafos: [
        [
          {
            texto:
              "2.1. O CLIENTE compromete-se a efetuar o pagamento integral do valor descrito na Cláusula Primeira no momento em que houver a restituição, recebimento ou disponibilização de valores decorrentes da revisão do contrato de financiamento.",
          },
        ],
        [
          {
            texto:
              "2.2. O pagamento deverá ser realizado diretamente à ASSESSORIA, por meio de chave PIX, transferência bancária, boleto ou outra forma de pagamento previamente indicada pela empresa.",
          },
        ],
        [
          {
            texto:
              "2.3. O presente compromisso permanece válido ainda que a restituição dos valores ocorra por acordo, negociação administrativa, decisão judicial, compensação, abatimento, quitação ou qualquer outra forma de benefício econômico obtido pelo CLIENTE em razão do procedimento realizado.",
          },
        ],
      ],
    },
    {
      titulo: "CLÁUSULA TERCEIRA - DO INADIMPLEMENTO",
      paragrafos: [
        [
          {
            texto:
              "3.1. O não pagamento do valor assumido neste termo, após a restituição ou disponibilização dos valores ao CLIENTE, poderá acarretar a cobrança administrativa do débito, sem prejuízo da adoção das medidas judiciais cabíveis para ressarcimento dos valores devidos.",
          },
        ],
        [
          {
            texto:
              "3.2. Em caso de atraso no pagamento, poderão incidir atualização monetária, juros, multa e demais encargos legais aplicáveis, além de eventuais despesas de cobrança.",
          },
        ],
      ],
    },
    {
      titulo: "CLÁUSULA QUARTA - DAS DISPOSIÇÕES FINAIS",
      paragrafos: [
        [
          {
            texto:
              "4.1. O CLIENTE declara que leu, compreendeu e concorda com todas as cláusulas do presente termo, assumindo de forma livre e consciente a obrigação de pagamento aqui estabelecida.",
          },
        ],
        [
          {
            texto:
              "4.2. O presente termo é firmado em caráter irrevogável e irretratável, obrigando as partes e seus sucessores ao fiel cumprimento das condições pactuadas.",
          },
        ],
      ],
    },
    {
      segmentos: [
        {
          texto:
            "E, por estarem assim justas e acordadas, as partes assinam o presente termo para que produza seus devidos efeitos legais.",
        },
      ],
    },
  ];

  corpo.forEach((bloco, indiceBloco) => {
    if (bloco.titulo) {
      y -= indiceBloco === 1 ? 8 : 7;
      y = desenharParagrafoPlatino({
        pagina,
        fontes,
        y,
        tamanho: 9.2,
        alturaLinha: 10.5,
        segmentos: [{ texto: bloco.titulo, negrito: true }],
      });

      bloco.paragrafos.forEach((segmentos) => {
        y -= 3;
        y = desenharParagrafoPlatino({
          pagina,
          fontes,
          y,
          tamanho: 9.2,
          alturaLinha: 10.5,
          alinhamento: "justify",
          segmentos,
        });
      });
      return;
    }

    y = desenharParagrafoPlatino({
      pagina,
      fontes,
      y,
      tamanho: 9.2,
      alturaLinha: 10.5,
      alinhamento: "justify",
      segmentos: bloco.segmentos,
    });
  });

  y = Math.min(y - 17, 155);
  y = desenharParagrafoPlatino({
    pagina,
    fontes,
    y,
    tamanho: 11,
    alturaLinha: 13,
    alinhamento: "center",
    segmentos: [
      {
        texto: `${texto(dados.localEmissao)}, ${dataPorExtenso(dados.dataEmissao)}.`,
      },
    ],
  });

  y -= 42;
  desenharAssinaturaPlatino(pagina, fontes, nomeCliente, y, 11);

  if (y < 68) {
    throw new Error(
      "Os dados informados ultrapassaram o espaço disponível no modelo.",
    );
  }

  return pdf.save();
}
