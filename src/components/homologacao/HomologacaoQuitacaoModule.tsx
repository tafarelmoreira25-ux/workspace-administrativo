import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./homologacaoQuitacao.css";

type Usuario = { nome?: string; email?: string; id?: string };
type ClienteOpcao = { id: string; nome_completo: string; cpf: string | null; telefone: string | null; link_pasta_cliente: string | null; responsavel: string | null };
type ProcessoOpcao = { id: string; cliente_id: string | null; numero_processo: string | null; banco_reu: string | null; reu: string | null; nome_cliente: string | null; cpf_cliente: string | null; responsavel: string | null };
type RegistroBase = { id: string; created_at?: string | null; updated_at?: string | null; created_by_nome?: string | null; updated_by_nome?: string | null };
type Homologacao = RegistroBase & {
  cliente_id: string | null; processo_id: string | null; cliente_nome: string; cpf_cnpj: string | null; telefone: string | null;
  numero_contrato: string | null; instituicao_financeira: string | null; assessoria_banco: string | null; representante_nome: string | null; representante_contato: string | null;
  veiculo: string | null; placa: string | null; valor_parcela: number | null; quantidade_parcelas: number | null; parcelas_atraso: number | null;
  saldo_devedor_atualizado: number | null; valor_previsto_minuta: number | null; link_pasta_cliente: string | null; negociador_responsavel: string | null;
  valor_quitacao_hoje: number | null; link_minuta_homologacao: string | null; import_codigo?: string | null; fontes_importacao?: string | null; duplicidade_origem?: boolean | null; campos_divergentes?: string | null;
  data_inicio: string | null; status: string; ultima_movimentacao: string | null; proxima_providencia: string | null; data_prevista_retorno: string | null;
  prioridade: string | null; responsavel_atual: string | null; motivo_pendencia: string | null; resultado_final: string | null;
};
type Movimentacao = RegistroBase & { homologacao_id: string; data_hora: string; tipo: string; canal: string | null; pessoa_contatada: string | null; instituicao: string | null; contato_utilizado: string | null; protocolo: string | null; descricao: string; resultado_contato: string | null; pendencia_identificada: string | null; proxima_providencia: string | null; responsavel_proxima: string | null; prazo_retorno: string | null; arquivos_evidencias: string | null };
type Proposta = RegistroBase & { homologacao_id: string; data_proposta: string | null; saldo_banco: number | null; valor_cliente: number | null; valor_banco: number | null; valor_contraproposta: number | null; valor_final: number | null; percentual_desconto: number | null; quantidade_parcelas: number | null; valor_entrada: number | null; valor_parcelas: number | null; vencimento: string | null; validade: string | null; parcelas_atraso: number | null; encargos: string | null; condicoes_quitacao: string | null; representante: string | null; decisao: string; justificativa: string | null; comprovante_url: string | null };
type Reuniao = RegistroBase & { homologacao_id: string; data_hora: string | null; participantes: string | null; representante_instituicao: string | null; local_plataforma: string | null; link_reuniao: string | null; pauta: string | null; assuntos_discutidos: string | null; deliberacoes: string | null; compromissos: string | null; prazos_definidos: string | null; ata_gravacao_url: string | null; proxima_reuniao: string | null };
type Diligencia = RegistroBase & { homologacao_id: string; tipo_diligencia: string | null; solicitante: string | null; destinatario: string | null; data_solicitacao: string | null; prazo: string | null; finalidade: string | null; resultado: string | null; custos: number | null; comprovante_url: string | null; situacao: string | null };
type Documento = RegistroBase & { homologacao_id: string; categoria: string; nome: string; url: string | null; obrigatorio_quitacao: boolean | null; ausencia_justificada: boolean | null; justificativa_ausencia: string | null };
type Quitacao = RegistroBase & { homologacao_id: string; valor_pago: number | null; data_pagamento: string | null; forma_pagamento: string | null; instituicao_recebedora: string | null; identificacao_boleto: string | null; comprovante_pagamento_url: string | null; confirmacao_instituicao_url: string | null; termo_quitacao_url: string | null; data_baixa_gravame: string | null; situacao_gravame: string | null; documento_final_url: string | null; observacoes_encerramento: string | null; justificativa_documentos_ausentes: string | null; autorizado_por: string | null };
type AtualizacaoContrato = RegistroBase & { homologacao_id: string; data_atualizacao: string; saldo_devedor_atual: number | null; parcelas_em_atraso: number | null; valor_quitacao_hoje: number | null; percentual_desconto: number | null; validade_proposta: string | null; protocolo: string | null; observacoes: string | null; comprovante_url: string | null };

const STATUS = ["Aguardando primeiro contato", "Contato iniciado", "Aguardando retorno da instituição", "Em negociação", "Proposta recebida", "Proposta enviada ao cliente", "Aguardando decisão do cliente", "Proposta aceita", "Aguardando minuta", "Minuta recebida", "Aguardando assinatura", "Aguardando boleto", "Aguardando pagamento", "Pagamento realizado", "Aguardando confirmação de quitação", "Contrato quitado", "Negociação sem acordo", "Encaminhado ao Processual", "Suspenso", "Cancelado"];
const TIPOS_MOVIMENTACAO = ["Contato com o cliente", "Contato com a instituição financeira", "Ligação", "WhatsApp", "E-mail", "Diligência", "Reunião", "Audiência extrajudicial", "Proposta recebida", "Contraproposta apresentada", "Minuta recebida", "Documento enviado", "Assinatura realizada", "Boleto recebido", "Pagamento informado", "Confirmação de quitação", "Observação interna"];
const CANAIS = ["WhatsApp", "Telefone", "E-mail", "Presencial", "Videoconferência", "Sistema da instituição", "Outro"];
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Crítica"];
const DECISOES_PROPOSTA = ["Em análise", "Aceita", "Recusada", "Vencida"];
const ABAS = ["Visão geral", "Histórico", "Dados do contrato", "Negociações", "Reuniões", "Diligências", "Documentos", "Quitação", "Relatório"];

const homologacaoInicial = (usuario?: Usuario) => ({
  cliente_id: "", processo_id: "", cliente_nome: "", cpf_cnpj: "", telefone: "", numero_contrato: "", instituicao_financeira: "",
  assessoria_banco: "", representante_nome: "", representante_contato: "", veiculo: "", placa: "", valor_parcela: "", quantidade_parcelas: "",
  parcelas_atraso: "", saldo_devedor_atualizado: "", valor_previsto_minuta: "", valor_quitacao_hoje: "", link_pasta_cliente: "", link_minuta_homologacao: "", negociador_responsavel: usuario?.nome || "",
  data_inicio: hoje(), status: STATUS[0], proxima_providencia: "", data_prevista_retorno: "", prioridade: "Normal", responsavel_atual: usuario?.nome || "", motivo_pendencia: "",
});
const movimentacaoInicial = (usuario?: Usuario) => ({ data_hora: new Date().toISOString().slice(0, 16), tipo: TIPOS_MOVIMENTACAO[0], canal: "WhatsApp", pessoa_contatada: "", instituicao: "", contato_utilizado: "", protocolo: "", descricao: "", resultado_contato: "", pendencia_identificada: "", proxima_providencia: "", responsavel_proxima: usuario?.nome || "", prazo_retorno: "", arquivos_evidencias: "" });
const propostaInicial = { data_proposta: hoje(), saldo_banco: "", valor_cliente: "", valor_banco: "", valor_contraproposta: "", valor_final: "", percentual_desconto: "", quantidade_parcelas: "", valor_entrada: "", valor_parcelas: "", vencimento: "", validade: "", parcelas_atraso: "", encargos: "", condicoes_quitacao: "", representante: "", decisao: "Em análise", justificativa: "", comprovante_url: "" };
const reuniaoInicial = { data_hora: new Date().toISOString().slice(0, 16), participantes: "", representante_instituicao: "", local_plataforma: "", link_reuniao: "", pauta: "", assuntos_discutidos: "", deliberacoes: "", compromissos: "", prazos_definidos: "", ata_gravacao_url: "", proxima_reuniao: "" };
const diligenciaInicial = { tipo_diligencia: "", solicitante: "", destinatario: "", data_solicitacao: hoje(), prazo: "", finalidade: "", resultado: "", custos: "", comprovante_url: "", situacao: "Solicitada" };
const documentoInicial = { categoria: "Proposta", nome: "", url: "", obrigatorio_quitacao: false, ausencia_justificada: false, justificativa_ausencia: "" };
const quitacaoInicial = { valor_pago: "", data_pagamento: "", forma_pagamento: "", instituicao_recebedora: "", identificacao_boleto: "", comprovante_pagamento_url: "", confirmacao_instituicao_url: "", termo_quitacao_url: "", data_baixa_gravame: "", situacao_gravame: "", documento_final_url: "", observacoes_encerramento: "", justificativa_documentos_ausentes: "", autorizado_por: "" };
const atualizacaoContratoInicial = { data_atualizacao: new Date().toISOString().slice(0, 16), saldo_devedor_atual: "", parcelas_em_atraso: "", valor_quitacao_hoje: "", percentual_desconto: "", validade_proposta: "", protocolo: "", observacoes: "", comprovante_url: "" };

function hoje() { return new Date().toISOString().slice(0, 10); }
function limpar(valor: unknown) { const texto = String(valor ?? "").trim(); return texto || null; }
function numero(valor: unknown) { const texto = String(valor ?? "").replace(/\./g, "").replace(",", ".").trim(); return texto ? Number(texto) : null; }
function normalizar(valor = "") { return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function dinheiro(valor?: number | null) { return typeof valor === "number" ? valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"; }
function dataBr(data?: string | null) { return data ? new Intl.DateTimeFormat("pt-BR").format(new Date(data.length === 10 ? `${data}T00:00:00` : data)) : "—"; }
function dataHoraBr(data?: string | null) { return data ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data)) : "—"; }
function diasDesde(data?: string | null) { if (!data) return 0; return Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 86400000)); }
function usuarioNome(usuario: Usuario) { return usuario.nome || usuario.email || "Usuário não identificado"; }

export default function HomologacaoQuitacaoModule({ usuario, showToast }: { usuario: Usuario; showToast?: (mensagem: string) => void }) {
  const [homologacoes, setHomologacoes] = useState<Homologacao[]>([]);
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [processos, setProcessos] = useState<ProcessoOpcao[]>([]);
  const [selecionada, setSelecionada] = useState<Homologacao | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [diligencias, setDiligencias] = useState<Diligencia[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [quitacao, setQuitacao] = useState<Quitacao | null>(null);
  const [atualizacoesContrato, setAtualizacoesContrato] = useState<AtualizacaoContrato[]>([]);
  const [aba, setAba] = useState("Visão geral");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [modal, setModal] = useState<"" | "movimentacao" | "proposta" | "reuniao" | "diligencia" | "documento" | "quitacao" | "atualizacao_contrato">("");
  const [form, setForm] = useState(() => homologacaoInicial(usuario));
  const [movForm, setMovForm] = useState(() => movimentacaoInicial(usuario));
  const [propostaForm, setPropostaForm] = useState(propostaInicial);
  const [reuniaoForm, setReuniaoForm] = useState(reuniaoInicial);
  const [diligenciaForm, setDiligenciaForm] = useState(diligenciaInicial);
  const [documentoForm, setDocumentoForm] = useState(documentoInicial);
  const [quitacaoForm, setQuitacaoForm] = useState(quitacaoInicial);
  const [atualizacaoContratoForm, setAtualizacaoContratoForm] = useState(atualizacaoContratoInicial);

  const avisar = useCallback((mensagem: string) => showToast ? showToast(mensagem) : window.alert(mensagem), [showToast]);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    const [homReq, clientesReq, processosReq] = await Promise.allSettled([
      supabase.from("homologacoes").select("*").order("updated_at", { ascending: false }).limit(500),
      supabase.from("clientes").select("id, nome_completo, cpf, telefone, link_pasta_cliente, responsavel").order("nome_completo").limit(500),
      supabase.from("processos").select("id, cliente_id, numero_processo, banco_reu, reu, nome_cliente, cpf_cliente, responsavel").order("updated_at", { ascending: false }).limit(500),
    ]);
    if (homReq.status === "fulfilled" && !homReq.value.error) setHomologacoes((homReq.value.data || []) as Homologacao[]);
    else setErro("Execute a migration supabase/20260921_homologacao_quitacao.sql para ativar Homologação e Quitação.");
    if (clientesReq.status === "fulfilled" && !clientesReq.value.error) setClientes((clientesReq.value.data || []) as ClienteOpcao[]);
    if (processosReq.status === "fulfilled" && !processosReq.value.error) setProcessos((processosReq.value.data || []) as ProcessoOpcao[]);
    setCarregando(false);
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    return homologacoes.filter((item) => !termo || normalizar(`${item.cliente_nome} ${item.cpf_cnpj || ""} ${item.numero_contrato || ""} ${item.instituicao_financeira || ""} ${item.status}`).includes(termo));
  }, [busca, homologacoes]);

  const topo = useMemo(() => {
    if (!selecionada) return null;
    const melhor = propostas.filter((p) => typeof p.valor_final === "number").sort((a, b) => Number(a.valor_final) - Number(b.valor_final))[0];
    return {
      ultima: movimentacoes[0]?.data_hora || selecionada.ultima_movimentacao || selecionada.updated_at,
      melhor: melhor?.valor_final ?? null,
      diasNegociacao: selecionada.data_inicio ? diasDesde(selecionada.data_inicio) : 0,
      diasSemAtualizacao: diasDesde(movimentacoes[0]?.data_hora || selecionada.updated_at),
    };
  }, [movimentacoes, propostas, selecionada]);

  function preencherPorCliente(clienteId: string) {
    const cliente = clientes.find((item) => String(item.id) === clienteId);
    setForm((atual) => ({ ...atual, cliente_id: clienteId, cliente_nome: cliente?.nome_completo || atual.cliente_nome, cpf_cnpj: cliente?.cpf || atual.cpf_cnpj, telefone: cliente?.telefone || atual.telefone, link_pasta_cliente: cliente?.link_pasta_cliente || atual.link_pasta_cliente, responsavel_atual: cliente?.responsavel || atual.responsavel_atual }));
  }

  function preencherPorProcesso(processoId: string) {
    const processo = processos.find((item) => String(item.id) === processoId);
    setForm((atual) => ({ ...atual, processo_id: processoId, numero_contrato: atual.numero_contrato || processo?.numero_processo || "", instituicao_financeira: atual.instituicao_financeira || processo?.banco_reu || processo?.reu || "", cliente_id: atual.cliente_id || processo?.cliente_id || "", cliente_nome: atual.cliente_nome || processo?.nome_cliente || "", cpf_cnpj: atual.cpf_cnpj || processo?.cpf_cliente || "", negociador_responsavel: atual.negociador_responsavel || processo?.responsavel || "" }));
  }

  async function abrirFicha(item: Homologacao) {
    setSelecionada(item); setAba("Visão geral");
    const id = item.id;
    const [movReq, propReq, reunReq, dilReq, docReq, quitReq, atualizacoesReq] = await Promise.allSettled([
      supabase.from("homologacao_movimentacoes").select("*").eq("homologacao_id", id).order("data_hora", { ascending: false }),
      supabase.from("homologacao_propostas").select("*").eq("homologacao_id", id).order("data_proposta", { ascending: false }),
      supabase.from("homologacao_reunioes").select("*").eq("homologacao_id", id).order("data_hora", { ascending: false }),
      supabase.from("homologacao_diligencias").select("*").eq("homologacao_id", id).order("data_solicitacao", { ascending: false }),
      supabase.from("homologacao_documentos").select("*").eq("homologacao_id", id).order("created_at", { ascending: false }),
      supabase.from("homologacao_quitacoes").select("*").eq("homologacao_id", id).maybeSingle(),
      supabase.from("homologacao_atualizacoes_contrato").select("*").eq("homologacao_id", id).order("data_atualizacao", { ascending: false }),
    ]);
    if (movReq.status === "fulfilled" && !movReq.value.error) setMovimentacoes((movReq.value.data || []) as Movimentacao[]);
    if (propReq.status === "fulfilled" && !propReq.value.error) setPropostas((propReq.value.data || []) as Proposta[]);
    if (reunReq.status === "fulfilled" && !reunReq.value.error) setReunioes((reunReq.value.data || []) as Reuniao[]);
    if (dilReq.status === "fulfilled" && !dilReq.value.error) setDiligencias((dilReq.value.data || []) as Diligencia[]);
    if (docReq.status === "fulfilled" && !docReq.value.error) setDocumentos((docReq.value.data || []) as Documento[]);
    if (quitReq.status === "fulfilled" && !quitReq.value.error) {
      setQuitacao((quitReq.value.data || null) as Quitacao | null);
      if (quitReq.value.data) setQuitacaoForm({ ...quitacaoInicial, ...Object.fromEntries(Object.entries(quitReq.value.data).map(([k, v]) => [k, v ?? ""])) });
    }
    if (atualizacoesReq.status === "fulfilled" && !atualizacoesReq.value.error) setAtualizacoesContrato((atualizacoesReq.value.data || []) as AtualizacaoContrato[]);
  }

  async function salvarHomologacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const payload = {
      cliente_id: limpar(form.cliente_id), processo_id: limpar(form.processo_id), cliente_nome: form.cliente_nome.trim(), cpf_cnpj: limpar(form.cpf_cnpj), telefone: limpar(form.telefone),
      numero_contrato: limpar(form.numero_contrato), instituicao_financeira: limpar(form.instituicao_financeira), assessoria_banco: limpar(form.assessoria_banco), representante_nome: limpar(form.representante_nome),
      representante_contato: limpar(form.representante_contato), veiculo: limpar(form.veiculo), placa: limpar(form.placa), valor_parcela: numero(form.valor_parcela), quantidade_parcelas: numero(form.quantidade_parcelas),
      parcelas_atraso: numero(form.parcelas_atraso), saldo_devedor_atualizado: numero(form.saldo_devedor_atualizado), valor_previsto_minuta: numero(form.valor_previsto_minuta), valor_quitacao_hoje: numero(form.valor_quitacao_hoje), link_pasta_cliente: limpar(form.link_pasta_cliente), link_minuta_homologacao: limpar(form.link_minuta_homologacao),
      negociador_responsavel: limpar(form.negociador_responsavel), data_inicio: form.data_inicio || hoje(), status: form.status, proxima_providencia: limpar(form.proxima_providencia),
      data_prevista_retorno: limpar(form.data_prevista_retorno), prioridade: form.prioridade, responsavel_atual: limpar(form.responsavel_atual), motivo_pendencia: limpar(form.motivo_pendencia),
      origem_alteracao: "interface_homologacao", updated_by_nome: usuarioNome(usuario),
    };
    const { data, error } = await supabase.from("homologacoes").insert({ ...payload, created_by_nome: usuarioNome(usuario) }).select("*").single();
    if (error) { avisar(`Não foi possível salvar: ${error.message}`); return; }
    setHomologacoes((atuais) => [data as Homologacao, ...atuais]);
    setFormAberto(false); setForm(homologacaoInicial(usuario)); avisar("Homologação aberta.");
  }

  async function atualizarStatus(status: string) {
    if (!selecionada) return;
    if (status === "Contrato quitado" && !podeQuitar()) {
      avisar("Anexe os documentos obrigatórios da quitação ou registre uma justificativa autorizada.");
      return;
    }
    const { data, error } = await supabase.from("homologacoes").update({ status, updated_by_nome: usuarioNome(usuario), origem_alteracao: "alteracao_status" }).eq("id", selecionada.id).select("*").single();
    if (error) { avisar("Não foi possível alterar o status."); return; }
    await supabase.from("homologacao_status_historico").insert({ homologacao_id: selecionada.id, status_anterior: selecionada.status, status_novo: status, origem_alteracao: "interface_homologacao", created_by_nome: usuarioNome(usuario) });
    setSelecionada(data as Homologacao); setHomologacoes((atuais) => atuais.map((item) => item.id === data.id ? data as Homologacao : item)); avisar("Status atualizado.");
  }

  function podeQuitar() {
    const docsOk = documentos.some((d) => d.categoria === "Comprovante de pagamento" && (d.url || d.ausencia_justificada)) && documentos.some((d) => d.categoria === "Termo ou carta de quitação" && (d.url || d.ausencia_justificada));
    const quitOk = Boolean(quitacaoForm.comprovante_pagamento_url || quitacao?.comprovante_pagamento_url) && Boolean(quitacaoForm.termo_quitacao_url || quitacao?.termo_quitacao_url);
    const justificativa = Boolean((quitacaoForm.justificativa_documentos_ausentes || quitacao?.justificativa_documentos_ausentes) && (quitacaoForm.autorizado_por || quitacao?.autorizado_por));
    return docsOk || quitOk || justificativa;
  }

  async function inserir(tabela: string, payload: Record<string, unknown>, fechar: () => void, mensagem: string) {
    if (!selecionada) return;
    const { data, error } = await supabase.from(tabela).insert({ homologacao_id: selecionada.id, ...payload, origem_alteracao: "interface_homologacao", created_by_nome: usuarioNome(usuario), updated_by_nome: usuarioNome(usuario) }).select("*").single();
    if (error) { avisar(`Não foi possível salvar: ${error.message}`); return; }
    if (tabela === "homologacao_movimentacoes") setMovimentacoes((atuais) => [data as Movimentacao, ...atuais]);
    if (tabela === "homologacao_propostas") setPropostas((atuais) => [data as Proposta, ...atuais]);
    if (tabela === "homologacao_reunioes") setReunioes((atuais) => [data as Reuniao, ...atuais]);
    if (tabela === "homologacao_diligencias") setDiligencias((atuais) => [data as Diligencia, ...atuais]);
    if (tabela === "homologacao_documentos") setDocumentos((atuais) => [data as Documento, ...atuais]);
    if (tabela === "homologacao_atualizacoes_contrato") setAtualizacoesContrato((atuais) => [data as AtualizacaoContrato, ...atuais]);
    fechar(); avisar(mensagem);
  }

  async function salvarMovimentacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    await inserir("homologacao_movimentacoes", { ...movForm, data_hora: new Date(movForm.data_hora).toISOString() }, () => { setModal(""); setMovForm(movimentacaoInicial(usuario)); }, "Movimentação registrada e relatório atualizado.");
    if (selecionada) await supabase.from("homologacoes").update({ ultima_movimentacao: new Date(movForm.data_hora).toISOString(), proxima_providencia: limpar(movForm.proxima_providencia), data_prevista_retorno: limpar(movForm.prazo_retorno), updated_by_nome: usuarioNome(usuario) }).eq("id", selecionada.id);
  }

  async function salvarProposta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    await inserir("homologacao_propostas", Object.fromEntries(Object.entries(propostaForm).map(([k, v]) => [k, ["saldo_banco", "valor_cliente", "valor_banco", "valor_contraproposta", "valor_final", "percentual_desconto", "quantidade_parcelas", "valor_entrada", "valor_parcelas", "parcelas_atraso"].includes(k) ? numero(v) : limpar(v) || v])), () => { setModal(""); setPropostaForm(propostaInicial); }, "Proposta salva separadamente.");
  }

  async function salvarAtualizacaoContrato(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!selecionada) return;
    const payload = {
      ...atualizacaoContratoForm,
      data_atualizacao: new Date(atualizacaoContratoForm.data_atualizacao).toISOString(),
      saldo_devedor_atual: numero(atualizacaoContratoForm.saldo_devedor_atual),
      parcelas_em_atraso: numero(atualizacaoContratoForm.parcelas_em_atraso),
      valor_quitacao_hoje: numero(atualizacaoContratoForm.valor_quitacao_hoje),
      percentual_desconto: numero(atualizacaoContratoForm.percentual_desconto),
      validade_proposta: limpar(atualizacaoContratoForm.validade_proposta),
      protocolo: limpar(atualizacaoContratoForm.protocolo),
      observacoes: limpar(atualizacaoContratoForm.observacoes),
      comprovante_url: limpar(atualizacaoContratoForm.comprovante_url),
    };
    await inserir("homologacao_atualizacoes_contrato", payload, () => { setModal(""); setAtualizacaoContratoForm(atualizacaoContratoInicial); }, "Dados do contrato atualizados.");
    const atualizacaoPrincipal = { saldo_devedor_atualizado: payload.saldo_devedor_atual, parcelas_atraso: payload.parcelas_em_atraso, valor_quitacao_hoje: payload.valor_quitacao_hoje, updated_by_nome: usuarioNome(usuario), origem_alteracao: "atualizacao_contrato" };
    const { data } = await supabase.from("homologacoes").update(atualizacaoPrincipal).eq("id", selecionada.id).select("*").single();
    if (data) { setSelecionada(data as Homologacao); setHomologacoes((atuais) => atuais.map((item) => item.id === data.id ? data as Homologacao : item)); }
  }

  async function salvarQuitacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!selecionada) return;
    const payload = Object.fromEntries(Object.entries(quitacaoForm).map(([k, v]) => [k, ["valor_pago"].includes(k) ? numero(v) : limpar(v)]));
    const operacao = quitacao?.id ? supabase.from("homologacao_quitacoes").update({ ...payload, updated_by_nome: usuarioNome(usuario) }).eq("id", quitacao.id) : supabase.from("homologacao_quitacoes").insert({ homologacao_id: selecionada.id, ...payload, created_by_nome: usuarioNome(usuario), updated_by_nome: usuarioNome(usuario) });
    const { data, error } = await operacao.select("*").single();
    if (error) { avisar(`Não foi possível salvar a quitação: ${error.message}`); return; }
    setQuitacao(data as Quitacao); setModal(""); avisar("Dados de quitação salvos.");
  }

  const relatorio = selecionada ? montarRelatorio(selecionada, movimentacoes, propostas, reunioes, diligencias, documentos, quitacao) : "";

  return <section className="homologacao-module">
    <header className="module-page-header">
      <div><span className="eyebrow">Operação financeira</span><h2>Homologação e Quitação</h2><p>Ficha contínua vinculada ao cliente e ao contrato do veículo, com histórico preservado até a quitação definitiva.</p></div>
      <button className="btn-primary" type="button" onClick={() => setFormAberto(true)}>Nova homologação</button>
    </header>

    <div className="homologacao-toolbar"><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, CPF/CNPJ, contrato, banco ou status..." /><button className="btn-secondary" type="button" onClick={carregar}>Atualizar</button></div>
    {erro ? <div className="empty-row">{erro}</div> : null}
    {carregando ? <div className="panel">Carregando homologações...</div> : null}

    <div className="homologacao-layout">
      <section className="homologacao-list">
        {filtradas.length === 0 && !carregando ? <div className="empty-row">Nenhuma homologação cadastrada.</div> : filtradas.map((item) => {
          const dias = diasDesde(item.ultima_movimentacao || item.updated_at);
          return <button key={item.id} type="button" className={selecionada?.id === item.id ? "homologacao-row active" : "homologacao-row"} onClick={() => abrirFicha(item)}>
            <strong>{item.cliente_nome}</strong><span>{item.instituicao_financeira || "Instituição não informada"} · Contrato {item.numero_contrato || "pendente"}</span>
            <small>{item.status} · {item.responsavel_atual || item.negociador_responsavel || "Sem responsável"}</small>
            {dias >= 15 ? <em>Alerta: {dias} dias sem atualização</em> : null}
          </button>;
        })}
      </section>

      {selecionada ? <section className="homologacao-ficha">
        <div className="homologacao-top">
          <label><span>Status atual</span><select value={selecionada.status} onChange={(e) => atualizarStatus(e.target.value)}>{STATUS.map((status) => <option key={status}>{status}</option>)}</select></label>
          <Info label="Responsável" value={selecionada.responsavel_atual || selecionada.negociador_responsavel || "—"} />
          <Info label="Última atualização" value={dataHoraBr(topo?.ultima)} destaque={Number(topo?.diasSemAtualizacao) >= 15} />
          <Info label="Próximo retorno" value={dataBr(selecionada.data_prevista_retorno)} />
          <Info label="Saldo atualizado" value={dinheiro(selecionada.saldo_devedor_atualizado)} />
          <Info label="Quitação hoje" value={dinheiro(selecionada.valor_quitacao_hoje)} />
          <Info label="Melhor proposta" value={dinheiro(topo?.melhor)} />
          <Info label="Dias em negociação" value={String(topo?.diasNegociacao ?? 0)} />
        </div>
        <nav className="homologacao-tabs">{ABAS.map((item) => <button key={item} type="button" className={aba === item ? "active" : ""} onClick={() => setAba(item)}>{item}</button>)}</nav>
        {aba === "Visão geral" ? <VisaoGeral h={selecionada} dias={topo?.diasSemAtualizacao || 0} /> : null}
        {aba === "Histórico" ? <Timeline movimentacoes={movimentacoes} onNova={() => setModal("movimentacao")} /> : null}
        {aba === "Dados do contrato" ? <AtualizacoesContrato atualizacoes={atualizacoesContrato} onNova={() => setModal("atualizacao_contrato")} /> : null}
        {aba === "Negociações" ? <ListaPropostas propostas={propostas} onNova={() => setModal("proposta")} /> : null}
        {aba === "Reuniões" ? <ListaSimples titulo="Reuniões" itens={reunioes} onNova={() => setModal("reuniao")} render={(r: Reuniao) => `${dataHoraBr(r.data_hora)} · ${r.pauta || "Sem pauta"} · ${r.deliberacoes || "Sem deliberação"}`} /> : null}
        {aba === "Diligências" ? <ListaSimples titulo="Diligências" itens={diligencias} onNova={() => setModal("diligencia")} render={(d: Diligencia) => `${d.tipo_diligencia || "Diligência"} · ${d.situacao || "Sem situação"} · prazo ${dataBr(d.prazo)}`} /> : null}
        {aba === "Documentos" ? <Documentos documentos={documentos} onNovo={() => setModal("documento")} /> : null}
        {aba === "Quitação" ? <QuitacaoView quitacao={quitacao} podeQuitar={podeQuitar()} onEditar={() => setModal("quitacao")} /> : null}
        {aba === "Relatório" ? <Relatorio texto={relatorio} /> : null}
      </section> : <section className="homologacao-ficha empty-state">Selecione uma homologação para abrir a ficha.</section>}
    </div>

    {formAberto ? <Modal titulo="Abrir homologação" onClose={() => setFormAberto(false)}><form className="homologacao-form" onSubmit={salvarHomologacao}>
      <div className="form-grid">
        <label className="wide"><span>Cliente</span><select value={form.cliente_id} onChange={(e) => preencherPorCliente(e.target.value)}><option value="">Selecione ou preencha manualmente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome_completo} · {c.cpf || "sem CPF"}</option>)}</select></label>
        <label className="wide"><span>Contrato/processo do veículo</span><select value={form.processo_id} onChange={(e) => preencherPorProcesso(e.target.value)}><option value="">Sem vínculo processual</option>{processos.map((p) => <option key={p.id} value={p.id}>{p.nome_cliente || "Cliente"} · {p.numero_processo || p.banco_reu || "contrato sem número"}</option>)}</select></label>
        {campo("Cliente", "cliente_nome", true)}{campo("CPF/CNPJ", "cpf_cnpj")}{campo("Telefone", "telefone")}{campo("Número do contrato", "numero_contrato")}{campo("Instituição financeira", "instituicao_financeira")}{campo("Assessoria/escritório do banco", "assessoria_banco")}{campo("Representante", "representante_nome")}{campo("Contato do representante", "representante_contato")}{campo("Veículo", "veiculo")}{campo("Placa", "placa")}{campo("Valor da parcela", "valor_parcela")}{campo("Quantidade de parcelas", "quantidade_parcelas")}{campo("Parcelas em atraso", "parcelas_atraso")}{campo("Saldo devedor atualizado", "saldo_devedor_atualizado")}{campo("Valor para quitação hoje", "valor_quitacao_hoje")}{campo("Valor previsto na minuta", "valor_previsto_minuta")}<label className="wide"><span>Link da pasta do cliente no Google Drive</span><input value={form.link_pasta_cliente} onChange={(e) => setForm((f) => ({ ...f, link_pasta_cliente: e.target.value }))} /></label><label className="wide"><span>Link da minuta de homologação no Drive</span><input type="url" value={form.link_minuta_homologacao} onChange={(e) => setForm((f) => ({ ...f, link_minuta_homologacao: e.target.value }))} /></label>{campo("Negociador responsável", "negociador_responsavel")}<label><span>Data de início</span><input type="date" value={form.data_inicio} onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} /></label><label><span>Status</span><select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>{STATUS.map((s) => <option key={s}>{s}</option>)}</select></label><label><span>Prioridade</span><select value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}>{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}</select></label>{campo("Responsável atual", "responsavel_atual")}<label><span>Data prevista para retorno</span><input type="date" value={form.data_prevista_retorno} onChange={(e) => setForm((f) => ({ ...f, data_prevista_retorno: e.target.value }))} /></label><label className="wide"><span>Próxima providência</span><textarea rows={3} value={form.proxima_providencia} onChange={(e) => setForm((f) => ({ ...f, proxima_providencia: e.target.value }))} /></label><label className="wide"><span>Motivo da pendência</span><textarea rows={3} value={form.motivo_pendencia} onChange={(e) => setForm((f) => ({ ...f, motivo_pendencia: e.target.value }))} /></label>
      </div><footer><button type="button" className="btn-secondary" onClick={() => setFormAberto(false)}>Cancelar</button><button className="btn-primary" type="submit">Salvar homologação</button></footer>
    </form></Modal> : null}

    {modal === "movimentacao" ? <Modal titulo="Nova movimentação" onClose={() => setModal("")}><FormMov form={movForm} setForm={setMovForm} onSubmit={salvarMovimentacao} /></Modal> : null}
    {modal === "proposta" ? <Modal titulo="Nova proposta" onClose={() => setModal("")}><FormGenerico form={propostaForm} setForm={setPropostaForm} onSubmit={salvarProposta} selects={{ decisao: DECISOES_PROPOSTA }} /></Modal> : null}
    {modal === "reuniao" ? <Modal titulo="Registrar reunião" onClose={() => setModal("")}><FormGenerico form={reuniaoForm} setForm={setReuniaoForm} onSubmit={(e) => inserir("homologacao_reunioes", reuniaoForm, () => setModal(""), "Reunião registrada.").then(() => e.preventDefault())} /></Modal> : null}
    {modal === "diligencia" ? <Modal titulo="Registrar diligência" onClose={() => setModal("")}><FormGenerico form={diligenciaForm} setForm={setDiligenciaForm} onSubmit={(e) => { e.preventDefault(); void inserir("homologacao_diligencias", { ...diligenciaForm, custos: numero(diligenciaForm.custos) }, () => setModal(""), "Diligência registrada."); }} /></Modal> : null}
    {modal === "documento" ? <Modal titulo="Anexar documento" onClose={() => setModal("")}><FormDocumento form={documentoForm} setForm={setDocumentoForm} onSubmit={(e) => { e.preventDefault(); void inserir("homologacao_documentos", documentoForm, () => { setModal(""); setDocumentoForm(documentoInicial); }, "Documento anexado."); }} /></Modal> : null}
    {modal === "quitacao" ? <Modal titulo="Dados de quitação" onClose={() => setModal("")}><FormGenerico form={quitacaoForm} setForm={setQuitacaoForm} onSubmit={salvarQuitacao} /></Modal> : null}
    {modal === "atualizacao_contrato" ? <Modal titulo="Atualizar dados do contrato" onClose={() => setModal("")}><FormGenerico form={atualizacaoContratoForm} setForm={setAtualizacaoContratoForm} onSubmit={salvarAtualizacaoContrato} /></Modal> : null}
  </section>;

  function campo(label: string, key: keyof typeof form, required = false) {
    return <label><span>{label}</span><input required={required} value={String(form[key] ?? "")} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} /></label>;
  }
}

function Info({ label, value, destaque = false }: { label: string; value: string; destaque?: boolean }) { return <div className={destaque ? "top-info alert" : "top-info"}><span>{label}</span><strong>{value}</strong></div>; }
function Modal({ titulo, children, onClose }: { titulo: string; children: React.ReactNode; onClose: () => void }) { return <div className="modal-backdrop"><section className="cliente-modal homologacao-modal"><header><div><span className="eyebrow">Homologação e Quitação</span><h3>{titulo}</h3></div><button className="drawer-close" type="button" onClick={onClose}>×</button></header>{children}</section></div>; }
function VisaoGeral({ h, dias }: { h: Homologacao; dias: number }) { const dados = [["Cliente", h.cliente_nome], ["CPF/CNPJ", h.cpf_cnpj], ["Telefone", h.telefone], ["Contrato", h.numero_contrato], ["Instituição", h.instituicao_financeira], ["Assessoria", h.assessoria_banco], ["Representante", `${h.representante_nome || "—"} ${h.representante_contato || ""}`], ["Veículo", h.veiculo], ["Placa", h.placa], ["Valor parcela", dinheiro(h.valor_parcela)], ["Parcelas", h.quantidade_parcelas], ["Atraso", h.parcelas_atraso], ["Saldo", dinheiro(h.saldo_devedor_atualizado)], ["Quitação hoje", dinheiro(h.valor_quitacao_hoje)], ["Minuta", dinheiro(h.valor_previsto_minuta)], ["Prioridade", h.prioridade], ["Dias sem atualização", String(dias)], ["Pendência", h.motivo_pendencia], ["Próxima providência", h.proxima_providencia], ["Fontes importadas", h.fontes_importacao], ["Campos divergentes", h.campos_divergentes]]; return <section className="homologacao-card"><h3>Visão geral</h3><dl className="homologacao-details">{dados.map(([k, v]) => <div key={String(k)}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}</dl><div className="report-actions">{h.link_pasta_cliente ? <a className="report-action" href={h.link_pasta_cliente} target="_blank" rel="noreferrer">Abrir pasta no Google Drive</a> : null}{h.link_minuta_homologacao ? <a className="report-action" href={h.link_minuta_homologacao} target="_blank" rel="noreferrer">Abrir minuta de homologação</a> : null}</div></section>; }
function Timeline({ movimentacoes, onNova }: { movimentacoes: Movimentacao[]; onNova: () => void }) { return <section className="homologacao-card"><div className="section-actions"><h3>Histórico cronológico</h3><button className="btn-primary compact" type="button" onClick={onNova}>Nova movimentação</button></div><div className="timeline">{movimentacoes.length ? movimentacoes.map((m) => <article key={m.id}><strong>{m.tipo} · {dataHoraBr(m.data_hora)}</strong><p>{m.descricao}</p><small>{m.canal || "Canal não informado"} · {m.pessoa_contatada || "Pessoa não informada"} · Próxima: {m.proxima_providencia || "—"}</small></article>) : <div className="empty-row">Nenhuma movimentação registrada.</div>}</div></section>; }
function AtualizacoesContrato({ atualizacoes, onNova }: { atualizacoes: AtualizacaoContrato[]; onNova: () => void }) { return <section className="homologacao-card"><div className="section-actions"><h3>Atualizações dos dados do contrato</h3><button className="btn-primary compact" type="button" onClick={onNova}>Registrar atualização</button></div><div className="proposal-grid">{atualizacoes.length ? atualizacoes.map((item) => <article key={item.id}><strong>{dataHoraBr(item.data_atualizacao)}</strong><span>Saldo: {dinheiro(item.saldo_devedor_atual)} · Atrasadas: {item.parcelas_em_atraso ?? "—"} · Quitação hoje: {dinheiro(item.valor_quitacao_hoje)}</span><small>Desconto: {item.percentual_desconto ?? "—"}% · Validade: {dataBr(item.validade_proposta)} · Protocolo: {item.protocolo || "—"}</small>{item.observacoes ? <p>{item.observacoes}</p> : null}{item.comprovante_url ? <a href={item.comprovante_url} target="_blank" rel="noreferrer">Abrir comprovante</a> : null}</article>) : <div className="empty-row">Nenhuma atualização contratual registrada.</div>}</div></section>; }
function ListaPropostas({ propostas, onNova }: { propostas: Proposta[]; onNova: () => void }) { return <section className="homologacao-card"><div className="section-actions"><h3>Propostas apresentadas</h3><button className="btn-primary compact" type="button" onClick={onNova}>Nova proposta</button></div><div className="proposal-grid">{propostas.length ? propostas.map((p) => <article key={p.id}><strong>{p.decisao} · {dataBr(p.data_proposta)}</strong><span>Banco: {dinheiro(p.valor_banco)} · Cliente: {dinheiro(p.valor_cliente)} · Final: {dinheiro(p.valor_final)}</span><small>Desconto {p.percentual_desconto ?? "—"}% · validade {dataBr(p.validade)} · {p.representante || "sem representante"}</small><p>{p.condicoes_quitacao || p.justificativa || "Sem observações."}</p>{p.comprovante_url ? <a href={p.comprovante_url} target="_blank" rel="noreferrer">Abrir documento</a> : null}</article>) : <div className="empty-row">Nenhuma proposta salva.</div>}</div></section>; }
function ListaSimples<T extends RegistroBase>({ titulo, itens, onNova, render }: { titulo: string; itens: T[]; onNova: () => void; render: (item: T) => string }) { return <section className="homologacao-card"><div className="section-actions"><h3>{titulo}</h3><button className="btn-primary compact" type="button" onClick={onNova}>Novo registro</button></div><div className="timeline">{itens.length ? itens.map((item) => <article key={item.id}><span>{render(item)}</span><small>Criado por {item.created_by_nome || "—"} em {dataHoraBr(item.created_at)}</small></article>) : <div className="empty-row">Nenhum registro.</div>}</div></section>; }
function Documentos({ documentos, onNovo }: { documentos: Documento[]; onNovo: () => void }) { return <section className="homologacao-card"><div className="section-actions"><h3>Documentos anexados</h3><button className="btn-primary compact" type="button" onClick={onNovo}>Anexar documento</button></div><div className="document-list">{documentos.length ? documentos.map((d) => <article key={d.id}><strong>{d.nome}</strong><span>{d.categoria}{d.obrigatorio_quitacao ? " · obrigatório para quitação" : ""}</span><small>{d.ausencia_justificada ? `Ausência justificada: ${d.justificativa_ausencia || "sem detalhe"}` : "Documento disponível"}</small>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">Abrir anexo</a> : null}</article>) : <div className="empty-row">Nenhum documento anexado.</div>}</div></section>; }
function QuitacaoView({ quitacao, podeQuitar, onEditar }: { quitacao: Quitacao | null; podeQuitar: boolean; onEditar: () => void }) { return <section className="homologacao-card"><div className="section-actions"><h3>Quitação</h3><button className="btn-primary compact" type="button" onClick={onEditar}>{quitacao ? "Editar quitação" : "Registrar pagamento"}</button></div><div className={podeQuitar ? "quitacao-status ok" : "quitacao-status"}>{podeQuitar ? "Documentação suficiente para marcar como Contrato quitado." : "Contrato quitado exige comprovante/carta de quitação ou justificativa formal autorizada."}</div>{quitacao ? <dl className="homologacao-details"><div><dt>Valor pago</dt><dd>{dinheiro(quitacao.valor_pago)}</dd></div><div><dt>Pagamento</dt><dd>{dataBr(quitacao.data_pagamento)}</dd></div><div><dt>Boleto</dt><dd>{quitacao.identificacao_boleto || "—"}</dd></div><div><dt>Gravame</dt><dd>{quitacao.situacao_gravame || "—"}</dd></div><div><dt>Observações</dt><dd>{quitacao.observacoes_encerramento || "—"}</dd></div></dl> : null}</section>; }
function Relatorio({ texto }: { texto: string }) { return <section className="homologacao-card"><div className="section-actions"><h3>Relatório de acompanhamento</h3><div className="report-actions"><button type="button" onClick={() => window.print()}>Imprimir</button><button type="button" onClick={() => navigator.clipboard?.writeText(texto)}>Baixar relatório completo</button><button type="button" onClick={() => window.print()}>Gerar PDF</button></div></div><pre className="report-preview">{texto}</pre></section>; }
function FormMov({ form, setForm, onSubmit }: { form: ReturnType<typeof movimentacaoInicial>; setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof movimentacaoInicial>>>; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) { return <form className="homologacao-form" onSubmit={onSubmit}><div className="form-grid"><label><span>Data e horário</span><input type="datetime-local" value={form.data_hora} onChange={(e) => setForm((f) => ({ ...f, data_hora: e.target.value }))} /></label><label><span>Tipo</span><select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>{TIPOS_MOVIMENTACAO.map((o) => <option key={o}>{o}</option>)}</select></label><label><span>Canal</span><select value={form.canal} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))}>{CANAIS.map((o) => <option key={o}>{o}</option>)}</select></label>{Object.keys(form).filter((k) => !["data_hora", "tipo", "canal", "descricao"].includes(k)).map((k) => <label key={k}><span>{rotulo(k)}</span><input value={String(form[k as keyof typeof form] || "")} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} /></label>)}<label className="wide"><span>Descrição detalhada</span><textarea required rows={5} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} /></label></div><footer><button className="btn-primary" type="submit">Salvar movimentação</button></footer></form>; }
function FormGenerico<T extends Record<string, unknown>>({ form, setForm, onSubmit, selects = {} }: { form: T; setForm: React.Dispatch<React.SetStateAction<T>>; onSubmit: (e: FormEvent<HTMLFormElement>) => void; selects?: Record<string, string[]> }) { return <form className="homologacao-form" onSubmit={onSubmit}><div className="form-grid">{Object.entries(form).map(([k, v]) => <label key={k} className={String(k).includes("observacoes") || String(k).includes("condicoes") || String(k).includes("assuntos") || String(k).includes("deliberacoes") || String(k).includes("compromissos") ? "wide" : ""}><span>{rotulo(k)}</span>{selects[k] ? <select value={String(v || "")} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}>{selects[k].map((o) => <option key={o}>{o}</option>)}</select> : String(k).includes("data_hora") ? <input type="datetime-local" value={String(v || "")} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} /> : String(k).includes("data") || ["vencimento", "validade", "prazo"].includes(k) ? <input type="date" value={String(v || "")} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} /> : <textarea rows={String(k).includes("observacoes") || String(k).includes("condicoes") ? 4 : 2} value={String(v || "")} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />}</label>)}</div><footer><button className="btn-primary" type="submit">Salvar</button></footer></form>; }
function FormDocumento({ form, setForm, onSubmit }: { form: typeof documentoInicial; setForm: React.Dispatch<React.SetStateAction<typeof documentoInicial>>; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) { return <form className="homologacao-form" onSubmit={onSubmit}><div className="form-grid"><label><span>Categoria</span><select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>{["Proposta", "Minuta", "Assinatura", "Boleto", "Comprovante de pagamento", "Confirmação da instituição", "Termo ou carta de quitação", "Baixa de gravame", "Documento final", "Evidência"].map((o) => <option key={o}>{o}</option>)}</select></label><label><span>Nome</span><input required value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} /></label><label className="wide"><span>URL do arquivo/evidência</span><input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} /></label><label><span>Obrigatório para quitação</span><input type="checkbox" checked={form.obrigatorio_quitacao} onChange={(e) => setForm((f) => ({ ...f, obrigatorio_quitacao: e.target.checked }))} /></label><label><span>Ausência justificada</span><input type="checkbox" checked={form.ausencia_justificada} onChange={(e) => setForm((f) => ({ ...f, ausencia_justificada: e.target.checked }))} /></label><label className="wide"><span>Justificativa da ausência</span><textarea rows={3} value={form.justificativa_ausencia} onChange={(e) => setForm((f) => ({ ...f, justificativa_ausencia: e.target.value }))} /></label></div><footer><button className="btn-primary" type="submit">Salvar documento</button></footer></form>; }
function rotulo(chave: string) { return chave.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()); }
function montarRelatorio(h: Homologacao, movs: Movimentacao[], props: Proposta[], reunioes: Reuniao[], diligencias: Diligencia[], docs: Documento[], quit: Quitacao | null) { return `RELATÓRIO DE ACOMPANHAMENTO DE HOMOLOGAÇÃO E QUITAÇÃO

1. Identificação do cliente
Cliente: ${h.cliente_nome}
CPF/CNPJ: ${h.cpf_cnpj || "—"}
Telefone: ${h.telefone || "—"}

2. Dados do contrato e veículo
Contrato: ${h.numero_contrato || "—"}
Veículo: ${h.veiculo || "—"} | Placa: ${h.placa || "—"}

3. Instituição financeira e representante
Instituição: ${h.instituicao_financeira || "—"}
Assessoria: ${h.assessoria_banco || "—"}
Representante: ${h.representante_nome || "—"} | Contato: ${h.representante_contato || "—"}

4. Situação atual
Status: ${h.status}
Prioridade: ${h.prioridade || "—"}
Responsável atual: ${h.responsavel_atual || "—"}
Dias sem atualização: ${diasDesde(movs[0]?.data_hora || h.updated_at)}

5. Resumo financeiro
Valor da parcela: ${dinheiro(h.valor_parcela)}
Quantidade de parcelas: ${h.quantidade_parcelas || "—"}
Parcelas em atraso: ${h.parcelas_atraso || "—"}
Saldo devedor atualizado: ${dinheiro(h.saldo_devedor_atualizado)}
Valor previsto na minuta: ${dinheiro(h.valor_previsto_minuta)}

6. Histórico cronológico das tratativas
${movs.map((m) => `- ${dataHoraBr(m.data_hora)} | ${m.tipo} | ${m.descricao}`).join("\n") || "Sem movimentações."}

7. Propostas apresentadas
${props.map((p) => `- ${dataBr(p.data_proposta)} | Banco ${dinheiro(p.valor_banco)} | Final ${dinheiro(p.valor_final)} | ${p.decisao}`).join("\n") || "Sem propostas."}

8. Reuniões e diligências
${[...reunioes.map((r) => `- Reunião ${dataHoraBr(r.data_hora)} | ${r.pauta || "sem pauta"} | ${r.deliberacoes || "sem deliberações"}`), ...diligencias.map((d) => `- Diligência ${d.tipo_diligencia || "—"} | ${d.situacao || "—"} | ${d.resultado || "sem resultado"}`)].join("\n") || "Sem reuniões ou diligências."}

9. Documentos anexados
${docs.map((d) => `- ${d.categoria}: ${d.nome}${d.url ? ` | ${d.url}` : ""}`).join("\n") || "Sem documentos."}

10. Pendências atuais
${h.motivo_pendencia || "Sem pendência registrada."}

11. Próxima providência e prazo
${h.proxima_providencia || "—"} | ${dataBr(h.data_prevista_retorno)}

12. Resultado final da homologação
${h.resultado_final || quit?.observacoes_encerramento || "Em acompanhamento."}

13. Identificação do negociador responsável
${h.negociador_responsavel || h.responsavel_atual || "—"}`;
}
