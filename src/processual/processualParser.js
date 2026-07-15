export const CAMPOS_PROCESSUAIS = [
  "tribunal", "forum_comarca", "vara", "cidade_estado", "cliente_autor",
  "instituicao_reu", "numero_processo", "data_distribuicao", "juiz_responsavel",
  "advogado", "status_atual", "ultima_movimentacao", "proximos_passos", "data_consulta",
];

const TITULOS = [
  ["tribunal", ["tribunal/fórum", "tribunal/forum", "tribunal", "fórum", "forum"]],
  ["cliente_autor", ["cliente (autor)", "cliente/autor", "cliente autor"]],
  ["instituicao_reu", ["instituição financeira (réu)", "instituicao financeira (reu)", "instituição financeira/réu", "instituicao financeira/reu"]],
  ["numero_processo", ["número do processo", "numero do processo"]],
  ["data_distribuicao", ["data de distribuição", "data de distribuicao"]],
  ["juiz_responsavel", ["juiz responsável", "juiz responsavel"]],
  ["advogado", ["advogado", "advogado responsável", "advogado responsavel"]],
  ["status_atual", ["status atual"]],
  ["ultima_movimentacao", ["última movimentação", "ultima movimentacao"]],
  ["proximos_passos", ["próximos passos", "proximos passos"]],
  ["data_consulta", ["data da consulta"]],
];

function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function reconhecerTitulo(linha) {
  const limpa = normalizar(linha).replace(/:.*$/, "").trim();
  return TITULOS.find(([, aliases]) => aliases.some((a) => normalizar(a) === limpa))?.[0] || null;
}

function separarLocal(local) {
  const resultado = { tribunal: local.trim(), forum_comarca: "", vara: "", cidade_estado: "" };
  const partes = local.split(/\s*[–—-]\s*/, 2);
  if (partes.length > 1 && /^[A-Z]{2,8}$/i.test(partes[0].trim())) {
    resultado.tribunal = partes[0].trim();
    const detalhe = partes[1].trim();
    const varaCidade = detalhe.match(/^(.*?\bvara\b.*?)(?:\s+de\s+)([^/]+\/\s*[A-Z]{2})$/i);
    if (varaCidade) {
      resultado.vara = varaCidade[1].trim();
      resultado.cidade_estado = varaCidade[2].trim();
    } else {
      resultado.cidade_estado = detalhe.match(/([^,]+\/\s*[A-Z]{2})\s*$/i)?.[1]?.trim() || "";
      resultado.vara = detalhe.match(/(?:\d+ª?\s+)?vara[^,/]*?(?=,|$)/i)?.[0]?.trim() || "";
      resultado.forum_comarca = detalhe.replace(resultado.vara, "").replace(resultado.cidade_estado, "").replace(/^[,\s-]+|[,\s-]+$/g, "");
    }
  }
  return resultado;
}

export function criarDadosProcessuaisVazios(responsavel = "") {
  return Object.fromEntries([...CAMPOS_PROCESSUAIS, "responsavel", "observacao_cliente", "observacao_interna"].map((c) => [c, c === "responsavel" ? responsavel : ""]));
}

export function organizarResumoProcessual(texto, responsavel = "") {
  const dados = criarDadosProcessuaisVazios(responsavel);
  const linhas = String(texto || "").replace(/\r/g, "").split("\n");
  let campoAtual = null;
  const blocos = {};
  for (const original of linhas) {
    const linha = original.trim();
    if (!linha || normalizar(linha) === "andamento processual") continue;
    const antesDoisPontos = linha.includes(":") ? linha.slice(0, linha.indexOf(":")) : linha;
    const reconhecido = reconhecerTitulo(antesDoisPontos);
    if (reconhecido) {
      campoAtual = reconhecido;
      const valor = linha.includes(":") ? linha.slice(linha.indexOf(":") + 1).trim() : "";
      blocos[campoAtual] = valor;
    } else if (campoAtual) {
      blocos[campoAtual] = [blocos[campoAtual], linha].filter(Boolean).join("\n\n");
    } else if (!dados.tribunal) {
      blocos.tribunal = linha;
      campoAtual = "tribunal";
    }
  }
  Object.assign(dados, blocos);
  if (blocos.tribunal) Object.assign(dados, separarLocal(blocos.tribunal));
  dados.data_consulta = dados.data_consulta.replace(/[.\s]+$/, "");
  return { dados, naoIdentificados: CAMPOS_PROCESSUAIS.filter((campo) => !dados[campo]?.trim()) };
}
