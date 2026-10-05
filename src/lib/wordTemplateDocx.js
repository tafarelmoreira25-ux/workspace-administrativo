import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { listarConflitosFixos } from "./documentWorkspace.js";

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
const partesData = (valor) => {
  const [ano = "", mes = "", dia = ""] = t(valor).slice(0, 10).split("-");
  const nomeMes = mes ? new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(`${ano}-${mes}-15T12:00:00Z`)) : "";
  return { ano, mes, dia: String(Number(dia) || ""), nomeMes };
};

const regra = (buscar, valor, opcoes = {}) => ({ buscar, valor: t(valor), ...opcoes });

function formasPessoa(d) {
  const feminino = d.genero === "feminino";
  return {
    artigo: feminino ? "a" : "o",
    do: feminino ? "da" : "do",
    pelo: feminino ? "pela" : "pelo",
    senhora: feminino ? "Sra." : "Sr.",
    inscrito: feminino ? "inscrita" : "inscrito",
    portador: feminino ? "portadora" : "portador",
    domiciliado: feminino ? "domiciliada" : "domiciliado",
    isento: feminino ? "isenta" : "isento",
    devedor: feminino ? "DEVEDORA" : "DEVEDOR",
    denominado: feminino ? "denominada" : "denominado",
    qualificado: feminino ? "qualificada" : "qualificado",
    informado: feminino ? "informada" : "informado",
  };
}

const FLEXOES = {
  brasileiro: ["brasileira", "brasileiro"], brasileira: ["brasileira", "brasileiro"],
  solteiro: ["solteira", "solteiro"], solteira: ["solteira", "solteiro"],
  casado: ["casada", "casado"], casada: ["casada", "casado"],
  divorciado: ["divorciada", "divorciado"], divorciada: ["divorciada", "divorciado"],
  viuvo: ["viúva", "viúvo"], "viúva": ["viúva", "viúvo"], "viúvo": ["viúva", "viúvo"],
  advogado: ["advogada", "advogado"], advogada: ["advogada", "advogado"],
  autonomo: ["autônoma", "autônomo"], "autônoma": ["autônoma", "autônomo"], "autônomo": ["autônoma", "autônomo"],
  empresario: ["empresária", "empresário"], "empresária": ["empresária", "empresário"], "empresário": ["empresária", "empresário"],
  aposentado: ["aposentada", "aposentado"], aposentada: ["aposentada", "aposentado"],
};

function concordarCampoPerfil(valor, d) {
  const feminino = d.genero === "feminino";
  return t(valor).replace(/[\p{L}À-ÿ]+/gu, (palavra) => {
    const chave = palavra.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const formas = FLEXOES[chave];
    if (!formas) return palavra;
    const ajustada = formas[feminino ? 0 : 1];
    return palavra === palavra.toUpperCase() ? ajustada.toUpperCase() : palavra[0] === palavra[0].toUpperCase() ? `${ajustada[0].toUpperCase()}${ajustada.slice(1)}` : ajustada;
  });
}

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
  if (modo === "termo-acesso-portal-gov") return [
    regra("[NOME DO CLIENTE]", t(d.nomeCliente).toUpperCase()), regra("[XXX.XXX.XXX-XX]", d.cpfCnpj),
    regra("inscrito(a)", formasPessoa(d).inscrito),
    regra("[Dia]", partesData(d.dataDocumento).dia), regra("[Mês]", partesData(d.dataDocumento).nomeMes),
  ];
  if (modo === "termo-entrega-laudo-pericial") return [
    regra("[Nome Do Cliente]", d.nomeCliente), regra("Nome Do Cliente", d.nomeCliente),
    regra("[Nacionalidade]", concordarCampoPerfil(d.nacionalidade, d)),
    regra("[Estado Civil]", concordarCampoPerfil(d.estadoCivil, d)),
    regra("[Profissão]", concordarCampoPerfil(d.profissao, d)),
    regra("[XXXXXXX-UF]", d.rg), regra("[XXX.XXX.XXX-XX]", d.cpfCnpj),
    regra("[Rua XXXXXXXX, n.º XXX — Bairro — Cidade/UF — CEP: XXXXX-XXX]", d.endereco),
    regra("portador(a)", formasPessoa(d).portador), regra("domiciliado(a)", formasPessoa(d).domiciliado),
    regra("orientado(a)", d.genero === "feminino" ? "orientada" : "orientado"),
  ];
  if (modo === "termo-ciencia-consentimento-contratacao") return [
    regra("NOME DO TITULAR DO CARTÃO", t(d.nomeTitularCartao).toUpperCase()), regra("XXX.XXX.XXX-XX", d.cpfTitularCartao),
    regra("5447 **** **** 9904", d.numeroCartaoMascarado), regra("X.XXX, XX", semReal(d.valorPagamento)),
    regra("XX parcelas", `${t(d.quantidadeParcelas)} parcelas`), regra("XXXXXXXXXXXXXXXXXX", d.codigoTransacao),
    regra("x0map21h37by7922jor97rfoec", d.codigoTransacao), regra("XX/XX/2026", dataCurta(d.dataDocumento)),
    regra("inscrito(a)", formasPessoa({ genero: d.generoTitularCartao }).inscrito),
    regra("informado(a)", formasPessoa({ genero: d.generoTitularCartao }).informado),
  ];
  if (modo === "termo-consentimento-compras-2026") return [regra("NOME DO TITULAR DO CARTÃO", t(d.nomeTitularCartao).toUpperCase()), regra("XXX.XXX.XXX-XX", d.cpfTitularCartao), regra("5447 **** **** 9904", d.numeroCartaoMascarado), regra("X.XXX, XX", semReal(d.valorPagamento)), regra("XX parcelas", `${t(d.quantidadeParcelas)} parcelas`), regra("x0map21h37by7922jor97rfoec", d.codigoTransacao), regra("XX/XX/2026", dataCurta(d.dataDocumento)), regra("inscrito(a)", formasPessoa({ genero: d.generoTitularCartao }).inscrito), regra("informado(a)", formasPessoa({ genero: d.generoTitularCartao }).informado)];
  if (modo === "termo-pagamento-cartao-terceiro") return [
    regra("Nome Do Titular Do Cartão", d.nomeTitularCartao), regra("NOME DO TITULAR DO CARTÃO", t(d.nomeTitularCartao).toUpperCase()),
    regra("Nome Do Contratante", d.nomeContratante), regra("NOME DO CONTRATANTE", t(d.nomeContratante).toUpperCase()),
    regra("XXX.XXX.XXX-XX", null, { valores: [d.cpfTitularCartao, d.cpfContratante, d.cpfTitularCartao] }),
    regra("5447 **** **** 9904", d.numeroCartaoMascarado), regra("X.XXX, XX", semReal(d.valorPagamento)),
    regra("XX parcelas", `${t(d.quantidadeParcelas)} parcelas`), regra("número do código", d.codigoTransacao),
    regra("x0map21h37by7922jor97rfoec", d.codigoTransacao), regra("XX/XX/2026", dataCurta(d.dataDocumento)),
    regra("inscrito(a)", formasPessoa({ genero: d.generoTitularCartao }).inscrito),
    regra("informado(a)", formasPessoa({ genero: d.generoTitularCartao }).informado),
  ];
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
  return [
    regra("[NºXXXXXX]", d.numeroRecibo, { parte: /^word\/header/i }),
    regra("Nome - CPF: XXX.XXX.XXX-XX", `${t(d.nomePagador)} - CPF: ${t(d.cpfPagador)}`),
    regra("X.XXX, XX", semReal(d.valorRecebido)), regra("XX:XX:XX", d.horarioTransacao),
    regra("Estado, dia de mês de 2026", `${t(d.localEmissao)}, ${dataLonga(d.dataPagamento)}`),
    regra("Documento assinado por Platino Soluções Financeiras em dia/mês/2026 às xx:xx.", `Documento assinado por Platino Soluções Financeiras em ${dataCurta(d.dataAssinatura)} às ${t(d.horarioAssinatura)}.`),
    ...comuns, ...(extras[modo] || []),
  ];
}

function regrasNotificacao(d, modo) {
  const f = formasPessoa(d);
  if (["notificacao-exibicao-documentos-bancarios", "notificacao-contestacao-revisao-contratual"].includes(modo)) return [
    regra("[Nome da Instituição Financeira / Banco]", d.banco), regra("[Endereço da Agência ou Sede]", d.enderecoBanco),
    regra("[Número do Contrato]", d.numeroContrato), regra("[Nome Completo / Razão Social]", d.nomeCliente),
    regra("[Número do CPF ou CNPJ]", d.cpfCnpj), regra("[Nome Do Cliente]", d.nomeCliente), regra("[CPF do cliente]", d.cpfCnpj),
    regra("[Seu E-mail]", d.emailResposta), regra("[São Paulo - SP]", d.localEmissao), regra("[Data]", dataLonga(d.dataDocumento)),
    regra("inscrito(a)", f.inscrito), regra("qualificado(a)", f.qualificado),
    regra("do(a) consumidor(a)", d.genero === "feminino" ? "da consumidora" : "do consumidor"),
    regra("acima identificado(a)", `acima ${d.genero === "feminino" ? "identificada" : "identificado"}`),
    regra("[X.XXX,XX]", null, { valores: [semReal(d.valorSeguro), semReal(d.valorRegistro), semReal(d.valorAvaliacao), semReal(d.valorIof), semReal(d.valorIofAdicional)] }),
  ];
  if (["notificacao-formalizacao-acordo", "notificacao-manifestacao-composicao-acordo"].includes(modo)) return [
    regra("Nome do Banco", d.banco), regra("NOME DO BANCO", t(d.banco).toUpperCase()),
    regra("XXXXX", d.numeroContrato), regra("[Nome Do Cliente]", d.nomeCliente), regra("[CPF do cliente]", d.cpfCnpj),
    regra("Data do contrato", dataCurta(d.dataContrato)),
    regra("Valor (número por escrito)", `${semReal(d.saldoDevedor)} (${t(d.saldoDevedorExtenso)})`),
    regra("XX (número por escrito)", `${t(d.quantidadeParcelas)} (${t(d.quantidadeParcelasExtenso)})`, { contexto: "Quantidade total de parcelas: " }),
    regra("XX (número por escrito)", `${t(d.parcelasPagas)} (${t(d.parcelasPagasExtenso)})`, { contexto: "Parcelas pagas: " }),
    regra("Quantidade", d.parcelasAbertas, { contexto: "Parcelas eventualmente em aberto: " }),
    regra("X.XXX,XX (número por escrito)", `${semReal(d.valorParcela)} (${t(d.valorParcelaExtenso)})`),
    regra("valor (número por escrito)", `${semReal(d.valorQuitacao)} (${t(d.valorQuitacaoExtenso)})`),
    regra("valor da parcela corrigida", semReal(d.valorParcelaCorrigida)), regra("XX meses/parcelas", `${t(d.prazoReestruturacao)} meses/parcelas`),
    regra("[DATA DO ENVIO]", dataCurta(d.dataEnvioParecer)), regra("[XX]", d.diasSemResposta),
    regra("O requerente", d.genero === "feminino" ? "A requerente" : "O requerente"),
    regra("o requerente", d.genero === "feminino" ? "a requerente" : "o requerente"),
    regra("acima identificado", `acima ${d.genero === "feminino" ? "identificada" : "identificado"}`),
    regra("O solicitante", d.genero === "feminino" ? "A solicitante" : "O solicitante"),
    regra("o solicitante", d.genero === "feminino" ? "a solicitante" : "o solicitante"),
  ];
  if (modo === "notificacao-respaldo-parecer-tecnico") return [
    regra("[NOME DO CLIENTE]", t(d.nomeCliente).toUpperCase()), regra("[XXXXXX]", d.protocolo),
    regra("[IDENTIFICAÇÃO]", d.numeroContrato), regra("Nome do Perito", d.nomePerito), regra("[VALOR]", semReal(d.valorHonorarios)),
    regra("[DATA]", dataCurta(d.dataLimiteAceite)), regra("[HORÁRIO — BRASÍLIA]", d.horarioLimiteAceite),
    regra("[dia]", partesData(d.dataDocumento).dia), regra("[mês]", partesData(d.dataDocumento).nomeMes),
  ];
  const comuns = [regra("[Data]", dataLonga(d.dataDocumento), { parte: /^word\/header/i }), regra("[Nome Do Banco]", d.banco), regra("XX.XXX.XXX/XXXX-XX", d.cnpjBanco), regra("Endereço completo do banco ou canal eletrônico oficial.", d.enderecoBanco), regra("[Nome Do Cliente]", d.nomeCliente), regra("[NOME DO CLIENTE]", t(d.nomeCliente).toUpperCase()), regra("[CPF do cliente]", d.cpfCnpj), regra("[valor]", semReal(d.valorContrato)), regra("[valor por extenso]", null, { valores: [d.valorContratoExtenso, d.valorParcelaExtenso] }), regra("[quantidade]", d.quantidadeParcelas), regra("[valor da parcela]", semReal(d.valorParcela)), regra("[número do contrato, se houver]", d.numeroContrato)];
  const extras = {
    "notificacao-prosseguimento-acao": [regra("[Protocolo]", d.protocolo), regra("[Data]", dataCurta(d.dataInicio)), regra("[Datas e canais]", d.datasCanais), regra("[PROTOCOLO E DATA]", `${t(d.protocoloAnterior)} - ${dataCurta(d.dataSolicitacaoAnterior)}`), regra("[IDENTIFICAÇÃO]", d.documentosPendentes), regra("[Descrever a pendência]", d.pendencia)],
    "notificacao-via-oficial-justica": [regra("[NÚMERO DO PROCEDIMENTO]", d.numeroProcedimento), regra("[VARA E COMARCA]", d.varaComarca), regra("[DATA E IDENTIFICAÇÃO DO ATO]", `${dataCurta(d.dataDecisao)} - ${t(d.identificacaoAto)}`), regra("[NÚMERO OU IDENTIFICAÇÃO]", d.numeroMandado), regra("[Descrever pendência e documentos requeridos]", d.pendenciaDocumentos)],
    "notificacao-finalizacao-conciliacao": [regra("[Protocolo e data]", `${t(d.protocolo)} - ${dataCurta(d.dataProtocolo)}`), regra("[Síntese da revisão]", d.sinteseRevisao), regra("[Data e horário]", `${dataCurta(d.dataReuniao)} ${t(d.horarioReuniao)}`), regra("[Canal ou local]", d.canalReuniao)],
    "notificacao-requerimento-taxas": [regra("[Identificação das taxas e valores]", d.taxasQuestionadas)],
  };
  if (modo === "notificacao-intimacao-finalizacao-conciliacao") modo = "notificacao-finalizacao-conciliacao";
  return [...comuns, ...(extras[modo] || []), regra("inscrito no CPF sob o nº", `${f.inscrito} no CPF sob o nº`)];
}

function regrasLiminar(d) {
  return [regra("Nome do contratante", d.nomeContratante), regra("NOME DO CONTRATANTE", t(d.nomeContratante).toUpperCase()), regra("X.XXX,XX", semReal(d.valorDespesa)), regra("X.XXX, XX", semReal(d.valorDespesa)), regra("(valor por extenso)", `(${t(d.valorDespesaExtenso)})`), regra("dia/mês/ano", dataCurta(d.dataDesembolso)), regra("São Paulo, dia de mês de 2026", `${t(d.localEmissao || "São Paulo")}, ${dataLonga(d.dataDocumento)}`)];
}

function nomeBancoNoModelo(valor) {
  return t(valor).replace(/^banco\s+/i, "");
}

function regrasProcuracaoDeclaracoes(d, modo) {
  const f = formasPessoa(d);
  const dataDocumento = d.dataDocumento || d.dataEmissao;
  const dataLocal = `${t(d.cidade)}${d.uf ? `-${t(d.uf).toUpperCase()}` : ""}, ${dataLonga(dataDocumento)}.`;
  if (modo === "declaracao-residencia-gov") {
    const titular = formasPessoa({ genero: d.generoTitularResidencia });
    return [
      regra("[NOME COMPLETO DO DECLARANTE]", t(d.nomeCliente).toUpperCase()),
      regra("[NOME COMPLETO DO TITULAR DA RESIDÊNCIA]", t(d.nomeTitularResidencia).toUpperCase()),
      regra("[nacionalidade]", concordarCampoPerfil(d.nacionalidade, d)), regra("[estado civil]", concordarCampoPerfil(d.estadoCivil, d)),
      regra("[profissão]", concordarCampoPerfil(d.profissao, d)),
      regra("[número do RG]", null, { valores: [d.rg, d.rgTitularResidencia] }),
      regra("[número do CPF]", null, { valores: [d.cpfCnpj, d.cpfTitularResidencia] }),
      regra("________________________________________________", d.nomeTitularResidencia, { contexto: "resido com " }),
      regra("______________________________", d.cpfTitularResidencia, { contexto: "inscrito(a) no CPF sob o nº " }),
      regra("[endereço completo, número, complemento, bairro, cidade/UF e CEP]", d.endereco),
      regra("______________________________", d.cpfCnpj, { contexto: "DECLARANTE — CPF nº " }),
      regra("______________________________", d.cpfTitularResidencia, { contexto: "TITULAR DA RESIDÊNCIA — CPF nº " }),
      regra("portador(a)", null, { valores: [f.portador, titular.portador] }),
      regra("inscrito(a)", null, { valores: [f.inscrito, titular.inscrito, titular.inscrito] }),
      regra("o(a) declarante", `${f.artigo} declarante`),
      regra("declarante acima identificado(a)", `declarante acima ${d.genero === "feminino" ? "identificada" : "identificado"}`),
      regra("[Cidade/UF]", d.localEmissao), regra("[dia]", partesData(dataDocumento).dia),
      regra("[mês]", partesData(dataDocumento).nomeMes), regra("[ano]", partesData(dataDocumento).ano),
    ];
  }
  if (modo === "procuracao") {
    return [
      regra("Estado, dia de mês de 2026.", `${t(d.cidade)}-${t(d.uf).toUpperCase()}, ${dataLonga(d.dataEmissao)}.`),
      regra("portador (a) da cédula", `${f.portador} da cédula`),
      regra("residente e domiciliado na XXXXXXXXXXXXXXXXXXXXXXXXX", `residente e ${f.domiciliado} na ${t(d.endereco)}`),
      regra("XXXXXXXXXXXXXXXXXX", d.nomeCliente, { contexto: "OUTORGANTE: " }),
      regra("Nome do titular", d.nomeCliente),
      regra("o(a) OUTORGANTE", `${f.artigo} OUTORGANTE`),
      regra("nacionalidade", concordarCampoPerfil(d.nacionalidade, d)),
      regra("estado cívil", concordarCampoPerfil(d.estadoCivil, d)),
      regra("estado civil", concordarCampoPerfil(d.estadoCivil, d)),
      regra("profissão", concordarCampoPerfil(d.profissao, d)),
      regra("portadora da Cédula", `${f.portador} da Cédula`),
      regra("portador (a) da Cédula", `${f.portador} da Cédula`),
      regra("R.G. n° XXXXXXXXX", `R.G. n° ${t(d.rg)}`),
      regra("inscrito(a) no C.P.F./M.F. sob n° XXXXXXXXXX", `${f.inscrito} no C.P.F./M.F. sob n° ${t(d.cpfCnpj)}`),
      regra("endereço eletrônico: XXXXXXXXXXXXXXXXXX", `endereço eletrônico: ${t(d.email)}`),
      regra("residente e domiciliado na Rua XXXXXXXXXXXXXXXXXXXXXXXXX", `residente e ${f.domiciliado} na ${t(d.endereco)}`),
      regra("CEP: XXXXX-XXX", `CEP: ${t(d.cep)}`),
      regra("Banco XXXXXXXX", `Banco ${nomeBancoNoModelo(d.banco)}`),
      regra("Banco ____________", `Banco ${nomeBancoNoModelo(d.banco)}`),
      regra("BANCO XXXXXXXX", `BANCO ${nomeBancoNoModelo(d.banco)}`),
      regra("contrato XXXXXXXXX", `contrato ${t(d.numeroContrato)}`),
      regra("Estado, XX de XXXXXXX de 2025.", `${t(d.cidade)}-${t(d.uf).toUpperCase()}, ${partesData(d.dataEmissao).dia} de ${partesData(d.dataEmissao).nomeMes} de 2025.`),
      regra("Nome do cliente", d.nomeCliente),
      regra("CLIENTE XXXXXXXXXXXX", `CLIENTE ${t(d.nomeCliente).toUpperCase()}`),
    ];
  }

  if (modo === "declaracao-hipossuficiencia") return [
    regra("nacionalidade", concordarCampoPerfil(d.nacionalidade, d)),
    regra("estado Civil", concordarCampoPerfil(d.estadoCivil, d)), regra("profissão", concordarCampoPerfil(d.profissao, d)),
    regra("RG n.º XXXXXXXXX SSP XX", `RG n.º ${t(d.rg)} ${t(d.orgaoExpedidor)}`),
    regra("CPF/MF sob n.º XXXXXXXXXXX", `CPF/MF sob n.º ${t(d.cpfCnpj)}`),
    regra("ESTADO, dia de mês de 2026.", dataLocal),
    regra("Eu, XXXXXXXXXXXXXX", `Eu, ${t(d.nomeCliente)}`),
    regra("NACIONALIDADE", concordarCampoPerfil(d.nacionalidade, d).toUpperCase()),
    regra("ESTADO CIVIL", concordarCampoPerfil(d.estadoCivil, d).toUpperCase()),
    regra("PROFISSÃO", concordarCampoPerfil(d.profissao, d).toUpperCase()),
    regra("portador(a)", f.portador),
    regra("RG n.º XXXXXXXXX SSP SC", `RG n.º ${t(d.rg)} ${t(d.orgaoExpedidor)}`),
    regra("inscrito(a)", f.inscrito),
    regra("CPF/MF sob n.° XXXXXXXXXXX", `CPF/MF sob n.° ${t(d.cpfCnpj)}`),
    regra("endereço eletrônico: XXXXXXXXXXXXXXXXXXXXXXX", `endereço eletrônico: ${t(d.email)}`),
    regra("domiciliado(a) na: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", `${f.domiciliado} na: ${t(d.endereco)}${d.cep ? ` – CEP: ${t(d.cep)}` : ""}`),
    regra("ESTADO, XX de XXXXXXXX de XXXX.", dataLocal),
    regra("Nome do cliente", d.nomeCliente),
    regra("NOME DO CLIENTE", t(d.nomeCliente).toUpperCase()),
  ];

  return [
    regra("Eu, XXXXXXXXXXXXXXXXXXXXXX", `Eu, ${t(d.nomeCliente)}`),
    regra("nacionalidade", concordarCampoPerfil(d.nacionalidade, d)),
    regra("estado civil", concordarCampoPerfil(d.estadoCivil, d)),
    regra("profissão", concordarCampoPerfil(d.profissao, d)),
    regra("NACIONALIDADE", concordarCampoPerfil(d.nacionalidade, d).toUpperCase()),
    regra("ESTADO CIVIL", concordarCampoPerfil(d.estadoCivil, d).toUpperCase()),
    regra("PROFISSÃO", concordarCampoPerfil(d.profissao, d).toUpperCase()),
    regra("portadora da Cédula", `${f.portador} da Cédula`),
    regra("portador(a) da Cédula", `${f.portador} da Cédula`),
    regra("portador (a) da Cédula", `${f.portador} da Cédula`),
    regra("R.G. nº XXXXXXXXXXXX", `R.G. nº ${t(d.rg)}`),
    regra("inscrito(a)", f.inscrito),
    regra("C.P.F./M.F. sob nº XXXXXXXXXXXX", `C.P.F./M.F. sob nº ${t(d.cpfCnpj)}`),
    regra("endereço eletrônico: XXXXXXXXXXXXXXXXXXXXXXXXXXX", `endereço eletrônico: ${t(d.email)}`),
    regra("residente e domiciliado na XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", `residente e ${f.domiciliado} na ${t(d.endereco)}${d.cep ? ` – CEP: ${t(d.cep)}` : ""}`),
    regra("isento(a)", f.isento, { contexto: "Declara ser " }),
    regra("Declara ser isento", `Declara ser ${f.isento}`),
    regra("ESTADO-UF  XX DE XXXXXXXXXX DE 2026.", `${t(d.cidade)}-${t(d.uf).toUpperCase()}  ${partesData(dataDocumento).dia} DE ${partesData(dataDocumento).nomeMes.toUpperCase()} DE 2026.`),
    regra("Estado-UF  XX de XXXXXXXXXX de 2026.", `${t(d.cidade)}-${t(d.uf).toUpperCase()}  ${partesData(dataDocumento).dia} de ${partesData(dataDocumento).nomeMes} de 2026.`),
    regra("ESTADO-UF  XX DE XXXXXXXXXX DE 2025.", `${t(d.cidade)}-${t(d.uf).toUpperCase()}  ${partesData(dataDocumento).dia} DE ${partesData(dataDocumento).nomeMes.toUpperCase()} DE 2025.`),
    regra("Nome do cliente", d.nomeCliente),
    regra("XXXXXXXXXX NOME XXXXXXXXXXX", t(d.nomeCliente).toUpperCase()),
  ];
}

function nomeBancoPostergacao(valor) {
  const sufixo = /\s+sociedade de cr[eé]dito,?\s+financiamento e investimento s\.?a\.?$/i;
  const base = t(valor).replace(sufixo, "").trim();
  return /^banco\b/i.test(base) ? base : `Banco ${base}`;
}

function regrasPostergacao(d) {
  const f = formasPessoa(d);
  const banco = nomeBancoPostergacao(d.banco);
  const bancoMaiusculo = banco.toUpperCase();
  const data = partesData(d.dataDocumento);
  const localData = `${t(d.cidade)}/${t(d.uf).toUpperCase()}, ${data.dia} de ${data.nomeMes} de 2026.`;
  return [
    regra("Banco Sociedade de Crédito, Financiamento e Investimento S.A.", `${banco} Sociedade de Crédito, Financiamento e Investimento S.A.`),
    regra("CNPJ: XX.XXX.XXX/XXXX-XX", `CNPJ: ${t(d.cnpjBanco)}`),
    regra("XX.XXX.XXX/XXXX-XX", d.cnpjBanco),
    regra("do(a) Sr.(a) Nome do cliente", `${f.do} ${f.senhora} ${t(d.nomeCliente)}`),
    regra("inscrita no CPF", `${f.inscrito} no CPF`),
    regra("XXX.XXX.XXX-XX", null, { valores: [d.cpfCnpj, d.cpfCnpj, d.cpfCnpj] }),
    regra("parcela X (numero por extenso)", `parcela ${t(d.numeroParcela)} (${t(d.numeroParcelaExtenso)})`),
    regra("XX/XX/2026", dataCurta(d.dataVencimento)),
    regra("R$ X.XXX,XX (numero por extenso)", `R$ ${semReal(d.valorParcela)} (${t(d.valorParcelaExtenso)})`),
    regra("Numero do contrato", d.numeroContrato),
    regra("pelo(a) cliente", `${f.pelo} cliente`),
    regra("o(a) titular", `${f.artigo} titular`),
    regra("CPF da titular", `CPF ${f.do} titular`),
    regra("do(a) Sr(a). Nome do cliente", `${f.do} ${f.senhora} ${t(d.nomeCliente)}`),
    regra("Estado/UF, dia de mês de 2026.", localData),
    regra("NOME DO BANCO", bancoMaiusculo),
    regra("DEVEDORA", f.devedor),
    regra("NOME DO CLIENTE", t(d.nomeCliente).toUpperCase()),
    regra("inscrito (a)", f.inscrito),
    regra("NUMERO DO CONTRATO", t(d.numeroContrato).toUpperCase()),
    regra("Parcela nº XX", `Parcela nº ${t(d.numeroParcela)}`),
    regra("Parcela nº 09", `Parcela nº ${t(d.numeroParcela)}`),
    regra("R$ X.XXX, XX (numero por extenso)", `R$ ${semReal(d.valorParcela)} (${t(d.valorParcelaExtenso)})`),
    regra("XX/XX/XXXX", dataCurta(d.dataVencimento)),
  ];
}

function regrasModelosOriginais(d, modo) {
  const f = formasPessoa(d);
  const dataEmissao = d.dataDocumento || d.dataEmissao;
  const data = partesData(dataEmissao);
  const local = t(d.localEmissao || d.cidade || "São Paulo");
  const localUf = d.uf && !local.toUpperCase().endsWith(`/${t(d.uf).toUpperCase()}`) ? `${local}/${t(d.uf).toUpperCase()}` : local;
  const dataFixa2026 = `${localUf}, ${data.dia} de ${data.nomeMes} de 2026.`;
  if (modo === "peticao-revelia-julgamento") return [
    regra("[NÚMERO DA VARA]", d.vara), regra("[NOME DA CIDADE/ESTADO]", d.comarca),
    regra("[inserir o número do processo]", d.numeroProcesso), regra("[Nome Do Autor]", d.nomeCliente),
    regra("[Nome Do Banco Réu]", d.banco), regra("[Data da leitura da citação eletrônica]", dataCurta(d.dataLeituraCitacao)),
    regra("[Data de início do prazo]", dataCurta(d.dataInicioPrazo)), regra("[Data final do prazo]", dataCurta(d.dataFinalPrazo)),
    regra("[São Paulo - SP]", d.localEmissao), regra("[Data de hoje]", dataLonga(dataEmissao)),
    regra("já devidamente qualificado", `já devidamente ${f.qualificado}`),
    regra("pelo Autor", d.genero === "feminino" ? "pela Autora" : "pelo Autor"),
  ];

  if (modo === "notificacao-extrajudicial") return [
    regra("São Paulo/SP, [dia] de [mês] de 2026.", dataFixa2026), regra("[NOME DO BANCO]", t(d.banco).toUpperCase()),
    regra("XX.XXX.XXX/XXXX-XX", d.cnpjBanco), regra("Endereço completo do banco.", d.enderecoBanco),
    regra("[NOME DO CLIENTE]", t(d.nomeCliente).toUpperCase()), regra("[CPF DO CLIENTE]", d.cpfCnpj),
    regra("[valor da parcela]", semReal(d.valorParcela)), regra("[valor]", semReal(d.valorFinanciamento)),
    regra("[valor por extenso]", null, { valores: [d.valorFinanciamentoExtenso, d.valorParcelaExtenso] }),
    regra("[quantidade]", d.quantidadeParcelas), regra("[data de início da representação]", dataCurta(d.dataInicioRepresentacao)),
  ];
  if (modo === "citacao-judicial") return [
    regra("Numero de processo", d.numeroProcesso), regra("[NOME DO CLIENTE]", t(d.nomeCliente).toUpperCase()),
    regra("qualificado(a)", f.qualificado), regra("[NOME DA INSTITUIÇÃO FINANCEIRA/BANCO]", t(d.banco).toUpperCase()),
    regra("São Paulo, dia de mês de 2026.", `${t(d.cidade)}, ${data.dia} de ${data.nomeMes} de 2026.`),
    regra("NOME DO CLIENTE", t(d.nomeCliente).toUpperCase()),
  ];
  if (modo === "intimacao-extrajudicial") return [
    regra("Nome do banco", d.banco), regra("xx.xxx.xxx/xxxx-xx", d.cnpjBanco), regra("Endereço completo do banco", d.enderecoBanco),
    regra("(data de contrato com o banco)", dataCurta(d.dataContrato)), regra("R$ ______", null, { valores: [`R$ ${semReal(d.valorParcelaCorrigido)}`, `R$ ${semReal(d.valorEstorno)}`, `R$ ${semReal(d.reducaoTotal)}`] }),
    regra("R$______", `R$ ${semReal(d.reducaoParcela)}`), regra("São Paulo, dia de mês de 2026.", `São Paulo, ${data.dia} de ${data.nomeMes} de 2026.`),
    regra("NOME DO CLIENTE", t(d.nomeCliente).toUpperCase()),
  ];
  if (modo === "chargeback") return [
    regra("[NOME DO CLIENTE]", t(d.nomeCliente).toUpperCase()), regra("[CPF DO CLIENTE]", d.cpfCnpj), regra("[DATA]", dataCurta(d.dataPagamento)),
    regra("[VALOR]", semReal(d.valorPagamento)), regra("Nome do responsável pelo documento", d.responsavelDocumento),
    regra("Estado, dia de mês de 2026.", `${t(d.localEmissao)}, ${data.dia} de ${data.nomeMes} de 2026.`),
  ];
  if (modo === "termo-compromisso-pagamento") return [
    regra("Nome do cliente", d.nomeCliente), regra("xxx.xxx.xxx-xx", d.cpfCnpj), regra("denominado simplesmente CLIENTE", `${f.denominado} simplesmente CLIENTE`),
    regra("R$ valor", `R$ ${semReal(d.valorTotal)}`), regra("dia/mês/ano", dataCurta(d.dataCompromisso)), regra("custos de produto", `custos de ${t(d.produto)}`),
    regra("Estado/UF, dia de mês de ano.", `${t(d.localEmissao)}, ${dataLonga(dataEmissao)}.`),
  ];
  if (modo === "termo-ciencia-seguranca") return [
    regra("São Paulo/SP, [dia] de [mês] de 2026.", dataFixa2026), regra("Nome do cliente", d.nomeCliente), regra("xxx.xxx.xxx-xx", d.cpfCnpj),
    regra("dia/mês/2026", dataCurta(d.dataAberturaReclamacao)), regra("Nome do Banco", d.banco), regra("________________________", d.numeroProtocolo),
    regra("_______________________________________________", d.nomeCliente), regra("______________________________", d.cpfCnpj),
    regra("inscrito(a)", f.inscrito), regra("informado(a)", f.informado), regra("NOME DO CLIENTE", t(d.nomeCliente).toUpperCase()),
  ];
  if (modo === "declaracao-ausencia-carteira-trabalho") return [
    regra("[Nome Completo Do Cliente]", d.nomeCliente),
    regra("[NOME COMPLETO DO CLIENTE]", t(d.nomeCliente).toUpperCase()), regra("[nacionalidade]", concordarCampoPerfil(d.nacionalidade, d)),
    regra("[estado civil]", concordarCampoPerfil(d.estadoCivil, d)), regra("[profissão]", concordarCampoPerfil(d.profissao, d)),
    regra("portador(a)", f.portador), regra("[número do RG]", d.rg), regra("inscrito(a)", f.inscrito), regra("[número do CPF]", d.cpfCnpj),
    regra("[e-mail]", d.email), regra("domiciliado(a)", f.domiciliado), regra("[endereço completo, número, bairro, cidade/UF, CEP]", d.endereco),
    regra("Estado, dia de mês de 2026.", `${t(d.localEmissao)}, ${data.dia} de ${data.nomeMes} de 2026.`), regra("NOME COMPLETO DO CLIENTE", t(d.nomeCliente).toUpperCase()),
    regra("Nome Completo Do Cliente", d.nomeCliente),
  ];
  if (modo === "recibo-prestacao-servicos") return [
    regra("Nome do cliente", d.nomeCliente), regra("xxx.xxx.xxx-xx", d.cpfCnpj), regra("x.xxx,xx", null, { valores: [semReal(d.valorPagamento), semReal(d.valorPagamento)] }),
    regra("valor por extenso", d.valorPorExtenso), regra("crédito/débito parcelado (xx)", d.modalidade), regra("xx/xx/2026", dataCurta(dataEmissao)),
    regra("xx:xx", t(d.horario) || "00:00"), regra("Crédito Parcelado (7x)", t(d.tipoVenda) || d.modalidade), regra("bandeira do cartão", d.bandeira),
    regra("xxxxxxxx", d.codigoAutorizacao), regra("São Paulo dia de mês de 2026", `${t(d.cidade)} ${data.dia} de ${data.nomeMes} de 2026`),
  ];
  if (modo === "relatorio-negociacao-homologacao") return [
    regra("São Paulo/SP, [dia] de [mês] de 2026.", `${t(d.cidade)}/SP, ${data.dia} de ${data.nomeMes} de 2026.`),
    regra("[NOME DO CLIENTE]", t(d.nomeCliente).toUpperCase()), regra("XX.XXX.XXX -XX", d.cpfCnpj), regra("[dia/mês/2026]", null, { valores: [dataCurta(d.dataContato), dataCurta(d.dataProposta)] }),
    regra("[valor]", null, { valores: [d.totalAtraso, d.propostaQuitacao, d.saldoDevedor, d.valorQuitacao, d.totalAtraso] }),
    regra("[valor por extenso]", null, { valores: [d.totalAtrasoExtenso, d.propostaQuitacaoExtenso, d.saldoDevedorExtenso, d.valorQuitacaoExtenso, d.totalAtrasoExtenso] }),
    regra("[INFORMAR PROTOCOLO]", d.protocolo), regra("[quantidade]", d.quantidadeParcelas), regra("[informar prazo / não informado]", d.validadeProposta), regra("NOME DO CLIENTE", t(d.nomeCliente).toUpperCase()),
  ];
  if (modo === "termo-recompra") return [
    regra("Nome do cliente", d.nomeCliente), regra("xxx.xxx.xxx-xx", d.cpfCnpj), regra("denominado simplesmente CLIENTE", `${f.denominado} simplesmente CLIENTE`),
    regra("x.xxx,xx", semReal(d.valorRecompra)), regra("número por extenso", d.valorRecompraExtenso),
    regra("Cartão de crédito em X parcelas/Cartão de débito à vista/PIX", d.modalidade),
    regra("São Paulo/SP, dia de mês de 2026.", `${t(d.cidade)}/SP, ${data.dia} de ${data.nomeMes} de 2026.`), regra("NOME DO CLIENTE", t(d.nomeCliente).toUpperCase()),
  ];
  return [];
}

function regrasDoModelo(dados, modelo) {
  if (modelo.modo === "declaracao-isencao-comprovante-endereco") return regrasComprovanteEndereco(dados);
  if (["procuracao", "declaracao-hipossuficiencia", "declaracao-isencao-irpf", "declaracao-residencia-gov"].includes(modelo.modo)) return regrasProcuracaoDeclaracoes(dados, modelo.modo);
  if (modelo.modo === "peticao-revelia-julgamento") return regrasModelosOriginais(dados, modelo.modo);
  if (modelo.modo === "requerimento-postergacao-parcela") return regrasPostergacao(dados);
  if (["notificacao-extrajudicial", "citacao-judicial", "intimacao-extrajudicial", "chargeback", "termo-compromisso-pagamento", "termo-ciencia-seguranca", "declaracao-ausencia-carteira-trabalho", "recibo-prestacao-servicos", "relatorio-negociacao-homologacao", "termo-recompra"].includes(modelo.modo)) return regrasModelosOriginais(dados, modelo.modo);
  if (modelo.modo.startsWith("distrato-")) return regrasDistrato(dados, modelo.modo);
  if (modelo.modo.startsWith("termo-")) return regrasTermo(dados, modelo.modo);
  if (modelo.modo.startsWith("recibo-servicos-")) return regrasRecibo(dados, modelo.modo);
  if (modelo.modo.startsWith("notificacao-")) return regrasNotificacao(dados, modelo.modo);
  if (modelo.modo.startsWith("liminar-")) return regrasLiminar(dados);
  return [];
}

function regrasComprovanteEndereco(d) {
  const f = formasPessoa(d);
  const parentescos = { esposa: "Esposa", marido: "Marido", mae: "Mãe", pai: "Pai", outro: "Outro" };
  return [
    regra("____________________________________________", d.nomeCliente, { contexto: "Eu, " }),
    regra("____________________________", d.cpfCnpj, { contexto: "CPF nº " }),
    regra("__________________________, declaro", `${t(d.rg)}, declaro`),
    regra("________________________________________________________________", d.endereco, { contexto: "Endereço: " }),
    regra("________________________________________________________________", d.endereco, { contexto: "Rua: " }),
    regra("______________________________", d.bairro, { contexto: "Bairro: " }),
    regra("______________________________", d.cidade, { contexto: "Cidade: " }),
    regra("______________________________", d.uf, { contexto: "Estado: " }),
    regra("_________________________________", d.cep, { contexto: "CEP: " }),
    ...Object.entries(parentescos).map(([valor, rotulo]) => regra(`(   ) ${rotulo}`, `(${d.parentesco === valor ? " X " : "   "}) ${rotulo}`)),
    regra("___________________________________________", d.parentesco === "outro" ? d.outroParentesco : "—", { contexto: "Outro: " }),
    regra("__________________________________________", d.nomeTitularComprovante, { contexto: "Nome do titular do comprovante: " }),
    regra("___________________________________________", d.cpfTitularComprovante, { contexto: "CPF do titular do comprovante: " }),
    regra("portador(a)", f.portador),
    regra("Estado, dia de mês de 2026.", `${t(d.localEmissao)}, ${partesData(d.dataDocumento).dia} de ${partesData(d.dataDocumento).nomeMes} de 2026.`),
  ];
}

function substituirNoParagrafo(paragrafo, item, indiceInicial) {
  const nos = Array.from(paragrafo.getElementsByTagNameNS(W_NS, "t"));
  let total = 0;
  let buscaAPartir = 0;
  while (nos.length) {
    const completo = nos.map((no) => no.textContent || "").join("");
    const inicio = completo.indexOf(item.buscar, buscaAPartir);
    if (inicio < 0) break;
    if (item.contexto && completo.slice(0, inicio).slice(-item.contexto.length) !== item.contexto) {
      buscaAPartir = inicio + item.buscar.length;
      continue;
    }
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
    buscaAPartir = inicio + valor.length;
  }
  return total;
}

function preencherXml(xml, caminho, regras, contadores) {
  const documento = new DOMParser().parseFromString(xml, "application/xml");
  if (documento.getElementsByTagName("parsererror").length) throw new Error(`XML inválido no modelo oficial: ${caminho}.`);
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

function validar(arquivos, modelo) {
  const pendencias = new Set();
  for (const [caminho, bytes] of Object.entries(arquivos)) {
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/i.test(caminho)) continue;
    const documento = new DOMParser().parseFromString(strFromU8(bytes), "application/xml");
    const texto = Array.from(documento.getElementsByTagNameNS(W_NS, "t")).map((no) => no.textContent || "").join("");
    (texto.match(/\[[^\]]+\]/g) || []).forEach((token) => pendencias.add(token));
    const validarSequenciasX = Boolean(modelo?.templateOriginal) || ["procuracao", "declaracao-hipossuficiencia", "declaracao-isencao-irpf", "requerimento-postergacao-parcela"].includes(modelo?.modo);
    const marcador = texto.match(/X{3,}|XXX\.XXX\.XXX|xxx\.xxx\.xxx|X\.XXX,?\s?XX|dia\/mês\/(?:ano|2026)|Nome do contratante|NOME DO CONTRATANTE|Nome do cliente|NOME DO CLIENTE|numero por extenso|Numero do contrato|NUMERO DO CONTRATO/);
    if ((validarSequenciasX && marcador) || (!validarSequenciasX && marcador && !/^X{3,}$/.test(marcador[0]))) pendencias.add(`campo de exemplo “${marcador[0]}”`);
  }
  if (pendencias.size) throw new Error(`Preencha os campos obrigatórios do modelo: ${[...pendencias].join(", ")}.`);
}

function removerMarcadoresAmarelos(xml) {
  const documento = new DOMParser().parseFromString(xml, "application/xml");
  for (const no of Array.from(documento.getElementsByTagNameNS(W_NS, "highlight"))) {
    const valor = no.getAttributeNS(W_NS, "val");
    if (["yellow", "FFFF00"].includes(valor)) no.setAttributeNS(W_NS, "w:val", "none");
  }
  for (const no of Array.from(documento.getElementsByTagNameNS(W_NS, "shd"))) {
    for (const atributo of ["fill", "color"]) {
      if ((no.getAttributeNS(W_NS, atributo) || "").toUpperCase() === "FFFF00") no.setAttributeNS(W_NS, `w:${atributo}`, "auto");
    }
  }
  return new XMLSerializer().serializeToString(documento);
}

export async function gerarWordOficial(dados, modelo) {
  if (!modelo?.templateDocx) throw new Error("Arquivo do modelo oficial não configurado.");
  if (modelo.revisaoWordPendente) throw new Error(`Geração bloqueada: ${modelo.revisaoWordPendente}`);
  if (modelo.templateSha256) {
    const vazios = (modelo.campos || []).filter((campo) => campo.obrigatorio && !t(dados[campo.nome]));
    if (vazios.length) throw new Error(`Preencha os campos obrigatórios do modelo: ${vazios.map((campo) => campo.rotulo).join(", ")}.`);
    if (modelo.modo === "declaracao-isencao-comprovante-endereco" && dados.parentesco === "outro" && !t(dados.outroParentesco)) throw new Error("Informe com quem reside no campo Outro.");
    const conflitos = listarConflitosFixos(modelo, dados);
    if (conflitos.length) throw new Error(`Geração bloqueada: ${conflitos.map((conflito) => conflito.mensagem).join(" ")}`);
  }
  const resposta = await fetch(modelo.templateDocx, { cache: "no-store" });
  if (!resposta.ok) throw new Error(`Não foi possível carregar o modelo oficial (${resposta.status}).`);
  const bytesOriginal = new Uint8Array(await resposta.arrayBuffer());
  if (modelo.templateSha256) {
    const digest = await crypto.subtle.digest("SHA-256", bytesOriginal);
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (hash !== modelo.templateSha256) throw new Error("Geração bloqueada: o arquivo carregado diverge do modelo atualizado. Atualize os arquivos da aplicação.");
  }
  const arquivos = unzipSync(bytesOriginal);
  const regras = regrasDoModelo(dados, modelo);
  const contadores = {};
  for (const caminho of Object.keys(arquivos)) {
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/i.test(caminho)) continue;
    arquivos[caminho] = strToU8(preencherXml(strFromU8(arquivos[caminho]), caminho, regras, contadores));
  }
  validar(arquivos, modelo);
  // Os marcadores servem à identificação no original; a cópia final não os exibe.
  for (const caminho of Object.keys(arquivos)) {
    if (!/^word\/.*\.xml$/i.test(caminho)) continue;
    const xml = strFromU8(arquivos[caminho]);
    if (/(?:highlight|shd)/.test(xml)) arquivos[caminho] = strToU8(removerMarcadoresAmarelos(xml));
  }
  return { bytes: zipSync(arquivos, { level: 6 }), mime: MIME_DOCX };
}
