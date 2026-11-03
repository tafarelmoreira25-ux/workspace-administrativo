import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { type Processo } from "../../lib/esteiraProcessual";
import { FASES_DE_PROTOCOLO, possuiNumeroProcessual } from "../../lib/processWorkflow";
import Pagination from "../common/Pagination";
import EsteiraKanban from "./EsteiraKanban";
import PainelJudicial from "./PainelJudicial";
import "../../esteiraProcessual.css";

type Props = {
  usuario?: { nome?: string; email?: string };
  showToast?: (mensagem: string) => void;
  initialView?: Visualizacao;
  initialFilters?: Record<string, string>;
  alerta?: { titulo: string; ids: string[] } | null;
  onLimparAlerta?: () => void;
};

type Visualizacao = "protocolos" | "processos";
const CAMPOS_PROCESSO_LISTA = [
  "id",
  "cliente_id",
  "nome_cliente",
  "cpf_cliente",
  "id_crm",
  "protocolo_extrajudicial",
  "numero_processo",
  "reu",
  "banco_reu",
  "tipo_acao",
  "fase_atual",
  "situacao",
  "resultado",
  "status_judicial",
  "documentacao_status",
  "procuracao_status",
  "protocolo_status",
  "link_pasta_cliente",
  "responsavel",
  "created_at",
  "updated_at",
  "proximo_prazo",
  "data_envio_elite",
  "data_distribuicao",
  "origem_registro",
  "observacoes",
].join(",");

export default function EsteiraProcessualPlatino({ usuario, showToast, initialView = "protocolos", initialFilters, alerta, onLimparAlerta }: Props) {
  const [visualizacao] = useState<Visualizacao>(initialView);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);

  const avisar = useCallback(
    (mensagem: string) => {
      if (showToast) showToast(mensagem);
    },
    [showToast],
  );

  const carregarProcessos = useCallback(async (signal = new AbortController().signal) => {
    setCarregando(true);
    const termo = buscaAplicada.trim().replace(/[,()"']/g, " ").replace(/\s+/g, " ").slice(0, 120);
    let consulta = supabase.from("processos").select(CAMPOS_PROCESSO_LISTA, { count: "exact" });
    if (alerta) consulta = alerta.ids.length ? consulta.in("id", alerta.ids) : consulta.eq("id", "00000000-0000-0000-0000-000000000000");
    consulta = visualizacao === "protocolos" && !alerta
      ? consulta.or("numero_processo.is.null,numero_processo.eq.").in("fase_atual", [...FASES_DE_PROTOCOLO])
      : visualizacao === "processos" ? consulta.not("numero_processo", "is", null).neq("numero_processo", "") : consulta;
    if (termo) consulta = consulta.or(`nome_cliente.ilike.%${termo}%,cpf_cliente.ilike.%${termo}%,id_crm.ilike.%${termo}%,numero_processo.ilike.%${termo}%,reu.ilike.%${termo}%,banco_reu.ilike.%${termo}%,tipo_acao.ilike.%${termo}%`);
    const inicio = (pagina - 1) * 30;
    const { data, count, error } = await consulta.order("updated_at", { ascending: false }).range(inicio, inicio + 29).abortSignal(signal);
    if (signal.aborted) return;

    if (error) {
      avisar("Não foi possível carregar o módulo Processual.");
      setCarregando(false);
      return;
    }

    setProcessos((data || []) as Processo[]);
    setTotal(count || 0);
    setCarregando(false);
  }, [alerta, avisar, buscaAplicada, pagina, visualizacao]);

  useEffect(() => { const controller = new AbortController(); void carregarProcessos(controller.signal); return () => controller.abort(); }, [carregarProcessos]);
  useEffect(() => { const timer = window.setTimeout(() => { setPagina(1); setBuscaAplicada(busca); }, 350); return () => window.clearTimeout(timer); }, [busca]);

  function atualizarProcessoLocal(processoAtualizado: Processo) {
    if (visualizacao === "protocolos" && possuiNumeroProcessual(processoAtualizado)) {
      setProcessos((atuais) => atuais.filter((item) => item.id !== processoAtualizado.id));
      setTotal((quantidade) => Math.max(0, quantidade - 1));
      return;
    }
    setProcessos((atuais) => {
      const existe = atuais.some((item) => item.id === processoAtualizado.id);
      if (!existe) return [processoAtualizado, ...atuais];
      return atuais.map((item) => (
        item.id === processoAtualizado.id ? processoAtualizado : item
      ));
    });
  }

  return (
    <section className="esteira-workspace" aria-label="Módulo Processual Platino">
      {alerta ? <div className="dashboard-filtro-ativo"><span>{alerta.titulo}</span><button type="button" onClick={() => { setPagina(1); onLimparAlerta?.(); }}>Mostrar todos</button></div> : null}
      {carregando && !processos.length ? (
        <div className="panel">Carregando processos...</div>
      ) : visualizacao === "protocolos" ? (
        <EsteiraKanban
          processos={processos}
          onProcessoAtualizado={atualizarProcessoLocal}
          showToast={avisar}
          usuario={usuario}
          busca={busca}
          onBusca={setBusca}
        />
      ) : (
        <PainelJudicial
          processos={processos}
          onProcessoAtualizado={atualizarProcessoLocal}
          showToast={avisar}
          usuario={usuario}
          busca={busca}
          onBusca={setBusca}
          initialFilters={initialFilters}
        />
      )}
      {!carregando ? <Pagination pagina={pagina} total={total} tamanho={30} onChange={setPagina} rotulo={visualizacao === "protocolos" ? "protocolos" : "processos"} /> : null}
    </section>
  );
}
