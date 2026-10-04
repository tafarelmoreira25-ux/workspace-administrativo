import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, invalidarConsultas } from "../../lib/supabase";
import { calcularPrazoElite, type Processo } from "../../lib/esteiraProcessual";
import { pertenceAExtrajudiciais, pertenceAProcessos, pertenceAProtocolos } from "../../lib/processWorkflow";

type Props = { usuario?: { nome?: string }; onNavigate: (destino: string) => void };
type Item = Record<string, unknown>;

function situacaoEncerrada(processo: Processo) {
  const valor = `${processo.situacao || ""} ${processo.status_judicial || ""} ${processo.fase_atual || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return ["encerrado", "arquivado", "baixa", "acordo firmado", "acordo concluido"].some((termo) => valor.includes(termo));
}

function IconeEtapa({ tipo }: { tipo: "extrajudicial" | "baixa" | "protocolo" | "judicial" | "alerta" | "prazo" }) {
  const caminhos = {
    extrajudicial: <><path d="M8 3h8v4H8z" /><path d="M6 5H4v16h16V5h-2M8 11h8M8 15h8" /></>,
    baixa: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.6 2.6L16.5 9" /></>,
    protocolo: <><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v5h5M10 13h6M10 17h6" /></>,
    judicial: <><path d="M4 20h16M6 17h12M12 4v13M5 8h14M8 8l-3 5h6L8 8Zm8 0-3 5h6l-3-5Z" /></>,
    alerta: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
    prazo: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h3M8 17h6" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{caminhos[tipo]}</svg>;
}

export default function DashboardModule({ usuario, onNavigate }: Props) {
  const [dados, setDados] = useState({ processos: [] as Processo[], tarefas: [] as Item[], prazos: [] as Item[] });
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async (signal = new AbortController().signal) => {
    setCarregando(true);
    const hoje = new Date().toISOString().slice(0, 10);
    const futuro = new Date();
    futuro.setDate(futuro.getDate() + 14);
    const limite = futuro.toISOString().slice(0, 10);
    const [processosReq, tarefasReq, prazosReq] = await Promise.all([
      supabase.from("processos").select("id,nome_cliente,numero_processo,status_judicial,fase_atual,origem_registro,situacao,data_envio_elite,protocolo_extrajudicial,id_crm,updated_at").order("updated_at", { ascending: false }).limit(2000).abortSignal(signal),
      supabase.from("processual_tarefas").select("id,titulo,cliente_nome,data,status,prioridade,tipo").lt("data", hoje).in("status", ["Pendente", "Em andamento", "Atrasada"]).order("data").limit(20).abortSignal(signal),
      supabase.from("processos").select("id,nome_cliente,numero_processo,proximo_prazo,status_judicial").not("numero_processo", "is", null).gte("proximo_prazo", hoje).lte("proximo_prazo", limite).order("proximo_prazo").limit(20).abortSignal(signal),
    ]);
    if (signal.aborted) return;
    setDados({ processos: processosReq.error ? [] : (processosReq.data || []) as Processo[], tarefas: tarefasReq.error ? [] : tarefasReq.data || [], prazos: prazosReq.error ? [] : prazosReq.data || [] });
    setCarregando(false);
  }, []);

  useEffect(() => { const controller = new AbortController(); void carregar(controller.signal); return () => controller.abort(); }, [carregar]);

  const resumo = useMemo(() => {
    const ativos = dados.processos.filter((processo) => !situacaoEncerrada(processo));
    const extrajudiciais = ativos.filter(pertenceAExtrajudiciais);
    const protocolos = ativos.filter((processo) => pertenceAProtocolos(processo) || (!processo.numero_processo && processo.status_judicial === "AGUARDANDO_PROTOCOLO"));
    const judiciais = ativos.filter(pertenceAProcessos);
    const baixados = dados.processos.filter((processo) => !processo.numero_processo
      && situacaoEncerrada(processo)
      && (processo.origem_registro === "acao_extrajudicial_manual" || processo.status_judicial === "EXTRAJUDICIAL"));
    const protocolosComPrazo = protocolos.map((processo) => ({ processo, prazo: calcularPrazoElite(processo.data_envio_elite) }));
    const vencendo = protocolosComPrazo.filter(({ prazo }) => ["atencao", "critico", "vermelho"].includes(prazo.sinalizacao));
    const atrasados = protocolosComPrazo.filter(({ prazo }) => prazo.sinalizacao === "atrasado");
    const atencao = [...atrasados, ...vencendo].sort((a, b) => b.prazo.diasUteisAtraso - a.prazo.diasUteisAtraso || (a.prazo.diasUteisRestantes ?? 99) - (b.prazo.diasUteisRestantes ?? 99));
    return { extrajudiciais, protocolos, judiciais, baixados, vencendo, atrasados, atencao };
  }, [dados.processos]);

  const etapas = [
    { titulo: "Extrajudicial", legenda: "Revisional administrativa", total: resumo.extrajudiciais.length, destino: "processual-extrajudiciais", icone: "extrajudicial" as const },
    { titulo: "Protocolos", legenda: "Distribuição em até 15 dias úteis", total: resumo.protocolos.length, destino: "processual-protocolos", icone: "protocolo" as const },
    { titulo: "Processual", legenda: "Com número judicial liberado", total: resumo.judiciais.length, destino: "processual", icone: "judicial" as const },
  ];
  const baixas = { titulo: "Baixas por acordo", legenda: "Concluídas sem ajuizamento", total: resumo.baixados.length, destino: "processual-extrajudiciais", icone: "baixa" as const };
  const urgencias = [
    { titulo: "Protocolos vencendo", total: resumo.vencendo.length, legenda: "Até 5 dias úteis", destino: "processual-protocolos", icone: "prazo" as const },
    { titulo: "Protocolos atrasados", total: resumo.atrasados.length, legenda: "SLA de 15 dias excedido", destino: "processual-protocolos", icone: "alerta" as const },
    { titulo: "Tarefas vencidas", total: dados.tarefas.length, legenda: "Providência imediata", destino: "agenda-atividades", icone: "alerta" as const },
    { titulo: "Prazos judiciais", total: dados.prazos.length, legenda: "Próximos 14 dias", destino: "agenda-atividades", icone: "prazo" as const },
  ];

  return <section className="dashboard-resumo dashboard-esteira">
    <header className="dashboard-cabecalho"><div><span className="eyebrow">Área de trabalho</span><h2>Olá, {usuario?.nome?.split(" ")[0] || "equipe"}</h2><p>Visão direta da jornada do cliente e do que exige ação agora.</p></div><button className="btn-secondary compact" type="button" onClick={() => { invalidarConsultas(); void carregar(); }}>Atualizar</button></header>
    <section className="dashboard-bloco"><div className="dashboard-fluxo">{etapas.map((etapa, indice) => <div className="dashboard-fluxo-item" key={etapa.titulo}><button type="button" onClick={() => onNavigate(etapa.destino)}><span className={`dashboard-icone dashboard-icone-${etapa.icone}`}><IconeEtapa tipo={etapa.icone} /></span><span><strong>{carregando ? "—" : etapa.total}</strong><b>{etapa.titulo}</b><small>{etapa.legenda}</small></span></button>{indice < etapas.length - 1 ? <i aria-hidden="true">→</i> : null}</div>)}</div><div className="dashboard-saida-acordo"><i aria-hidden="true">↳</i><button type="button" onClick={() => onNavigate(baixas.destino)}><span className={`dashboard-icone dashboard-icone-${baixas.icone}`}><IconeEtapa tipo={baixas.icone} /></span><span><strong>{carregando ? "—" : baixas.total}</strong><b>{baixas.titulo}</b><small>{baixas.legenda}</small></span></button></div></section>
    <section className="dashboard-bloco dashboard-urgencias"><header className="dashboard-bloco-titulo"><div><h3>Atenção agora</h3><p>Somente pendências com prazo ou necessidade de providência.</p></div></header><div className="dashboard-urgencia-grid">{urgencias.map((item) => <button className={item.total > 0 ? "com-alerta" : ""} type="button" key={item.titulo} onClick={() => onNavigate(item.destino)}><span className="dashboard-urgencia-icone"><IconeEtapa tipo={item.icone} /></span><span><b>{item.titulo}</b><small>{item.legenda}</small></span><strong>{carregando ? "—" : item.total}</strong></button>)}</div></section>
    {!carregando && resumo.atencao.length > 0 ? <section className="dashboard-atencao-lista"><header><div><h3>Protocolos próximos do limite</h3><p>Ordenados pelos casos mais urgentes.</p></div><button type="button" onClick={() => onNavigate("processual-protocolos")}>Abrir Protocolos</button></header><div>{resumo.atencao.slice(0, 6).map(({ processo, prazo }) => <article key={processo.id}><span className={prazo.sinalizacao === "atrasado" ? "status-atrasado" : "status-atencao"}><IconeEtapa tipo={prazo.sinalizacao === "atrasado" ? "alerta" : "prazo"} /></span><div><strong>{processo.nome_cliente}</strong><small>{processo.fase_atual || "Em distribuição"}</small></div><time>{prazo.sinalizacao === "atrasado" ? prazo.rotulo : `${prazo.diasUteisRestantes ?? 0} dias úteis restantes`}</time></article>)}</div></section> : null}
  </section>;
}
