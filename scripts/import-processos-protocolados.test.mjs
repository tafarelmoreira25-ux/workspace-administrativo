import test from "node:test";
import assert from "node:assert/strict";
import {
  mapStatusCategory,
  normalizeProcessNumber,
  parseDistributionDate,
  prepareSource,
  samples,
  splitParties,
} from "./import-processos-protocolados.mjs";

test("o relatório seleciona a amostra incompleta sem interromper a finalização da importação", () => {
  const primeiro = { cliente_id: "1", status_categoria: "tramitando", fontes_linhas: [2], incompleto: false };
  const incompleto = { cliente_id: "1", status_categoria: "arquivado", fontes_linhas: [3, 4], incompleto: true };
  const resultado = samples([primeiro, incompleto]);
  assert.equal(resultado.incompleto, incompleto);
  assert.equal(resultado.tramitando, primeiro);
  assert.equal(resultado.arquivado, incompleto);
  assert.equal(resultado.processo_duplicado_na_fonte, incompleto);
  assert.equal(resultado.inicio_da_fonte, primeiro);
  assert.equal(resultado.final_da_fonte, incompleto);
  assert.deepEqual(resultado.cliente_com_multiplos_processos, [primeiro, incompleto]);
  assert.equal(samples([primeiro]).incompleto, null);
  assert.equal(samples([]).incompleto, null);
});

test("normaliza número CNJ sem inventar identificador", () => {
  assert.equal(normalizeProcessNumber(" 4011007-41.2025.8.26.0002. "), "4011007-41.2025.8.26.0002");
  assert.equal(normalizeProcessNumber(""), null);
  assert.equal(normalizeProcessNumber(null), null);
});

test("separa autor e réu somente quando o separador X existe", () => {
  assert.deepEqual(splitParties("André Luiz Jacinto X Banco PAN S/A"), {
    autor: "André Luiz Jacinto",
    reu: "Banco PAN S/A",
  });
  assert.deepEqual(splitParties("Ronaldo Rodrigues de Lima"), {
    autor: "Ronaldo Rodrigues de Lima",
    reu: null,
  });
});

test("converte ausências e status sem completar dados", () => {
  assert.equal(parseDistributionDate("não identificada"), null);
  assert.equal(parseDistributionDate("08/07/2025"), "2025-07-08");
  assert.equal(mapStatusCategory("sentença parcialmente procedente"), "parcialmente_procedente");
  assert.equal(mapStatusCategory("não confirmado na consulta pública"), "nao_confirmado");
});

test("ignora Captura de tela e consolida duplicidade sem perder a última informação", () => {
  const source = {
    rows: [
      { linha: 1, autor_reu: "AUTOR X RÉU", processo: "PROCESSO", distribuido: "DISTRIBUÍDO", status: "STATUS", justica_gratuita: "JUSTIÇA GRATUITA", emenda_inicial: "EMENDA INICIAL", link_rotulo: "LINK", observacoes: "OBSERVAÇÕES" },
      { linha: 2, autor_reu: "Cliente X Banco", processo: "1-1", distribuido: "", status: "TRAMITANDO", justica_gratuita: ".", emenda_inicial: "", link: null, observacoes: null },
      { linha: 3, autor_reu: "Captura de tela", processo: null, distribuido: "", status: "", justica_gratuita: "", emenda_inicial: "", link: null, observacoes: null },
      { linha: 4, autor_reu: "Cliente X Banco", processo: "1-1", distribuido: "", status: "PROCEDENTE", justica_gratuita: "Deferida", emenda_inicial: "", link: null, observacoes: "final" },
    ],
  };
  const result = prepareSource(source);
  assert.equal(result.rows.length, 2);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.expectedUniqueProcesses, 1);
  assert.equal(result.rows[0].status_original, "PROCEDENTE");
  assert.equal(result.rows[0].justica_gratuita, "Deferida");
  assert.equal(result.rows[1].observacoes, "final");
});
