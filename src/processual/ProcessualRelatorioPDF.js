import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AVISO_PROCESSUAL, FINALIDADE_PROCESSUAL } from "./processualConstants.js";

const A4 = [595.28, 841.89];
const M = 42;
const AZUL = rgb(15 / 255, 42 / 255, 85 / 255);
const CINZA = rgb(0.35, 0.42, 0.52);

function nomeSeguro(valor) {
  return String(valor || "documento").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function linhas(texto, fonte, tamanho, largura) {
  const saida = [];
  for (const paragrafo of String(texto || "").split("\n")) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(teste, tamanho) > largura && atual) {
        saida.push(atual);
        atual = palavra;
      } else atual = teste;
    }
    saida.push(atual || " ");
  }
  return saida;
}

export async function gerarRelatorioProcessualPDF({ dados, codigo, anexos }) {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage(A4);
  let y = 798;

  function nova() { page = pdf.addPage(A4); y = 798; }
  function garantir(altura = 36) { if (y - altura < 54) nova(); }
  function texto(valor, { size = 8.5, font = normal, color = AZUL, gap = 8, indent = 0 } = {}) {
    const ls = linhas(valor, font, size, A4[0] - M * 2 - indent);
    garantir(ls.length * (size + 3) + gap);
    for (const linha of ls) {
      page.drawText(linha, { x: M + indent, y, size, font, color });
      y -= size + 3;
    }
    y -= gap;
  }
  function campoResumo(rotulo, valor, x, largura, topo) {
    page.drawText(`${rotulo}:`, { x, y: topo, size: 7.2, font: bold, color: CINZA });
    const valorLinhas = linhas(valor || "Não informado", normal, 8.2, largura);
    valorLinhas.slice(0, 2).forEach((linha, indice) => {
      page.drawText(linha, { x, y: topo - 11 - indice * 10, size: 8.2, font: normal, color: AZUL });
    });
  }

  try {
    const bytesLogo = await fetch("/assets/platino-icon.png").then((resposta) => resposta.arrayBuffer());
    const logo = await pdf.embedPng(bytesLogo);
    page.drawImage(logo, { x: M, y: 767, width: 30, height: 30 });
  } catch { /* O relatório continua válido sem a imagem. */ }

  page.drawText("PLATINO", { x: 80, y: 785, size: 12, font: bold, color: AZUL });
  page.drawText("RELATÓRIO DE ATUALIZAÇÃO PROCESSUAL", { x: M, y: 743, size: 14, font: bold, color: AZUL });
  page.drawText(`Código: ${codigo}`, { x: M, y: 724, size: 8, font: bold, color: AZUL });
  page.drawText(`Consulta: ${dados.data_consulta || "Não informada"}`, { x: 370, y: 724, size: 8, font: bold, color: AZUL });

  y = 700;
  const local = [dados.tribunal, dados.vara, dados.forum_comarca, dados.cidade_estado].filter(Boolean).join(" – ");
  texto(local || "Tribunal não informado", { font: bold, size: 10, gap: 12 });

  const resumo = [
    ["Cliente (Autor)", dados.cliente_autor],
    ["Instituição Financeira (Réu)", dados.instituicao_reu],
    ["Número do Processo", dados.numero_processo],
    ["Data de distribuição", dados.data_distribuicao],
    ["Juiz responsável", dados.juiz_responsavel],
    ["Advogado", dados.advogado],
  ];
  const colunaLargura = 238;
  for (let indice = 0; indice < resumo.length; indice += 2) {
    campoResumo(resumo[indice][0], resumo[indice][1], M, colunaLargura, y);
    campoResumo(resumo[indice + 1][0], resumo[indice + 1][1], 315, colunaLargura, y);
    y -= 38;
  }

  if (dados.link_processo) {
    campoResumo("Link oficial do processo", dados.link_processo, M, A4[0] - M * 2, y);
    y -= 38;
  }

  y -= 2;
  texto("ANDAMENTO PROCESSUAL", { font: bold, size: 10.5, gap: 9 });
  for (const [rotulo, valor] of [
    ["Status atual", dados.status_atual],
    ["Última movimentação", dados.ultima_movimentacao],
    ["Próximos passos", dados.proximos_passos],
  ]) {
    texto(`${rotulo}:`, { font: bold, size: 8, gap: 2 });
    texto(valor || "Não informado", { size: 8.5, gap: 9 });
  }
  if (dados.observacao_cliente) {
    texto("Observação ao cliente:", { font: bold, size: 8, gap: 2 });
    texto(dados.observacao_cliente, { size: 8.5, gap: 9 });
  }
  texto(`Responsável pela atualização: ${dados.responsavel || "Não informado"}`, { font: bold, size: 8, gap: 9 });
  texto(AVISO_PROCESSUAL, { size: 7, color: CINZA, gap: 5 });
  texto(FINALIDADE_PROCESSUAL, { size: 7, font: bold, color: CINZA });

  const incluidos = [...anexos].filter((anexo) => anexo.incluir && anexo.arquivo).sort((a, b) => {
    const grupoA = a.arquivo.type === "application/pdf" ? 1 : 0;
    const grupoB = b.arquivo.type === "application/pdf" ? 1 : 0;
    return grupoA - grupoB || a.ordem - b.ordem;
  });
  for (let indice = 0; indice < incluidos.length; indice += 1) {
    const anexo = incluidos[indice];
    nova();
    page.drawText(`ANEXO ${romano(indice + 1)}`, { x: M, y: 680, size: 24, font: bold, color: AZUL });
    page.drawText(anexo.tipo || "Outro", { x: M, y: 640, size: 15, font: bold, color: AZUL });
    textoNa(page, anexo.nome, 600, bold, 12);
    textoNa(page, anexo.descricao || "Documento anexado ao relatório processual.", 570, normal, 10);
    const bytes = await anexo.arquivo.arrayBuffer();
    if (anexo.arquivo.type === "application/pdf") {
      const origem = await PDFDocument.load(bytes);
      const copiadas = await pdf.copyPages(origem, origem.getPageIndices());
      copiadas.forEach((pagina) => pdf.addPage(pagina));
    } else {
      nova();
      const imagem = anexo.arquivo.type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const escala = Math.min((A4[0] - M * 2) / imagem.width, (A4[1] - M * 2) / imagem.height);
      page.drawImage(imagem, { x: (A4[0] - imagem.width * escala) / 2, y: (A4[1] - imagem.height * escala) / 2, width: imagem.width * escala, height: imagem.height * escala });
    }
  }

  const total = pdf.getPageCount();
  pdf.getPages().forEach((pagina, indice) => pagina.drawText(`Página ${indice + 1} de ${total}`, { x: 490, y: 26, size: 7, font: normal, color: CINZA }));
  const bytes = await pdf.save();
  return { blob: new Blob([bytes], { type: "application/pdf" }), nome: `${codigo}_${nomeSeguro(dados.cliente_autor)}_${nomeSeguro(dados.numero_processo)}.pdf` };
}

function textoNa(page, texto, y, font, size) {
  linhas(texto, font, size, A4[0] - M * 2).forEach((linha, indice) => page.drawText(linha, { x: M, y: y - indice * (size + 4), size, font, color: AZUL }));
}

function romano(numero) {
  const mapa = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let resultado = "";
  for (const [valor, letra] of mapa) while (numero >= valor) { resultado += letra; numero -= valor; }
  return resultado;
}

export function baixarPDF({ blob, nome }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
