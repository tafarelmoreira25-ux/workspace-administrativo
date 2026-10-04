// Cache curto de leituras, independente da vida das telas. Nada é persistido.
export function criarCacheConsultas(fetchOriginal, { ttl = 60_000, agora = Date.now } = {}) {
  const respostas = new Map();
  const pendentes = new Map();
  let revisao = 0;
  let bytesSalvos = 0;

  function invalidar() {
    revisao++;
    respostas.clear();
    pendentes.clear();
    bytesSalvos = 0;
  }

  function respostaDe(item) {
    return new Response([204, 205, 304].includes(item.status) ? null : item.bytes.slice(0), { status: item.status, statusText: item.statusText, headers: item.headers });
  }

  function acompanhar(entrada, signal) {
    entrada.consumidores++;
    return new Promise((resolve, reject) => {
      let concluido = false;
      function encerrar() {
        if (concluido) return false;
        concluido = true;
        signal?.removeEventListener('abort', cancelar);
        entrada.consumidores--;
        return true;
      }
      function cancelar() {
        if (!encerrar()) return;
        if (!entrada.consumidores) {
          if (pendentes.get(entrada.chave) === entrada) pendentes.delete(entrada.chave);
          entrada.controller.abort();
        }
        reject(signal.reason || new DOMException('Consulta cancelada', 'AbortError'));
      }
      signal?.addEventListener('abort', cancelar, { once: true });
      entrada.promise.then(item => { if (encerrar()) resolve(respostaDe(item)); }, error => { if (encerrar()) reject(error); });
      if (signal?.aborted) cancelar();
    });
  }

  async function fetchComCache(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const metodo = (init.method || input.method || 'GET').toUpperCase();
    const consulta = url.pathname.startsWith('/rest/v1/') && !url.pathname.includes('/rpc/');
    if (metodo !== 'GET' || !consulta) {
      if (metodo !== 'GET' && url.pathname.startsWith('/rest/v1/')) {
        invalidar();
        try { return await fetchOriginal(input, init); } finally { invalidar(); }
      }
      return fetchOriginal(input, init);
    }
    const signal = init.signal || input.signal;
    if (signal?.aborted) throw signal.reason || new DOMException('Consulta cancelada', 'AbortError');
    // Inclui autorização, Range, Prefer e Accept: usuários/páginas/contagens não se misturam.
    const headers = new Headers(init.headers || input.headers);
    const chave = `${url.href}\n${JSON.stringify([...headers.entries()])}`;
    const salva = respostas.get(chave);
    if (salva && agora() - salva.salvoEm < ttl) return respostaDe(salva);
    if (salva) { bytesSalvos -= salva.bytes.byteLength; respostas.delete(chave); }
    let entrada = pendentes.get(chave);
    if (!entrada) {
      const controller = new AbortController();
      const versao = revisao;
      entrada = { chave, controller, consumidores: 0, promise: null };
      const atual = entrada;
      entrada.promise = Promise.resolve().then(async () => {
        if (controller.signal.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
        const resposta = await fetchOriginal(input, { ...init, signal: controller.signal });
        const item = { bytes: await resposta.arrayBuffer(), status: resposta.status, statusText: resposta.statusText, headers: [...resposta.headers.entries()], salvoEm: agora() };
        if (resposta.ok && versao === revisao && !controller.signal.aborted && item.bytes.byteLength <= 1_000_000) {
          while (respostas.size >= 40 || bytesSalvos + item.bytes.byteLength > 8_000_000) {
            const antiga = respostas.keys().next().value;
            bytesSalvos -= respostas.get(antiga).bytes.byteLength;
            respostas.delete(antiga);
          }
          respostas.set(chave, item);
          bytesSalvos += item.bytes.byteLength;
        }
        return item;
      }).finally(() => { if (pendentes.get(chave) === atual) pendentes.delete(chave); });
      pendentes.set(chave, entrada);
    }
    return acompanhar(entrada, signal);
  }
  return { fetch: fetchComCache, invalidar };
}
