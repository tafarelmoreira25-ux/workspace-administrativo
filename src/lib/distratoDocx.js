import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function dataPorExtenso(valor) {
  if (!valor) return "";
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return String(valor);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(ano, mes - 1, dia)));
}

function dataCurta(valor) {
  if (!valor) return "";
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-");
  return [dia, mes, ano].filter(Boolean).join("/");
}

function semPrefixoReal(valor) {
  return String(valor || "").trim().replace(/^R\$\s*/i, "");
}

function texto(valor) {
  return String(valor ?? "").trim();
}

function regrasComuns(dados) {
  return [
    { buscar: "[Data]", valor: dataPorExtenso(dados.dataEmissao), parte: /^word\/header/i },
    { buscar: "Nome do contratante", valor: texto(dados.nomeContratante), parte: /^word\/document\.xml$/i },
    { buscar: "NOME DO CONTRATANTE", valor: texto(dados.nomeContratante).toUpperCase(), parte: /^word\/document\.xml$/i },
    { buscar: "XXX.XXX.XXX-XX", valor: texto(dados.cpfContratante), parte: /^word\/document\.xml$/i },
    { buscar: "Rua – Estado/UF - CEP", valor: texto(dados.enderecoContratante), parte: /^word\/document\.xml$/i },
    { buscar: "Dia de mês de 2026", valor: dataPorExtenso(dados.dataContrato), parte: /^word\/document\.xml$/i },
    { buscar: "R$ x.xxx,xx", valores: [semPrefixoReal(dados.valorContrato), semPrefixoReal(dados.valorParcela)], parte: /^word\/document\.xml$/i },
    { buscar: "(Valor por extenso)", valores: [`(${texto(dados.valorContratoExtenso)})`, `(${texto(dados.valorParcelaExtenso)})`], parte: /^word\/document\.xml$/i },
    { buscar: "X (Numero por extenso)", valor: `${texto(dados.quantidadeParcelas)} (${texto(dados.quantidadeParcelasExtenso)})`, parte: /^word\/document\.xml$/i },
    { buscar: "[Nome Completo do Cliente]", valor: texto(dados.nomeContratante), parte: /^word\/document\.xml$/i },
    { buscar: "[CPF do Cliente]", valor: texto(dados.cpfContratante), parte: /^word\/document\.xml$/i },
  ];
}

function regrasEspecificas(modo, dados) {
  const regras = {
    "distrato-com-multa": [
      { buscar: "[Valor pago]", valor: semPrefixoReal(dados.valorPago) },
      { buscar: "[Valor dos serviços prestados]", valor: semPrefixoReal(dados.valorServicosPrestados) },
      { buscar: "[Saldo a restituir]", valor: semPrefixoReal(dados.saldoRestituir) },
      { buscar: "[Data]", valor: dataCurta(dados.dataRestituicao), parte: /^word\/document\.xml$/i },
      { buscar: "[Forma de restituição]", valor: texto(dados.formaRestituicao) },
      { buscar: "[Valor da multa]", valor: semPrefixoReal(dados.valorMulta) },
      { buscar: "([Valor por extenso])", valores: [`(${texto(dados.valorPagoExtenso)})`, `(${texto(dados.valorMultaExtenso)})`] },
    ],
    "distrato-sem-multa": [
      { buscar: "[Valor]", valor: semPrefixoReal(dados.valorQuitacao) },
      { buscar: "([Valor por extenso])", valor: `(${texto(dados.valorQuitacaoExtenso)})` },
    ],
    "distrato-7-dias-estorno-total": [
      { buscar: "[Data da desistência ]", valor: dataCurta(dados.dataDesistencia) },
      { buscar: "[Data da assinatura ou recebimento do serviço]", valor: dataCurta(dados.dataAssinaturaOuRecebimento) },
      { buscar: "[Canal de contratação]", valor: texto(dados.canalContratacao) },
      { buscar: "[Valor total pago]", valor: semPrefixoReal(dados.valorTotalPago) },
      { buscar: "([Valor por extenso])", valor: `(${texto(dados.valorTotalPagoExtenso)})` },
      { buscar: "[Meio acordado]", valor: texto(dados.meioAcordadoRestituicao) },
      { buscar: "[Titular e dados de restituição]", valor: texto(dados.titularDadosRestituicao) },
    ],
    "distrato-com-devolucao": [
      { buscar: "[Valor da devolução]", valor: semPrefixoReal(dados.valorDevolucao) },
      { buscar: "([Valor por extenso])", valor: `(${texto(dados.valorDevolucaoExtenso)})` },
      { buscar: "[Data da devolução]", valor: dataCurta(dados.dataDevolucao) },
      { buscar: "[PIX, transferência ou estorno]", valor: texto(dados.formaDevolucao) },
      { buscar: "[Nome e CPF do titular]", valor: `${texto(dados.nomeBeneficiarioRestituicao)}, CPF nº ${texto(dados.cpfBeneficiarioRestituicao)}` },
      { buscar: "[Chave PIX ou dados bancários]", valor: texto(dados.dadosBancariosRestituicao) },
    ],
    "distrato-sem-devolucao": [
      { buscar: "[Valor pago]", valor: semPrefixoReal(dados.valorPago) },
      { buscar: "([Valor por extenso])", valor: `(${texto(dados.valorPagoExtenso)})` },
      { buscar: "[Identificação da prestação de contas]", valor: texto(dados.identificacaoPrestacaoContas) },
      { buscar: "[Descrição e valor]", valor: texto(dados.descricaoValoresServicos) },
    ],
    "distrato-inexecucao-ausencia-resposta": [
      { buscar: "[Valor pago]", valor: semPrefixoReal(dados.valorPago) },
      { buscar: "([Valor por extenso])", valor: `(${texto(dados.valorPagoExtenso)})` },
    ],
  };
  return (regras[modo] || []).map((regra) => ({ ...regra, parte: regra.parte || /^word\/document\.xml$/i }));
}

function substituirEmParagrafo(paragrafo, regra, indiceValor) {
  const nos = Array.from(paragrafo.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "t"));
  if (!nos.length) return 0;
  let substituicoes = 0;
  while (true) {
    const completo = nos.map((no) => no.textContent || "").join("");
    const inicio = completo.indexOf(regra.buscar);
    if (inicio < 0) break;
    const fim = inicio + regra.buscar.length;
    let cursor = 0;
    let noInicial = null;
    let noFinal = null;
    let offsetInicial = 0;
    let offsetFinal = 0;
    for (const no of nos) {
      const tamanho = (no.textContent || "").length;
      if (!noInicial && inicio >= cursor && inicio < cursor + tamanho) { noInicial = no; offsetInicial = inicio - cursor; }
      if (!noFinal && fim > cursor && fim <= cursor + tamanho) { noFinal = no; offsetFinal = fim - cursor; break; }
      cursor += tamanho;
    }
    if (!noInicial || !noFinal) break;
    const valores = regra.valores || [regra.valor];
    const novoValor = texto(valores[Math.min(indiceValor + substituicoes, valores.length - 1)]);
    const prefixo = (noInicial.textContent || "").slice(0, offsetInicial);
    const sufixo = (noFinal.textContent || "").slice(offsetFinal);
    if (noInicial === noFinal) noInicial.textContent = `${prefixo}${novoValor}${sufixo}`;
    else {
      let limpando = false;
      for (const no of nos) {
        if (no === noInicial) { no.textContent = `${prefixo}${novoValor}`; limpando = true; continue; }
        if (!limpando) continue;
        if (no === noFinal) { no.textContent = sufixo; break; }
        no.textContent = "";
      }
    }
    substituicoes += 1;
  }
  return substituicoes;
}

function preencherParteXml(xml, caminho, regras, contadores) {
  const documento = new DOMParser().parseFromString(xml, "application/xml");
  if (documento.getElementsByTagName("parsererror").length) throw new Error(`O modelo Word contém XML inválido em ${caminho}.`);
  const paragrafos = Array.from(documento.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "p"));
  regras.forEach((regra, indice) => {
    if (regra.parte && !regra.parte.test(caminho)) return;
    const chave = `${indice}:${regra.buscar}`;
    paragrafos.forEach((paragrafo) => {
      const total = substituirEmParagrafo(paragrafo, regra, contadores[chave] || 0);
      contadores[chave] = (contadores[chave] || 0) + total;
    });
  });
  return new XMLSerializer().serializeToString(documento);
}

function validarPreenchimento(arquivos) {
  const pendencias = new Set();
  Object.entries(arquivos).forEach(([caminho, bytes]) => {
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/i.test(caminho)) return;
    const xml = strFromU8(bytes);
    const documento = new DOMParser().parseFromString(xml, "application/xml");
    const textos = Array.from(documento.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "t")).map((no) => no.textContent || "").join("");
    (textos.match(/\[[^\]]+\]/g) || []).forEach((token) => pendencias.add(token));
    if (/Nome do contratante|NOME DO CONTRATANTE|XXX\.XXX\.XXX-XX|x\.xxx,xx|Dia de mês de 2026/.test(textos)) pendencias.add("campos de exemplo do Word");
  });
  if (pendencias.size) throw new Error(`O modelo ainda contém campos não preenchidos: ${Array.from(pendencias).join(", ")}.`);
}

export async function gerarDistratoDocx(dados, modelo) {
  if (!modelo?.templateDocx) throw new Error("Modelo Word do distrato não configurado.");
  const resposta = await fetch(modelo.templateDocx);
  if (!resposta.ok) throw new Error(`Não foi possível carregar o Word oficial (${resposta.status}).`);
  const arquivos = unzipSync(new Uint8Array(await resposta.arrayBuffer()));
  const regras = [...regrasComuns(dados), ...regrasEspecificas(modelo.modo, dados)];
  const contadores = {};
  Object.keys(arquivos).forEach((caminho) => {
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/i.test(caminho)) return;
    arquivos[caminho] = strToU8(preencherParteXml(strFromU8(arquivos[caminho]), caminho, regras, contadores));
  });
  validarPreenchimento(arquivos);
  return { bytes: zipSync(arquivos, { level: 6 }), mime: MIME_DOCX };
}
