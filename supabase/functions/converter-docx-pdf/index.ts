const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_DOCX_BYTES = 18 * 1024 * 1024;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-document-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function mensagemGraph(valor: unknown) {
  if (!valor || typeof valor !== "object") return "";
  const erro = valor as { error?: { message?: string }; error_description?: string };
  return erro.error?.message || erro.error_description || "";
}

async function obterToken(tenantId: string, clientId: string, clientSecret: string) {
  const corpo = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const resposta = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
  });
  const dados = await resposta.json();
  if (!resposta.ok || !dados?.access_token) throw new Error(mensagemGraph(dados) || "Não foi possível autenticar o conversor no Microsoft Graph.");
  return String(dados.access_token);
}

async function erroGraph(resposta: Response, fallback: string) {
  try {
    const dados = await resposta.clone().json();
    return mensagemGraph(dados) || fallback;
  } catch {
    return fallback;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ erro: "Método não permitido." }, 405);
  if (!String(request.headers.get("content-type") || "").includes(DOCX_MIME)) {
    return json({ erro: "Envie um arquivo DOCX no corpo da requisição." }, 415);
  }

  const tenantId = Deno.env.get("MS_GRAPH_TENANT_ID");
  const clientId = Deno.env.get("MS_GRAPH_CLIENT_ID");
  const clientSecret = Deno.env.get("MS_GRAPH_CLIENT_SECRET");
  const driveId = Deno.env.get("MS_GRAPH_DRIVE_ID");
  if (!tenantId || !clientId || !clientSecret || !driveId) {
    return json({
      erro: "Conversor Word/PDF ainda não configurado. Defina MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET e MS_GRAPH_DRIVE_ID nos segredos da Edge Function.",
    }, 503);
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return json({ erro: "O arquivo DOCX está vazio." }, 422);
  if (bytes.length > MAX_DOCX_BYTES) return json({ erro: "O DOCX excede o limite de 18 MB do conversor." }, 413);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return json({ erro: "O conteúdo recebido não é um DOCX válido." }, 422);

  let itemId = "";
  try {
    const token = await obterToken(tenantId, clientId, clientSecret);
    const nomeTemporario = `.platino-${crypto.randomUUID()}.docx`;
    const base = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}`;
    const upload = await fetch(`${base}/root:/${encodeURIComponent(nomeTemporario)}:/content`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": DOCX_MIME },
      body: bytes,
    });
    const item = await upload.json();
    if (!upload.ok || !item?.id) throw new Error(await erroGraph(upload, "Falha ao enviar a cópia temporária ao Word Online."));
    itemId = String(item.id);

    const conversao = await fetch(`${base}/items/${encodeURIComponent(itemId)}/content?format=pdf`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
    });
    let pdfResposta = conversao;
    if ([301, 302, 303, 307, 308].includes(conversao.status)) {
      const destino = conversao.headers.get("location");
      if (!destino) throw new Error("O Microsoft Graph não informou o endereço do PDF convertido.");
      pdfResposta = await fetch(destino);
    }
    if (!pdfResposta.ok) throw new Error(await erroGraph(pdfResposta, "Falha na conversão do DOCX para PDF pelo Word Online."));
    const pdf = new Uint8Array(await pdfResposta.arrayBuffer());
    if (pdf.length < 5 || new TextDecoder().decode(pdf.slice(0, 5)) !== "%PDF-") throw new Error("O Word Online não retornou um PDF válido.");

    return new Response(pdf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=documento.pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return json({ erro: error instanceof Error ? error.message : "Falha inesperada na conversão Word/PDF." }, 502);
  } finally {
    if (itemId && tenantId && clientId && clientSecret && driveId) {
      try {
        const token = await obterToken(tenantId, clientId, clientSecret);
        await fetch(`https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (cleanupError) {
        console.error("Falha ao remover DOCX temporário do conversor:", cleanupError);
      }
    }
  }
});
