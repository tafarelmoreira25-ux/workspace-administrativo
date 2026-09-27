import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { sincronizarClienteDoProcesso } from "./lib/processDataSync";
import { mapearMovimentacaoTimeline, ordenarTimelineProcessual } from "./lib/historicoAdministrativo";
import Pagination from "./components/common/Pagination";
import "./carteiraProcessual.css";

const PAGE_SIZE = 30;
const EMPRESA_REPRESENTANTE = "Platino Soluções Financeiras";
const TIPOS_ACAO = ["Ação Revisional Extrajudicial", "Ação Revisional de Juros/Bancária"];
const STATUS_PROCESSO = ["Em andamento", "Pendente de protocolo", "Suspenso / Sobrestado", "Encerrado", "TRAMITANDO", "ARQUIVADO", "BAIXA DEFINITIVA", "SENTENÇA PROCEDENTE", "SENTENÇA IMPROCEDENTE", "REDISTRIBUIÇÃO", "JULGADO"];
const ACAO_INICIAL = { tipo: "nenhuma", titulo: "", data: "", hora: "", prioridade: "Normal" };
const MOVIMENTO_INICIAL = { data: new Date().toISOString().slice(0, 10), tipo: "Publicação", conteudo: "", tratamento: "", observacao: "", responsavel: "" };
const NOVO_PROCESSO_INICIAL = { natureza: "Judicial", nome_cliente: "", cpf_cliente: "", id_crm: "", numero_processo: "", tipo_acao: "", reu: "", banco_reu: "", tribunal: "", comarca: "", vara: "", data_distribuicao: "", responsavel: "", observacoes: "" };
const limparBusca = (valor = "") => valor.trim().replace(/[,()"']/g, " ").replace(/\s+/g, " ").slice(0, 120);
const dataHora = (valor) => valor ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor)) : "—";
const dataBR = (valor) => valor ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${String(valor).slice(0, 10)}T12:00:00`)) : "—";
const ehExtrajudicial = (registro) => registro?.origem_registro === "acao_extrajudicial_manual" || registro?.status_judicial === "EXTRAJUDICIAL";

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
  const [salvandoInformacoes, setSalvandoInformacoes] = useState(false);
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [cadastroErro, setCadastroErro] = useState("");
  const [novoProcesso, setNovoProcesso] = useState(() => ({ ...NOVO_PROCESSO_INICIAL, responsavel: usuario?.nome || "" }));
  const [movimento, setMovimento] = useState(() => ({ ...MOVIMENTO_INICIAL, responsavel: usuario?.nome || "" }));
  const [acao, setAcao] = useState(ACAO_INICIAL);
  const processoInicialCarregado = useRef(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const termo = limparBusca(buscaAplicada);
    let consulta = supabase.from("processos").select("id,cliente_id,nome_cliente,cpf_cliente,id_crm,numero_processo,reu,banco_reu,tipo_acao,tribunal,comarca,vara,data_distribuicao,responsavel,situacao,status_judicial,ultima_movimentacao,ultima_movimentacao_data,ultima_revisao,origem_registro,observacoes,updated_at", { count: "exact" }).or("numero_processo.not.is.null,origem_registro.eq.acao_extrajudicial_manual");
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
      if (error || (!data?.numero_processo?.trim() && !ehExtrajudicial(data))) showToast?.("O processo selecionado não está disponível para acompanhamento.");
      else void abrirProcesso(data);
    });
  }, [processoInicialId, showToast]);

  async function abrirProcesso(item) {
    setProcesso(item);
    const [movReq, tarefasReq] = await Promise.all([
      supabase.from("movimentacoes").select("*").eq("processo_id", item.id).is("deleted_at", null).order("ordem_historico", { ascending: true, nullsFirst: false }).order("data_registro", { ascending: false, nullsFirst: false }).limit(300),
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

  async function salvarInformacoes(dados) {
    if (!processo) return false;
    setSalvandoInformacoes(true);
    const payload = Object.fromEntries(
      ["tipo_acao", "reu", "tribunal", "vara", "comarca", "responsavel"]
        .map((campo) => [campo, dados[campo].trim() || null]),
    );
    payload.updated_by = usuario?.email || usuario?.nome || null;
    const { data, error } = await supabase.from("processos").update(payload).eq("id", processo.id).select("*").single();
    setSalvandoInformacoes(false);
    if (error) {
      showToast?.(`Não foi possível salvar as informações do processo: ${error.message}`);
      return false;
    }
    setProcesso(data);
    setRegistros((atuais) => atuais.map((registro) => registro.id === data.id ? { ...registro, ...data } : registro));
    showToast?.("Informações do processo atualizadas.");
    return true;
  }

  const timeline = useMemo(() => {
    const itensReais = [
    ...movimentacoes.map(mapearMovimentacaoTimeline),
    ...tarefas.map((item) => ({ id: `t-${item.id}`, data: item.created_at, titulo: `${item.tipo}: ${item.titulo}`, descricao: item.descricao || item.observacao, detalhe: `Prazo: ${dataBR(item.data)} · ${item.status}`, responsavel: item.responsavel })),
    ];
    return itensReais.sort(ordenarTimelineProcessual);
  }, [movimentacoes, tarefas]);

  async function atualizarMovimentacao(movimentacao, alteracoes) {
    if (!processo || !movimentacao?.id) return false;
    const dataRegistro = alteracoes.data ? `${alteracoes.data}T12:00:00` : null;
    const payload = {
      data_registro: dataRegistro,
      responsavel: alteracoes.responsavel.trim() || null,
      ...(movimentacao.data_andamento ? { data_andamento: dataRegistro } : {}),
    };
    setSalvando(true);
    const { data, error } = await supabase
      .from("movimentacoes")
      .update(payload)
      .eq("id", movimentacao.id)
      .eq("processo_id", processo.id)
      .select("*")
      .single();
    setSalvando(false);
    if (error) {
      showToast?.(`Não foi possível modificar o registro: ${error.message}`);
      return false;
    }
    setMovimentacoes((atuais) => atuais.map((item) => item.id === data.id ? data : item));
    await supabase.from("processos_auditoria").insert({
      processo_id: String(processo.id),
      campo: "movimentação modificada",
      valor_anterior: JSON.stringify({ data: movimentacao.data_andamento || movimentacao.data_registro, responsavel: movimentacao.responsavel }),
      valor_novo: JSON.stringify({ data: data.data_andamento || data.data_registro, responsavel: data.responsavel }),
      usuario: usuario?.nome || usuario?.email || null,
    });
    showToast?.("Registro modificado.");
    return true;
  }

  function abrirCadastro() {
    setNovoProcesso({ ...NOVO_PROCESSO_INICIAL, responsavel: usuario?.nome || "" });
    setCadastroErro("");
    setCadastroAberto(true);
  }

  async function cadastrarProcesso(evento) {
    evento.preventDefault();
    const judicial = novoProcesso.natureza === "Judicial";
    const nomeCliente = novoProcesso.nome_cliente.trim();
    const numeroProcesso = judicial ? novoProcesso.numero_processo.trim() : "";
    const tipoAcao = novoProcesso.tipo_acao.trim();
    if (!nomeCliente || !tipoAcao || (judicial && !numeroProcesso)) {
      const mensagem = `Informe o cliente, a ação${judicial ? " e o número do processo" : ""}.`;
      setCadastroErro(mensagem);
      showToast?.(mensagem);
      return;
    }

    setCadastroErro("");
    setSalvandoCadastro(true);
    if (judicial) {
      const duplicado = await supabase.from("processos").select("id").eq("numero_processo", numeroProcesso).limit(1).maybeSingle();
      if (duplicado.error) {
        setSalvandoCadastro(false);
        const mensagem = `Não foi possível validar o número do processo: ${duplicado.error.message}`;
        setCadastroErro(mensagem);
        showToast?.(mensagem);
        return;
      }
      if (duplicado.data) {
        setSalvandoCadastro(false);
        const mensagem = "Já existe um processo cadastrado com esse número.";
        setCadastroErro(mensagem);
        showToast?.(mensagem);
        return;
      }
    }

    const parteContraria = novoProcesso.reu.trim() || novoProcesso.banco_reu.trim();
    const payload = {
      nome_cliente: nomeCliente,
      cpf_cliente: novoProcesso.cpf_cliente.trim() || null,
      id_crm: novoProcesso.id_crm.trim() || null,
      pasta_cliente_id: novoProcesso.id_crm.trim() || null,
      autor: nomeCliente,
      reu: parteContraria || null,
      banco_reu: novoProcesso.banco_reu.trim() || parteContraria || null,
      autor_reu: parteContraria ? `${nomeCliente} X ${parteContraria}` : nomeCliente,
      numero_processo: numeroProcesso || null,
      tipo_acao: tipoAcao,
      tribunal: judicial ? novoProcesso.tribunal.trim() || null : null,
      comarca: judicial ? novoProcesso.comarca.trim() || null : null,
      vara: judicial ? novoProcesso.vara.trim() || null : null,
      data_distribuicao: novoProcesso.data_distribuicao || null,
      responsavel: novoProcesso.responsavel.trim() || usuario?.nome || null,
      observacoes: novoProcesso.observacoes.trim() || null,
      origem_registro: judicial ? "acao_judicial_manual" : "acao_extrajudicial_manual",
      updated_by: usuario?.email || usuario?.nome || null,
    };
    const { data, error } = await supabase.from("processos").insert(payload).select("*").single();
    if (error) {
      setSalvandoCadastro(false);
      const mensagem = `Não foi possível cadastrar: ${error.message}`;
      setCadastroErro(mensagem);
      showToast?.(mensagem);
      return;
    }

    const cliente = await sincronizarClienteDoProcesso(supabase, data, usuario).catch(() => null);
    const processoSalvo = cliente?.id ? { ...data, cliente_id: cliente.id } : data;
    setRegistros((atuais) => [processoSalvo, ...atuais]);
    setTotal((atual) => atual + 1);
    setCadastroAberto(false);
    setSalvandoCadastro(false);
    setCadastroErro("");
    setNovoProcesso({ ...NOVO_PROCESSO_INICIAL, responsavel: usuario?.nome || "" });
    showToast?.(judicial ? "Processo judicial cadastrado." : "Ação extrajudicial cadastrada.");
    await abrirProcesso(processoSalvo);
  }

  async function excluirMovimentacao(movimentacao) {
    if (!processo || !movimentacao?.id) return false;
    if (!window.confirm("Excluir este registro do histórico?")) return false;
    const excluidoEm = new Date().toISOString();
    const excluidoPor = usuario?.nome || usuario?.email || null;
    setSalvando(true);
    const { error } = await supabase
      .from("movimentacoes")
      .update({ deleted_at: excluidoEm, deleted_by: excluidoPor })
      .eq("id", movimentacao.id)
      .eq("processo_id", processo.id);
    setSalvando(false);
    if (error) {
      showToast?.(`Não foi possível excluir o registro: ${error.message}`);
      return false;
    }
    setMovimentacoes((atuais) => atuais.filter((item) => item.id !== movimentacao.id));
    await supabase.from("processos_auditoria").insert({
      processo_id: String(processo.id),
      campo: "movimentação excluída",
      valor_anterior: JSON.stringify({ movimentacao_id: movimentacao.id, data_registro: movimentacao.data_registro, responsavel: movimentacao.responsavel }),
      valor_novo: null,
      usuario: excluidoPor,
    });
    showToast?.("Registro excluído do histórico.");
    return true;
  }

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
      const tarefaPayload = { processo_id: processo.id, movimentacao_id: movimentoSalvo.id, cliente_nome: processo.nome_cliente, processo_numero: processo.numero_processo, titulo: acao.titulo.trim(), descricao: movimento.tratamento.trim() || null, tipo: tipoMap[acao.tipo] || "Tarefa interna", data: acao.data, horario: acao.hora || null, responsavel: movimento.responsavel || usuario?.nome || null, prioridade: acao.prioridade, status: "Pendente", observacao: movimento.observacao.trim() || null, created_by_nome: usuario?.nome || usuario?.email || null };
      const resultado = await supabase.from("processual_tarefas").insert(tarefaPayload).select("*").single();
      if (!resultado.error) tarefaSalva = resultado.data;
    }
    await supabase.from("processos").update({ ultima_movimentacao: movimento.conteudo.trim(), ultima_movimentacao_data: dataRegistro, com_pendencia: acao.tipo !== "nenhuma", updated_by: usuario?.email || usuario?.nome || null }).eq("id", processo.id);
    await supabase.from("processos_auditoria").insert({ processo_id: String(processo.id), campo: "movimentação", valor_anterior: null, valor_novo: JSON.stringify({ movimentacao_id: movimentoSalvo.id, atividade_id: tarefaSalva?.id || null }), usuario: usuario?.nome || usuario?.email || null });
    setMovimentacoes((atuais) => [movimentoSalvo, ...atuais]);
    if (tarefaSalva) setTarefas((atuais) => [tarefaSalva, ...atuais]);
    setMovimento({ ...MOVIMENTO_INICIAL, responsavel: usuario?.nome || "" }); setAcao(ACAO_INICIAL); setRegistrando(false); setSalvando(false); showToast?.("Movimentação registrada e histórico atualizado.");
  }

  if (processo) return <FichaProcessual processo={processo} timeline={timeline} registrando={registrando} setRegistrando={setRegistrando} movimento={movimento} setMovimento={setMovimento} acao={acao} setAcao={setAcao} concluir={concluirMovimentacao} atualizarMovimentacao={atualizarMovimentacao} excluirMovimentacao={excluirMovimentacao} salvando={salvando} sincronizarDataJud={sincronizarDataJud} sincronizandoDataJud={sincronizandoDataJud} salvarInformacoes={salvarInformacoes} salvandoInformacoes={salvandoInformacoes} voltar={() => { setProcesso(null); setRegistrando(false); }} />;

  return <>
    <section className="portfolio-process-section">
      <div className="process-status-section-heading">
        <div><span>Acompanhamento judicial e extrajudicial</span><h2>Processual</h2><p>Movimentações, publicações, atividades e histórico de processos e ações.</p></div>
        <div className="process-status-heading-actions"><button className="primary" type="button" onClick={abrirCadastro}>Cadastrar processo/ação</button><button type="button" onClick={carregar}>Atualizar</button></div>
      </div>
      <div className="process-status-filters"><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, CPF, ID CRM, CNJ, réu, banco ou ação..." /></div>
      {carregando ? <p className="process-status-empty">Carregando processos...</p> : registros.length ? <div className="portfolio-process-list">{registros.map((item) => {
        const extrajudicial = ehExtrajudicial(item);
        return <article className="portfolio-process-card" key={item.id}>
          <div className="process-status-card-heading"><div><span>{extrajudicial ? "Ação extrajudicial" : "Processo judicial"}</span><h3>{item.nome_cliente}</h3></div><select className="process-status-select" aria-label={`Status do processo de ${item.nome_cliente}`} value={item.situacao || "TRAMITANDO"} onChange={(e) => void alterarStatus(item, e.target.value)}>{STATUS_PROCESSO.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
          <div className="portfolio-process-details"><div><span>{extrajudicial ? "Modalidade" : "Processo"}</span><strong>{extrajudicial ? "Extrajudicial" : item.numero_processo || "Não informado"}</strong></div><div><span>Parte contrária</span><strong>{item.reu || item.banco_reu || "Não informado"}</strong></div><div><span>Ação</span><strong>{item.tipo_acao || "Não informada"}</strong></div><div><span>Última atualização</span><strong>{dataHora(item.ultima_movimentacao_data || item.updated_at)}</strong></div></div>
          {item.ultima_movimentacao ? <p className="process-status-card-note">{item.ultima_movimentacao}</p> : null}
          <div className="process-status-card-footer"><small>Cadastro disponível para acompanhamento, inclusive quando encerrado.</small><button type="button" onClick={() => abrirProcesso(item)}>Abrir acompanhamento</button></div>
        </article>;
      })}</div> : <div className="process-status-empty">Nenhum processo ou ação cadastrado.</div>}
      <Pagination pagina={pagina} total={total} tamanho={PAGE_SIZE} onChange={setPagina} rotulo="registros" />
    </section>
    {cadastroAberto ? <FormularioNovoProcesso form={novoProcesso} setForm={setNovoProcesso} salvando={salvandoCadastro} erro={cadastroErro} onSubmit={cadastrarProcesso} onClose={() => { setCadastroAberto(false); setCadastroErro(""); }} /> : null}
  </>;
}

function FichaProcessual({ processo, timeline, registrando, setRegistrando, movimento, setMovimento, acao, setAcao, concluir, atualizarMovimentacao, excluirMovimentacao, salvando, sincronizarDataJud, sincronizandoDataJud, salvarInformacoes, salvandoInformacoes, voltar }) {
  const [editandoInformacoes, setEditandoInformacoes] = useState(false);
  const [informacoes, setInformacoes] = useState(null);
  const [registroEditando, setRegistroEditando] = useState(null);
  const extrajudicial = ehExtrajudicial(processo);

  function iniciarEdicao() {
    setInformacoes({
      tipo_acao: processo.tipo_acao || "",
      reu: processo.reu || processo.banco_reu || "",
      tribunal: processo.tribunal || "",
      vara: processo.vara || "",
      comarca: processo.comarca || "",
      responsavel: processo.responsavel || "",
    });
    setEditandoInformacoes(true);
  }

  async function concluirEdicao(evento) {
    evento.preventDefault();
    if (await salvarInformacoes(informacoes)) setEditandoInformacoes(false);
  }

  function iniciarEdicaoRegistro(item) {
    setRegistroEditando({
      id: item.id,
      movimentacao: item.movimentacao,
      data: String(item.data || "").slice(0, 10),
      responsavel: item.movimentacao.responsavel || item.movimentacao.created_by_nome || "",
    });
  }

  async function concluirEdicaoRegistro(evento) {
    evento.preventDefault();
    if (await atualizarMovimentacao(registroEditando.movimentacao, registroEditando)) setRegistroEditando(null);
  }

  async function excluirRegistro(item) {
    if (await excluirMovimentacao(item.movimentacao) && registroEditando?.id === item.id) setRegistroEditando(null);
  }

  return <section className="processual-ficha">
    <header className="processual-ficha-header">
      <button className="processual-back" onClick={voltar} disabled={salvandoInformacoes || sincronizandoDataJud} type="button" aria-label="Voltar ao Processual" title="Voltar ao Processual">←</button>
      <div className="processual-identidade">
        <span className="eyebrow">{extrajudicial ? "Ação extrajudicial" : "Processo judicial"}</span>
        <h2>{processo.nome_cliente}</h2>
        <p>{EMPRESA_REPRESENTANTE} – Representante e Assessoria do Requerente</p>
      </div>
      <details className="processual-actions-menu">
        <summary aria-label="Abrir ações" title="Ações">•••</summary>
        <div>
          <button onClick={iniciarEdicao} disabled={editandoInformacoes || salvandoInformacoes} type="button">Editar informações</button>
          <button onClick={() => setRegistrando(true)} type="button">Registrar movimentação</button>
          {!extrajudicial && processo.numero_processo ? <button disabled={sincronizandoDataJud} onClick={sincronizarDataJud} type="button">{sincronizandoDataJud ? "Consultando DataJud..." : "Consultar DataJud"}</button> : null}
        </div>
      </details>
    </header>
    <div className="processual-resumo">
      <div><span>Ação</span><strong className="processual-action-id">{processo.nome_cliente}{processo.id_crm ? <> – <b>{processo.id_crm}</b></> : null}</strong></div>
      {!extrajudicial ? <div><span>Número do processo</span><strong>{processo.numero_processo || "Não informado"}</strong></div> : null}
      <div><span>Especialista em direito bancário</span><strong>{processo.responsavel || "Não informado"}</strong></div>
      <div><span>Parte contrária</span><strong>{processo.reu || processo.banco_reu || "Não informada"}</strong></div>
    </div>
    {editandoInformacoes ? <form className="processual-dados-form" onSubmit={concluirEdicao}>
      <h3>Editar informações da ação</h3>
      <div className="processual-dados-grid">
        <label><span>Ação</span><select value={informacoes.tipo_acao} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, tipo_acao: e.target.value }))}>{informacoes.tipo_acao && !TIPOS_ACAO.includes(informacoes.tipo_acao) ? <option value={informacoes.tipo_acao}>{informacoes.tipo_acao}</option> : null}{TIPOS_ACAO.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></label>
        <label><span>Parte contrária</span><input value={informacoes.reu} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, reu: e.target.value }))} /></label>
        <label><span>Especialista em direito bancário</span><input value={informacoes.responsavel} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, responsavel: e.target.value }))} placeholder="Advogado ou representante jurídico" /></label>
        {!extrajudicial ? <><label><span>Tribunal</span><input value={informacoes.tribunal} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, tribunal: e.target.value }))} /></label><label><span>Vara/Juízo</span><input value={informacoes.vara} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, vara: e.target.value }))} /></label><label><span>Comarca</span><input value={informacoes.comarca} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, comarca: e.target.value }))} /></label></> : null}
      </div>
      <footer><button className="btn-secondary" onClick={() => setEditandoInformacoes(false)} disabled={salvandoInformacoes} type="button">Cancelar</button><button className="btn-primary" disabled={salvandoInformacoes} type="submit">{salvandoInformacoes ? "Salvando..." : "Salvar informações"}</button></footer>
    </form> : null}
    {registrando ? <FormularioMovimentacao movimento={movimento} setMovimento={setMovimento} acao={acao} setAcao={setAcao} concluir={concluir} salvando={salvando} cancelar={() => setRegistrando(false)} /> : null}
    <section className="processual-timeline"><div className="processual-progress-title"><div><h3>Progresso da ação</h3><p>Movimentações registradas em ordem cronológica.</p></div><strong>{timeline.length} {timeline.length === 1 ? "registro" : "registros"}</strong></div>{timeline.length ? timeline.map((item, indice) => <article className={`timeline-item ${indice === 0 ? "timeline-current" : "timeline-done"} timeline-${["escavador", "datajud"].includes(item.origem) ? "automatico" : "manual"}`} key={item.id}>{item.data ? <time dateTime={item.data}>{dataBR(item.data)}</time> : <span className="timeline-no-date">Sem data</span>}<div><header><strong>{item.titulo}</strong><div className="timeline-header-actions">{item.possuiAnexo ? <span className="timeline-attachment" title="Anexo disponivel no Drive do cliente" aria-label="Anexo disponivel no Drive do cliente">Anexo</span> : null}{["escavador", "datajud"].includes(item.origem) ? <span className="timeline-badge">{item.origem === "datajud" ? "DataJud/CNJ" : "Captura automática"}</span> : null}{item.movimentacao ? <details className="timeline-actions-menu"><summary aria-label="Ações do registro" title="Ações">•••</summary><div><button disabled={salvando} onClick={() => iniciarEdicaoRegistro(item)} type="button">Modificar</button><button className="danger" disabled={salvando} onClick={() => void excluirRegistro(item)} type="button">Excluir</button></div></details> : null}</div></header>{registroEditando?.id === item.id ? <form className="timeline-edit-form" onSubmit={concluirEdicaoRegistro}><label><span>Data</span><input type="date" value={registroEditando.data} onChange={(e) => setRegistroEditando((atual) => ({ ...atual, data: e.target.value }))} /></label><label><span>Responsável</span><input value={registroEditando.responsavel} onChange={(e) => setRegistroEditando((atual) => ({ ...atual, responsavel: e.target.value }))} /></label><div><button className="btn-secondary" disabled={salvando} onClick={() => setRegistroEditando(null)} type="button">Cancelar</button><button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : "Salvar"}</button></div></form> : <>{item.descricao ? <p>{item.descricao}</p> : null}{item.detalhe ? <span>{item.detalhe}</span> : null}<small>Responsável: {item.responsavel || "Não informado"}</small></>}</div></article>) : <div className="empty-row">Nenhuma movimentação registrada.</div>}</section>
  </section>;
}

function FormularioNovoProcesso({ form, setForm, salvando, erro, onSubmit, onClose }) {
  const judicial = form.natureza === "Judicial";
  return <div className="process-registration-backdrop" role="presentation">
    <form className="process-registration-modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="process-registration-title">
      <header><div><span className="eyebrow">Novo cadastro</span><h3 id="process-registration-title">Cadastrar processo ou ação</h3><p>Escolha a modalidade e informe os dados principais para iniciar o acompanhamento.</p></div><button aria-label="Fechar" disabled={salvando} onClick={onClose} type="button">×</button></header>
      {erro ? <div className="process-registration-error" role="alert">{erro}</div> : null}
      <div className="process-registration-grid">
        <label><span>Modalidade *</span><select value={form.natureza} onChange={(e) => setForm((atual) => ({ ...atual, natureza: e.target.value }))}><option>Judicial</option><option>Extrajudicial</option></select></label>
        <label className="span-2"><span>Cliente *</span><input required value={form.nome_cliente} onChange={(e) => setForm((atual) => ({ ...atual, nome_cliente: e.target.value }))} /></label>
        <label><span>CPF/CNPJ</span><input value={form.cpf_cliente} onChange={(e) => setForm((atual) => ({ ...atual, cpf_cliente: e.target.value }))} /></label>
        <label><span>ID CRM</span><input value={form.id_crm} onChange={(e) => setForm((atual) => ({ ...atual, id_crm: e.target.value }))} /></label>
        {judicial ? <label className="span-2"><span>Número do processo *</span><input required value={form.numero_processo} onChange={(e) => setForm((atual) => ({ ...atual, numero_processo: e.target.value }))} placeholder="0000000-00.0000.0.00.0000" /></label> : <div className="process-registration-help span-2"><strong>Ação extrajudicial</strong><span>Não é necessário informar número CNJ. O cadastro ficará disponível normalmente no histórico processual.</span></div>}
        <label className="span-2"><span>Ação *</span><select required value={form.tipo_acao} onChange={(e) => setForm((atual) => ({ ...atual, tipo_acao: e.target.value }))}><option value="">Selecione</option>{TIPOS_ACAO.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></label>
        <label><span>Parte contrária</span><input value={form.reu} onChange={(e) => setForm((atual) => ({ ...atual, reu: e.target.value }))} /></label>
        <label><span>Banco/instituição</span><input value={form.banco_reu} onChange={(e) => setForm((atual) => ({ ...atual, banco_reu: e.target.value }))} /></label>
        <label><span>{judicial ? "Data de distribuição" : "Data de início"}</span><input type="date" value={form.data_distribuicao} onChange={(e) => setForm((atual) => ({ ...atual, data_distribuicao: e.target.value }))} /></label>
        <label className="span-2"><span>Especialista em direito bancário</span><input value={form.responsavel} onChange={(e) => setForm((atual) => ({ ...atual, responsavel: e.target.value }))} placeholder="Advogado ou representante jurídico" /></label>
        {judicial ? <><label><span>Tribunal</span><input value={form.tribunal} onChange={(e) => setForm((atual) => ({ ...atual, tribunal: e.target.value }))} /></label><label><span>Comarca</span><input value={form.comarca} onChange={(e) => setForm((atual) => ({ ...atual, comarca: e.target.value }))} /></label><label><span>Vara/Juízo</span><input value={form.vara} onChange={(e) => setForm((atual) => ({ ...atual, vara: e.target.value }))} /></label></> : null}
        <label className="wide"><span>Observações</span><textarea rows={4} value={form.observacoes} onChange={(e) => setForm((atual) => ({ ...atual, observacoes: e.target.value }))} /></label>
      </div>
      <footer><button className="btn-secondary" disabled={salvando} onClick={onClose} type="button">Cancelar</button><button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : judicial ? "Cadastrar processo" : "Cadastrar ação"}</button></footer>
    </form>
  </div>;
}

function FormularioMovimentacao({ movimento, setMovimento, acao, setAcao, concluir, salvando, cancelar }) {
  return <form className="movimentacao-form" onSubmit={concluir}><h3>Registrar movimentação ou publicação</h3><div className="movimentacao-grid"><label><span>Data</span><input type="date" value={movimento.data} onChange={(e) => setMovimento((f) => ({ ...f, data: e.target.value }))} /></label><label><span>Tipo</span><select value={movimento.tipo} onChange={(e) => setMovimento((f) => ({ ...f, tipo: e.target.value }))}><option>Publicação</option><option>Movimentação</option><option>Decisão</option><option>Intimação</option><option>Histórico manual</option></select></label><label><span>Responsável</span><input value={movimento.responsavel} onChange={(e) => setMovimento((f) => ({ ...f, responsavel: e.target.value }))} /></label><label className="wide"><span>Conteúdo *</span><textarea rows={6} required value={movimento.conteudo} onChange={(e) => setMovimento((f) => ({ ...f, conteudo: e.target.value }))} /></label><label className="wide"><span>Tratamento sugerido</span><textarea rows={3} value={movimento.tratamento} onChange={(e) => setMovimento((f) => ({ ...f, tratamento: e.target.value }))} /></label><label className="wide"><span>Observação interna</span><textarea rows={3} value={movimento.observacao} onChange={(e) => setMovimento((f) => ({ ...f, observacao: e.target.value }))} /></label></div><section className="acao-relacionada"><h4>Criar ação relacionada</h4><div className="acao-tipos">{[["nenhuma","Somente histórico"],["tarefa","Tarefa"],["prazo","Prazo"],["evento","Evento"],["audiencia","Audiência"]].map(([valor, rotulo]) => <button type="button" className={acao.tipo === valor ? "active" : ""} onClick={() => setAcao((f) => ({ ...f, tipo: valor }))} key={valor}>{rotulo}</button>)}</div>{acao.tipo !== "nenhuma" ? <div className="movimentacao-grid"><label className="wide"><span>Título *</span><input required value={acao.titulo} onChange={(e) => setAcao((f) => ({ ...f, titulo: e.target.value }))} /></label><label><span>Prazo/data *</span><input required type="date" value={acao.data} onChange={(e) => setAcao((f) => ({ ...f, data: e.target.value }))} /></label><label><span>Hora</span><input type="time" value={acao.hora} onChange={(e) => setAcao((f) => ({ ...f, hora: e.target.value }))} /></label><label><span>Prioridade</span><select value={acao.prioridade} onChange={(e) => setAcao((f) => ({ ...f, prioridade: e.target.value }))}><option>Baixa</option><option>Normal</option><option>Alta</option><option>Crítica</option></select></label></div> : null}</section><footer><button className="btn-secondary" onClick={cancelar} type="button">Cancelar</button><button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : "Concluir"}</button></footer></form>;
}
