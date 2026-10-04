import { FormField, FormGrid, FormSection, Input, Select, Textarea } from "../common/FormControls";
import { type Dispatch, type FormEvent, type SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { supabase, invalidarConsultas } from "../../lib/supabase";
import GerencialProcessualModule from "../gerencial/GerencialProcessualModule";
import Pagination from "../common/Pagination";
import "./operacionalProcessual.css";

type Usuario = { nome?: string; email?: string };
type View = "tarefas" | "agenda" | "atendimentos" | "ocorrencias";
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

type Props = { usuario: Usuario; showToast?: (mensagem: string) => void; initialView?: View; alerta?: { titulo: string; ids: string[] } | null; onLimparAlerta?: () => void };

const TIPOS_TAREFA = ["Contato cliente", "Revisar processo", "Verificar protocolo", "Cobrar assinatura", "Solicitar documento", "Custas", "Reunião", "Audiência", "Prazo processual", "Tarefa interna", "Outro"];
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Crítica"];
const STATUS_TAREFA = ["Pendente", "Em andamento", "Concluída", "Cancelada", "Atrasada"];
const CANAIS = ["WhatsApp", "Telefone", "E-mail", "Reunião", "Presencial", "Outro"];
type Ocorrencia = { id: string; categoria: string; data: string; prazo: string | null; descricao: string; cliente_nome: string | null; responsavel: string | null; resolvido: boolean };
const TIPOS_EVENTO = ["Tarefa", "Prazo judicial", "Reunião", "Audiência", "Atendimento", "Ocorrência"];
function dataLocal(d: Date) { return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); }
function hojeInput() { return dataLocal(new Date()); }
function aberta(t: Tarefa) { return !["Concluída", "Cancelada"].includes(t.status); }
function tipoEvento(t: Tarefa) { return t.tipo === "Prazo processual" ? "Prazo judicial" : ["Reunião", "Audiência"].includes(t.tipo) ? t.tipo : "Tarefa"; }

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

export default function OperacionalProcessualModule({ usuario, showToast, initialView = "agenda", alerta, onLimparAlerta }: Props) {
  const [formAberto, setFormAberto] = useState<View | null>(initialView === "agenda" ? null : initialView);
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [diaFiltro, setDiaFiltro] = useState("");
  const [mes, setMes] = useState(() => hojeInput().slice(0,7));
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [processos, setProcessos] = useState<ProcessoOpcao[]>([]);
  const [busca, setBusca] = useState("");
  const [tarefaForm, setTarefaForm] = useState(() => criarTarefaForm(usuario));
  const [atendimentoForm, setAtendimentoForm] = useState(() => criarAtendimentoForm(usuario));
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [paginaLista, setPaginaLista] = useState(1);
  const [erro, setErro] = useState("");

  const avisar = useCallback((mensagem: string) => {
    if (showToast) showToast(mensagem);
  }, [showToast]);

  const carregarDados = useCallback(async (signal = new AbortController().signal) => {
    setCarregando(true);
    setErro("");
    const [agendaReq, processosReq] = await Promise.allSettled([
      supabase.rpc("agenda_atividades_consolidada").abortSignal(signal),
      supabase.from("processos").select("id, nome_cliente, cpf_cliente, numero_processo, banco_reu, cliente_id").order("updated_at", { ascending: false }).limit(500).abortSignal(signal),
    ]);
    if (signal.aborted) return;

    if (agendaReq.status === "fulfilled" && !agendaReq.value.error) {
      const registros = agendaReq.value.data || [];
      setTarefas(registros.filter((r: any) => r.origem === "tarefa").map((r: any) => r.registro));
      setAtendimentos(registros.filter((r: any) => r.origem === "atendimento").map((r: any) => r.registro));
      setOcorrencias(registros.filter((r: any) => r.origem === "ocorrencia").map((r: any) => r.registro));
    } else setErro("Não foi possível carregar a agenda. Verifique a conexão e aplique a migration agenda_atividades_consolidada.sql.");
    if (processosReq.status === "fulfilled" && !processosReq.value.error) setProcessos((processosReq.value.data || []) as ProcessoOpcao[]);
    setCarregando(false);
  }, []);

  useEffect(() => { const controller = new AbortController(); void carregarDados(controller.signal); return () => controller.abort(); }, [carregarDados]);
  useEffect(() => { setPaginaLista(1); }, [busca, tipoFiltro, diaFiltro, alerta]);

  const processosFiltrados = useMemo(() => {
    const termo = normalizar(tarefaForm.cliente || atendimentoForm.cliente);
    if (!termo) return processos.slice(0, 80);
    return processos.filter((processo) => normalizar(`${processo.nome_cliente} ${processo.cpf_cliente || ""} ${processo.numero_processo || ""} ${processo.banco_reu || ""}`).includes(termo)).slice(0, 80);
  }, [atendimentoForm.cliente, processos, tarefaForm.cliente]);

  const tarefasFiltradas = useMemo(() => {
    const termo = normalizar(busca);
    return tarefas.filter((tarefa) => (!alerta || alerta.ids.includes(tarefa.id)) && (!termo || normalizar(`${tarefa.titulo} ${tarefa.cliente_nome || ""} ${tarefa.processo_numero || ""} ${tarefa.responsavel || ""} ${tarefa.tipo}`).includes(termo)));
  }, [alerta, busca, tarefas]);

  const hoje = hojeInput();
  const atrasadas = tarefasFiltradas.filter((t) => aberta(t) && (t.data < hoje || t.status === "Atrasada"));
  const recentes = ocorrencias.filter((o) => !alerta && normalizar(o.categoria + " " + (o.cliente_nome || "") + " " + o.descricao).includes(normalizar(busca))).sort((a,b) => b.data.localeCompare(a.data));
  const todosEventos = [
    ...tarefasFiltradas.filter(aberta).map((t) => ({ chave: "tarefa-"+t.id, tipo: tipoEvento(t), titulo: t.titulo, data: t.data, hora: t.horario, cliente: t.cliente_nome, descricao: t.descricao, responsavel: t.responsavel, tarefa: t })),
    ...atendimentos.filter((a) => !alerta && normalizar([a.cliente_nome,a.processo_numero,a.descricao,a.responsavel,a.tipo,a.canal].join(" ")).includes(normalizar(busca))).map((a) => ({ chave: "atendimento-"+a.id, tipo: "Atendimento", titulo: a.tipo || a.canal, data: a.data, hora: a.hora, cliente: a.cliente_nome, descricao: a.descricao, responsavel: a.responsavel, tarefa: null })),
    ...recentes.filter((o) => !o.resolvido).map((o) => ({ chave: "ocorrencia-"+o.id, tipo: "Ocorrência", titulo: o.categoria, data: o.prazo || o.data, hora: null, cliente: o.cliente_nome, descricao: o.descricao, responsavel: o.responsavel, tarefa: null })),
  ];
  const eventos = todosEventos.filter((e) => (!tipoFiltro || e.tipo === tipoFiltro) && (diaFiltro ? e.data === diaFiltro : alerta || e.data >= hoje)).sort((a,b) => (a.data+" "+(a.hora || "99:99")).localeCompare(b.data+" "+(b.hora || "99:99")) || a.chave.localeCompare(b.chave));
  const paginaEventos = eventos.slice((paginaLista-1)*30,paginaLista*30);
  const dias = [...new Set(paginaEventos.map((e) => e.data))];
  const amanha = new Date(hoje+"T12:00:00"); amanha.setDate(amanha.getDate()+1);
  const fimSemana = new Date(hoje+"T12:00:00"); fimSemana.setDate(fimSemana.getDate()+((7-fimSemana.getDay())%7));
  function tituloDia(d: string) { return d === hoje ? "Hoje" : d === dataLocal(amanha) ? "Amanhã" : d > hoje && d <= dataLocal(fimSemana) ? "Esta semana · "+formatarData(d) : formatarData(d); }

  function processoSelecionado(id: string) {
    return processos.find((processo) => String(processo.id) === String(id));
  }

  async function salvarTarefa(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");
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
      const mensagem = `Não foi possível criar a tarefa: ${error.message}`;
      setErro(mensagem);
      avisar(mensagem);
      return;
    }
    setTarefas((atuais) => [...atuais, data as Tarefa]);
    if (processo?.id) await supabase.from("movimentacoes").insert({ processo_id: processo.id, categoria: "Tarefa", titulo: tarefaForm.titulo.trim(), descricao: tarefaForm.descricao.trim() || tarefaForm.titulo.trim(), descricao_tecnica: tarefaForm.descricao.trim() || tarefaForm.titulo.trim(), responsavel: tarefaForm.responsavel || usuario.nome || null, fonte: "Manual", importancia: tarefaForm.prioridade === "Crítica" ? "Crítico" : tarefaForm.prioridade === "Alta" ? "Relevante" : "Normal", origem: "manual", created_by_nome: usuario.nome || usuario.email || null });
    setTarefaForm(criarTarefaForm(usuario));
    invalidarConsultas();
    setFormAberto(null);
    avisar("Tarefa criada.");
  }

  async function atualizarStatusTarefa(tarefa: Tarefa, status: string) {
    const { data, error } = await supabase.from("processual_tarefas").update({ status, updated_by_nome: usuario.nome || usuario.email || null }).eq("id", tarefa.id).select("*").single();
    if (error) {
      avisar("Não foi possível atualizar a tarefa.");
      return;
    }
    invalidarConsultas();
    setTarefas((atuais) => atuais.map((item) => item.id === tarefa.id ? data as Tarefa : item));
    if (status === "Concluída" && window.confirm("Tarefa concluída. Registrar atendimento agora?")) {
      setFormAberto("atendimentos");
      setAtendimentoForm((form) => ({ ...form, cliente: tarefa.cliente_nome || "", processo_id: tarefa.processo_id || "", descricao: `Atendimento relacionado à tarefa: ${tarefa.titulo}`, responsavel: tarefa.responsavel || usuario.nome || "" }));
    }
  }

  async function salvarAtendimento(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");
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
      const mensagem = `Não foi possível registrar o atendimento: ${error.message}`;
      setErro(mensagem);
      avisar(mensagem);
      return;
    }
    setAtendimentos((atuais) => [data as Atendimento, ...atuais]);
    setAtendimentoForm(criarAtendimentoForm(usuario));
    invalidarConsultas();
    setFormAberto(null);
    avisar("Atendimento registrado permanentemente.");
  }

  return (
    <section className="operacional-module">
      <header className="module-page-header">
        <div>
          <span className="eyebrow">Operação processual</span>
          <h2>Agenda e Atividades</h2>
          <p>Controle de tarefas, compromissos, prazos e contatos vinculados a clientes e processos.</p>
        </div>
        <div className="agenda-actions"><button className="btn-primary" type="button" onClick={() => setFormAberto("tarefas")}>Nova atividade</button><button className="btn-secondary" type="button" onClick={() => setFormAberto("atendimentos")}>Registrar atendimento</button></div>
      </header>

      {alerta ? <div className="dashboard-filtro-ativo"><span>{alerta.titulo}</span><button type="button" onClick={() => { setPaginaLista(1); onLimparAlerta?.(); }}>Mostrar todos</button></div> : null}
      <div className="operacional-toolbar">
        <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, processo, responsável ou tipo..." />
        <Select aria-label="Filtrar por tipo" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}><option value="">Todos os tipos</option>{TIPOS_EVENTO.map((t) => <option key={t}>{t}</option>)}</Select>
        <button className="btn-secondary" onClick={() => { invalidarConsultas(); void carregarDados(); }} type="button">Atualizar</button>
      </div>

      {erro ? <div className="empty-row">{erro}</div> : null}
      {carregando ? <div className="panel">Carregando registros...</div> : null}

      {formAberto ? <section className="agenda-editor"><div className="agenda-section-heading"><h3>{formAberto === "ocorrencias" ? "Gerenciar ocorrências" : "Nova atividade"}</h3><button className="btn-secondary" type="button" onClick={() => { setFormAberto(null); if(formAberto === "ocorrencias") { invalidarConsultas(); void carregarDados(); } }}>Fechar</button></div>{formAberto === "tarefas" ? <FormularioTarefa form={tarefaForm} setForm={setTarefaForm} processos={processosFiltrados} onSubmit={salvarTarefa} salvando={salvando} /> : formAberto === "atendimentos" ? <FormularioAtendimento form={atendimentoForm} setForm={setAtendimentoForm} processos={processosFiltrados} onSubmit={salvarAtendimento} salvando={salvando} /> : <GerencialProcessualModule usuario={usuario} showToast={showToast} initialView="ocorrencias" />}</section> : null}
      {!carregando && !erro ? <div className="agenda-dashboard"><section className="operacional-card agenda-timeline"><div className="agenda-section-heading"><div><h3>Próximos Compromissos e Prazos</h3><p>{eventos.length} atividade(s){diaFiltro ? " em "+formatarData(diaFiltro) : " a partir de hoje"}</p></div>{diaFiltro ? <button className="btn-secondary" type="button" onClick={() => setDiaFiltro("")}>Todos os dias</button> : null}</div>
      {dias.length === 0 ? <div className="empty-row">Nenhum compromisso para os filtros selecionados.</div> : dias.map((d) => <section className="agenda-day" key={d}><h4>{tituloDia(d)} <small>{d === hoje || d === dataLocal(amanha) ? formatarData(d) : ""}</small></h4>{paginaEventos.filter((e) => e.data === d).map((e) => <article className="agenda-event" key={e.chave}><time>{e.hora?.slice(0,5) || "Sem horário"}</time><div><span className={"agenda-badge badge-"+TIPOS_EVENTO.indexOf(e.tipo)}>{e.tipo}</span><strong>{e.titulo}</strong><p>{e.cliente || "Sem cliente vinculado"}{e.tarefa?.processo_numero ? " · "+e.tarefa.processo_numero : ""}</p>{e.descricao ? <p>{e.descricao}</p> : null}<small>{e.responsavel || "Sem responsável"}</small></div>{e.tarefa ? <Select aria-label={"Status de "+e.titulo} value={e.tarefa.status} onChange={(ev) => void atualizarStatusTarefa(e.tarefa!,ev.target.value)}>{STATUS_TAREFA.map((st) => <option key={st}>{st}</option>)}</Select> : null}</article>)}</section>)}
      <Pagination pagina={paginaLista} total={eventos.length} tamanho={30} onChange={setPaginaLista} rotulo="atividades" /></section>
      <aside className="agenda-summary" aria-label="Resumo de ação"><h3>Resumo de Ação</h3><section className="operacional-card agenda-overdue"><h3>Tarefas Atrasadas <span>{atrasadas.length}</span></h3>{atrasadas.length === 0 ? <p>Nenhuma tarefa atrasada.</p> : atrasadas.map((t) => <article key={t.id}><strong>{t.titulo}</strong><small>{formatarData(t.data)} · {t.cliente_nome || "Sem cliente"}</small><Select aria-label={"Status de "+t.titulo} value={t.status} onChange={(e) => void atualizarStatusTarefa(t,e.target.value)}>{STATUS_TAREFA.map((st) => <option key={st}>{st}</option>)}</Select></article>)}</section>
      <MiniCalendario mes={mes} onMes={setMes} dia={diaFiltro} onDia={setDiaFiltro} hoje={hoje} datas={new Set(todosEventos.map((e) => e.data))} />
      <section className="operacional-card agenda-recent"><div className="agenda-section-heading"><h3>Ocorrências Recentes</h3><button className="btn-secondary" type="button" onClick={() => setFormAberto("ocorrencias")}>Gerenciar</button></div>{recentes.length === 0 ? <p>Nenhuma ocorrência encontrada.</p> : recentes.slice(0,5).map((o) => <article key={o.id}><span className="agenda-badge badge-5">{o.resolvido ? "Resolvida" : "Em aberto"}</span><strong>{o.categoria}</strong><p>{o.descricao}</p><small>{formatarData(o.data)} · {o.cliente_nome || "Sem cliente"}</small></article>)}</section></aside></div> : null}
    </section>
  );
}

function FormularioTarefa({ form, setForm, processos, onSubmit, salvando }: { form: ReturnType<typeof criarTarefaForm>; setForm: Dispatch<SetStateAction<ReturnType<typeof criarTarefaForm>>>; processos: ProcessoOpcao[]; onSubmit: (evento: FormEvent<HTMLFormElement>) => void; salvando: boolean }) {
  return <FormSection as="form" className="operacional-card operacional-form" onSubmit={onSubmit}>
    <h3>Criar tarefa</h3>
    <FormField><span>Título</span><Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} /></FormField>
    <FormField><span>Descrição</span><Textarea rows={3} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} /></FormField>
    <FormField><span>Cliente</span><Input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} placeholder="Nome, CPF ou ID" /></FormField>
    <FormField><span>Processo</span><Select value={form.processo_id} onChange={(e) => setForm((f) => ({ ...f, processo_id: e.target.value }))}><option value="">Sem vínculo</option>{processos.map((p) => <option key={p.id} value={p.id}>{p.nome_cliente} · {p.numero_processo || "sem CNJ"}</option>)}</Select></FormField>
    <FormGrid className="form-pair"><FormField><span>Tipo</span><Select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>{TIPOS_TAREFA.map((o) => <option key={o}>{o}</option>)}</Select></FormField><FormField><span>Data</span><Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></FormField></FormGrid>
    <FormGrid className="form-pair"><FormField><span>Horário</span><Input type="time" value={form.horario} onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))} /></FormField><FormField><span>Responsável</span><Input value={form.responsavel} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} /></FormField></FormGrid>
    <FormGrid className="form-pair"><FormField><span>Prioridade</span><Select value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}>{PRIORIDADES.map((o) => <option key={o}>{o}</option>)}</Select></FormField><FormField><span>Status</span><Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{STATUS_TAREFA.map((o) => <option key={o}>{o}</option>)}</Select></FormField></FormGrid>
    <FormField><span>Lembrete</span><Input value={form.lembrete} onChange={(e) => setForm((f) => ({ ...f, lembrete: e.target.value }))} placeholder="Ex.: 1 dia antes" /></FormField>
    <FormField><span>Observação</span><Textarea rows={2} value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} /></FormField>
    <button className="btn-primary" disabled={salvando} type="submit">Criar tarefa</button>
  </FormSection>;
}

function FormularioAtendimento({ form, setForm, processos, onSubmit, salvando }: { form: ReturnType<typeof criarAtendimentoForm>; setForm: Dispatch<SetStateAction<ReturnType<typeof criarAtendimentoForm>>>; processos: ProcessoOpcao[]; onSubmit: (evento: FormEvent<HTMLFormElement>) => void; salvando: boolean }) {
  return <FormSection as="form" className="operacional-card operacional-form" onSubmit={onSubmit}>
    <h3>Registrar atendimento</h3>
    <FormField><span>Cliente</span><Input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} /></FormField>
    <FormField><span>Processo</span><Select value={form.processo_id} onChange={(e) => setForm((f) => ({ ...f, processo_id: e.target.value }))}><option value="">Sem vínculo</option>{processos.map((p) => <option key={p.id} value={p.id}>{p.nome_cliente} · {p.numero_processo || "sem CNJ"}</option>)}</Select></FormField>
    <FormGrid className="form-pair"><FormField><span>Data</span><Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></FormField><FormField><span>Hora</span><Input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} /></FormField></FormGrid>
    <FormGrid className="form-pair"><FormField><span>Canal</span><Select value={form.canal} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))}>{CANAIS.map((o) => <option key={o}>{o}</option>)}</Select></FormField><FormField><span>Tipo</span><Input value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} /></FormField></FormGrid>
    <FormField><span>Descrição</span><Textarea rows={4} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Cliente informado sobre custas." /></FormField>
    <FormField><span>Responsável</span><Input value={form.responsavel} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} /></FormField>
    <FormField><span>Anexo</span><Input value={form.anexo_url} onChange={(e) => setForm((f) => ({ ...f, anexo_url: e.target.value }))} placeholder="Link ou caminho do arquivo" /></FormField>
    <button className="btn-primary" disabled={salvando} type="submit">Registrar atendimento</button>
  </FormSection>;
}

function MiniCalendario({ mes, onMes, dia, onDia, hoje, datas }: { mes: string; onMes: (m: string) => void; dia: string; onDia: (d: string) => void; hoje: string; datas: Set<string> }) {
  const inicio = new Date(mes+"-01T12:00:00");
  const quantidade = new Date(inicio.getFullYear(),inicio.getMonth()+1,0).getDate();
  function mudar(delta: number) { const d = new Date(inicio); d.setMonth(d.getMonth()+delta); onMes(dataLocal(d).slice(0,7)); }
  return <section className="operacional-card mini-calendar"><div className="agenda-section-heading"><button type="button" aria-label="Mês anterior" onClick={() => mudar(-1)}>‹</button><h3>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(inicio)}</h3><button type="button" aria-label="Próximo mês" onClick={() => mudar(1)}>›</button></div><div className="calendar-grid">{["D","S","T","Q","Q","S","S"].map((d,i) => <span key={i}>{d}</span>)}{Array.from({length:inicio.getDay()},(_,i) => <span key={"vazio-"+i} />)}{Array.from({length:quantidade},(_,i) => { const d=mes+"-"+String(i+1).padStart(2,"0"); return <button type="button" key={d} aria-label={formatarData(d)} aria-pressed={dia === d} aria-current={hoje === d ? "date" : undefined} className={[dia === d ? "selected" : "",hoje === d ? "today" : "",datas.has(d) ? "has-events" : ""].join(" ")} onClick={() => onDia(dia === d ? "" : d)}>{i+1}</button>; })}</div><button className="btn-secondary" type="button" onClick={() => { onMes(hoje.slice(0,7)); onDia(""); }}>Voltar aos próximos compromissos</button></section>;
}
