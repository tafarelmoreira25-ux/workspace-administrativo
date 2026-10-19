import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { FormField, Input, Select, Textarea } from "./common/FormControls";
import "./workspaceJuridico.css";

const PAGE_SIZE = 25;
const CLIENT_COLS = "id,nome,nome_completo,cpf,banco,numero_acao_extrajudicial,numero_processo_judicial,representante,created_at";
const HISTORY_COLS = "registro_id,cliente_id,processo_id,data,descricao,etapa,autor,origem";
const DEAL_COLS = "registro_id,cliente_id,cliente_nome,banco,data,divida,saldo_atual,parcelas_atrasadas,desconto,observacao,desfecho,status,origem";
const MONEY = (value) => value === "" || value == null ? null : Number(String(value).replace(/\./g, "").replace(",", "."));
const dateLabel = (value) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value)) : "—";
const numberLabel = (value) => value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function WorkspaceJuridico({ view, usuario, notify, searchValue = "", onSearchChange = () => {} }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [deals, setDeals] = useState([]);
  const [dealsTotal, setDealsTotal] = useState(0);
  const [dealsPage, setDealsPage] = useState(0);
  const [dealsRefresh, setDealsRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(searchValue.trim());
  const [form, setForm] = useState({ nome_completo: "", cpf: "", banco: "", numero_acao_extrajudicial: "", numero_processo_judicial: "", representante: "" });
  const [movement, setMovement] = useState({ data: new Date().toISOString().slice(0, 10), etapa: "Extrajudicial", descricao: "" });
  const [deal, setDeal] = useState({ data: new Date().toISOString().slice(0, 10), divida: "", saldo_atual: "", parcelas_atrasadas: "", desconto: "", observacao: "", desfecho: "" });
  const processMode = view === "processual";
  const listMode = ["clientes", "extrajudicial", "processual", "homologacao"].includes(view);
  const title = view === "clientes" ? "Clientes" : view === "extrajudicial" ? "Clientes extrajudiciais" : view === "processual" ? "Clientes processuais" : "Homologação e quitação";
  const filtered = useMemo(() => rows, [rows]);

  useEffect(() => {
    const debounce = window.setTimeout(() => setQuery(searchValue.trim()), 250);
    return () => window.clearTimeout(debounce);
  }, [searchValue]);

  const loadClients = useCallback(async () => {
    if (!listMode || view === "inicio") return null;
    let req = supabase.from("clientes").select(CLIENT_COLS, { count: "exact" }).order("created_at", { ascending: false });
    if (processMode) req = req.not("numero_processo_judicial", "is", null).neq("numero_processo_judicial", "");
    if (query) req = req.or(`nome_completo.ilike.%${query}%,nome.ilike.%${query}%,cpf.ilike.%${query}%,banco.ilike.%${query}%,numero_acao_extrajudicial.ilike.%${query}%,numero_processo_judicial.ilike.%${query}%`);
    req = req.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    return await req;
  }, [listMode, view, processMode, query, page]);

  const loadDeals = useCallback(async () => {
    if (view !== "homologacao") return null;
    let req = supabase.from("workspace_homologacoes_unificadas").select(DEAL_COLS, { count: "exact" }).order("data", { ascending: false, nullsFirst: false }).order("registro_id", { ascending: false });
    if (query) req = req.or(`cliente_nome.ilike.%${query}%,banco.ilike.%${query}%,status.ilike.%${query}%,desfecho.ilike.%${query}%`);
    return await req.range(dealsPage * PAGE_SIZE, dealsPage * PAGE_SIZE + PAGE_SIZE - 1);
  }, [view, query, dealsPage]);

  useEffect(() => {
    let active = true;
    loadClients().then((result) => {
      if (!active || !result) return;
      setLoading(false);
      if (result.error) { notify(`Não foi possível carregar clientes: ${result.error.message}`); return; }
      setRows(result.data || []);
      setTotal(result.count || 0);
    });
    return () => { active = false; };
  }, [loadClients, notify]);

  useEffect(() => {
    let active = true;
    loadDeals().then((result) => {
      if (!active || !result) return;
      setDealsLoading(false);
      if (result.error) { notify(`Não foi possível consultar as homologações: ${result.error.message}`); return; }
      setDeals(result.data || []);
      setDealsTotal(result.count || 0);
    });
    return () => { active = false; };
  }, [loadDeals, dealsRefresh, notify]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    async function loadTimeline() {
      const { data, count, error } = await supabase.from("workspace_historico_unificado").select(HISTORY_COLS, { count: "exact" }).eq("cliente_id", selected.id).order("data", { ascending: false, nullsFirst: false }).order("registro_id", { ascending: false }).range(historyPage * PAGE_SIZE, historyPage * PAGE_SIZE + PAGE_SIZE - 1);
      if (!active) return;
      setHistoryLoading(false);
      if (error) { notify(`Não foi possível carregar o histórico: ${error.message}`); return; }
      setHistory((data || []).map((item) => ({ ...item, event_id: item.registro_id, event_date: item.data, event_title: item.etapa || item.origem, event_description: item.descricao, event_author: item.autor })));
      setHistoryTotal(count || 0);
    }
    void loadTimeline();
    return () => { active = false; };
  }, [selected, historyPage, historyRefresh, notify]);

  function changeForm(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  async function openClient(client) {
    setSelected(client);
    setHistory([]);
    setHistoryTotal(0);
    setHistoryLoading(true);
    setHistoryPage(0);
  }
  async function openDealClient(item) {
    if (item.cliente_id == null) return;
    const existing = rows.find((row) => String(row.id) === String(item.cliente_id));
    if (existing) { await openClient(existing); return; }
    const { data, error } = await supabase.from("clientes").select(CLIENT_COLS).eq("id", item.cliente_id).maybeSingle();
    if (error || !data) { notify(error ? `Não foi possível abrir o cliente: ${error.message}` : "Cliente vinculado indisponível para esta conta."); return; }
    await openClient(data);
  }

  async function createClient(event) {
    event.preventDefault();
    setBusy(true);
    const nome = form.nome_completo.trim();
    const payload = { nome, nome_completo: nome, cpf: form.cpf.trim() || null, banco: form.banco.trim() || null, numero_acao_extrajudicial: form.numero_acao_extrajudicial.trim() || null, numero_processo_judicial: form.numero_processo_judicial.trim() || null, representante: form.representante.trim() || null, created_by: usuario.auth_id || null };
    const { data, error } = await supabase.from("clientes").insert(payload).select(CLIENT_COLS).single();
    setBusy(false);
    if (error) { notify(`Não foi possível cadastrar: ${error.message}`); return; }
    setForm({ nome_completo: "", cpf: "", banco: "", numero_acao_extrajudicial: "", numero_processo_judicial: "", representante: "" });
    setFormOpen(false); setPage(0); onSearchChange(""); setRows((current) => [data, ...current].slice(0, PAGE_SIZE)); setTotal((count) => count + 1);
    notify("Cliente cadastrado.");
  }

  async function saveClientField(field, value) {
    const { data, error } = await supabase.from("clientes").update({ [field]: value.trim() || null, updated_by: usuario.auth_id || null }).eq("id", selected.id).select(CLIENT_COLS).single();
    if (error) { notify(`Não foi possível atualizar: ${error.message}`); return; }
    setSelected(data); setRows((current) => current.map((row) => row.id === data.id ? data : row));
    notify(field === "numero_processo_judicial" ? "Número judicial salvo; cliente agora consta em Processual." : "Cadastro atualizado.");
  }

  async function saveMovement(event) {
    event.preventDefault();
    if (!selected) return;
    const { error } = await supabase.from("clientes_historico").insert({ cliente_id: selected.id, tipo: "movimentacao", etapa: movement.etapa, descricao: movement.descricao.trim(), created_at: new Date(`${movement.data}T12:00:00`).toISOString(), created_by: usuario.nome || usuario.email });
    if (error) { notify(`Não foi possível registrar a movimentação: ${error.message}`); return; }
    setMovement((current) => ({ ...current, descricao: "" }));
    setHistoryRefresh((value) => value + 1);
    notify("Movimentação registrada.");
  }

  async function saveDeal(event) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    const payload = { cliente_id: selected.id, data: deal.data, divida: MONEY(deal.divida), saldo_atual: MONEY(deal.saldo_atual), parcelas_atrasadas: deal.parcelas_atrasadas ? Number(deal.parcelas_atrasadas) : null, desconto: MONEY(deal.desconto), observacao: deal.observacao.trim() || null, desfecho: deal.desfecho || null, created_by: usuario.auth_id || null };
    const { error } = await supabase.from("clientes_homologacoes").insert(payload);
    setBusy(false);
    if (error) { notify(`Não foi possível salvar a negociação: ${error.message}`); return; }
    setDeal((current) => ({ ...current, divida: "", saldo_atual: "", parcelas_atrasadas: "", desconto: "", observacao: "" }));
    setDealsPage(0); setDealsRefresh((value) => value + 1); setHistoryPage(0); setHistoryRefresh((value) => value + 1);
    notify("Negociação registrada.");
  }

  if (view === "inicio") return null;

  return <section className="workspace-juridico">
    <div className="workspace-heading"><div><p className="workspace-eyebrow">Atendimento e acompanhamento</p><h1>{title}</h1><p>{view === "homologacao" ? "Negociações novas, antigas e pendentes de reconciliação." : "Cadastro único e histórico compartilhado por cliente."}</p></div>{view === "clientes" && <button className="primary-action" type="button" onClick={() => setFormOpen((value) => !value)}>{formOpen ? "Fechar" : "Cadastrar cliente"}</button>}</div>

    {formOpen && view === "clientes" && <form className="client-form workspace-card" onSubmit={createClient}><FormField>Nome completo *<Input required value={form.nome_completo} onChange={(event) => changeForm("nome_completo", event.target.value)} /></FormField><FormField>CPF *<Input required value={form.cpf} onChange={(event) => changeForm("cpf", event.target.value)} /></FormField><FormField>Banco *<Input required value={form.banco} onChange={(event) => changeForm("banco", event.target.value)} /></FormField><FormField>Ação extrajudicial *<Input required value={form.numero_acao_extrajudicial} onChange={(event) => changeForm("numero_acao_extrajudicial", event.target.value)} /></FormField><FormField>Número judicial (opcional)<Input value={form.numero_processo_judicial} onChange={(event) => changeForm("numero_processo_judicial", event.target.value)} /></FormField><FormField>Advogado/representante<Input value={form.representante} onChange={(event) => changeForm("representante", event.target.value)} /></FormField><button disabled={busy} className="primary-action">{busy ? "Salvando…" : "Salvar cliente"}</button></form>}

    {view === "homologacao" && <section className="workspace-card legacy-deals"><div className="section-heading"><div><h2>Histórico de negociações</h2><p>Registros sem cliente vinculado permanecem disponíveis para reconciliação.</p></div></div><div className="deal-list" aria-live="polite">
      {dealsLoading ? <p className="empty-state">Carregando negociações…</p> : deals.length ? deals.map((item) => <article className="deal-row" key={item.registro_id}><div className="deal-main"><div className="deal-identity"><strong>{item.cliente_nome || "Cliente não identificado"}</strong><small>{item.banco || "Instituição não informada"} · {dateLabel(item.data)} · {item.origem === "legado" ? "Registro legado" : "Registro novo"}</small></div><span className={`deal-status${item.cliente_id == null ? " deal-status-pending" : ""}`}>{item.cliente_id == null ? "Pendente de reconciliação" : item.status || "Em negociação"}</span></div><div className="deal-facts"><span>Dívida <b>{numberLabel(item.divida)}</b></span><span>Saldo <b>{numberLabel(item.saldo_atual)}</b></span><span>Parcelas atrasadas <b>{item.parcelas_atrasadas ?? "—"}</b></span><span>Desconto <b>{numberLabel(item.desconto)}</b></span></div>{item.observacao && <p className="deal-observation">{item.observacao}</p>}{item.cliente_id != null && <button className="text-action" type="button" onClick={() => void openDealClient(item)}>Abrir ficha do cliente</button>}</article>) : <p className="empty-state">Nenhuma negociação encontrada.</p>}
    </div>{dealsTotal > PAGE_SIZE && <div className="pager"><button disabled={!dealsPage} onClick={() => { setDealsLoading(true); setDealsPage((value) => value - 1); }}>Anterior</button><span>{dealsPage + 1} / {Math.ceil(dealsTotal / PAGE_SIZE)}</span><button disabled={(dealsPage + 1) * PAGE_SIZE >= dealsTotal} onClick={() => { setDealsLoading(true); setDealsPage((value) => value + 1); }}>Próxima</button></div>}</section>}

    {listMode && <div className="workspace-card"><FormField className="search-label">{view === "homologacao" ? "Buscar cliente para registrar negociação" : "Buscar cliente"}<Input type="search" placeholder="Nome, CPF, banco ou número" value={searchValue} onChange={(event) => { onSearchChange(event.target.value); setPage(0); setDealsPage(0); setLoading(true); setDealsLoading(true); }} /></FormField><div className="client-list">{loading ? <p className="empty-state">Buscando clientes…</p> : filtered.length ? filtered.map((client) => <button className="client-row" key={client.id} type="button" onClick={() => void openClient(client)}><span><strong>{client.nome_completo || client.nome}</strong><small>{client.cpf || "CPF não informado"} · {client.banco || "Banco não informado"}</small></span><small>{processMode ? client.numero_processo_judicial : client.numero_acao_extrajudicial || "Sem ação extrajudicial"}</small></button>) : <p className="empty-state">Nenhum cliente encontrado.</p>}</div>{total > PAGE_SIZE && <div className="pager"><button disabled={!page} onClick={() => { setLoading(true); setPage((value) => value - 1); }}>Anterior</button><span>{page + 1} / {Math.ceil(total / PAGE_SIZE)}</span><button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>Próxima</button></div>}</div>}

    {selected && <div className="workspace-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="workspace-card workspace-detail" role="dialog" aria-modal="true" aria-label={`Ficha de ${selected.nome_completo || selected.nome}`}><button className="close-detail" type="button" onClick={() => setSelected(null)}>Fechar</button><p className="workspace-eyebrow">Ficha do cliente</p><h2>{selected.nome_completo || selected.nome}</h2><div className="detail-grid"><p><small>CPF</small><strong>{selected.cpf || "—"}</strong></p><p><small>Banco</small><strong>{selected.banco || "—"}</strong></p><p><small>Ação extrajudicial</small><strong>{selected.numero_acao_extrajudicial || "—"}</strong></p><p><small>Advogado/representante</small><strong>{selected.representante || "—"}</strong></p></div><FormField>Número judicial<Input key={`${selected.id}-${selected.numero_processo_judicial || ""}`} defaultValue={selected.numero_processo_judicial || ""} placeholder="Informe para encaminhar a Processual" onBlur={(event) => { if (event.target.value !== (selected.numero_processo_judicial || "")) void saveClientField("numero_processo_judicial", event.target.value); }} /></FormField>
      {view === "homologacao" ? <form className="deal-form" onSubmit={saveDeal}><h3>Contato com o banco</h3><FormField>Data<Input type="date" required value={deal.data} onChange={(event) => setDeal({ ...deal, data: event.target.value })} /></FormField><FormField>Dívida<Input inputMode="decimal" value={deal.divida} onChange={(event) => setDeal({ ...deal, divida: event.target.value })} /></FormField><FormField>Saldo atual<Input inputMode="decimal" value={deal.saldo_atual} onChange={(event) => setDeal({ ...deal, saldo_atual: event.target.value })} /></FormField><FormField>Parcelas atrasadas<Input type="number" min="0" value={deal.parcelas_atrasadas} onChange={(event) => setDeal({ ...deal, parcelas_atrasadas: event.target.value })} /></FormField><FormField>Desconto<Input inputMode="decimal" value={deal.desconto} onChange={(event) => setDeal({ ...deal, desconto: event.target.value })} /></FormField><FormField>Desfecho<Select value={deal.desfecho} onChange={(event) => setDeal({ ...deal, desfecho: event.target.value })}><option value="">Em negociação</option><option>Quitado</option><option>Distrato</option></Select></FormField><FormField className="full-field">Observação curta<Textarea maxLength={500} value={deal.observacao} onChange={(event) => setDeal({ ...deal, observacao: event.target.value })} /></FormField><button className="primary-action" disabled={busy}>{busy ? "Salvando…" : "Registrar negociação"}</button></form> : <form className="movement-form" onSubmit={saveMovement}><h3>Nova movimentação</h3><FormField>Data<Input type="date" required value={movement.data} onChange={(event) => setMovement({ ...movement, data: event.target.value })} /></FormField><FormField>Etapa<Select value={movement.etapa} onChange={(event) => setMovement({ ...movement, etapa: event.target.value })}><option>Extrajudicial</option><option>Processual</option></Select></FormField><FormField className="full-field">Descrição<Textarea required maxLength={1000} value={movement.descricao} onChange={(event) => setMovement({ ...movement, descricao: event.target.value })} /></FormField><button className="primary-action">Registrar</button></form>}
      <section className="timeline"><div className="timeline-heading"><h3>Histórico do cliente</h3>{historyTotal > PAGE_SIZE && <span>{historyPage + 1} / {Math.ceil(historyTotal / PAGE_SIZE)}</span>}</div>{historyLoading ? <p className="empty-state">Carregando histórico…</p> : history.length ? history.map((item) => <article key={item.event_id}><time>{dateLabel(item.event_date)}</time><span className="timeline-stage">{item.event_title || "Movimentação"}</span><p>{item.event_description || "Sem descrição"}</p>{item.event_author && <small>{item.event_author}</small>}</article>) : <p className="empty-state">Nenhuma movimentação registrada.</p>}{historyTotal > PAGE_SIZE && <div className="pager"><button disabled={!historyPage} onClick={() => setHistoryPage((value) => value - 1)}>Anterior</button><button disabled={(historyPage + 1) * PAGE_SIZE >= historyTotal} onClick={() => setHistoryPage((value) => value + 1)}>Próxima</button></div>}</section></section></div>}
  </section>;
}
