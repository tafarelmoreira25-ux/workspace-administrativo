import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACTIVE_CLIENTS_FOLDER_ID =
  Deno.env.get("GOOGLE_DRIVE_CLIENTS_FOLDER_ID") ||
  "1y2DtlTHz8LipsbzzJCLVmhrS30TWsOw7";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function validarGestor(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authorization = req.headers.get("Authorization") || "";
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: usuario, error: erroUsuario } = await client.auth.getUser();
  if (erroUsuario || !usuario.user) return false;
  const { data: gestor, error: erroGestor } = await client.rpc("usuario_e_admin");
  return !erroGestor && gestor === true;
}

async function obterTokenGoogle() {
  const credencialJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  let clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  let privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY")?.replace(/\\n/g, "\n");

  if (credencialJson) {
    try {
      const credencial = JSON.parse(credencialJson);
      clientEmail = credencial.client_email;
      privateKey = credencial.private_key;
    } catch {
      throw new Error("O secret GOOGLE_SERVICE_ACCOUNT_JSON não contém um JSON válido.");
    }
  }

  if (!clientEmail || !privateKey) {
    throw new Error("Configure GOOGLE_SERVICE_ACCOUNT_JSON nos Secrets do Supabase.");
  }
  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("O Google não forneceu um token de acesso.");
  return token.token;
}

async function listarPastasClientes(token: string) {
  const pastas: Array<Record<string, unknown>> = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: `'${ACTIVE_CLIENTS_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken,files(id,name,webViewLink,modifiedTime,parents,trashed)",
      pageSize: "1000",
      orderBy: "name_natural",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const resposta = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await resposta.json();
    if (!resposta.ok) {
      throw new Error(payload?.error?.message || "Não foi possível consultar as pastas no Google Drive.");
    }
    pastas.push(...(payload.files || []));
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return pastas;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    if (!(await validarGestor(req))) {
      return json({ error: "Somente o gestor pode sincronizar os clientes do Drive." }, 403);
    }

    const token = await obterTokenGoogle();
    const pastas = await listarPastasClientes(token);
    if (pastas.length === 0) {
      throw new Error("Nenhuma pasta foi encontrada em 01_CLIENTES_ATIVOS. A sincronização foi cancelada para proteger o índice atual.");
    }
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const sincronizadoEm = new Date().toISOString();
    const { data, error } = await supabaseAdmin.rpc("sincronizar_clientes_drive", {
      p_pastas: pastas,
      p_pasta_pai_id: ACTIVE_CLIENTS_FOLDER_ID,
      p_sincronizado_em: sincronizadoEm,
    });
    if (error) throw error;

    return json({ ok: true, resumo: data, pasta_id: ACTIVE_CLIENTS_FOLDER_ID });
  } catch (error) {
    console.error("Falha na sincronização de clientes do Drive", error);
    return json({ error: error instanceof Error ? error.message : "Falha inesperada na sincronização." }, 500);
  }
});
