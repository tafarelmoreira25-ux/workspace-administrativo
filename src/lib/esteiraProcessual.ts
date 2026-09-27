import { supabase } from "./supabase";

export const FASES_PROCESSUAIS = [
  "Solicitado para Ajuizamento",
  "Documentação",
  "Procuração",
  "CRM",
  "Enviado para Elite",
  "SLA",
  "Pasta Retornada",
  "Protocolo Liberado",
  "Distribuição",
  "Tramitando",
  "Arquivado",
  "Improcedente",
  "Documentos Pendentes",
  "Documentos Concluídos",
  "Pré-Distribuição",
] as const;

export type FaseProcessual = (typeof FASES_PROCESSUAIS)[number];

export const JUSTICA_GRATUITA_OPCOES = [
  "Deferida",
  "Indeferida",
  "Não Solicitada",
] as const;

export type JusticaGratuita = (typeof JUSTICA_GRATUITA_OPCOES)[number];

export type StatusPrazoElite = "neutro" | "atencao" | "critico" | "vermelho" | "atrasado" | "pendente" | "verde" | "amarelo";

export type PrazoElite = {
  dataLimite: Date | null;
  diasUteisRestantes: number | null;
  diasUteisDecorridos: number | null;
  diasUteisAtraso: number;
  percentual: number;
  sinalizacao: StatusPrazoElite;
  rotulo: string;
};

export type Processo = {
  id: string;
  cliente_id?: string | null;
  pasta_cliente_id: string | null;
  link_pasta_cliente?: string | null;
  id_crm?: string | null;
  autor_reu: string | null;
  autor?: string | null;
  reu?: string | null;
  nome_cliente: string;
  cpf_cliente: string | null;
  banco_reu: string | null;
  produto?: string | null;
  numero_contrato?: string | null;
  motivo_ajuizamento?: string | null;
  fase_atual: FaseProcessual;
  status_judicial: string | null;
  status_documentos: string | null;
  status_procuracao: string | null;
  documentos_elite_status: string | null;
  documentacao_status?: string | null;
  documentacao_motivo?: string | null;
  documentacao_faltantes?: string | null;
  documentacao_responsabilidade?: string | null;
  documentacao_observacao?: string | null;
  documentacao_data?: string | null;
  procuracao_status?: string | null;
  declaracao_hipossuficiencia_status?: string | null;
  declaracao_ir_status?: string | null;
  procuracoes_outros?: string | null;
  crm_documentos_status?: string | null;
  crm_documentos_data?: string | null;
  crm_documentos_responsavel?: string | null;
  crm_documentos_usuario?: string | null;
  pasta_retornada: boolean | null;
  pasta_retorno_status?: string | null;
  pasta_retorno_data?: string | null;
  pasta_retorno_motivo?: string | null;
  pasta_retorno_descricao?: string | null;
  pasta_retorno_responsabilidade?: string | null;
  pasta_retorno_documento_faltante?: string | null;
  pasta_retorno_data_regularizacao?: string | null;
  pasta_retorno_data_reenvio?: string | null;
  pasta_retorno_observacao?: string | null;
  pasta_retorno_impacto_sla?: string | null;
  protocolo_status?: string | null;
  protocolo_data_liberacao?: string | null;
  tribunal?: string | null;
  comarca?: string | null;
  tipo_acao?: string | null;
  link_consulta?: string | null;
  responsavel?: string | null;
  situacao?: string | null;
  fase_judicial?: string | null;
  resultado?: string | null;
  ultima_movimentacao?: string | null;
  ultima_movimentacao_data?: string | null;
  ultima_revisao?: string | null;
  ultima_revisao_por?: string | null;
  ultima_revisao_observacao?: string | null;
  ultima_revisao_em?: string | null;
  proxima_revisao?: string | null;
  proximo_prazo?: string | null;
  emenda_status?: string | null;
  custas_status?: string | null;
  com_pendencia?: boolean | null;
  sem_revisao?: boolean | null;
  recursal?: boolean | null;
  ultimo_atendimento?: string | null;
  ultimo_relatorio_enviado?: string | null;
  status_prazo: string | null;
  data_envio_elite: string | null;
  sla_iniciado_em?: string | null;
  sla_encerrado_em?: string | null;
  sla_dias_uteis_utilizados?: number | null;
  data_protocolo_liberado: string | null;
  data_distribuicao: string | null;
  numero_processo: string | null;
  vara: string | null;
  justica_gratuita: JusticaGratuita | null;
  emenda_inicial: string | null;
  link_processo: string | null;
  observacoes: string | null;
  checklist_elite?: Record<string, string>;
  origem_registro?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MovimentacaoProcessual = {
  id: string;
  processo_id: string;
  data_registro: string | null;
  descricao: string;
  tipo?: string;
  categoria?: string | null;
  titulo?: string | null;
  descricao_tecnica?: string | null;
  resumo_cliente?: string | null;
  responsavel?: string | null;
  fonte?: string | null;
  link?: string | null;
  importancia?: "Normal" | "Relevante" | "Crítico" | string | null;
  anexo_url?: string | null;
  possui_anexo?: boolean | null;
  fase?: "extrajudicial_administrativa" | "transicao_judicial" | "judicial" | string | null;
  ordem_fase?: number | null;
  ordem_movimentacao?: number | null;
  ordem_historico?: number | null;
  proxima_providencia?: string | null;
  proxima_revisao?: string | null;
  criar_tarefa_relacionada?: boolean | null;
  origem?: "manual" | "integration" | "api" | "import" | "ai" | string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_by?: string | null;
  created_by_nome?: string | null;
  created_at?: string;
};

export const CHECKLIST_ELITE = [
  { id: "rg_cnh", label: "RG/CNH" },
  { id: "comprovante_residencia", label: "Comprovante de Residência" },
  { id: "contrato_integra", label: "Contrato na Íntegra" },
  { id: "extratos_holerites", label: "Extratos/Holerites" },
  { id: "procuracao_assinada", label: "Procuração assinada" },
] as const;

export type ChecklistEliteId = (typeof CHECKLIST_ELITE)[number]["id"];

export type RegistroChecklistElite = {
  status?: "Pendente" | "Conferido" | "Anexado no Drive" | "Irregular" | string;
  link_drive?: string | null;
  observacao?: string | null;
};

export type ArquivosChecklistElite = Partial<Record<ChecklistEliteId, File>>;
export type RegistrosChecklistElite = Partial<Record<ChecklistEliteId, RegistroChecklistElite>>;

function normalizarData(data: string | Date) {
  const parsed = data instanceof Date ? new Date(data) : new Date(data);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function chaveData(data: Date) {
  return data.toISOString().slice(0, 10);
}

function ehDiaUtil(data: Date, feriados: string[] = []) {
  const diaSemana = data.getDay();
  return diaSemana !== 0 && diaSemana !== 6 && !feriados.includes(chaveData(data));
}

export function adicionarDiasUteis(dataInicial: Date, totalDiasUteis: number, feriados: string[] = []) {
  const resultado = new Date(dataInicial);
  let diasSomados = 0;

  while (diasSomados < totalDiasUteis) {
    resultado.setDate(resultado.getDate() + 1);
    if (ehDiaUtil(resultado, feriados)) diasSomados += 1;
  }

  return resultado;
}

export function contarDiasUteisEntre(dataInicial: Date, dataFinal: Date, feriados: string[] = [], incluirFinal = true) {
  const cursor = new Date(dataInicial);
  cursor.setHours(0, 0, 0, 0);
  const limite = new Date(dataFinal);
  limite.setHours(0, 0, 0, 0);
  let total = 0;

  while (cursor < limite || (incluirFinal && cursor <= limite)) {
    if (ehDiaUtil(cursor, feriados)) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

export function calcularPrazoElite(
  dataEnvio: string | Date | null | undefined,
  hojeReferencia: Date = new Date(),
  feriados: string[] = [],
): PrazoElite {
  if (!dataEnvio) {
    return {
      dataLimite: null,
      diasUteisRestantes: null,
      diasUteisDecorridos: null,
      diasUteisAtraso: 0,
      percentual: 0,
      sinalizacao: "pendente",
      rotulo: "Pendente",
    };
  }

  const dataBase = normalizarData(dataEnvio);
  if (!dataBase) {
    return {
      dataLimite: null,
      diasUteisRestantes: null,
      diasUteisDecorridos: null,
      diasUteisAtraso: 0,
      percentual: 0,
      sinalizacao: "pendente",
      rotulo: "Data inválida",
    };
  }

  const dataLimite = adicionarDiasUteis(dataBase, 20, feriados);
  const hoje = normalizarData(hojeReferencia) || new Date();
  const diasUteisDecorridos = Math.max(0, contarDiasUteisEntre(dataBase, hoje, feriados, false));

  if (hoje > dataLimite) {
    const atraso = contarDiasUteisEntre(dataLimite, hoje, feriados, false);
    return {
      dataLimite,
      diasUteisRestantes: 0,
      diasUteisDecorridos,
      diasUteisAtraso: atraso,
      percentual: 100,
      sinalizacao: "atrasado",
      rotulo: `Atrasado há ${atraso} ${atraso === 1 ? "dia útil" : "dias úteis"}`,
    };
  }

  const diasUteisRestantes = contarDiasUteisEntre(hoje, dataLimite, feriados, true);
  let sinalizacao: StatusPrazoElite = "neutro";
  let rotulo = "No prazo";

  if (diasUteisRestantes === 0) {
    sinalizacao = "vermelho";
    rotulo = "Data limite";
  } else if (diasUteisRestantes <= 2) {
    sinalizacao = "critico";
    rotulo = "Crítico";
  } else if (diasUteisRestantes <= 5) {
    sinalizacao = "atencao";
    rotulo = "Atenção";
  }

  return {
    dataLimite,
    diasUteisRestantes,
    diasUteisDecorridos,
    diasUteisAtraso: 0,
    percentual: Math.min(100, Math.round((diasUteisDecorridos / 20) * 100)),
    sinalizacao,
    rotulo,
  };
}

export function checklistEliteCompleto(checklist?: Record<string, unknown> | null) {
  return CHECKLIST_ELITE.every((item) => Boolean(checklist?.[item.id]));
}

export async function registrarChecklistEliteDrive(
  processoId: string,
  registros: RegistrosChecklistElite,
) {
  const faltantes = CHECKLIST_ELITE.filter((item) => {
    const registro = registros[item.id];
    return !registro || !["Conferido", "Anexado no Drive"].includes(String(registro.status || ""));
  }).map((item) => item.label);

  if (faltantes.length > 0) {
    throw new Error(`Marque todos os documentos obrigatórios como conferidos/anexados no Drive: ${faltantes.join(", ")}.`);
  }

  const conferidos: Record<string, string> = {};

  for (const item of CHECKLIST_ELITE) {
    const registro = registros[item.id];
    if (!registro) continue;

    const { error: registroError } = await supabase
      .from("processos_documentos")
      .upsert(
        {
          processo_id: processoId,
          tipo_documento: item.id,
          status: registro.status || "Conferido",
          link_drive: registro.link_drive || null,
          observacao: registro.observacao || null,
          armazenamento_oficial: "Drive",
          conferido_em: new Date().toISOString(),
        },
        { onConflict: "processo_id,tipo_documento" },
      );

    if (registroError) throw registroError;
    conferidos[item.id] = registro.status || "Conferido";
  }

  return conferidos;
}

export async function enviarChecklistElite(
  processoId: string,
  arquivosOuRegistros: ArquivosChecklistElite | RegistrosChecklistElite,
) {
  const registros = Object.fromEntries(
    CHECKLIST_ELITE.map((item) => {
      const valor = arquivosOuRegistros[item.id] as File | RegistroChecklistElite | undefined;
      const status = valor instanceof File ? "Conferido" : valor?.status;
      const link_drive = valor instanceof File ? null : valor?.link_drive;
      const observacao = valor instanceof File
        ? `Arquivo ${valor.name} conferido. Arquivamento oficial deve ser feito na pasta do cliente no Drive.`
        : valor?.observacao;

      return [item.id, { status, link_drive, observacao }];
    }),
  ) as RegistrosChecklistElite;

  return registrarChecklistEliteDrive(processoId, registros);
}
