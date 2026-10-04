import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithOxc } from 'vite';
import * as documentWorkspace from '../src/lib/documentWorkspace.js';
import { DOCUMENT_TEMPLATES, valorInicialCampo } from '../src/config/documentTemplates.js';
import { UPDATED_DOCUMENT_MODELS } from '../src/config/updatedDocumentModels.js';

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

const generatorCode = await carregarCodigo('../src/GeradorDocumentos.jsx');
const appCode = (await carregarCodigo('../src/App.jsx')).replaceAll('import.meta.env', 'env');

function ambienteTela(code, componente, props, armazenados = new Map()) {
  const states = [];
  let index = 0;
  let effects = [];
  let consultas = 0;
  const context = vm.createContext({
    ...documentWorkspace, DOCUMENT_TEMPLATES, UPDATED_DOCUMENT_MODELS, valorInicialCampo, React, env: {},
    FormSection: 'FormSection', FormField: 'FormField', FormGrid: 'FormGrid', Input: 'Input', Select: 'Select', Textarea: 'Textarea',
    navigator: { onLine: true }, useRef: value => ({ current: value }),
    pendenciaModeloOriginal: () => '', listarDocumentosProcuracao: () => [], criarOpcoesIniciaisProcuracao: () => ({}),
    ModelLibraryModal: 'ModelLibraryModal', DocumentCategoryIcon: 'DocumentCategoryIcon', DocumentModelIcon: 'DocumentModelIcon', Suspense: 'Suspense',
    window: { ...alvoEventos(), localStorage: { getItem: () => null }, setTimeout() {}, clearTimeout() {}, confirm: () => true },
    localStorage: { getItem: key => armazenados.get(key), setItem: (key, value) => armazenados.set(key, value), removeItem: key => armazenados.delete(key) },
    useState(initial) {
      const id = index++;
      if (!(id in states)) states[id] = typeof initial === 'function' ? initial() : initial;
      return [states[id], value => { states[id] = typeof value === 'function' ? value(states[id]) : value; }];
    },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
    lazy: loader => ({ loader }),
    supabase: { from() { consultas++; return { select: () => Promise.resolve({ data: [], error: null }) }; } },
    props,
  });
  vm.runInContext(code, context);
  return {
    context, armazenados,
    consultas: () => consultas,
    render() {
      index = 0;
      effects = [];
      const tree = vm.runInContext(`${componente}(props)`, context);
      return { tree, effects };
    },
  };
}

function elementos(node) {
  if (Array.isArray(node)) return node.flatMap(elementos);
  if (!node || typeof node !== 'object') return [];
  return [node, ...elementos(node.children)];
}

test('gerador exige categoria e documento antes do formulario', () => {
  const modelo = documentWorkspace.enriquecerModelos(DOCUMENT_TEMPLATES).find(item => item.modo === 'distrato-sem-multa');
  const storage = new Map([[documentWorkspace.DOCUMENT_DRAFT_KEY, JSON.stringify({ schema: 2, salvoEm: new Date().toISOString(), dados: { modeloId: modelo.id, nomeContratante: 'Rascunho' } })], [documentWorkspace.DOCUMENT_HISTORY_KEY, '[{}]']]);
  const selecao = ambienteTela(generatorCode, 'GeradorDocumentos', { usuario: {} }, storage);
  let nodesSelecao = elementos(selecao.render().tree);
  assert.ok(!nodesSelecao.some(node => node.type?.name === 'EditorDocumento'));
  nodesSelecao.find(node => node.type === 'button' && elementos(node).some(child => child.type === 'strong' && child.children.includes('Distratos'))).props.onClick();
  nodesSelecao = elementos(selecao.render().tree);
  assert.ok(!nodesSelecao.some(node => node.type?.name === 'EditorDocumento'));
  nodesSelecao.find(node => node.type === 'button' && elementos(node).some(child => child.type === 'strong' && child.children.includes(modelo.nome))).props.onClick();
  const entrada = selecao.render().tree;
  assert.equal(entrada.type.name, 'EditorDocumento');
  const env = ambienteTela(generatorCode, 'EditorDocumento', entrada.props, storage);
  let pdfCalls = 0;
  env.context.gerarPdfModelo = () => { pdfCalls++; throw new Error('PDF inesperado'); };
  const { tree, effects } = env.render();
  effects.forEach(fn => fn());
  const nodes = elementos(tree);
  assert.ok(nodes.some(node => node.type === 'Select' && node.props.id === 'document-model'));
  assert.ok(nodes.some(node => node.type === 'FormSection' && node.props.as === 'form' && typeof node.props.onSubmit === 'function'));
  assert.ok(!nodes.some(node => node.type === 'iframe' || /Previa|Progresso|Etapas|Assistente/.test(node.type?.name || '')));
  const nome = nodes.find(node => node.type?.name === 'CampoDocumento' && node.props.campo.nome === 'nomeContratante');
  assert.notEqual(nome.props.valor, 'Rascunho');
  nome.props.onChange({ target: { name: 'nomeContratante', type: 'text', value: 'Cliente novo' } });
  env.render().effects.forEach(fn => fn());
  assert.equal(pdfCalls, 0);
  assert.equal(storage.has(documentWorkspace.DOCUMENT_HISTORY_KEY), false);
  assert.equal(storage.has(documentWorkspace.DOCUMENT_DRAFT_KEY), true);
});

test('nao exibe acoes de rascunho e descarta rascunhos vencidos', () => {
  const modelo = documentWorkspace.enriquecerModelos(DOCUMENT_TEMPLATES)[1];
  const chave = documentWorkspace.DOCUMENT_DRAFT_KEY;
  const storage = new Map([[chave, JSON.stringify({ schema: 2, salvoEm: '2020-01-01', dados: { modeloId: modelo.id } })]]);
  const env = ambienteTela(generatorCode, 'EditorDocumento', { modeloInicial: modelo, modelosDaCategoria: [modelo] }, storage);
  const { tree, effects } = env.render();
  assert.ok(!elementos(tree).some(node => node.type === 'button' && node.children.some(text => /Salvar rascunho|Retomar rascunho/.test(text))));
  effects.forEach(fn => fn());
  assert.equal(storage.has(chave), false);
});

test('kit inicial reune exatamente os tres documentos solicitados', () => {
  const env = ambienteTela(generatorCode, 'GeradorDocumentos', {});
  const kit = elementos(env.render().tree).find(node => node.type === 'button' && elementos(node).some(child => child.type === 'strong' && child.children.includes('Kit Processual Inicial')));
  kit.props.onClick();
  const nomes = elementos(env.render().tree).filter(node => node.type === 'strong').map(node => node.children[0]);
  assert.deepEqual(nomes.sort(), ['Procuração Ad Judicia', 'Declaração de Hipossuficiência', 'Declaração de Isenção de Imposto de Renda'].sort());
});

test('biblioteca usa a procuração atualizada e oferece as duas declarações recebidas', () => {
  const env = ambienteTela(generatorCode, 'GeradorDocumentos', { usuario: {} });
  let nodes = elementos(env.render().tree);
  nodes.find(node => node.type === 'button' && elementos(node).some(child => child.type === 'strong' && child.children.includes('Kit Processual Inicial'))).props.onClick();
  nodes = elementos(env.render().tree);
  nodes.find(node => node.type === 'button' && elementos(node).some(child => child.type === 'strong' && child.children.includes('Procuração Ad Judicia'))).props.onClick();
  const procuracao = env.render().tree.props.modeloInicial;
  assert.equal(procuracao.templateDocx, UPDATED_DOCUMENT_MODELS.procuracao.templateDocx);
  assert.equal(procuracao.templateSha256, UPDATED_DOCUMENT_MODELS.procuracao.templateSha256);
  const biblioteca = ambienteTela(generatorCode, 'GeradorDocumentos', { usuario: {} });
  nodes = elementos(biblioteca.render().tree);
  nodes.find(node => node.type === 'button' && elementos(node).some(child => child.type === 'strong' && child.children.includes('Declarações'))).props.onClick();
  nodes = elementos(biblioteca.render().tree);
  for (const modo of ['declaracao-isencao-comprovante-endereco', 'declaracao-ausencia-carteira-trabalho']) {
    const modelo = DOCUMENT_TEMPLATES.find(item => item.modo === modo);
    assert.ok(nodes.some(node => node.type === 'strong' && node.children.includes(modelo.nome)));
  }
});

test('renomear modelo fica disponivel apenas para Tafarel ou administrador', () => {
  const modelo = documentWorkspace.enriquecerModelos(DOCUMENT_TEMPLATES)[0];
  for (const [usuario, permitido] of [[{ nome: 'Tafarel', tipo: 'funcionaria' }, true], [{ nome: 'Outro', tipo: 'admin' }, true], [{ nome: 'Outro', role: 'admin' }, true], [{ nome: 'Outro', tipo: 'funcionaria' }, false], [undefined, false]]) {
    const env = ambienteTela(generatorCode, 'EditorDocumento', { usuario, modeloInicial: modelo, modelosDaCategoria: [modelo] });
    assert.equal(elementos(env.render().tree).some(node => node.type === 'button' && node.children.includes('Renomear modelo')), permitido);
  }
});

test('navegar substitui a tela anterior e voltar ao gerador não conserva o editor', () => {
  const env = ambienteTela(appCode, 'Workspace', { usuario: { id: 'teste', tipo: 'admin', nome: 'Teste' } });
  let tree = env.render().tree;
  const navegar = titulo => {
    elementos(tree).find(node => node.type?.name === 'NavItem' && node.children.includes(titulo)).props.onClick();
    tree = env.render().tree;
  };
  navegar('Clientes');
  assert.ok(elementos(tree).some(node => node.type === vm.runInContext('ClientesModule', env.context)));
  assert.ok(!elementos(tree).some(node => node.type?.name === 'AreaTrabalho'));
  navegar('Gerador de Documentos');
  assert.ok(!elementos(tree).some(node => node.type === vm.runInContext('ClientesModule', env.context)));
  assert.ok(elementos(tree).some(node => node.type === vm.runInContext('GeradorDocumentos', env.context)));
  navegar('Agenda e Atividades');
  assert.ok(!elementos(tree).some(node => node.type === vm.runInContext('GeradorDocumentos', env.context)));
});
