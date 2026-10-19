import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./workspaceJuridico.css";

const PAGE_SIZE = 25;
const CLIENT_COLS = "id,nome_completo,cpf,banco,numero_acao_extrajudicial,numero_processo_judicial,representante,created_at";
const MONEY = value => value === "" || value == null ? null : Number(String(value).replace(/\./g, "").replace(",", "."));
const dateLabel = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) : "—";

export default function WorkspaceJuridico({ view, usuario, notify }) {
  const [rows, setRows] = useState([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(0);
  const [query, setQuery] = useState(""); const [selected, setSelected] = useState(null); const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false); const [formOpen, setFormOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ nome_completo: "", cpf: "", banco: "", numero_acao_extrajudicial: "", numero_processo_judicial: "", representante: "" });
  const [movement, setMovement] = useState({ data: new Date().toISOString().slice(0, 10), etapa: "Extrajudicial", descricao: "" });
  const [deal, setDeal] = useState({ data: new Date().toISOString().slice(0, 10), divida: "", saldo_atual: "", parcelas_atrasadas: "", desconto: "", observacao: "", desfecho: "" });
  const processMode = view === "processual";
  const title = view === "inicio" ? "Clientes" : view === "extrajudicial" ? "Clientes extrajudiciais" : view === "processual" ? "Clientes processuais" : "Negociações de homologação";
  const filtered = useMemo(() => rows, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    let req = supabase.from("clientes").select(CLIENT_COLS, { count: "exact" }).order("created_at", { ascending: false });
    if (processMode) req = req.not("numero_processo_judicial", "is", null).neq("numero_processo_judicial", "");
    const term = query.trim();
    if (term) req = req.or(`nome_completo.ilike.%${term}%,cpf.ilike.%${term}%,banco.ilike.%${term}%,numero_acao_extrajudicial.ilike.%${term}%,numero_processo_judicial.ilike.%${term}%`);
    req = req.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    const { data, count, error } = await req;
    setLoading(false);
    if (error) { notify(`Não foi possível carregar clientes: ${error.message}`); return; }
    setRows(data || []); setTotal(count || 0);
  }, [view, processMode, query, page, notify]);
  useEffect(() => { void load(); }, [load]);

  async function openClient(client) {
    setSelected(client); setHistory([]);
    const { data, error } = await supabase.from("clientes_historico").select("id,created_at,descricao,tipo,etapa,created_by").eq("cliente_id", client.id).order("created_at", { ascending: false }).limit(50);
    if (error) notify(`Não foi possível carregar o histórico: ${error.message}`); else setHistory(data || []);
  }
  function changeForm(key, value) { setForm(current => ({ ...current, [key]: value })); }
  async function createClient(event) {
    event.preventDefault(); setBusy(true);
    const payload = { nome_completo: form.nome_completo.trim(), cpf: form.cpf.trim() || null, banco: form.banco.trim() || null, numero_acao_extrajudicial: form.numero_acao_extrajudicial.trim() || null, numero_processo_judicial: form.numero_processo_judicial.trim() || null, representante: form.representante.trim() || null, created_by: usuario.auth_id || null };
    const { data, error } = await supabase.from("clientes").insert(payload).select(CLIENT_COLS).single();
    setBusy(false);
    if (error) { notify(`Não foi possível cadastrar: ${error.message}`); return; }
    setForm({ nome_completo: "", cpf: "", banco: "", numero_acao_extrajudicial: "", numero_processo_judicial: "", representante: "" }); setFormOpen(false); setPage(0); setQuery("");
    setRows(current => [data, ...current].slice(0, PAGE_SIZE)); setTotal(count => count + 1);
    notify("Cliente cadastrado.");
  }
  async function saveClientField(field, value) {
    const { data, error } = await supabase.from("clientes").update({ [field]: value.trim() || null, updated_by: usuario.auth_id || null }).eq("id", selected.id).select(CLIENT_COLS).single();
    if (error) { notify(`Não foi possível atualizar: ${error.message}`); return; }
    setSelected(data); setRows(current => current.map(row => row.id === data.id ? data : row));
    notify(field === "numero_processo_judicial" ? "Número judicial salvo; cliente agora consta em Processual." : "Cadastro atualizado.");
  }
  async function saveMovement(event) {
    event.preventDefault(); if (!selected) return;
    const { data, error } = await supabase.from("clientes_historico").insert({ cliente_id: selected.id, tipo: "movimentacao", etapa: movement.etapa, descricao: movement.descricao.trim(), created_at: new Date(`${movement.data}T12:00:00`).toISOString(), created_by: usuario.nome || usuario.email }).select("id,created_at,descricao,tipo,etapa,created_by").single();
    if (error) { notify(`Não foi possível registrar a movimentação: ${error.message}`); return; }
    setHistory(current => [data, ...current]); setMovement(current => ({ ...current, descricao: "" })); notify("Movimentação registrada.");
  }
  async function saveDeal(event) {
    event.preventDefault(); if (!selected) return;
    const payload = { cliente_id: selected.id, data: deal.data, divida: MONEY(deal.divida), saldo_atual: MONEY(deal.saldo_atual), parcelas_atrasadas: deal.parcelas_atrasadas ? Number(deal.parcelas_atrasadas) : null, desconto: MONEY(deal.desconto), observacao: deal.observacao.trim() || null, desfecho: deal.desfecho || null, created_by: usuario.auth_id || null };
    const { error } = await supabase.from("clientes_homologacoes").insert(payload);
    if (error) { notify(`Não foi possível salvar a negociação: ${error.message}`); return; }
    const line = `Negociação com o banco — dívida ${payload.divida ?? "não informada"}; saldo ${payload.saldo_atual ?? "não informado"}; parcelas atrasadas ${payload.parcelas_atrasadas ?? "não informado"}; desconto ${payload.desconto ?? "não informado"}${payload.desfecho ? `; desfecho: ${payload.desfecho}` : ""}${payload.observacao ? `; ${payload.observacao}` : ""}`;
    await supabase.from("clientes_historico").insert({ cliente_id: selected.id, tipo: "homologacao", etapa: "Homologação", descricao: line, created_by: usuario.nome || usuario.email });
    setDeal(current => ({ ...current, divida: "", saldo_atual: "", parcelas_atrasadas: "", desconto: "", observacao: "" }));
    await openClient(selected); notify("Negociação registrada.");
  }

  return <section className="workspace-juridico">
    <div className="workspace-heading"><div><p className="workspace-eyebrow">Atendimento e acompanhamento</p><h1>{title}</h1><p>Cadastro único e histórico compartilhado por cliente.</p></div>{view === "inicio" && <button className="primary-action" onClick={() => setFormOpen(value => !value)}>{formOpen ? "Fechar" : "Cadastrar cliente"}</button>}</div>
    {view === "inicio" && <>
      {formOpen && <form className="client-form workspace-card" onSubmit={createClient}><label>Nome completo *<input required value={form.nome_completo} onChange={e => changeForm("nome_completo", e.target.value)}/></label><label>CPF *<input required value={form.cpf} onChange={e => changeForm("cpf", e.target.value)}/></label><label>Banco *<input required value={form.banco} onChange={e => changeForm("banco", e.target.value)}/></label><label>Ação extrajudicial *<input required value={form.numero_acao_extrajudicial} onChange={e => changeForm("numero_acao_extrajudicial", e.target.value)}/></label><label>Número judicial (opcional)<input value={form.numero_processo_judicial} onChange={e => changeForm("numero_processo_judicial", e.target.value)}/></label><label>Advogado/representante<input value={form.representante} onChange={e => changeForm("representante", e.target.value)}/></label><button disabled={busy} className="primary-action">{busy ? "Salvando…" : "Salvar cliente"}</button></form>}
      <div className="workspace-card"><label className="search-label">Buscar<input type="search" placeholder="Nome, CPF ou banco" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/></label><div className="client-list">{loading ? <p>Buscando clientes…</p> : filtered.length ? filtered.map(client => <button className="client-row" key={client.id} onClick={() => openClient(client)}><span><strong>{client.nome_completo}</strong><small>{client.cpf || "CPF não informado"} · {client.banco || "Banco não informado"}</small></span><small>{client.numero_acao_extrajudicial || "Sem ação extrajudicial"}{client.numero_processo_judicial ? ` · ${client.numero_processo_judicial}` : ""}</small></button>) : <p>Nenhum cliente encontrado.</p>}</div>{total > PAGE_SIZE && <div className="pager"><button disabled={!page} onClick={() => setPage(n => n - 1)}>Anterior</button><span>{page + 1} / {Math.ceil(total / PAGE_SIZE)}</span><button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(n => n + 1)}>Próxima</button></div>}</div>
    </>}
    {view !== "inicio" && <div className="workspace-card"><label className="search-label">Buscar cliente<input type="search" placeholder="Nome, CPF, banco ou número" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/></label><div className="client-list">{loading ? <p>Buscando clientes…</p> : filtered.length ? filtered.map(client => <button className="client-row" key={client.id} onClick={() => openClient(client)}><span><strong>{client.nome_completo}</strong><small>{client.cpf || "CPF não informado"} · {client.banco || "Banco não informado"}</small></span><small>{processMode ? client.numero_processo_judicial : client.numero_acao_extrajudicial}</small></button>) : <p>Nenhum cliente encontrado.</p>}</div>{total > PAGE_SIZE && <div className="pager"><button disabled={!page} onClick={() => setPage(n => n - 1)}>Anterior</button><span>{page + 1} / {Math.ceil(total / PAGE_SIZE)}</span><button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(n => n + 1)}>Próxima</button></div>}</div>}
    {selected && <div className="workspace-modal-backdrop" onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="workspace-card workspace-detail" role="dialog" aria-modal="true" aria-label={`Ficha de ${selected.nome_completo}`}><button className="close-detail" onClick={() => setSelected(null)}>Fechar</button><p className="workspace-eyebrow">Ficha do cliente</p><h2>{selected.nome_completo}</h2><div className="detail-grid"><p><small>CPF</small><strong>{selected.cpf || "—"}</strong></p><p><small>Banco</small><strong>{selected.banco || "—"}</strong></p><p><small>Ação extrajudicial</small><strong>{selected.numero_acao_extrajudicial || "—"}</strong></p><p><small>Advogado/representante</small><strong>{selected.representante || "—"}</strong></p></div><label>Número judicial<input key={selected.id + selected.numero_processo_judicial} defaultValue={selected.numero_processo_judicial || ""} placeholder="Informe para encaminhar a Processual" onBlur={event => { if (event.target.value !== (selected.numero_processo_judicial || "")) void saveClientField("numero_processo_judicial", event.target.value); }}/></label>
      {view === "homologacao" ? <form className="deal-form" onSubmit={saveDeal}><h3>Contato com o banco</h3><label>Data<input type="date" required value={deal.data} onChange={e => setDeal({ ...deal, data: e.target.value })}/></label><label>Dívida<input inputMode="decimal" value={deal.divida} onChange={e => setDeal({ ...deal, divida: e.target.value })}/></label><label>Saldo atual<input inputMode="decimal" value={deal.saldo_atual} onChange={e => setDeal({ ...deal, saldo_atual: e.target.value })}/></label><label>Parcelas atrasadas<input type="number" min="0" value={deal.parcelas_atrasadas} onChange={e => setDeal({ ...deal, parcelas_atrasadas: e.target.value })}/></label><label>Desconto<input inputMode="decimal" value={deal.desconto} onChange={e => setDeal({ ...deal, desconto: e.target.value })}/></label><label>Desfecho<select value={deal.desfecho} onChange={e => setDeal({ ...deal, desfecho: e.target.value })}><option value="">Em negociação</option><option>Quitado</option><option>Distrato</option></select></label><label className="full-field">Observação curta<textarea maxLength={500} value={deal.observacao} onChange={e => setDeal({ ...deal, observacao: e.target.value })}/></label><button className="primary-action">Registrar negociação</button></form> : <form className="movement-form" onSubmit={saveMovement}><h3>Nova movimentação</h3><label>Data<input type="date" required value={movement.data} onChange={e => setMovement({ ...movement, data: e.target.value })}/></label><label>Etapa<select value={movement.etapa} onChange={e => setMovement({ ...movement, etapa: e.target.value })}><option>Extrajudicial</option><option>Processual</option></select></label><label className="full-field">Descrição<textarea required maxLength={1000} value={movement.descricao} onChange={e => setMovement({ ...movement, descricao: e.target.value })}/></label><button className="primary-action">Registrar</button></form>}
      <section className="timeline"><h3>Histórico do cliente</h3>{history.length ? history.map(item => <article key={item.id}><time>{dateLabel(item.created_at)}</time><span className="timeline-stage">{item.etapa || item.tipo}</span><p>{item.descricao}</p><small>{item.created_by || "Autoria não informada"}</small></article>) : <p>Nenhuma movimentação registrada.</p>}</section></section></div>}
  </section>;
}
