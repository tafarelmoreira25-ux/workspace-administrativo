import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { TEXTOS_DOCUMENTOS_CONTRATUAIS } from "./modelosContratuaisTextos.js";

const A4 = [595.28, 841.89];
const MARGEM_X = 68;
const TOPO = 704;
const RODAPE = 62;
const AZUL = rgb(23 / 255, 54 / 255, 93 / 255);

const t = (valor) => String(valor ?? "").trim();
const dinheiro = (valor) => `R$ ${t(valor).replace(/^R\$\s*/i, "")}`;
const dataCurta = (valor) => {
  const partes = t(valor).slice(0, 10).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : t(valor);
};
const dataLonga = (valor) => {
  if (!valor) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${valor}T12:00:00Z`));
};

function quebrar(texto, fonte, tamanho, largura) {
  const linhas = [];
  for (const paragrafo of t(texto).split(/\n/)) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    let linha = "";
    for (const palavra of palavras) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (linha && fonte.widthOfTextAtSize(tentativa, tamanho) > largura) { linhas.push(linha); linha = palavra; }
      else linha = tentativa;
    }
    linhas.push(linha);
  }
  return linhas;
}

async function renderizar(titulo, blocos) {
  const pdf = await PDFDocument.create();
  const fontes = { normal: await pdf.embedFont(StandardFonts.TimesRoman), negrito: await pdf.embedFont(StandardFonts.TimesRomanBold) };
  let pagina; let y;
  const novaPagina = () => {
    pagina = pdf.addPage(A4); y = TOPO;
    pagina.drawRectangle({ x: 0, y: 0, width: 20, height: A4[1], color: rgb(0, 56 / 255, 168 / 255) });
    const marca = "PLATINO SOLUÇÕES FINANCEIRAS";
    pagina.drawText(marca, { x: (A4[0] - fontes.normal.widthOfTextAtSize(marca, 8)) / 2, y: 810, size: 8, font: fontes.normal });
    const linhasTitulo = quebrar(titulo, fontes.negrito, 13, A4[0] - 150);
    linhasTitulo.forEach((linha, i) => pagina.drawText(linha, { x: (A4[0] - fontes.negrito.widthOfTextAtSize(linha, 13)) / 2, y: 765 - i * 15, size: 13, font: fontes.negrito, color: AZUL }));
    pagina.drawLine({ start: { x: MARGEM_X, y: 735 }, end: { x: A4[0] - MARGEM_X, y: 735 }, thickness: 1, color: rgb(.65, .65, .65) });
    const rodape = "Rua Fontoura Xavier, nº 1308 - Itaquera - São Paulo/SP - CEP: 08295-300";
    pagina.drawText(rodape, { x: (A4[0] - fontes.normal.widthOfTextAtSize(rodape, 8)) / 2, y: 28, size: 8, font: fontes.normal });
  };
  const reservar = (altura) => { if (y - altura < RODAPE) novaPagina(); };
  const paragrafo = (texto, { negrito = false, centralizar = false, tamanho = 9.2, espaco = 7 } = {}) => {
    const fonte = negrito ? fontes.negrito : fontes.normal;
    const linhas = quebrar(texto, fonte, tamanho, A4[0] - MARGEM_X * 2);
    reservar(linhas.length * 11 + espaco);
    for (const linha of linhas) {
      const x = centralizar ? (A4[0] - fonte.widthOfTextAtSize(linha, tamanho)) / 2 : MARGEM_X;
      pagina.drawText(linha, { x, y, size: tamanho, font: fonte }); y -= 11;
    }
    y -= espaco;
  };
  const assinatura = (nome, identificacao = "") => {
    reservar(64); y -= 25;
    pagina.drawLine({ start: { x: 155, y }, end: { x: 440, y }, thickness: .8, color: rgb(0, 0, 0) });
    y -= 14; paragrafo(nome.toUpperCase(), { negrito: true, centralizar: true, tamanho: 9, espaco: 0 });
    if (identificacao) paragrafo(identificacao, { centralizar: true, tamanho: 8.5, espaco: 4 });
  };
  novaPagina();
  for (let indice = 0; indice < blocos.length; indice += 1) {
    const bloco = blocos[indice];
    if (bloco.tipo === "assinatura" && (indice === 0 || blocos[indice - 1]?.tipo !== "assinatura")) {
      let quantidade = 0;
      while (blocos[indice + quantidade]?.tipo === "assinatura") quantidade += 1;
      reservar(quantidade * 64);
    }
    if (bloco.tipo === "titulo") paragrafo(bloco.texto, { negrito: true, tamanho: 9.5, espaco: 5 });
    else if (bloco.tipo === "centro") paragrafo(bloco.texto, { centralizar: true, espaco: 8 });
    else if (bloco.tipo === "assinatura") assinatura(bloco.nome, bloco.identificacao);
    else paragrafo(bloco.texto);
  }
  return pdf.save();
}

const titulo = (texto) => ({ tipo: "titulo", texto });
const p = (texto) => ({ texto });
const centro = (texto) => ({ tipo: "centro", texto });
const assinatura = (nome, identificacao) => ({ tipo: "assinatura", nome, identificacao });

function introducaoDistrato(d) {
  return [
    p(`Pelo presente Instrumento Particular de Distrato, de um lado, Platino Soluções Financeiras Ltda, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 52.807.405/0001-30, com sede na Rua Fontoura Xavier, nº 1308, Itaquera, São Paulo/SP, CEP 08295-300, doravante denominada “CONTRATADA”, e, de outro lado, ${t(d.nomeContratante)}, inscrito no CPF sob nº ${t(d.cpfContratante)}, residente e domiciliado na ${t(d.enderecoContratante)}, doravante denominado “CONTRATANTE”, têm entre si, de forma justa e acordada, o presente Instrumento Particular de Distrato, mediante as cláusulas e condições a seguir estabelecidas:`),
    titulo("CLÁUSULA PRIMEIRA – DO OBJETO E DO ENCERRAMENTO CONTRATUAL"),
    p(`As partes celebraram, em ${dataLonga(d.dataContrato)}, Contrato de Prestação de Serviços de Revisão de Contratos Bancários, no valor total de ${dinheiro(d.valorContrato)} (${t(d.valorContratoExtenso)}), cujo pagamento foi ajustado de forma parcelada, em ${t(d.quantidadeParcelas)} (${t(d.quantidadeParcelasExtenso)}) parcelas de ${dinheiro(d.valorParcela)} (${t(d.valorParcelaExtenso)}) cada, mediante cartão de crédito.`),
  ];
}

const encerramentoComum = [
  titulo("CLÁUSULA TERCEIRA – DA PARALISAÇÃO E DO ENCERRAMENTO DA PRESTAÇÃO DOS SERVIÇOS"),
  p("Ficam paralisadas e encerradas as atividades administrativas, extrajudiciais e, quando aplicável, judiciais vinculadas ao objeto do contrato originário. A CONTRATADA deixará de promover novas diligências e tratativas, ressalvadas a prestação de contas, as restituições ajustadas e as providências de transição."),
  p("Permanecem válidos os atos, procedimentos, documentos e providências regularmente realizados anteriormente à formalização deste distrato."),
  titulo("CLÁUSULA QUARTA – DA REVOGAÇÃO DOS PODERES E AUTORIZAÇÕES CONCEDIDOS"),
  p("Com a assinatura, ficam revogadas, para atos futuros, as autorizações concedidas à CONTRATADA quanto ao contrato encerrado. Eventuais procurações judiciais deverão ser regularizadas nos autos pelos profissionais responsáveis, não havendo baixa automática do processo pela assinatura deste distrato."),
  titulo("CLÁUSULA QUINTA – DA CIÊNCIA E CONCORDÂNCIA DO CONTRATANTE"),
  p("O CONTRATANTE declara estar ciente de que a assinatura deste instrumento acarretará a paralisação e o encerramento da prestação dos serviços anteriormente contratados, nas condições expressamente estabelecidas neste documento."),
  titulo("CLÁUSULA SEXTA – DAS DISPOSIÇÕES FINAIS"),
  p("O presente instrumento formaliza o encerramento da relação contratual. A celebração deste distrato não implica, por si só, reconhecimento de inadimplemento, falha ou irregularidade na prestação dos serviços por parte da CONTRATADA."),
  p("As partes declaram que leram, compreenderam e concordam com as condições estabelecidas neste instrumento, firmando-o para todos os fins de direito, ressalvados os direitos que, por disposição legal, sejam indisponíveis."),
];

function distrato(d, modo) {
  const inicio = introducaoDistrato(d);
  const especiais = {
    "distrato-com-multa": [p("Por manifestação do CONTRATANTE, as partes resolvem encerrar amigavelmente a relação contratual."), titulo("CLÁUSULA SEGUNDA – DOS VALORES PAGOS E DA MULTA RESCISÓRIA"), p(`Os valores pagos totalizam ${dinheiro(d.valorPago)} (${t(d.valorPagoExtenso)}). A prestação de contas discrimina ${dinheiro(d.valorServicosPrestados)} por serviços comprovadamente executados e ${dinheiro(d.saldoRestituir)} de saldo, a ser restituído em ${dataCurta(d.dataRestituicao)}, pelo meio ${t(d.formaRestituicao)}.`), p(`Conforme a cláusula 5.2 do contrato originário, incide multa rescisória de 20%, no valor de ${dinheiro(d.valorMulta)} (${t(d.valorMultaExtenso)}), observados os limites legais e a proporcionalidade.`)],
    "distrato-sem-multa": [p("Por manifestação do CONTRATANTE, as partes resolvem encerrar amigavelmente a relação contratual."), titulo("CLÁUSULA SEGUNDA – DOS VALORES PAGOS E DA AUSÊNCIA DE MULTA RESCISÓRIA"), p("Não haverá restituição dos valores já pagos nem aplicação de multa rescisória ou penalidade financeira."), p(`Para fins do termo aditivo e da quitação ajustada, o valor pactuado é ${dinheiro(d.valorQuitacao)} (${t(d.valorQuitacaoExtenso)}).`)],
    "distrato-com-devolucao": [p("Por manifestação do CONTRATANTE, as partes resolvem encerrar amigavelmente a relação contratual."), titulo("CLÁUSULA SEGUNDA – DA DEVOLUÇÃO DOS VALORES E DA AUSÊNCIA DE MULTA"), p(`A CONTRATADA devolverá ${dinheiro(d.valorDevolucao)} (${t(d.valorDevolucaoExtenso)}), sem desconto ou retenção, até ${dataCurta(d.dataDevolucao)}, por ${t(d.formaDevolucao)}, para ${t(d.nomeBeneficiarioRestituicao)}, CPF ${t(d.cpfBeneficiarioRestituicao)}, mediante ${t(d.dadosBancariosRestituicao)}.`), p("Não será aplicada multa rescisória. A quitação financeira somente ocorrerá após o efetivo recebimento do valor ajustado.")],
    "distrato-sem-devolucao": [p("Por manifestação do CONTRATANTE, as partes resolvem encerrar amigavelmente a relação contratual."), titulo("CLÁUSULA SEGUNDA – DOS VALORES PAGOS E DA AUSÊNCIA DE MULTA RESCISÓRIA"), p(`Não haverá restituição do total de ${dinheiro(d.valorPago)} (${t(d.valorPagoExtenso)}), correspondente aos serviços efetivamente prestados e documentados em ${t(d.identificacaoPrestacaoContas)}.`), p(`Eventuais parcelas vincendas somente subsistirão quanto aos serviços já prestados e individualizados em: ${t(d.descricaoValoresServicos)}. Não haverá multa rescisória.`)],
    "distrato-7-dias-estorno-total": [p(`O CONTRATANTE comunicou sua desistência em ${dataCurta(d.dataDesistencia)}, dentro de 7 (sete) dias de ${dataCurta(d.dataAssinaturaOuRecebimento)}. A contratação ocorreu por ${t(d.canalContratacao)}, fora do estabelecimento comercial, nos termos do art. 49 do Código de Defesa do Consumidor.`), titulo("CLÁUSULA SEGUNDA – DA RESTITUIÇÃO INTEGRAL E DA AUSÊNCIA DE MULTA"), p(`A CONTRATADA restituirá integralmente ${dinheiro(d.valorTotalPago)} (${t(d.valorTotalPagoExtenso)}), sem multa, retenção ou desconto, por ${t(d.meioAcordadoRestituicao)}, para ${t(d.titularDadosRestituicao)}, mediante comprovação.`)],
    "distrato-inexecucao-ausencia-resposta": [p("O encerramento decorre da ausência de colaboração e de resposta do CONTRATANTE às solicitações necessárias à continuidade dos serviços, após notificação e prazo concedido."), titulo("CLÁUSULA SEGUNDA – DA PRESTAÇÃO DE CONTAS E DA AUSÊNCIA DE MULTA"), p(`Os valores pagos totalizam ${dinheiro(d.valorPago)} (${t(d.valorPagoExtenso)}) e serão considerados na prestação de contas dos serviços comprovadamente realizados. Não haverá multa rescisória.`)],
  }[modo] || [];
  return [...inicio, ...especiais, ...encerramentoComum, titulo("TERMO ADITIVO DE DISTRATO E QUITAÇÃO RECÍPROCA"), p("As partes confirmam a rescisão e a quitação nos limites das obrigações efetivamente cumpridas, preservados os direitos legalmente assegurados, o acesso aos órgãos competentes e a correção de informações comprovadamente inexatas."), centro(`${t(d.localEmissao || "São Paulo/SP")}, ${dataLonga(d.dataEmissao)}.`), assinatura(t(d.nomeContratante), `CPF nº ${t(d.cpfContratante)}`), assinatura("PLATINO SOLUÇÕES FINANCEIRAS LTDA", "CNPJ nº 52.807.405/0001-30")];
}

function termoCartao(d, terceiro = false) {
  const favorecido = terceiro ? `${t(d.nomeContratante)}, CPF nº ${t(d.cpfContratante)}` : "PLATINO SOLUÇÕES FINANCEIRAS LTDA, CNPJ nº 52.807.405/0001-30";
  return [p(`Eu, ${t(d.nomeTitularCartao)}, inscrito(a) no CPF sob o nº ${t(d.cpfTitularCartao)}, titular do cartão nº ${t(d.numeroCartaoMascarado)}, autorizo expressamente o uso do meu cartão para pagamento no valor de ${dinheiro(d.valorPagamento)} em favor de ${favorecido}.`), titulo("DECLARO AINDA QUE:"), p("Estou ciente da transação; autorizei a compra de forma livre e voluntária em meu cartão; reconheço a legitimidade da cobrança; e reconheço a contratação dos serviços e a utilização do meu cartão para o pagamento correspondente."), p("Declaro-me responsável por eventuais ônus e efeitos legais decorrentes de contestação indevida e afirmo que fui informado(a) sobre a natureza e a finalidade do pagamento."), p(`Pagamento realizado via cartão de crédito em ${t(d.quantidadeParcelas)} parcelas mensais. Código da transação: ${t(d.codigoTransacao)}. Data: ${dataCurta(d.dataDocumento)}.`), p("Por ser expressão da verdade, firmo o presente termo."), assinatura(t(d.nomeTitularCartao), `CPF nº ${t(d.cpfTitularCartao)}`), assinatura(terceiro ? t(d.nomeContratante) : "PLATINO SOLUÇÕES FINANCEIRAS", terceiro ? `CPF nº ${t(d.cpfContratante)}` : "CNPJ nº 52.807.405/0001-30")];
}

function termo(d, modo) {
  if (["termo-ciencia-consentimento-contratacao", "termo-consentimento-compras-2026"].includes(modo)) return termoCartao(d, false);
  if (modo === "termo-pagamento-cartao-terceiro") return termoCartao(d, true);
  if (modo === "termo-reconhecimento-recompra") return [p(`De um lado, Platino Soluções Financeiras, CNPJ nº 52.807.405/0001-30, denominada ASSESSORIA, e, de outro, ${t(d.nomeContratante)}, CPF nº ${t(d.cpfContratante)}, denominado CLIENTE, declaram:`), p("1. O CLIENTE reconhece que realizou contestação do pagamento (chargeback) referente aos serviços contratados."), p("2. Após novo atendimento e esclarecimentos, manifesta livremente seu interesse em manter a contratação, realizando a recompra/repagamento."), p(`3. O valor da recompra será de ${dinheiro(d.valorRecompra)} (${t(d.valorRecompraExtenso)}), pago por ${t(d.formaPagamento)}.`), p("4. Com a confirmação do pagamento, a empresa dará continuidade aos serviços nas condições originalmente pactuadas."), p("5. O CLIENTE declara ter recebido os esclarecimentos necessários e compromete-se a colaborar com os documentos e informações necessários."), centro(`${t(d.localEmissao)}, ${dataLonga(d.dataDocumento)}.`), assinatura(t(d.nomeContratante), `CPF nº ${t(d.cpfContratante)}`), assinatura("PLATINO SOLUÇÕES FINANCEIRAS LTDA", "CNPJ nº 52.807.405/0001-30")];
  return [p(`Eu, ${t(d.nomeCliente)}, RG nº ${t(d.rg)}, CPF/CNPJ nº ${t(d.cpfCnpj)}, residente na ${t(d.logradouro)}, nº ${t(d.numeroEndereco)}, Bairro ${t(d.bairro)}, ${t(d.cidadeEstado)}, assumo a responsabilidade e o compromisso de efetuar o pagamento das parcelas vencidas e vincendas, ciente de que a empresa não se responsabilizará por eventuais atrasos.`), p("Ratifico estar ciente de todas as informações acima e das responsabilidades pela declaração prestada."), centro(`${t(d.localEmissao)}, ${dataLonga(d.dataDocumento)}.`), assinatura(t(d.nomeCliente), t(d.cpfCnpj))];
}

function substituirUmaVez(texto, busca, valor) {
  const indice = texto.indexOf(busca);
  return indice < 0 ? texto : `${texto.slice(0, indice)}${t(valor)}${texto.slice(indice + busca.length)}`;
}

function substituirTodas(texto, busca, valor) {
  return texto.split(busca).join(t(valor));
}

function preencherTextoOriginal(paragrafos, d, modo) {
  let itens = paragrafos.slice();
  const trocar = (busca, valor) => { itens = itens.map((item) => substituirTodas(item, busca, valor)); };
  const trocarSequencial = (busca, valores) => {
    let indiceValor = 0;
    itens = itens.map((item) => {
      let atual = item;
      while (atual.includes(busca)) {
        atual = substituirUmaVez(atual, busca, valores[Math.min(indiceValor, valores.length - 1)]);
        indiceValor += 1;
      }
      return atual;
    });
  };

  if (modo.startsWith("distrato-")) {
    trocar("Nome do contratante", d.nomeContratante);
    trocar("NOME DO CONTRATANTE", t(d.nomeContratante).toUpperCase());
    trocar("[Nome Completo do Cliente]", d.nomeContratante);
    trocar("XXX.XXX.XXX-XX", d.cpfContratante);
    trocar("[CPF do Cliente]", d.cpfContratante);
    trocar("Rua – Estado/UF - CEP", d.enderecoContratante);
    trocar("Dia de mês de 2026", dataLonga(d.dataContrato));
    trocarSequencial("R$ x.xxx,xx", [dinheiro(d.valorContrato), dinheiro(d.valorParcela)]);
    trocarSequencial("(Valor por extenso)", [`(${t(d.valorContratoExtenso)})`, `(${t(d.valorParcelaExtenso)})`]);
    trocar("X (Numero por extenso)", `${t(d.quantidadeParcelas)} (${t(d.quantidadeParcelasExtenso)})`);
  }

  const especificas = {
    "distrato-com-multa": [["[Valor pago]", d.valorPago], ["[Valor dos serviços prestados]", d.valorServicosPrestados], ["[Saldo a restituir]", d.saldoRestituir], ["[Data]", dataCurta(d.dataRestituicao)], ["[Forma de restituição]", d.formaRestituicao], ["[Valor da multa]", d.valorMulta]],
    "distrato-sem-multa": [["[Valor]", d.valorQuitacao]],
    "distrato-7-dias-estorno-total": [["[Data da desistência ]", dataCurta(d.dataDesistencia)], ["[Data da assinatura ou recebimento do serviço]", dataCurta(d.dataAssinaturaOuRecebimento)], ["[Canal de contratação]", d.canalContratacao], ["[Valor total pago]", d.valorTotalPago], ["[Meio acordado]", d.meioAcordadoRestituicao], ["[Titular e dados de restituição]", d.titularDadosRestituicao]],
    "distrato-com-devolucao": [["[Valor da devolução]", d.valorDevolucao], ["[Data da devolução]", dataCurta(d.dataDevolucao)], ["[PIX, transferência ou estorno]", d.formaDevolucao], ["[Nome e CPF do titular]", `${t(d.nomeBeneficiarioRestituicao)}, CPF nº ${t(d.cpfBeneficiarioRestituicao)}`], ["[Chave PIX ou dados bancários]", d.dadosBancariosRestituicao]],
    "distrato-sem-devolucao": [["[Valor pago]", d.valorPago], ["[Identificação da prestação de contas]", d.identificacaoPrestacaoContas], ["[Descrição e valor]", d.descricaoValoresServicos]],
    "distrato-inexecucao-ausencia-resposta": [["[Valor pago]", d.valorPago]],
  }[modo] || [];
  especificas.forEach(([busca, valor]) => trocar(busca, valor));

  const valoresExtenso = {
    "distrato-com-multa": [d.valorPagoExtenso, d.valorMultaExtenso],
    "distrato-sem-multa": [d.valorQuitacaoExtenso],
    "distrato-7-dias-estorno-total": [d.valorTotalPagoExtenso],
    "distrato-com-devolucao": [d.valorDevolucaoExtenso, d.valorDevolucaoExtenso],
    "distrato-sem-devolucao": [d.valorPagoExtenso],
    "distrato-inexecucao-ausencia-resposta": [d.valorPagoExtenso],
  }[modo];
  if (valoresExtenso) trocarSequencial("([Valor por extenso])", valoresExtenso.map((valor) => `(${t(valor)})`));

  if (["termo-ciencia-consentimento-contratacao", "termo-consentimento-compras-2026", "termo-pagamento-cartao-terceiro"].includes(modo)) {
    trocar("NOME DO TITULAR DO CARTÃO", t(d.nomeTitularCartao).toUpperCase());
    trocarUmaIdentidade(itens, "XXX.XXX.XXX-XX", d.cpfTitularCartao, 0);
    trocar("5447 **** **** 9904", d.numeroCartaoMascarado);
    trocar("X.XXX, XX", t(d.valorPagamento).replace(/^R\$\s*/i, ""));
    trocar("XX parcelas", `${t(d.quantidadeParcelas)} parcelas`);
    trocar("x0map21h37by7922jor97rfoec", d.codigoTransacao);
    trocar("XX/XX/2026", dataCurta(d.dataDocumento));
    if (modo === "termo-pagamento-cartao-terceiro") {
      trocar("NOME DO CONTRATANTE", t(d.nomeContratante).toUpperCase());
      trocarUmaIdentidade(itens, "XXX.XXX.XXX-XX", d.cpfContratante, 0);
    }
  } else if (modo === "termo-reconhecimento-recompra") {
    trocar("Nome do contratante", d.nomeContratante); trocar("NOME DO CONTRATANTE", t(d.nomeContratante).toUpperCase());
    trocar("XXX.XXX.XXX-XX", d.cpfContratante); trocar("X.XXX, XX", t(d.valorRecompra).replace(/^R\$\s*/i, ""));
    trocar("(valor por extenso)", `(${t(d.valorRecompraExtenso)})`); trocar("FORMA DE PAGAMENTO", t(d.formaPagamento).toUpperCase());
    trocar("São Paulo/SP, dia de mês de 2026", `${t(d.localEmissao)}, ${dataLonga(d.dataDocumento)}`);
  } else if (modo === "termo-responsabilidade-parcelas-atraso") {
    trocar("Nome do cliente", d.nomeCliente); trocar("Nome Completo Do Cliente", t(d.nomeCliente).toUpperCase());
    trocar("RG nº ____________,", `RG nº ${t(d.rg)},`); trocar("CPF/CNPJ -MF sob o nº___________________,", `CPF/CNPJ -MF sob o nº ${t(d.cpfCnpj)},`);
    trocar("rua _______________________", t(d.logradouro)); trocar("Nº____", `Nº ${t(d.numeroEndereco)}`);
    trocar("Bairro:________________", `Bairro: ${t(d.bairro)}`); trocar("Cidade/Estado: ____________________________", `Cidade/Estado: ${t(d.cidadeEstado)}`);
    trocar("Estado/UF, dia de mês de 2026", `${t(d.localEmissao)}, ${dataLonga(d.dataDocumento)}`); trocar("XXX.XXX.XXX-XX", d.cpfCnpj);
  }
  return itens;
}

function trocarUmaIdentidade(itens, busca, valor, ocorrencia) {
  let vista = 0;
  for (let i = 0; i < itens.length; i += 1) {
    while (itens[i].includes(busca)) {
      if (vista === ocorrencia) { itens[i] = substituirUmaVez(itens[i], busca, valor); return; }
      vista += 1;
    }
  }
}

function blocosDoOriginal(dados, modelo) {
  const originais = TEXTOS_DOCUMENTOS_CONTRATUAIS[modelo.modo];
  if (!originais?.length) throw new Error(`Conteúdo oficial não cadastrado para ${modelo.nome}.`);
  const preenchidos = preencherTextoOriginal(originais, dados, modelo.modo);
  const textoCompleto = preenchidos.join(" ");
  const pendencias = textoCompleto.match(/\[[^\]]+\]|XXX\.XXX\.XXX-XX|x\.xxx,xx|XX\/XX\/2026|dia de mês de 2026/gi) || [];
  if (pendencias.length) {
    throw new Error(`Campos do modelo ainda não preenchidos: ${[...new Set(pendencias)].join(", ")}.`);
  }
  const tituloDocumento = preenchidos[0];
  const indiceAssinaturas = preenchidos.findIndex((item) => /^_{8,}/.test(item));
  const corpo = preenchidos.slice(1, indiceAssinaturas < 0 ? undefined : indiceAssinaturas).map((texto) => {
    if (/^(CLÁUSULA|TERMO ADITIVO|QUITAÇÃO E RESCISÃO:|REMOÇÃO DE CONTEÚDOS:|NÃO INTERFERÊNCIA COMERCIAL:|ESTORNO INTEGRAL:|RESTITUIÇÃO E CANCELAMENTO:|VALORES E PARCELAS:)/.test(texto)) return titulo(texto);
    return p(texto);
  });
  if (modelo.modo.startsWith("distrato-")) {
    corpo.push(centro(`${t(dados.localEmissao || "São Paulo/SP")}, ${dataLonga(dados.dataEmissao)}.`), assinatura(t(dados.nomeContratante), `CPF nº ${t(dados.cpfContratante)}`), assinatura("PLATINO SOLUÇÕES FINANCEIRAS LTDA", "CNPJ nº 52.807.405/0001-30"));
  } else if (["termo-ciencia-consentimento-contratacao", "termo-consentimento-compras-2026"].includes(modelo.modo)) {
    corpo.push(assinatura(t(dados.nomeTitularCartao), `CPF nº ${t(dados.cpfTitularCartao)}`), assinatura("PLATINO SOLUÇÕES FINANCEIRAS", "CNPJ nº 52.807.405/0001-30"));
  } else if (modelo.modo === "termo-pagamento-cartao-terceiro") {
    corpo.push(assinatura(t(dados.nomeTitularCartao), `CPF nº ${t(dados.cpfTitularCartao)}`), assinatura(t(dados.nomeContratante), `CPF nº ${t(dados.cpfContratante)}`));
  } else if (modelo.modo === "termo-reconhecimento-recompra") {
    corpo.push(assinatura(t(dados.nomeContratante), `CPF nº ${t(dados.cpfContratante)}`), assinatura("PLATINO SOLUÇÕES FINANCEIRAS LTDA", "CNPJ nº 52.807.405/0001-30"));
  } else corpo.push(assinatura(t(dados.nomeCliente), t(dados.cpfCnpj)));
  return { tituloDocumento, corpo };
}

export async function gerarDocumentoContratualPdf(dados, modelo) {
  const { tituloDocumento, corpo } = blocosDoOriginal(dados, modelo);
  return renderizar(tituloDocumento, corpo);
}
