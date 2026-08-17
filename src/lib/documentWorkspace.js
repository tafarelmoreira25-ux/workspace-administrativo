export const DOCUMENT_WORKSPACE_SCHEMA = 2;
export const DOCUMENT_DRAFT_KEY = "platino.documentos.rascunho.v2";
export const DOCUMENT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const DOCUMENT_HISTORY_KEY = "platino.documentos.historico.v2";
export const DOCUMENT_FAVORITES_KEY = "platino.documentos.favoritos.v2";
export const DOCUMENT_RECENT_MODELS_KEY = "platino.documentos.modelos-recentes.v2";

export function rascunhoValido(registro, agora = Date.now()) {
  const salvoEm = new Date(registro?.salvoEm || "").getTime();
  return Boolean(
    registro?.schema === DOCUMENT_WORKSPACE_SCHEMA &&
    registro?.dados?.modeloId &&
    Number.isFinite(salvoEm) &&
    agora - salvoEm >= 0 &&
    agora - salvoEm < DOCUMENT_DRAFT_TTL_MS
  );
}

export function enderecoCompletoComCep(dados = {}) {
  const endereco = String(dados.endereco || "").trim().replace(/[.\s]+$/, "");
  const cep = String(dados.cep || "").trim();
  if (!endereco || !cep) return endereco;

  const cepNumerico = cep.replace(/\D/g, "");
  const enderecoNumerico = endereco.replace(/\D/g, "");
  if (/\bcep\b/i.test(endereco) || (cepNumerico && enderecoNumerico.includes(cepNumerico))) {
    return endereco;
  }
  return `${endereco} - CEP: ${cep}`;
}

export const DOCUMENT_CATEGORIES = [
  { id: "todos", nome: "Todos", icone: "library" },
  { id: "mais-utilizados", nome: "Mais utilizados", icone: "trend" },
  { id: "recentes", nome: "Recentes", icone: "clock" },
  { id: "favoritos", nome: "Favoritos", icone: "star" },
  { id: "procuracoes", nome: "Procurações", icone: "signature" },
  { id: "declaracoes", nome: "Declarações", icone: "statement" },
  { id: "notificacoes", nome: "Notificações", icone: "send" },
  { id: "termos", nome: "Termos", icone: "shield" },
  { id: "contestacoes", nome: "Contestações", icone: "scale" },
  { id: "relatorios", nome: "Relatórios", icone: "report" },
  { id: "recibos-certidoes", nome: "Recibos e certidões", icone: "report" },
];

const CATEGORY_LABELS = {
  procuracoes: "Procurações",
  declaracoes: "Declarações",
  notificacoes: "Notificações e intimações",
  contestacoes: "Contestações",
  termos: "Termos",
  relatorios: "Relatórios, certidões e recibos",
  "recibos-certidoes": "Relatórios, certidões e recibos",
};

const MODEL_META = {
  procuracao: {
    nome: "Procuração para Ação Revisional",
    categoria: "procuracoes",
    descricao: "Autoriza a representação do cliente nas medidas judiciais relacionadas à revisão contratual.",
    minutos: 4,
    selo: "Mais utilizado",
    popular: true,
    recomendado: true,
  },
  "declaracao-hipossuficiencia": {
    nome: "Declaração de Hipossuficiência",
    categoria: "declaracoes",
    descricao: "Formaliza a condição econômica do cliente para o pedido de justiça gratuita.",
    minutos: 3,
    selo: "Recomendado",
    popular: true,
    recomendado: true,
  },
  "declaracao-isencao-irpf": {
    nome: "Declaração de Isenção de Imposto de Renda",
    categoria: "declaracoes",
    descricao: "Declara a isenção de apresentação da DIRPF nos exercícios informados.",
    minutos: 3,
  },
  "declaracao-ausencia-carteira-trabalho": {
    nome: "Declaração de Ausência de Carteira de Trabalho",
    categoria: "declaracoes",
    descricao: "Declara que o cliente não possui Carteira de Trabalho física ou digital.",
    minutos: 3,
    selo: "Novo",
    novo: true,
  },
  "notificacao-extrajudicial": {
    nome: "Notificação Extrajudicial",
    categoria: "notificacoes",
    descricao: "Comunica formalmente a representação e solicita a revisão das condições contratuais.",
    minutos: 5,
    popular: true,
  },
  "intimacao-extrajudicial": {
    nome: "Intimação Extrajudicial",
    categoria: "notificacoes",
    descricao: "Intima a instituição financeira para revisão e cumprimento das condições indicadas.",
    minutos: 5,
  },
  "citacao-judicial": {
    nome: "Citação da Parte Ré",
    categoria: "notificacoes",
    descricao: "Prepara a petição para requerer nova citação da parte ré no processo judicial.",
    minutos: 3,
  },
  chargeback: {
    nome: "Contestação de Chargeback",
    categoria: "contestacoes",
    descricao: "Formaliza a defesa contra pedido de estorno de pagamento realizado pelo cliente.",
    minutos: 4,
    selo: "Mais utilizado",
    popular: true,
  },
  "contestacao-taxas-email": {
    nome: "Contestação de Taxas por E-mail",
    categoria: "contestacoes",
    descricao: "Contesta encargos e tarifas cobrados pela instituição financeira no contrato.",
    minutos: 5,
  },
  "termo-compromisso-pagamento": {
    nome: "Termo de Compromisso de Pagamento",
    categoria: "termos",
    descricao: "Registra o compromisso do cliente com os custos relacionados ao procedimento.",
    minutos: 3,
  },
  "termo-ciencia-pagamento": {
    nome: "Termo de Ciência de Pagamento",
    categoria: "termos",
    descricao: "Formaliza a ciência sobre o pagamento parcelado dos custos do procedimento.",
    minutos: 3,
  },
  "termo-ciencia-seguranca": {
    nome: "Termo de Ciência, Autorização e Confirmação de Segurança",
    categoria: "termos",
    descricao: "Autoriza o procedimento administrativo e registra as orientações de segurança.",
    minutos: 4,
    recomendado: true,
  },
  "termo-recompra": {
    nome: "Termo de Recompra ou Repagamento",
    categoria: "termos",
    descricao: "Formaliza a recompra ou o repagamento após uma contestação de pagamento.",
    minutos: 3,
  },
  "certidao-diligencia": {
    nome: "Certidão de Diligência e Contato Profissional",
    categoria: "recibos-certidoes",
    descricao: "Registra diligências, contatos profissionais e providências processuais adotadas.",
    minutos: 4,
  },
  "recibo-prestacao-servicos": {
    nome: "Recibo de Prestação de Serviços",
    categoria: "recibos-certidoes",
    descricao: "Comprova o recebimento de valores pelos serviços prestados ao cliente.",
    minutos: 3,
  },
  "relatorio-negociacao-homologacao": {
    nome: "Relatório de Negociação, Acordo e Homologação",
    categoria: "relatorios",
    descricao: "Consolida contatos, propostas, valores e manifestação do cliente na negociação.",
    minutos: 7,
  },
};

const FIELD_GROUPS = [
  { id: "pessoais", titulo: "Dados pessoais", campos: ["nomeCliente", "genero", "nacionalidade", "estadoCivil", "rg", "orgaoExpedidor", "cpfCnpj"] },
  { id: "contato", titulo: "Dados de contato", campos: ["email", "telefone"] },
  { id: "profissionais", titulo: "Informações profissionais", campos: ["profissao", "responsavelDocumento"] },
  { id: "endereco", titulo: "Endereço", campos: ["endereco", "cep", "cidade", "uf", "localEmissao"] },
  { id: "contratuais", titulo: "Dados contratuais e financeiros", prefixos: ["banco", "cnpjBanco", "enderecoBanco", "numeroContrato", "dataContrato", "dataCompromisso", "valor", "quantidadeParcelas", "produto", "servico", "modalidade", "bandeira", "tipoVenda", "codigoAutorizacao", "horario"] },
  { id: "processuais", titulo: "Informações processuais", prefixos: ["numeroProcesso", "vara", "comarca", "protocolo", "numeroProtocolo", "dataContato", "dataProposta", "validadeProposta", "manifestacaoCliente", "observacoes", "dataInicioRepresentacao", "dataAberturaReclamacao", "exercicios"] },
];

export function enriquecerModelos(modelos) {
  return modelos.map((modelo, indice) => {
    const meta = MODEL_META[modelo.modo] || {};
    const categoria = meta.categoria || "relatorios";
    return {
      ...modelo,
      ...meta,
      nomeOriginal: modelo.nome,
      nome: meta.nome || modelo.nome,
      categoria,
      categoriaNome: CATEGORY_LABELS[categoria],
      icone: DOCUMENT_CATEGORIES.find((item) => item.id === categoria)?.icone || "file",
      minutos: meta.minutos || Math.max(2, Math.ceil(modelo.campos.length / 3)),
      ordemOriginal: indice,
    };
  });
}

export function normalizarBusca(valor = "") {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function filtrarModelos(modelos, { busca, categoria, favoritos, recentes }) {
  const termo = normalizarBusca(busca);
  return modelos.filter((modelo) => {
    const texto = normalizarBusca(`${modelo.nome} ${modelo.descricao} ${modelo.categoriaNome}`);
    if (termo && !texto.includes(termo)) return false;
    if (categoria === "mais-utilizados" && !modelo.popular) return false;
    if (categoria === "favoritos" && !favoritos.includes(modelo.id)) return false;
    if (categoria === "recentes" && !recentes.includes(modelo.id)) return false;
    if (!["todos", "mais-utilizados", "favoritos", "recentes"].includes(categoria) && modelo.categoria !== categoria) return false;
    return true;
  });
}

export function ordenarModelos(modelos, ordenacao, favoritos) {
  return modelos.slice().sort((a, b) => {
    if (ordenacao === "alfabetica") return a.nome.localeCompare(b.nome, "pt-BR");
    if (ordenacao === "recentes") return Number(b.novo) - Number(a.novo) || b.ordemOriginal - a.ordemOriginal;
    if (ordenacao === "favoritos") return Number(favoritos.includes(b.id)) - Number(favoritos.includes(a.id)) || a.nome.localeCompare(b.nome, "pt-BR");
    return Number(b.popular) - Number(a.popular) || Number(b.recomendado) - Number(a.recomendado) || a.ordemOriginal - b.ordemOriginal;
  });
}

export function agruparCampos(campos) {
  const usados = new Set();
  const grupos = FIELD_GROUPS.map((grupo) => {
    const camposDoGrupo = campos.filter((campo) => {
      const corresponde = grupo.campos?.includes(campo.nome) || grupo.prefixos?.some((prefixo) => campo.nome.startsWith(prefixo));
      if (corresponde) usados.add(campo.nome);
      return corresponde;
    });
    return { ...grupo, campos: camposDoGrupo };
  }).filter((grupo) => grupo.campos.length > 0);
  const outros = campos.filter((campo) => !usados.has(campo.nome));
  if (outros.length > 0) grupos.push({ id: "complementares", titulo: "Informações complementares", campos: outros });
  return grupos;
}

export function formatarValorCampo(nome, valor) {
  const texto = String(valor ?? "");
  const digitos = texto.replace(/\D/g, "");
  if (nome === "cpfCnpj") {
    if (digitos.length <= 11) return digitos.slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return digitos.slice(0, 14).replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  if (nome === "cep") return digitos.slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
  if (nome === "telefone") return digitos.slice(0, 11).replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{4})$/, "$1-$2");
  if (nome === "uf") return texto.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  return texto.replace(/\s{2,}/g, " ");
}

export function erroCampo(campo, valor) {
  const texto = String(valor ?? "").trim();
  if (campo.obrigatorio && !texto) return `${campo.rotulo} é obrigatório.`;
  if (!texto) return "";
  if (campo.nome === "cpfCnpj" && ![11, 14].includes(texto.replace(/\D/g, "").length)) return "Informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.";
  if (campo.nome === "cep" && texto.replace(/\D/g, "").length !== 8) return "Informe um CEP com 8 dígitos.";
  if (campo.tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(texto)) return "Informe um endereço de e-mail válido.";
  if (campo.nome === "uf" && texto.length !== 2) return "Informe a UF com duas letras.";
  return "";
}

export function formatarDataArquivo(dataIso) {
  if (!dataIso) return "";
  const [ano, mes, dia] = dataIso.slice(0, 10).split("-");
  return [dia, mes, ano].filter(Boolean).join("-");
}

function cpfParcial(cpfCnpj) {
  const digitos = String(cpfCnpj || "").replace(/\D/g, "");
  return digitos.length >= 4 ? digitos.slice(-4) : "";
}

export function sugerirNomeDocumento(modelo, dados, padrao, numeroDocumento, versao = 1) {
  const partes = [];
  if (padrao.tipo) partes.push(modelo.nome);
  if (padrao.cliente && dados.nomeCliente) partes.push(dados.nomeCliente.trim());
  if (padrao.contrato && dados.numeroContrato) partes.push(`Contrato ${dados.numeroContrato}`);
  if (padrao.processo && dados.numeroProcesso) partes.push(`Processo ${dados.numeroProcesso}`);
  if (padrao.cpf && cpfParcial(dados.cpfCnpj)) partes.push(`CPF final ${cpfParcial(dados.cpfCnpj)}`);
  if (padrao.data && dados.dataEmissao) partes.push(formatarDataArquivo(dados.dataEmissao));
  if (padrao.numero && numeroDocumento) partes.push(numeroDocumento);
  if (padrao.versao && versao > 1) partes.push(`Versão ${String(versao).padStart(2, "0")}`);
  return partes.join(" – ").replace(/\s{2,}/g, " ").slice(0, 150);
}

export function normalizarNomeArquivo(nome) {
  const semControles = [...String(nome || "Documento")]
    .filter((caractere) => caractere.charCodeAt(0) >= 32)
    .join("");
  const base = semControles
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\-.]+|[_\-.]+$/g, "")
    .slice(0, 120);
  return `${base || "Documento"}.pdf`;
}

export function proximaVersao(nome, historico) {
  const base = normalizarBusca(nome.replace(/\s+–\s+versão\s+\d+$/i, ""));
  const versoes = historico
    .filter((item) => normalizarBusca(item.nomeDocumento || "").startsWith(base))
    .map((item) => Number(item.versao) || 1);
  return versoes.length ? Math.max(...versoes) + 1 : 1;
}
