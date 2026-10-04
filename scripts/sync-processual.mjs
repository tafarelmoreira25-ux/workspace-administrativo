import fs from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
export const normalizeNumber = value => String(value ?? '').replace(/\D/g, '');

// O texto colado contém aspas e quebras de linha fora do padrão CSV.
export function parseSource(text) {
  const records = [];
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const columns = line.split('\t');
    while (columns[0]?.trim() === '"') columns.shift();
    const name = columns[0]?.replace(/^"|"$/g, '').trim();
    if (!name) {
      if (!records.length) throw new Error('Continuação sem registro anterior.');
      continue; // Continuação de data/observação: não contém outro cliente.
    }
    if (columns.length < 2) throw new Error(`Linha não reconhecida: ${name}`);
    const [nome, reu = null] = name.split(/\s+[xX]\s+/, 2);
    const digits = normalizeNumber(columns[1]);
    const processo = digits.length === 20
      ? digits.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6')
      : null;
    records.push({ nome, processo, reu, numero_original: columns[1].trim() || null });
  }
  return records;
}

export async function sync(client, items, dryRun = false, log = console.log) {
  const totals = { criados: 0, pulados: 0, pendentes: 0, erros: 0, previstos: 0 };
  for (const item of items) {
    if (!item.processo) {
      totals.pendentes++;
      log(`Pendente: ${item.nome} — número ausente/inválido; nenhum cadastro criado.`);
      continue;
    }
    try {
      const { data, error } = await client.rpc('sync_processual_one_off', {
        p_nome: item.nome, p_numero: item.processo, p_reu: item.reu, p_simular: dryRun,
      });
      if (error) throw new Error(error.message);
      if (!['criado', 'pulado', 'previsto'].includes(data?.acao)) throw new Error('Resposta inesperada da RPC.');
      if (data.acao === 'pulado') { totals.pulados++; log(`Processo ${item.processo} pulado (já existe)`); }
      else if (data.acao === 'previsto') { totals.previstos++; log(`Processo ${item.processo} seria criado (simulação)`); }
      else { totals.criados++; log(`Processo ${item.processo} criado com sucesso`); }
    } catch (error) { totals.erros++; log(`Erro no processo ${item.processo}: ${error.message}`); }
  }
  log(`Total: ${totals.criados} criados, ${totals.pulados} pulados, ${totals.pendentes} pendentes, ${totals.erros} erros, ${totals.previstos} previstos.`);
  return totals;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--parse-only', '--dry-run'].includes(arg))) throw new Error('Use --parse-only ou --dry-run, ou nenhum argumento para executar.');
  const items = parseSource(await fs.readFile(new URL('data/sync-processual-fonte.txt', root), 'utf8'));
  await fs.writeFile(new URL('data/sync-processual-clientes.json', root), JSON.stringify(items, null, 2) + '\n');
  console.log(`Array gerado: ${items.length} registros; ${items.filter(i => !i.processo).length} sem número válido.`);
  if (args.includes('--parse-only')) return;
  const envPath = fileURLToPath(new URL('.env', root));
  try { process.loadEnvFile(envPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env local (sem prefixo VITE na chave).');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const totals = await sync(client, items, args.includes('--dry-run'));
  if (totals.erros || totals.pendentes) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
