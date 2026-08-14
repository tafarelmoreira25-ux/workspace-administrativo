const normalizar = (valor = "") =>
  String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const ETAPAS_TASKMANAGER = [
  { numero: 1, nome: "Entrada comercial", departamento: "Comercial / Administrativo", pasta: "01_CONTRATO_E_ASSINATURAS" },
  { numero: 2, nome: "Documentos iniciais", departamento: "Administrativo / Juridico", pasta: "02_DOCUMENTOS_INICIAIS" },
  { numero: 3, nome: "Tratativa extrajudicial", departamento: "Administrativo / Juridico", pasta: "03_NOTIFICACOES_E_TERMOS" },
  { numero: 4, nome: "Protocolos e comprovantes", departamento: "Administrativo", pasta: "04_PROTOCOLOS_OFICIAIS" },
  { numero: 5, nome: "Evidencias e acompanhamento", departamento: "Juridico", pasta: "05_EVIDENCIAS_DE_ATENDIMENTO" },
  { numero: 6, nome: "Laudo e preparacao judicial", departamento: "Juridico / Contabilidade", pasta: "06_LAUDOS_E_CALCULOS" },
  { numero: 7, nome: "Processual", departamento: "Processual", pasta: "07_DOCUMENTOS_JUDICIAIS" },
  { numero: 8, nome: "Audiencia e homologacao", departamento: "Juridico / Processual", pasta: "09_ATAS_E_DECISOES" },
  { numero: 9, nome: "Financeiro e encerramento", departamento: "Administrativo", pasta: "08_FINANCEIRO_E_CUSTAS" },
];

export const STATUS_TASKMANAGER = [
  { chave: "fila", rotulo: "Fila", passo: 1, ajuda: "Pronta para ser iniciada" },
  { chave: "em-andamento", rotulo: "Em andamento", passo: 2, ajuda: "Tratativa em execucao" },
  { chave: "pendente-bloqueada", rotulo: "Pendente / Bloqueada", passo: 3, ajuda: "Existe uma pendencia que impede o avanco" },
  { chave: "validacao-supervisor", rotulo: "Validacao do supervisor", passo: 4, ajuda: "Entrega enviada para conferencia" },
  { chave: "concluida", rotulo: "Concluida", passo: 5, ajuda: "Tratativa finalizada" },
];

const STATUS_POR_CHAVE = new Map(STATUS_TASKMANAGER.map((status) => [status.chave, status]));

const STATUS_FILA = new Set(["pendente", "nova", "rascunho", "delegada", "recebida"]);
const STATUS_ANDAMENTO = new Set(["em_andamento", "em_execucao"]);
const STATUS_PENDENCIA = new Set([
  "aguardando_informacao",
  "aguardando_cliente",
  "aguardando_banco",
  "aguardando_juridico",
  "aguardando_judiciario",
  "impedida",
  "bloqueada",
  "devolvida",
  "devolvida_correcao",
]);
const STATUS_VALIDACAO = new Set(["devolvida_conferencia", "em_revisao", "validacao_supervisor"]);
const STATUS_CONCLUIDA = new Set(["concluida", "arquivada", "cancelada"]);

export function obterStatusTaskManager(tarefa) {
  const status = normalizar(tarefa?.status).replaceAll(" ", "_");
  let chave = "fila";

  if (STATUS_CONCLUIDA.has(status)) chave = "concluida";
  else if (STATUS_VALIDACAO.has(status)) chave = "validacao-supervisor";
  else if (STATUS_PENDENCIA.has(status)) chave = "pendente-bloqueada";
  else if (STATUS_ANDAMENTO.has(status)) chave = "em-andamento";
  else if (STATUS_FILA.has(status)) chave = "fila";

  return STATUS_POR_CHAVE.get(chave);
}

export function obterEtapaTaskManager(tarefa) {
  const etapaInformada = Number(tarefa?.fase_esteira);
  if (Number.isInteger(etapaInformada) && etapaInformada >= 1 && etapaInformada <= 9) {
    return ETAPAS_TASKMANAGER[etapaInformada - 1];
  }

  const texto = normalizar([
    tarefa?.codigo_etapa,
    tarefa?.categoria,
    tarefa?.tipo_tarefa,
    tarefa?.titulo,
    tarefa?.descricao,
  ].filter(Boolean).join(" "));

  const regras = [
    [8, ["audiencia", "homologacao", "conciliacao", "ata"]],
    [9, ["financeiro", "encerramento", "custas", "pagamento final"]],
    [7, ["processual", "judicial", "procuracao", "distribuicao", "citacao", "forum"]],
    [6, ["laudo", "parecer", "contabil", "kit judicial"]],
    [5, ["evidencia", "whatsapp", "diligencia", "acompanhamento", "retorno cliente"]],
    [4, ["protocolo", "comprovante de envio", "certidao"]],
    [3, ["gov", "notificacao", "extrajudicial", "requerimento", "termo"]],
    [2, ["documentos iniciais", "ccb", "crv", "comprovante de endereco", "ultima parcela"]],
    [1, ["contrato", "pasta inicial", "entrada comercial"]],
  ];

  const regra = regras.find(([, palavras]) => palavras.some((palavra) => texto.includes(palavra)));
  return ETAPAS_TASKMANAGER[(regra?.[0] || 1) - 1];
}

export function tarefaNoMacroStatus(tarefa, chave) {
  return obterStatusTaskManager(tarefa).chave === chave;
}
