import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGEM = 46;

function texto(valor, fallback = "Não informado") {
  const normalizado = String(valor ?? "").trim();
  return normalizado || fallback;
}

function linhas(textoOriginal, fonte, tamanho, largura) {
  const palavras = texto(textoOriginal).replace(/\s+/g, " ").split(" ");
  const resultado = [];
  let atual = "";
  for (const palavra of palavras) {
    const candidata = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(candidata, tamanho) <= largura) atual = candidata;
    else { if (atual) resultado.push(atual); atual = palavra; }
  }
  if (atual) resultado.push(atual);
  return resultado;
}

export async function gerarRelatorioAtualizacaoProcessualPdf(dados = {}) {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  let pagina;
  let y;

  function novaPagina() {
    pagina = pdf.addPage(A4);
    y = A4[1] - MARGEM;
    pagina.drawText("PLATINO ASSESSORIA", { x: MARGEM, y, size: 10, font: negrito, color: rgb(.06, .2, .38) });
    pagina.drawText("RELATÓRIO DE ATUALIZAÇÃO PROCESSUAL", { x: 294, y, size: 10, font: negrito, color: rgb(.06, .2, .38) });
    y -= 12;
    pagina.drawLine({ start: { x: MARGEM, y }, end: { x: A4[0] - MARGEM, y }, thickness: 1.4, color: rgb(.08, .28, .5) });
    y -= 22;
  }

  function garantir(altura, reserva = 0) { if (y - altura < MARGEM + reserva) novaPagina(); }
  function titulo(numero, valor) { garantir(30); pagina.drawText(`${numero}. ${valor.toUpperCase()}`, { x: MARGEM, y, size: 9, font: negrito, color: rgb(.06, .2, .38) }); y -= 15; }
  function campo(rotulo, valor, largura = A4[0] - MARGEM * 2) {
    const conteudo = linhas(texto(valor), normal, 9, largura - 14);
    const altura = 19 + conteudo.length * 11;
    garantir(altura);
    pagina.drawRectangle({ x: MARGEM, y: y - altura + 5, width: largura, height: altura, borderWidth: .6, borderColor: rgb(.75, .81, .88), color: rgb(.985, .99, 1) });
    pagina.drawText(rotulo.toUpperCase(), { x: MARGEM + 7, y: y - 9, size: 6.5, font: negrito, color: rgb(.33, .42, .52) });
    let linhaY = y - 21;
    conteudo.forEach((linha) => { pagina.drawText(linha, { x: MARGEM + 7, y: linhaY, size: 9, font: normal, color: rgb(.08, .1, .14) }); linhaY -= 11; });
    y -= altura + 5;
  }

  novaPagina();
  titulo("1", "Dados do processo");
  campo("Número do processo", dados.numeroProcesso);
  campo("Distribuição", dados.dataDistribuicao);
  campo("Origem / Tribunal / Comarca", dados.origemTribunal);
  campo("Assunto", dados.assunto);
  titulo("2", "Partes e representação");
  campo("Autor", dados.autorNome);
  campo("Advogado do autor", dados.autorAdvogado);
  campo("Réu", dados.reuNome);
  campo("Advogado do réu", dados.reuAdvogado);
  titulo("3", "Situação processual atual");
  campo("Status atual", dados.statusLabel);
  campo("Descrição do status", dados.statusDescricao);
  campo("Justiça gratuita", dados.justicaGratuita);
  campo("Prazo / providência", dados.prazoAtual);
  campo("Responsável", dados.responsavelProvidencia);
  titulo("4", "Última movimentação relevante");
  campo("Data", dados.dataUltimaMovimentacao);
  campo("Movimentação", dados.ultimaMovimentacao);
  titulo("5", "Próximas providências");
  campo("Providências", dados.proximosPassos);
  if (String(dados.anexosResumo || "").trim()) campo("Anexos / documentos consultados", dados.anexosResumo);
  if (String(dados.linkConsulta || "").trim()) campo("Link de consulta", dados.linkConsulta);

  garantir(92, 0);
  y -= 12;
  pagina.drawLine({ start: { x: MARGEM, y }, end: { x: A4[0] - MARGEM, y }, thickness: .7, color: rgb(.75, .81, .88) });
  y -= 27;
  pagina.drawText("PLATINO ASSESSORIA", { x: MARGEM, y, size: 12, font: negrito, color: rgb(.08, .28, .5) });
  y -= 15;
  pagina.drawText("Relatório emitido eletronicamente para acompanhamento processual.", { x: MARGEM, y, size: 8, font: normal, color: rgb(.3, .36, .43) });
  y -= 12;
  pagina.drawText(`Emissão: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`, { x: MARGEM, y, size: 8, font: normal, color: rgb(.3, .36, .43) });
  return pdf.save();
}
