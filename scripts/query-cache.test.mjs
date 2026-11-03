import assert from 'node:assert/strict';
import test from 'node:test';
import { criarCacheConsultas } from '../src/lib/queryCache.js';

const url = 'https://banco.example/rest/v1/clientes?select=id';
const resposta = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json', 'content-range': '0-29/150' } });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('deduplica leituras simultâneas e reaproveita o resultado sem consumir o corpo de outra tela', async () => {
  let chamadas = 0;
  const cache = criarCacheConsultas(async () => { chamadas++; return resposta([{ id: 1 }]); });
  const [a, b] = await Promise.all([cache.fetch(url), cache.fetch(url)]);
  assert.deepEqual(await a.json(), [{ id: 1 }]);
  assert.deepEqual(await b.json(), [{ id: 1 }]);
  const c = await cache.fetch(url);
  assert.equal(c.headers.get('content-range'), '0-29/150');
  assert.deepEqual(await c.json(), [{ id: 1 }]);
  assert.equal(chamadas, 1);
});

test('expiração e atualização explícita voltam ao banco', async () => {
  let tempo = 0;
  let chamadas = 0;
  const cache = criarCacheConsultas(async () => resposta(++chamadas), { agora: () => tempo });
  assert.equal(await (await cache.fetch(url)).json(), 1);
  tempo = 60_000;
  assert.equal(await (await cache.fetch(url)).json(), 2);
  cache.invalidar();
  assert.equal(await (await cache.fetch(url)).json(), 3);
});

test('não mistura autorização, páginas, formato nem contagens', async () => {
  let chamadas = 0;
  const cache = criarCacheConsultas(async () => resposta(++chamadas));
  for (const headers of [{ Authorization: 'A' }, { Authorization: 'B' }, { Authorization: 'A', Range: '30-59' }, { Authorization: 'A', Prefer: 'count=exact' }, { Authorization: 'A', Accept: 'application/vnd.pgrst.object+json' }]) {
    await cache.fetch(url, { headers });
  }
  assert.equal(chamadas, 5);
});

test('salvar invalida leituras e uma resposta anterior à alteração não volta ao cache', async () => {
  let finalizar;
  let chamadas = 0;
  const cache = criarCacheConsultas(async (_input, init) => {
    if (init.method === 'PATCH') return resposta({ ok: true });
    chamadas++;
    if (chamadas === 1) return new Promise(resolve => { finalizar = resolve; });
    return resposta('novo');
  });
  const antiga = cache.fetch(url);
  await tick();
  await cache.fetch(url, { method: 'PATCH' });
  finalizar(resposta('antigo'));
  await antiga;
  assert.equal(await (await cache.fetch(url)).json(), 'novo');
  assert.equal(chamadas, 2);
});

test('cancelar uma tela não cancela a leitura compartilhada por outra', async () => {
  let finalizar;
  let signalRede;
  const cache = criarCacheConsultas(async (_input, init) => {
    signalRede = init.signal;
    return new Promise(resolve => { finalizar = resolve; });
  });
  const controller = new AbortController();
  const a = cache.fetch(url, { signal: controller.signal });
  const b = cache.fetch(url);
  await tick();
  controller.abort();
  await assert.rejects(a, { name: 'AbortError' });
  assert.equal(signalRede.aborted, false);
  finalizar(resposta('ok'));
  assert.equal(await (await b).json(), 'ok');
});

test('sair da última tela cancela a rede e permite nova consulta ao retornar', async () => {
  let chamadas = 0;
  let signalRede;
  const cache = criarCacheConsultas(async (_input, init) => {
    chamadas++;
    if (chamadas > 1) return resposta('nova tela');
    signalRede = init.signal;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Cancelada', 'AbortError'))));
  });
  const controller = new AbortController();
  const leitura = cache.fetch(url, { signal: controller.signal });
  await tick();
  controller.abort();
  await assert.rejects(leitura, { name: 'AbortError' });
  assert.equal(signalRede.aborted, true);
  assert.equal(await (await cache.fetch(url)).json(), 'nova tela');
});

test('falhas, autenticação, storage e RPC não são reaproveitados', async () => {
  let chamadas = 0;
  const cache = criarCacheConsultas(async () => { chamadas++; return new Response('falha', { status: 500 }); });
  for (const endereco of [url, 'https://banco.example/auth/v1/user', 'https://banco.example/storage/v1/object/a', 'https://banco.example/rest/v1/rpc/calcular']) {
    await cache.fetch(endereco);
    await cache.fetch(endereco);
  }
  assert.equal(chamadas, 8);
});

test('limita a memória e não guarda respostas grandes', async () => {
  let chamadas = 0;
  const cache = criarCacheConsultas(async () => { chamadas++; return new Response('a'.repeat(1_000_001)); });
  await cache.fetch(url);
  await cache.fetch(url);
  assert.equal(chamadas, 2);
  const pequeno = criarCacheConsultas(async () => { chamadas++; return resposta('ok'); });
  for (let i = 0; i < 41; i++) await pequeno.fetch(`${url}&id=eq.${i}`);
  await pequeno.fetch(`${url}&id=eq.0`);
  assert.equal(chamadas, 44);
});
