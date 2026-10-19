import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { calcularPrazoElite } from "../lib/esteiraProcessual";
import { pertenceAProtocolos } from "../lib/processWorkflow";

const FASES_PROTOCOLO = ["Solicitado para Ajuizamento", "Documentação", "Procuração", "CRM", "Enviado para Elite", "SLA", "Pasta Retornada", "Pré-Distribuição", "Distribuição", "Documentos Pendentes", "Documentos Concluídos"];
const dateText = (value) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Data não informada";

function localDateValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateValue(date);
}

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    async function loadNotifications() {
      setLoading(true);
      setError("");
      const today = localDateValue(new Date());
      const from = dateOffset(-365);
      const until = dateOffset(30);
      const [protocolResult, taskResult, deadlineResult] = await Promise.all([
        supabase.from("processos").select("id,nome_cliente,numero_processo,fase_atual,status_judicial,origem_registro,data_envio_elite").in("fase_atual", FASES_PROTOCOLO).gte("data_envio_elite", from).lte("data_envio_elite", today).order("data_envio_elite", { ascending: false }).limit(500),
        supabase.from("processual_tarefas").select("id,titulo,cliente_nome,data,status").gte("data", dateOffset(-90)).lt("data", today).in("status", ["Pendente", "Em andamento", "Atrasada"]).order("data", { ascending: true }).limit(50),
        supabase.from("processos").select("id,nome_cliente,numero_processo,proximo_prazo").not("numero_processo", "is", null).gte("proximo_prazo", dateOffset(-90)).lte("proximo_prazo", until).order("proximo_prazo", { ascending: true }).limit(50),
      ]);
      if (!active) return;

      const failures = [protocolResult, taskResult, deadlineResult].filter((result) => result.error);
      if (failures.length) setError("Alguns avisos não puderam ser carregados.");
      const protocols = (protocolResult.data || [])
        .filter(pertenceAProtocolos)
        .map((processo) => ({ processo, prazo: calcularPrazoElite(processo.data_envio_elite) }))
        .filter(({ prazo }) => ["atencao", "critico", "vermelho", "atrasado"].includes(prazo.sinalizacao))
        .map(({ processo, prazo }) => ({ id: `protocolo-${processo.id}`, title: processo.nome_cliente || "Cliente", detail: prazo.sinalizacao === "atrasado" ? prazo.rotulo : `${prazo.rotulo} · ${prazo.diasUteisRestantes ?? 0} dias úteis`, date: processo.data_envio_elite }));
      const tasks = (taskResult.data || []).map((task) => ({ id: `tarefa-${task.id}`, title: task.titulo || "Tarefa vencida", detail: task.cliente_nome || task.status, date: task.data }));
      const deadlines = (deadlineResult.data || [])
        .map((processo) => ({ id: `prazo-${processo.id}`, title: processo.nome_cliente || "Processo judicial", detail: processo.numero_processo || "Prazo judicial", date: processo.proximo_prazo }))
        .filter((item) => item.date);
      setGroups([
        { id: "protocolos", title: "Protocolos vencendo ou atrasados", items: protocols },
        { id: "tarefas", title: "Tarefas vencidas", items: tasks },
        { id: "prazos", title: "Prazos judiciais", items: deadlines },
      ]);
      setLoaded(true);
      setLoading(false);
    }
    void loadNotifications();
    return () => { active = false; };
  }, [loaded, open]);

  return (
    <div className="notification-wrap">
      <button className="header-icon-button notification-trigger" type="button" aria-label="Notificações" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {total > 0 && <span className="notification-dot" aria-label={`${total} avisos`} />}
      </button>
      {open && <section className="notification-panel" aria-label="Caixa de notificações">
        <header><div><span className="workspace-eyebrow">Avisos</span><h2>Notificações</h2></div><div className="notification-panel-actions">{loaded && <button className="notification-refresh" type="button" onClick={() => { setGroups([]); setLoading(true); setLoaded(false); }}>Atualizar</button>}<button className="notification-close" type="button" aria-label="Fechar notificações" onClick={() => setOpen(false)}>×</button></div></header>
        {loading ? <p className="notification-empty">Carregando avisos…</p> : error && !loaded ? <p className="notification-empty" role="alert">{error}</p> : <>
          {error && <p className="notification-error" role="status">{error}</p>}
          {groups.map((group) => <section className="notification-group" key={group.id}>
            <h3>{group.title}</h3>
            {group.items.length ? group.items.map((item) => <article className="notification-item" key={item.id}>
              <span><strong>{item.title}</strong><small>{item.detail}</small></span><time>{dateText(item.date)}</time>
            </article>) : <p className="notification-clear">Nenhum aviso.</p>}
          </section>)}
        </>}
      </section>}
    </div>
  );
}
