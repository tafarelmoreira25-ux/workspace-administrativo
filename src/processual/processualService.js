import { supabase } from "../lib/supabase";

export async function salvarRascunhoProcessual({ id, resumo, dados, anexos }) {
  const { data, error } = await supabase.rpc("salvar_rascunho_processual", {
    p_id: id || null, p_resumo_original: resumo || null, p_dados: dados,
    p_anexos: anexos.map(({ nome, descricao, tipo, incluir, ordem, arquivo }) => ({ nome, descricao, tipo, incluir, ordem, nome_original: arquivo?.name })),
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function confirmarRelatorioProcessual({ id, dados }) {
  const { data, error } = await supabase.rpc("confirmar_relatorio_processual", {
    p_id: id || null, p_cliente: dados.cliente_autor, p_numero_processo: dados.numero_processo,
    p_data_consulta: dados.data_consulta || null, p_responsavel: dados.responsavel,
  });
  if (error) throw error;
  return data;
}

export async function listarRelatoriosProcessuais() {
  const { data, error } = await supabase.from("relatorios_processuais").select("id,codigo,cliente,numero_processo,data_consulta,responsavel,situacao,created_at,gerado_em").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data || [];
}
