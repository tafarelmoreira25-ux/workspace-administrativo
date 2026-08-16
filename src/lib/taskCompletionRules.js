export const TIPOS_COM_ENTREGA_DOCUMENTAL = new Set([
  "CONTRATO",
  "NOTIFICACAO_EXTRAJUDICIAL",
  "NOTIFICACAO_EMAIL",
  "DOCUMENTOS",
  "PROCURACOES",
  "CITACAO",
  "TERMOS",
  "DISTRATO",
  "CERTIDAO",
  "HOMOLOGACAO",
]);

function normalizar(texto = "") {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tarefaExigeComprovacao(tarefa = {}) {
  if (typeof tarefa.requer_comprovacao === "boolean") return tarefa.requer_comprovacao;
  const codigo = String(tarefa.tipo_tarefa_codigo || "").trim().toUpperCase();
  if (codigo === "LAUDO") return false;
  if (codigo) return TIPOS_COM_ENTREGA_DOCUMENTAL.has(codigo);

  const texto = normalizar(`${tarefa.categoria || ""} ${tarefa.titulo || ""}`);
  if (texto.includes("laudo")) return false;
  return /(contrato|notificacao|documento|procuracao|citacao|termo|distrato|certidao|homologacao|declaracao|contestacao|recibo|relatorio)/i.test(texto);
}
