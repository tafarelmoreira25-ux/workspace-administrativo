import { supabase } from "./supabase";

export const FASES_PROCESSUAIS = [
  "Solicitado para Ajuizamento",
  "Documentos Pendentes",
  "Documentos Concluídos",
  "Pré-Distribuição",
  "Enviado para Elite",
  "Pasta Retornada",
  "Protocolo Liberado",
  "Tramitando",
  "Arquivado",
  "Improcedente",
] as const;

export type FaseProcessual = (typeof FASES_PROCESSUAIS)[number];

export const JUSTICA_GRATUITA_OPCOES = [
  "Deferida",
  "Indeferida",
  "Não Solicitada",
] as const;

export type JusticaGratuita = (typeof JUSTICA_GRATUITA_OPCOES)[number];

export type StatusPrazoElite = "verde" | "amarelo" | "vermelho" | "pendente";

export type PrazoElite = {
  dataLimite: Date | null;
  diasUteisRestantes: number | null;
  sinalizacao: StatusPrazoElite;
  rotulo: string;
};

export type Processo = {
  id: string;
  pasta_cliente_id: string | null;
  autor_reu: string | null;
  nome_cliente: string;
  cpf_cliente: string | null;
  banco_reu: string | null;
  fase_atual: FaseProcessual;
  status_judicial: string | null;
  status_documentos: string | null;
  status_procuracao: string | null;
  documentos_elite_status: string | null;
  pasta_retornada: boolean | null;
  status_prazo: string | null;
  data_envio_elite: string | null;
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
  created_at?: string;
  updated_at?: string;
};

export type MovimentacaoProcessual = {
  id: string;
  processo_id: string;
  data_registro: string;
  descricao: string;
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

export type ArquivosChecklistElite = Partial<Record<ChecklistEliteId, File>>;

function normalizarData(data: string | Date) {
  const parsed = data instanceof Date ? new Date(data) : new Date(data);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function adicionarDiasUteis(dataInicial: Date, totalDiasUteis: number) {
  const resultado = new Date(dataInicial);
  let diasSomados = 0;

  while (diasSomados < totalDiasUteis) {
    resultado.setDate(resultado.getDate() + 1);
    const diaSemana = resultado.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      diasSomados += 1;
    }
  }

  return resultado;
}

function contarDiasUteisAte(dataInicial: Date, dataFinal: Date) {
  const cursor = new Date(dataInicial);
  cursor.setHours(0, 0, 0, 0);
  const limite = new Date(dataFinal);
  limite.setHours(0, 0, 0, 0);
  let total = 0;

  while (cursor <= limite) {
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

export function calcularPrazoElite(
  dataEnvio: string | Date | null | undefined,
  hojeReferencia: Date = new Date(),
): PrazoElite {
  if (!dataEnvio) {
    return {
      dataLimite: null,
      diasUteisRestantes: null,
      sinalizacao: "pendente",
      rotulo: "Pendente",
    };
  }

  const dataBase = normalizarData(dataEnvio);
  if (!dataBase) {
    return {
      dataLimite: null,
      diasUteisRestantes: null,
      sinalizacao: "pendente",
      rotulo: "Data inválida",
    };
  }

  const dataLimite = adicionarDiasUteis(dataBase, 20);
  const hoje = normalizarData(hojeReferencia) || new Date();

  if (hoje > dataLimite) {
    return {
      dataLimite,
      diasUteisRestantes: 0,
      sinalizacao: "vermelho",
      rotulo: "Atrasado",
    };
  }

  const diasUteisRestantes = contarDiasUteisAte(hoje, dataLimite);
  const sinalizacao = diasUteisRestantes < 5 ? "amarelo" : "verde";

  return {
    dataLimite,
    diasUteisRestantes,
    sinalizacao,
    rotulo: sinalizacao === "amarelo" ? "Atenção" : "Pendente",
  };
}

export function checklistEliteCompleto(checklist?: Record<string, unknown> | null) {
  return CHECKLIST_ELITE.every((item) => Boolean(checklist?.[item.id]));
}

function limparNomeArquivo(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function enviarChecklistElite(
  processoId: string,
  arquivos: ArquivosChecklistElite,
) {
  const faltantes = CHECKLIST_ELITE.filter((item) => !arquivos[item.id]).map(
    (item) => item.label,
  );

  if (faltantes.length > 0) {
    throw new Error(`Envie todos os documentos obrigatórios: ${faltantes.join(", ")}.`);
  }

  const enviados: Record<string, string> = {};

  for (const item of CHECKLIST_ELITE) {
    const arquivo = arquivos[item.id];
    if (!arquivo) continue;
    const path = `${processoId}/checklist-elite/${item.id}-${Date.now()}-${limparNomeArquivo(arquivo.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("processos-elite")
      .upload(path, arquivo, {
        cacheControl: "3600",
        contentType: arquivo.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { error: registroError } = await supabase
      .from("processos_documentos")
      .upsert(
        {
          processo_id: processoId,
          tipo_documento: item.id,
          arquivo_path: path,
          bucket: "processos-elite",
        },
        { onConflict: "processo_id,tipo_documento" },
      );

    if (registroError) throw registroError;
    enviados[item.id] = path;
  }

  return enviados;
}
