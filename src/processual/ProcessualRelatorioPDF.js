import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGEM = 54;
const AZUL = rgb(22 / 255, 56 / 255, 97 / 255);
const AZUL_CLARO = rgb(241 / 255, 246 / 255, 252 / 255);
const CINZA = rgb(91 / 255, 105 / 255, 125 / 255);
const BORDA = rgb(165 / 255, 177 / 255, 194 / 255);
const PRETO = rgb(0.04, 0.04, 0.04);

function texto(valor, padrao = "Não informado") {
  return String(valor || "").trim() || padrao;
}

function nomeSeguro(valor) {
  return String(valor || "documento").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function dataBrasileira(valor) {
  const data = String(valor || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return texto(data);
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function quebrarLinhas(valor, fonte, tamanho, largura) {
  const saida = [];
  String(valor || "").split(/\n/).forEach((paragrafo) => {
    let atual = "";
    paragrafo.trim().split(/\s+/).filter(Boolean).forEach((palavra) => {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (atual && fonte.widthOfTextAtSize(teste, tamanho) > largura) {
        saida.push(atual);
        atual = palavra;
      } else {
        atual = teste;
      }
    });
    saida.push(atual || " ");
  });
  return saida;
}

function desenharLinhas(pagina, valor, { x, y, largura, fonte, tamanho = 8.5, altura = 11, cor = PRETO, maximo = Infinity }) {
  const linhas = quebrarLinhas(valor, fonte, tamanho, largura).slice(0, maximo);
  linhas.forEach((linha, indice) => pagina.drawText(linha, {
    x, y: y - indice * altura, size: tamanho, font: fonte, color: cor,
  }));
  return y - linhas.length * altura;
}

function desenharCentralizado(pagina, valor, { x, y, largura, fonte, tamanho = 8.5, altura = 11, cor = PRETO, maximo = 2 }) {
  const linhas = quebrarLinhas(valor, fonte, tamanho, largura - 20).slice(0, maximo);
  linhas.forEach((linha, indice) => {
    const larguraLinha = fonte.widthOfTextAtSize(linha, tamanho);
    pagina.drawText(linha, {
      x: x + (largura - larguraLinha) / 2,
      y: y - indice * altura,
      size: tamanho,
      font: fonte,
      color: cor,
    });
  });
}

function desenharCabecalho(pagina, fontes, continuacao = false) {
  pagina.drawText("PLATINO", { x: MARGEM, y: 806, size: 9, font: fontes.bold, color: AZUL });
  const fimPlatino = MARGEM + fontes.bold.widthOfTextAtSize("PLATINO", 9);
  pagina.drawText("SOLUÇÕES FINANCEIRAS", { x: fimPlatino + 5, y: 806, size: 7.2, font: fontes.normal, color: AZUL });
  const titulo = continuacao ? "RELATÓRIO PROCESSUAL - CONTINUAÇÃO" : "RELATÓRIO DE ATUALIZAÇÃO DO PROCESSO JUDICIAL";
  const larguraTitulo = fontes.bold.widthOfTextAtSize(titulo, 8.2);
  pagina.drawText(titulo, { x: A4[0] - MARGEM - larguraTitulo, y: 806, size: 8.2, font: fontes.bold, color: AZUL });
  pagina.drawLine({ start: { x: MARGEM, y: 792 }, end: { x: A4[0] - MARGEM, y: 792 }, thickness: 1.2, color: AZUL });
}

function desenharRodape(pagina, fontes) {
  pagina.drawLine({ start: { x: MARGEM, y: 48 }, end: { x: A4[0] - MARGEM, y: 48 }, thickness: 0.6, color: BORDA });
  const endereco = "Rua Fontoura Xavier, nº 1308 - Itaquera - São Paulo/SP - CEP: 08295-300";
  const email = "E-mail: platinoassessoriafinanceira@gmail.com";
  [endereco, email].forEach((linha, indice) => {
    const tamanho = 6.8;
    const largura = fontes.normal.widthOfTextAtSize(linha, tamanho);
    pagina.drawText(linha, { x: (A4[0] - largura) / 2, y: 33 - indice * 10, size: tamanho, font: fontes.normal, color: CINZA });
  });
}

function desenharCampo(pagina, fontes, rotulo, valor, y) {
  const tamanho = 8.5;
  pagina.drawText(`${rotulo}:`, { x: MARGEM, y, size: tamanho, font: fontes.bold, color: PRETO });
  const xValor = MARGEM + fontes.bold.widthOfTextAtSize(`${rotulo}: `, tamanho);
  const linhas = quebrarLinhas(texto(valor), fontes.normal, tamanho, A4[0] - MARGEM - xValor);
  linhas.forEach((linha, indice) => pagina.drawText(linha, {
    x: indice === 0 ? xValor : MARGEM,
    y: y - indice * 11,
    size: tamanho,
    font: fontes.normal,
    color: PRETO,
  }));
  return y - Math.max(15, linhas.length * 11 + 4);
}

function desenharSecao(pagina, fontes, rotulo, valor, y) {
  pagina.drawText(rotulo.toUpperCase(), { x: MARGEM, y, size: 8.8, font: fontes.bold, color: AZUL });
  pagina.drawLine({ start: { x: MARGEM, y: y - 5 }, end: { x: A4[0] - MARGEM, y: y - 5 }, thickness: 0.65, color: AZUL });
  return desenharLinhas(pagina, texto(valor), {
    x: MARGEM,
    y: y - 17,
    largura: A4[0] - MARGEM * 2,
    fonte: fontes.normal,
    tamanho: 8.5,
    altura: 11,
    cor: PRETO,
  }) - 8;
}

function desenharPartes(pagina, fontes, dados, y) {
  const largura = (A4[0] - MARGEM * 2) / 2;
  const alturaCabecalho = 21;
  const alturaCorpo = 65;
  pagina.drawRectangle({ x: MARGEM, y: y - alturaCabecalho, width: largura * 2, height: alturaCabecalho, color: AZUL_CLARO, borderColor: BORDA, borderWidth: 0.6 });
  pagina.drawRectangle({ x: MARGEM, y: y - alturaCabecalho - alturaCorpo, width: largura * 2, height: alturaCorpo, borderColor: BORDA, borderWidth: 0.6 });
  pagina.drawLine({ start: { x: MARGEM + largura, y: y - alturaCabecalho }, end: { x: MARGEM + largura, y: y - alturaCabecalho - alturaCorpo }, thickness: 0.6, color: BORDA });
  desenharCentralizado(pagina, "POLO ATIVO", { x: MARGEM, y: y - 14, largura, fonte: fontes.bold, tamanho: 8.3, cor: AZUL, maximo: 1 });
  desenharCentralizado(pagina, "POLO PASSIVO", { x: MARGEM + largura, y: y - 14, largura, fonte: fontes.bold, tamanho: 8.3, cor: AZUL, maximo: 1 });
  desenharCentralizado(pagina, texto(dados.nome_cliente), { x: MARGEM, y: y - 42, largura, fonte: fontes.bold, tamanho: 8.2 });
  desenharCentralizado(pagina, texto(dados.reu), { x: MARGEM + largura, y: y - 42, largura, fonte: fontes.bold, tamanho: 8.2 });
  desenharCentralizado(pagina, `ADV.: ${texto(dados.advogado_cliente)}`, { x: MARGEM, y: y - 70, largura, fonte: fontes.normal, tamanho: 7.2, cor: CINZA });
  desenharCentralizado(pagina, `ADV.: ${texto(dados.advogado_reu)}`, { x: MARGEM + largura, y: y - 70, largura, fonte: fontes.normal, tamanho: 7.2, cor: CINZA });
  return y - alturaCabecalho - alturaCorpo;
}

async function carregarAssinatura(pdf) {
  try {
    const resposta = await fetch("/modelos/processual-assinatura-rafael.png");
    if (!resposta.ok) return null;
    return pdf.embedPng(await resposta.arrayBuffer());
  } catch {
    return null;
  }
}

export async function gerarRelatorioProcessualPDF({ dados, codigo, anexos = [] }) {
  const pdf = await PDFDocument.create();
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const assinatura = await carregarAssinatura(pdf);
  const paginasRelatorio = [];
  let pagina = pdf.addPage(A4);
  paginasRelatorio.push(pagina);
  desenharCabecalho(pagina, fontes);
  let y = 755;

  function continuar() {
    pagina = pdf.addPage(A4);
    paginasRelatorio.push(pagina);
    desenharCabecalho(pagina, fontes, true);
    y = 758;
  }

  y = desenharCampo(pagina, fontes, "Número do Processo", dados.numero_processo, y);
  y = desenharCampo(pagina, fontes, "Origem", dados.origem, y);
  y = desenharCampo(pagina, fontes, "Segredo ou sigilo", dados.segredo_sigilo, y);
  y = desenharCampo(pagina, fontes, "Justiça Gratuita", dados.justica_gratuita, y);
  y = desenharCampo(pagina, fontes, "Data da distribuição", dataBrasileira(dados.data_distribuicao), y);
  y -= 7;
  y = desenharPartes(pagina, fontes, dados, y);
  y -= 12;
  y = desenharCampo(pagina, fontes, "Assunto", dados.assunto, y);
  y -= 5;

  const secoes = [
    ["Status atual", dados.status_atual],
    ["Última movimentação", `Data: ${dataBrasileira(dados.data_ultima_movimentacao)}\n${texto(dados.descricao_ultima_movimentacao)}`],
    ["Consulta do processo", `Data da consulta: ${dataBrasileira(dados.data_consulta)} às ${texto(dados.hora_consulta)}`],
    ["Próximos passos", dados.proximos_passos],
    ["Anexos e documentos do processo", dados.link_anexos_documentos],
    ["Consulta das movimentações", dados.link_movimentacoes],
  ];
  for (const [rotulo, valor] of secoes) {
    const alturaEstimada = quebrarLinhas(texto(valor), fontes.normal, 8.5, A4[0] - MARGEM * 2).length * 11 + 38;
    if (y - alturaEstimada < 245) continuar();
    y = desenharSecao(pagina, fontes, rotulo, valor, y);
  }

  const representante = texto(dados.representante_responsavel, "o representante responsável pelo acompanhamento");
  const mensagem = `Nossa equipe jurídica, juntamente com ${representante}, está acompanhando atentamente todas as movimentações processuais e adotará as medidas cabíveis dentro dos prazos estabelecidos pelo Juízo.`;
  const alturaMensagem = quebrarLinhas(mensagem, fontes.normal, 8.5, A4[0] - MARGEM * 2).length * 11 + 125;
  if (y - alturaMensagem < 65) continuar();
  y = desenharLinhas(pagina, mensagem, { x: MARGEM, y, largura: A4[0] - MARGEM * 2, fonte: fontes.normal, tamanho: 8.5, altura: 11, cor: PRETO }) - 12;
  pagina.drawText("Cordialmente,", { x: MARGEM, y, size: 8.5, font: fontes.normal, color: PRETO });
  y -= 56;

  if (assinatura) {
    const largura = 230;
    const altura = largura * assinatura.height / assinatura.width;
    pagina.drawImage(assinatura, { x: (A4[0] - largura) / 2, y: y - 3, width: largura, height: altura });
  }
  pagina.drawLine({ start: { x: 196, y: y - 7 }, end: { x: A4[0] - 196, y: y - 7 }, thickness: 0.55, color: CINZA });
  const nomeAssinatura = "RAFAEL MOREIRA";
  const larguraNome = fontes.bold.widthOfTextAtSize(nomeAssinatura, 8.2);
  pagina.drawText(nomeAssinatura, { x: (A4[0] - larguraNome) / 2, y: y - 20, size: 8.2, font: fontes.bold, color: PRETO });
  const departamento = "Departamento Processual • PLATINO SOLUÇÕES FINANCEIRAS";
  const larguraDepartamento = fontes.normal.widthOfTextAtSize(departamento, 6.7);
  pagina.drawText(departamento, { x: (A4[0] - larguraDepartamento) / 2, y: y - 32, size: 6.7, font: fontes.normal, color: CINZA });
  const registro = `Documento assinado digitalmente por RAFAEL MOREIRA • em ${dataBrasileira(dados.data_consulta)} às ${texto(dados.hora_consulta)} • Código de validação: ${codigo}`;
  const larguraRegistro = fontes.normal.widthOfTextAtSize(registro, 5.5);
  pagina.drawText(registro, { x: Math.max(MARGEM, (A4[0] - larguraRegistro) / 2), y: y - 46, size: 5.5, font: fontes.normal, color: CINZA });
  paginasRelatorio.forEach((item) => desenharRodape(item, fontes));

  const incluidos = [...anexos].filter((anexo) => anexo.incluir && anexo.arquivo)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  for (const anexo of incluidos) {
    const bytes = await anexo.arquivo.arrayBuffer();
    if (anexo.arquivo.type === "application/pdf") {
      const origem = await PDFDocument.load(bytes);
      const copiadas = await pdf.copyPages(origem, origem.getPageIndices());
      copiadas.forEach((paginaCopiada) => pdf.addPage(paginaCopiada));
    } else {
      const paginaAnexo = pdf.addPage(A4);
      const imagem = anexo.arquivo.type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const escala = Math.min((A4[0] - MARGEM * 2) / imagem.width, (A4[1] - 130) / imagem.height);
      paginaAnexo.drawText(anexo.nome || "Captura do processo", { x: MARGEM, y: 800, size: 11, font: fontes.bold, color: AZUL });
      paginaAnexo.drawImage(imagem, {
        x: (A4[0] - imagem.width * escala) / 2,
        y: 60 + (A4[1] - 150 - imagem.height * escala) / 2,
        width: imagem.width * escala,
        height: imagem.height * escala,
      });
    }
  }

  const bytes = await pdf.save();
  return {
    blob: new Blob([bytes], { type: "application/pdf" }),
    nome: `relatorio-de-atualizacao-do-processo-judicial-${nomeSeguro(dados.nome_cliente)}-${codigo}.pdf`,
  };
}

export function baixarPDF({ blob, nome }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
