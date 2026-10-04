import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithOxc } from 'vite';

async function harness(component, props) {
  const path = `../src/components/common/${component}.tsx`;
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { code } = await transformWithOxc(source, path, { jsx: { runtime: 'classic' } });
  const states = [], refs = [], effects = [], listeners = new Map();
  let index = 0, refIndex = 0;
  const context = vm.createContext({
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    createPortal: node => node,
    document: { body: {}, activeElement: null, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    window: { innerWidth: 1200, innerHeight: 900, addEventListener() {}, removeEventListener() {} },
    requestAnimationFrame: fn => fn(), useId: () => 'window-title',
    useState(initial) { const id = index++; if (!(id in states)) states[id] = initial; return [states[id], value => { states[id] = typeof value === 'function' ? value(states[id]) : value; }]; },
    useRef(initial) { const id = refIndex++; return refs[id] ||= { current: initial }; },
    useEffect: fn => effects.push(fn),
  });
  vm.runInContext(code.replace(/^import .*;\s*$/gm, '').replace('export default ', ''), context);
  context.props = props;
  return { refs, listeners, render() { index = 0; refIndex = 0; effects.length = 0; const tree = vm.runInContext(`${component}(props)`, context); effects.forEach(fn => fn()); return tree; } };
}
function nodes(tree) { if (Array.isArray(tree)) return tree.flatMap(nodes); if (!tree || typeof tree !== 'object') return []; return [tree, ...nodes(tree.children)]; }
const find = (tree, label) => nodes(tree).find(n => n.props?.['aria-label'] === label);

test('minimizar preserva conteúdo, restaurar reabre e maximizar alterna tamanho', async () => {
  let closed = 0;
  const env = await harness('DetailWindow', { entityId: 'cliente-1', context: 'clientes', title: 'Ficha', onClose: () => closed++, children: 'Formulário preservado' });
  let tree = env.render();
  find(tree, 'Minimizar').props.onClick(); tree = env.render();
  assert.equal(nodes(tree).find(n => n.type === 'section').props.hidden, true);
  assert.ok(nodes(tree).some(n => n.children?.includes('Formulário preservado')));
  find(tree, 'Restaurar Ficha').props.onClick(); tree = env.render();
  assert.equal(nodes(tree).find(n => n.type === 'section').props.hidden, false);
  find(tree, 'Maximizar').props.onClick(); tree = env.render();
  assert.match(nodes(tree).find(n => n.type === 'section').props.className, /is-maximized/);
  find(tree, 'Restaurar tamanho').props.onClick(); tree = env.render();
  assert.equal(nodes(tree).find(n => n.type === 'section').props.className, 'detail-window');
  find(tree, 'Fechar janela').props.onClick(); assert.equal(closed, 1);
});

test('arraste limita a janela ao viewport e ignora botões do cabeçalho', async () => {
  const env = await harness('DetailWindow', { entityId: 1, context: 'processual', title: 'Processo', onClose() {}, children: 'Dados' });
  let tree = env.render();
  env.refs[0].current = { focus() {}, getBoundingClientRect: () => ({ left: 100, top: 100, width: 1000, height: 700 }) };
  const header = nodes(tree).find(n => n.type === 'header');
  header.props.onPointerDown({ button: 0, target: { closest: () => null }, clientX: 120, clientY: 120, currentTarget: { setPointerCapture() {} }, pointerId: 1 });
  header.props.onPointerMove({ clientX: 5000, clientY: 5000 }); tree = env.render();
  assert.equal(nodes(tree).find(n => n.type === 'section').props.style.transform, 'translate(100px, 100px)');
  header.props.onPointerUp();
  header.props.onPointerDown({ button: 0, target: { closest: () => ({}) } });
  header.props.onPointerMove({ clientX: -5000, clientY: -5000 }); tree = env.render();
  assert.equal(nodes(tree).find(n => n.type === 'section').props.style.transform, 'translate(100px, 100px)');
});

test('menu fecha ao selecionar ação, clicar fora e pressionar Escape', async () => {
  const env = await harness('ActionMenu', { children: 'Opções', className: 'menu' });
  let tree = env.render();
  env.refs[0].current = { contains: target => target === 'inside', querySelector: () => ({ focus() {} }) };
  const open = () => { nodes(tree).find(n => n.type === 'summary').props.onClick({ preventDefault() {} }); tree = env.render(); assert.equal(tree.props.open, true); };
  open(); env.listeners.get('pointerdown')({ target: 'inside' }); tree = env.render(); assert.equal(tree.props.open, true);
  env.listeners.get('pointerdown')({ target: 'outside' }); tree = env.render(); assert.equal(tree.props.open, false);
  open(); nodes(tree).find(n => n.type === 'div').props.onClick({ target: { closest: () => ({}) } }); tree = env.render(); assert.equal(tree.props.open, false);
  open(); tree.props.onKeyDown({ key: 'Escape', stopPropagation() {} }); tree = env.render(); assert.equal(tree.props.open, false);
});
