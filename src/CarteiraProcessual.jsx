import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import Pagination from "./components/common/Pagination";
import "./carteiraProcessual.css";

const PAGE_SIZE = 30;
const STATUS_PROCESSO = ["TRAMITANDO", "ARQUIVADO", "BAIXA DEFINITIVA", "SENTENÇA PROCEDENTE", "SENTENÇA IMPROCEDENTE", "REDISTRIBUIÇÃO", "JULGADO"];
const TIMELINE_MOCK = [
  { id: "mock-manual", data: "2026-09-14T09:30:00", titulo: "Registro interno", descricao: "Conferência manual do andamento e próximos passos.", detalhe: "Aguardando retorno da equipe", responsavel: "Equipe processual", origem: "manual" },
  { id: "mock-escavador-1", data: "2026-09-12T14:10:00", titulo: "Publicação identificada", descricao: "Nova publicação localizada no diário oficial.", detalhe: "Fonte: Escavador", responsavel: "Captura automática", origem: "escavador" },
  { id: "mock-escavador-2", data: "2026-09-10T08:45:00", titulo: "Movimentação processual", descricao: "Movimentação recebida para o processo monitorado.", detalhe: "Fonte: Escavador", responsavel: "Captura automática", origem: "escavador" },
];
const ACAO_INICIAL = { tipo: "nenhuma", titulo: "", data: "", hora: "", prioridade: "Normal" };
const MOVIMENTO_INICIAL = { data: new Date().toISOString().slice(0, 10), tipo: "Publicação", conteudo: "", tratamento: "", observacao: "", responsavel: "" };
const limparBusca = (valor = "") => valor.trim().replace(/[,()"']/g, " ").replace(/\s+/g, " ").slice(0, 120);
const dataHora = (valor) => valor ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor)) : "—";
const dataBR = (valor) => valor ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${String(valor).slice(0, 10)}T12:00:00`)) : "—";

export default function CarteiraProcessual({ showToast, usuario, processoInicialId }) {
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [processo, setProcesso] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [registrando, setRegistrando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sincronizandoDataJud, setSincronizandoDataJud] = useState(false);
  const [movimento, setMovimento] = useState(() => ({ ...MOVIMENTO_INICIAL, responsavel: usuario?.nome || "" }));
  const [acao, setAcao] = useState(ACAO_INICIAL);
  const processoInicialCarregado = useRef(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const termo = limparBusca(buscaAplicada);
    let consulta = supabase.from("processos").select("id,cliente_id,nome_cliente,cpf_cliente,id_crm,numero_processo,reu,banco_reu,tipo_acao,tribunal,comarca,vara,data_distribuicao,responsavel,situacao,status_judicial,ultima_movimentacao,ultima_movimentacao_data,ultima_revisao,updated_at", { count: "exact" }).not("numero_processo", "is", null).neq("numero_processo", "");
    if (termo) consulta = consulta.or(`nome_cliente.ilike.%${termo}%,cpf_cliente.ilike.%${termo}%,id_crm.ilike.%${termo}%,numero_processo.ilike.%${termo}%,reu.ilike.%${termo}%,banco_reu.ilike.%${termo}%,tipo_acao.ilike.%${termo}%`);
    const inicio = (pagina - 1) * PAGE_SIZE;
    const { data, count, error } = await consulta.order("updated_at", { ascending: false }).range(inicio, inicio + PAGE_SIZE - 1);
    if (error) showToast?.(`Não foi possível carregar o Processual: ${error.message}`);
    else { setRegistros(data || []); setTotal(count || 0); }
    setCarregando(false);
  }, [buscaAplicada, pagina, showToast]);

  useEffect(() => { const timer = window.setTimeout(() => void carregar(), 0); return () => window.clearTimeout(timer); }, [carregar]);
  useEffect(() => { const timer = window.setTimeout(() => { setPagina(1); setBuscaAplicada(busca); }, 350); return () => window.clearTimeout(timer); }, [busca]);

  useEffect(() => {
    if (!processoInicialId || processoInicialCarregado.current === String(processoInicialId)) return;
    processoInicialCarregado.current = String(processoInicialId);
    void supabase.from("processos").select("*").eq("id", processoInicialId).maybeSingle().then(({ data, error }) => {
      if (error || !data?.numero_processo?.trim()) showToast?.("O processo selecionado não está disponível para acompanhamento.");
      else void abrirProcesso(data);
    });
  }, [processoInicialId, showToast]);

  async function abrirProcesso(item) {
    setProcesso(item);
    const [movReq, tarefasReq] = await Promise.all([
      supabase.from("movimentacoes").select("*").eq("processo_id", item.id).is("deleted_at", null).order("data_registro", { ascending: false }).limit(300),
      supabase.from("processual_tarefas").select("*").eq("processo_id", item.id).order("created_at", { ascending: false }).limit(300),
    ]);
    setMovimentacoes(movReq.error ? [] : movReq.data || []);
    setTarefas(tarefasReq.error ? [] : tarefasReq.data || []);
  }

  async function sincronizarDataJud() {
    if (!processo?.id || sincronizandoDataJud) return;
    setSincronizandoDataJud(true);
    const { data, error } = await supabase.functions.invoke("processual-datajud-sync", { body: { processo_id: processo.id } });
    if (error) showToast?.(`Não foi possível consultar o DataJud: ${error.message}`);
    else if (data?.erro) showToast?.(data.erro);
    else showToast?.(`DataJud atualizado: ${data?.movimentos || 0} movimentações importadas.`);
    await abrirProcesso(processo);
    setSincronizandoDataJud(false);
  }

  async function alterarStatus(item, status) {
    const anterior = item.situacao;
    setRegistros((atuais) => atuais.map((registro) => registro.id === item.id ? { ...registro, situacao: status } : registro));
    const { error } = await supabase.from("processos").update({ situacao: status }).eq("id", item.id);
    if (error) {
      setRegistros((atuais) => atuais.map((registro) => registro.id === item.id ? { ...registro, situacao: anterior } : registro));
      showToast?.(`Não foi possível alterar o status: ${error.message}`);
    }
  }

  const timeline = useMemo(() => {
    const itensReais = [
    ...movimentacoes.map((item) => ({ id: `m-${item.id}`, data: item.data_andamento || item.data_registro, titulo: item.titulo || item.tipo || "Movimentação registrada", descricao: item.descricao, detalhe: item.proxima_providencia, responsavel: item.responsavel || item.created_by_nome, origem: item.origem || "manual" })),
    ...tarefas.map((item) => ({ id: `t-${item.id}`, data: item.created_at, titulo: `${item.tipo}: ${item.titulo}`, descricao: item.descricao || item.observacao, detalhe: `Prazo: ${dataBR(item.data)} · ${item.status}`, responsavel: item.responsavel })),
    ];
    return (itensReais.length ? itensReais : TIMELINE_MOCK).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [movimentacoes, tarefas]);

  async function concluirMovimentacao(evento) {
    evento.preventDefault();
    if (!processo || !movimento.conteudo.trim()) return;
    setSalvando(true);
    const dataRegistro = `${movimento.data || new Date().toISOString().slice(0, 10)}T12:00:00`;
    const payload = { processo_id: processo.id, data_registro: dataRegistro, tipo: movimento.tipo.toLowerCase(), categoria: "Movimentação processual", titulo: `${movimento.tipo} registrada`, descricao: movimento.conteudo.trim(), descricao_tecnica: movimento.observacao.trim() || null, resumo_cliente: movimento.conteudo.trim(), proxima_providencia: movimento.tratamento.trim() || null, responsavel: movimento.responsavel || usuario?.nome || null, fonte: "Registro manual", importancia: acao.prioridade === "Crítica" ? "Crítico" : "Normal", criar_tarefa_relacionada: acao.tipo !== "nenhuma", origem: "manual", created_by_nome: usuario?.nome || usuario?.email || null };
    const { data: movimentoSalvo, error } = await supabase.from("movimentacoes").insert(payload).select("*").single();
    if (error) { setSalvando(false); showToast?.(`Não foi possível registrar a movimentação: ${error.message}`); return; }
    let tarefaSalva = null;
    if (acao.tipo !== "nenhuma" && acao.titulo.trim() && acao.data) {
      // O schema atual classifica eventos genéricos como "Outro". Isso evita
      // violar o CHECK legado enquanto o título mantém a natureza do evento.
      const tipoMap = { tarefa: "Tarefa interna", prazo: "Prazo processual", evento: "Outro", audiencia: "Audiência" };
      const tarefaPayload = { cliente_id: processo.cliente_id, processo_id: processo.id, movimentacao_id: movimentoSalvo.id, cliente_nome: processo.nome_cliente, processo_numero: processo.numero_processo, titulo: acao.titulo.trim(), descricao: movimento.tratamento.trim() || null, tipo: tipoMap[acao.tipo] || "Tarefa interna", data: acao.data, horario: acao.hora || null, responsavel: movimento.responsavel || usuario?.nome || null, prioridade: acao.prioridade, status: "Pendente", observacao: movimento.observacao.trim() || null, created_by_nome: usuario?.nome || usuario?.email || null };
      const resultado = await supabase.from("processual_tarefas").insert(tarefaPayload).select("*").single();
      if (!resultado.error) tarefaSalva = resultado.data;
    }
    await supabase.from("processos").update({ ultima_movimentacao: movimento.conteudo.trim(), ultima_movimentacao_data: dataRegistro, com_pendencia: acao.tipo !== "nenhuma", updated_by: usuario?.email || usuario?.nome || null }).eq("id", processo.id);
    await supabase.from("processos_auditoria").insert({ processo_id: String(processo.id), campo: "movimentação", valor_anterior: null, valor_novo: JSON.stringify({ movimentacao_id: movimentoSalvo.id, atividade_id: tarefaSalva?.id || null }), usuario: usuario?.nome || usuario?.email || null });
    setMovimentacoes((atuais) => [movimentoSalvo, ...atuais]);
    if (tarefaSalva) setTarefas((atuais) => [tarefaSalva, ...atuais]);
    setMovimento({ ...MOVIMENTO_INICIAL, responsavel: usuario?.nome || "" }); setAcao(ACAO_INICIAL); setRegistrando(false); setSalvando(false); showToast?.("Movimentação registrada e histórico atualizado.");
  }

  if (processo) return <FichaProcessual processo={processo} timeline={timeline} registrando={registrando} setRegistrando={setRegistrando} movimento={movimento} setMovimento={setMovimento} acao={acao} setAcao={setAcao} concluir={concluirMovimentacao} salvando={salvando} sincronizarDataJud={sincronizarDataJud} sincronizandoDataJud={sincronizandoDataJud} voltar={() => { setProcesso(null); setRegistrando(false); }} />;

  return <section className="portfolio-process-section"><div className="process-status-section-heading"><div><span>Acompanhamento dos processos judiciais</span><h2>Processual</h2><p>Movimentações, publicações, atividades e histórico dos processos já protocolados.</p></div><button type="button" onClick={carregar}>Atualizar</button></div><div className="process-status-filters"><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, CPF, ID CRM, CNJ, réu, banco ou ação..." /></div>{carregando ? <p className="process-status-empty">Carregando processos...</p> : registros.length ? <div className="portfolio-process-list">{registros.map((item) => <article className="portfolio-process-card" key={item.id}><div className="process-status-card-heading"><div><span>Cliente</span><h3>{item.nome_cliente}</h3></div><select className="process-status-select" aria-label={`Status do processo de ${item.nome_cliente}`} value={item.situacao || "TRAMITANDO"} onChange={(e) => void alterarStatus(item, e.target.value)}>{STATUS_PROCESSO.map((status) => <option key={status} value={status}>{status}</option>)}</select></div><div className="portfolio-process-details"><div><span>Processo</span><strong>{item.numero_processo}</strong></div><div><span>Réu</span><strong>{item.reu || item.banco_reu || "Não informado"}</strong></div><div><span>Ação</span><strong>{item.tipo_acao || "Não informada"}</strong></div><div><span>Última atualização</span><strong>{dataHora(item.ultima_movimentacao_data || item.updated_at)}</strong></div></div>{item.ultima_movimentacao ? <p className="process-status-card-note">{item.ultima_movimentacao}</p> : null}<div className="process-status-card-footer"><small>Cadastro disponível para acompanhamento, inclusive quando encerrado.</small><button type="button" onClick={() => abrirProcesso(item)}>Abrir acompanhamento</button></div></article>)}</div> : <div className="process-status-empty">Nenhum processo judicial cadastrado.</div>}<Pagination pagina={pagina} total={total} tamanho={PAGE_SIZE} onChange={setPagina} rotulo="processos" /></section>;
}

function FichaProcessual({ processo, timeline, registrando, setRegistrando, movimento, setMovimento, acao, setAcao, concluir, salvando, sincronizarDataJud, sincronizandoDataJud, voltar }) {
  return <section className="processual-ficha"><header><button className="btn-secondary" onClick={voltar} type="button">← Voltar ao Processual</button><div><span className="eyebrow">Processual</span><h2>{processo.nome_cliente}</h2><p>{processo.numero_processo}</p></div><div className="processual-actions"><button className="btn-secondary" disabled={sincronizandoDataJud} onClick={sincronizarDataJud} type="button">{sincronizandoDataJud ? "Consultando..." : "Consultar DataJud"}</button><button className="btn-primary" onClick={() => setRegistrando(true)} type="button">Registrar movimentação/publicação</button></div></header><div className="processual-resumo"><div><span>Ação</span><strong>{processo.tipo_acao || "Não informada"}</strong></div><div><span>Réu</span><strong>{processo.reu || processo.banco_reu || "Não informado"}</strong></div><div><span>Tribunal/Juízo</span><strong>{[processo.tribunal, processo.vara, processo.comarca].filter(Boolean).join(" · ") || "Não informado"}</strong></div><div><span>Responsável</span><strong>{processo.responsavel || "Não informado"}</strong></div></div><nav className="processual-tabs"><span>Resumo</span><span>Atividades</span><span className="active">Histórico</span></nav>{registrando ? <FormularioMovimentacao movimento={movimento} setMovimento={setMovimento} acao={acao} setAcao={setAcao} concluir={concluir} salvando={salvando} cancelar={() => setRegistrando(false)} /> : null}<section className="processual-timeline"><h3>Histórico cronológico</h3>{timeline.length ? timeline.map((item) => <article className={`timeline-item timeline-${["escavador", "datajud"].includes(item.origem) ? "automatico" : "manual"}`} key={item.id}><time>{dataHora(item.data)}</time><div><header><strong>{item.titulo}</strong>{["escavador", "datajud"].includes(item.origem) ? <span className="timeline-badge">{item.origem === "datajud" ? "DataJud/CNJ" : "Captura Automática"}</span> : null}</header>{item.descricao ? <p>{item.descricao}</p> : null}{item.detalhe ? <span>{item.detalhe}</span> : null}<small>Responsável: {item.responsavel || "Não informado"}</small></div></article>) : <div className="empty-row">Nenhuma movimentação registrada.</div>}</section></section>;
}

function FormularioMovimentacao({ movimento, setMovimento, acao, setAcao, concluir, salvando, cancelar }) {
  return <form className="movimentacao-form" onSubmit={concluir}><h3>Registrar movimentação ou publicação</h3><div className="movimentacao-grid"><label><span>Data</span><input type="date" value={movimento.data} onChange={(e) => setMovimento((f) => ({ ...f, data: e.target.value }))} /></label><label><span>Tipo</span><select value={movimento.tipo} onChange={(e) => setMovimento((f) => ({ ...f, tipo: e.target.value }))}><option>Publicação</option><option>Movimentação</option><option>Decisão</option><option>Intimação</option><option>Histórico manual</option></select></label><label><span>Responsável</span><input value={movimento.responsavel} onChange={(e) => setMovimento((f) => ({ ...f, responsavel: e.target.value }))} /></label><label className="wide"><span>Conteúdo *</span><textarea rows={6} required value={movimento.conteudo} onChange={(e) => setMovimento((f) => ({ ...f, conteudo: e.target.value }))} /></label><label className="wide"><span>Tratamento sugerido</span><textarea rows={3} value={movimento.tratamento} onChange={(e) => setMovimento((f) => ({ ...f, tratamento: e.target.value }))} /></label><label className="wide"><span>Observação interna</span><textarea rows={3} value={movimento.observacao} onChange={(e) => setMovimento((f) => ({ ...f, observacao: e.target.value }))} /></label></div><section className="acao-relacionada"><h4>Criar ação relacionada</h4><div className="acao-tipos">{[["nenhuma","Somente histórico"],["tarefa","Tarefa"],["prazo","Prazo"],["evento","Evento"],["audiencia","Audiência"]].map(([valor, rotulo]) => <button type="button" className={acao.tipo === valor ? "active" : ""} onClick={() => setAcao((f) => ({ ...f, tipo: valor }))} key={valor}>{rotulo}</button>)}</div>{acao.tipo !== "nenhuma" ? <div className="movimentacao-grid"><label className="wide"><span>Título *</span><input required value={acao.titulo} onChange={(e) => setAcao((f) => ({ ...f, titulo: e.target.value }))} /></label><label><span>Prazo/data *</span><input required type="date" value={acao.data} onChange={(e) => setAcao((f) => ({ ...f, data: e.target.value }))} /></label><label><span>Hora</span><input type="time" value={acao.hora} onChange={(e) => setAcao((f) => ({ ...f, hora: e.target.value }))} /></label><label><span>Prioridade</span><select value={acao.prioridade} onChange={(e) => setAcao((f) => ({ ...f, prioridade: e.target.value }))}><option>Baixa</option><option>Normal</option><option>Alta</option><option>Crítica</option></select></label></div> : null}</section><footer><button className="btn-secondary" onClick={cancelar} type="button">Cancelar</button><button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : "Concluir"}</button></footer></form>;
}
