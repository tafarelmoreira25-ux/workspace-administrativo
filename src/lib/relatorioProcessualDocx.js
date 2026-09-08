const TEMPLATE_URL = "/modelos/relatorio-atualizacao-processual.docx";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PLACEHOLDER_FIELDS = [
  "data_emissao",
  "hora_emissao",
  "codigo_validacao",
  "numero_processo",
  "data_distribuicao",
  "origem",
  "segredo_justica",
  "assunto",
  "justica_gratuita",
  "autor_nome",
  "autor_advogado",
  "reu_nome",
  "reu_advogado",
  "status_label",
  "data_consulta",
  "hora_consulta",
  "status_descricao",
  "prazo_atual",
  "responsavel_providencia",
  "data_ultima_movimentacao",
  "ultima_movimentacao",
  "proximos_passos",
  "anexos_resumo",
];

function dataBrasil(valor) {
  if (!valor) return "não informado";
  const data = valor instanceof Date ? valor : new Date(String(valor).includes("T") ? valor : `${valor}T12:00:00`);
  if (Number.isNaN(data.getTime())) return String(valor);
  return new Intl.DateTimeFormat("pt-BR").format(data);
}

function horaBrasil(valor) {
  const data = valor ? new Date(valor) : new Date();
  if (Number.isNaN(data.getTime())) return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(data);
}

function texto(valor, fallback = "não informado") {
  const limpo = String(valor ?? "").trim();
  return limpo || fallback;
}

function montarOrigem(dados = {}) {
  return [dados.tribunal || dados.origemTribunal, dados.comarca, dados.vara].filter(Boolean).join(" / ") || dados.origem || "não informado";
}

export function montarCamposRelatorioProcessual(dados = {}) {
  const agora = new Date();
  const processo = dados.contextoDocumento?.processo || {};
  const cliente = dados.contextoDocumento?.cliente || {};
  const ultimaMovimentacao = dados.ultimaMovimentacao || processo.ultima_movimentacao;
  const dataUltimaMovimentacao = dados.dataUltimaMovimentacao || processo.ultima_movimentacao_data;
  const responsavel = dados.responsavelProvidencia || dados.responsavel || processo.responsavel || dados.responsavelDocumento;

  return {
    data_emissao: dataBrasil(dados.dataEmissao || agora),
    hora_emissao: horaBrasil(agora),
    codigo_validacao: texto(dados.codigoValidacao || dados.numeroDocumento || dados.codigo_validacao, "sem referência"),
    numero_processo: texto(dados.numeroProcesso || processo.numero_processo),
    data_distribuicao: dataBrasil(dados.dataDistribuicao || processo.data_distribuicao),
    origem: texto(montarOrigem({ ...processo, ...dados })),
    segredo_justica: texto(dados.segredoJustica || dados.segredo_justica || processo.segredo_justica, "Não informado"),
    assunto: texto(dados.assunto || dados.tipoAcao || processo.tipo_acao || processo.produto || "Ação revisional / demanda bancária"),
    justica_gratuita: texto(dados.justicaGratuita || processo.justica_gratuita, "Não analisada"),
    autor_nome: texto(dados.autorNome || dados.nomeCliente || processo.autor || cliente.nome_completo || processo.nome_cliente),
    autor_advogado: texto(dados.autorAdvogado || dados.advogadoAutor || processo.autor_advogado, "não informado"),
    reu_nome: texto(dados.reuNome || dados.banco || processo.reu || processo.banco_reu),
    reu_advogado: texto(dados.reuAdvogado || dados.advogadoReu || processo.reu_advogado, "não informado"),
    status_label: texto(dados.statusLabel || processo.situacao || processo.status_judicial || processo.fase_judicial || processo.fase_atual, "Em acompanhamento"),
    data_consulta: dataBrasil(dados.dataConsulta || agora),
    hora_consulta: horaBrasil(dados.dataConsulta || agora),
    status_descricao: texto(dados.statusDescricao || dados.observacaoInterna || processo.observacoes, "Processo em acompanhamento pela equipe responsável."),
    prazo_atual: texto(dados.prazoAtual || processo.proximo_prazo || processo.emenda_status || processo.custas_status, "sem prazo imediato registrado"),
    responsavel_providencia: texto(responsavel),
    data_ultima_movimentacao: dataBrasil(dataUltimaMovimentacao),
    ultima_movimentacao: texto(ultimaMovimentacao, "nenhuma movimentação relevante registrada no sistema"),
    proximos_passos: texto(dados.proximosPassos || dados.proximaProvidencia || processo.proxima_revisao || "manter acompanhamento periódico e atualizar o cliente quando houver nova movimentação relevante"),
    anexos_resumo: texto(dados.anexosResumo || dados.anexos || "documentos arquivados na pasta do cliente no Drive", "documentos arquivados na pasta do cliente no Drive"),
  };
}

function bytesDeBase64(base64) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function lerDimensoesPng(bytes) {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  return { largura: readBe32(bytes, 16), altura: readBe32(bytes, 20) };
}

function lerDimensoesJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let cursor = 2;
  while (cursor < bytes.length) {
    if (bytes[cursor] !== 0xff) return null;
    const marcador = bytes[cursor + 1];
    const tamanho = (bytes[cursor + 2] << 8) + bytes[cursor + 3];
    if (marcador >= 0xc0 && marcador <= 0xc3) return { largura: (bytes[cursor + 7] << 8) + bytes[cursor + 8], altura: (bytes[cursor + 5] << 8) + bytes[cursor + 6] };
    cursor += 2 + tamanho;
  }
  return null;
}

function obterCapturaProcesso(dados = {}) {
  const captura = dados.capturaProcesso;
  const dataUrl = typeof captura === "string" ? captura : captura?.dataUrl;
  const tipoDeclarado = typeof captura === "object" ? captura?.tipo : "";
  if (!dataUrl || !String(dataUrl).startsWith("data:image/")) return null;
  const [cabecalho, conteudo] = dataUrl.split(",");
  if (!conteudo) return null;
  const mime = cabecalho.match(/^data:([^;]+);base64$/)?.[1] || tipoDeclarado || "image/png";
  const extensao = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
  const bytes = bytesDeBase64(conteudo);
  const dimensoes = extensao === "jpg" ? lerDimensoesJpeg(bytes) : lerDimensoesPng(bytes);
  if (!dimensoes?.largura || !dimensoes?.altura) return null;
  return { bytes, mime: extensao === "jpg" ? "image/jpeg" : "image/png", extensao, ...dimensoes };
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function u16(valor) { return [valor & 255, (valor >>> 8) & 255]; }
function u32(valor) { return [valor & 255, (valor >>> 8) & 255, (valor >>> 16) & 255, (valor >>> 24) & 255]; }
function textBytes(textoValor) { return new TextEncoder().encode(textoValor); }
function decode(bytes) { return new TextDecoder().decode(bytes); }
function readU16(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8); }
function readU32(bytes, offset) { return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0; }
function readBe32(bytes, offset) { return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0; }

function findEocd(bytes) {
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
  }
  throw new Error("Não foi possível ler o template DOCX.");
}

function parseZip(bytes) {
  const eocd = findEocd(bytes);
  const total = readU16(bytes, eocd + 10);
  const centralOffset = readU32(bytes, eocd + 16);
  const entries = [];
  let cursor = centralOffset;

  for (let i = 0; i < total; i += 1) {
    if (readU32(bytes, cursor) !== 0x02014b50) throw new Error("Estrutura ZIP inválida no template DOCX.");
    const method = readU16(bytes, cursor + 10);
    const modTime = readU16(bytes, cursor + 12);
    const modDate = readU16(bytes, cursor + 14);
    const crc = readU32(bytes, cursor + 16);
    const compressedSize = readU32(bytes, cursor + 20);
    const uncompressedSize = readU32(bytes, cursor + 24);
    const fileNameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const externalAttrs = readU32(bytes, cursor + 38);
    const localOffset = readU32(bytes, cursor + 42);
    const nameBytes = bytes.slice(cursor + 46, cursor + 46 + fileNameLength);
    const name = decode(nameBytes);
    const localNameLength = readU16(bytes, localOffset + 26);
    const localExtraLength = readU16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    entries.push({ name, nameBytes, method, modTime, modDate, crc, compressedSize, uncompressedSize, externalAttrs, data });
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function transformarDeflate(bytes, tipo) {
  const formato = "deflate-raw";
  const stream = tipo === "compactar" ? new CompressionStream(formato) : new DecompressionStream(formato);
  const writer = stream.writable.getWriter();
  const output = new Response(stream.readable).arrayBuffer();
  await writer.write(bytes);
  await writer.close();
  return new Uint8Array(await output);
}

async function lerEntradaXml(entry) {
  if (entry.method === 0) return decode(entry.data);
  if (entry.method === 8) return decode(await transformarDeflate(entry.data, "descompactar"));
  throw new Error(`Método de compressão não suportado no DOCX: ${entry.method}`);
}

async function atualizarEntradaXml(entry, xml) {
  const bytes = textBytes(xml);
  if (entry.method === 8) {
    const compactado = await transformarDeflate(bytes, "compactar");
    return { ...entry, data: compactado, crc: crc32(bytes), compressedSize: compactado.length, uncompressedSize: bytes.length };
  }
  return { ...entry, method: 0, data: bytes, crc: crc32(bytes), compressedSize: bytes.length, uncompressedSize: bytes.length };
}

function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = entry.nameBytes || textBytes(entry.name);
    const data = entry.data;
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(entry.method), ...u16(entry.modTime), ...u16(entry.modDate),
      ...u32(entry.crc), ...u32(entry.compressedSize), ...u32(entry.uncompressedSize), ...u16(nameBytes.length), ...u16(0),
    ]);
    chunks.push(local, nameBytes, data);
    central.push({ ...entry, nameBytes, offset });
    offset += local.length + nameBytes.length + data.length;
  }

  const centralOffset = offset;
  for (const entry of central) {
    const header = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(entry.method), ...u16(entry.modTime), ...u16(entry.modDate),
      ...u32(entry.crc), ...u32(entry.compressedSize), ...u32(entry.uncompressedSize), ...u16(entry.nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(entry.externalAttrs || 0), ...u32(entry.offset),
    ]);
    chunks.push(header, entry.nameBytes);
    offset += header.length + entry.nameBytes.length;
  }

  const centralSize = offset - centralOffset;
  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(centralSize), ...u32(centralOffset), ...u16(0),
  ]);
  chunks.push(eocd);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let cursor = 0;
  chunks.forEach((chunk) => { output.set(chunk, cursor); cursor += chunk.length; });
  return output;
}

function escaparXml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function substituirCamposXml(xml, campos) {
  let atualizado = xml;
  for (const campo of PLACEHOLDER_FIELDS) atualizado = atualizado.split(`{{${campo}}}`).join(escaparXml(campos[campo]));
  return atualizado;
}

function calcularTamanhoImagem(captura) {
  const emuPorPixel = 9525;
  const maxLargura = Math.round(5.95 * 914400);
  const maxAltura = Math.round(2.15 * 914400);
  const larguraOriginal = captura.largura * emuPorPixel;
  const alturaOriginal = captura.altura * emuPorPixel;
  const proporcao = Math.min(maxLargura / larguraOriginal, maxAltura / alturaOriginal, 1);
  return {
    largura: Math.round(larguraOriginal * proporcao),
    altura: Math.round(alturaOriginal * proporcao),
  };
}

function criarBlocoCaptura(rId, captura) {
  const { largura, altura } = calcularTamanhoImagem(captura);
  return `<w:p><w:pPr><w:spacing w:before="70" w:after="30" w:line="240" w:lineRule="auto"/><w:keepNext/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:color w:val="173D77"/><w:sz w:val="14"/></w:rPr><w:t>CAPTURA DE TELA DO PROCESSO</w:t></w:r></w:p><w:p><w:pPr><w:spacing w:before="0" w:after="50" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${largura}" cy="${altura}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="92701" name="Captura de tela do processo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="92702" name="captura-processo.${captura.extensao}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${largura}" cy="${altura}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function inserirCapturaNoDocumento(xml, rId, captura) {
  if (!captura) return xml;
  const ancora = "ABRIR CONSULTA PROCESSUAL";
  const indiceAncora = xml.indexOf(ancora);
  if (indiceAncora < 0) return xml.replace("</w:body>", `${criarBlocoCaptura(rId, captura)}</w:body>`);
  const fimTabela = xml.indexOf("</w:tbl>", indiceAncora);
  if (fimTabela < 0) return xml;
  const pontoInsercao = fimTabela + "</w:tbl>".length;
  return `${xml.slice(0, pontoInsercao)}${criarBlocoCaptura(rId, captura)}${xml.slice(pontoInsercao)}`;
}

function atualizarRelConsulta(relsXml, link) {
  if (!link) return relsXml;
  return relsXml.replace(/(<Relationship[^>]+Id="rId9"[^>]+Target=")[^"]+("[^>]*>)/, `$1${escaparXml(link)}$2`);
}

function proximoRelationshipId(relsXml) {
  const numeros = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  return `rId${Math.max(0, ...numeros) + 1}`;
}

function adicionarRelCaptura(relsXml, rId, nomeArquivo) {
  if (!rId) return relsXml;
  const rel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${nomeArquivo}"/>`;
  return relsXml.replace("</Relationships>", `${rel}</Relationships>`);
}

function atualizarContentTypes(xml, captura) {
  if (!captura) return xml;
  const extensao = captura.extensao === "jpg" ? "jpeg" : "png";
  const tipo = captura.extensao === "jpg" ? "image/jpeg" : "image/png";
  if (xml.includes(`Extension="${extensao}"`) || xml.includes(`Extension="${captura.extensao}"`)) return xml;
  return xml.replace("</Types>", `<Default Extension="${extensao}" ContentType="${tipo}"/></Types>`);
}

function criarEntradaArquivo(name, bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return {
    name,
    nameBytes: textBytes(name),
    method: 0,
    modTime: 0,
    modDate: 0,
    crc: crc32(data),
    compressedSize: data.length,
    uncompressedSize: data.length,
    externalAttrs: 0,
    data,
  };
}

async function carregarTemplate() {
  const resposta = await fetch(TEMPLATE_URL);
  if (!resposta.ok) throw new Error("Não foi possível carregar o modelo DOCX do relatório processual.");
  return new Uint8Array(await resposta.arrayBuffer());
}

export async function gerarRelatorioAtualizacaoProcessualDocx(dados = {}) {
  const template = await carregarTemplate();
  const campos = montarCamposRelatorioProcessual(dados);
  const captura = obterCapturaProcesso(dados);
  const entradasOriginais = parseZip(template);
  const relsEntry = entradasOriginais.find((entry) => entry.name === "word/_rels/document.xml.rels");
  const relsXmlOriginal = relsEntry ? await lerEntradaXml(relsEntry) : "";
  const capturaRId = captura ? proximoRelationshipId(relsXmlOriginal) : "";
  const capturaNomeArquivo = captura ? `captura-processo.${captura.extensao}` : "";
  const entries = await Promise.all(entradasOriginais.map(async (entry) => {
    if (entry.name !== "word/document.xml" && entry.name !== "word/_rels/document.xml.rels" && entry.name !== "[Content_Types].xml") return entry;
    const originalXml = await lerEntradaXml(entry);
    const xml = entry.name === "word/document.xml"
      ? inserirCapturaNoDocumento(substituirCamposXml(originalXml, campos), capturaRId, captura)
      : entry.name === "word/_rels/document.xml.rels"
        ? adicionarRelCaptura(atualizarRelConsulta(originalXml, dados.linkConsulta || dados.linkProcesso || dados.contextoDocumento?.processo?.link_consulta || dados.contextoDocumento?.processo?.link_processo), capturaRId, capturaNomeArquivo)
        : atualizarContentTypes(originalXml, captura);
    return atualizarEntradaXml(entry, xml);
  }));
  if (captura) entries.push(criarEntradaArquivo(`word/media/${capturaNomeArquivo}`, captura.bytes));
  return buildZip(entries);
}

export { DOCX_MIME };
