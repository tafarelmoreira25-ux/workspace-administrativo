function normalizar(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function destinoDaNotificacao(notificacao = {}, gestor = false) {
  const tipo = normalizar(notificacao.tipo).replaceAll(" ", "_");
  const texto = normalizar(`${notificacao.titulo || ""} ${notificacao.mensagem || ""}`);

  if (tipo.includes("hunter") || notificacao.referencia_tipo === "prospeccao_hunter") {
    return {
      aba: "hunter",
      secao: "hunter",
      referenciaId: notificacao.referencia_id || null,
    };
  }
  if (tipo.includes("urgencia") || texto.includes("urgencia")) {
    return { aba: gestor ? "urgencias" : "tarefas", secao: "urgencias" };
  }
  if (tipo.includes("feedback") || texto.includes("feedback")) {
    return { aba: gestor ? "equipe" : "feedbacks", secao: "feedbacks" };
  }
  if (tipo.includes("documento") || tipo.includes("pdf")) {
    return { aba: "documentos", secao: "documentos" };
  }
  if (tipo.includes("cliente") && !notificacao.tarefa_id) {
    return { aba: "clientes", secao: "clientes" };
  }
  if (tipo.includes("conclu") || tipo.includes("aprov")) {
    return { aba: gestor ? "historico" : "acompanhamento", secao: "historico", tarefaId: notificacao.tarefa_id || null };
  }
  if (notificacao.tarefa_id || /(tarefa|correcao|devolvid|atencao)/.test(tipo)) {
    return { aba: "tarefas", secao: "tarefas", tarefaId: notificacao.tarefa_id || null };
  }
  return { aba: gestor ? "dashboard" : "inicio", secao: "inicio" };
}
