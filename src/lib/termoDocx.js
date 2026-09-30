import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const texto = (valor) => String(valor ?? "").trim();
const semReal = (valor) => texto(valor).replace(/^R\$\s*/i, "");

function dataCurta(valor) {
  const partes = texto(valor).slice(0, 10).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto(valor);
}

function dataLonga(valor) {
  const partes = texto(valor).slice(0, 10).split("-").map(Number);
  if (partes.length !== 3 || partes.some((parte) => !parte)) return texto(valor);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(partes[0], partes[1] - 1, partes[2])));
}

function regrasDoModelo(modo, dados) {
  const cartao = [
    { buscar: "NOME DO TITULAR DO CARTÃO", valor: texto(dados.nomeTitularCartao).toUpperCase() },
    { buscar: "XXX.XXX.XXX-XX", valor: texto(dados.cpfTitularCartao), maximo: 1 },
    { buscar: "5447 **** **** 9904", valor: texto(dados.numeroCartaoMascarado) },
    { buscar: "X.XXX, XX", valor: semReal(dados.valorPagamento) },
    { buscar: "XX parcelas", valor: `${texto(dados.quantidadeParcelas)} parcelas` },
    { buscar: "x0map21h37by7922jor97rfoec", valor: texto(dados.codigoTransacao) },
    { buscar: "XX/XX/2026", valor: dataCurta(dados.dataDocumento) },
  ];
  const regras = {
    "termo-ciencia-consentimento-contratacao": cartao,
    "termo-consentimento-compras-2026": cartao,
    "termo-pagamento-cartao-terceiro": [
      ...cartao.filter((regra) => regra.buscar !== "XXX.XXX.XXX-XX"),
      { buscar: "NOME DO CONTRATANTE", valor: texto(dados.nomeContratante).toUpperCase() },
      { buscar: "XXX.XXX.XXX-XX", valores: [texto(dados.cpfTitularCartao), texto(dados.cpfContratante)], maximo: 2 },
    ],
    "termo-reconhecimento-recompra": [
      { buscar: "Nome do contratante", valor: texto(dados.nomeContratante) },
      { buscar: "NOME DO CONTRATANTE", valor: texto(dados.nomeContratante).toUpperCase() },
      { buscar: "XXX.XXX.XXX-XX", valor: texto(dados.cpfContratante) },
      { buscar: "X.XXX, XX", valor: semReal(dados.valorRecompra) },
      { buscar: "(valor por extenso)", valor: `(${texto(dados.valorRecompraExtenso)})` },
      { buscar: "FORMA DE PAGAMENTO", valor: texto(dados.formaPagamento).toUpperCase() },
      { buscar: "São Paulo/SP, dia de mês de 2026", valor: `${texto(dados.localEmissao)}, ${dataLonga(dados.dataDocumento)}` },
    ],
    "termo-responsabilidade-parcelas-atraso": [
      { buscar: "Nome do cliente", valor: texto(dados.nomeCliente) },
      { buscar: "Nome Completo Do Cliente", valor: texto(dados.nomeCliente).toUpperCase() },
      { buscar: "RG nº ____________,", valor: `RG nº ${texto(dados.rg)},` },
      { buscar: "CPF/CNPJ -MF sob o nº___________________,", valor: `CPF/CNPJ -MF sob o nº ${texto(dados.cpfCnpj)},` },
      { buscar: "rua _______________________", valor: texto(dados.logradouro) },
      { buscar: "Nº____", valor: `Nº ${texto(dados.numeroEndereco)}` },
      { buscar: "Bairro:________________", valor: `Bairro: ${texto(dados.bairro)}` },
      { buscar: "Cidade/Estado: ____________________________", valor: `Cidade/Estado: ${texto(dados.cidadeEstado)}` },
      { buscar: "Estado/UF, dia de mês de 2026", valor: `${texto(dados.localEmissao)}, ${dataLonga(dados.dataDocumento)}` },
      { buscar: "XXX.XXX.XXX-XX", valor: texto(dados.cpfCnpj) },
    ],
  };
  return regras[modo] || [];
}

function substituir(paragrafo, regra, contador) {
  const nos = Array.from(paragrafo.getElementsByTagNameNS(W_NS, "t"));
  let feitas = 0;
  while (nos.length) {
    const completo = nos.map((no) => no.textContent || "").join("");
    const inicio = completo.indexOf(regra.buscar);
    if (inicio < 0) break;
    if (contador + feitas < (regra.ocorrenciaInicial || 0)) { feitas += 1; break; }
    if (regra.maximo && contador + feitas - (regra.ocorrenciaInicial || 0) >= regra.maximo) break;
    const fim = inicio + regra.buscar.length;
    let cursor = 0; let primeiro; let ultimo; let offsetInicio = 0; let offsetFim = 0;
    for (const no of nos) {
      const tamanho = (no.textContent || "").length;
      if (!primeiro && inicio >= cursor && inicio < cursor + tamanho) { primeiro = no; offsetInicio = inicio - cursor; }
      if (!ultimo && fim > cursor && fim <= cursor + tamanho) { ultimo = no; offsetFim = fim - cursor; break; }
      cursor += tamanho;
    }
    if (!primeiro || !ultimo) break;
    const prefixo = (primeiro.textContent || "").slice(0, offsetInicio);
    const sufixo = (ultimo.textContent || "").slice(offsetFim);
    const valor = regra.valores ? regra.valores[Math.min(contador + feitas, regra.valores.length - 1)] : regra.valor;
    if (primeiro === ultimo) primeiro.textContent = `${prefixo}${texto(valor)}${sufixo}`;
    else {
      let limpando = false;
      for (const no of nos) {
        if (no === primeiro) { no.textContent = `${prefixo}${texto(valor)}`; limpando = true; continue; }
        if (!limpando) continue;
        if (no === ultimo) { no.textContent = sufixo; break; }
        no.textContent = "";
      }
    }
    feitas += 1;
  }
  return feitas;
}

function preencherXml(xml, regras, contadores) {
  const documento = new DOMParser().parseFromString(xml, "application/xml");
  if (documento.getElementsByTagName("parsererror").length) throw new Error("O modelo Word contém XML inválido.");
  const paragrafos = Array.from(documento.getElementsByTagNameNS(W_NS, "p"));
  regras.forEach((regra, indice) => {
    const chave = `${indice}:${regra.buscar}`;
    paragrafos.forEach((paragrafo) => {
      const total = substituir(paragrafo, regra, contadores[chave] || 0);
      contadores[chave] = (contadores[chave] || 0) + total;
    });
  });
  return new XMLSerializer().serializeToString(documento);
}

export async function gerarTermoDocx(dados, modelo) {
  if (!modelo?.templateDocx) throw new Error("Modelo Word do termo não configurado.");
  const resposta = await fetch(modelo.templateDocx);
  if (!resposta.ok) throw new Error(`Não foi possível carregar o Word oficial (${resposta.status}).`);
  const arquivos = unzipSync(new Uint8Array(await resposta.arrayBuffer()));
  const regras = regrasDoModelo(modelo.modo, dados);
  const contadores = {};
  Object.keys(arquivos).forEach((caminho) => {
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/i.test(caminho)) return;
    arquivos[caminho] = strToU8(preencherXml(strFromU8(arquivos[caminho]), regras, contadores));
  });
  regras.forEach((regra, indice) => {
    if (!contadores[`${indice}:${regra.buscar}`]) throw new Error(`Campo não localizado no Word oficial: ${regra.buscar}`);
  });
  return { bytes: zipSync(arquivos, { level: 6 }), mime: MIME_DOCX };
}
