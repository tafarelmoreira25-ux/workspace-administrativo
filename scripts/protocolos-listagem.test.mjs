import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { transformWithOxc } from 'vite';
const source = await readFile(new URL('../src/components/esteira/EsteiraProcessualPlatino.tsx', import.meta.url), 'utf8');
const { code } = await transformWithOxc(source, 'EsteiraProcessualPlatino.tsx', { jsx: { runtime: 'classic' } });
const executable = code.replace(/^import .*;\s*$/gm, '').replace('export default ', '');
function ambiente(pagina = 1, alerta = null) {
  const requests = [], effects = []; let index = 0;
  const initial = ['protocolos', [], true, '', 'Maria', pagina, 0];
  const context = vm.createContext({
    React: { createElement: () => null }, AbortController,
    useState: value => [initial[index++] ?? value, () => {}], useCallback: fn => fn, useEffect: fn => effects.push(fn),
    Pagination: 'Pagination', EsteiraKanban: 'EsteiraKanban', PainelJudicial: 'PainelJudicial',
    supabase: { from(table) {
      const req = { table }; requests.push(req);
      const builder = {
        select(fields) { req.fields = fields; return builder; },
        in(field, values) { req.filter = [field, values]; return builder; }, eq() { return builder; },
        or(filter) { req.search = filter; return builder; }, order() { return builder; },
        range(start, end) { req.range = [start, end]; return builder; },
        limit(limit) { req.limit = limit; return builder; },
        abortSignal() { return Promise.resolve({ data: [], count: 25, error: null }); }
      }; return builder;
    } }
  });
  vm.runInContext(executable, context);
  context.alerta = alerta;
  vm.runInContext('EsteiraProcessualPlatino({ initialView: "protocolos", alerta })', context);
  effects[0]();
  return requests;
}
test('Protocolos busca somente a projeção light e limita dez linhas no banco', () => {
  const [req] = ambiente();
  assert.equal(req.table, 'protocolos_lista');
  assert.equal(req.fields, 'id,nome_cliente,id_crm,banco_reu,etapa,dias_na_etapa,status_principal');
  assert.equal(req.limit, 10);
  assert.deepEqual(req.range, [0, 9]);
  assert.match(req.search, /nome_cliente/);
});
test('Página seguinte consulta outro intervalo de dez, inclusive com filtro de alerta', () => {
  const [req] = ambiente(2, { ids: ['p1', 'p2'], titulo: 'Atrasados' });
  assert.deepEqual(req.range, [10, 19]);
  assert.equal(req.filter[0], 'id');
  assert.deepEqual(req.filter[1], ['p1', 'p2']);
  assert.equal(req.limit, 10);
});
