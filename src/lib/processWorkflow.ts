export const FASES_DE_PROTOCOLO = [
  "Solicitado para Ajuizamento",
  "Documentação",
  "Procuração",
  "CRM",
  "Enviado para Elite",
  "SLA",
  "Pasta Retornada",
  "Pré-Distribuição",
  "Distribuição",
  "Documentos Pendentes",
  "Documentos Concluídos",
] as const;

type RegistroProcessual = {
  numero_processo?: string | null;
  fase_atual?: string | null;
  status_judicial?: string | null;
  origem_registro?: string | null;
};

export function possuiNumeroProcessual(registro: RegistroProcessual) {
  return Boolean(registro.numero_processo?.trim());
}

export function pertenceAExtrajudiciais(registro: RegistroProcessual) {
  return registro.status_judicial === "EXTRAJUDICIAL"
    || (!registro.status_judicial
      && registro.origem_registro === "acao_extrajudicial_manual"
      && registro.fase_atual === "Extrajudicial");
}

export function pertenceAProtocolos(registro: RegistroProcessual) {
  return !possuiNumeroProcessual(registro)
    && FASES_DE_PROTOCOLO.includes(registro.fase_atual as (typeof FASES_DE_PROTOCOLO)[number]);
}

export function pertenceAProcessos(registro: RegistroProcessual) {
  return possuiNumeroProcessual(registro);
}

export const pertenceAoProcessual = pertenceAProcessos;
