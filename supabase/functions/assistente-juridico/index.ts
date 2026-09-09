import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Acao = "revisar_email" | "resumir_email" | "analisar_conteudo";
type RequisicaoAssistente = {
  acao?: Acao;
  assunto?: string;
  conteudo?: string;
  contexto?: unknown;
  arquivo?: { nome?: string; mimeType?: string; base64?: string };
};

function respostaJson(conteudo: unknown, status = 200) {
  return new Response(JSON.stringify(conteudo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function limitarTexto(valor: unknown, limite: number) {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

function extrairJson(texto: string) {
  const limpo = texto.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(limpo);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respostaJson({ erro: "Método não permitido." }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return respostaJson({ erro: "Sessão não autenticada." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return respostaJson({ erro: "Ambiente Supabase incompleto." }, 503);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: usuario, error: erroUsuario } = await supabase.auth.getUser();
  if (erroUsuario || !usuario.user) return respostaJson({ erro: "Sessão inválida ou expirada." }, 401);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
  if (!apiKey) return respostaJson({ erro: "Gemini não configurado no backend." }, 503);

  let payload: RequisicaoAssistente;
  try {
    payload = await request.json();
  } catch {
    return respostaJson({ erro: "Corpo da requisição inválido." }, 400);
  }

  const acao = payload.acao;
  const assunto = limitarTexto(payload.assunto, 500);
  const conteudo = limitarTexto(payload.conteudo, 30000);
  const contexto = JSON.stringify(payload.contexto || {}).slice(0, 10000);
  if (!acao || !["revisar_email", "resumir_email", "analisar_conteudo"].includes(acao)) return respostaJson({ erro: "Ação inválida." }, 400);
  const arquivoBase64 = limitarTexto(payload.arquivo?.base64, 12000000);
  const arquivoMime = limitarTexto(payload.arquivo?.mimeType, 100);
  const arquivoNome = limitarTexto(payload.arquivo?.nome, 300);
  if (!conteudo && !arquivoBase64) return respostaJson({ erro: "Conteúdo não informado." }, 400);
  if (arquivoBase64 && arquivoMime !== "application/pdf") return respostaJson({ erro: "Somente arquivos PDF são aceitos." }, 400);

  const instrucoes = acao === "revisar_email"
    ? "Revise o e-mail em português brasileiro. Preserve rigorosamente fatos, nomes, datas e números. Não invente informações, não prometa resultados e não apresente conclusão jurídica nova. Mantenha marcadores entre colchetes quando houver dados pendentes. Use linguagem profissional, clara e acolhedora. Retorne somente JSON com as chaves assunto e conteudo."
    : "Analise o e-mail ou documento em português brasileiro para registro interno. Não invente informações nem faça conclusão jurídica nova. Separe fatos informados, pedido, dados identificáveis, pendências, eventual prazo literalmente mencionado e alertas de conferência. Se um dado não existir, use null. Retorne somente o JSON solicitado.";

  const esquema = acao === "revisar_email"
    ? {
        type: "OBJECT",
        properties: { assunto: { type: "STRING" }, conteudo: { type: "STRING" } },
        required: ["assunto", "conteudo"],
      }
    : {
        type: "OBJECT",
        properties: {
          resumo: { type: "STRING" },
          pedido: { type: "STRING", nullable: true },
          dados_extraidos: { type: "ARRAY", items: { type: "STRING" } },
          pendencias: { type: "ARRAY", items: { type: "STRING" } },
          prazo_mencionado: { type: "STRING", nullable: true },
          alertas: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["resumo", "pedido", "dados_extraidos", "pendencias", "prazo_mencionado", "alertas"],
      };

  const prompt = [
    `Contexto cadastral (pode conter campos nulos): ${contexto}`,
    assunto ? `Assunto atual: ${assunto}` : "",
    arquivoNome ? `Arquivo analisado: ${arquivoNome}` : "",
    conteudo ? `Conteúdo:\n${conteudo}` : "",
  ].filter(Boolean).join("\n\n");

  const partes: Array<Record<string, unknown>> = [{ text: prompt }];
  if (arquivoBase64) partes.push({ inlineData: { mimeType: arquivoMime, data: arquivoBase64 } });

  try {
    const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instrucoes }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: esquema, maxOutputTokens: 4096 },
      }),
    });

    const resultado = await resposta.json();
    if (!resposta.ok) {
      const mensagem = resultado?.error?.message || "Falha ao consultar o Gemini.";
      return respostaJson({ erro: mensagem }, resposta.status >= 500 ? 502 : 400);
    }
    const texto = resultado?.candidates?.[0]?.content?.parts
      ?.map((parte: { text?: string }) => parte.text || "")
      .join("");
    if (!texto) return respostaJson({ erro: "O Gemini não retornou conteúdo." }, 502);
    return respostaJson(extrairJson(texto));
  } catch (erro) {
    return respostaJson({ erro: erro instanceof Error ? erro.message : "Falha inesperada no assistente." }, 502);
  }
});
