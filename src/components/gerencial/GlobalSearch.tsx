import { Input } from "../common/FormControls";
﻿import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Resultado = { id: string; grupo: "Clientes" | "Extrajudiciais" | "Processos" | "Documentos" | "Atendimentos"; titulo: string; subtitulo: string; detalhe?: string; destino?: "protocolos" | "processual" };
type Props = { onSelect?: (resultado: Resultado) => void };

function normalizar(valor = "") { return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }

export default function GlobalSearch({ onSelect }: Props) {
  const [termo, setTermo] = useState("");
  const [debounced, setDebounced] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(termo.trim()), 320);
    return () => window.clearTimeout(id);
  }, [termo]);

  useEffect(() => {
    let ativo = true;
    async function buscar() {
      if (debounced.length < 2) { setResultados([]); return; }
      setCarregando(true);
      const like = `%${debounced}%`;
      const [clientes, processos, documentos, atendimentos] = await Promise.allSettled([
        supabase.from("clientes").select("id, nome_completo, cpf, id_crm, telefone").or(`nome_completo.ilike.${like},cpf.ilike.${like},id_crm.ilike.${like}`).limit(6),
        supabase.from("processos").select("id, nome_cliente, cpf_cliente, id_crm, protocolo_extrajudicial, numero_processo, banco_reu, status_judicial, fase_atual, origem_registro").or(`nome_cliente.ilike.${like},cpf_cliente.ilike.${like},id_crm.ilike.${like},protocolo_extrajudicial.ilike.${like},numero_processo.ilike.${like},banco_reu.ilike.${like}`).limit(6),
        supabase.from("documentos_juridicos").select("id, nome_documento, modelo_nome, cliente_nome, numero_processo").or(`nome_documento.ilike.${like},modelo_nome.ilike.${like},cliente_nome.ilike.${like},numero_processo.ilike.${like}`).limit(6),
        supabase.from("processual_atendimentos").select("id, cliente_nome, processo_numero, canal, descricao").or(`cliente_nome.ilike.${like},processo_numero.ilike.${like},descricao.ilike.${like}`).limit(6),
      ]);
      if (!ativo) return;
      const lista: Resultado[] = [];
      if (clientes.status === "fulfilled" && !clientes.value.error) lista.push(...(clientes.value.data || []).map((c: any) => ({ id: c.id, grupo: "Clientes" as const, titulo: c.nome_completo, subtitulo: c.cpf || c.id_crm || "Cliente", detalhe: c.telefone })));
      if (processos.status === "fulfilled" && !processos.value.error) lista.push(...(processos.value.data || []).map((p: any) => {
        const extrajudicial = p.status_judicial === "EXTRAJUDICIAL" || (!p.status_judicial && p.origem_registro === "acao_extrajudicial_manual" && p.fase_atual === "Extrajudicial");
        return { id: p.id, grupo: extrajudicial ? "Extrajudiciais" as const : "Processos" as const, titulo: p.nome_cliente, subtitulo: extrajudicial ? `Protocolo ${p.protocolo_extrajudicial || p.id_crm || "não informado"}` : p.numero_processo || "Pendente de protocolo", detalhe: p.banco_reu, destino: p.numero_processo ? "processual" as const : "protocolos" as const };
      }));
      if (documentos.status === "fulfilled" && !documentos.value.error) lista.push(...(documentos.value.data || []).map((d: any) => ({ id: d.id, grupo: "Documentos" as const, titulo: d.nome_documento, subtitulo: d.cliente_nome || d.modelo_nome, detalhe: d.numero_processo })));
      if (atendimentos.status === "fulfilled" && !atendimentos.value.error) lista.push(...(atendimentos.value.data || []).map((a: any) => ({ id: a.id, grupo: "Atendimentos" as const, titulo: a.cliente_nome, subtitulo: `${a.canal} Â· ${a.processo_numero || "sem processo"}`, detalhe: a.descricao })));
      setResultados(lista);
      setCarregando(false);
    }
    buscar();
    return () => { ativo = false; };
  }, [debounced]);

  const grupos = useMemo(() => {
    const termoNormalizado = normalizar(debounced);
    return ["Clientes", "Extrajudiciais", "Processos", "Documentos", "Atendimentos"].map((grupo) => ({ grupo, itens: resultados.filter((item) => item.grupo === grupo && (!termoNormalizado || normalizar(`${item.titulo} ${item.subtitulo} ${item.detalhe || ""}`).includes(termoNormalizado))) }));
  }, [debounced, resultados]);

  return <div className="real-search"><span className="real-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" /></svg></span><Input value={termo} onChange={(e) => setTermo(e.target.value)} type="search" placeholder="Buscar cliente, CPF, ID, processo ou banco..." aria-label="Busca global" />{termo.trim().length >= 2 ? <div className="global-search-results"><header>{carregando ? "Buscando..." : `${resultados.length} resultado(s)`}</header>{grupos.map(({ grupo, itens }) => itens.length ? <section key={grupo}><strong>{grupo}</strong>{itens.map((item) => <button className="global-search-result" type="button" key={`${item.grupo}-${item.id}`} onClick={() => onSelect?.(item)}><span>{item.titulo}</span><small>{item.subtitulo}{item.detalhe ? ` Â· ${item.detalhe}` : ""}</small></button>)}</section> : null)}{!carregando && resultados.length === 0 ? <p>Nenhum resultado encontrado.</p> : null}</div> : null}</div>;
}

