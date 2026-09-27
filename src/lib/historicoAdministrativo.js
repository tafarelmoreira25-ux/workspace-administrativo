export const FASES_HISTORICO = [
  { id: "extrajudicial_administrativa", ordem: 1, titulo: "Ação extrajudicial", subtitulo: "Administrativa" },
  { id: "transicao_judicial", ordem: 2, titulo: "Transição para o judicial", subtitulo: "" },
  { id: "judicial", ordem: 3, titulo: "Ação judicial", subtitulo: "" },
];

function faseLegada(item) {
  const ordem = item.ordemMovimentacao ?? item.ordemHistorico;
  if (ordem != null && ordem <= 25) return "extrajudicial_administrativa";
  if (ordem != null && ordem <= 29) return "transicao_judicial";
  return "judicial";
}

export function faseDaMovimentacao(item) {
  return item.fase || faseLegada(item);
}

function ordemDaFase(item) {
  return item.ordemFase ?? FASES_HISTORICO.find((fase) => fase.id === faseDaMovimentacao(item))?.ordem ?? 3;
}

export function ordenarTimelineProcessual(a, b) {
  const diferencaFase = ordemDaFase(a) - ordemDaFase(b);
  if (diferencaFase) return diferencaFase;
  const ordemA = a.ordemMovimentacao ?? a.ordemHistorico;
  const ordemB = b.ordemMovimentacao ?? b.ordemHistorico;
  if (ordemA != null || ordemB != null) {
    if (ordemA == null) return 1;
    if (ordemB == null) return -1;
    if (ordemA !== ordemB) return ordemA - ordemB;
  }
  const dataA = a.data ? new Date(a.data).getTime() : Number.MAX_SAFE_INTEGER;
  const dataB = b.data ? new Date(b.data).getTime() : Number.MAX_SAFE_INTEGER;
  if (dataA !== dataB) return dataA - dataB;

  const criacaoA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
  const criacaoB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
  if (criacaoA !== criacaoB) return criacaoA - criacaoB;

  // Para eventos sem qualquer sequencia persistida, preserva a ordem recebida.
  return 0;
}

export function agruparTimelineProcessual(itens) {
  const ordenados = [...itens].sort(ordenarTimelineProcessual);
  return FASES_HISTORICO.map((fase) => ({ ...fase, itens: ordenados.filter((item) => faseDaMovimentacao(item) === fase.id) }))
    .filter((fase) => fase.itens.length > 0);
}

export function descricoesDiferentes(titulo, descricao) {
  const normalizar = (valor) => String(valor || "").trim().toLocaleLowerCase("pt-BR");
  return Boolean(descricao && normalizar(titulo) !== normalizar(descricao));
}

export function mapearMovimentacaoTimeline(item) {
  return {
    id: `m-${item.id}`,
    data: item.data_andamento || item.data_registro,
    criadoEm: item.created_at || null,
    fase: item.fase || null,
    ordemFase: item.ordem_fase ?? null,
    ordemMovimentacao: item.ordem_movimentacao ?? item.ordem_historico ?? null,
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
