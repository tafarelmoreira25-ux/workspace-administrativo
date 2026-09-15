import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { calcularPrazoElite } from "../../lib/esteiraProcessual";
import { getProcessesWithoutReviewCount, processoSemRevisao } from "../../lib/processReview";
import "./gerencialProcessual.css";

type Usuario = { nome?: string; email?: string; tipo?: string; perfil?: string; cargo?: string };
type View = "ocorrencias" | "alertas" | "indicadores";
type Processo = Record<string, any>;
type Tarefa = Record<string, any>;
type Documento = Record<string, any>;
type Atendimento = Record<string, any>;
type Ocorrencia = Record<string, any>;
type Custa = Record<string, any>;

type NavigateOptions = { filtros?: Record<string, string>; status?: string };
type NavigateHandler = (id: string, opcoes?: NavigateOptions) => void;

type Props = { usuario: Usuario; showToast?: (mensagem: string) => void; initialView?: View; onNavigate?: NavigateHandler };

const CATEGORIAS_OCORRENCIA = ["Custas", "Documentação", "Emenda", "Prazo", "Pasta retornada", "Falha operacional", "Falha cliente", "Falha prestador", "Divergência documental", "Comunicação", "Outro"];
const RESPONSABILIDADES = ["Cliente", "Platino", "Elite", "Advogado", "Terceiro", "Não identificado"];
const STATUS_CUSTAS = ["Pendente", "Cliente informado", "Pago", "Não pago", "Vencido", "Dispensado"];
const TIPOS_ALERTA = ["SLA", "Prazo", "Processo", "Documento", "Custas", "Tarefa", "Pasta retornada", "Revisão", "Atendimento"];
const METRICAS_SECUNDARIAS_ZERADAS = new Set([
  "Elite",
  "Próximo SLA",
  "PrÃ³ximo SLA",
  "Pastas retornadas",
  "Suspensos",
  "Parciais",
  "Extintos sem mérito",
  "Extintos sem mÃ©rito",
  "Recursais",
  "Custas",
  "Emendas",
  "Relatórios enviados",
  "RelatÃ³rios enviados",
  "Tarefas atrasadas",
  "Prazos cumpridos",
  "Prazos vencidos",
  "Cliente",
  "Platino",
  "Advogado",
  "Terceiro",
  "Não identificado",
  "NÃ£o identificado",
]);

function hoje() { return new Date().toISOString().slice(0, 10); }
function limpar(valor: string) { const texto = valor.trim(); return texto || null; }
function normalizar(valor = "") { return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function formatarData(data?: string | null) { if (!data) return "—"; return new Intl.DateTimeFormat("pt-BR").format(new Date(data)); }
function moeda(valor?: number | string | null) { const numero = Number(valor || 0); return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function diasDesde(data?: string | null) { if (!data) return 999; const base = new Date(data); const hojeData = new Date(); base.setHours(0,0,0,0); hojeData.setHours(0,0,0,0); return Math.floor((hojeData.getTime() - base.getTime()) / 86400000); }

function criarOcorrenciaForm(usuario: Usuario) {
  return { categoria: "Prazo", data: hoje(), descricao: "", responsabilidade: "Não identificado", impacto: "", providencia: "", prazo: "", resolvido: false, data_resolucao: "", evidencia: "", anexo_url: "", processo_id: "", responsavel: usuario.nome || "" };
}

function criarCustaForm(usuario: Usuario) {
  return { tipo: "Custas iniciais", valor: "", solicitacao: hoje(), vencimento: "", status: "Pendente", pagamento: "", comprovante_url: "", responsavel: usuario.nome || "", observacao: "", processo_id: "" };
}

function etiquetaProcesso(processo: Processo) {
  const etiquetas: string[] = [];
  const prazo = calcularPrazoElite(processo.data_envio_elite);
  if (["vermelho", "atrasado"].includes(prazo.sinalizacao)) etiquetas.push("SLA ATRASADO");
  if (processo.pasta_retornada || processo.pasta_retorno_status === "Retornada") etiquetas.push("PASTA RETORNADA");
  if (processo.custas_status && !["Pago", "Dispensado", "Não informado"].includes(processo.custas_status)) etiquetas.push("CUSTAS PENDENTES");
  if (["Solicitada", "Pendente", "Prazo decorrido"].includes(processo.emenda_status || processo.emenda_inicial || "")) etiquetas.push("EMENDA PENDENTE");
  if (processoSemRevisao(processo)) etiquetas.push("SEM REVISÃO");
  if (processo.documentacao_status === "Irregular" || processo.status_documentos === "Irregular") etiquetas.push("DOCUMENTAÇÃO IRREGULAR");
  return etiquetas;
}

function prioridadeAlerta(alerta: { prioridade: number }) { return alerta.prioridade >= 90 ? "crítica" : alerta.prioridade >= 70 ? "alta" : alerta.prioridade >= 45 ? "média" : "baixa"; }
function valorNumerico(valor: any) { return typeof valor === "number" ? valor : Number(String(valor).replace("%", "").replace(",", ".")) || 0; }
function ocultarMetricaZerada(nome: string, valor: any) { return valorNumerico(valor) === 0 && METRICAS_SECUNDARIAS_ZERADAS.has(nome); }
function destinoMetrica(nome: string): { id: string; opcoes?: NavigateOptions } | null {
  if (nome === "Processos sem revisão" || nome === "Processos sem revisÃ£o") return { id: "processos", opcoes: { filtros: { semRevisao: "Sim" }, status: "sem_revisao" } };
  if (["Atrasados", "Pastas retornadas", "Custas", "Emendas", "Tarefas atrasadas", "Prazos vencidos"].includes(nome)) return { id: "alertas" };
  return null;
}

export default function GerencialProcessualModule({ usuario, showToast, initialView = "indicadores", onNavigate }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Array<Record<string, any>>>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [custas, setCustas] = useState<Custa[]>([]);
  const [totalSemRevisao, setTotalSemRevisao] = useState(0);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ocorrenciaForm, setOcorrenciaForm] = useState(() => criarOcorrenciaForm(usuario));
  const [custaForm, setCustaForm] = useState(() => criarCustaForm(usuario));

  const avisar = useCallback((mensagem: string) => showToast?.(mensagem), [showToast]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [processosReq, tarefasReq, documentosReq, atendimentosReq, ocorrenciasReq, custasReq, movimentacoesReq, semRevisaoReq] = await Promise.allSettled([
      supabase.from("processos").select("*").order("updated_at", { ascending: false }).limit(800),
      supabase.from("processual_tarefas").select("*").order("data", { ascending: false }).limit(800),
      supabase.from("documentos_juridicos").select("*").order("created_at", { ascending: false }).limit(800),
      supabase.from("processual_atendimentos").select("*").order("data", { ascending: false }).limit(800),
      supabase.from("processual_ocorrencias").select("*").order("data", { ascending: false }).limit(800),
      supabase.from("processual_custas").select("*").order("vencimento", { ascending: true }).limit(800),
      supabase.from("movimentacoes").select("id, categoria, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(1200),
      getProcessesWithoutReviewCount(supabase),
    ]);
    if (processosReq.status === "fulfilled" && !processosReq.value.error) setProcessos(processosReq.value.data || []);
    if (tarefasReq.status === "fulfilled" && !tarefasReq.value.error) setTarefas(tarefasReq.value.data || []);
    if (documentosReq.status === "fulfilled" && !documentosReq.value.error) setDocumentos(documentosReq.value.data || []);
    if (atendimentosReq.status === "fulfilled" && !atendimentosReq.value.error) setAtendimentos(atendimentosReq.value.data || []);
    if (ocorrenciasReq.status === "fulfilled" && !ocorrenciasReq.value.error) setOcorrencias(ocorrenciasReq.value.data || []);
    if (custasReq.status === "fulfilled" && !custasReq.value.error) setCustas(custasReq.value.data || []);
    if (movimentacoesReq.status === "fulfilled" && !movimentacoesReq.value.error) setMovimentacoes(movimentacoesReq.value.data || []);
    if (semRevisaoReq.status === "fulfilled") setTotalSemRevisao(semRevisaoReq.value);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const processosPorId = useMemo(() => new Map(processos.map((p) => [String(p.id), p])), [processos]);
  const processosOpcao = useMemo(() => processos.slice(0, 300), [processos]);

  const alertas = useMemo(() => {
    const lista: Array<{ id: string; tipo: string; titulo: string; detalhe: string; prioridade: number; entidade: string; entidadeId?: string }> = [];
    processos.forEach((processo) => {
      const prazo = calcularPrazoElite(processo.data_envio_elite);
      if (["vermelho", "atrasado"].includes(prazo.sinalizacao)) lista.push({ id: `sla-${processo.id}`, tipo: "SLA", titulo: "SLA de protocolo atrasado", detalhe: processo.nome_cliente, prioridade: 95, entidade: "processo", entidadeId: processo.id });
      else if (["critico", "atencao", "amarelo"].includes(prazo.sinalizacao)) lista.push({ id: `sla-prox-${processo.id}`, tipo: "SLA", titulo: "SLA próximo do fim", detalhe: processo.nome_cliente, prioridade: 72, entidade: "processo", entidadeId: processo.id });
      if (processo.pasta_retornada || processo.pasta_retorno_status === "Retornada") lista.push({ id: `pasta-${processo.id}`, tipo: "Pasta retornada", titulo: "Pasta retornada pendente", detalhe: processo.nome_cliente, prioridade: 80, entidade: "processo", entidadeId: processo.id });
      if (processoSemRevisao(processo)) lista.push({ id: `revisao-${processo.id}`, tipo: "Revisão", titulo: "Processo sem revisão", detalhe: processo.nome_cliente, prioridade: diasDesde(processo.ultima_revisao) >= 90 ? 90 : 55, entidade: "processo", entidadeId: processo.id });
      etiquetaProcesso(processo).forEach((etiqueta) => lista.push({ id: `${etiqueta}-${processo.id}`, tipo: "Processo", titulo: etiqueta, detalhe: processo.nome_cliente, prioridade: etiqueta.includes("ATRASADO") ? 90 : 60, entidade: "processo", entidadeId: processo.id }));
    });
    tarefas.forEach((tarefa) => {
      if (tarefa.status === "Atrasada" || (tarefa.status !== "Concluída" && tarefa.data && new Date(`${tarefa.data}T23:59:59`) < new Date())) lista.push({ id: `tarefa-${tarefa.id}`, tipo: "Tarefa", titulo: "Tarefa atrasada", detalhe: tarefa.titulo, prioridade: tarefa.prioridade === "Crítica" ? 92 : 68, entidade: "tarefa", entidadeId: tarefa.id });
    });
    custas.forEach((custa) => {
      if (["Pendente", "Informado cliente", "Não pago", "Vencido"].includes(custa.status)) lista.push({ id: `custa-${custa.id}`, tipo: "Custas", titulo: custa.status === "Vencido" ? "Custas vencidas" : "Custas pendentes", detalhe: `${custa.tipo} · ${moeda(custa.valor)}`, prioridade: custa.status === "Vencido" ? 88 : 62, entidade: "custa", entidadeId: custa.id });
    });
    documentos.forEach((doc) => {
      if (doc.status === "Aguardando assinatura") lista.push({ id: `doc-${doc.id}`, tipo: "Documento", titulo: "Documento aguardando assinatura", detalhe: doc.nome_documento, prioridade: 45, entidade: "documento", entidadeId: doc.id });
    });
    return lista.sort((a, b) => b.prioridade - a.prioridade).filter((alerta, index, arr) => arr.findIndex((item) => item.id === alerta.id) === index);
  }, [custas, documentos, processos, tarefas]);

  const indicadores = useMemo(() => {
    const protocolos = processos.filter((p) => !p.numero_processo || ["Solicitado para Ajuizamento", "Documentação", "Procuração", "CRM", "Enviado para Elite", "SLA", "Pasta Retornada"].includes(p.fase_atual));
    const protocolados = processos.filter((p) => Boolean(p.numero_processo));
    const slas = protocolos.map((p) => calcularPrazoElite(p.data_envio_elite));
    const concluidos20 = processos.filter((p) => Number(p.sla_dias_uteis_utilizados || 999) <= 20 && p.numero_processo).length;
    return {
      protocolos: [
        ["Total", protocolos.length], ["Preparação", protocolos.filter((p) => ["Documentação", "Procuração", "CRM"].includes(p.fase_atual)).length], ["Elite", protocolos.filter((p) => p.fase_atual === "Enviado para Elite").length], ["Dentro SLA", slas.filter((s) => ["neutro", "verde"].includes(s.sinalizacao)).length], ["Próximo SLA", slas.filter((s) => ["atencao", "critico", "amarelo"].includes(s.sinalizacao)).length], ["Atrasados", slas.filter((s) => ["vermelho", "atrasado"].includes(s.sinalizacao)).length], ["% dentro 20 dias", protocolados.length ? `${Math.round((concluidos20 / protocolados.length) * 100)}%` : "0%"], ["Pastas retornadas", processos.filter((p) => p.pasta_retornada).length],
      ],
      processos: [
        ["Ativos", processos.filter((p) => ["Em andamento", "Pendente de protocolo"].includes(p.situacao)).length], ["Encerrados", processos.filter((p) => p.situacao === "Encerrado").length], ["Suspensos", processos.filter((p) => p.situacao === "Suspenso / Sobrestado").length], ["Procedentes", processos.filter((p) => p.resultado === "Procedente").length], ["Parciais", processos.filter((p) => p.resultado === "Parcialmente procedente").length], ["Improcedentes", processos.filter((p) => p.resultado === "Improcedente").length], ["Extintos sem mérito", processos.filter((p) => p.resultado === "Extinto sem resolução do mérito").length], ["Recursais", processos.filter((p) => p.recursal).length], ["Custas", custas.filter((c) => !["Pago", "Dispensado"].includes(c.status)).length], ["Emendas", processos.filter((p) => ["Solicitada", "Pendente"].includes(p.emenda_status)).length], ["Processos sem revisão", totalSemRevisao],
      ],
      qualidade: RESPONSABILIDADES.map((r) => [r, ocorrencias.filter((o) => o.responsabilidade === r && ["Custas", "Emenda", "Documentação", "Pasta retornada"].includes(o.categoria)).length]),
      operacao: [["Processos revisados", processos.filter((p) => p.ultima_revisao).length], ["Movimentações cadastradas", movimentacoes.length], ["Relatórios enviados", documentos.filter((d) => normalizar(`${d.modelo_nome} ${d.tipo_documento}`).includes("relatorio") && ["Enviado", "Gerado"].includes(d.status)).length], ["Clientes atualizados", new Set(processos.map((p) => p.cliente_id || p.nome_cliente)).size], ["Tarefas concluídas", tarefas.filter((t) => t.status === "Concluída").length], ["Tarefas atrasadas", alertas.filter((a) => a.tipo === "Tarefa").length], ["Prazos cumpridos", tarefas.filter((t) => t.tipo === "Prazo processual" && t.status === "Concluída").length], ["Prazos vencidos", tarefas.filter((t) => t.tipo === "Prazo processual" && t.status !== "Concluída" && new Date(`${t.data}T23:59:59`) < new Date()).length]],
    };
  }, [alertas, custas, documentos, movimentacoes.length, ocorrencias, processos, tarefas, totalSemRevisao]);

  const ocorrenciasFiltradas = useMemo(() => {
    const termo = normalizar(busca);
    return ocorrencias.filter((o) => !termo || normalizar(`${o.categoria} ${o.descricao} ${o.responsabilidade} ${processosPorId.get(String(o.processo_id || ""))?.nome_cliente || ""}`).includes(termo));
  }, [busca, ocorrencias, processosPorId]);

  async function salvarOcorrencia(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!ocorrenciaForm.descricao.trim()) { avisar("Descreva a ocorrência."); return; }
    const processo = processosPorId.get(ocorrenciaForm.processo_id);
    const payload = { ...ocorrenciaForm, processo_id: ocorrenciaForm.processo_id || null, cliente_id: processo?.cliente_id || null, cliente_nome: processo?.nome_cliente || null, resolvido: Boolean(ocorrenciaForm.resolvido), data_resolucao: ocorrenciaForm.resolvido ? ocorrenciaForm.data_resolucao || hoje() : null, created_by_nome: usuario.nome || usuario.email || null };
    const { data, error } = await supabase.from("processual_ocorrencias").insert(payload).select("*").single();
    if (!error && processo?.id) await supabase.from("movimentacoes").insert({ processo_id: processo.id, categoria: "Ocorrência", titulo: ocorrenciaForm.categoria, descricao: ocorrenciaForm.descricao, descricao_tecnica: ocorrenciaForm.descricao, responsavel: ocorrenciaForm.responsavel || usuario.nome || null, fonte: "Ocorrências", importancia: ocorrenciaForm.impacto?.toLowerCase().includes("alto") ? "Crítico" : "Normal", anexo_url: ocorrenciaForm.anexo_url || null, origem: "manual", created_by_nome: usuario.nome || usuario.email || null });
    if (!error) await supabase.from("processual_auditoria_geral").insert({ usuario: usuario.nome || usuario.email || null, acao: "criar_ocorrencia", entidade: "processual_ocorrencias", entidade_id: data?.id || null, antes: null, depois: data || payload });
    if (error) { avisar(`Não foi possível salvar a ocorrência: ${error.message}`); return; }
    setOcorrencias((atuais) => [data, ...atuais]); setOcorrenciaForm(criarOcorrenciaForm(usuario)); avisar("Ocorrência registrada.");
  }

  async function salvarCusta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!custaForm.tipo.trim()) { avisar("Informe o tipo de custas."); return; }
    const processo = processosPorId.get(custaForm.processo_id);
    const payload = { ...custaForm, valor: Number(String(custaForm.valor).replace(",", ".") || 0), processo_id: custaForm.processo_id || null, cliente_id: processo?.cliente_id || null, cliente_nome: processo?.nome_cliente || null, created_by_nome: usuario.nome || usuario.email || null };
    const { data, error } = await supabase.from("processual_custas").insert(payload).select("*").single();
    if (!error && processo?.id) await supabase.from("movimentacoes").insert({ processo_id: processo.id, categoria: "Custas", titulo: custaForm.tipo, descricao: `${custaForm.tipo}: ${moeda(payload.valor)} · ${custaForm.status}`, descricao_tecnica: `${custaForm.tipo}: ${moeda(payload.valor)} · ${custaForm.status}`, responsavel: custaForm.responsavel || usuario.nome || null, fonte: "Custas", importancia: ["Vencido", "Não pago"].includes(custaForm.status) ? "Crítico" : "Relevante", anexo_url: custaForm.comprovante_url || null, origem: "manual", created_by_nome: usuario.nome || usuario.email || null });
    if (!error) await supabase.from("processual_auditoria_geral").insert({ usuario: usuario.nome || usuario.email || null, acao: "criar_custas", entidade: "processual_custas", entidade_id: data?.id || null, antes: null, depois: data || payload });
    if (error) { avisar(`Não foi possível salvar custas: ${error.message}`); return; }
    setCustas((atuais) => [data, ...atuais]); setCustaForm(criarCustaForm(usuario)); avisar("Custas registradas.");
  }

  return <section className="gerencial-module">
    <header className="module-page-header"><div><span className="eyebrow">Controle gerencial</span><h2>{view === "ocorrencias" ? "Ocorrências" : view === "alertas" ? "Central de Alertas" : "Indicadores"}</h2><p>Auditoria operacional, riscos, etiquetas automáticas e visão executiva da carteira.</p></div><div className="gerencial-tabs"><button className={view === "indicadores" ? "active" : ""} onClick={() => setView("indicadores")} type="button">Indicadores</button><button className={view === "alertas" ? "active" : ""} onClick={() => setView("alertas")} type="button">Alertas</button><button className={view === "ocorrencias" ? "active" : ""} onClick={() => setView("ocorrencias")} type="button">Ocorrências</button></div></header>
    <div className="gerencial-toolbar"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar cliente, processo, banco, ocorrência ou alerta..." /><button className="btn-secondary" onClick={carregar} type="button">Atualizar</button></div>
    {carregando ? <div className="panel">Carregando controle gerencial...</div> : null}
    {!carregando && view === "indicadores" ? <Indicadores indicadores={indicadores} onNavigate={onNavigate} /> : null}
    {!carregando && view === "alertas" ? <Alertas alertas={alertas} totalSemRevisao={totalSemRevisao} /> : null}
    {!carregando && view === "ocorrencias" ? <Ocorrencias ocorrencias={ocorrenciasFiltradas} custas={custas} processos={processosOpcao} ocorrenciaForm={ocorrenciaForm} setOcorrenciaForm={setOcorrenciaForm} custaForm={custaForm} setCustaForm={setCustaForm} onOcorrencia={salvarOcorrencia} onCusta={salvarCusta} /> : null}
  </section>;
}

function Indicadores({ indicadores, onNavigate }: { indicadores: any; onNavigate?: NavigateHandler }) {
  return <div className="indicator-grid"><GrupoIndicador titulo="Protocolos" itens={indicadores.protocolos} onNavigate={onNavigate} /><GrupoIndicador titulo="Processos" itens={indicadores.processos} onNavigate={onNavigate} /><GrupoIndicador titulo="Qualidade" itens={indicadores.qualidade} onNavigate={onNavigate} /><GrupoIndicador titulo="Operação" itens={indicadores.operacao} onNavigate={onNavigate} /></div>;
}
function GrupoIndicador({ titulo, itens, onNavigate }: { titulo: string; itens: Array<[string, any]>; onNavigate?: NavigateHandler }) {
  const visiveis = itens.filter(([nome, valor]) => !ocultarMetricaZerada(nome, valor));
  return <section className="gerencial-card"><h3>{titulo}</h3><div className="metric-list">{visiveis.length === 0 ? <div className="empty-row">Sem métricas ativas.</div> : visiveis.map(([nome, valor]) => {
    const destino = destinoMetrica(nome);
    const conteudo = <><span>{nome}</span><strong>{valor}</strong></>;
    return destino && onNavigate ? <button className="metric-card metric-card-clickable" key={nome} type="button" onClick={() => onNavigate(destino.id, destino.opcoes)}>{conteudo}</button> : <article className="metric-card" key={nome}>{conteudo}</article>;
  })}</div></section>;
}
function Alertas({ alertas, totalSemRevisao }: { alertas: Array<{ id: string; tipo: string; titulo: string; detalhe: string; prioridade: number; entidade: string; entidadeId?: string }>; totalSemRevisao: number }) {
  const [selecionado, setSelecionado] = useState<typeof alertas[number] | null>(null);
  return <div className="alert-layout"><section className="gerencial-card"><h3>Alertas por prioridade · {totalSemRevisao} processos sem revisão</h3><div className="alert-list">{alertas.length === 0 ? <div className="empty-row">Nenhum alerta ativo.</div> : alertas.map((alerta) => <article key={alerta.id} className={prioridadeAlerta(alerta)}><div><span>{alerta.tipo}</span><strong>{alerta.titulo}</strong><small>{alerta.detalhe}</small></div><button className="btn-secondary compact" type="button" onClick={() => setSelecionado(alerta)}>Abrir {alerta.entidade}</button></article>)}</div></section>{selecionado ? <aside className="gerencial-card alert-detail"><span className="eyebrow">Registro relacionado</span><h3>{selecionado.titulo}</h3><p>{selecionado.detalhe}</p><dl><div><dt>Tipo</dt><dd>{selecionado.tipo}</dd></div><div><dt>Prioridade</dt><dd>{prioridadeAlerta(selecionado)}</dd></div><div><dt>Entidade</dt><dd>{selecionado.entidade}</dd></div><div><dt>ID</dt><dd>{selecionado.entidadeId || selecionado.id}</dd></div></dl><button className="btn-secondary compact" type="button" onClick={() => setSelecionado(null)}>Fechar</button></aside> : null}</div>;
}
function Ocorrencias({ ocorrencias, custas, processos, ocorrenciaForm, setOcorrenciaForm, custaForm, setCustaForm, onOcorrencia, onCusta }: any) { return <div className="gerencial-work-grid"><form className="gerencial-card gerencial-form" onSubmit={onOcorrencia}><h3>Registrar ocorrência</h3><label><span>Categoria</span><select value={ocorrenciaForm.categoria} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, categoria: e.target.value }))}>{CATEGORIAS_OCORRENCIA.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>Processo</span><select value={ocorrenciaForm.processo_id} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, processo_id: e.target.value }))}><option value="">Sem vínculo</option>{processos.map((p: Processo) => <option key={p.id} value={p.id}>{p.nome_cliente} · {p.numero_processo || "sem CNJ"}</option>)}</select></label><label><span>Data</span><input type="date" value={ocorrenciaForm.data} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, data: e.target.value }))} /></label><label><span>Responsabilidade</span><select value={ocorrenciaForm.responsabilidade} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, responsabilidade: e.target.value }))}>{RESPONSABILIDADES.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>Descrição</span><textarea rows={3} value={ocorrenciaForm.descricao} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, descricao: e.target.value }))} /></label><label><span>Impacto</span><input value={ocorrenciaForm.impacto} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, impacto: e.target.value }))} /></label><label><span>Providência</span><input value={ocorrenciaForm.providencia} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, providencia: e.target.value }))} /></label><label><span>Prazo</span><input type="date" value={ocorrenciaForm.prazo} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, prazo: e.target.value }))} /></label><label><span>Evidência</span><input value={ocorrenciaForm.evidencia} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, evidencia: e.target.value }))} /></label><label><span>Anexo</span><input value={ocorrenciaForm.anexo_url} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, anexo_url: e.target.value }))} /></label><label className="check-line"><input type="checkbox" checked={ocorrenciaForm.resolvido} onChange={(e) => setOcorrenciaForm((f: any) => ({ ...f, resolvido: e.target.checked }))} /> Resolvido</label><button className="btn-primary" type="submit">Salvar ocorrência</button></form><form className="gerencial-card gerencial-form" onSubmit={onCusta}><h3>Registrar custas</h3><label><span>Processo</span><select value={custaForm.processo_id} onChange={(e) => setCustaForm((f: any) => ({ ...f, processo_id: e.target.value }))}><option value="">Sem vínculo</option>{processos.map((p: Processo) => <option key={p.id} value={p.id}>{p.nome_cliente} · {p.numero_processo || "sem CNJ"}</option>)}</select></label><label><span>Tipo</span><input value={custaForm.tipo} onChange={(e) => setCustaForm((f: any) => ({ ...f, tipo: e.target.value }))} /></label><label><span>Valor</span><input value={custaForm.valor} onChange={(e) => setCustaForm((f: any) => ({ ...f, valor: e.target.value }))} /></label><label><span>Solicitação</span><input type="date" value={custaForm.solicitacao} onChange={(e) => setCustaForm((f: any) => ({ ...f, solicitacao: e.target.value }))} /></label><label><span>Vencimento</span><input type="date" value={custaForm.vencimento} onChange={(e) => setCustaForm((f: any) => ({ ...f, vencimento: e.target.value }))} /></label><label><span>Status</span><select value={custaForm.status} onChange={(e) => setCustaForm((f: any) => ({ ...f, status: e.target.value }))}>{STATUS_CUSTAS.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>Pagamento</span><input type="date" value={custaForm.pagamento} onChange={(e) => setCustaForm((f: any) => ({ ...f, pagamento: e.target.value }))} /></label><label><span>Comprovante</span><input value={custaForm.comprovante_url} onChange={(e) => setCustaForm((f: any) => ({ ...f, comprovante_url: e.target.value }))} /></label><label><span>Responsável</span><input value={custaForm.responsavel} onChange={(e) => setCustaForm((f: any) => ({ ...f, responsavel: e.target.value }))} /></label><label><span>Observação</span><textarea rows={2} value={custaForm.observacao} onChange={(e) => setCustaForm((f: any) => ({ ...f, observacao: e.target.value }))} /></label><button className="btn-primary" type="submit">Salvar custas</button></form><section className="gerencial-card wide"><h3>Ocorrências registradas</h3><div className="gerencial-table"><table><thead><tr><th>Categoria</th><th>Data</th><th>Cliente</th><th>Responsabilidade</th><th>Impacto</th><th>Prazo</th><th>Resolvido</th></tr></thead><tbody>{ocorrencias.length === 0 ? <tr><td colSpan={7}>Nenhuma ocorrência registrada.</td></tr> : ocorrencias.map((o: Ocorrencia) => <tr key={o.id}><td>{o.categoria}</td><td>{formatarData(o.data)}</td><td>{o.cliente_nome || "—"}</td><td>{o.responsabilidade}</td><td>{o.impacto || "—"}</td><td>{formatarData(o.prazo)}</td><td>{o.resolvido ? "Sim" : "Não"}</td></tr>)}</tbody></table></div></section><section className="gerencial-card wide"><h3>Custas</h3><div className="gerencial-table"><table><thead><tr><th>Tipo</th><th>Cliente</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Responsável</th></tr></thead><tbody>{custas.length === 0 ? <tr><td colSpan={6}>Nenhuma custa registrada.</td></tr> : custas.map((c: Custa) => <tr key={c.id}><td>{c.tipo}</td><td>{c.cliente_nome || "—"}</td><td>{moeda(c.valor)}</td><td>{formatarData(c.vencimento)}</td><td>{c.status}</td><td>{c.responsavel || "—"}</td></tr>)}</tbody></table></div></section></div>; }
