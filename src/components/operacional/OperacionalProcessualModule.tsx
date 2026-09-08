import { type Dispatch, type FormEvent, type SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./operacionalProcessual.css";

type Usuario = { nome?: string; email?: string };
type View = "tarefas" | "agenda" | "atendimentos";
type Tarefa = {
  id: string;
  titulo: string;
  descricao: string | null;
  cliente_id: string | null;
  processo_id: string | null;
  cliente_nome: string | null;
  processo_numero: string | null;
  tipo: string;
  data: string;
  horario: string | null;
  responsavel: string | null;
  prioridade: string;
  status: string;
  lembrete: string | null;
  observacao: string | null;
  created_at: string;
};
type Atendimento = {
  id: string;
  cliente_id: string | null;
  processo_id: string | null;
  cliente_nome: string;
  processo_numero: string | null;
  data: string;
  hora: string | null;
  canal: string;
  tipo: string | null;
  descricao: string;
  responsavel: string | null;
  anexo_url: string | null;
  created_at: string;
};
type ProcessoOpcao = { id: string; nome_cliente: string; cpf_cliente: string | null; numero_processo: string | null; banco_reu: string | null; cliente_id?: string | null };

type Props = { usuario: Usuario; showToast?: (mensagem: string) => void; initialView?: View };

const TIPOS_TAREFA = ["Contato cliente", "Revisar processo", "Verificar protocolo", "Cobrar assinatura", "Solicitar documento", "Custas", "Reunião", "Audiência", "Prazo processual", "Tarefa interna", "Outro"];
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Crítica"];
const STATUS_TAREFA = ["Pendente", "Em andamento", "Concluída", "Cancelada", "Atrasada"];
const CANAIS = ["WhatsApp", "Telefone", "E-mail", "Reunião", "Presencial", "Outro"];
const EVENTOS = ["Tarefa", "Prazo", "Reunião", "Audiência", "Revisão", "Contato"];
const VISAO_AGENDA = ["Hoje", "Semana", "Mês", "Lista"];

function hojeInput() {
  return new Date().toISOString().slice(0, 10);
}

function horaInput() {
  return new Date().toTimeString().slice(0, 5);
}

function limpar(valor: string) {
  const texto = valor.trim();
  return texto || null;
}

function normalizar(valor = "") {
  return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function formatarData(data?: string | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${data}T00:00:00`));
}

function formatarDataHora(data?: string | null, hora?: string | null) {
  if (!data) return "—";
  return `${formatarData(data)}${hora ? `, ${hora}` : ""}`;
}

function criarTarefaForm(usuario?: Usuario) {
  return {
    titulo: "",
    descricao: "",
    cliente: "",
    processo_id: "",
    tipo: "Revisar processo",
    data: hojeInput(),
    horario: "",
    responsavel: usuario?.nome || "",
    prioridade: "Normal",
    status: "Pendente",
    lembrete: "",
    observacao: "",
  };
}

function criarAtendimentoForm(usuario?: Usuario) {
  return {
    cliente: "",
    processo_id: "",
    data: hojeInput(),
    hora: horaInput(),
    canal: "WhatsApp",
    tipo: "Contato cliente",
    descricao: "",
    responsavel: usuario?.nome || "",
    anexo_url: "",
  };
}

function inicioDaSemana(data: Date) {
  const base = new Date(data);
  const dia = base.getDay();
  base.setDate(base.getDate() - (dia === 0 ? 6 : dia - 1));
  base.setHours(0, 0, 0, 0);
  return base;
}

function estaNoPeriodo(data: string, visao: string) {
  const alvo = new Date(`${data}T00:00:00`);
  const hoje = new Date();
  alvo.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  if (visao === "Lista") return true;
  if (visao === "Hoje") return alvo.getTime() === hoje.getTime();
  if (visao === "Semana") {
    const inicio = inicioDaSemana(hoje);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 6);
    return alvo >= inicio && alvo <= fim;
  }
  return alvo.getMonth() === hoje.getMonth() && alvo.getFullYear() === hoje.getFullYear();
}

export default function OperacionalProcessualModule({ usuario, showToast, initialView = "agenda" }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [agendaView, setAgendaView] = useState("Hoje");
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [processos, setProcessos] = useState<ProcessoOpcao[]>([]);
  const [busca, setBusca] = useState("");
  const [tarefaForm, setTarefaForm] = useState(() => criarTarefaForm(usuario));
  const [atendimentoForm, setAtendimentoForm] = useState(() => criarAtendimentoForm(usuario));
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const avisar = useCallback((mensagem: string) => {
    if (showToast) showToast(mensagem);
  }, [showToast]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro("");
    const [tarefasReq, atendimentosReq, processosReq] = await Promise.allSettled([
      supabase.from("processual_tarefas").select("*").order("data", { ascending: true }).order("horario", { ascending: true }),
      supabase.from("processual_atendimentos").select("*").order("data", { ascending: false }).order("hora", { ascending: false }),
      supabase.from("processos").select("id, nome_cliente, cpf_cliente, numero_processo, banco_reu, cliente_id").order("updated_at", { ascending: false }).limit(500),
    ]);

    if (tarefasReq.status === "fulfilled" && !tarefasReq.value.error) setTarefas((tarefasReq.value.data || []) as Tarefa[]);
    else setErro("Execute a migration da Etapa 7 para ativar tarefas, agenda e atendimentos.");

    if (atendimentosReq.status === "fulfilled" && !atendimentosReq.value.error) setAtendimentos((atendimentosReq.value.data || []) as Atendimento[]);
    if (processosReq.status === "fulfilled" && !processosReq.value.error) setProcessos((processosReq.value.data || []) as ProcessoOpcao[]);
    setCarregando(false);
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const processosFiltrados = useMemo(() => {
    const termo = normalizar(tarefaForm.cliente || atendimentoForm.cliente);
    if (!termo) return processos.slice(0, 80);
    return processos.filter((processo) => normalizar(`${processo.nome_cliente} ${processo.cpf_cliente || ""} ${processo.numero_processo || ""} ${processo.banco_reu || ""}`).includes(termo)).slice(0, 80);
  }, [atendimentoForm.cliente, processos, tarefaForm.cliente]);

  const tarefasFiltradas = useMemo(() => {
    const termo = normalizar(busca);
    return tarefas.filter((tarefa) => !termo || normalizar(`${tarefa.titulo} ${tarefa.cliente_nome || ""} ${tarefa.processo_numero || ""} ${tarefa.responsavel || ""} ${tarefa.tipo}`).includes(termo));
  }, [busca, tarefas]);

  const atendimentosFiltrados = useMemo(() => {
    const termo = normalizar(busca);
    return atendimentos.filter((atendimento) => !termo || normalizar(`${atendimento.cliente_nome} ${atendimento.processo_numero || ""} ${atendimento.canal} ${atendimento.tipo || ""} ${atendimento.descricao}`).includes(termo));
  }, [atendimentos, busca]);

  const eventosAgenda = useMemo(() => {
    return tarefasFiltradas
      .filter((tarefa) => estaNoPeriodo(tarefa.data, agendaView))
      .map((tarefa) => ({
        id: tarefa.id,
        tipo: tarefa.tipo === "Prazo processual" ? "Prazo" : tarefa.tipo === "Audiência" ? "Audiência" : tarefa.tipo === "Reunião" ? "Reunião" : tarefa.tipo === "Contato cliente" ? "Contato" : "Tarefa",
        titulo: tarefa.titulo,
        cliente: tarefa.cliente_nome,
        data: tarefa.data,
        hora: tarefa.horario,
        status: tarefa.status,
        prioridade: tarefa.prioridade,
        responsavel: tarefa.responsavel,
      }));
  }, [agendaView, tarefasFiltradas]);

  function processoSelecionado(id: string) {
    return processos.find((processo) => String(processo.id) === String(id));
  }

  async function salvarTarefa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!tarefaForm.titulo.trim()) {
      avisar("Informe o título da tarefa.");
      return;
    }
    const processo = processoSelecionado(tarefaForm.processo_id);
    const clienteNome = limpar(tarefaForm.cliente) || processo?.nome_cliente || null;
    setSalvando(true);
    const { data, error } = await supabase.from("processual_tarefas").insert({
      titulo: tarefaForm.titulo.trim(),
      descricao: limpar(tarefaForm.descricao),
      cliente_id: processo?.cliente_id || null,
      processo_id: processo?.id || null,
      cliente_nome: clienteNome,
      processo_numero: processo?.numero_processo || null,
      tipo: tarefaForm.tipo,
      data: tarefaForm.data,
      horario: tarefaForm.horario || null,
      responsavel: limpar(tarefaForm.responsavel) || usuario.nome || null,
      prioridade: tarefaForm.prioridade,
      status: tarefaForm.status,
      lembrete: limpar(tarefaForm.lembrete),
      observacao: limpar(tarefaForm.observacao),
      created_by_nome: usuario.nome || usuario.email || null,
    }).select("*").single();
    setSalvando(false);

    if (error) {
      avisar(`Não foi possível criar a tarefa: ${error.message}`);
      return;
    }
    setTarefas((atuais) => [...atuais, data as Tarefa]);
    if (processo?.id) await supabase.from("movimentacoes").insert({ processo_id: processo.id, categoria: "Tarefa", titulo: tarefaForm.titulo.trim(), descricao: tarefaForm.descricao.trim() || tarefaForm.titulo.trim(), descricao_tecnica: tarefaForm.descricao.trim() || tarefaForm.titulo.trim(), responsavel: tarefaForm.responsavel || usuario.nome || null, fonte: "Manual", importancia: tarefaForm.prioridade === "Crítica" ? "Crítico" : tarefaForm.prioridade === "Alta" ? "Relevante" : "Normal", origem: "manual", created_by_nome: usuario.nome || usuario.email || null });
    setTarefaForm(criarTarefaForm(usuario));
    avisar("Tarefa criada.");
  }

  async function atualizarStatusTarefa(tarefa: Tarefa, status: string) {
    const { data, error } = await supabase.from("processual_tarefas").update({ status, updated_by_nome: usuario.nome || usuario.email || null }).eq("id", tarefa.id).select("*").single();
    if (error) {
      avisar("Não foi possível atualizar a tarefa.");
      return;
    }
    setTarefas((atuais) => atuais.map((item) => item.id === tarefa.id ? data as Tarefa : item));
    if (status === "Concluída" && window.confirm("Tarefa concluída. Registrar atendimento agora?")) {
      setView("atendimentos");
      setAtendimentoForm((form) => ({ ...form, cliente: tarefa.cliente_nome || "", processo_id: tarefa.processo_id || "", descricao: `Atendimento relacionado à tarefa: ${tarefa.titulo}`, responsavel: tarefa.responsavel || usuario.nome || "" }));
    }
  }

  async function salvarAtendimento(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!atendimentoForm.cliente.trim() && !atendimentoForm.processo_id) {
      avisar("Informe o cliente ou selecione um processo.");
      return;
    }
    if (!atendimentoForm.descricao.trim()) {
      avisar("Descreva o atendimento.");
      return;
    }
    const processo = processoSelecionado(atendimentoForm.processo_id);
    const clienteNome = atendimentoForm.cliente.trim() || processo?.nome_cliente || "Cliente não informado";
    const payload = {
      cliente_id: processo?.cliente_id || null,
      processo_id: processo?.id || null,
      cliente_nome: clienteNome,
      processo_numero: processo?.numero_processo || null,
      data: atendimentoForm.data,
      hora: atendimentoForm.hora || null,
      canal: atendimentoForm.canal,
      tipo: limpar(atendimentoForm.tipo),
      descricao: atendimentoForm.descricao.trim(),
      responsavel: limpar(atendimentoForm.responsavel) || usuario.nome || null,
      anexo_url: limpar(atendimentoForm.anexo_url),
      created_by_nome: usuario.nome || usuario.email || null,
    };
    setSalvando(true);
    const { data, error } = await supabase.from("processual_atendimentos").insert(payload).select("*").single();
    if (!error && processo?.id) {
      await supabase.from("movimentacoes").insert({
        processo_id: processo.id,
        data_registro: new Date(`${atendimentoForm.data}T${atendimentoForm.hora || "00:00"}`).toISOString(),
        categoria: "Atendimento",
        titulo: `${atendimentoForm.canal} — ${atendimentoForm.tipo || "Atendimento"}`,
        descricao: atendimentoForm.descricao.trim(),
        descricao_tecnica: atendimentoForm.descricao.trim(),
        responsavel: payload.responsavel,
        fonte: atendimentoForm.canal,
        importancia: "Normal",
        anexo_url: payload.anexo_url,
        origem: "manual",
        created_by_nome: usuario.nome || usuario.email || null,
      });
    }
    setSalvando(false);

    if (error) {
      avisar(`Não foi possível registrar o atendimento: ${error.message}`);
      return;
    }
    setAtendimentos((atuais) => [data as Atendimento, ...atuais]);
    setAtendimentoForm(criarAtendimentoForm(usuario));
    avisar("Atendimento registrado permanentemente.");
  }

  return (
    <section className="operacional-module">
      <header className="module-page-header">
        <div>
          <span className="eyebrow">Operação processual</span>
          <h2>{view === "atendimentos" ? "Atendimentos" : view === "tarefas" ? "Tarefas" : "Agenda e Prazos"}</h2>
          <p>Controle de tarefas, compromissos, prazos e contatos vinculados a clientes e processos.</p>
        </div>
        <div className="operacional-tabs">
          <button className={view === "tarefas" ? "active" : ""} onClick={() => setView("tarefas")} type="button">Tarefas</button>
          <button className={view === "agenda" ? "active" : ""} onClick={() => setView("agenda")} type="button">Agenda</button>
          <button className={view === "atendimentos" ? "active" : ""} onClick={() => setView("atendimentos")} type="button">Atendimentos</button>
        </div>
      </header>

      <div className="operacional-toolbar">
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, processo, responsável ou tipo..." />
        <button className="btn-secondary" onClick={carregarDados} type="button">Atualizar</button>
      </div>

      {erro ? <div className="empty-row">{erro}</div> : null}
      {carregando ? <div className="panel">Carregando registros...</div> : null}

      {!carregando && view === "tarefas" ? (
        <div className="operacional-grid">
          <FormularioTarefa form={tarefaForm} setForm={setTarefaForm} processos={processosFiltrados} onSubmit={salvarTarefa} salvando={salvando} />
          <ListaTarefas tarefas={tarefasFiltradas} onStatus={atualizarStatusTarefa} />
        </div>
      ) : null}

      {!carregando && view === "agenda" ? (
        <section className="operacional-card">
          <div className="agenda-tabs">{VISAO_AGENDA.map((item) => <button key={item} type="button" className={agendaView === item ? "active" : ""} onClick={() => setAgendaView(item)}>{item}</button>)}</div>
          <div className="event-type-row">{EVENTOS.map((item) => <span key={item}>{item}</span>)}</div>
          <div className="agenda-list">
            {eventosAgenda.length === 0 ? <div className="empty-row">Nenhum evento encontrado para esta visão.</div> : eventosAgenda.map((evento) => <article key={evento.id}><strong>{evento.titulo}</strong><span>{evento.tipo} · {evento.cliente || "Cliente não informado"}</span><small>{formatarDataHora(evento.data, evento.hora)} · {evento.status} · {evento.responsavel || "Sem responsável"}</small></article>)}
          </div>
        </section>
      ) : null}

      {!carregando && view === "atendimentos" ? (
        <div className="operacional-grid">
          <FormularioAtendimento form={atendimentoForm} setForm={setAtendimentoForm} processos={processosFiltrados} onSubmit={salvarAtendimento} salvando={salvando} />
          <ListaAtendimentos atendimentos={atendimentosFiltrados} />
        </div>
      ) : null}
    </section>
  );
}

function FormularioTarefa({ form, setForm, processos, onSubmit, salvando }: { form: ReturnType<typeof criarTarefaForm>; setForm: Dispatch<SetStateAction<ReturnType<typeof criarTarefaForm>>>; processos: ProcessoOpcao[]; onSubmit: (evento: FormEvent<HTMLFormElement>) => void; salvando: boolean }) {
  return <form className="operacional-card operacional-form" onSubmit={onSubmit}>
    <h3>Criar tarefa</h3>
    <label><span>Título</span><input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} /></label>
    <label><span>Descrição</span><textarea rows={3} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} /></label>
    <label><span>Cliente</span><input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} placeholder="Nome, CPF ou ID" /></label>
    <label><span>Processo</span><select value={form.processo_id} onChange={(e) => setForm((f) => ({ ...f, processo_id: e.target.value }))}><option value="">Sem vínculo</option>{processos.map((p) => <option key={p.id} value={p.id}>{p.nome_cliente} · {p.numero_processo || "sem CNJ"}</option>)}</select></label>
    <div className="form-pair"><label><span>Tipo</span><select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>{TIPOS_TAREFA.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>Data</span><input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></label></div>
    <div className="form-pair"><label><span>Horário</span><input type="time" value={form.horario} onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))} /></label><label><span>Responsável</span><input value={form.responsavel} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} /></label></div>
    <div className="form-pair"><label><span>Prioridade</span><select value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}>{PRIORIDADES.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>Status</span><select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{STATUS_TAREFA.map((o) => <option key={o}>{o}</option>)}</select></label></div>
    <label><span>Lembrete</span><input value={form.lembrete} onChange={(e) => setForm((f) => ({ ...f, lembrete: e.target.value }))} placeholder="Ex.: 1 dia antes" /></label>
    <label><span>Observação</span><textarea rows={2} value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} /></label>
    <button className="btn-primary" disabled={salvando} type="submit">Criar tarefa</button>
  </form>;
}

function FormularioAtendimento({ form, setForm, processos, onSubmit, salvando }: { form: ReturnType<typeof criarAtendimentoForm>; setForm: Dispatch<SetStateAction<ReturnType<typeof criarAtendimentoForm>>>; processos: ProcessoOpcao[]; onSubmit: (evento: FormEvent<HTMLFormElement>) => void; salvando: boolean }) {
  return <form className="operacional-card operacional-form" onSubmit={onSubmit}>
    <h3>Registrar atendimento</h3>
    <label><span>Cliente</span><input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} /></label>
    <label><span>Processo</span><select value={form.processo_id} onChange={(e) => setForm((f) => ({ ...f, processo_id: e.target.value }))}><option value="">Sem vínculo</option>{processos.map((p) => <option key={p.id} value={p.id}>{p.nome_cliente} · {p.numero_processo || "sem CNJ"}</option>)}</select></label>
    <div className="form-pair"><label><span>Data</span><input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></label><label><span>Hora</span><input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} /></label></div>
    <div className="form-pair"><label><span>Canal</span><select value={form.canal} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))}>{CANAIS.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>Tipo</span><input value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} /></label></div>
    <label><span>Descrição</span><textarea rows={4} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Cliente informado sobre custas." /></label>
    <label><span>Responsável</span><input value={form.responsavel} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} /></label>
    <label><span>Anexo</span><input value={form.anexo_url} onChange={(e) => setForm((f) => ({ ...f, anexo_url: e.target.value }))} placeholder="Link ou caminho do arquivo" /></label>
    <button className="btn-primary" disabled={salvando} type="submit">Registrar atendimento</button>
  </form>;
}

function ListaTarefas({ tarefas, onStatus }: { tarefas: Tarefa[]; onStatus: (tarefa: Tarefa, status: string) => void }) {
  return <section className="operacional-card"><h3>Tarefas</h3><div className="operacional-table"><table><thead><tr><th>Título</th><th>Cliente</th><th>Tipo</th><th>Data</th><th>Prioridade</th><th>Status</th><th>Responsável</th></tr></thead><tbody>{tarefas.length === 0 ? <tr><td colSpan={7}>Nenhuma tarefa cadastrada.</td></tr> : tarefas.map((tarefa) => <tr key={tarefa.id}><td><strong>{tarefa.titulo}</strong><small>{tarefa.descricao || tarefa.observacao || ""}</small></td><td>{tarefa.cliente_nome || "—"}</td><td>{tarefa.tipo}</td><td>{formatarDataHora(tarefa.data, tarefa.horario)}</td><td>{tarefa.prioridade}</td><td><select value={tarefa.status} onChange={(e) => onStatus(tarefa, e.target.value)}>{STATUS_TAREFA.map((o) => <option key={o}>{o}</option>)}</select></td><td>{tarefa.responsavel || "—"}</td></tr>)}</tbody></table></div></section>;
}

function ListaAtendimentos({ atendimentos }: { atendimentos: Atendimento[] }) {
  return <section className="operacional-card"><h3>Atendimentos</h3><div className="atendimento-list">{atendimentos.length === 0 ? <div className="empty-row">Nenhum atendimento registrado.</div> : atendimentos.map((atendimento) => <article key={atendimento.id}><strong>{atendimento.cliente_nome}</strong><span>{atendimento.canal} · {atendimento.tipo || "Atendimento"} · {formatarDataHora(atendimento.data, atendimento.hora)}</span><p>{atendimento.descricao}</p><small>Responsável: {atendimento.responsavel || "Não informado"}{atendimento.processo_numero ? ` · Processo ${atendimento.processo_numero}` : ""}</small>{atendimento.anexo_url ? <a href={atendimento.anexo_url} target="_blank" rel="noreferrer">Abrir anexo</a> : null}</article>)}</div></section>;
}
