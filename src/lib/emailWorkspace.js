export const EMAIL_TEMPLATES = [
  { id: "atualizacao", nome: "Atualização processual" },
  { id: "documentos", nome: "Solicitação de documentos" },
  { id: "audiencia", nome: "Aviso de audiência" },
  { id: "pendencia", nome: "Cobrança de pendência" },
  { id: "retorno", nome: "Retorno de atendimento" },
  { id: "livre", nome: "Mensagem livre" },
];

function saudacao(nome) {
  return nome ? `Prezado(a) ${nome},` : "Prezado(a),";
}

function referenciaProcesso(numero) {
  return numero ? ` referente ao processo nº ${numero}` : "";
}

export function criarRascunhoEmail({ modeloId, cliente, processo }) {
  const nome = cliente?.nome_completo?.trim() || "";
  const numero = processo?.numero_processo?.trim() || "";
  const referencia = referenciaProcesso(numero);
  const assinatura = "Atenciosamente,\nPlatino Assessoria";

  const modelos = {
    atualizacao: {
      assunto: numero ? `Atualização processual — ${numero}` : "Atualização processual",
      corpo: `${saudacao(nome)}\n\nEncaminhamos uma atualização${referencia}.\n\n[Descreva aqui a situação processual atual.]\n\nPermanecemos à disposição para eventuais esclarecimentos.\n\n${assinatura}`,
    },
    documentos: {
      assunto: numero ? `Documentos necessários — processo ${numero}` : "Documentos necessários",
      corpo: `${saudacao(nome)}\n\nPara darmos continuidade${referencia}, precisamos dos seguintes documentos:\n\n• [Documento pendente]\n\nPedimos, por gentileza, que encaminhe os arquivos em resposta a este e-mail.\n\n${assinatura}`,
    },
    audiencia: {
      assunto: numero ? `Audiência — processo ${numero}` : "Informações sobre audiência",
      corpo: `${saudacao(nome)}\n\nInformamos os dados da audiência${referencia}:\n\nData: [preencher]\nHorário: [preencher]\nModalidade/local: [preencher]\n\nOrientações: [preencher]\n\n${assinatura}`,
    },
    pendencia: {
      assunto: numero ? `Pendência — processo ${numero}` : "Pendência de atendimento",
      corpo: `${saudacao(nome)}\n\nIdentificamos uma pendência necessária para prosseguirmos${referencia}:\n\n[Descreva aqui a pendência.]\n\nSolicitamos o retorno assim que possível.\n\n${assinatura}`,
    },
    retorno: {
      assunto: numero ? `Retorno de atendimento — processo ${numero}` : "Retorno de atendimento",
      corpo: `${saudacao(nome)}\n\nEm continuidade ao seu atendimento${referencia}, informamos:\n\n[Descreva aqui o retorno.]\n\n${assinatura}`,
    },
    livre: {
      assunto: numero ? `Processo ${numero}` : "",
      corpo: `${saudacao(nome)}\n\n\n\n${assinatura}`,
    },
  };

  return modelos[modeloId] || modelos.atualizacao;
}

export function criarUrlComposicaoGmail({ destinatario, assunto, corpo }) {
  const parametros = new URLSearchParams({ view: "cm", fs: "1" });
  if (destinatario?.trim()) parametros.set("to", destinatario.trim());
  if (assunto?.trim()) parametros.set("su", assunto.trim());
  if (corpo?.trim()) parametros.set("body", corpo.trim());
  return `https://mail.google.com/mail/?${parametros.toString()}`;
}

export function criarDescricaoHistoricoEmail({ assunto, corpo, tipo = "Rascunho preparado" }) {
  const conteudo = `${tipo}: ${assunto?.trim() || "Sem assunto"}\n\n${corpo?.trim() || "Sem conteúdo"}`;
  return conteudo.slice(0, 12000);
}

export function criarContextoAssistente({ cliente, processo }) {
  return {
    cliente: {
      nome: cliente?.nome_completo || null,
      email: cliente?.email || null,
    },
    processo: processo ? {
      numero: processo.numero_processo || null,
      parte_contraria: processo.reu || processo.banco_reu || null,
      fase: processo.fase_atual || null,
      situacao: processo.situacao || null,
      resultado: processo.resultado || processo.status_judicial || null,
    } : null,
  };
}
