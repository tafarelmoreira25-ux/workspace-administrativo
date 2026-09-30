export const DOCUMENTO_PROCURACAO = "procuracao";
export const DOCUMENTO_HIPOSSUFICIENCIA = "hipossuficiencia";
export const DOCUMENTO_ISENCAO_IRPF = "isencao-irpf";

export function exerciciosIrpfPadrao(dataIso) {
  const anoAtual = Number(dataIso?.slice(0, 4)) || new Date().getFullYear();
  return `${anoAtual - 2}, ${anoAtual - 1} e ${anoAtual}`;
}

export function criarOpcoesIniciaisProcuracao(dataIso) {
  return {
    gerarHipossuficiencia: true,
    gerarIsencaoIrpf: true,
    exercicios: exerciciosIrpfPadrao(dataIso),
  };
}

export function listarDocumentosProcuracao(dados) {
  const documentos = [DOCUMENTO_PROCURACAO];
  if (dados.gerarHipossuficiencia) documentos.push(DOCUMENTO_HIPOSSUFICIENCIA);
  if (dados.gerarIsencaoIrpf) documentos.push(DOCUMENTO_ISENCAO_IRPF);
  return documentos;
}

export function mensagemConjuntoGerado(documentos) {
  if (documentos.length === 1) return "Procuração gerada com sucesso!";
  return `${documentos.length} documentos do conjunto da Procuração gerados em arquivos Word separados!`;
}
