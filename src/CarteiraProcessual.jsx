import { FormActions, FormField, FormGrid, FormSection, Input, Select, Textarea } from "./components/common/FormControls";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, invalidarConsultas } from "./lib/supabase";
import { buscarClienteUnico, sincronizarClienteDoProcesso } from "./lib/processDataSync";
import ClientesModule from "./components/clientes/ClientesModule";
import { agruparTimelineProcessual, descricoesDiferentes, mapearMovimentacaoTimeline, ordenarTimelineProcessual } from "./lib/historicoAdministrativo";
import { numeroProtocoloExtrajudicial } from "./lib/protocoloExtrajudicial";
import Pagination from "./components/common/Pagination";
import "./carteiraProcessual.css";

const PAGE_SIZE = 10;
const CAMPOS_PROCESSUAIS_LISTA = "id,nome_cliente,protocolo_extrajudicial,numero_processo,situacao";
const EXTRAJUDICIAIS_POR_PAGINA = 10;
const CAMPOS_EXTRAJUDICIAIS_LISTA = "id,nome_cliente,protocolo_extrajudicial,id_crm,data_inicio_extrajudicial,created_at,reu,banco_reu,situacao";

function corStatusExtrajudicial(status) {
  const valor = status.toUpperCase();
  if (/ENCERRADO|ARQUIVADO|BAIXA|JULGADO|SENTENÇA/.test(valor)) return "encerrado";
  if (/SUSPENSO|SOBRESTADO|PENDENTE/.test(valor)) return "pendente";
  return "andamento";
}
const ESPECIALISTAS_DIREITO_BANCARIO = [
  "Marykeller de Mello OAB/SP 336.677",
  "Juliana Cristina Galzo OAB/SP 524.585",
  "Tafarel Moreira - Auxiliar Juridico com registro ativo - JUS.BR",
];
const TIPOS_ACAO = ["Ação Revisional Extrajudicial", "Ação Revisional de Juros/Bancária"];
const ACAO_INICIAL = { tipo: "nenhuma", titulo: "", data: "", hora: "", prioridade: "Normal" };
const MOVIMENTO_INICIAL = { data: new Date().toISOString().slice(0, 10), tipo: "Publicação", conteudo: "", tratamento: "", observacao: "", responsavel: "" };
const NOVO_PROCESSO_INICIAL = { natureza: "Extrajudicial", nome_cliente: "", cpf_cliente: "", id_crm: "", numero_processo: "", tipo_acao: "", reu: "", banco_reu: "", tribunal: "", comarca: "", vara: "", data_distribuicao: "", responsavel: "", observacoes: "" };
const limparBusca = (valor = "") => valor.trim().replace(/[,()"']/g, " ").replace(/\s+/g, " ").slice(0, 120);
const dataBR = (valor) => valor ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${String(valor).slice(0, 10)}T12:00:00`)) : "—";
const ehExtrajudicial = (registro) => registro?.status_judicial === "EXTRAJUDICIAL" || (!registro?.status_judicial && registro?.origem_registro === "acao_extrajudicial_manual" && registro?.fase_atual === "Extrajudicial");
const emFluxoDeProtocolo = (registro) => !registro?.numero_processo && registro?.status_judicial === "AGUARDANDO_PROTOCOLO";

export default function CarteiraProcessual({ showToast, usuario, processoInicialId, modo = "judicial", alerta, onLimparAlerta }) {
  const carteiraExtrajudicial = modo === "extrajudicial";
  const tamanhoPagina = carteiraExtrajudicial ? EXTRAJUDICIAIS_POR_PAGINA : PAGE_SIZE;
  const [abrindoProcesso, setAbrindoProcesso] = useState(null);
  const aberturaAtual = useRef(0);
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [processo, setProcesso] = useState(null);
  const [clienteProcesso, setClienteProcesso] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  const [registrando, setRegistrando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sincronizandoDataJud, setSincronizandoDataJud] = useState(false);
  const [salvandoInformacoes, setSalvandoInformacoes] = useState(false);
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [cadastroErro, setCadastroErro] = useState("");
  const [novoProcesso, setNovoProcesso] = useState(() => ({ ...NOVO_PROCESSO_INICIAL }));
  const [movimento, setMovimento] = useState(() => ({ ...MOVIMENTO_INICIAL, responsavel: usuario?.nome || "" }));
  const [acao, setAcao] = useState(ACAO_INICIAL);
  const processoInicialCarregado = useRef(null);

  const carregar = useCallback(async (signal = new AbortController().signal) => {
    setCarregando(true);
    const termo = limparBusca(buscaAplicada);
    let consulta = supabase.from("processos").select(carteiraExtrajudicial ? CAMPOS_EXTRAJUDICIAIS_LISTA : CAMPOS_PROCESSUAIS_LISTA, { count: "exact" });
    if (alerta) consulta = alerta.ids.length ? consulta.in("id", alerta.ids) : consulta.eq("id", "00000000-0000-0000-0000-000000000000");
    consulta = carteiraExtrajudicial
      ? consulta.or("status_judicial.eq.EXTRAJUDICIAL,and(status_judicial.is.null,origem_registro.eq.acao_extrajudicial_manual,fase_atual.eq.Extrajudicial)").or("numero_processo.is.null,numero_processo.eq.")
      : consulta.not("numero_processo", "is", null).neq("numero_processo", "");
    if (termo) consulta = consulta.or(`nome_cliente.ilike.%${termo}%,cpf_cliente.ilike.%${termo}%,id_crm.ilike.%${termo}%,protocolo_extrajudicial.ilike.%${termo}%,numero_processo.ilike.%${termo}%,reu.ilike.%${termo}%,banco_reu.ilike.%${termo}%,tipo_acao.ilike.%${termo}%`);
    const inicio = (pagina - 1) * tamanhoPagina;
    const { data, count, error } = await consulta.order("updated_at", { ascending: false }).range(inicio, inicio + tamanhoPagina - 1).limit(10).abortSignal(signal);
    if (signal.aborted) return;
    if (error) showToast?.(`Não foi possível carregar o Processual: ${error.message}`);
    else { setRegistros(data || []); setTotal(count || 0); }
    setCarregando(false);
  }, [alerta, buscaAplicada, carteiraExtrajudicial, pagina, showToast, tamanhoPagina]);

  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void carregar(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [carregar]);
  useEffect(() => { const timer = window.setTimeout(() => { setPagina(1); setBuscaAplicada(busca); }, 350); return () => window.clearTimeout(timer); }, [busca]);

  const abrirProcesso = useCallback(async (item) => {
    const abertura = ++aberturaAtual.current;
    setAbrindoProcesso(item.id);
    const { data: detalhes, error } = await supabase.from("processos").select("*").eq("id", item.id).maybeSingle();
    if (abertura !== aberturaAtual.current) return;
    if (error || !detalhes) {
      setAbrindoProcesso(null);
      showToast?.("Não foi possível abrir o acompanhamento. Tente novamente.");
      return;
    }
    setClienteProcesso(null);
    setMovimentacoes([]);
    setTarefas([]);
    const [movReq, tarefasReq] = await Promise.all([
      supabase.from("movimentacoes").select("*").eq("processo_id", item.id).is("deleted_at", null).order("ordem_historico", { ascending: false, nullsFirst: false }).order("data_registro", { ascending: false, nullsFirst: false }).limit(300),
      supabase.from("processual_tarefas").select("*").eq("processo_id", item.id).order("created_at", { ascending: false }).limit(300),
    ]);
    if (abertura !== aberturaAtual.current) return;
    setAbrindoProcesso(null);
    setProcesso(detalhes);
    if (movReq.error || tarefasReq.error) showToast?.("Não foi possível carregar parte do histórico ou das tarefas. Reabra o acompanhamento para tentar novamente.");
    setMovimentacoes(movReq.error ? [] : movReq.data || []);
    setTarefas(tarefasReq.error ? [] : tarefasReq.data || []);
  }, [showToast]);

  useEffect(() => {
    if (!processoInicialId || processoInicialCarregado.current === String(processoInicialId)) return;
    processoInicialCarregado.current = String(processoInicialId);
    void supabase.from("processos").select("id,status_judicial,origem_registro,fase_atual,numero_processo").eq("id", processoInicialId).maybeSingle().then(({ data, error }) => {
      const pertenceACarteira = carteiraExtrajudicial ? ehExtrajudicial(data) : Boolean(data?.numero_processo?.trim());
      if (error || !pertenceACarteira) showToast?.(`O cadastro selecionado não está disponível em ${carteiraExtrajudicial ? "Extrajudiciais" : "Processual"}.`);
      else void abrirProcesso(data);
    });
  }, [abrirProcesso, carteiraExtrajudicial, processoInicialId, showToast]);

  useEffect(() => {
    let ativo = true;
    async function carregarCliente() {
      if (!processo) return;
      const cliente = await buscarClienteUnico(supabase, processo);
      if (ativo) setClienteProcesso(cliente);
    }
    void carregarCliente();
    return () => { ativo = false; };
  }, [processo, showToast]);

  async function abrirProcessoDaFicha(id) {
    setRegistrando(false);
    await abrirProcesso({ id });
  }

  async function sincronizarDataJud() {
    if (!processo?.id || sincronizandoDataJud) return;
    setSincronizandoDataJud(true);
    try {
      const { data, error } = await supabase.functions.invoke("processual-datajud-sync", { body: { processo_id: processo.id } });
      let detalhe = "";
      if (error?.context && typeof error.context.json === "function") {
        try { detalhe = (await error.context.clone().json())?.erro || ""; } catch { detalhe = ""; }
      }
      if (error) showToast?.(`Não foi possível consultar o DataJud: ${detalhe || error.message}`);
      else if (data?.erro) showToast?.(data.detalhe ? `${data.erro} ${data.detalhe}` : data.erro);
      else if (data?.sincronizado === false) showToast?.(data.motivo || "Processo não localizado no DataJud.");
      else showToast?.(`DataJud atualizado: ${data?.movimentos || 0} nova(s) movimentação(ões) importada(s).`);
      await abrirProcesso(processo);
    } finally {
      setSincronizandoDataJud(false);
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
    const faseAtual = ehExtrajudicial(processo)
      ? { fase: "extrajudicial_administrativa", ordemFase: 1 }
      : emFluxoDeProtocolo(processo)
        ? { fase: "transicao_judicial", ordemFase: 2 }
        : { fase: "judicial", ordemFase: 3 };
    const movimentosMapeados = movimentacoes.map(mapearMovimentacaoTimeline);
    const fasePorMovimentacao = new Map(movimentosMapeados.map((item) => [item.movimentacao?.id, { fase: item.fase, ordemFase: item.ordemFase }]));
    const itensReais = [
    ...movimentosMapeados,
    ...tarefas.map((item) => ({ id: `t-${item.id}`, tarefa: item, data: item.created_at, criadoEm: item.created_at, ...(fasePorMovimentacao.get(item.movimentacao_id) || faseAtual), titulo: item.tipo === "Outro" ? item.titulo : `${item.tipo}: ${item.titulo}`, descricao: item.descricao || item.observacao, detalhe: `Prazo: ${dataBR(item.data)}${item.horario ? ` às ${item.horario.slice(0, 5)}` : ""} · ${item.status}`, responsavel: item.responsavel })),
    ];
    return itensReais.sort(ordenarTimelineProcessual);
  }, [movimentacoes, processo, tarefas]);

  async function atualizarTarefa(tarefa, alteracoes) {
    if (!processo || !tarefa?.id || !alteracoes.titulo.trim() || !alteracoes.data) return false;
    const payload = {
      titulo: alteracoes.titulo.trim(), descricao: alteracoes.descricao.trim() || null,
      observacao: alteracoes.observacao.trim() || null, data: alteracoes.data,
      horario: alteracoes.horario || null, responsavel: alteracoes.responsavel.trim() || null,
      prioridade: alteracoes.prioridade, status: alteracoes.status,
      updated_by_nome: usuario?.nome || usuario?.email || null,
    };
    setSalvando(true);
    try {
      const { data, error } = await supabase.from("processual_tarefas").update(payload).eq("id", tarefa.id).eq("processo_id", processo.id).select("*").single();
      if (error) { showToast?.(`Não foi possível modificar a atividade: ${error.message}`); return false; }
      setTarefas((atuais) => atuais.map((item) => item.id === data.id ? data : item));
      await supabase.from("processos_auditoria").insert({ processo_id: String(processo.id), campo: "atividade modificada", valor_anterior: JSON.stringify(tarefa), valor_novo: JSON.stringify(data), usuario: payload.updated_by_nome });
      showToast?.("Atividade modificada.");
      return true;
    } finally { setSalvando(false); }
  }

  async function excluirTarefa(tarefa) {
    if (!processo || !tarefa?.id || !window.confirm("Excluir esta atividade? Ela também será removida da agenda de tarefas e prazos.")) return false;
    setSalvando(true);
    try {
      const { data, error } = await supabase.from("processual_tarefas").delete().eq("id", tarefa.id).eq("processo_id", processo.id).select("id").single();
      if (error || !data) { showToast?.(`Não foi possível excluir a atividade: ${error?.message || "Registro não encontrado"}`); return false; }
      setTarefas((atuais) => atuais.filter((item) => item.id !== tarefa.id));
      await supabase.from("processos_auditoria").insert({ processo_id: String(processo.id), campo: "atividade excluída", valor_anterior: JSON.stringify(tarefa), valor_novo: null, usuario: usuario?.nome || usuario?.email || null });
      showToast?.("Atividade excluída.");
      return true;
    } finally { setSalvando(false); }
  }

  async function atualizarMovimentacao(movimentacao, alteracoes) {
    if (!processo || !movimentacao?.id) return false;
    if (["datajud", "escavador"].includes(movimentacao.origem)) {
      showToast?.("Movimentações automáticas são somente para consulta.");
      return false;
    }
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
    setNovoProcesso({ ...NOVO_PROCESSO_INICIAL, natureza: carteiraExtrajudicial ? "Extrajudicial" : "Judicial" });
    setCadastroErro("");
    setCadastroAberto(true);
  }

  async function cadastrarProcesso(evento) {
    evento.preventDefault();
    const judicial = novoProcesso.natureza === "Judicial";
    const nomeCliente = novoProcesso.nome_cliente.trim();
    const idCrm = novoProcesso.id_crm.trim();
    const numeroProcesso = judicial ? novoProcesso.numero_processo.trim() : "";
    const tipoAcao = novoProcesso.tipo_acao.trim();
    if (!nomeCliente || !tipoAcao || (judicial && !numeroProcesso) || (!judicial && !idCrm)) {
      const mensagem = `Informe o cliente, a ação${judicial ? " e o número do processo" : " e o ID CRM"}.`;
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
      id_crm: idCrm || null,
      pasta_cliente_id: idCrm || null,
      autor: nomeCliente,
      reu: parteContraria || null,
      banco_reu: novoProcesso.banco_reu.trim() || parteContraria || null,
      autor_reu: parteContraria ? `${nomeCliente} X ${parteContraria}` : nomeCliente,
      numero_processo: numeroProcesso || null,
      tipo_acao: tipoAcao,
      tribunal: judicial ? novoProcesso.tribunal.trim() || null : null,
      comarca: judicial ? novoProcesso.comarca.trim() || null : null,
      vara: judicial ? novoProcesso.vara.trim() || null : null,
      data_distribuicao: judicial ? novoProcesso.data_distribuicao || null : null,
      data_inicio_extrajudicial: judicial ? null : novoProcesso.data_distribuicao || null,
      responsavel: novoProcesso.responsavel.trim() || usuario?.nome || null,
      observacoes: novoProcesso.observacoes.trim() || null,
      origem_registro: judicial ? "acao_judicial_manual" : "acao_extrajudicial_manual",
      status_judicial: judicial ? "JUDICIAL" : "EXTRAJUDICIAL",
      fase_atual: judicial ? "Tramitando" : "Extrajudicial",
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
    setRegistros((atuais) => [processoSalvo, ...atuais].slice(0, tamanhoPagina));
    setTotal((atual) => atual + 1);
    setCadastroAberto(false);
    setSalvandoCadastro(false);
    setCadastroErro("");
    setNovoProcesso({ ...NOVO_PROCESSO_INICIAL, natureza: carteiraExtrajudicial ? "Extrajudicial" : "Judicial" });
    showToast?.(judicial ? "Processo judicial cadastrado." : "Ação extrajudicial cadastrada.");
    await abrirProcesso(processoSalvo);
  }

  async function encaminharAoProtocolo(dados) {
    if (!processo?.id) return false;
    setSalvando(true);
    const { error } = await supabase.rpc("encaminhar_acao_extrajudicial_ao_protocolo", {
      p_processo_id: processo.id,
      p_data_encaminhamento: dados.data_encaminhamento || new Date().toISOString().slice(0, 10),
      p_motivo_ajuizamento: dados.motivo_ajuizamento,
      p_responsavel: usuario?.nome || usuario?.email || null,
    });
    setSalvando(false);
    if (error) {
      showToast?.(`Não foi possível encaminhar para Protocolos: ${error.message}`);
      return false;
    }
    setRegistros((atuais) => atuais.filter((item) => item.id !== processo.id));
    setTotal((atual) => Math.max(0, atual - 1));
    setProcesso(null);
    showToast?.("Ação encaminhada para Protocolos. O histórico extrajudicial foi preservado.");
    return true;
  }

  async function excluirMovimentacao(movimentacao) {
    if (!processo || !movimentacao?.id) return false;
    if (["datajud", "escavador"].includes(movimentacao.origem)) {
      showToast?.("Movimentações automáticas não podem ser excluídas pela ficha.");
      return false;
    }
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
    const faseMovimentacao = ehExtrajudicial(processo)
      ? { fase: "extrajudicial_administrativa", ordem_fase: 1 }
      : emFluxoDeProtocolo(processo)
        ? { fase: "transicao_judicial", ordem_fase: 2 }
        : { fase: "judicial", ordem_fase: 3 };
    const payload = { processo_id: processo.id, data_registro: dataRegistro, ...faseMovimentacao, tipo: movimento.tipo.toLowerCase(), categoria: "Movimentação processual", titulo: `${movimento.tipo} registrada`, descricao: movimento.conteudo.trim(), descricao_tecnica: movimento.observacao.trim() || null, resumo_cliente: movimento.conteudo.trim(), proxima_providencia: movimento.tratamento.trim() || null, responsavel: movimento.responsavel || usuario?.nome || null, fonte: "Registro manual", importancia: acao.prioridade === "Crítica" ? "Crítico" : "Normal", criar_tarefa_relacionada: acao.tipo !== "nenhuma", origem: "manual", created_by_nome: usuario?.nome || usuario?.email || null };
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

  function fecharAcompanhamento() {
    if (salvando || salvandoInformacoes || sincronizandoDataJud) return;
    aberturaAtual.current += 1;
    setAbrindoProcesso(null);
    setProcesso(null);
    setRegistrando(false);
    void carregar();
  }
  if (carteiraExtrajudicial && processo) return <FichaProcessual key={processo.id} usuario={usuario} showToast={showToast} onOpenProcess={abrirProcessoDaFicha} processo={processo} cliente={clienteProcesso} atualizarTarefa={atualizarTarefa} excluirTarefa={excluirTarefa} timeline={timeline} registrando={registrando} setRegistrando={setRegistrando} movimento={movimento} setMovimento={setMovimento} acao={acao} setAcao={setAcao} concluir={concluirMovimentacao} atualizarMovimentacao={atualizarMovimentacao} excluirMovimentacao={excluirMovimentacao} encaminharAoProtocolo={encaminharAoProtocolo} salvando={salvando} sincronizarDataJud={sincronizarDataJud} sincronizandoDataJud={sincronizandoDataJud} salvarInformacoes={salvarInformacoes} salvandoInformacoes={salvandoInformacoes} voltar={fecharAcompanhamento} />;

  return <>
    <section className="portfolio-process-section clientes-list-panel">
      <div className="process-status-section-heading">
        {carteiraExtrajudicial ? <span className="table-chip extrajudicial-scope">Esfera: Extrajudicial</span> : <div><span>Processos com número judicial</span></div>}
        <div className="process-status-heading-actions"><button className="primary" type="button" onClick={abrirCadastro}>{carteiraExtrajudicial ? "Cadastrar ação extrajudicial" : "Cadastrar processo judicial"}</button><button type="button" onClick={() => { invalidarConsultas(); void carregar(); }}>Atualizar</button></div>
      </div>
      {alerta ? <div className="dashboard-filtro-ativo"><span>{alerta.titulo}</span><button type="button" onClick={() => { setPagina(1); onLimparAlerta?.(); }}>Mostrar todos</button></div> : null}
      <div className="process-status-filters"><Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, CPF, ID CRM, CNJ, réu, banco ou ação..." /></div>
      {carteiraExtrajudicial ? <div className="clientes-table-wrap">
        <table className="clientes-table clientes-directory-table" aria-label="Acompanhamentos extrajudiciais" aria-busy={carregando || abrindoProcesso !== null}>
          <thead><tr><th>Nome do Cliente</th><th>Protocolo</th><th>Parte Contrária (Banco)</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>{carregando && !registros.length ? <tr><td colSpan={5}><div className="empty-row">Carregando acompanhamentos...</div></td></tr> : !registros.length ? <tr><td colSpan={5}><div className="empty-row">Nenhuma ação extrajudicial encontrada.</div></td></tr> : registros.map((item) => <tr key={item.id} className="cliente-directory-row" onClick={() => { if (abrindoProcesso === null) void abrirProcesso(item); }}>
            <td><strong>{item.nome_cliente || "Não informado"}</strong></td>
            <td>{numeroProtocoloExtrajudicial(item) || "Não informado"}</td>
            <td>{item.banco_reu || item.reu || "Não informado"}</td>
            <td><span className={`table-chip extrajudicial-status-${corStatusExtrajudicial(item.situacao || "TRAMITANDO")}`}>{item.situacao || "TRAMITANDO"}</span></td>
            <td><div className="table-actions"><button type="button" className="btn-secondary compact" disabled={abrindoProcesso !== null} aria-label={`Abrir acompanhamento de ${item.nome_cliente}`} onClick={(evento) => { evento.stopPropagation(); void abrirProcesso(item); }}>{abrindoProcesso === item.id ? "Abrindo..." : "Abrir acompanhamento"}</button></div></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="clientes-table-wrap">
        <table className="clientes-table clientes-directory-table" aria-label="Processos judiciais" aria-busy={carregando}>
          <thead><tr><th>Nome do Cliente</th><th>Protocolo</th><th>Número do Processo</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>{carregando && !registros.length ? <tr><td colSpan={5}><div className="empty-row">Carregando processos...</div></td></tr> : !registros.length ? <tr><td colSpan={5}><div className="empty-row">Nenhum processo judicial encontrado.</div></td></tr> : registros.map((item) => <tr key={item.id} className="cliente-directory-row">
            <td><strong>{item.nome_cliente || "Não informado"}</strong></td>
            <td>{item.numero_processo || "Não informado"}</td>
            <td>{item.numero_processo || "Não informado"}</td>
            <td><span className={"table-chip extrajudicial-status-" + corStatusExtrajudicial(item.situacao || "Em andamento")}>{item.situacao || "Em andamento"}</span></td>
            <td><div className="table-actions"><button type="button" className="btn-secondary compact" disabled={abrindoProcesso !== null} aria-label={"Abrir acompanhamento de " + item.nome_cliente} onClick={() => void abrirProcesso(item)}>Abrir acompanhamento</button></div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <Pagination pagina={pagina} total={total} tamanho={tamanhoPagina} onChange={setPagina} rotulo="registros" />
    </section>
    {!carteiraExtrajudicial && (abrindoProcesso !== null || processo) ? <AcompanhamentoModal onClose={fecharAcompanhamento}>{processo ? <FichaProcessual key={processo.id} usuario={usuario} showToast={showToast} onOpenProcess={abrirProcessoDaFicha} processo={processo} cliente={clienteProcesso} atualizarTarefa={atualizarTarefa} excluirTarefa={excluirTarefa} timeline={timeline} registrando={registrando} setRegistrando={setRegistrando} movimento={movimento} setMovimento={setMovimento} acao={acao} setAcao={setAcao} concluir={concluirMovimentacao} atualizarMovimentacao={atualizarMovimentacao} excluirMovimentacao={excluirMovimentacao} encaminharAoProtocolo={encaminharAoProtocolo} salvando={salvando} sincronizarDataJud={sincronizarDataJud} sincronizandoDataJud={sincronizandoDataJud} salvarInformacoes={salvarInformacoes} salvandoInformacoes={salvandoInformacoes} voltar={fecharAcompanhamento} /> : <p role="status">Carregando acompanhamento...</p>}</AcompanhamentoModal> : null}
    {cadastroAberto ? <FormularioNovoProcesso form={novoProcesso} setForm={setNovoProcesso} salvando={salvandoCadastro} erro={cadastroErro} naturezaFixa={carteiraExtrajudicial ? "Extrajudicial" : "Judicial"} onSubmit={cadastrarProcesso} onClose={() => { setCadastroAberto(false); setCadastroErro(""); }} /> : null}
  </>;
}

function SeletorEspecialista({ value, onChange, required = false }) {
  const valorLegado = value && !ESPECIALISTAS_DIREITO_BANCARIO.includes(value) ? value : null;

  return <Select value={value} onChange={onChange} required={required}>
    <option value="">Selecione</option>
    {valorLegado ? <option value={valorLegado}>{valorLegado}</option> : null}
    {ESPECIALISTAS_DIREITO_BANCARIO.map((especialista) => <option key={especialista} value={especialista}>{especialista}</option>)}
  </Select>;
}

function FichaProcessual({ usuario, showToast, onOpenProcess, processo, cliente, atualizarTarefa, excluirTarefa, timeline, registrando, setRegistrando, movimento, setMovimento, acao, setAcao, concluir, atualizarMovimentacao, excluirMovimentacao, encaminharAoProtocolo, salvando, sincronizarDataJud, sincronizandoDataJud, salvarInformacoes, salvandoInformacoes, voltar }) {
  const [editandoInformacoes, setEditandoInformacoes] = useState(false);
  const [informacoes, setInformacoes] = useState(null);
  const [registroEditando, setRegistroEditando] = useState(null);
  const [encaminhamento, setEncaminhamento] = useState(null);
  const [maisRecentesPrimeiro, setMaisRecentesPrimeiro] = useState(true);
  const extrajudicial = ehExtrajudicial(processo);
  const protocoloExtrajudicial = numeroProtocoloExtrajudicial(processo);

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
      tarefa: item.tarefa,
      titulo: item.tarefa?.titulo || "",
      descricao: item.tarefa?.descricao || "",
      observacao: item.tarefa?.observacao || "",
      horario: item.tarefa?.horario?.slice(0, 5) || "",
      prioridade: item.tarefa?.prioridade || "Normal",
      status: item.tarefa?.status || "Pendente",
      data: String(item.tarefa?.data || item.data || "").slice(0, 10),
      responsavel: item.responsavel || item.movimentacao?.created_by_nome || "",
    });
  }

  async function concluirEdicaoRegistro(evento) {
    evento.preventDefault();
    const salvo = registroEditando.tarefa
      ? await atualizarTarefa(registroEditando.tarefa, registroEditando)
      : await atualizarMovimentacao(registroEditando.movimentacao, registroEditando);
    if (salvo) setRegistroEditando(null);
  }

  async function excluirRegistro(item) {
    const excluido = item.tarefa ? await excluirTarefa(item.tarefa) : await excluirMovimentacao(item.movimentacao);
    if (excluido && registroEditando?.id === item.id) setRegistroEditando(null);
  }

  function iniciarEncaminhamento() {
    setEncaminhamento({ data_encaminhamento: new Date().toISOString().slice(0, 10), motivo_ajuizamento: "Tentativa extrajudicial frustrada" });
  }

  async function concluirEncaminhamento(evento) {
    evento.preventDefault();
    if (await encaminharAoProtocolo(encaminhamento)) setEncaminhamento(null);
  }

  const conteudo = <section className="processual-ficha">
    {!cliente ? <header className="processual-ficha-header">
      <button className="processual-back" onClick={voltar} disabled={salvandoInformacoes || sincronizandoDataJud} type="button" aria-label={`Voltar para ${extrajudicial ? "Extrajudiciais" : "Processual"}`} title={`Voltar para ${extrajudicial ? "Extrajudiciais" : "Processual"}`}>←</button>
      <div className="processual-identidade">
        <span className="eyebrow">Ficha do cliente · {extrajudicial ? "Ação extrajudicial" : "Processo judicial"}</span>
        <div className="process-name-with-protocol"><h2>{cliente?.nome_completo || processo.nome_cliente}</h2>{protocoloExtrajudicial ? <b className="extrajudicial-protocol">Protocolo {protocoloExtrajudicial}</b> : null}</div>
      </div>
      <details className="processual-actions-menu">
        <summary aria-label="Abrir ações" title="Ações">•••</summary>
        <div>
          <button onClick={iniciarEdicao} disabled={editandoInformacoes || salvandoInformacoes} type="button">Editar informações</button>
          <button onClick={() => setRegistrando(true)} type="button">Registrar movimentação</button>
          {extrajudicial ? <button onClick={iniciarEncaminhamento} disabled={salvando} type="button">Encaminhar para Protocolos</button> : null}
          {!extrajudicial && processo.numero_processo ? <button disabled={sincronizandoDataJud} onClick={sincronizarDataJud} type="button">{sincronizandoDataJud ? "Consultando DataJud..." : "Consultar DataJud"}</button> : null}
        </div>
      </details>
    </header> : null}
    {!cliente ? <dl className="processual-cliente-topo">
      <div><dt>CPF</dt><dd>{cliente?.cpf || processo.cpf_cliente || "Não informado"}</dd></div>
      <div><dt>Telefone</dt><dd>{cliente?.telefone || "Não informado"}</dd></div>
      <div><dt>E-mail</dt><dd>{cliente?.email || "Não informado"}</dd></div>
      <div><dt>Responsável</dt><dd>{processo.responsavel || cliente?.responsavel || "Não informado"}</dd></div>
    </dl> : null}
    <div className="processual-contexto">
      {cliente ? <details className="processual-actions-menu"><summary aria-label="Abrir ações do processo" title="Ações do processo">•••</summary><div><button onClick={iniciarEdicao} disabled={editandoInformacoes || salvandoInformacoes} type="button">Editar informações do processo</button><button onClick={() => setRegistrando(true)} type="button">Registrar movimentação</button>{extrajudicial ? <button onClick={iniciarEncaminhamento} disabled={salvando} type="button">Encaminhar para Protocolos</button> : <button disabled={sincronizandoDataJud} onClick={sincronizarDataJud} type="button">Consultar DataJud</button>}</div></details> : null}
      {!extrajudicial ? <span><b>Número do processo:</b> {processo.numero_processo || "Não informado"}</span> : null}
      <span><b>Parte contrária:</b> {processo.reu || processo.banco_reu || "Não informada"}</span>
    </div>
    {editandoInformacoes ? <FormSection as="form" className="processual-dados-form" onSubmit={concluirEdicao}>
      <h3>Editar informações da ação</h3>
      <FormGrid className="processual-dados-grid">
        <FormField><span>Ação</span><Select value={informacoes.tipo_acao} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, tipo_acao: e.target.value }))}>{informacoes.tipo_acao && !TIPOS_ACAO.includes(informacoes.tipo_acao) ? <option value={informacoes.tipo_acao}>{informacoes.tipo_acao}</option> : null}{TIPOS_ACAO.map((tipo) => <option key={tipo}>{tipo}</option>)}</Select></FormField>
        <FormField><span>Parte contrária</span><Input value={informacoes.reu} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, reu: e.target.value }))} /></FormField>
        <FormField><span>Especialista em direito bancário</span><SeletorEspecialista value={informacoes.responsavel} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, responsavel: e.target.value }))} /></FormField>
        {!extrajudicial ? <><FormField><span>Tribunal</span><Input value={informacoes.tribunal} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, tribunal: e.target.value }))} /></FormField><FormField><span>Vara/Juízo</span><Input value={informacoes.vara} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, vara: e.target.value }))} /></FormField><FormField><span>Comarca</span><Input value={informacoes.comarca} onChange={(e) => setInformacoes((atuais) => ({ ...atuais, comarca: e.target.value }))} /></FormField></> : null}
      </FormGrid>
      <FormActions><button className="btn-secondary" onClick={() => setEditandoInformacoes(false)} disabled={salvandoInformacoes} type="button">Cancelar</button><button className="btn-primary" disabled={salvandoInformacoes} type="submit">{salvandoInformacoes ? "Salvando..." : "Salvar informações"}</button></FormActions>
    </FormSection> : null}
    {encaminhamento ? <FormSection as="form" className="processual-dados-form" onSubmit={concluirEncaminhamento}>
      <div><h3>Encaminhar ação para Protocolos</h3><p className="processual-form-help">O mesmo cadastro seguirá para o controle de documentos, prazo, protocolo e distribuição. Todo o histórico extrajudicial será mantido.</p></div>
      <FormGrid className="processual-dados-grid">
        <FormField><span>Data do encaminhamento</span><Input required type="date" value={encaminhamento.data_encaminhamento} onChange={(e) => setEncaminhamento((atual) => ({ ...atual, data_encaminhamento: e.target.value }))} /></FormField>
        <FormField><span>Motivo do ajuizamento</span><Select value={encaminhamento.motivo_ajuizamento} onChange={(e) => setEncaminhamento((atual) => ({ ...atual, motivo_ajuizamento: e.target.value }))}><option>Tentativa extrajudicial frustrada</option><option>Acordo extrajudicial descumprido</option><option>Orientação para ajuizamento</option><option>Outro</option></Select></FormField>
      </FormGrid>
      <FormActions><button className="btn-secondary" onClick={() => setEncaminhamento(null)} disabled={salvando} type="button">Cancelar</button><button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Encaminhando..." : "Enviar para Protocolos"}</button></FormActions>
    </FormSection> : null}
    {registrando ? <FormularioMovimentacao movimento={movimento} setMovimento={setMovimento} acao={acao} setAcao={setAcao} concluir={concluir} salvando={salvando} cancelar={() => setRegistrando(false)} /> : null}
    <section className="processual-timeline"><div className="processual-progress-title"><div><h3>Progresso da ação</h3><p>Jornada processual organizada por fase.</p></div><div className="processual-timeline-order"><FormField><span>Ordem do histórico</span><Select value={maisRecentesPrimeiro ? "recentes" : "antigos"} onChange={(e) => setMaisRecentesPrimeiro(e.target.value === "recentes")}><option value="recentes">Mais recentes primeiro</option><option value="antigos">Mais antigos primeiro</option></Select></FormField><strong>{timeline.length} {timeline.length === 1 ? "registro" : "registros"}</strong></div></div>{timeline.length ? agruparTimelineProcessual(timeline, maisRecentesPrimeiro).map((fase) => <section className="timeline-phase" key={fase.id}><header className="timeline-phase-header"><div><strong>{fase.titulo}</strong>{fase.subtitulo ? <span>{fase.subtitulo}</span> : null}</div><small>{fase.itens.length} {fase.itens.length === 1 ? "movimentação" : "movimentações"}</small></header><div className="timeline-phase-list">{fase.itens.map((item) => { const automatico = ["escavador", "datajud"].includes(item.origem); return <article className={`timeline-item timeline-done timeline-${automatico ? "automatico" : "manual"}`} key={item.id}>{item.data ? <time dateTime={item.data}>{dataBR(item.data)}</time> : null}<div><header><strong>{item.titulo}</strong><div className="timeline-header-actions">{item.possuiAnexo ? <span className="timeline-attachment" title="Anexo disponível no Drive do cliente" aria-label="Anexo disponível no Drive do cliente">Anexo</span> : null}{automatico ? <span className="timeline-badge">{item.origem === "datajud" ? "DataJud/CNJ" : "Captura automática"}</span> : null}{(item.movimentacao || item.tarefa) && !automatico ? <details className="timeline-actions-menu"><summary aria-label="Ações do registro" title="Ações">•••</summary><div><button disabled={salvando} onClick={() => iniciarEdicaoRegistro(item)} type="button">Modificar</button><button className="danger" disabled={salvando} onClick={() => void excluirRegistro(item)} type="button">Excluir</button></div></details> : null}</div></header>{registroEditando?.id === item.id ? <FormSection as="form" className="timeline-edit-form" onSubmit={concluirEdicaoRegistro}>{registroEditando.tarefa ? <CamposEdicaoAtividade registro={registroEditando} setRegistro={setRegistroEditando} /> : null}<FormField><span>{registroEditando.tarefa ? "Prazo/data" : "Data"}</span><Input required={Boolean(registroEditando.tarefa)} type="date" value={registroEditando.data} onChange={(e) => setRegistroEditando((atual) => ({ ...atual, data: e.target.value }))} /></FormField><FormField><span>Responsável</span><Input value={registroEditando.responsavel} onChange={(e) => setRegistroEditando((atual) => ({ ...atual, responsavel: e.target.value }))} /></FormField><div><button className="btn-secondary" disabled={salvando} onClick={() => setRegistroEditando(null)} type="button">Cancelar</button><button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : "Salvar"}</button></div></FormSection> : <>{descricoesDiferentes(item.titulo, item.descricao) ? <p>{item.descricao}</p> : null}{item.detalhe ? <span>{item.detalhe}</span> : null}<small>{automatico ? "Registro automático, somente leitura" : `Responsável: ${item.responsavel || "Não informado"}`}</small></>}</div></article>; })}</div></section>) : <div className="empty-row">Nenhuma movimentação registrada.</div>}</section>
  </section>;
  return cliente ? <>
    <button className="btn-secondary compact" onClick={voltar} disabled={salvando || salvandoInformacoes || sincronizandoDataJud} type="button">Voltar</button>
    <ClientesModule fichaInline clienteFicha={cliente} processoAtual={processo} usuario={usuario} showToast={showToast} onOpenProcess={onOpenProcess}>{conteudo}</ClientesModule>
  </> : conteudo;
}

function FormularioNovoProcesso({ form, setForm, salvando, erro, naturezaFixa, onSubmit, onClose }) {
  const judicial = form.natureza === "Judicial";
  return <div className="process-registration-backdrop" role="presentation">
    <FormSection as="form" className="process-registration-modal" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="process-registration-title">
      <header><div><span className="eyebrow">Novo cadastro</span><h3 id="process-registration-title">{judicial ? "Cadastrar processo judicial" : "Cadastrar ação extrajudicial"}</h3><p>{judicial ? "Informe os dados do processo que já possui número judicial." : "Cadastre a ação antes do ajuizamento e acompanhe seu histórico."}</p></div><button aria-label="Fechar" disabled={salvando} onClick={onClose} type="button">×</button></header>
      {erro ? <div className="process-registration-error" role="alert">{erro}</div> : null}
      <FormGrid className="process-registration-grid">
        <FormField><span>Modalidade *</span><Input readOnly value={naturezaFixa} /></FormField>
        <FormField className="span-2"><span>Cliente *</span><Input required value={form.nome_cliente} onChange={(e) => setForm((atual) => ({ ...atual, nome_cliente: e.target.value }))} /></FormField>
        <FormField><span>CPF/CNPJ</span><Input value={form.cpf_cliente} onChange={(e) => setForm((atual) => ({ ...atual, cpf_cliente: e.target.value }))} /></FormField>
        <FormField><span>ID CRM{judicial ? "" : " *"}</span><Input required={!judicial} value={form.id_crm} onChange={(e) => setForm((atual) => ({ ...atual, id_crm: e.target.value }))} /></FormField>
        {judicial ? <FormField className="span-2"><span>Número do processo *</span><Input required value={form.numero_processo} onChange={(e) => setForm((atual) => ({ ...atual, numero_processo: e.target.value }))} placeholder="0000000-00.0000.0.00.0000" /></FormField> : <div className="process-registration-help span-2"><strong>Ação extrajudicial</strong><span>Não exige número CNJ. Se for ajuizada, seguirá primeiro para Protocolos e somente entrará no Processual após a liberação do número.</span></div>}
        <FormField className="span-2"><span>Ação *</span><Select required value={form.tipo_acao} onChange={(e) => setForm((atual) => ({ ...atual, tipo_acao: e.target.value }))}><option value="">Selecione</option>{TIPOS_ACAO.map((tipo) => <option key={tipo}>{tipo}</option>)}</Select></FormField>
        <FormField><span>Parte contrária</span><Input value={form.reu} onChange={(e) => setForm((atual) => ({ ...atual, reu: e.target.value }))} /></FormField>
        <FormField><span>Banco/instituição</span><Input value={form.banco_reu} onChange={(e) => setForm((atual) => ({ ...atual, banco_reu: e.target.value }))} /></FormField>
        <FormField><span>{judicial ? "Data de distribuição" : "Data de início"}</span><Input type="date" value={form.data_distribuicao} onChange={(e) => setForm((atual) => ({ ...atual, data_distribuicao: e.target.value }))} /></FormField>
        <FormField className="span-2"><span>Especialista em direito bancário</span><SeletorEspecialista value={form.responsavel} onChange={(e) => setForm((atual) => ({ ...atual, responsavel: e.target.value }))} /></FormField>
        {judicial ? <><FormField><span>Tribunal</span><Input value={form.tribunal} onChange={(e) => setForm((atual) => ({ ...atual, tribunal: e.target.value }))} /></FormField><FormField><span>Comarca</span><Input value={form.comarca} onChange={(e) => setForm((atual) => ({ ...atual, comarca: e.target.value }))} /></FormField><FormField><span>Vara/Juízo</span><Input value={form.vara} onChange={(e) => setForm((atual) => ({ ...atual, vara: e.target.value }))} /></FormField></> : null}
        <FormField className="wide"><span>Observações</span><Textarea rows={4} value={form.observacoes} onChange={(e) => setForm((atual) => ({ ...atual, observacoes: e.target.value }))} /></FormField>
      </FormGrid>
      <FormActions><button className="btn-secondary" disabled={salvando} onClick={onClose} type="button">Cancelar</button><button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : judicial ? "Cadastrar processo" : "Cadastrar ação"}</button></FormActions>
    </FormSection>
  </div>;
}

function FormularioMovimentacao({ movimento, setMovimento, acao, setAcao, concluir, salvando, cancelar }) {
  return <FormSection as="form" className="movimentacao-form" onSubmit={concluir}><h3>Registrar movimentação ou publicação</h3><FormGrid className="movimentacao-grid"><FormField><span>Data</span><Input type="date" value={movimento.data} onChange={(e) => setMovimento((f) => ({ ...f, data: e.target.value }))} /></FormField><FormField><span>Tipo</span><Select value={movimento.tipo} onChange={(e) => setMovimento((f) => ({ ...f, tipo: e.target.value }))}><option>Publicação</option><option>Movimentação</option><option>Decisão</option><option>Intimação</option><option>Histórico manual</option></Select></FormField><FormField><span>Responsável</span><Input value={movimento.responsavel} onChange={(e) => setMovimento((f) => ({ ...f, responsavel: e.target.value }))} /></FormField><FormField className="wide"><span>Conteúdo *</span><Textarea rows={6} required value={movimento.conteudo} onChange={(e) => setMovimento((f) => ({ ...f, conteudo: e.target.value }))} /></FormField><FormField className="wide"><span>Tratamento sugerido</span><Textarea rows={3} value={movimento.tratamento} onChange={(e) => setMovimento((f) => ({ ...f, tratamento: e.target.value }))} /></FormField><FormField className="wide"><span>Observação interna</span><Textarea rows={3} value={movimento.observacao} onChange={(e) => setMovimento((f) => ({ ...f, observacao: e.target.value }))} /></FormField></FormGrid><FormSection className="acao-relacionada"><h4>Criar ação relacionada</h4><div className="acao-tipos">{[["nenhuma","Somente histórico"],["tarefa","Tarefa"],["prazo","Prazo"],["evento","Evento"],["audiencia","Audiência"]].map(([valor, rotulo]) => <button type="button" className={acao.tipo === valor ? "active" : ""} onClick={() => setAcao((f) => ({ ...f, tipo: valor }))} key={valor}>{rotulo}</button>)}</div>{acao.tipo !== "nenhuma" ? <FormGrid className="movimentacao-grid"><FormField className="wide"><span>Título *</span><Input required value={acao.titulo} onChange={(e) => setAcao((f) => ({ ...f, titulo: e.target.value }))} /></FormField><FormField><span>Prazo/data *</span><Input required type="date" value={acao.data} onChange={(e) => setAcao((f) => ({ ...f, data: e.target.value }))} /></FormField><FormField><span>Hora</span><Input type="time" value={acao.hora} onChange={(e) => setAcao((f) => ({ ...f, hora: e.target.value }))} /></FormField><FormField><span>Prioridade</span><Select value={acao.prioridade} onChange={(e) => setAcao((f) => ({ ...f, prioridade: e.target.value }))}><option>Baixa</option><option>Normal</option><option>Alta</option><option>Crítica</option></Select></FormField></FormGrid> : null}</FormSection><FormActions><button className="btn-secondary" onClick={cancelar} type="button">Cancelar</button><button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : "Concluir"}</button></FormActions></FormSection>;
}

function CamposEdicaoAtividade({ registro, setRegistro }) {
  const alterar = (campo) => (evento) => setRegistro((atual) => ({ ...atual, [campo]: evento.target.value }));
  return <>
    <FormField className="timeline-edit-wide"><span>Título</span><Input required value={registro.titulo} onChange={alterar("titulo")} /></FormField>
    <FormField className="timeline-edit-wide"><span>Descrição</span><Textarea rows={3} value={registro.descricao} onChange={alterar("descricao")} /></FormField>
    <FormField className="timeline-edit-wide"><span>Observação</span><Textarea rows={2} value={registro.observacao} onChange={alterar("observacao")} /></FormField>
    <FormField><span>Horário</span><Input type="time" value={registro.horario} onChange={alterar("horario")} /></FormField>
    <FormField><span>Prioridade</span><Select value={registro.prioridade} onChange={alterar("prioridade")}>{["Baixa", "Normal", "Alta", "Crítica"].map((valor) => <option key={valor}>{valor}</option>)}</Select></FormField>
    <FormField><span>Status</span><Select value={registro.status} onChange={alterar("status")}>{["Pendente", "Em andamento", "Concluída", "Cancelada", "Atrasada"].map((valor) => <option key={valor}>{valor}</option>)}</Select></FormField>
  </>;
}

function AcompanhamentoModal({ children, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const elemento = dialog.current;
    const focoAnterior = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    elemento.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      elemento.close();
      document.body.style.overflow = overflowAnterior;
      focoAnterior?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="processual-acompanhamento-modal" aria-labelledby="acompanhamento-title" onCancel={(evento) => { evento.preventDefault(); onClose(); }}>
    <header className="processual-modal-heading"><h2 id="acompanhamento-title">Acompanhamento processual</h2><button type="button" className="btn-secondary compact" aria-label="Fechar acompanhamento" onClick={onClose}>Fechar</button></header>
    {children}
  </dialog>;
}
