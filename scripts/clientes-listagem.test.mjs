import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithOxc } from 'vite';

const path = '../src/components/clientes/ClientesModule.tsx';
const source = await readFile(new URL(path, import.meta.url), 'utf8');
const { code } = await transformWithOxc(source, path, { jsx: { runtime: 'classic' } });
const executable = code.replace(/^import .*;\s*$/gm, '').replace('export default ', '');
const tick = () => new Promise(resolve => setImmediate(resolve));
const resumo = { id: 'cliente-1', nome_completo: 'Cliente Teste', id_crm: '123', esferas: ['judicial', 'extrajudicial'] };

function elementos(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elementos);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...elementos(tree.children)];
}

function ambiente({ detalhePendente = false, erroDetalhe = null } = {}) {
  const states = [], refs = [], effects = [], requests = [];
  let stateIndex = 0, refIndex = 0;
  let resolverDetalhe;
  const detalhe = { ...resumo, cpf: '12345678900', email: 'contato@example.com', telefone: '11999999999' };
  const context = vm.createContext({
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    AbortController, console,
    window: { setTimeout: () => 1, clearTimeout() {}, alert() {} },
    lazy: () => 'Lazy', Suspense: 'Suspense', Pagination: 'Pagination', DetailWindow: 'DetailWindow',
    FormSection: 'FormSection', FormField: 'FormField', FormGrid: 'FormGrid', FormActions: 'FormActions', Input: 'Input', Textarea: 'Textarea',
    useState(initial) {
      const id = stateIndex++;
      if (!(id in states)) states[id] = typeof initial === 'function' ? initial() : initial;
      return [states[id], value => { states[id] = typeof value === 'function' ? value(states[id]) : value; }];
    },
    useRef(initial) { const id = refIndex++; return refs[id] ||= { current: initial }; },
    useCallback: fn => fn, useMemo: fn => fn(), useEffect: fn => effects.push(fn),
    supabase: {
      rpc(name, args, options) {
        const request = { name, args, options };
        requests.push(request);
        return { abortSignal(signal) { request.signal = signal; return Promise.resolve({ data: { clientes: [resumo], total: 61 }, error: null }); } };
      },
      from(table) {
        const request = { table };
        requests.push(request);
        const resultado = { data: table === 'clientes' ? detalhe : [], error: table === 'clientes' ? erroDetalhe : null };
        const builder = {
          select(fields) { request.fields = fields; return builder; },
          eq(field, value) { request.filter = [field, value]; return builder; },
          order() { return builder; }, limit() { return builder; },
          maybeSingle() { return detalhePendente ? new Promise(resolve => { resolverDetalhe = resolve; }) : Promise.resolve(resultado); },
          then(resolve, reject) { return Promise.resolve(resultado).then(resolve, reject); },
        };
        return builder;
      },
    },
  });
  vm.runInContext(executable, context);
  return {
    requests,
    render() {
      stateIndex = 0; refIndex = 0; effects.length = 0;
      const tree = vm.runInContext('ClientesModule({ usuario: { nome: "Teste" } })', context);
      return { tree, effects: [...effects] };
    },
    resolverDetalhe() { resolverDetalhe({ data: detalhe, error: null }); },
  };
}

async function listar(env) {
  env.render().effects[0]();
  await tick();
  return env.render().tree;
}

test('listagem faz uma RPC enxuta e pagina no servidor sem carregar nenhuma pasta', async () => {
  const env = ambiente();
  let tree = await listar(env);
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].name, 'listar_clientes_resumo');
  assert.equal(JSON.stringify(env.requests[0].args), JSON.stringify({ p_busca: '', p_limit: 10, p_offset: 0 }));
  assert.equal(env.requests[0].options.get, true);
  const headers = elementos(tree).filter(node => node.type === 'th').map(node => node.children[0]);
  assert.deepEqual(headers, ['Nome do Cliente', 'ID CRM', 'Esfera do Processo', 'Ações']);
  assert.ok(!elementos(tree).some(node => node.children.includes('Editar')));
  const pagination = elementos(tree).find(node => node.type === 'Pagination');
  assert.equal(pagination.props.total, 61);
  assert.equal(pagination.props.tamanho, 10);
  pagination.props.onChange(3);
  env.render().effects[0]();
  await tick();
  assert.equal(env.requests[1].args.p_offset, 20);
  tree = env.render().tree;
  const labels = elementos(tree).filter(node => node.type === 'span').flatMap(node => node.children);
  assert.ok(labels.includes('Processo Judicial'));
  assert.ok(labels.includes('Ação Extrajudicial de Revisão'));
});

test('abrir pasta consulta cadastro por ID antes das coleções e só então permite edição', async () => {
  const env = ambiente({ detalhePendente: true });
  const tree = await listar(env);
  const abrir = elementos(tree).find(node => node.type === 'button' && node.children.includes('Abrir Pasta'));
  const carregamento = abrir.props.onClick({ stopPropagation() {} });
  assert.equal(env.requests.length, 2);
  assert.equal(env.requests[1].table, 'clientes');
  assert.equal(JSON.stringify(env.requests[1].filter), JSON.stringify(['id', resumo.id]));
  assert.ok(env.requests[1].fields.includes('cpf'));
  assert.ok(!elementos(env.render().tree).some(node => node.children.includes('Editar cadastro')));
  env.resolverDetalhe();
  await carregamento;
  await tick();
  assert.deepEqual(env.requests.slice(2).map(item => item.table), ['processos', 'documentos_juridicos', 'processual_atendimentos', 'clientes_historico']);
  assert.ok(env.requests.slice(2).every(item => item.filter[0] === 'cliente_id' && item.filter[1] === resumo.id));
  assert.ok(elementos(env.render().tree).some(node => node.children.includes('Editar cadastro')));
});

test('fechar uma pasta pendente impede resposta antiga de reabrir o cliente ou buscar histórico', async () => {
  const env = ambiente({ detalhePendente: true });
  const tree = await listar(env);
  elementos(tree).find(node => node.type === 'button' && node.children.includes('Abrir Pasta')).props.onClick({ stopPropagation() {} });
  elementos(env.render().tree).find(node => node.type === 'button' && node.children.includes('← Voltar para clientes')).props.onClick();
  env.resolverDetalhe();
  await tick();
  assert.equal(env.requests.length, 2);
  assert.ok(!elementos(env.render().tree).some(node => node.props?.role === 'dialog'));
});

test('falha no cadastro mostra erro e não apresenta formulário com dados incompletos', async () => {
  const env = ambiente({ erroDetalhe: { message: 'Falha de rede' } });
  const tree = await listar(env);
  elementos(tree).find(node => node.type === 'button' && node.children.includes('Abrir Pasta')).props.onClick({ stopPropagation() {} });
  await tick();
  const nodes = elementos(env.render().tree);
  assert.equal(env.requests.length, 2);
  assert.ok(nodes.some(node => node.props?.role === 'alert'));
  assert.ok(nodes.some(node => node.children.includes('Tentar novamente')));
  assert.ok(!nodes.some(node => node.children.includes('Editar cadastro')));
});
