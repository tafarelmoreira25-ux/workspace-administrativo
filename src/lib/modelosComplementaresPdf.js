import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const A4_PAISAGEM = [841.89, 595.28];
const MARGEM = 82;
const AZUL = rgb(0, 56 / 255, 168 / 255);
const AZUL_TITULO = rgb(23 / 255, 54 / 255, 93 / 255);

function dataBrasileira(valor) {
  if (!valor) return "não informada";
  const data = new Date(`${valor}T12:00:00`);
  return Number.isNaN(data.getTime())
    ? String(valor)
    : new Intl.DateTimeFormat("pt-BR").format(data);
}

function moeda(valor) {
  return valor ? `R$ ${valor}` : "não informado";
}

function criarLinhas(texto, fonte, tamanho, largura) {
  const linhas = [];
  String(texto || "")
    .split(/\r?\n/)
    .forEach((paragrafo) => {
      const palavras = paragrafo.split(/\s+/).filter(Boolean);
      if (!palavras.length) {
        linhas.push("");
        return;
      }
      let linha = "";
      palavras.forEach((palavra) => {
        const tentativa = linha ? `${linha} ${palavra}` : palavra;
        if (linha && fonte.widthOfTextAtSize(tentativa, tamanho) > largura) {
          linhas.push(linha);
          linha = palavra;
        } else {
          linha = tentativa;
        }
      });
      if (linha) linhas.push(linha);
    });
  return linhas;
}

async function carregarImagem(caminho) {
  const resposta = await fetch(caminho);
  if (!resposta.ok) return null;
  return resposta.arrayBuffer();
}

function criarPagina(pdf, fontes, titulo, opcoes = {}) {
  const tamanhoPagina = opcoes.tamanhoPagina || A4;
  const margem = opcoes.margem ?? MARGEM;
  const pagina = pdf.addPage(tamanhoPagina);
  pagina.drawRectangle({ x: 0, y: 0, width: 24, height: tamanhoPagina[1], color: AZUL });
  const larguraTitulo = fontes.negrito.widthOfTextAtSize(titulo, 14);
  pagina.drawText(titulo, {
    x: (tamanhoPagina[0] - larguraTitulo) / 2,
    y: tamanhoPagina[1] - 87,
    size: 14,
    font: fontes.negrito,
    color: AZUL_TITULO,
  });
  pagina.drawLine({
    start: { x: margem, y: tamanhoPagina[1] - 104 },
    end: { x: tamanhoPagina[0] - margem, y: tamanhoPagina[1] - 104 },
    thickness: 1.2,
    color: rgb(0.62, 0.62, 0.62),
  });
  return pagina;
}

function escreverDocumento(pdf, fontes, titulo, blocos, opcoesDocumento = {}) {
  const tamanhoPagina = opcoesDocumento.tamanhoPagina || A4;
  const margem = opcoesDocumento.margem ?? MARGEM;
  const larguraTexto = tamanhoPagina[0] - margem * 2;
  const yInicial = opcoesDocumento.yInicial ?? tamanhoPagina[1] - 138;
  const yMinimo = opcoesDocumento.yMinimo ?? 72;
  let pagina = criarPagina(pdf, fontes, titulo, opcoesDocumento);
  let y = yInicial;

  const paragrafo = (texto, opcoes = {}) => {
    const fonte = opcoes.negrito ? fontes.negrito : fontes.normal;
    const tamanho = opcoes.tamanho || 10.5;
    const altura = opcoes.altura || 14;
    const linhas = criarLinhas(texto, fonte, tamanho, opcoes.largura || larguraTexto);
    linhas.forEach((linha) => {
      if (y < yMinimo) {
        pagina = criarPagina(pdf, fontes, titulo, opcoesDocumento);
        y = yInicial;
      }
      if (linha) {
        const largura = fonte.widthOfTextAtSize(linha, tamanho);
        pagina.drawText(linha, {
          x: opcoes.centralizar ? (tamanhoPagina[0] - largura) / 2 : margem,
          y,
          size: tamanho,
          font: fonte,
          color: opcoes.cor || rgb(0, 0, 0),
        });
      }
      y -= altura;
    });
    y -= opcoes.espacoDepois ?? 5;
  };

  const campo = (rotulo, valor) => {
    paragrafo(`${rotulo}: ${valor || "não informado"}`, { altura: 13, espacoDepois: 1 });
  };

  blocos.forEach((bloco) => {
    if (bloco.tipo === "titulo") {
      paragrafo(bloco.texto, { negrito: true, tamanho: 11, centralizar: true, espacoDepois: 10 });
    } else if (bloco.tipo === "campo") {
      campo(bloco.rotulo, bloco.valor);
    } else if (bloco.tipo === "assinatura") {
      y -= 12;
      const larguraLinha = bloco.largura || 245;
      const xAssinatura = bloco.x ?? (tamanhoPagina[0] - larguraLinha) / 2;
      const imagemAssinatura =
        bloco.imagem ||
        (opcoesDocumento.assinaturaEmpresa &&
        String(bloco.nome || "").toUpperCase().includes("PLATINO")
          ? opcoesDocumento.assinaturaEmpresa
          : null);
      if (imagemAssinatura) {
        const alturaImagem = bloco.alturaImagem || 132;
        const proporcaoLinha = bloco.proporcaoLinha ?? (524 - 307) / 524;
        pagina.drawImage(imagemAssinatura, {
          x: xAssinatura,
          y: y - proporcaoLinha * alturaImagem,
          width: larguraLinha,
          height: alturaImagem,
        });
      } else {
        pagina.drawLine({
          start: { x: xAssinatura, y },
          end: { x: xAssinatura + larguraLinha, y },
          thickness: 0.8,
          color: rgb(0, 0, 0),
        });
      }
      y -= 17;
      paragrafo(bloco.nome, { tamanho: 9.5, centralizar: true, espacoDepois: 18 });
    } else {
      paragrafo(bloco.texto, bloco);
    }
  });

  return pdf;
}

export async function gerarModeloComplementarPdf(dados, modelo) {
  const pdf = await PDFDocument.create();
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.TimesRoman),
    negrito: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  const assinaturaEmpresaBytes =
    modelo.modo === "recibo-prestacao-servicos"
      ? await carregarImagem("/modelos/termo-ciencia-seguranca-assinatura.png")
      : null;
  const assinaturaEmpresa = assinaturaEmpresaBytes
    ? await pdf.embedPng(assinaturaEmpresaBytes)
    : null;
  const cliente = dados.nomeCliente || "Nome do cliente";
  const cidade = dados.cidade || "São Paulo";
  const data = dataBrasileira(dados.dataEmissao);
  let blocos = [];

  if (modelo.modo === "certidao-diligencia") {
    blocos = [
      { tipo: "titulo", texto: "CERTIDÃO DE DILIGÊNCIA E CONTATO PROFISSIONAL" },
      { texto: `Certifico, para os devidos fins, que em ${data} foi realizada diligência e contato profissional entre a empresa representante Platino Soluções Financeiras e a Dra. Juliana Cristina Galzo, com a finalidade de obter esclarecimentos acerca do andamento e das providências processuais necessárias para a conclusão do caso envolvendo o(a) Sr(a). ${cliente}, ${dados.nacionalidade || "brasileiro(a)"}, ${dados.estadoCivil || "estado civil não informado"}, ${dados.profissao || "profissão não informada"}, inscrito(a) no CPF nº ${dados.cpfCnpj || "não informado"}, em trâmite perante ${dados.vara || "a Vara competente"} da Comarca de ${dados.comarca || cidade}.` },
      { texto: "Durante a tratativa, foi informado pela patrona que o processo se encontra atualmente em fase de conclusão. Para viabilizar o encerramento da demanda, poderá ser necessária a adoção de medida processual complementar e a respectiva certificação nos autos." },
      { texto: `Para a emissão do mandado, deverá ser observada a necessidade de pagamento da guia de diligência do Oficial de Justiça, quando aplicável. ${dados.observacoes || "A prestação de contas e o comprovante deverão ser anexados ao processo para conferência."}` },
      { texto: "Nada mais havendo a certificar, lavra-se a presente certidão para registro das informações obtidas junto à patrona responsável." },
      { tipo: "assinatura", nome: dados.responsavel || "Responsável pela certidão" },
      { tipo: "assinatura", nome: "PLATINO SOLUÇÕES FINANCEIRAS" },
      { texto: `${cidade}, ${data}.`, centralizar: true },
    ];
  } else if (modelo.modo === "recibo-prestacao-servicos") {
    blocos = [
      { tipo: "titulo", texto: "RECIBO DE PRESTAÇÃO DE SERVIÇOS" },
      { texto: `Recebi de ${cliente} — CPF: ${dados.cpfCnpj || "não informado"}, a importância de ${moeda(dados.valorPagamento)} (${dados.valorPorExtenso || "valor por extenso não informado"}), referente à prestação de serviços contratados.` },
      { tipo: "campo", rotulo: "Data", valor: data },
      { tipo: "campo", rotulo: "Horário", valor: dados.horario },
      { tipo: "campo", rotulo: "Valor", valor: moeda(dados.valorPagamento) },
      { tipo: "campo", rotulo: "Modalidade", valor: dados.modalidade },
      { tipo: "campo", rotulo: "Bandeira", valor: dados.bandeira },
      { tipo: "campo", rotulo: "Código de autorização", valor: dados.codigoAutorizacao },
      { tipo: "campo", rotulo: "Tipo da venda", valor: dados.tipoVenda },
      { texto: "Declaro, para os devidos fins, que o valor acima foi recebido e encontra-se devidamente registrado." },
      { tipo: "assinatura", nome: "PLATINO SOLUÇÕES FINANCEIRAS" },
      { texto: `${cidade}, ${data}.`, centralizar: true },
    ];
  } else if (modelo.modo === "relatorio-negociacao-homologacao") {
    blocos = [
      { tipo: "titulo", texto: "RELATÓRIO DE NEGOCIAÇÃO E ACORDO / HOMOLOGAÇÃO" },
      { texto: `${cidade}, ${data}.`, centralizar: true },
      { tipo: "campo", rotulo: "Cliente", valor: cliente },
      { tipo: "campo", rotulo: "CPF", valor: dados.cpfCnpj },
      { texto: `O presente relatório tem por finalidade registrar a atualização das tratativas realizadas junto à instituição financeira, referentes ao procedimento de homologação. No último contato realizado em ${dataBrasileira(dados.dataContato)}, foi informado que os valores referentes às parcelas em atraso totalizam ${moeda(dados.totalAtraso)} (${dados.totalAtrasoExtenso || "valor por extenso não informado"}).` },
      { texto: `Foi apresentada proposta de quitação no valor de ${moeda(dados.propostaQuitacao)} (${dados.propostaQuitacaoExtenso || "valor por extenso não informado"}), considerando as condições disponibilizadas pela financeira até a presente data.` },
      { tipo: "titulo", texto: "INFORMAÇÕES ATUALIZADAS DA NEGOCIAÇÃO" },
      { tipo: "campo", rotulo: "Número de protocolo", valor: dados.protocolo },
      { tipo: "campo", rotulo: "Saldo devedor atualizado", valor: `${moeda(dados.saldoDevedor)} (${dados.saldoDevedorExtenso || "valor por extenso não informado"})` },
      { tipo: "campo", rotulo: "Valor para quitação com desconto", valor: `${moeda(dados.valorQuitacao)} (${dados.valorQuitacaoExtenso || "valor por extenso não informado"})` },
      { tipo: "campo", rotulo: "Parcelas em atraso", valor: dados.quantidadeParcelas },
      { tipo: "campo", rotulo: "Data da proposta", valor: dataBrasileira(dados.dataProposta) },
      { tipo: "campo", rotulo: "Prazo de validade", valor: dados.validadeProposta },
      { tipo: "titulo", texto: "MANIFESTAÇÃO DO CLIENTE" },
      { texto: dados.manifestacaoCliente || "A manifestação do cliente será registrada após ciência dos valores e condições apresentadas." },
      { texto: "A Platino Assessoria Financeira seguirá em negociação junto à instituição financeira, buscando a melhor condição possível para quitação do financiamento. Este relatório possui caráter informativo e não representa garantia de aprovação, manutenção de desconto ou obrigatoriedade de aceitação da proposta." },
      { tipo: "assinatura", nome: cliente },
      { tipo: "assinatura", nome: "PLATINO SOLUÇÕES FINANCEIRAS" },
    ];
  } else if (modelo.modo === "termo-recompra") {
    blocos = [
      { tipo: "titulo", texto: "TERMO DE RECOMPRA / REPAGAMENTO" },
      { texto: `Pelo presente instrumento particular, de um lado, Platino Soluções Financeiras, inscrita no CNPJ sob o nº 52.807.405/0001-30, doravante denominada ASSESSORIA; e, de outro lado, ${cliente}, inscrito(a) no CPF sob o nº ${dados.cpfCnpj || "não informado"}, doravante denominado(a) CLIENTE, declaram e acordam o seguinte:` },
      { texto: "1. O CLIENTE reconhece que realizou contestação do pagamento (chargeback) referente aos serviços contratados junto à Platino Soluções Financeiras." },
      { texto: "2. Após novo atendimento e esclarecimentos prestados pela empresa, o CLIENTE manifesta livremente seu interesse em manter a contratação dos serviços, realizando a recompra/repagamento do valor correspondente." },
      { texto: `3. O valor da recompra será de ${moeda(dados.valorRecompra)} (${dados.valorRecompraExtenso || "valor por extenso não informado"}), pago na modalidade ${dados.modalidade || "não informada"}.` },
      { texto: "4. Com a confirmação do pagamento, a empresa dará continuidade à prestação dos serviços contratados, observadas as condições originalmente pactuadas." },
      { texto: "5. Este termo produz efeitos a partir da assinatura, podendo ser assinado eletronicamente ou por plataforma digital admitida pelas partes." },
      { texto: `${cidade}, ${data}.`, centralizar: true },
      { tipo: "assinatura", nome: cliente },
      { tipo: "assinatura", nome: "PLATINO SOLUÇÕES FINANCEIRAS" },
    ];
  }

  const opcoesDocumento =
    modelo.modo === "recibo-prestacao-servicos"
      ? {
          tamanhoPagina: A4_PAISAGEM,
          margem: 74,
          yInicial: A4_PAISAGEM[1] - 138,
          yMinimo: 64,
          assinaturaEmpresa,
        }
      : {};

  return escreverDocumento(
    pdf,
    fontes,
    modelo.titulo || modelo.nome,
    blocos,
    opcoesDocumento,
  ).save();
}
