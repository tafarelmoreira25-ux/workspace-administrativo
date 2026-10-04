import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarRelatorioAcompanhamento, textoWhatsApp } from './acompanhamentoReport.js';

test('relatório usa cadastro ativo, status da carteira e últimas três movimentações sem tarefas', () => {
  const timeline = [1, 4, 2, 3].map((n) => ({ data: `2026-09-0${n}T12:00:00Z`, titulo: `Evento ${n}`, movimentacao: { resumo_cliente: `Resumo ${n}` }, descricao: 'Descrição técnica' }));
  timeline.push({ data: '2026-09-09', titulo: 'Tarefa', tarefa: {} });
  const report = montarRelatorioAcompanhamento({ cliente: { nome_completo: 'Cliente ativo', cpf: '123' }, processo: { nome_cliente: 'Nome antigo', situacao: 'Tramitando', numero_processo: '000123', valor_causa: 0 }, timeline, agora: new Date('2026-09-10T12:00:00Z') });
  assert.match(report, /Cliente ativo/);
  assert.match(report, /Status: Tramitando/);
  assert.match(report, /Dias sem atualização: 6/);
  assert.ok(report.indexOf('Evento 4') < report.indexOf('Evento 3'));
  assert.ok(report.indexOf('Evento 3') < report.indexOf('Evento 2'));
  assert.doesNotMatch(report, /Evento 1|Tarefa|Descrição técnica|Nome antigo/);
  assert.match(report, /R\$\s*0,00/);
  assert.equal(timeline[0].titulo, 'Evento 1');
});

test('extrajudicial usa protocolo e não inventa dados ausentes', () => {
  const report = montarRelatorioAcompanhamento({ esfera: 'Extrajudicial', processo: { protocolo_extrajudicial: '42/2026' } });
  assert.match(report, /2\. Dados do Protocolo/);
  assert.match(report, /Protocolo: 42\/2026/);
  assert.match(report, /Dias sem atualização: Não informado/);
  assert.match(report, /Nenhuma movimentação registrada/);
  assert.match(textoWhatsApp(report), /\*1\. Identificação do Cliente\*/);
});
