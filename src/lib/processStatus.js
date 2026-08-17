export const STATUS_DOCUMENTOS_PROCESSUAIS = [
  { valor: "pendente_conferencia", rotulo: "Pendente conferência" },
  { valor: "corretos", rotulo: "Documentos corretos" },
  { valor: "incorretos", rotulo: "Documentos incorretos" },
  { valor: "irregulares", rotulo: "Documentos irregulares" },
];

export const STATUS_PROCURACOES_PROCESSUAIS = [
  { valor: "pendente", rotulo: "Pendente procuração" },
  { valor: "encaminhada", rotulo: "Procuração encaminhada" },
  { valor: "pendente_assinatura", rotulo: "Pendente assinatura" },
  { valor: "nao_aplicavel", rotulo: "Não se aplica" },
];

export const STATUS_PROTOCOLOS_PROCESSUAIS = [
  { valor: "pendente", rotulo: "Pendente", tom: "pending" },
  { valor: "em_geracao", rotulo: "Protocolo em geração", tom: "progress" },
  { valor: "protocolado", rotulo: "Protocolado", tom: "success" },
  { valor: "pasta_retornou", rotulo: "Pasta retornou", tom: "danger" },
];

export function obterOpcaoStatus(opcoes, valor) {
  return opcoes.find((opcao) => opcao.valor === valor) || {
    valor,
    rotulo: valor || "Não informado",
    tom: "neutral",
  };
}

export function validarStatusProcessual(formulario) {
  if (!formulario?.cliente?.id) return "Selecione o cliente e a pasta do Google Drive.";
  if (!STATUS_DOCUMENTOS_PROCESSUAIS.some((item) => item.valor === formulario.statusDocumentos)) {
    return "Selecione a situação dos documentos.";
  }
  if (!STATUS_PROCURACOES_PROCESSUAIS.some((item) => item.valor === formulario.statusProcuracao)) {
    return "Selecione a situação da procuração.";
  }
  if (!STATUS_PROTOCOLOS_PROCESSUAIS.some((item) => item.valor === formulario.statusProtocolo)) {
    return "Selecione o status do protocolo.";
  }
  if (formulario.statusProtocolo === "protocolado" && !formulario.numeroProcesso?.trim()) {
    return "Informe o número do processo para marcar como Protocolado.";
  }
  return null;
}

export function situacaoPrazoProcessual(prazo, hoje = new Date()) {
  if (!prazo) return null;
  const dataPrazo = new Date(`${String(prazo).slice(0, 10)}T12:00:00`);
  const dataHoje = new Date(hoje);
  dataHoje.setHours(12, 0, 0, 0);
  if (Number.isNaN(dataPrazo.getTime()) || Number.isNaN(dataHoje.getTime())) return null;
  const dias = Math.round((dataPrazo - dataHoje) / 86_400_000);
  if (dias < 0) return { dias, rotulo: `Prazo vencido há ${Math.abs(dias)} dia(s)`, vencido: true };
  if (dias === 0) return { dias, rotulo: "Prazo termina hoje", vencido: false };
  return { dias, rotulo: `${dias} dia(s) restante(s)`, vencido: false };
}

export function calcularMetricasStatusProcessual(registros = []) {
  return {
    total: registros.length,
    protocolados: registros.filter((item) => item.status_protocolo === "protocolado").length,
    pendentes: registros.filter((item) => item.status_protocolo === "pendente").length,
    emGeracao: registros.filter((item) => item.status_protocolo === "em_geracao").length,
    pastasRetornadas: registros.filter((item) => item.status_protocolo === "pasta_retornou").length,
  };
}
