import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { gerarDocumentoContratualPdf } from "./documentosContratuaisPdf.js";

const modos = [
  "distrato-com-multa", "distrato-sem-multa", "distrato-7-dias-estorno-total",
  "distrato-com-devolucao", "distrato-sem-devolucao", "distrato-inexecucao-ausencia-resposta",
  "termo-ciencia-consentimento-contratacao", "termo-consentimento-compras-2026",
  "termo-pagamento-cartao-terceiro", "termo-reconhecimento-recompra",
  "termo-responsabilidade-parcelas-atraso",
];

const dados = {
  nomeContratante: "JOÃO CONTRATANTE COM NOME EXTENSO", cpfContratante: "555.666.777-88",
  enderecoContratante: "Avenida Muito Longa, 12345, São Paulo/SP, CEP 00000-000",
  dataContrato: "2026-09-30", dataEmissao: "2026-09-30", valorContrato: "12.345,67",
  valorContratoExtenso: "doze mil trezentos e quarenta e cinco reais", quantidadeParcelas: "12",
  quantidadeParcelasExtenso: "doze", valorParcela: "1.028,81", valorParcelaExtenso: "mil e vinte e oito reais",
  valorPago: "8.000,00", valorPagoExtenso: "oito mil reais", valorServicosPrestados: "4.000,00",
  saldoRestituir: "4.000,00", dataRestituicao: "2026-10-30", formaRestituicao: "PIX",
  valorMulta: "2.469,13", valorMultaExtenso: "dois mil reais", valorQuitacao: "3.000,00",
  valorQuitacaoExtenso: "três mil reais", dataDesistencia: "2026-09-30",
  dataAssinaturaOuRecebimento: "2026-09-28", canalContratacao: "plataforma eletrônica",
  valorTotalPago: "12.345,67", valorTotalPagoExtenso: "doze mil reais", meioAcordadoRestituicao: "PIX",
  titularDadosRestituicao: "MARIA BENEFICIÁRIA, CPF 111.222.333-44", valorDevolucao: "7.000,00",
  valorDevolucaoExtenso: "sete mil reais", dataDevolucao: "2026-10-15", formaDevolucao: "transferência",
  nomeBeneficiarioRestituicao: "MARIA BENEFICIÁRIA", cpfBeneficiarioRestituicao: "111.222.333-44",
  dadosBancariosRestituicao: "Banco 001, agência 1234, conta 56789-0",
  identificacaoPrestacaoContas: "Relatório detalhado", descricaoValoresServicos: "Análise e notificações",
  nomeTitularCartao: "MARIA TITULAR DO CARTÃO", cpfTitularCartao: "222.333.444-55",
  numeroCartaoMascarado: "9876 **** **** 4321", valorPagamento: "9.000,00",
  codigoTransacao: "TRANSACAO-2026", dataDocumento: "2026-09-30", valorRecompra: "9.000,00",
  valorRecompraExtenso: "nove mil reais", formaPagamento: "cartão em doze parcelas",
  localEmissao: "São Paulo/SP", nomeCliente: "CLIENTE COM NOME MUITO EXTENSO", rg: "12.345.678-9",
  cpfCnpj: "999.888.777-66", logradouro: "Avenida Muito Longa", numeroEndereco: "12345",
  bairro: "Bairro Extenso", cidadeEstado: "São Paulo/SP",
};

test("gera todos os distratos e termos reconstruídos em PDF", async () => {
  for (const modo of modos) {
    const bytes = await gerarDocumentoContratualPdf(dados, { modo, nome: modo });
    assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), "%PDF", modo);
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() >= 1, modo);
  }
});
