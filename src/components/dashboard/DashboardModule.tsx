import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { calcularPrazoElite, type Processo } from "../../lib/esteiraProcessual";
import { getProcessesWithoutReviewCount } from "../../lib/processReview";
import { FASES_DE_PROTOCOLO } from "../../lib/processWorkflow";

type Props = {
  usuario?: { nome?: string };
  onNavigate: (destino: string) => void;
};

type Item = Record<string, unknown>;

function dataLocal(valor?: unknown) {
  if (!valor) return "Sem data";
  const data = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
  return Number.isNaN(data.getTime()) ? "Sem data" : new Intl.DateTimeFormat("pt-BR").format(data);
}

export default function DashboardModule({ usuario, onNavigate }: Props) {
  const [dados, setDados] = useState({ tarefas: [] as Item[], prazos: [] as Item[], protocolos: [] as Processo[], movimentos: [] as Item[], agenda: [] as Item[], ocorrencias: [] as Item[] });
  const [carregando, setCarregando] = useState(true);
  const [semRevisao, setSemRevisao] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const hoje = new Date().toISOString().slice(0, 10);
    const futuro = new Date();
    futuro.setDate(futuro.getDate() + 14);
    const limite = futuro.toISOString().slice(0, 10);
    const respostas = await Promise.allSettled([
      supabase.from("processual_tarefas").select("id,titulo,cliente_nome,data,status,prioridade,tipo").lt("data", hoje).in("status", ["Pendente", "Em andamento", "Atrasada"]).order("data").limit(20),
      supabase.from("processos").select("id,nome_cliente,numero_processo,proximo_prazo,status_judicial").gte("proximo_prazo", hoje).lte("proximo_prazo", limite).order("proximo_prazo").limit(20),
      supabase.from("processos").select("*").or("numero_processo.is.null,numero_processo.eq.").in("fase_atual", [...FASES_DE_PROTOCOLO]).order("updated_at", { ascending: false }).limit(100),
      supabase.from("processos").select("id,nome_cliente,numero_processo,ultima_movimentacao,ultima_movimentacao_data").eq("com_pendencia", true).not("numero_processo", "is", null).order("ultima_movimentacao_data", { ascending: false }).limit(20),
      supabase.from("processual_tarefas").select("id,titulo,cliente_nome,data,horario,tipo,status").in("tipo", ["Reunião", "Audiência"]).gte("data", hoje).lte("data", limite).order("data").limit(20),
      supabase.from("processual_ocorrencias").select("id,cliente_nome,categoria,descricao,created_at,resolvido").is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
      getProcessesWithoutReviewCount(supabase),
    ]);
    const valor = <T,>(indice: number) => respostas[indice].status === "fulfilled" && !respostas[indice].value.error ? (respostas[indice].value.data || []) as T[] : [];
    setDados({ tarefas: valor<Item>(0), prazos: valor<Item>(1), protocolos: valor<Processo>(2), movimentos: valor<Item>(3), agenda: valor<Item>(4), ocorrencias: valor<Item>(5) });
    setSemRevisao(respostas[6].status === "fulfilled" ? respostas[6].value : 0);
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const protocolosAtrasados = useMemo(() => dados.protocolos.filter((item) => calcularPrazoElite(item.data_envio_elite).diasUteisAtraso > 0), [dados.protocolos]);
  const cards = [
    ["Tarefas atrasadas", dados.tarefas.length, "agenda-atividades", "Pendências operacionais vencidas"],
    ["Prazos próximos", dados.prazos.length, "agenda-atividades", "Próximos 14 dias"],
    ["Protocolos pendentes", dados.protocolos.length, "processual-protocolos", "Casos ainda não distribuídos"],
    ["Protocolos atrasados", protocolosAtrasados.length, "processual-protocolos", "Prazo de 20 dias úteis excedido"],
    ["Movimentações pendentes", dados.movimentos.length, "processual", "Aguardando tratamento"],
    ["Reuniões e audiências", dados.agenda.length, "agenda-atividades", "Próximos 14 dias"],
    ["Ocorrências recentes", dados.ocorrencias.length, "agenda-atividades", "Registros mais recentes"],
    ["Processos sem revisão", semRevisao, "alertas", "Mesma regra utilizada em Alertas"],
  ] as const;

  return <section className="dashboard-resumo">
    <header className="dashboard-cabecalho"><div><span className="eyebrow">Área de trabalho</span><h2>Olá, {usuario?.nome?.split(" ")[0] || "equipe"}</h2><p>Um resumo objetivo do que precisa de atenção no escritório.</p></div><button className="btn-secondary compact" type="button" onClick={carregar}>Atualizar</button></header>
    <div className="dashboard-cards">{cards.map(([titulo, total, destino, legenda]) => <button type="button" className="dashboard-card" key={titulo} onClick={() => onNavigate(destino)}><span>{titulo}</span><strong>{carregando ? "—" : total}</strong><small>{legenda}</small></button>)}</div>
    <div className="dashboard-listas">
      <section><header><h3>Próximos prazos</h3><button onClick={() => onNavigate("agenda-atividades")} type="button">Ver todos</button></header>{dados.prazos.slice(0, 5).map(item => <article key={String(item.id)}><div><strong>{String(item.nome_cliente || "Cliente")}</strong><span>{String(item.numero_processo || "Processo sem número")}</span></div><time>{dataLocal(item.proximo_prazo)}</time></article>)}{!carregando && !dados.prazos.length && <p>Nenhum prazo próximo.</p>}</section>
      <section><header><h3>Protocolos que exigem atenção</h3><button onClick={() => onNavigate("processual-protocolos")} type="button">Abrir Kanban</button></header>{dados.protocolos.slice(0, 5).map(item => <article key={item.id}><div><strong>{item.nome_cliente}</strong><span>{item.fase_atual || "A fazer"}</span></div><time>{calcularPrazoElite(item.data_envio_elite).rotulo}</time></article>)}{!carregando && !dados.protocolos.length && <p>Nenhum protocolo pendente.</p>}</section>
      <section><header><h3>Agenda próxima</h3><button onClick={() => onNavigate("agenda-atividades")} type="button">Abrir agenda</button></header>{dados.agenda.slice(0, 5).map(item => <article key={String(item.id)}><div><strong>{String(item.titulo || item.tipo || "Compromisso")}</strong><span>{String(item.cliente_nome || "Sem cliente vinculado")}</span></div><time>{dataLocal(item.data)}</time></article>)}{!carregando && !dados.agenda.length && <div className="dashboard-empty-agenda"><span className="calendar-illustration" aria-hidden="true"><span /></span><p>Nenhuma reunião ou audiência próxima.</p></div>}</section>
    </div>
  </section>;
}
