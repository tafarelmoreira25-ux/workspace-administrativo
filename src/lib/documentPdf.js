// Todos os modelos passam por geração local. Não há conversão por Edge Function.
export async function gerarPdfModelo(dados, modelo) {
  // Recupera os geradores PDF já usados pelo projeto antes do fluxo Microsoft.
  const anteriores = {
    "notificacao-extrajudicial": () => import("./notificacaoExtrajudicialPdf.js").then((m) => m.gerarNotificacaoExtrajudicialPdf(dados)),
    "citacao-judicial": () => import("./citacaoJudicialPdf.js").then((m) => m.gerarCitacaoJudicialPdf(dados)),
    "intimacao-extrajudicial": () => import("./intimacaoExtrajudicialPdf.js").then((m) => m.gerarIntimacaoExtrajudicialPdf(dados)),
    chargeback: () => import("./chargebackPdf.js").then((m) => m.gerarChargebackPdf(dados)),
    "termo-compromisso-pagamento": () => import("./termoCompromissoPagamentoPdf.js").then((m) => m.gerarTermoCompromissoPagamentoPdf(dados)),
    "termo-ciencia-seguranca": () => import("./termoCienciaSegurancaPdf.js").then((m) => m.gerarTermoCienciaSegurancaPdf(dados)),
    "declaracao-ausencia-carteira-trabalho": () => import("./declaracaoAusenciaCarteiraTrabalhoPdf.js").then((m) => m.gerarDeclaracaoAusenciaCarteiraTrabalhoPdf(dados)),
  };
  if (anteriores[modelo.modo]) return anteriores[modelo.modo]();
  if (["recibo-prestacao-servicos", "termo-recompra"].includes(modelo.modo)) {
    const { gerarModeloComplementarPdf } = await import("./modelosComplementaresPdf.js");
    return gerarModeloComplementarPdf(dados, modelo);
  }
  if (modelo.templateDocx) {
    const { gerarWordOficial } = await import("./wordTemplateDocx.js");
    const { gerarPdfDoWordOficial } = await import("./wordModelLocalPdf.js");
    const copiaPreenchida = await gerarWordOficial(dados, modelo);
    return gerarPdfDoWordOficial(copiaPreenchida.bytes, {
      assinaturasEmColunas: modelo.modo === "requerimento-postergacao-parcela",
    });
  }
  // Geradores da versão anterior para modelos sem mapeamento Word utilizável.
  switch (modelo.modo) {
    case "relatorio-atualizacao-processual": {
      const { gerarRelatorioAtualizacaoProcessualPdf } = await import("./relatorioAtualizacaoProcessualPdf.js");
      return gerarRelatorioAtualizacaoProcessualPdf(dados);
    }
    case "contestacao-taxas-email": {
      const { gerarContestacaoTaxasEmailPdf } = await import("./contestacaoTaxasEmailPdf.js");
      return gerarContestacaoTaxasEmailPdf(dados);
    }
    case "termo-ciencia-pagamento": {
      const { gerarTermoCienciaPagamentoPdf } = await import("./termoCienciaPagamentoPdf.js");
      return gerarTermoCienciaPagamentoPdf(dados);
    }
    case "certidao-diligencia":
    case "relatorio-negociacao-homologacao": {
      const { gerarModeloComplementarPdf } = await import("./modelosComplementaresPdf.js");
      return gerarModeloComplementarPdf(dados, modelo);
    }
    default: throw new Error(`Gerador de PDF não configurado para o modelo ${modelo.nome}.`);
  }
}
