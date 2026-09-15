import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type EscavadorMovimentacao = {
  id?: number | string;
  processo_id?: number | string;
  tipo?: string;
  conteudo?: string;
  data?: string;
  link?: string;
};

type EscavadorPayload = {
  event?: string;
  monitoramento?: Array<{ processo?: { numero_novo?: string; numero_antigo?: string } }>; 
  movimentacao?: EscavadorMovimentacao;
};

const headers = { "Content-Type": "application/json; charset=utf-8" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function limpar(valor: unknown, limite: number) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function normalizarCnj(valor: unknown) {
  return limpar(valor, 80).replace(/\s+/g, "");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ erro: "Método não permitido." }, 405);

  const token = Deno.env.get("ESCAVADOR_CALLBACK_TOKEN");
  const authorization = request.headers.get("Authorization") || "";
  if (!token || authorization !== token && authorization !== `Bearer ${token}`) {
    return json({ erro: "Callback não autorizado." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ erro: "Ambiente Supabase incompleto." }, 503);

  let payload: EscavadorPayload;
  try { payload = await request.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const movimentacao = payload.movimentacao;
  const externo = movimentacao?.id === undefined ? "" : String(movimentacao.id);
  const cnj = normalizarCnj(payload.monitoramento?.[0]?.processo?.numero_novo || payload.monitoramento?.[0]?.processo?.numero_antigo);
  const descricao = limpar(movimentacao?.conteudo, 50000);
  if (!payload.event || !movimentacao || !externo || !descricao) return json({ erro: "Callback sem evento ou movimentação válida." }, 422);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let processosQuery = admin.from("processos").select("id, numero_processo").limit(1);
  processosQuery = cnj ? processosQuery.eq("numero_processo", cnj) : processosQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  const { data: processos, error: processoError } = await processosQuery;
  if (processoError) return json({ erro: "Falha ao localizar processo." }, 500);
  if (!processos?.[0]) return json({ recebido: true, vinculado: false, motivo: "Processo não localizado." });

  const dataAndamento = movimentacao.data ? new Date(movimentacao.data).toISOString() : new Date().toISOString();
  const registro = {
    processo_id: processos[0].id,
    id_movimento_externo: externo,
    data_andamento: dataAndamento,
    data_registro: dataAndamento,
    descricao,
    titulo: limpar(movimentacao.tipo, 250) || "Movimentação do Escavador",
    tipo: "andamento",
    categoria: "Movimentação processual",
    origem: "escavador",
    fonte: "Escavador",
    link: limpar(movimentacao.link, 1000) || null,
  };
  const { error } = await admin.from("movimentacoes").upsert(registro, { onConflict: "processo_id,id_movimento_externo" });
  if (error) return json({ erro: "Falha ao salvar movimentação." }, 500);
  return json({ recebido: true, vinculado: true, id_movimento_externo: externo });
});
