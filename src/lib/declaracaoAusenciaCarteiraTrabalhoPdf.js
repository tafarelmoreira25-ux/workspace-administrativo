import {
  criarDocumentoPlatinoCompleto,
  dataPorExtenso,
  desenharAssinaturaPlatino,
  desenharParagrafoPlatino,
} from "./documentoPlatinoCompletoPdf.js";

function formasGenero(genero) {
  if (genero === "feminino") {
    return {
      portador: "portadora",
      inscrito: "inscrita",
      domiciliado: "domiciliada",
    };
  }

  if (genero === "masculino") {
    return {
      portador: "portador",
      inscrito: "inscrito",
      domiciliado: "domiciliado",
    };
  }

  return {
    portador: "portador(a)",
    inscrito: "inscrito(a)",
    domiciliado: "domiciliado(a)",
  };
}

function texto(valor) {
  return String(valor || "").trim();
}

export async function gerarDeclaracaoAusenciaCarteiraTrabalhoPdf(dados) {
  const { pdf, pagina, fontes, yInicial } =
    await criarDocumentoPlatinoCompleto(
      "DECLARAÇÃO DE AUSÊNCIA DE CARTEIRA DE TRABALHO",
    );
  const genero = formasGenero(dados.genero);
  const nomeCliente = texto(dados.nomeCliente);
  let y = yInicial;

  y = desenharParagrafoPlatino({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 16,
    alinhamento: "justify",
    segmentos: [
      { texto: "Eu," },
      { texto: `${nomeCliente},`, negrito: true },
      {
        texto:
          `${texto(dados.nacionalidade)}, ${texto(dados.estadoCivil)}, ` +
          `${texto(dados.profissao)}, ${genero.portador} da Cédula de Identidade ` +
          `RG nº ${texto(dados.rg)}, ${genero.inscrito} no CPF/MF sob o nº ` +
          `${texto(dados.cpfCnpj)}, endereço eletrônico ${texto(dados.email)}, ` +
          `residente e ${genero.domiciliado} à ${texto(dados.endereco)}, declaro, ` +
          "para os devidos fins, sob as penas da lei, que não possuo Carteira de " +
          "Trabalho e Previdência Social - CTPS, seja em meio físico ou digital.",
      },
    ],
  });

  y -= 28;
  y = desenharParagrafoPlatino({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 16,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "Declaro, ainda, que as informações aqui prestadas são verdadeiras e assumo inteira responsabilidade civil e criminal por eventual falsidade ou omissão.",
        negrito: true,
      },
    ],
  });

  y -= 28;
  y = desenharParagrafoPlatino({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 16,
    alinhamento: "justify",
    segmentos: [
      {
        texto:
          "Por ser expressão da verdade, firmo a presente declaração para que produza seus devidos efeitos legais.",
      },
    ],
  });

  y = Math.min(y - 80, 270);
  y = desenharParagrafoPlatino({
    pagina,
    fontes,
    y,
    tamanho: 12,
    alturaLinha: 15,
    alinhamento: "center",
    segmentos: [
      {
        texto: `${texto(dados.localEmissao)}, ${dataPorExtenso(dados.dataEmissao)}.`,
      },
    ],
  });

  y -= 82;
  desenharAssinaturaPlatino(pagina, fontes, nomeCliente, y, 12);

  return pdf.save();
}
