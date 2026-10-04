// O PDF usa exclusivamente a cópia preenchida do modelo original.
export function pendenciaModeloOriginal(modelo) {
  if (modelo?.revisaoWordPendente) return 'Geração bloqueada: ' + modelo.revisaoWordPendente;
  if (!modelo?.templateDocx) return 'Geração bloqueada: o modelo original DOCX não está disponível.';
  return '';
}

export async function gerarPdfModelo(dados, modelo) {
  const pendencia = pendenciaModeloOriginal(modelo);
  if (pendencia) throw new Error(pendencia);
  const { gerarWordOficial } = await import('./wordTemplateDocx.js');
  const { gerarPdfDoWordOficial } = await import('./wordModelLocalPdf.js');
  const copiaPreenchida = await gerarWordOficial(dados, modelo);
  const pdf = await gerarPdfDoWordOficial(copiaPreenchida.bytes);
  return pdf;
}
