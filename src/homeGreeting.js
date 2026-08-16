function pluralizar(quantidade, singular, plural) {
  return quantidade === 1 ? singular : plural;
}

function obterDataLimite(tarefa) {
  return (tarefa?.prazo_limite || tarefa?.data_limite || "").slice(0, 10);
}

function primeiroNome(nome) {
  return nome?.trim().split(/\s+/)[0] || "";
}

export function criarResumoBoasVindas({
  nome,
  tarefasAbertas = [],
  tarefasConcluidas = 0,
  hoje,
}) {
  const nomeCurto = primeiroNome(nome);
  const titulo = nomeCurto
    ? `Boas-vindas, ${nomeCurto}! Vamos trabalhar?`
    : "Boas-vindas! Vamos trabalhar?";
  const pendentes = tarefasAbertas.length;

  if (pendentes === 0) {
    const complemento = tarefasConcluidas > 0
      ? ` Você já concluiu ${tarefasConcluidas} ${pluralizar(tarefasConcluidas, "tarefa", "tarefas")}.`
      : "";
    return {
      titulo,
      mensagem: `Todas as tarefas estão em ordem. Não há nenhuma pendência agora.${complemento}`,
      tom: "success",
      filtro: null,
    };
  }

  const atrasadas = tarefasAbertas.filter((tarefa) => {
    const dataLimite = obterDataLimite(tarefa);
    return dataLimite && dataLimite < hoje;
  });
  const vencemHoje = tarefasAbertas.filter(
    (tarefa) => obterDataLimite(tarefa) === hoje,
  );
  const extremaUrgenciaHoje = vencemHoje.filter((tarefa) =>
    ["urgente", "critica"].includes(tarefa.prioridade),
  );
  const urgentes = tarefasAbertas.filter((tarefa) =>
    ["urgente", "critica"].includes(tarefa.prioridade),
  );

  if (atrasadas.length > 0) {
    const complemento = extremaUrgenciaHoje.length > 0
      ? ` Além disso, ${extremaUrgenciaHoje.length} ${pluralizar(extremaUrgenciaHoje.length, "tarefa exige", "tarefas exigem")} atenção máxima hoje.`
      : " Vamos priorizar essas entregas agora.";
    return {
      titulo,
      mensagem: `Você tem ${pendentes} ${pluralizar(pendentes, "tarefa pendente", "tarefas pendentes")}, com ${atrasadas.length} ${pluralizar(atrasadas.length, "atrasada", "atrasadas")}.${complemento}`,
      tom: "critical",
      filtro: "atrasadas",
    };
  }

  if (extremaUrgenciaHoje.length > 0) {
    return {
      titulo,
      mensagem: `Você tem ${pendentes} ${pluralizar(pendentes, "tarefa pendente", "tarefas pendentes")}. ${extremaUrgenciaHoje.length} ${pluralizar(extremaUrgenciaHoje.length, "precisa", "precisam")} de atenção máxima e ${pluralizar(extremaUrgenciaHoje.length, "vence", "vencem")} hoje. Vamos começar por ${pluralizar(extremaUrgenciaHoje.length, "ela", "elas")}?`,
      tom: "critical",
      filtro: "vencem_hoje",
    };
  }

  if (vencemHoje.length > 0) {
    return {
      titulo,
      mensagem: `Você tem ${pendentes} ${pluralizar(pendentes, "tarefa pendente", "tarefas pendentes")}, e ${vencemHoje.length} ${pluralizar(vencemHoje.length, "vence", "vencem")} hoje. A pauta está sob controle, mas essas entregas merecem prioridade.`,
      tom: "warning",
      filtro: "vencem_hoje",
    };
  }

  if (urgentes.length > 0) {
    return {
      titulo,
      mensagem: `Você tem ${pendentes} ${pluralizar(pendentes, "tarefa pendente", "tarefas pendentes")}, sendo ${urgentes.length} ${pluralizar(urgentes.length, "urgente", "urgentes")}. Nenhuma vence hoje, mas vale antecipar essas entregas.`,
      tom: "urgent",
      filtro: "urgentes",
    };
  }

  return {
    titulo,
    mensagem: `Você tem ${pendentes} ${pluralizar(pendentes, "tarefa pendente", "tarefas pendentes")}. Não há atrasos nem urgências para hoje; siga a ordem planejada.`,
    tom: "normal",
    filtro: "pendentes",
  };
}
