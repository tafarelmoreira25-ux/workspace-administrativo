export const CAMPOS_PROCESSUAIS = [
  "numero_processo", "origem", "segredo_sigilo", "justica_gratuita",
  "data_distribuicao", "nome_cliente", "reu", "advogado_cliente",
  "advogado_reu", "assunto", "status_atual", "data_ultima_movimentacao",
  "descricao_ultima_movimentacao", "data_consulta", "hora_consulta",
  "proximos_passos", "link_anexos_documentos", "representante_responsavel",
  "link_movimentacoes",
];

const CAMPOS_MULTILINHA = new Set([
  "origem", "assunto", "status_atual", "descricao_ultima_movimentacao",
  "proximos_passos",
]);

const TITULOS = [
  ["numero_processo", ["número do processo / protocolo", "número do processo", "numero do processo", "processo", "processo nº", "processo n"]],
  ["origem", ["origem / tribunal / vara", "origem", "tribunal / vara", "tribunal", "foro", "fórum", "forum", "comarca", "vara"]],
  ["segredo_sigilo", ["segredo ou sigilo", "segredo de justiça", "segredo de justica", "sigilo"]],
  ["justica_gratuita", ["justiça gratuita", "justica gratuita", "gratuidade da justiça", "gratuidade da justica"]],
  ["data_distribuicao", ["data da distribuição", "data de distribuição", "data da distribuicao", "data de distribuicao", "distribuído em", "distribuido em"]],
  ["nome_cliente", ["nome do cliente", "cliente", "polo ativo", "autor", "autora", "requerente", "exequente"]],
  ["reu", ["réu / instituição financeira", "reu / instituicao financeira", "instituição financeira", "instituicao financeira", "polo passivo", "réu", "reu", "requerido", "executado"]],
  ["advogado_cliente", ["advogado(a) do cliente", "advogado do cliente", "advogada do cliente", "advogado do autor", "advogada do autor"]],
  ["advogado_reu", ["advogado(a) do réu / instituição financeira", "advogado do réu", "advogado do reu", "advogada do réu", "advogada do reu"]],
  ["assunto", ["assunto / natureza da ação", "assunto / natureza da acao", "assunto", "natureza da ação", "natureza da acao", "classe judicial"]],
  ["status_atual", ["status atual", "situação atual", "situacao atual", "situação do processo", "situacao do processo", "fase atual"]],
  ["data_ultima_movimentacao", ["data da última movimentação", "data da ultima movimentacao", "data do último andamento", "data do ultimo andamento"]],
  ["descricao_ultima_movimentacao", ["descrição da última movimentação", "descricao da ultima movimentacao", "última movimentação", "ultima movimentacao", "último andamento", "ultimo andamento"]],
  ["data_consulta", ["data da última consulta", "data da ultima consulta", "data da consulta", "consulta realizada em"]],
  ["hora_consulta", ["hora da consulta", "horário da consulta", "horario da consulta"]],
  ["proximos_passos", ["próximos passos", "proximos passos", "próxima providência", "proxima providencia", "providências", "providencias"]],
  ["link_anexos_documentos", ["link dos anexos/documentos do processo", "link dos anexos", "link dos documentos", "anexos e documentos do processo"]],
  ["representante_responsavel", ["representante responsável pelo acompanhamento", "representante responsavel pelo acompanhamento", "responsável pelo acompanhamento", "responsavel pelo acompanhamento"]],
  ["link_movimentacoes", ["link para consulta das movimentações", "link para consulta das movimentacoes", "link oficial do processo", "link das movimentações", "link das movimentacoes"]],
];

function normalizar(valor = "") {
  return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
}

function escaparRegex(valor) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TITULOS_ORDENADOS = TITULOS.flatMap(([campo, aliases]) =>
  aliases.map((alias) => ({ campo, alias: normalizar(alias) })),
).sort((a, b) => b.alias.length - a.alias.length);

function reconhecerTitulo(linha) {
  const normalizada = normalizar(linha);
  for (const item of TITULOS_ORDENADOS) {
    if (normalizada === item.alias) return { campo: item.campo, valor: "" };
    const expressao = new RegExp(`^${escaparRegex(item.alias)}\\s*(?::|-)\\s*(.+)$`, "i");
    if (expressao.test(normalizada)) {
      const valor = String(linha).replace(/^.*?(?::|[–—-])\s*/, "").trim();
      return { campo: item.campo, valor };
    }
  }
  return null;
}

function agoraLocal(data = new Date()) {
  const deslocamento = data.getTimezoneOffset() * 60_000;
  const local = new Date(data.getTime() - deslocamento).toISOString();
  return { data: local.slice(0, 10), hora: local.slice(11, 16) };
}

function normalizarData(valor) {
  const informado = String(valor || "").trim();
  const brasileira = informado.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (brasileira) return `${brasileira[3]}-${brasileira[2].padStart(2, "0")}-${brasileira[1].padStart(2, "0")}`;
  return informado.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || informado;
}

function normalizarHora(valor) {
  const encontrada = String(valor || "").match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return encontrada ? `${encontrada[1].padStart(2, "0")}:${encontrada[2]}` : String(valor || "").trim();
}

function primeiroGrupo(texto, expressoes) {
  for (const expressao of expressoes) {
    const encontrada = texto.match(expressao);
    if (encontrada?.[1]?.trim()) return encontrada[1].trim();
  }
  return "";
}

function preencherSeVazio(dados, campo, valor) {
  const limpo = String(valor || "").replace(/^[\s:–—-]+|[\s;]+$/g, "").trim();
  if (!dados[campo] && limpo) dados[campo] = limpo;
}

function inferirSimNao(texto, termos) {
  const trecho = normalizar(texto);
  for (const termo of termos) {
    const indice = trecho.indexOf(normalizar(termo));
    if (indice < 0) continue;
    const contexto = trecho.slice(Math.max(0, indice - 20), indice + 100);
    if (/\b(nao|sem|indeferid[ao]|negad[ao]|publico|nivel 0)\b/.test(contexto)) return "Não";
    if (/\b(sim|com|deferid[ao]|concedid[ao]|sigilos[ao]|segredo)\b/.test(contexto)) return "Sim";
  }
  return "";
}

function normalizarSimNao(valor) {
  const informado = normalizar(valor);
  if (!informado) return "";
  if (/\b(nao|sem|indeferid[ao]|negad[ao]|publico|nivel 0)\b/.test(informado)) return "Não";
  if (/\b(sim|com|deferid[ao]|concedid[ao]|sigilos[ao]|segredo)\b/.test(informado)) return "Sim";
  return String(valor).trim();
}

function linhaMaisProvavel(linhas, expressoes) {
  return linhas.find((linha) => expressoes.some((expressao) => expressao.test(normalizar(linha)))) || "";
}

function obterUltimaMovimentacao(linhas) {
  const candidatas = [];
  linhas.forEach((linha, indice) => {
    const data = linha.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})\b/)?.[1];
    if (!data) return;
    const contexto = `${linha} ${linhas[indice + 1] || ""}`.trim();
    if (!/(movimenta|andamento|evento|despacho|decis|senten|peti|juntad|publica|intima|conclus)/i.test(normalizar(contexto))) return;
    candidatas.push({
      data: normalizarData(data),
      descricao: contexto.replace(data, "").replace(/^[\s:–—-]+/, "").trim(),
    });
  });
  return candidatas.sort((a, b) => b.data.localeCompare(a.data))[0] || null;
}

export function criarDadosProcessuaisVazios(responsavel = "", dataAtual = new Date()) {
  const atual = agoraLocal(dataAtual);
  return {
    ...Object.fromEntries(CAMPOS_PROCESSUAIS.map((campo) => [campo, ""])),
    data_consulta: atual.data,
    hora_consulta: atual.hora,
    representante_responsavel: responsavel,
  };
}

export function organizarResumoProcessual(texto, responsavel = "", dataAtual = new Date()) {
  const fonte = String(texto || "").replace(/\r/g, "").trim();
  const linhas = fonte.split("\n").map((linha) => linha.trim()).filter(Boolean);
  const dados = criarDadosProcessuaisVazios(responsavel, dataAtual);
  const blocos = {};
  let campoAtual = null;

  for (const linha of linhas) {
    const reconhecido = reconhecerTitulo(linha);
    if (reconhecido) {
      campoAtual = reconhecido.campo;
      if (reconhecido.valor) blocos[campoAtual] = reconhecido.valor;
      else if (!(campoAtual in blocos)) blocos[campoAtual] = "";
      continue;
    }
    if (!campoAtual) continue;
    const separador = CAMPOS_MULTILINHA.has(campoAtual) ? "\n" : " ";
    blocos[campoAtual] = [blocos[campoAtual], linha].filter(Boolean).join(separador);
  }

  Object.entries(blocos).forEach(([campo, valor]) => preencherSeVazio(dados, campo, valor));
  preencherSeVazio(dados, "numero_processo", primeiroGrupo(fonte, [
    /\b(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})\b/,
    /(?:processo|protocolo)\s*(?:n[º°o.]*)?\s*[:-]?\s*([A-Z0-9./-]{6,})/i,
  ]));
  preencherSeVazio(dados, "nome_cliente", primeiroGrupo(fonte, [/(?:polo ativo|autor(?:a)?|requerente|exequente|nome do cliente)\s*[:-]\s*([^\n]+)/i]));
  preencherSeVazio(dados, "reu", primeiroGrupo(fonte, [/(?:polo passivo|r[eé]u|requerido|executado|institui[cç][aã]o financeira)\s*[:-]\s*([^\n]+)/i]));
  preencherSeVazio(dados, "advogado_cliente", primeiroGrupo(fonte, [/advogad[oa](?:\(a\))?\s+(?:do cliente|do autor|da autora)\s*[:-]\s*([^\n]+)/i]));
  preencherSeVazio(dados, "advogado_reu", primeiroGrupo(fonte, [/advogad[oa](?:\(a\))?\s+(?:do r[eé]u|da institui[cç][aã]o)\s*[:-]\s*([^\n]+)/i]));
  preencherSeVazio(dados, "assunto", primeiroGrupo(fonte, [/(?:assunto|natureza da a[cç][aã]o|classe judicial)\s*[:-]\s*([^\n]+)/i]));
  preencherSeVazio(dados, "status_atual", primeiroGrupo(fonte, [/(?:status|situa[cç][aã]o|fase)\s*(?:atual|do processo)?\s*[:-]\s*([^\n]+)/i]));

  if (!dados.origem) {
    preencherSeVazio(dados, "origem", linhaMaisProvavel(linhas, [
      /\b(?:tj|trf|trt|stj|stf)[a-z0-9-]*\b/i,
      /\b(?:tribunal|vara|foro|forum|comarca)\b/i,
    ]));
  }
  if (!dados.segredo_sigilo) dados.segredo_sigilo = inferirSimNao(fonte, ["segredo de justiça", "segredo ou sigilo", "sigilo"]);
  if (!dados.justica_gratuita) dados.justica_gratuita = inferirSimNao(fonte, ["justiça gratuita", "gratuidade da justiça"]);
  dados.segredo_sigilo = normalizarSimNao(dados.segredo_sigilo);
  dados.justica_gratuita = normalizarSimNao(dados.justica_gratuita);
  if (!dados.data_distribuicao) {
    preencherSeVazio(dados, "data_distribuicao", primeiroGrupo(fonte, [/(?:distribui[cç][aã]o|distribu[ií]do em|autua[cç][aã]o)\s*[:-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})/i]));
  }

  const ultima = obterUltimaMovimentacao(linhas);
  if (ultima) {
    preencherSeVazio(dados, "data_ultima_movimentacao", ultima.data);
    preencherSeVazio(dados, "descricao_ultima_movimentacao", ultima.descricao);
  }
  const urls = fonte.match(/https?:\/\/[^\s<>()]+/gi) || [];
  preencherSeVazio(dados, "link_movimentacoes", urls.find((url) => /(?:consulta|process|pje|esaj|projudi|eproc)/i.test(url)) || urls[0]);
  preencherSeVazio(dados, "link_anexos_documentos", urls.find((url) => /(?:drive|document|anexo|arquivo)/i.test(url)));

  dados.data_distribuicao = normalizarData(dados.data_distribuicao);
  dados.data_ultima_movimentacao = normalizarData(dados.data_ultima_movimentacao);
  dados.data_consulta = normalizarData(dados.data_consulta) || agoraLocal(dataAtual).data;
  dados.hora_consulta = normalizarHora(dados.hora_consulta) || agoraLocal(dataAtual).hora;

  const naoIdentificados = CAMPOS_PROCESSUAIS.filter((campo) => !String(dados[campo] || "").trim());
  return {
    dados,
    naoIdentificados,
    identificados: CAMPOS_PROCESSUAIS.length - naoIdentificados.length,
  };
}
