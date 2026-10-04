import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithOxc } from 'vite';

const path = '../src/components/homologacao/HomologacaoQuitacaoModule.tsx';
const source = await readFile(new URL(path, import.meta.url), 'utf8');
const { code } = await transformWithOxc(source, path, { jsx: { runtime: 'classic' } });
const executable = code.replace(/^import .*;\s*$/gm, '').replace('export default ', '');
const tick = () => new Promise(resolve => setImmediate(resolve));
const resumo = id => ({ id, cliente_nome: `Cliente ${id}`, instituicao_financeira: 'Banco', numero_contrato: '123', status: 'Em negociação' });
function elementos(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elementos);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...elementos(tree.children)];
}

function ambiente({ pendente = false, erroDetalhe = false, erroInsercao = false } = {}) {
  const states = [], refs = [], effects = [], requests = [], uploads = [], removed = [], pending = [];
  let stateIndex = 0, refIndex = 0;
  const context = vm.createContext({
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    AbortController, console, crypto: { randomUUID: () => 'arquivo-id' },
    window: { alert() {} }, invalidarConsultas() {},
    FormSection: 'FormSection', FormField: 'FormField', FormGrid: 'FormGrid', FormActions: 'FormActions', Input: 'Input', Select: 'Select', Textarea: 'Textarea',
    useState(initial) {
      const id = stateIndex++;
      if (!(id in states)) states[id] = typeof initial === 'function' ? initial() : initial;
      return [states[id], value => { states[id] = typeof value === 'function' ? value(states[id]) : value; }];
    },
    useRef(initial) { const id = refIndex++; return refs[id] ||= { current: initial }; },
    useCallback: fn => fn, useMemo: fn => fn(), useEffect: fn => effects.push(fn),
    supabase: {
      storage: { from: () => ({
        async upload(path, file) { uploads.push({ path, file }); return { error: null }; },
        async remove(paths) { removed.push(...paths); return { error: null }; },
      }) },
      from(table) {
        const request = { table }; requests.push(request);
        function resultado() {
          if (request.payload) return { data: { id: 'tratativa', ...request.payload }, error: erroInsercao ? { message: 'Falha ao inserir' } : null };
          if (table === 'homologacoes') return { data: request.filter ? resumo(request.filter[1]) : [resumo('a'), resumo('b')], error: request.filter && erroDetalhe ? { message: 'Falha' } : null };
          return { data: table === 'homologacao_quitacoes' ? null : [], error: null };
        }
        const builder = {
          select(fields) { request.fields = fields; return builder; },
          eq(field, value) { request.filter = [field, value]; return builder; },
          order() { return builder; }, limit() { return builder; },
          abortSignal() { return builder; },
          insert(payload) { request.payload = payload; return builder; },
          single() { return builder; }, maybeSingle() { return builder; },
          then(resolve, reject) {
            const promise = pendente && request.filter && !request.payload
              ? new Promise(done => pending.push({ request, done, resultado }))
              : Promise.resolve(resultado());
            return promise.then(resolve, reject);
          },
        };
        return builder;
      },
    },
  });
  vm.runInContext(executable, context);
  return {
    requests, uploads, removed,
    render() {
      stateIndex = 0; refIndex = 0; effects.length = 0;
      const tree = vm.runInContext('HomologacaoQuitacaoModule({ usuario: { nome: "Teste" } })', context);
      return { tree, effects: [...effects] };
    },
    resolver(id) { pending.filter(p => p.request.filter[1] === id).forEach(p => p.done(p.resultado())); },
  };
}
async function listar(env) { env.render().effects[0](); await tick(); return env.render().tree; }
function abrir(tree, id) { elementos(tree).find(n => n.props?.['aria-label'] === `Abrir ficha de Cliente ${id}`).props.onClick(); }
function drawer(tree) { return elementos(tree).find(n => n.props?.className === 'homologacao-drawer'); }
function campo(tree, label) { const node = elementos(tree).find(n => n.type === 'FormField' && elementos(n).some(c => c.type === 'span' && c.children.includes(label))); return elementos(node).find(n => ['Input','Select','Textarea'].includes(n.type)); }

test('lista busca só resumo, sem históricos nem cadastros auxiliares', async () => {
  const env = ambiente(); const tree = await listar(env);
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].fields, 'id, cliente_nome, instituicao_financeira, numero_contrato, status, ultima_movimentacao, updated_at');
  assert.equal(drawer(tree), undefined);
  assert.equal(elementos(tree).filter(n => n.props?.className === 'homologacao-row').length, 2);
});

test('clique busca ficha e coleções apenas por ID; abre na timeline', async () => {
  const env = ambiente(); abrir(await listar(env), 'a'); await tick();
  assert.equal(env.requests.length, 9);
  assert.ok(env.requests.slice(1).every(r => r.filter[1] === 'a'));
  const tree = env.render().tree;
  assert.ok(drawer(tree));
  assert.ok(elementos(tree).some(n => n.type?.name === 'Timeline'));
});

test('fechar e abrir outra ficha ignora respostas atrasadas e não mistura históricos', async () => {
  const env = ambiente({ pendente: true }); const tree = await listar(env);
  abrir(tree, 'a'); await tick();
  drawer(env.render().tree).props.onClose();
  abrir(env.render().tree, 'b'); await tick();
  env.resolver('b'); await tick();
  env.resolver('a'); await tick();
  const ficha = drawer(env.render().tree);
  assert.equal(ficha.props.label, 'Ficha de Cliente b');
  const overview = elementos(ficha).find(n => n.props?.value === 'Em negociação');
  assert.ok(overview);
});

test('erro ao buscar ficha bloqueia ações e permite tentar novamente', async () => {
  const env = ambiente({ erroDetalhe: true }); abrir(await listar(env), 'a'); await tick();
  const tree = env.render().tree;
  assert.ok(elementos(tree).some(n => n.props?.role === 'alert'));
  assert.ok(elementos(tree).find(n => n.children.includes('Registrar Nova Tratativa')).props.disabled);
  assert.ok(!elementos(tree).some(n => n.type?.name === 'Timeline'));
});

test('tratativa guarda valores, desconto, observações e caminhos privados; falha limpa uploads', async () => {
  for (const falha of [false, true]) {
    const env = ambiente({ erroInsercao: falha }); abrir(await listar(env), 'a'); await tick();
    elementos(env.render().tree).find(n => n.children.includes('Registrar Nova Tratativa')).props.onClick();
    const mudar = (label, value) => campo(env.render().tree, label).props.onChange({ target: { value } });
    mudar('Valor Original da Dívida (R$) *', '10000');
    mudar('Valor Atualizado/Ofertado pelo Banco (R$) *', '2500');
    mudar('Observações / Relatório quinzenal *', 'Oferta recebida do banco.');
    campo(env.render().tree, 'Anexos — prints, propostas ou boletos').props.onChange({ target: { files: [{ name: 'proposta.pdf', size: 1024 }] } });
    assert.equal(campo(env.render().tree, '% de Desconto Alcançado').props.value, '75.00%');
    const form = elementos(env.render().tree).find(n => n.type === 'FormSection' && n.props?.onSubmit && elementos(n).some(c => c.type === 'Input' && c.props?.type === 'file'));
    await form.props.onSubmit({ preventDefault() {} });
    const payload = env.requests.find(r => r.payload)?.payload;
    assert.equal(payload.valor_original, 10000); assert.equal(payload.valor_ofertado, 2500);
    assert.equal(payload.percentual_desconto, 75); assert.equal(payload.tipo_contato, 'Banco');
    assert.equal(payload.anexos[0].caminho, 'a/arquivo-id.pdf');
    assert.equal(env.removed.length, falha ? 1 : 0);
    if (falha) assert.ok(elementos(env.render().tree).some(n => n.props?.role === 'alert'));
  }
});
