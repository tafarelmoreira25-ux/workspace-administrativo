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
};

export function possuiNumeroProcessual(registro: RegistroProcessual) {
  return Boolean(registro.numero_processo?.trim());
}

export function pertenceAProtocolos(registro: RegistroProcessual) {
  return !possuiNumeroProcessual(registro)
    && FASES_DE_PROTOCOLO.includes(registro.fase_atual as (typeof FASES_DE_PROTOCOLO)[number]);
}

export function pertenceAProcessos(registro: RegistroProcessual) {
  return possuiNumeroProcessual(registro);
}

export const pertenceAoProcessual = pertenceAProcessos;
