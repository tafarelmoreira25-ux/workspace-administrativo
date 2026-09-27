import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Processo = { id: string; numero_processo: string | null; tribunal: string | null };
type DataJudMovimento = { codigo?: number | string; nome?: string; dataHora?: string };
type DataJudSource = {
  numeroProcesso?: string;
  tribunal?: string;
  classe?: { nome?: string };
  orgaoJulgador?: { nome?: string };
  dataHoraUltimaAtualizacao?: string;
  movimentos?: DataJudMovimento[];
};

const DATAJUD_PUBLIC_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const estaduais: Record<string, string> = {
  "01": "tjac", "02": "tjal", "03": "tjam", "04": "tjap", "05": "tjba", "06": "tjce",
  "07": "tjdft", "08": "tjes", "09": "tjgo", "10": "tjma", "11": "tjmg", "12": "tjms",
  "13": "tjmt", "14": "tjpa", "15": "tjpb", "16": "tjpe", "17": "tjpi", "18": "tjpr",
  "19": "tjrj", "20": "tjrn", "21": "tjrs", "22": "tjro", "23": "tjrr", "24": "tjsc",
  "25": "tjse", "26": "tjsp", "27": "tjto",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function limpar(valor: unknown, limite = 120) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function apenasDigitos(valor: unknown) {
  return limpar(valor, 80).replace(/\D/g, "");
}

function aliasTribunal(processo: Processo) {
  const tribunal = limpar(processo.tribunal, 40).toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (tribunal.startsWith("api_publica_")) return tribunal.replace("api_publica_", "");
  if (/^(tj|trf|trt|tre-|tst|tse|stj|stm)/.test(tribunal)) return tribunal;

  const cnj = apenasDigitos(processo.numero_processo);
  if (cnj.length !== 20) return "";
  const ramo = cnj.slice(13, 14);
  const codigo = cnj.slice(14, 16);
  if (ramo === "8") return estaduais[codigo] || "";
  if (ramo === "4") return `trf${Number(codigo)}`;
  if (ramo === "5") return `trt${Number(codigo)}`;
  if (ramo === "6") return codigo === "00" ? "tse" : `tre-${codigo}`;
  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ erro: "Metodo nao permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ erro: "Ambiente Supabase incompleto." }, 503);

  let body: { processo_id?: string };
  try { body = await request.json(); } catch { return json({ erro: "JSON invalido." }, 400); }
  if (!body.processo_id) return json({ erro: "Informe processo_id." }, 422);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: processo, error: processoError } = await admin
    .from("processos")
    .select("id, numero_processo, tribunal")
    .eq("id", body.processo_id)
    .maybeSingle<Processo>();
  if (processoError) return json({ erro: "Falha ao localizar processo." }, 500);
  if (!processo?.numero_processo) return json({ erro: "Processo sem numero CNJ." }, 422);

  const alias = aliasTribunal(processo);
  if (!alias) return json({ erro: "Nao foi possivel identificar o tribunal para consulta no DataJud." }, 422);

  const resposta = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, {
    method: "POST",
    headers: { Authorization: `APIKey ${DATAJUD_PUBLIC_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ size: 1, query: { match: { numeroProcesso: apenasDigitos(processo.numero_processo) } } }),
  });
  if (!resposta.ok) return json({ erro: "Falha na consulta ao DataJud.", status: resposta.status, tribunal: alias }, 502);

  const data = await resposta.json();
  const source = data?.hits?.hits?.[0]?._source as DataJudSource | undefined;
  if (!source) return json({ sincronizado: false, tribunal: alias, movimentos: 0, motivo: "Processo nao encontrado no DataJud." });

  const movimentos = (source.movimentos || []).slice(-80).map((movimento) => {
    const dataAndamento = movimento.dataHora ? new Date(movimento.dataHora).toISOString() : new Date().toISOString();
    const titulo = limpar(movimento.nome, 250) || "Movimentacao DataJud";
    return {
      processo_id: processo.id,
      id_movimento_externo: `datajud:${alias}:${source.numeroProcesso}:${movimento.codigo || titulo}:${dataAndamento}`,
      data_andamento: dataAndamento,
      data_registro: dataAndamento,
      descricao: titulo,
      titulo,
      tipo: "andamento",
      categoria: "Movimentacao processual",
      origem: "datajud",
      fonte: `DataJud/CNJ - ${source.tribunal || alias.toUpperCase()}`,
    };
  });

  let movimentosImportados = 0;
  if (movimentos.length) {
    const idsExternos = movimentos.map((movimento) => movimento.id_movimento_externo);
    const { data: existentes, error: consultaError } = await admin
      .from("movimentacoes")
      .select("id_movimento_externo")
      .eq("processo_id", processo.id)
      .in("id_movimento_externo", idsExternos);
    if (consultaError) return json({ erro: "Falha ao verificar movimentacoes existentes do DataJud.", detalhe: consultaError.message }, 500);

    const idsExistentes = new Set((existentes || []).map((item) => item.id_movimento_externo));
    const novosMovimentos = movimentos.filter((movimento) => !idsExistentes.has(movimento.id_movimento_externo));
    if (novosMovimentos.length) {
      const { error } = await admin.from("movimentacoes").insert(novosMovimentos);
      if (error) return json({ erro: "Falha ao salvar movimentacoes do DataJud.", detalhe: error.message }, 500);
      movimentosImportados = novosMovimentos.length;
    }
  }

  // O DataJud complementa o cadastro, mas nao substitui o resumo produzido pela equipe.
  await admin.from("processos").update({
    tribunal: processo.tribunal || source.tribunal || alias.toUpperCase(),
    tipo_acao: source.classe?.nome || undefined,
    vara: source.orgaoJulgador?.nome || undefined,
  }).eq("id", processo.id);

  return json({ sincronizado: true, tribunal: alias, movimentos: movimentosImportados, movimentosConsultados: movimentos.length });
});
