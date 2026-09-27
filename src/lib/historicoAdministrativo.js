const POSICAO_FINAL_SEM_DATA = 9999999999999;
const POSICAO_REGISTROS_DATADOS = 10000000000000;

export function ordenarTimelineProcessual(a, b) {
  const ordemA = a.ordemHistorico != null ? -a.ordemHistorico : (a.data ? POSICAO_REGISTROS_DATADOS - new Date(a.data).getTime() : POSICAO_FINAL_SEM_DATA);
  const ordemB = b.ordemHistorico != null ? -b.ordemHistorico : (b.data ? POSICAO_REGISTROS_DATADOS - new Date(b.data).getTime() : POSICAO_FINAL_SEM_DATA);
  return ordemA - ordemB;
}

export function mapearMovimentacaoTimeline(item) {
  return {
    id: `m-${item.id}`,
    data: item.data_andamento || item.data_registro,
    ordemHistorico: item.ordem_historico ?? null,
    titulo: item.titulo || item.tipo || "Movimentacao registrada",
    descricao: item.descricao,
    detalhe: item.proxima_providencia,
    responsavel: item.responsavel || item.created_by_nome,
    origem: item.origem || "manual",
    possuiAnexo: Boolean(item.possui_anexo || item.anexo_url),
    movimentacao: item,
  };
}
