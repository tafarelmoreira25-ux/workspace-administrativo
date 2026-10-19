/**
 * Biblioteca intencionalmente vazia: modelos antigos não são modelos oficiais ativos.
 * Cadastre um modelo novo somente depois de receber o DOCX de referência e validar o
 * seu formulário e renderizador individual contra esse original.
 *
 * Cada entrada futura deve informar:
 * { id, name, category, fields, renderPdf(dados) }
 * renderPdf deve devolver bytes PDF gerados localmente para aquele modelo.
 */
export const DOCUMENT_GENERATORS = Object.freeze([]);

export function getDocumentGenerator(id) {
  return DOCUMENT_GENERATORS.find((modelo) => modelo.id === id) || null;
}

export async function generateDocumentPdf(id, dados) {
  const modelo = getDocumentGenerator(id);
  if (!modelo) throw new Error("O modelo selecionado não está ativo.");
  if (typeof modelo.renderPdf !== "function") {
    throw new Error("O modelo não possui um renderizador PDF próprio configurado.");
  }

  const ausentes = (modelo.fields || [])
    .filter((campo) => campo.required && !String(dados?.[campo.id] ?? "").trim())
    .map((campo) => campo.label);
  if (ausentes.length) {
    throw new Error(`Preencha os campos obrigatórios: ${ausentes.join(", ")}.`);
  }

  const bytes = await modelo.renderPdf(dados);
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw new Error("O renderizador não produziu um PDF válido.");
  }
  return bytes;
}
