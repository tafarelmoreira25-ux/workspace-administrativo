export async function mensagemErroFuncao(error: unknown, fallback = "Falha ao consultar o serviço.") {
  const mensagemPadrao = error instanceof Error ? error.message : fallback;
  const response = (error as { context?: unknown } | null)?.context;
  if (!(response instanceof Response)) return mensagemPadrao;

  try {
    const body = await response.clone().json() as { erro?: string; error?: string; message?: string };
    return body.erro || body.error || body.message || mensagemPadrao;
  } catch {
    return mensagemPadrao;
  }
}
