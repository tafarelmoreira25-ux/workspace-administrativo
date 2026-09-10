import type { SupabaseClient } from "@supabase/supabase-js";

export const DIAS_SEM_REVISAO = 30;

export function limiteSemRevisao(referencia = new Date()) {
  const limite = new Date(referencia);
  limite.setHours(0, 0, 0, 0);
  limite.setDate(limite.getDate() - DIAS_SEM_REVISAO);
  return limite.toISOString().slice(0, 10);
}

export function processoSemRevisao(processo: { numero_processo?: string | null; ultima_revisao?: string | null }, referencia = new Date()) {
  if (!processo.numero_processo?.trim()) return false;
  if (!processo.ultima_revisao) return true;
  return processo.ultima_revisao.slice(0, 10) <= limiteSemRevisao(referencia);
}

export async function getProcessesWithoutReviewCount(client: SupabaseClient, referencia = new Date()) {
  const limite = limiteSemRevisao(referencia);
  const { count, error } = await client
    .from("processos")
    .select("id", { count: "exact", head: true })
    .not("numero_processo", "is", null)
    .neq("numero_processo", "")
    .or(`ultima_revisao.is.null,ultima_revisao.lte.${limite}`);
  if (error) throw error;
  return count || 0;
}
