import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { aliasTribunal, apenasDigitos, consultarDataJud, DataJudError } from '../supabase/functions/processual-datajud-sync/datajud.ts';

const processo = (segmento, tribunal = null) => ({ numero_processo: `1000000-00.2026.${segmento}.0001`, tribunal });

test('usa o numero CNJ quando o tribunal cadastrado tem descricao ou diverge', () => {
  assert.equal(aliasTribunal(processo('8.13', 'TJMG - Justiça de Primeira Instância')), 'tjmg');
  assert.equal(aliasTribunal(processo('8.26', 'TJSP - 12')), 'tjsp');
  assert.equal(aliasTribunal(processo('8.24', 'TJSP')), 'tjsc');
});

test('corrige os codigos invertidos de MG/MT e AP/AM', () => {
  for (const [codigo, alias] of [['03', 'tjap'], ['04', 'tjam'], ['11', 'tjmt'], ['12', 'tjms'], ['13', 'tjmg']]) {
    assert.equal(aliasTribunal(processo(`8.${codigo}`)), alias);
  }
});

test('identifica regioes, tribunais superiores e siglas eleitorais', () => {
  for (const [segmento, alias] of [['4.01', 'trf1'], ['4.06', 'trf6'], ['5.03', 'trt3'], ['5.00', 'tst'], ['3.00', 'stj'], ['6.00', 'tse'], ['6.13', 'tre-mg'], ['6.07', 'tre-df']]) {
    assert.equal(aliasTribunal(processo(segmento)), alias);
  }
  assert.equal(aliasTribunal(processo('4.07')), '');
  assert.equal(aliasTribunal(processo('5.25')), '');
});

test('normaliza aliases exatos e rejeita descricoes livres no fallback', () => {
  for (const [tribunal, alias] of [['api_publica_trf1', 'trf1'], ['TRF-1', 'trf1'], ['TRT 03', 'trt3'], ['TRE-MG', 'tre-mg'], ['TJMG - Justiça de Primeira Instância', ''], ['TRT SÃO MIGUEL', '']]) {
    assert.equal(aliasTribunal({ numero_processo: null, tribunal }), alias);
  }
});

test('consulta usa endpoint correto, numero sem mascara e chave configurada', async () => {
  const source = { numeroProcesso: '10000000020268130001', movimentos: [] };
  const resultado = await consultarDataJud('tjmg', apenasDigitos(processo('8.13').numero_processo), 'chave-teste', async (url, options) => {
    assert.equal(url, 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search');
    assert.equal(options.headers.Authorization, 'APIKey chave-teste');
    assert.equal(JSON.parse(options.body).query.match.numeroProcesso, source.numeroProcesso);
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ hits: { hits: [{ _source: source }] } });
  });
  assert.deepEqual(resultado, source);
});

test('repete falha transitoria do CNJ e aceita a segunda resposta', async () => {
  let chamadas = 0;
  const source = { numeroProcesso: '10000000020268130001' };
  const resultado = await consultarDataJud('tjmg', source.numeroProcesso, undefined, async () => {
    chamadas++;
    return chamadas === 1 ? new Response('indisponivel', { status: 503 }) : Response.json({ hits: { hits: [{ _source: source }] } });
  });
  assert.equal(chamadas, 2);
  assert.deepEqual(resultado, source);
});

test('erro de autenticacao e endpoint invalido preservam o HTTP do CNJ sem repetir', async () => {
  for (const status of [401, 403, 404]) {
    let chamadas = 0;
    await assert.rejects(consultarDataJud('tjmg', '10000000020268130001', undefined, async () => {
      chamadas++;
      return new Response('erro', { status });
    }), error => error instanceof DataJudError && error.upstreamStatus === status);
    assert.equal(chamadas, 1);
  }
});

test('timeout, desconexao e limite de consultas sao distinguiveis e tem duas tentativas', async () => {
  for (const [falha, esperado] of [
    [() => { throw new DOMException('timeout', 'TimeoutError'); }, 504],
    [() => { throw new TypeError('fetch failed'); }, 503],
    [() => new Response('limite', { status: 429 }), 503],
    [() => new Response('erro', { status: 500 }), 502],
  ]) {
    let chamadas = 0;
    await assert.rejects(consultarDataJud('tjmg', '10000000020268130001', undefined, async () => {
      chamadas++;
      return falha();
    }), error => error instanceof DataJudError && error.status === esperado);
    assert.equal(chamadas, 2);
  }
});

test('processo nao encontrado e resposta invalida nao se confundem', async () => {
  assert.equal(await consultarDataJud('tjmg', '10000000020268130001', undefined, async () => Response.json({ hits: { hits: [] } })), undefined);
  for (const resposta of [Response.json({ error: 'erro' }), new Response('<html>erro</html>')]) {
    await assert.rejects(consultarDataJud('tjmg', '10000000020268130001', undefined, async () => resposta), error => error instanceof DataJudError && error.status === 502);
  }
});

test('Edge Function devolve validacao e falhas do CNJ em JSON com CORS, sem salvar movimentos', async (t) => {
  let handler;
  let cadastro = { id: 'teste', ...processo('8.13', 'TJMG - Justiça de Primeira Instância') };
  const admin = {
    from(tabela) {
      assert.equal(tabela, 'processos');
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: cadastro, error: null }; },
      };
    },
  };
  globalThis.Deno = { env: { get: () => 'teste' }, serve: callback => { handler = callback; } };
  globalThis.__datajudTestAdmin = admin;
  t.after(() => { delete globalThis.Deno; delete globalThis.__datajudTestAdmin; });
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'https://esm.sh/@supabase/supabase-js@2') {
        return { url: 'data:text/javascript,export const createClient = () => globalThis.__datajudTestAdmin;', shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
  try {
    await import('../supabase/functions/processual-datajud-sync/index.ts');
  } finally {
    hooks.deregister();
  }

  const request = () => new Request('https://teste/functions/v1/processual-datajud-sync', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ processo_id: 'teste' }),
  });
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search');
    return new Response('chave recusada', { status: 401 });
  });
  const falha = await handler(request());
  assert.equal(falha.status, 502);
  assert.equal(falha.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal((await falha.json()).status, 401);

  cadastro = { id: 'teste', numero_processo: '123', tribunal: 'TJMG' };
  const invalido = await handler(request());
  assert.equal(invalido.status, 422);
  assert.match((await invalido.json()).erro, /20 digitos/);
  assert.equal(globalThis.fetch.mock.callCount(), 1);

  cadastro = { id: 'teste', ...processo('8.13') };
  globalThis.fetch.mock.mockImplementation(async () => Response.json({ hits: { hits: [] } }));
  const ausente = await handler(request());
  assert.equal(ausente.status, 200);
  assert.equal((await ausente.json()).sincronizado, false);
});
