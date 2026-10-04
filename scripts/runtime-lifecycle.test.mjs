import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithOxc } from 'vite';

async function carregarCodigo(caminho) {
  const source = await readFile(new URL(caminho, import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source, caminho, { jsx: { runtime: 'classic' } });
  return code.replace(/^import .*;\s*$/gm, '')
    .replace(/^export\s*\{[^}]+\};?\s*$/gm, '')
    .replace(/export default /g, '')
    .replaceAll('import.meta.hot', 'hot');
}

const mainCode = await carregarCodigo('../src/main.jsx');
const searchCode = await carregarCodigo('../src/components/gerencial/GlobalSearch.tsx');
const React = { createElement: (type, props, ...children) => ({ type, props, children }) };

function alvoEventos() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(event, handler) { (listeners.get(event) || listeners.set(event, new Set()).get(event)).add(handler); },
    removeEventListener(event, handler) { listeners.get(event)?.delete(handler); },
    emitir(event, value) { listeners.get(event)?.forEach(handler => handler(value)); },
    quantidade() { return [...listeners.values()].reduce((n, handlers) => n + handlers.size, 0); },
  };
}

function ambienteMain() {
  const intervalos = new Map();
  const timeouts = new Map();
  let nextId = 0;
  const window = {
    ...alvoEventos(),
    setInterval(fn) { const id = ++nextId; intervalos.set(id, fn); return id; },
    clearInterval(id) { intervalos.delete(id); },
    setTimeout(fn) { const id = ++nextId; timeouts.set(id, fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    confirm: () => false,
    location: { reload() {} },
  };
  const document = { ...alvoEventos(), visibilityState: 'visible', getElementById: () => ({}) };
  const disposals = [];
  const storage = new Map();
  const context = vm.createContext({
    window, document, React, StrictMode: 'StrictMode', App: 'App',
    createRoot: () => ({ render() {} }),
    __APP_VERSION__: 'baseline', hot: { dispose: fn => disposals.push(fn) },
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    fetch: async () => ({ ok: true, json: async () => ({ version: 'baseline' }) }),
  });
  return { context, window, document, intervalos, timeouts, disposals };
}

test('HMR descarta listeners e timers antes de reinicializar o módulo', () => {
  const env = ambienteMain();
  vm.runInContext(`(() => { ${mainCode} })()`, env.context);
  assert.equal(env.window.quantidade(), 2);
  assert.equal(env.document.quantidade(), 1);
  assert.equal(env.intervalos.size, 1);
  let prevented = false;
  env.window.emitir('vite:preloadError', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(env.timeouts.size, 1);
  env.disposals[0]();
  assert.equal(env.window.quantidade(), 0);
  assert.equal(env.document.quantidade(), 0);
  assert.equal(env.intervalos.size, 0);
  assert.equal(env.timeouts.size, 0);
  vm.runInContext(`(() => { ${mainCode} })()`, env.context);
  assert.equal(env.window.quantidade(), 2);
  assert.equal(env.document.quantidade(), 1);
  assert.equal(env.intervalos.size, 1);
  env.disposals[1]();
});

function ambienteBusca(termo) {
  const states = [termo, termo, [], true];
  const effects = [];
  const requests = [];
  let index = 0;
  const context = vm.createContext({
    React, AbortController, Input: 'input',
    window: { setTimeout() {}, clearTimeout() {} },
    useState() { const id = index++; return [states[id], value => { states[id] = value; }]; },
    useEffect(fn) { effects.push(fn); },
    useMemo: fn => fn(),
    supabase: {
      from(table) {
        let resolve;
        const promise = new Promise(r => { resolve = r; });
        const request = { table, resolve, signal: null };
        requests.push(request);
        const builder = {
          select() { return builder; }, or() { return builder; }, limit() { return builder; },
          abortSignal(signal) { request.signal = signal; return promise; },
        };
        return builder;
      },
    },
  });
  vm.runInContext(`${searchCode}\nGlobalSearch({});`, context);
  return { states, requests, effects };
}

const concluirMicrotarefas = () => new Promise(resolve => setImmediate(resolve));

test('a busca cancela as quatro consultas ao trocar o termo e ignora respostas antigas', async () => {
  const env = ambienteBusca('cliente');
  const dispose = env.effects[1]();
  assert.equal(env.requests.length, 4);
  assert.ok(env.requests.every(request => !request.signal.aborted));
  dispose();
  assert.ok(env.requests.every(request => request.signal.aborted));
  env.requests.forEach(request => request.resolve({ data: [{ id: 'antigo', nome_completo: 'Antigo' }], error: null }));
  await concluirMicrotarefas();
  assert.equal(env.states[2].length, 0);
});

test('apagar o termo encerra o estado de carregamento sem consultar o banco', () => {
  const env = ambienteBusca('a');
  env.effects[1]();
  assert.equal(env.requests.length, 0);
  assert.equal(env.states[2].length, 0);
  assert.equal(env.states[3], false);
});

test('a consulta vigente preserva resultados e tolera falha em uma das fontes', async () => {
  const env = ambienteBusca('cliente');
  const dispose = env.effects[1]();
  env.requests[0].resolve({ data: [{ id: '1', nome_completo: 'Cliente', cpf: '123' }], error: null });
  env.requests[1].resolve({ data: [], error: null });
  env.requests[2].resolve({ data: null, error: { message: 'indisponível' } });
  env.requests[3].resolve({ data: [], error: null });
  await concluirMicrotarefas();
  assert.equal(env.states[2].length, 1);
  assert.equal(env.states[2][0].grupo, 'Clientes');
  assert.equal(env.states[2][0].titulo, 'Cliente');
  assert.equal(env.states[3], false);
  dispose();
});
