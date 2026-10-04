import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithOxc } from 'vite';
const path = '../src/components/operacional/OperacionalProcessualModule.tsx';
const source = await readFile(new URL(path, import.meta.url), 'utf8');
const { code } = await transformWithOxc(source, path, { jsx: { runtime: 'classic' } });
const executable = code.replace(/^import .*;\s*$/gm, '').replace('export default ', '');
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.children)] : []; }
function setup(error = false) {
  const states = [], effects = [], calls = []; let cursor = 0;
  const context = vm.createContext({
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    Date, Intl, AbortController, window: { confirm: () => false },
    FormSection: 'FormSection', FormField: 'FormField', FormGrid: 'FormGrid', Input: 'Input', Select: 'Select', Textarea: 'Textarea', Pagination: 'Pagination', GerencialProcessualModule: 'Gerencial', invalidarConsultas() {},
    useState(initial) { const id = cursor++; if (!(id in states)) states[id] = typeof initial === 'function' ? initial() : initial; return [states[id], value => { states[id] = typeof value === 'function' ? value(states[id]) : value; }]; },
    useMemo: fn => fn(), useCallback: fn => fn, useEffect: fn => effects.push(fn),
    supabase: { rpc(name) { calls.push(name); return { abortSignal: async () => ({ data: records, error }) }; }, from(name) { calls.push(name); const b = { select: () => b, order: () => b, limit: () => b, abortSignal: async () => ({ data: [] }) }; return b; } },
  });
  const today = new Date(); const date = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
  const task = (id, extra = {}) => ({ id, titulo: id, data: date(today), horario: '10:00', tipo: 'Reunião', status: 'Pendente', cliente_nome: 'Cliente', ...extra });
  const records = [
    { origem: 'tarefa', registro: task('meeting') },
    { origem: 'tarefa', registro: task('deadline', { tipo:'Prazo processual',horario:'08:00' }) },
    { origem: 'tarefa', registro: task('completed', { status:'Concluída' }) },
    { origem: 'tarefa', registro: task('late', { data:date(yesterday) }) },
    { origem: 'atendimento', registro: { id:'contact',tipo:'Contato',data:date(today),hora:'09:00',cliente_nome:'Cliente',descricao:'Contato de hoje' } },
    { origem: 'ocorrencia', registro: { id:'incident',categoria:'Pendência',data:date(yesterday),prazo:date(today),descricao:'Documento pendente',resolvido:false } },
  ];
  vm.runInContext(executable, context);
  function render() { cursor = 0; effects.length = 0; return vm.runInContext('OperacionalProcessualModule({usuario: {nome:"Operador"}})',context); }
  return { render, effects, calls, today:date(today) };
}
async function loaded(error) { const env = setup(error); env.render(); for (const effect of [...env.effects]) effect(); await new Promise(r => setImmediate(r)); return env; }
test('consulta consolidada reúne tipos e ordena horário sem mostrar tarefas encerradas', async () => {
  const env = await loaded(); const tree = env.render();
  assert.deepEqual(env.calls, ['agenda_atividades_consolidada','processos']);
  const events = nodes(tree).filter(n => n.props?.className === 'agenda-event');
  assert.deepEqual(events.map(e => e.props.key), ['tarefa-deadline','atendimento-contact','tarefa-meeting','ocorrencia-incident']);
  const late = nodes(tree).find(n => n.type === 'article' && n.props?.key === 'late'); assert.ok(late);
});
test('dropdown filtra a timeline e mantém atrasos visíveis', async () => {
  const env = await loaded(); const tree = env.render();
  nodes(tree).find(n => n.props?.['aria-label'] === 'Filtrar por tipo').props.onChange({target:{value:'Prazo judicial'}});
  const next = nodes(env.render()); assert.deepEqual(next.filter(n => n.props?.className === 'agenda-event').map(n => n.props.key),['tarefa-deadline']);
  assert.ok(next.find(n => n.type === 'article' && n.props?.key === 'late'));
});
test('mini calendário mantém marcadores ao selecionar um dia e permite limpar seleção', async () => {
  const env = await loaded(); let tree = env.render(); let calendar = nodes(tree).find(n => typeof n.type === 'function' && n.type.name === 'MiniCalendario');
  calendar.props.onDia(env.today); calendar = nodes(env.render()).find(n => typeof n.type === 'function' && n.type.name === 'MiniCalendario');
  const rendered = calendar.type(calendar.props); assert.ok(nodes(rendered).find(n => n.props?.['aria-current'] === 'date' && n.props['aria-pressed']));
  nodes(rendered).find(n => n.props?.['aria-current'] === 'date').props.onClick();
  calendar = nodes(env.render()).find(n => typeof n.type === 'function' && n.type.name === 'MiniCalendario'); assert.equal(calendar.props.dia,'');
});
test('falha de RPC mostra erro e não apresenta dados vazios como sucesso', async () => { const env = await loaded(true); const n = nodes(env.render()); assert.ok(n.find(x => x.props?.className === 'empty-row')); assert.ok(!n.find(x => x.props?.className === 'agenda-dashboard')); });
