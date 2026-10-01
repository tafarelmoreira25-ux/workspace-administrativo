function anoDoRegistro(registro, anoPadrao = new Date().getFullYear()) {
  const data = registro?.data_inicio_extrajudicial || registro?.created_at;
  const ano = String(data || "").match(/^(\d{4})/)?.[1];
  return ano || String(anoPadrao);
}

export function numeroProtocoloExtrajudicial(registro, anoPadrao) {
  const persistido = String(registro?.protocolo_extrajudicial || "").trim();
  if (persistido) return persistido;

  const idCrm = String(registro?.id_crm || registro?.pasta_cliente_id || "").trim();
  if (!idCrm) return "";
  if (/\/\d{4}$/.test(idCrm)) return idCrm;
  return `${idCrm}/${anoDoRegistro(registro, anoPadrao)}`;
}
