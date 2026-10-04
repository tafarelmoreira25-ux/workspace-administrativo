import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parseSource, sync } from './sync-processual.mjs';

test('anexo: continuações, aspas, acentos, números e pendências', async () => {
  const text = await fs.readFile(new URL('../data/sync-processual-fonte.txt', import.meta.url), 'utf8');
  const items = parseSource(text);
  assert.equal(items.length, 344);
  assert.equal(items.filter(i => !i.processo).length, 7);
  assert.equal(items[0].nome, 'André Luiz Jacinto');
  assert.equal(items[2].nome, 'Gustavo Henrique Barbosa');
  assert.equal(items[10].processo, '4011007-41.2025.8.26.0002');
  assert.equal(items.filter(i => i.nome === 'Thiago Vieira do Nascimento').length, 1);
  assert.equal(items.at(-1).nome, 'Jessyanne Cezario Merci');
});

test('logs e totais: pula existente, cria ausente, sinaliza erro e pendência', async () => {
  const results = [{ data: { acao: 'pulado' } }, { data: { acao: 'criado' } }, { error: { message: 'falha' } }];
  const calls = [];
  const client = { rpc: async (...args) => { calls.push(args); return results.shift(); } };
  const totals = await sync(client, [
    { nome: 'A', processo: '1', reu: null }, { nome: 'B', processo: '2', reu: null },
    { nome: 'C', processo: null }, { nome: 'D', processo: '3', reu: null },
  ], false, () => {});
  assert.deepEqual(totals, { criados: 1, pulados: 1, pendentes: 1, erros: 1, previstos: 0 });
  assert.equal(calls.length, 3);
  assert.equal(calls[0][1].p_simular, false);
});

test('simulação passa flag e nunca relata criação', async () => {
  const client = { rpc: async (_name, args) => {
    assert.equal(args.p_simular, true);
    return { data: { acao: 'previsto' } };
  } };
  const totals = await sync(client, [{ nome: 'A', processo: '1', reu: null }], true, () => {});
  assert.equal(totals.criados, 0);
  assert.equal(totals.previstos, 1);
});
