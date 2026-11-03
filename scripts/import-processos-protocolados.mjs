import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const SOURCE_KEY = "google-sheets:1wHKxXyz3RZf72tgvMHR9W5LhWeuMu9K9k5TbfRiRloA:PROCESSOS";
export const EXPECTED_HEADERS = [
  "AUTOR X RÉU",
  "PROCESSO",
  "DISTRIBUÍDO",
  "STATUS",
  "JUSTIÇA GRATUITA",
  "EMENDA INICIAL",
  "LINK",
  "OBSERVAÇÕES",
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_SOURCE = path.join(ROOT_DIR, "data", "processos-protocolados-fonte.json");
const DEFAULT_CHECKPOINT = path.join(ROOT_DIR, ".tmp", "importacao-processos-checkpoint.json");
const DEFAULT_REPORT = path.join(ROOT_DIR, ".tmp", "importacao-processos-relatorio.json");

function text(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\u00a0/g, " ").trim();
  return normalized || null;
}

function comparable(value) {
  return text(value)
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase() ?? null;
}

export function normalizeProcessNumber(value) {
  const normalized = text(value)
    ?.replace(/\s+/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return normalized || null;
}

export function splitParties(value) {
  const normalized = text(value);
  if (!normalized) return { autor: null, reu: null };
  const parts = normalized.split(/\s+[xX]\s+/, 2);
  return { autor: text(parts[0]), reu: text(parts[1]) };
}

export function parseDistributionDate(value) {
  const normalized = text(value);
  if (!normalized || comparable(normalized) === "nao identificada") return null;
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T12:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) return null;
  return iso;
}

export function mapStatusCategory(value) {
  const normalized = comparable(value);
  if (!normalized) return null;
  if (normalized === "tramitando") return "tramitando";
  if (normalized === "arquivado") return "arquivado";
  if (normalized === "improcedente") return "improcedente";
  if (normalized === "procedente") return "procedente";
  if (normalized.includes("parcialmente procedente")) return "parcialmente_procedente";
  if (normalized.includes("nao confirmado")) return "nao_confirmado";
  return "outro";
}

function nullableLegalValue(value) {
  const normalized = text(value);
  return normalized === "." ? null : normalized;
}

function normalizeHeader(value) {
  return comparable(value)?.toUpperCase() ?? "";
}

export function validateHeader(header) {
  const actual = [
    header.autor_reu,
    header.processo,
    header.distribuido,
    header.status,
    header.justica_gratuita,
    header.emenda_inicial,
    header.link_rotulo,
    header.observacoes,
  ].map(normalizeHeader);
  const expected = EXPECTED_HEADERS.map(normalizeHeader);
  const errors = expected.flatMap((value, index) => value === actual[index]
    ? []
    : [`Coluna ${index + 1}: esperado "${EXPECTED_HEADERS[index]}", encontrado "${actual[index] || "vazio"}".`]);
  if (errors.length) throw new Error(`Cabeçalho inválido:\n${errors.join("\n")}`);
}

function normalizedRow(row) {
  const { autor, reu } = splitParties(row.autor_reu);
  return {
    linha: Number(row.linha),
    autor,
    reu,
    numero_processo: normalizeProcessNumber(row.processo),
    data_distribuicao: parseDistributionDate(row.distribuido),
    status_categoria: mapStatusCategory(row.status),
    status_original: text(row.status),
    justica_gratuita: nullableLegalValue(row.justica_gratuita),
    emenda_inicial: text(row.emenda_inicial),
    link_processo: text(row.link),
    observacoes: row.observacoes === null || row.observacoes === undefined || row.observacoes === ""
      ? null
      : String(row.observacoes),
  };
}

const MERGE_FIELDS = [
  "autor", "reu", "numero_processo", "data_distribuicao", "status_categoria",
  "status_original", "justica_gratuita", "emenda_inicial", "link_processo", "observacoes",
];

function mergeDuplicateRows(rows, conflicts) {
  const byNumber = new Map();
  for (const row of rows) {
    if (!row.numero_processo) continue;
    const existing = byNumber.get(row.numero_processo);
    if (!existing) {
      byNumber.set(row.numero_processo, { ...row });
      continue;
    }
    for (const field of MERGE_FIELDS) {
      const incoming = row[field];
      if (incoming === null || incoming === undefined || incoming === "") continue;
      const current = existing[field];
      if (current !== null && current !== undefined && current !== "" && current !== incoming) {
        conflicts.push({
          numero_processo: row.numero_processo,
          linha: row.linha,
          campo: field,
          valor_anterior: current,
          valor_posterior: incoming,
          decisao: "valor não vazio da última ocorrência preservado",
        });
      }
      existing[field] = incoming;
    }
  }
  return rows.map((row) => row.numero_processo
    ? { ...byNumber.get(row.numero_processo), linha: row.linha }
    : row);
}

export function prepareSource(source) {
  if (!Array.isArray(source?.rows) || !source.rows.length) {
    throw new Error("A fonte não contém linhas.");
  }
  validateHeader(source.rows[0]);

  const invalid = [];
  const candidates = [];
  for (const raw of source.rows.slice(1)) {
    const row = normalizedRow(raw);
    if (!row.autor) {
      invalid.push({ linha: row.linha, motivo: "IGNORADO — linha inválida/cliente ausente" });
      continue;
    }
    if (comparable(row.autor) === "captura de tela") {
      invalid.push({ linha: row.linha, motivo: "IGNORADO — linha inválida/não corresponde a cliente" });
      continue;
    }
    candidates.push(row);
  }

  const numberCounts = new Map();
  for (const row of candidates) {
    if (row.numero_processo) {
      numberCounts.set(row.numero_processo, (numberCounts.get(row.numero_processo) ?? 0) + 1);
    }
  }
  const duplicateGroups = [...numberCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([numero_processo, count]) => ({
      numero_processo,
      ocorrencias: count,
      linhas: candidates.filter((row) => row.numero_processo === numero_processo).map((row) => row.linha),
    }));
  const duplicateRows = duplicateGroups.reduce((sum, group) => sum + group.ocorrencias - 1, 0);
  const conflicts = [];
  const rows = mergeDuplicateRows(candidates, conflicts);

  return {
    sourceRows: source.rows.length - 1,
    rows,
    invalid,
    duplicateGroups,
    duplicateRows,
    conflicts,
    expectedUniqueProcesses: rows.length - duplicateRows,
  };
}

async function readEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return Object.fromEntries(content.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || match[1].startsWith("#")) return [];
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return [[match[1], value]];
    }));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function parseArgs(argv) {
  const options = {
    source: DEFAULT_SOURCE,
    checkpoint: DEFAULT_CHECKPOINT,
    report: DEFAULT_REPORT,
    batchSize: 25,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--source") options.source = path.resolve(argv[++index]);
    else if (arg === "--checkpoint") options.checkpoint = path.resolve(argv[++index]);
    else if (arg === "--report") options.report = path.resolve(argv[++index]);
    else if (arg === "--batch-size") options.batchSize = Number(argv[++index]);
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 50) {
    throw new Error("--batch-size deve ser um inteiro entre 1 e 50.");
  }
  return options;
}

async function createDatabaseClient() {
  const fileEnv = await readEnvFile(path.join(ROOT_DIR, ".env"));
  const env = { ...fileEnv, ...process.env };
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url) throw new Error("SUPABASE_URL/VITE_SUPABASE_URL não configurada.");

  if (serviceKey) {
    return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  if (anonKey && env.SUPABASE_EMAIL && env.SUPABASE_PASSWORD) {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithPassword({
      email: env.SUPABASE_EMAIL,
      password: env.SUPABASE_PASSWORD,
    });
    if (error) throw new Error(`Falha ao autenticar no Supabase: ${error.message}`);
    return client;
  }
  throw new Error(
    "Acesso de escrita ao banco ausente. Configure SUPABASE_SERVICE_ROLE_KEY ou " +
    "SUPABASE_EMAIL/SUPABASE_PASSWORD somente no .env local (nunca no repositório).",
  );
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resultItems(data) {
  if (Array.isArray(data?.resultados)) return data.resultados;
  if (Array.isArray(data)) return data;
  return [];
}

async function exactProcessCount(client) {
  const { data, error } = await client.rpc("contar_processos_clientes");
  if (error) throw new Error(`Falha ao contar processos_clientes: ${error.message}`);
  return Number(data ?? 0);
}

async function loadImportedProcesses(client) {
  const { data, error } = await client.rpc("listar_importacao_processos_protocolados", {
    p_fonte: SOURCE_KEY,
  });
  if (error) throw new Error(`Falha ao validar processos importados: ${error.message}`);
  return data ?? [];
}

export function samples(imported) {
  const byStatus = (status) => imported.find((item) => item.status_categoria === status) ?? null;
  const incomplete = imported.find((item) => item.incompleto) ?? null;
  const duplicate = imported.find((item) => (item.fontes_linhas?.length ?? 0) > 1) ?? null;
  const first = imported.find((item) => item.fontes_linhas?.includes(2)) ?? null;
  const lastSourceLine = Math.max(...imported.flatMap((item) => item.fontes_linhas ?? []));
  const last = imported.find((item) => item.fontes_linhas?.includes(lastSourceLine)) ?? null;
  const grouped = new Map();
  for (const item of imported) {
    const values = grouped.get(item.cliente_id) ?? [];
    values.push(item);
    grouped.set(item.cliente_id, values);
  }
  const multiple = [...grouped.values()].find((items) => items.length > 1) ?? null;
  return {
    arquivado: byStatus("arquivado"),
    tramitando: byStatus("tramitando"),
    improcedente: byStatus("improcedente"),
    procedente: byStatus("procedente"),
    incompleto: incomplete,
    cliente_com_multiplos_processos: multiple,
    processo_duplicado_na_fonte: duplicate,
    inicio_da_fonte: first,
    final_da_fonte: last,
  };
}

export async function runImport(options) {
  const source = JSON.parse(await fs.readFile(options.source, "utf8"));
  const prepared = prepareSource(source);
  console.log(`Fonte validada: ${prepared.sourceRows} linhas, ${prepared.rows.length} válidas, ${prepared.invalid.length} inválidas.`);
  console.log(`Processos únicos esperados: ${prepared.expectedUniqueProcesses}; duplicidades consolidadas: ${prepared.duplicateRows}.`);

  if (options.dryRun) return { prepared, dryRun: true };

  const client = await createDatabaseClient();
  const beforeProcesses = await exactProcessCount(client);
  const results = [];
  const batches = Math.ceil(prepared.rows.length / options.batchSize);

  for (let offset = 0; offset < prepared.rows.length; offset += options.batchSize) {
    const batch = prepared.rows.slice(offset, offset + options.batchSize);
    const batchNumber = Math.floor(offset / options.batchSize) + 1;
    const { data, error } = await client.rpc("importar_processos_protocolados_lote", {
      p_lote: batch,
      p_fonte: SOURCE_KEY,
    });
    if (error) {
      throw new Error(`Lote ${batchNumber}/${batches} falhou antes do checkpoint: ${error.message}`);
    }
    const batchResults = resultItems(data);
    results.push(...batchResults);
    const checkpoint = {
      fonte: SOURCE_KEY,
      lote_concluido: batchNumber,
      lotes_totais: batches,
      linhas_concluidas: Math.min(offset + batch.length, prepared.rows.length),
      atualizado_em: new Date().toISOString(),
    };
    await writeJson(options.checkpoint, checkpoint);
    console.log(`Lote ${batchNumber}/${batches} persistido — ${checkpoint.linhas_concluidas}/${prepared.rows.length} linhas válidas.`);
  }

  const imported = await loadImportedProcesses(client);
  const afterProcesses = await exactProcessCount(client);
  const createdProcessIds = new Set(results.filter((item) => item.processo_acao === "criado").map((item) => item.processo_id));
  const updatedProcessIds = new Set(results
    .filter((item) => item.processo_acao === "atualizado" && !createdProcessIds.has(item.processo_id))
    .map((item) => item.processo_id));
  const createdClientIds = new Set(results.filter((item) => item.cliente_acao === "criado").map((item) => item.cliente_id));
  const reusedClientIds = new Set(results
    .filter((item) => item.cliente_acao === "reutilizado" && !createdClientIds.has(item.cliente_id))
    .map((item) => item.cliente_id));
  const errors = results.filter((item) => item.erro);
  const warnings = results.flatMap((item) => item.avisos ?? []);
  const report = {
    fonte: SOURCE_KEY,
    executado_em: new Date().toISOString(),
    linhas_encontradas_na_fonte: prepared.sourceRows,
    linhas_validas: prepared.rows.length,
    linhas_invalidas: prepared.invalid.length,
    novos_clientes_criados: createdClientIds.size,
    clientes_ja_existentes_reutilizados: reusedClientIds.size,
    novos_processos_criados: createdProcessIds.size,
    processos_existentes_atualizados: updatedProcessIds.size,
    processos_duplicados_consolidados: prepared.duplicateRows,
    processos_incompletos_cadastrados: imported.filter((item) => item.incompleto).length,
    registros_ignorados: prepared.invalid,
    erros: errors,
    total_processos_antes: beforeProcesses,
    total_processos_no_banco_apos_importacao: afterProcesses,
    total_processos_desta_fonte: imported.length,
    duplicidades_da_fonte: prepared.duplicateGroups,
    divergencias_da_fonte: prepared.conflicts,
    avisos_do_banco: warnings,
    amostras_validadas_diretamente_no_banco: samples(imported),
  };
  await writeJson(options.report, report);
  return { report, prepared };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runImport(options);
  if (result.dryRun) {
    console.log("Validação local concluída; nenhuma escrita foi realizada.");
    return;
  }
  console.log(JSON.stringify(result.report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
