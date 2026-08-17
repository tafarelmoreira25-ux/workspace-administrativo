export const DURACAO_ATUALIZACAO_GERAL_MS = 5 * 60 * 60 * 1000;

export function filtrarAtualizacoesGeraisAtivas(atualizacoes = [], agora = new Date()) {
  const instanteAtual = new Date(agora).getTime();
  return atualizacoes.filter((atualizacao) => {
    const expiracao = atualizacao?.expira_em
      ? new Date(atualizacao.expira_em).getTime()
      : new Date(atualizacao.created_at).getTime() + DURACAO_ATUALIZACAO_GERAL_MS;
    return Number.isFinite(expiracao) && expiracao > instanteAtual;
  });
}

export function tempoDecorridoAtualizacao(createdAt, agora = new Date()) {
  const minutos = Math.max(
    0,
    Math.floor((new Date(agora).getTime() - new Date(createdAt).getTime()) / 60_000),
  );
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `há ${horas}h${minutos % 60 ? ` ${minutos % 60}min` : ""}`;
}

export function destinoDaAtualizacaoGeral(atualizacao) {
  if (atualizacao?.destino === "status_processual") return "status_processual";
  if (atualizacao?.destino === "tarefas") return "tarefas";
  return "inicio";
}
