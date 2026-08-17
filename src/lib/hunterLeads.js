export const STATUS_PROSPECCAO_HUNTER = Object.freeze({
  em_organizacao: "Em organização",
  delegada: "Aguardando consultor",
  em_tratativa: "Em tratativa",
  concluida: "Concluída",
});

export const RESULTADOS_PROSPECCAO_HUNTER = Object.freeze({
  realizou_pagamento: "Realizou pagamento",
  nao_realizou_pagamento: "Não realizou pagamento",
});

export function validarProspecaoHunter(formulario, delegar = false) {
  if (!formulario?.nomeCliente?.trim()) return "Informe o nome do cliente.";
  if (!formulario?.whatsapp?.trim()) return "Informe o número de WhatsApp.";
  if (!formulario?.documentoSugerido?.trim()) return "Informe o documento ou serviço sugerido.";
  if (!formulario?.analiseBreve?.trim()) return "Registre uma análise breve do perfil do cliente.";
  if (formulario?.clienteComProcesso) {
    if (!formulario?.numeroProcesso?.trim()) return "Informe o número do processo judicial.";
    if (!formulario?.situacaoProcesso?.trim()) return "Informe a situação atual do processo.";
  }
  if (delegar && !formulario?.consultorId) return "Escolha o consultor que receberá o perfil.";
  return null;
}

export function validarConclusaoProspecao(resultado, motivo) {
  if (!resultado) return "Selecione o resultado da tratativa.";
  if (resultado === "nao_realizou_pagamento" && String(motivo || "").trim().length < 5) {
    return "Informe o motivo de o cliente não ter realizado o pagamento.";
  }
  return null;
}

export function calcularMetricasHunter(registros = []) {
  const concluidos = registros.filter((registro) => registro.status === "concluida");
  const positivos = concluidos.filter(
    (registro) => registro.resultado === "realizou_pagamento",
  ).length;
  const negativos = concluidos.filter(
    (registro) => registro.resultado === "nao_realizou_pagamento",
  ).length;
  const pendentes = registros.filter((registro) => registro.status !== "concluida").length;

  return {
    total: registros.length,
    pendentes,
    concluidos: concluidos.length,
    positivos,
    negativos,
    conversao: concluidos.length
      ? Math.round((positivos / concluidos.length) * 100)
      : 0,
  };
}
