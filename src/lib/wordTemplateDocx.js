import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const t = (valor) => String(valor ?? "").trim();
const semReal = (valor) => t(valor).replace(/^R\$\s*/i, "");
const dataCurta = (valor) => {
  const partes = t(valor).slice(0, 10).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : t(valor);
};
const dataLonga = (valor) => {
  if (!valor) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${valor}T12:00:00Z`));
};

const regra = (buscar, valor, opcoes = {}) => ({ buscar, valor: t(valor), ...opcoes });

function regrasDistrato(d, modo) {
  const comuns = [
    regra("[Data]", dataLonga(d.dataEmissao), { parte: /^word\/header/i }),
    regra("Nome do contratante", d.nomeContratante), regra("NOME DO CONTRATANTE", t(d.nomeContratante).toUpperCase()),
    regra("[Nome Completo do Cliente]", d.nomeContratante), regra("XXX.XXX.XXX-XX", d.cpfContratante),
    regra("[CPF do Cliente]", d.cpfContratante), regra("Rua – Estado/UF - CEP", d.enderecoContratante),
    regra("Dia de mês de 2026", dataLonga(d.dataContrato)),
    regra("R$ x.xxx,xx", null, { valores: [semReal(d.valorContrato), semReal(d.valorParcela)] }),
    regra("(Valor por extenso)", null, { valores: [`(${t(d.valorContratoExtenso)})`, `(${t(d.valorParcelaExtenso)})`] }),
    regra("X (Numero por extenso)", `${t(d.quantidadeParcelas)} (${t(d.quantidadeParcelasExtenso)})`),
  ];
  const extras = {
    "distrato-com-multa": [regra("[Valor pago]", semReal(d.valorPago)), regra("[Valor dos serviços prestados]", semReal(d.valorServicosPrestados)), regra("[Saldo a restituir]", semReal(d.saldoRestituir)), regra("[Data]", dataCurta(d.dataRestituicao), { parte: /^word\/document\.xml$/i }), regra("[Forma de restituição]", d.formaRestituicao), regra("[Valor da multa]", semReal(d.valorMulta)), regra("([Valor por extenso])", null, { valores: [`(${t(d.valorPagoExtenso)})`, `(${t(d.valorMultaExtenso)})`] })],
    "distrato-sem-multa": [regra("[Valor]", semReal(d.valorQuitacao)), regra("([Valor por extenso])", `(${t(d.valorQuitacaoExtenso)})`)],
    "distrato-7-dias-estorno-total": [regra("[Data da desistência ]", dataCurta(d.dataDesistencia)), regra("[Data da assinatura ou recebimento do serviço]", dataCurta(d.dataAssinaturaOuRecebimento)), regra("[Canal de contratação]", d.canalContratacao), regra("[Valor total pago]", semReal(d.valorTotalPago)), regra("([Valor por extenso])", `(${t(d.valorTotalPagoExtenso)})`), regra("[Meio acordado]", d.meioAcordadoRestituicao), regra("[Titular e dados de restituição]", d.titularDadosRestituicao)],
    "distrato-com-devolucao": [regra("[Valor da devolução]", semReal(d.valorDevolucao)), regra("([Valor por extenso])", `(${t(d.valorDevolucaoExtenso)})`), regra("[Data da devolução]", dataCurta(d.dataDevolucao)), regra("[PIX, transferência ou estorno]", d.formaDevolucao), regra("[Nome e CPF do titular]", `${t(d.nomeBeneficiarioRestituicao)}, CPF nº ${t(d.cpfBeneficiarioRestituicao)}`), regra("[Chave PIX ou dados bancários]", d.dadosBancariosRestituicao)],
    "distrato-sem-devolucao": [regra("[Valor pago]", semReal(d.valorPago)), regra("([Valor por extenso])", `(${t(d.valorPagoExtenso)})`), regra("[Identificação da prestação de contas]", d.identificacaoPrestacaoContas), regra("[Descrição e valor]", d.descricaoValoresServicos)],
    "distrato-inexecucao-ausencia-resposta": [regra("[Valor pago]", semReal(d.valorPago)), regra("([Valor por extenso])", `(${t(d.valorPagoExtenso)})`)],
  };
  return [...comuns, ...(extras[modo] || [])];
}

function regrasTermo(d, modo) {
  if (["termo-ciencia-consentimento-contratacao", "termo-consentimento-compras-2026"].includes(modo)) return [regra("NOME DO TITULAR DO CARTÃO", t(d.nomeTitularCartao).toUpperCase()), regra("XXX.XXX.XXX-XX", d.cpfTitularCartao), regra("5447 **** **** 9904", d.numeroCartaoMascarado), regra("X.XXX, XX", semReal(d.valorPagamento)), regra("XX parcelas", `${t(d.quantidadeParcelas)} parcelas`), regra("x0map21h37by7922jor97rfoec", d.codigoTransacao), regra("XX/XX/2026", dataCurta(d.dataDocumento))];
  if (modo === "termo-pagamento-cartao-terceiro") return [regra("NOME DO TITULAR DO CARTÃO", t(d.nomeTitularCartao).toUpperCase()), regra("NOME DO CONTRATANTE", t(d.nomeContratante).toUpperCase()), regra("XXX.XXX.XXX-XX", null, { valores: [d.cpfTitularCartao, d.cpfContratante] }), regra("5447 **** **** 9904", d.numeroCartaoMascarado), regra("X.XXX, XX", semReal(d.valorPagamento)), regra("XX parcelas", `${t(d.quantidadeParcelas)} parcelas`), regra("x0map21h37by7922jor97rfoec", d.codigoTransacao), regra("XX/XX/2026", dataCurta(d.dataDocumento))];
  if (modo === "termo-reconhecimento-recompra") return [regra("Nome do contratante", d.nomeContratante), regra("NOME DO CONTRATANTE", t(d.nomeContratante).toUpperCase()), regra("XXX.XXX.XXX-XX", d.cpfContratante), regra("X.XXX, XX", semReal(d.valorRecompra)), regra("(valor por extenso)", `(${t(d.valorRecompraExtenso)})`), regra("FORMA DE PAGAMENTO", t(d.formaPagamento).toUpperCase()), regra("São Paulo/SP, dia de mês de 2026", `${t(d.localEmissao)}, ${dataLonga(d.dataDocumento)}`)];
  return [regra("Nome do cliente", d.nomeCliente), regra("Nome Completo Do Cliente", t(d.nomeCliente).toUpperCase()), regra("RG nº ____________,", `RG nº ${t(d.rg)},`), regra("CPF/CNPJ -MF sob o nº___________________,", `CPF/CNPJ -MF sob o nº ${t(d.cpfCnpj)},`), regra("rua _______________________", t(d.logradouro)), regra("Nº____", `Nº ${t(d.numeroEndereco)}`), regra("Bairro:________________", `Bairro: ${t(d.bairro)}`), regra("Cidade/Estado: ____________________________", `Cidade/Estado: ${t(d.cidadeEstado)}`), regra("Estado/UF, dia de mês de 2026", `${t(d.localEmissao)}, ${dataLonga(d.dataDocumento)}`), regra("XXX.XXX.XXX-XX", d.cpfCnpj)];
}

function regrasRecibo(d, modo) {
  const comuns = [regra("[Nº]", d.numeroRecibo, { parte: /^word\/header/i }), regra("Nome  - CPF: xxx.xxx.xxx-xx", `${t(d.nomePagador)} - CPF: ${t(d.cpfPagador)}`), regra("X.XXX,XX", semReal(d.valorRecebido)), regra("(valor por extenso)", `(${t(d.valorRecebidoExtenso)})`), regra("[Descrição do serviço contratado]", d.descricaoServico), regra("dia/mês/2026", dataCurta(d.dataPagamento)), regra("[Valor recebido]", semReal(d.valorRecebido))];
  const extras = {
    "recibo-servicos-boleto": [regra("[Código]", d.codigoBarras), regra("[Número]", d.nossoNumero)],
    "recibo-servicos-cartao": [regra("[Nº]", d.quantidadeParcelas, { parte: /^word\/document\.xml$/i }), regra("[Parcela]", semReal(d.valorParcela)), regra("[NSU]", d.nsu), regra("[Código]", d.codigoAutorizacao)],
    "recibo-servicos-pix": [regra("[ID da transação]", d.idTransacao), regra("[E2E]", d.identificadorE2e)],
  };
  return [...comuns, ...(extras[modo] || [])];
}

function regrasNotificacao(d, modo) {
  const comuns = [regra("[Data]", dataLonga(d.dataDocumento), { parte: /^word\/header/i }), regra("[Nome Do Banco]", d.banco), regra("XX.XXX.XXX/XXXX-XX", d.cnpjBanco), regra("Endereço completo do banco ou canal eletrônico oficial.", d.enderecoBanco), regra("[Nome Do Cliente]", d.nomeCliente), regra("[NOME DO CLIENTE]", t(d.nomeCliente).toUpperCase()), regra("[CPF do cliente]", d.cpfCnpj), regra("[valor]", semReal(d.valorContrato)), regra("[valor por extenso]", null, { valores: [d.valorContratoExtenso, d.valorParcelaExtenso] }), regra("[quantidade]", d.quantidadeParcelas), regra("[valor da parcela]", semReal(d.valorParcela)), regra("[número do contrato, se houver]", d.numeroContrato)];
  const extras = {
    "notificacao-prosseguimento-acao": [regra("[Protocolo]", d.protocolo), regra("[Data]", dataCurta(d.dataInicio)), regra("[Datas e canais]", d.datasCanais), regra("[PROTOCOLO E DATA]", `${t(d.protocoloAnterior)} - ${dataCurta(d.dataSolicitacaoAnterior)}`), regra("[IDENTIFICAÇÃO]", d.documentosPendentes), regra("[Descrever a pendência]", d.pendencia)],
    "notificacao-via-oficial-justica": [regra("[NÚMERO DO PROCEDIMENTO]", d.numeroProcedimento), regra("[VARA E COMARCA]", d.varaComarca), regra("[DATA E IDENTIFICAÇÃO DO ATO]", `${dataCurta(d.dataDecisao)} - ${t(d.identificacaoAto)}`), regra("[NÚMERO OU IDENTIFICAÇÃO]", d.numeroMandado), regra("[Descrever pendência e documentos requeridos]", d.pendenciaDocumentos)],
    "notificacao-finalizacao-conciliacao": [regra("[Protocolo e data]", `${t(d.protocolo)} - ${dataCurta(d.dataProtocolo)}`), regra("[Síntese da revisão]", d.sinteseRevisao), regra("[Data e horário]", `${dataCurta(d.dataReuniao)} ${t(d.horarioReuniao)}`), regra("[Canal ou local]", d.canalReuniao)],
    "notificacao-requerimento-taxas": [regra("[Identificação das taxas e valores]", d.taxasQuestionadas)],
  };
  return [...comuns, ...(extras[modo] || [])];
}

function regrasLiminar(d) {
  return [regra("Nome do contratante", d.nomeContratante), regra("NOME DO CONTRATANTE", t(d.nomeContratante).toUpperCase()), regra("X.XXX,XX", semReal(d.valorDespesa)), regra("X.XXX, XX", semReal(d.valorDespesa)), regra("(valor por extenso)", `(${t(d.valorDespesaExtenso)})`), regra("dia/mês/ano", dataCurta(d.dataDesembolso)), regra("São Paulo, dia de mês de 2026", `${t(d.localEmissao || "São Paulo")}, ${dataLonga(d.dataDocumento)}`)];
}

function regrasDoModelo(dados, modelo) {
  if (modelo.modo.startsWith("distrato-")) return regrasDistrato(dados, modelo.modo);
  if (modelo.modo.startsWith("termo-")) return regrasTermo(dados, modelo.modo);
  if (modelo.modo.startsWith("recibo-servicos-")) return regrasRecibo(dados, modelo.modo);
  if (modelo.modo.startsWith("notificacao-")) return regrasNotificacao(dados, modelo.modo);
  if (modelo.modo.startsWith("liminar-")) return regrasLiminar(dados);
  return [];
}

function substituirNoParagrafo(paragrafo, item, indiceInicial) {
  const nos = Array.from(paragrafo.getElementsByTagNameNS(W_NS, "t"));
  let total = 0;
  while (nos.length) {
    const completo = nos.map((no) => no.textContent || "").join("");
    const inicio = completo.indexOf(item.buscar);
    if (inicio < 0) break;
    const fim = inicio + item.buscar.length;
    let cursor = 0; let primeiro; let ultimo; let offsetInicio = 0; let offsetFim = 0;
    for (const no of nos) {
      const tamanho = (no.textContent || "").length;
      if (!primeiro && inicio >= cursor && inicio < cursor + tamanho) { primeiro = no; offsetInicio = inicio - cursor; }
      if (!ultimo && fim > cursor && fim <= cursor + tamanho) { ultimo = no; offsetFim = fim - cursor; break; }
      cursor += tamanho;
    }
    if (!primeiro || !ultimo) break;
    const valores = item.valores || [item.valor];
    const valor = t(valores[Math.min(indiceInicial + total, valores.length - 1)]);
    const prefixo = (primeiro.textContent || "").slice(0, offsetInicio);
    const sufixo = (ultimo.textContent || "").slice(offsetFim);
    if (primeiro === ultimo) primeiro.textContent = `${prefixo}${valor}${sufixo}`;
    else {
      let limpar = false;
      for (const no of nos) {
        if (no === primeiro) { no.textContent = `${prefixo}${valor}`; limpar = true; continue; }
        if (!limpar) continue;
        if (no === ultimo) { no.textContent = sufixo; break; }
        no.textContent = "";
      }
    }
    total += 1;
  }
  return total;
}

function preencherXml(xml, caminho, regras, contadores) {
  const documento = new DOMParser().parseFromString(xml, "application/xml");
  if (documento.getElementsByTagName("parsererror").length) throw new Error(`XML inválido no modelo Word: ${caminho}.`);
  const paragrafos = Array.from(documento.getElementsByTagNameNS(W_NS, "p"));
  regras.forEach((item, indice) => {
    if (item.parte && !item.parte.test(caminho)) return;
    const chave = `${indice}:${item.buscar}`;
    paragrafos.forEach((paragrafo) => {
      const feitas = substituirNoParagrafo(paragrafo, item, contadores[chave] || 0);
      contadores[chave] = (contadores[chave] || 0) + feitas;
    });
  });
  return new XMLSerializer().serializeToString(documento);
}

function validar(arquivos) {
  const pendencias = new Set();
  for (const [caminho, bytes] of Object.entries(arquivos)) {
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/i.test(caminho)) continue;
    const documento = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
    const texto = Array.from(documento.getElementsByTagNameNS(W_NS, "t")).map((no) => no.textContent || "").join("");
    (texto.match(/\[[^\]]+\]/g) || []).forEach((token) => pendencias.add(token));
    if (/XXX\.XXX\.XXX|xxx\.xxx\.xxx|X\.XXX,?\s?XX|dia\/mês\/(ano|2026)|Nome do contratante|NOME DO CONTRATANTE/.test(texto)) pendencias.add("campos de exemplo do Word");
  }
  if (pendencias.size) throw new Error(`Preencha os campos obrigatórios do modelo: ${[...pendencias].join(", ")}.`);
}

export async function gerarWordOficial(dados, modelo) {
  if (!modelo?.templateDocx) throw new Error("Arquivo Word oficial não configurado.");
  const resposta = await fetch(modelo.templateDocx);
  if (!resposta.ok) throw new Error(`Não foi possível carregar o Word oficial (${resposta.status}).`);
  const arquivos = unzipSync(new Uint8Array(await resposta.arrayBuffer()));
  const regras = regrasDoModelo(dados, modelo);
  const contadores = {};
  for (const caminho of Object.keys(arquivos)) {
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/i.test(caminho)) continue;
    arquivos[caminho] = strToU8(preencherXml(strFromU8(arquivos[caminho]), caminho, regras, contadores));
  }
  validar(arquivos);
  return { bytes: zipSync(arquivos, { level: 6 }), mime: MIME_DOCX };
}
