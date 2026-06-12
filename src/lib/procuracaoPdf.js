import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4 = [595.28, 841.89];
const MARGEM_HORIZONTAL = 85;
const LARGURA_TEXTO = A4[0] - MARGEM_HORIZONTAL * 2;
const TAMANHO_TEXTO = 10.5;
const ALTURA_LINHA = 15.5;

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

function criarLinhas(segmentos, fontes, tamanho, larguraMaxima) {
  const palavras = [];

  segmentos.forEach((segmento) => {
    String(segmento.texto)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((texto) => {
        palavras.push({
          texto,
          fonte: segmento.negrito ? fontes.negrito : fontes.normal,
        });
      });
  });

  const linhas = [];
  let linha = [];
  let largura = 0;

  palavras.forEach((palavra) => {
    const espaco =
      linha.length === 0
        ? 0
        : linha[linha.length - 1].fonte.widthOfTextAtSize(" ", tamanho);
    const larguraPalavra = palavra.fonte.widthOfTextAtSize(palavra.texto, tamanho);

    if (linha.length && largura + espaco + larguraPalavra > larguraMaxima) {
      linhas.push(linha);
      linha = [];
      largura = 0;
    }

    linha.push({ ...palavra, espacoAntes: linha.length ? espaco : 0 });
    largura += (linha.length > 1 ? espaco : 0) + larguraPalavra;
  });

  if (linha.length) linhas.push(linha);
  return linhas;
}

function desenharParagrafo({
  pagina,
  segmentos,
  fontes,
  y,
  justificar = true,
}) {
  const linhas = criarLinhas(
    segmentos,
    fontes,
    TAMANHO_TEXTO,
    LARGURA_TEXTO,
  );

  linhas.forEach((linha, indiceLinha) => {
    const ultimaLinha = indiceLinha === linhas.length - 1;
    const larguraPalavras = linha.reduce(
      (total, palavra) =>
        total + palavra.fonte.widthOfTextAtSize(palavra.texto, TAMANHO_TEXTO),
      0,
    );
    const quantidadeEspacos = Math.max(0, linha.length - 1);
    const espacoPadrao = fontes.normal.widthOfTextAtSize(" ", TAMANHO_TEXTO);
    const espaco =
      justificar && !ultimaLinha && quantidadeEspacos
        ? (LARGURA_TEXTO - larguraPalavras) / quantidadeEspacos
        : espacoPadrao;

    let x = MARGEM_HORIZONTAL;
    linha.forEach((palavra, indicePalavra) => {
      if (indicePalavra) x += espaco;
      pagina.drawText(palavra.texto, {
        x,
        y,
        size: TAMANHO_TEXTO,
        font: palavra.fonte,
        color: rgb(0, 0, 0),
      });
      x += palavra.fonte.widthOfTextAtSize(palavra.texto, TAMANHO_TEXTO);
    });
    y -= ALTURA_LINHA;
  });

  // AUMENTADO: Aumentei o espaço em branco após cada parágrafo (era 11, agora é 25)
  return y - 25;
}

export async function gerarProcuracaoPdf(dados, logoBytes) {
  const pdf = await PDFDocument.create();
  const pagina = pdf.addPage(A4);
  const fontes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  // AUMENTADO: Começa a imprimir mais abaixo na folha (era 48)
  let y = A4[1] - 80;

  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    const escala = Math.min(52 / logo.width, 52 / logo.height);
    const largura = logo.width * escala;
    const altura = logo.height * escala;
    pagina.drawImage(logo, {
      x: (A4[0] - largura) / 2,
      y: y - altura,
      width: largura,
      height: altura,
    });
    y -= altura + 18;
  }

  const titulo = "PROCURAÇÃO AD JUDICIA";
  const larguraTitulo = fontes.negrito.widthOfTextAtSize(titulo, 16);
  pagina.drawText(titulo, {
    x: (A4[0] - larguraTitulo) / 2,
    y,
    size: 16,
    font: fontes.negrito,
    color: rgb(0, 0, 0),
  });
  
  // AUMENTADO: Mais respiro abaixo do título (era 35)
  y -= 50;

  const genero = formasGenero(dados.genero);
  const nome = dados.nomeCliente?.trim() || "";

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      { texto: "OUTORGANTE:", negrito: true },
      {
        texto: `${nome}, ${dados.nacionalidade}, ${dados.estadoCivil}, ${dados.profissao}, ${genero.portador} da Cédula de Identidade R.G. nº ${dados.rg}, ${genero.inscrito} no C.P.F./M.F. sob nº ${dados.cpfCnpj}, com endereço eletrônico: ${dados.email}, residente e ${genero.domiciliado} na ${dados.endereco} - CEP: ${dados.cep}.`,
      },
    ],
  });

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      { texto: "OUTORGADO:", negrito: true },
      { texto: "Juliana Cristina Galzo,", negrito: true },
      {
        texto: "brasileira, divorciada, advogada inscrita na OAB/SP 336.677, com endereço eletrônico: adv.mkmello@gmail.com, com escritório profissional situado na Av. Cachoeira Paulista, nº 131, sala 3, Cidade Patriarca, São Paulo - SP, CEP: 03551-000, onde recebe intimações e notificações.",
      },
    ],
  });

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      { texto: "PODERES:", negrito: true },
      {
        texto: "Por este instrumento particular de procuração, o(a)",
      },
      { texto: "OUTORGANTE", negrito: true },
      { texto: "confere ao(à)" },
      { texto: "OUTORGADO(A)", negrito: true },
      {
        texto: "os mais amplos, gerais e ilimitados poderes para o foro em geral, em qualquer juízo, instância ou tribunal, podendo propor quaisquer ações, defesas, recursos, contrapor, aditar, desistir, confessar, transigir, firmar compromissos ou acordos, requerer e retirar alvarás, receber valores, dar e quitar recibos, requerer falências, concordatas ou recuperações judiciais, assim como praticar todos e quaisquer atos necessários e convenientes ao bom e fiel cumprimento do presente mandato.",
      },
    ],
  });

  y = desenharParagrafo({
    pagina,
    fontes,
    y,
    segmentos: [
      { texto: "OBJETIVO:", negrito: true },
      {
        texto: "Os poderes ora concedidos destinam-se exclusivamente ao ingresso de Ação de Revisão de Contrato, contra o",
      },
      { texto: `BANCO ${dados.banco},`, negrito: true },
      { texto: "e nº", negrito: true },
      { texto: "de contrato" },
      { texto: `${dados.numeroContrato},`, negrito: true },
      { texto: "bem como na defesa de seus interesses." },
    ],
  });

// ADICIONADO: Empurra a data um pouco mais para baixo após o último parágrafo
  y -= 25; 

  const localData = `${dados.cidade}, ${dataPorExtenso(dados.dataEmissao)}.`;
  
  // Calcula a largura da frase da data para poder centralizar
  const larguraData = fontes.normal.widthOfTextAtSize(localData, TAMANHO_TEXTO);
  
  pagina.drawText(localData, {
    x: (A4[0] - larguraData) / 2, // Centraliza a data perfeitamente na folha A4
    y,
    size: TAMANHO_TEXTO,
    font: fontes.normal,
    color: rgb(0, 0, 0),
  });

  // AUMENTADO: Empurra a assinatura bem mais para baixo (era 52)
  y -= 100;
  
  const larguraAssinatura = 235;
  const xAssinatura = (A4[0] - larguraAssinatura) / 2;
  pagina.drawLine({
    start: { x: xAssinatura, y },
    end: { x: xAssinatura + larguraAssinatura, y },
    thickness: 0.8,
    color: rgb(0, 0, 0),
  });

  y -= 17;
  const assinatura = nome.toUpperCase();
  const larguraNome = fontes.negrito.widthOfTextAtSize(assinatura, 9);
  pagina.drawText(assinatura, {
    x: (A4[0] - larguraNome) / 2,
    y,
    size: 9,
    font: fontes.negrito,
    color: rgb(0, 0, 0),
  });

  // --- LOGOTIPO NO RODAPÉ ---
  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    const escala = Math.min(35 / logo.width, 35 / logo.height);
    const largura = logo.width * escala;
    const altura = logo.height * escala;
    
    pagina.drawImage(logo, {
      x: (A4[0] - largura) / 2,
      y: 30, // Posição fixa no rodapé
      width: largura,
      height: altura,
      opacity: 0.8,
    });
  }

  return pdf.save();
}
