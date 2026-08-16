import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROOT_FOLDER_ID =
  Deno.env.get("GOOGLE_DRIVE_CLIENTS_ROOT_FOLDER_ID") ||
  "1uP4IVec5rAeda_OzQRQTpBXuVsw6aNLy";
const ACTIVE_CLIENTS_FOLDER_ID =
  Deno.env.get("GOOGLE_DRIVE_CLIENTS_FOLDER_ID") ||
  "1y2DtlTHz8LipsbzzJCLVmhrS30TWsOw7";

type DriveFolder = {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
  parents?: string[];
  trashed?: boolean;
  driveStatus?: "ativo" | "arquivado";
  parentFolderId?: string;
  drivePath?: string;
};

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

async function listarPastasFilhas(token: string, parentFolderId: string) {
  const pastas: DriveFolder[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
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

function ehPastaDeArquivo(nome: string) {
  return /ARQUIVO|ANTIG|INATIV|ENCERRAD/i.test(nome);
}

function ehPastaDeAno(nome: string) {
  return /^(19|20)\d{2}$/.test(nome.trim());
}

function prepararPastas(
  pastas: DriveFolder[],
  status: "ativo" | "arquivado",
  parentFolderId: string,
  caminhoPai: string,
) {
  return pastas.map((pasta) => ({
    ...pasta,
    driveStatus: status,
    parentFolderId,
    drivePath: `${caminhoPai} / ${pasta.name}`,
  }));
}

async function montarCatalogo(token: string) {
  const pastasAtivas = prepararPastas(
    await listarPastasFilhas(token, ACTIVE_CLIENTS_FOLDER_ID),
    "ativo",
    ACTIVE_CLIENTS_FOLDER_ID,
    "01_CLIENTES_ATIVOS",
  );

  let pastasRaiz: DriveFolder[];
  try {
    pastasRaiz = await listarPastasFilhas(token, ROOT_FOLDER_ID);
  } catch (error) {
    throw new Error(
      `A pasta geral PLATINO - CLIENTES ainda não está acessível para a conta de serviço. Compartilhe a pasta geral com o client_email do JSON. Detalhe: ${error instanceof Error ? error.message : "acesso negado"}`,
    );
  }

  const pastasArquivadas: DriveFolder[] = [];
  const raizesHistoricas = pastasRaiz.filter(
    (pasta) => pasta.id !== ACTIVE_CLIENTS_FOLDER_ID && (ehPastaDeArquivo(pasta.name) || ehPastaDeAno(pasta.name)),
  );

  for (const raizHistorica of raizesHistoricas) {
    const filhas = await listarPastasFilhas(token, raizHistorica.id);
    if (ehPastaDeAno(raizHistorica.name)) {
      pastasArquivadas.push(...prepararPastas(filhas, "arquivado", raizHistorica.id, raizHistorica.name));
      continue;
    }

    const pastasDeAno = filhas.filter((pasta) => ehPastaDeAno(pasta.name));
    if (pastasDeAno.length === 0) {
      pastasArquivadas.push(...prepararPastas(filhas, "arquivado", raizHistorica.id, raizHistorica.name));
      continue;
    }

    for (const pastaAno of pastasDeAno) {
      const clientesDoAno = await listarPastasFilhas(token, pastaAno.id);
      pastasArquivadas.push(...prepararPastas(
        clientesDoAno,
        "arquivado",
        pastaAno.id,
        `${raizHistorica.name} / ${pastaAno.name}`,
      ));
    }
  }

  const catalogoPorId = new Map<string, DriveFolder>();
  for (const pasta of [...pastasArquivadas, ...pastasAtivas]) catalogoPorId.set(pasta.id, pasta);
  return {
    catalogo: [...catalogoPorId.values()],
    totalAtivos: pastasAtivas.length,
    totalArquivados: pastasArquivadas.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    if (!(await validarGestor(req))) {
      return json({ error: "Somente o gestor pode sincronizar os clientes do Drive." }, 403);
    }

    const token = await obterTokenGoogle();
    const { catalogo, totalAtivos, totalArquivados } = await montarCatalogo(token);
    if (totalAtivos === 0) {
      throw new Error("Nenhuma pasta foi encontrada em 01_CLIENTES_ATIVOS. A sincronização foi cancelada para proteger o índice atual.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const sincronizadoEm = new Date().toISOString();
    const { data, error } = await supabaseAdmin.rpc("sincronizar_catalogo_clientes_drive", {
      p_pastas: catalogo,
      p_pasta_raiz_id: ROOT_FOLDER_ID,
      p_sincronizado_em: sincronizadoEm,
    });
    if (error) throw error;

    return json({
      ok: true,
      resumo: { ...data, ativos: totalAtivos, arquivados: totalArquivados },
      pasta_raiz_id: ROOT_FOLDER_ID,
    });
  } catch (error) {
    console.error("Falha na sincronização de clientes do Drive", error);
    return json({ error: error instanceof Error ? error.message : "Falha inesperada na sincronização." }, 500);
  }
});
