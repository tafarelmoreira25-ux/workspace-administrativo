import { FormActions, FormField, FormGrid, FormSection, Input, Textarea } from "../common/FormControls";
import { FormEvent, type ReactNode, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import Pagination from "../common/Pagination";
import { sincronizarClienteDoProcesso, sincronizarProcessosDoCliente } from "../../lib/processDataSync";

const GeradorDocumentos = lazy(() => import("../../GeradorDocumentos"));
const EmailComposer = lazy(() => import("../comunicacao/EmailComposer"));
const ContentAnalyzer = lazy(() => import("../comunicacao/ContentAnalyzer"));

type Cliente = {
  id: string | number;
  nome_completo: string;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  id_crm: string | null;
  link_pasta_cliente: string | null;
  responsavel: string | null;
  observacoes: string | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type ProcessoResumo = {
  id: string | number;
  cliente_id?: string | null;
  nome_cliente?: string | null;
  cpf_cliente?: string | null;
  banco_reu?: string | null;
  reu?: string | null;
  numero_processo?: string | null;
  fase_atual?: string | null;
  situacao?: string | null;
  resultado?: string | null;
  status_judicial?: string | null;
  justica_gratuita?: string | null;
  responsavel?: string | null;
  tipo_acao?: string | null;
  tribunal?: string | null;
  comarca?: string | null;
  vara?: string | null;
  data_distribuicao?: string | null;
  observacoes?: string | null;
  documentacao_status?: string | null;
  procuracao_status?: string | null;
  protocolo_status?: string | null;
  updated_at?: string | null;
};

type DocumentoResumo = {
  id: string;
  nome_documento: string;
  modelo_nome: string;
  cliente_nome: string | null;
  cpf_cnpj: string | null;
  numero_processo: string | null;
  responsavel_nome: string | null;
  status: string | null;
  created_at: string | null;
};

type AtendimentoResumo = {
  id: string;
  cliente_id?: string | null;
  processo_id?: string | null;
  cliente_nome: string;
  processo_numero?: string | null;
  data: string;
  hora?: string | null;
  canal: string;
  tipo?: string | null;
  descricao: string;
  responsavel?: string | null;
  anexo_url?: string | null;
  created_at?: string | null;
};

type Props = {
  usuario: { nome?: string; email?: string };
  showToast?: (message: string) => void;
  buscaExterna?: string;
  clienteInicialId?: string | number | null;
  onOpenProcess?: (processoId: string | number) => void;
  fichaInline?: boolean;
  clienteFicha?: Cliente | null;
  processoAtual?: ProcessoResumo | null;
  children?: ReactNode;
};

type HistoricoResumo = { id: string; tipo: string; descricao: string; origem?: string | null; processo_id?: string | null; created_at: string; created_by?: string | null };

type ImportacaoCliente = { nome_completo: string; origem: string; status: "novo" | "existente" | "possivel" | "invalido"; motivo?: string };

const FORMULARIO_INICIAL = {
  nome_completo: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  telefone: "",
  email: "",
  endereco: "",
  id_crm: "",
  link_pasta_cliente: "",
  responsavel: "",
  observacoes: "",
};

const CLIENTES_POR_PAGINA = 30;
const DETALHES_FICHA_LIMITE = 60;
const CAMPOS_CLIENTE = "id,nome_completo,cpf,rg,data_nascimento,telefone,email,endereco,id_crm,link_pasta_cliente,responsavel,observacoes,created_at,created_by,updated_at,updated_by";
const CAMPOS_ATENDIMENTO_CLIENTE = "id,cliente_id,processo_id,cliente_nome,processo_numero,data,hora,canal,tipo,descricao,responsavel,anexo_url,created_at";
const CAMPOS_HISTORICO_CLIENTE = "id,tipo,descricao,origem,processo_id,created_at,created_by";
const PROCESSO_FORM_INICIAL = { id: "", numero_processo: "", reu: "", banco_reu: "", tipo_acao: "", tribunal: "", comarca: "", vara: "", data_distribuicao: "", responsavel: "", situacao: "Em andamento", observacoes: "" };
const ATENDIMENTO_FORM_INICIAL = { id: "", tipo: "Retorno", data: new Date().toISOString().slice(0, 10), hora: "", canal: "Telefone", descricao: "", responsavel: "" };

function termoPostgrest(valor: string) {
  return valor.trim().replace(/[,()"']/g, " ").replace(/\s+/g, " ").slice(0, 120);
}

function normalizarBusca(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatarData(data?: string | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(data));
}

function formatarDataHora(data?: string | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data));
}

function criarFormulario(cliente?: Cliente | null, responsavel = "") {
  if (!cliente) return { ...FORMULARIO_INICIAL, responsavel };
  return {
    nome_completo: cliente.nome_completo || "",
    cpf: cliente.cpf || "",
    rg: cliente.rg || "",
    data_nascimento: cliente.data_nascimento || "",
    telefone: cliente.telefone || "",
    email: cliente.email || "",
    endereco: cliente.endereco || "",
    id_crm: cliente.id_crm || "",
    link_pasta_cliente: cliente.link_pasta_cliente || "",
    responsavel: cliente.responsavel || responsavel,
    observacoes: cliente.observacoes || "",
  };
}

function limparTexto(valor: string) {
  const texto = valor.trim();
  return texto || null;
}

function corrigirCodificacao(valor: string) {
  if (!/[ÃÂâ]/.test(valor)) return valor;
  try {
    return decodeURIComponent(escape(valor));
  } catch {
    return valor;
  }
}

function extrairNomeImportacao(linha: string) {
  const primeiraColuna = (linha.split("\t")[0] || "").replace(/^\"|\"$/g, "").trim();
  const nome = corrigirCodificacao(primeiraColuna).replace(/^\t+/, "").split(/\s+[xX]\s+/)[0].trim();
  return nome;
}

export default function ClientesModule({ usuario, showToast, buscaExterna, clienteInicialId, onOpenProcess, fichaInline = false, clienteFicha, processoAtual, children }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [processos, setProcessos] = useState<ProcessoResumo[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoResumo[]>([]);
  const [atendimentos, setAtendimentos] = useState<AtendimentoResumo[]>([]);
  const [historicos, setHistoricos] = useState<HistoricoResumo[]>([]);
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [totalClientes, setTotalClientes] = useState(0);
  const [clienteAberto, setClienteAberto] = useState<Cliente | null>(clienteFicha || null);
  const [abaFicha, setAbaFicha] = useState("resumo");
  const [modalAberto, setModalAberto] = useState(false);
  const [geradorAberto, setGeradorAberto] = useState(false);
  const [emailAberto, setEmailAberto] = useState(false);
  const [analisadorAberto, setAnalisadorAberto] = useState(false);
  const [processoEmail, setProcessoEmail] = useState<ProcessoResumo | null>(null);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [formulario, setFormulario] = useState(() => criarFormulario(null, usuario.nome || ""));
  const [carregando, setCarregando] = useState(true);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const fichaRequisicao = useRef(0);
  const fichaClienteId = useRef<string | number | null>(null);
  const clienteInicialCarregado = useRef<string | null>(null);
  const listaRequisicao = useRef(0);
  const [salvando, setSalvando] = useState(false);
  const [processoForm, setProcessoForm] = useState(PROCESSO_FORM_INICIAL);
  const [processoFormAberto, setProcessoFormAberto] = useState(false);
  const [atendimentoForm, setAtendimentoForm] = useState(ATENDIMENTO_FORM_INICIAL);
  const [atendimentoFormAberto, setAtendimentoFormAberto] = useState(false);
  const [historicoFormAberto, setHistoricoFormAberto] = useState(false);
  const [historicoDescricao, setHistoricoDescricao] = useState("");
  const [erro, setErro] = useState("");
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  const [importacaoCarregando, setImportacaoCarregando] = useState(false);
  const [importacaoExecutando, setImportacaoExecutando] = useState(false);
  const [importacaoResultado, setImportacaoResultado] = useState<ImportacaoCliente[]>([]);

  const avisar = useCallback((mensagem: string) => {
    if (showToast) showToast(mensagem);
    else window.alert(mensagem);
  }, [showToast]);

  const carregarDados = useCallback(async () => {
    const requisicao = ++listaRequisicao.current;
    setCarregando(true);
    setErro("");
    const termo = termoPostgrest(buscaAplicada);
    let clientesPorProcesso: Array<string | number> = [];

    if (termo) {
      const { data: encontrados } = await supabase
        .from("processos")
        .select("cliente_id")
        .ilike("numero_processo", `%${termo}%`)
        .not("cliente_id", "is", null)
        .limit(500);
      clientesPorProcesso = [...new Set((encontrados || []).map((item) => item.cliente_id).filter(Boolean))] as Array<string | number>;
    }

    let consulta = supabase.from("clientes").select(CAMPOS_CLIENTE, { count: "exact" });
    if (termo) {
      const filtros = [
        `nome_completo.ilike.%${termo}%`,
        `cpf.ilike.%${termo}%`,
        `id_crm.ilike.%${termo}%`,
      ];
      if (clientesPorProcesso.length) filtros.push(`id.in.(${clientesPorProcesso.join(",")})`);
      consulta = consulta.or(filtros.join(","));
    }

    const inicio = (pagina - 1) * CLIENTES_POR_PAGINA;
    const { data, count, error } = await consulta
      .order("nome_completo", { ascending: true })
      .range(inicio, inicio + CLIENTES_POR_PAGINA - 1);

    if (requisicao !== listaRequisicao.current) return;
    if (error) {
      setErro(`Não foi possível carregar clientes: ${error.message}`);
      setCarregando(false);
      return;
    }

    const paginaClientes = (data || []) as Cliente[];
    setClientes(paginaClientes);
    setTotalClientes(count || 0);
    setCarregando(false);
    const ids = paginaClientes.map((cliente) => cliente.id);
    if (ids.length) {
      const { data: processosPagina } = await supabase
        .from("processos")
        .select("id, cliente_id, nome_cliente, cpf_cliente, reu, banco_reu, numero_processo, fase_atual, situacao, resultado, status_judicial, justica_gratuita, responsavel, updated_at")
        .in("cliente_id", ids)
        .order("updated_at", { ascending: false });
      if (requisicao !== listaRequisicao.current) return;
      if (!processosPagina) return;
      setProcessos((atuais) => [
        ...(processosPagina as ProcessoResumo[]).map((item) => ({ ...atuais.find((atual) => String(atual.id) === String(item.id)), ...item })),
        ...atuais.filter((item) => String(item.cliente_id) === String(fichaClienteId.current) && !ids.some((id) => String(id) === String(item.cliente_id))),
      ]);
    }

  }, [buscaAplicada, pagina]);

  useEffect(() => {
    if (!fichaInline) carregarDados();
  }, [carregarDados, fichaInline]);

  useEffect(() => {
    if (clienteFicha) void abrirFicha(clienteFicha);
  }, [clienteFicha]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPagina(1);
      setBuscaAplicada(buscaExterna ?? "");
    }, 350);
    return () => window.clearTimeout(timer);
  }, [buscaExterna]);

  useEffect(() => {
    if (!clienteInicialId) { clienteInicialCarregado.current = null; return; }
    if (clienteInicialCarregado.current === String(clienteInicialId)) return;
    clienteInicialCarregado.current = String(clienteInicialId);
    void supabase.from("clientes").select(CAMPOS_CLIENTE).eq("id", clienteInicialId).maybeSingle().then(({ data }) => {
      if (data) void abrirFicha(data as Cliente);
    });
  }, [clienteInicialId]);

  const clientesFiltrados = clientes;

  const processosDoCliente = useMemo(() => {
    if (!clienteAberto) return [];
    const id = String(clienteAberto.id);
    const cpf = normalizarBusca(clienteAberto.cpf || "");
    const nome = normalizarBusca(clienteAberto.nome_completo || "");
    const encontrados = processos.filter((processo) => {
      const mesmoId = String(processo.cliente_id || "") === id;
      const mesmoCpf = cpf && normalizarBusca(processo.cpf_cliente || "") === cpf;
      const mesmoNome = nome && normalizarBusca(processo.nome_cliente || "") === nome;
      return mesmoId || mesmoCpf || mesmoNome;
    });
    if (processoAtual && !encontrados.some((processo) => String(processo.id) === String(processoAtual.id))) return [processoAtual, ...encontrados];
    return encontrados;
  }, [clienteAberto, processos, processoAtual]);
  const protocoloDoCliente = processosDoCliente.find((processo) => !processo.numero_processo);

  const documentosDoCliente = useMemo(() => {
    if (!clienteAberto) return [];
    const cpf = normalizarBusca(clienteAberto.cpf || "");
    const nome = normalizarBusca(clienteAberto.nome_completo || "");
    return documentos.filter((documento) => {
      const mesmoCpf = cpf && normalizarBusca(documento.cpf_cnpj || "") === cpf;
      const mesmoNome = nome && normalizarBusca(documento.cliente_nome || "") === nome;
      return mesmoCpf || mesmoNome;
    });
  }, [clienteAberto, documentos]);

  const atendimentosDoCliente = useMemo(() => {
    if (!clienteAberto) return [];
    const id = String(clienteAberto.id);
    const nome = normalizarBusca(clienteAberto.nome_completo || "");
    return atendimentos.filter((atendimento) => {
      const mesmoId = String(atendimento.cliente_id || "") === id;
      const mesmoNome = nome && normalizarBusca(atendimento.cliente_nome || "") === nome;
      return mesmoId || mesmoNome;
    });
  }, [atendimentos, clienteAberto]);

  const historicoDoCliente = useMemo(() => {
    const eventosAtendimento = atendimentosDoCliente.map((atendimento) => ({
      id: `atendimento-${atendimento.id}`,
      titulo: `${atendimento.canal} · ${atendimento.tipo || "Atendimento"}`,
      descricao: atendimento.descricao,
      data: atendimento.created_at || `${atendimento.data}T${atendimento.hora || "00:00"}`,
      responsavel: atendimento.responsavel,
    }));
    const eventosDocumento = documentosDoCliente.map((documento) => ({
      id: `documento-${documento.id}`,
      titulo: `Documento · ${documento.nome_documento}`,
      descricao: `${documento.modelo_nome} · ${documento.status || "Gerado"}`,
      data: documento.created_at,
      responsavel: documento.responsavel_nome,
    }));
    const eventosManuais = historicos.map((registro) => ({ id: `historico-${registro.id}`, titulo: registro.tipo || "Registro manual", descricao: registro.descricao, data: registro.created_at, responsavel: registro.created_by }));
    return [...eventosManuais, ...eventosAtendimento, ...eventosDocumento]
      .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  }, [atendimentosDoCliente, documentosDoCliente, historicos]);

  function abrirNovoCliente() {
    setClienteEditando(null);
    setFormulario(criarFormulario(null, usuario.nome || ""));
    setModalAberto(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setClienteEditando(cliente);
    setFormulario(criarFormulario(cliente, usuario.nome || ""));
    setModalAberto(true);
  }

  async function abrirFicha(cliente: Cliente) {
    fichaClienteId.current = cliente.id;
    setClienteAberto(cliente);
    setAbaFicha("resumo");
    setCarregandoFicha(true);
    const requisicao = ++fichaRequisicao.current;
    setDocumentos([]);
    setAtendimentos([]);
    setHistoricos([]);
    // Libera os dados de cada consulta sem esperar a mais lenta.
    const aplicar = <T,>(consulta: PromiseLike<{ data: T[] | null; error: unknown }>, atualizar: (dados: T[]) => void) => Promise.resolve(consulta).then(({ data, error }) => {
      if (requisicao === fichaRequisicao.current && !error) atualizar(data || []);
    });
    await Promise.allSettled([
      aplicar(supabase.from("processos").select("id, cliente_id, nome_cliente, cpf_cliente, reu, banco_reu, numero_processo, fase_atual, situacao, resultado, status_judicial, justica_gratuita, responsavel, tipo_acao, tribunal, comarca, vara, data_distribuicao, observacoes, documentacao_status, procuracao_status, protocolo_status, updated_at").eq("cliente_id", cliente.id).order("updated_at", { ascending: false }).limit(DETALHES_FICHA_LIMITE), (dados) => setProcessos((atuais) => [...dados, ...atuais.filter((item) => String(item.cliente_id) !== String(cliente.id) && !dados.some((processo) => String(processo.id) === String(item.id)))])),
      aplicar(supabase.from("documentos_juridicos").select("id, nome_documento, modelo_nome, cliente_nome, cpf_cnpj, numero_processo, responsavel_nome, status, created_at").eq("cliente_id", cliente.id).order("created_at", { ascending: false }).limit(DETALHES_FICHA_LIMITE), setDocumentos),
      aplicar(supabase.from("processual_atendimentos").select(CAMPOS_ATENDIMENTO_CLIENTE).eq("cliente_id", cliente.id).order("data", { ascending: false }).limit(DETALHES_FICHA_LIMITE), setAtendimentos),
      aplicar(supabase.from("clientes_historico").select(CAMPOS_HISTORICO_CLIENTE).eq("cliente_id", cliente.id).order("created_at", { ascending: false }).limit(DETALHES_FICHA_LIMITE), setHistoricos),
    ]);
    if (requisicao !== fichaRequisicao.current) return;
    setCarregandoFicha(false);
  }

  function fecharFicha() {
    fichaRequisicao.current += 1;
    fichaClienteId.current = null;
    setClienteAberto(null);
    setCarregandoFicha(false);
  }

  function editarProcesso(processo?: ProcessoResumo) {
    setProcessoForm(processo ? Object.fromEntries(Object.keys(PROCESSO_FORM_INICIAL).map((campo) => [campo, String(processo[campo as keyof ProcessoResumo] || "")])) as typeof PROCESSO_FORM_INICIAL : { ...PROCESSO_FORM_INICIAL, responsavel: usuario.nome || "" });
    setProcessoFormAberto(true);
  }

  async function salvarProcessoCliente(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!clienteAberto) return;
    const numero = limparTexto(processoForm.numero_processo);
    const payload = {
      cliente_id: clienteAberto.id, cliente: clienteAberto.nome_completo, nome_cliente: clienteAberto.nome_completo, cpf_cliente: clienteAberto.cpf,
      autor: clienteAberto.nome_completo, reu: limparTexto(processoForm.reu), banco_reu: limparTexto(processoForm.banco_reu),
      autor_reu: processoForm.reu.trim() ? `${clienteAberto.nome_completo} X ${processoForm.reu.trim()}` : clienteAberto.nome_completo,
      numero, numero_processo: numero, tipo_acao: limparTexto(processoForm.tipo_acao), tribunal: limparTexto(processoForm.tribunal),
      comarca: limparTexto(processoForm.comarca), vara: limparTexto(processoForm.vara), data_distribuicao: processoForm.data_distribuicao || null,
      responsavel: limparTexto(processoForm.responsavel), situacao: processoForm.situacao || null, observacoes: limparTexto(processoForm.observacoes),
      fase_atual: numero ? "Tramitando" : "Solicitado para Ajuizamento", origem_registro: numero ? "manual" : "encaminhamento_processual",
      status_judicial: numero ? "TRAMITANDO" : null, updated_by: usuario.email || usuario.nome || null,
    };
    setSalvando(true);
    const operacao = processoForm.id ? supabase.from("processos").update(payload).eq("id", processoForm.id) : supabase.from("processos").insert({ ...payload, created_by: usuario.email || usuario.nome || null });
    const { data, error } = await operacao.select("*").single();
    setSalvando(false);
    if (error) { avisar(`Não foi possível salvar o processo: ${error.message}`); return; }
    void sincronizarClienteDoProcesso(supabase, data as ProcessoResumo, usuario).catch((erro) => {
      console.warn("Falha ao sincronizar cliente/processo", erro);
    });
    setProcessos((atuais) => [data as ProcessoResumo, ...atuais.filter((item) => String(item.id) !== String(data.id))]);
    setProcessoFormAberto(false); avisar(numero ? "Processo salvo e disponível em Processos e Processual." : "Protocolo salvo para ajuizamento.");
  }

  function editarAtendimento(atendimento?: AtendimentoResumo) {
    setAtendimentoForm(atendimento ? { id: String(atendimento.id), tipo: atendimento.tipo || "Atendimento", data: atendimento.data, hora: atendimento.hora || "", canal: atendimento.canal, descricao: atendimento.descricao, responsavel: atendimento.responsavel || "" } : { ...ATENDIMENTO_FORM_INICIAL, responsavel: usuario.nome || "" });
    setAtendimentoFormAberto(true);
  }

  async function salvarAtendimentoCliente(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); if (!clienteAberto || !atendimentoForm.descricao.trim()) return;
    const payload = { cliente_id: clienteAberto.id, cliente_nome: clienteAberto.nome_completo, tipo: atendimentoForm.tipo, data: atendimentoForm.data, hora: atendimentoForm.hora || null, canal: atendimentoForm.canal, descricao: atendimentoForm.descricao.trim(), responsavel: atendimentoForm.responsavel || usuario.nome || null, created_by_nome: usuario.nome || usuario.email || null };
    const operacao = atendimentoForm.id ? supabase.from("processual_atendimentos").update(payload).eq("id", atendimentoForm.id) : supabase.from("processual_atendimentos").insert(payload);
    const { data, error } = await operacao.select("*").single();
    if (error) { avisar(`Não foi possível salvar o atendimento: ${error.message}`); return; }
    setAtendimentos((atuais) => [data as AtendimentoResumo, ...atuais.filter((item) => String(item.id) !== String(data.id))]); setAtendimentoFormAberto(false); avisar("Atendimento salvo.");
  }

  async function salvarHistoricoCliente(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); if (!clienteAberto || !historicoDescricao.trim()) return;
    const { data, error } = await supabase.from("clientes_historico").insert({ cliente_id: clienteAberto.id, tipo: "registro manual", descricao: historicoDescricao.trim(), origem: "Ficha do cliente", created_by: usuario.email || usuario.nome || null }).select("*").single();
    if (error) { avisar(`Não foi possível salvar o histórico: ${error.message}`); return; }
    setHistoricos((atuais) => [data as HistoricoResumo, ...atuais]); setHistoricoDescricao(""); setHistoricoFormAberto(false); avisar("Registro incluído no histórico.");
  }

  function contextoDocumentoCliente() {
    if (!clienteAberto) return null;
    return {
      cliente: {
        id: clienteAberto.id,
        nome_completo: clienteAberto.nome_completo,
        cpf: clienteAberto.cpf,
        rg: clienteAberto.rg,
        email: clienteAberto.email,
        endereco: clienteAberto.endereco,
        link_pasta_cliente: clienteAberto.link_pasta_cliente,
      },
      departamento: "Processual",
    };
  }

  function registrarDocumentoGerado(resultado: { documentoRemoto?: DocumentoResumo | null }) {
    if (resultado.documentoRemoto) {
      setDocumentos((atuais) => [resultado.documentoRemoto as DocumentoResumo, ...atuais.filter((item) => item.id !== resultado.documentoRemoto?.id)]);
    }
    avisar("Documento vinculado ao cliente.");
  }

  function abrirEmail(processo?: ProcessoResumo | null) {
    setProcessoEmail(processo || null);
    setEmailAberto(true);
  }

  function registrarAtendimentoEmail(atendimento: AtendimentoResumo) {
    setAtendimentos((atuais) => [atendimento, ...atuais.filter((item) => item.id !== atendimento.id)]);
  }

  async function salvarCliente(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formulario.nome_completo.trim()) {
      avisar("Informe o nome completo do cliente.");
      return;
    }

    setSalvando(true);
    const payload = {
      nome: formulario.nome_completo.trim(),
      nome_completo: formulario.nome_completo.trim(),
      cpf: limparTexto(formulario.cpf),
      rg: limparTexto(formulario.rg),
      data_nascimento: formulario.data_nascimento || null,
      telefone: limparTexto(formulario.telefone),
      email: limparTexto(formulario.email),
      endereco: limparTexto(formulario.endereco),
      id_crm: limparTexto(formulario.id_crm),
      link_pasta_cliente: limparTexto(formulario.link_pasta_cliente),
      responsavel: limparTexto(formulario.responsavel),
      observacoes: limparTexto(formulario.observacoes),
      updated_by: usuario.email || usuario.nome || null,
    };

    const operacao = clienteEditando
      ? supabase.from("clientes").update(payload).eq("id", clienteEditando.id).select("*").single()
      : supabase.from("clientes").insert(payload).select("*").single();

    const { data, error } = await operacao;
    setSalvando(false);

    if (error) {
      avisar(`Não foi possível salvar o cliente: ${error.message}`);
      return;
    }

    const clienteSalvo = data as Cliente;
    void sincronizarProcessosDoCliente(supabase, clienteSalvo, usuario).catch((erro) => {
      console.warn("Falha ao sincronizar processos do cliente", erro);
    });
    setClientes((atuais) => {
      const semAtual = atuais.filter((cliente) => String(cliente.id) !== String(clienteSalvo.id));
      return [clienteSalvo, ...semAtual];
    });
    setClienteAberto((atual) => atual && String(atual.id) === String(clienteSalvo.id) ? clienteSalvo : atual);
    setModalAberto(false);
    avisar(clienteEditando ? "Cliente atualizado." : "Cliente cadastrado.");
  }

  async function prepararImportacao() {
    setImportacaoCarregando(true);
    setImportacaoResultado([]);
    const sessaoTimeout = new Promise((_, reject) => window.setTimeout(() => reject(new Error("Tempo limite ao validar a sessão.")), 15000));
    const { data: sessaoData, error: sessaoError } = await Promise.race([supabase.auth.getSession(), sessaoTimeout]) as Awaited<ReturnType<typeof supabase.auth.getSession>>;
    if (sessaoError || !sessaoData.session?.user) {
      setImportacaoCarregando(false);
      avisar("Importação bloqueada: faça login com um usuário autorizado.");
      return;
    }
    const consultaTimeout = new Promise((_, reject) => window.setTimeout(() => reject(new Error("Tempo limite ao consultar clientes.")), 15000));
    const { data: existentes, error: consultaError } = await Promise.race([
      supabase.from("clientes").select("id,nome_completo,cpf,telefone").limit(2000),
      consultaTimeout,
    ]) as Awaited<ReturnType<typeof supabase.from>>;
    if (consultaError) {
      setImportacaoCarregando(false);
      avisar(`Não foi possível consultar clientes: ${consultaError.message}`);
      return;
    }
    const controlador = new AbortController();
    const limite = window.setTimeout(() => controlador.abort(), 15000);
    const resposta = await fetch("/importacoes/clientes-processual.txt", { cache: "no-store", signal: controlador.signal });
    window.clearTimeout(limite);
    if (!resposta.ok) {
      setImportacaoCarregando(false);
      avisar(`Não foi possível carregar a relação de clientes (${resposta.status}).`);
      return;
    }
    const texto = await resposta.text();
    const nomes = texto.split(/\r?\n/).filter(Boolean).map((origem) => ({ nome_completo: extrairNomeImportacao(origem), origem }));
    const unicos = new Map<string, { nome_completo: string; origem: string }>();
    nomes.forEach((item) => { const chave = normalizarBusca(item.nome_completo); if (item.nome_completo && chave !== "captura de tela" && !unicos.has(chave)) unicos.set(chave, item); });
    const existentesPorNome = new Map((existentes || []).map((cliente) => [normalizarBusca(cliente.nome_completo), cliente]));
    const resultado = [...unicos.values()].map((item): ImportacaoCliente => {
      const existente = existentesPorNome.get(normalizarBusca(item.nome_completo));
      return existente ? { ...item, status: "existente", motivo: "Cliente já cadastrado." } : { ...item, status: "novo" };
    });
    setImportacaoResultado(resultado);
    setImportacaoCarregando(false);
  }

  async function executarImportacao() {
    const novos = importacaoResultado.filter((item) => item.status === "novo");
    if (!novos.length) return;
    setImportacaoExecutando(true);
    const resultados = [...importacaoResultado];
    for (let inicio = 0; inicio < novos.length; inicio += 25) {
      const lote = novos.slice(inicio, inicio + 25);
      for (const item of lote) {
        const { error } = await supabase.from("clientes").insert({ nome_completo: item.nome_completo });
        const indice = resultados.findIndex((resultado) => resultado.nome_completo === item.nome_completo);
        if (indice >= 0) resultados[indice] = error ? { ...item, status: "possivel", motivo: error.message } : { ...item, status: "existente", motivo: "Cadastrado com sucesso." };
      }
    }
    setImportacaoResultado(resultados);
    await carregarDados();
    setImportacaoExecutando(false);
    avisar("Importação concluída. Confira o relatório antes de fechar.");
  }

  function processosCount(cliente: Cliente) {
    const id = String(cliente.id);
    const cpf = normalizarBusca(cliente.cpf || "");
    const nome = normalizarBusca(cliente.nome_completo || "");
    return processos.filter((processo) => (
      String(processo.cliente_id || "") === id ||
      (cpf && normalizarBusca(processo.cpf_cliente || "") === cpf) ||
      (nome && normalizarBusca(processo.nome_cliente || "") === nome)
    )).length;
  }

  return (
    <section className={`clientes-workspace${fichaInline ? " clientes-workspace-inline" : ""}`}>
      {!fichaInline ? <header className="module-page-header">
        <div>
          <span className="eyebrow">Clientes</span>
          <h2>Base de clientes</h2>
          <p>Cadastro único do cliente, separado dos processos judiciais e preparado para múltiplas demandas.</p>
        </div>
        <div className="ficha-section-actions">
          <button type="button" className="btn-secondary" onClick={() => { setImportacaoAberta(true); prepararImportacao().catch((error) => { setImportacaoCarregando(false); avisar(error instanceof Error ? error.message : "Não foi possível preparar a importação."); }); }}>Importar clientes</button>
          <button type="button" className="btn-primary" onClick={abrirNovoCliente}>+ Novo cliente</button>
        </div>
      </header> : null}

      <div className="clientes-layout">
        {!fichaInline ? <section className="clientes-list-panel">
          <div className="clientes-toolbar">
            <span>{buscaAplicada ? `Resultados para “${buscaAplicada}”` : "Todos os clientes"}</span>
            <button type="button" className="btn-secondary" onClick={carregarDados}>Atualizar</button>
          </div>

          {erro ? <div className="client-warning">{erro}</div> : null}

          <div className="clientes-table-wrap">
            <table className="clientes-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CPF</th>
                  <th>ID CRM</th>
                  <th>Telefone</th>
                  <th>Processos</th>
                  <th>Responsável</th>
                  <th>Última atualização</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregando && !clientes.length ? (
                  <tr><td colSpan={8}><div className="empty-row">Carregando clientes...</div></td></tr>
                ) : clientesFiltrados.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-row">Nenhum cliente encontrado.</div></td></tr>
                ) : clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id}>
                    <td><strong>{cliente.nome_completo}</strong><small>{cliente.email || "E-mail não informado"}</small></td>
                    <td>{cliente.cpf || "—"}</td>
                    <td>{cliente.id_crm || "—"}</td>
                    <td>{cliente.telefone || "—"}</td>
                    <td><span className="table-chip">{processosCount(cliente)}</span></td>
                    <td>{cliente.responsavel || "—"}</td>
                    <td>{formatarDataHora(cliente.updated_at || cliente.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn-secondary compact" onClick={() => abrirFicha(cliente)}>Abrir ficha</button>
                        <button type="button" className="btn-secondary compact" onClick={() => abrirEdicao(cliente)}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagina={pagina} total={totalClientes} tamanho={CLIENTES_POR_PAGINA} onChange={setPagina} rotulo="clientes" />
        </section> : null}

        {clienteAberto ? (
          <div className={fichaInline ? "cliente-ficha-inline" : "cliente-ficha-backdrop"} role="presentation" onMouseDown={(evento) => { if (!fichaInline && evento.target === evento.currentTarget) fecharFicha(); }}>
          <section className="cliente-ficha-panel cliente-ficha-page" role={fichaInline ? "region" : "dialog"} aria-modal={fichaInline ? undefined : true} aria-label={`Ficha de ${clienteAberto.nome_completo}`}>
            <header>
              {!fichaInline ? <button type="button" className="cliente-back-button" onClick={fecharFicha}>← Voltar para clientes</button> : null}
              <div className="cliente-ficha-heading">
                <div>
                  <span className="eyebrow">Ficha do cliente</span>
                  <h3>{clienteAberto.nome_completo}</h3>
                </div>
                <div className="cliente-quick-actions">
                  <button type="button" className="btn-primary compact" onClick={() => abrirEmail(processoAtual)}>Preparar e-mail</button>
                  <button type="button" className="btn-secondary compact" onClick={() => setAnalisadorAberto(true)}>Analisar e-mail/PDF</button>
                  <button type="button" className="btn-secondary compact" onClick={() => abrirEdicao(clienteAberto)}>Editar cadastro</button>
                </div>
              </div>
              <dl className="cliente-ficha-topo">
                <div><dt>CPF</dt><dd>{clienteAberto.cpf || "Não informado"}</dd></div>
                <div><dt>Telefone</dt><dd>{clienteAberto.telefone || "Não informado"}</dd></div>
                <div><dt>E-mail</dt><dd>{clienteAberto.email || "Não informado"}</dd></div>
                <div><dt>Responsável</dt><dd>{clienteAberto.responsavel || "Não definido"}</dd></div>
              </dl>
            </header>

            <nav className="cliente-ficha-tabs" aria-label="Abas da ficha do cliente">
              {["resumo", "processos", "atendimentos", "documentos", "historico"].map((item) => (
                <button key={item} type="button" className={abaFicha === item ? "active" : ""} onClick={() => setAbaFicha(item)}>
                  {item === "historico" ? "Histórico" : item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </nav>

            <div className="cliente-ficha-content">
              {carregandoFicha ? <div className="empty-row">Carregando informações da ficha...</div> : null}
              {abaFicha === "resumo" ? (
                <section className="ficha-section">
                  <div className="ficha-resumo-grid">
                    <section className="ficha-info-group">
                      <header><span>01</span><h4>Dados cadastrais</h4></header>
                      <dl className="ficha-details">
                        <div><dt>RG</dt><dd>{clienteAberto.rg || "Não informado"}</dd></div>
                        <div><dt>Data de nascimento</dt><dd>{clienteAberto.data_nascimento ? formatarData(clienteAberto.data_nascimento) : "Não informada"}</dd></div>
                        <div><dt>ID no CRM</dt><dd>{clienteAberto.id_crm || "Não informado"}</dd></div>
                      </dl>
                    </section>

                    <section className="ficha-info-group">
                      <header><span>02</span><h4>Arquivos e acompanhamento</h4></header>
                      <dl className="ficha-details">
                        <div><dt>Pasta no Drive</dt><dd>{clienteAberto.link_pasta_cliente ? <a href={clienteAberto.link_pasta_cliente} target="_blank" rel="noreferrer">Abrir pasta do cliente</a> : "Não vinculada"}</dd></div>
                        <div><dt>Processos cadastrados</dt><dd>{processosDoCliente.length}</dd></div>
                        <div className="wide"><dt>Situação processual</dt><dd>{protocoloDoCliente ? `${protocoloDoCliente.fase_atual || "Encaminhamento pendente"} · Documentação ${protocoloDoCliente.documentacao_status || "pendente"}` : processosDoCliente.length ? "Processo judicial cadastrado" : "Sem protocolo ou processo"}</dd></div>
                      </dl>
                    </section>

                    <section className="ficha-info-group ficha-info-group-wide">
                      <header><span>03</span><h4>Endereço e observações</h4></header>
                      <dl className="ficha-details ficha-details-notes">
                        <div><dt>Endereço</dt><dd>{clienteAberto.endereco || "Não informado"}</dd></div>
                        <div><dt>Observações</dt><dd>{clienteAberto.observacoes || "Nenhuma observação cadastrada."}</dd></div>
                      </dl>
                    </section>
                  </div>
                </section>
              ) : null}

              {abaFicha === "processos" ? (
                <section className="ficha-section">
                  <div className="ficha-section-actions">
                    <h4>Processos do cliente</h4>
                    <div>
                      <button type="button" className="btn-secondary compact" onClick={() => editarProcesso()}>Adicionar processo</button>
                    </div>
                  </div>
                  {processosDoCliente.length === 0 ? <div className="empty-row">Nenhum processo cadastrado.</div> : (
                    <div className="clientes-table-wrap compact-table">
                      <table className="clientes-table">
                        <thead><tr><th>Processo</th><th>Réu</th><th>Banco</th><th>Situação</th><th>Fase</th><th>Resultado</th><th>Observações</th><th>Responsável</th><th>Ações</th></tr></thead>
                        <tbody>{processosDoCliente.map((processo) => (
                          <tr key={processo.id}>
                            <td>{processo.numero_processo || "Pendente"}</td>
                            <td>{processo.reu || processo.banco_reu || "—"}</td>
                            <td>{processo.banco_reu || "—"}</td>
                            <td><span className="table-chip">{processo.situacao || (processo.numero_processo ? "Protocolado" : "Pendente")}</span></td>
                            <td>{processo.fase_atual || "—"}</td>
                            <td>{processo.resultado || processo.status_judicial || "—"}</td>
                            <td>{processo.observacoes || "—"}</td>
                            <td>{processo.responsavel || "—"}</td>
                            <td><div className="table-actions"><button type="button" className="btn-secondary compact" onClick={() => editarProcesso(processo)}>Editar processo</button>{(processo.numero_processo || fichaInline) && onOpenProcess ? <button type="button" className="btn-secondary compact" onClick={() => onOpenProcess(processo.id)}>Abrir processo</button> : null}<button type="button" className="btn-secondary compact" onClick={() => abrirEmail(processo)}>E-mail</button></div></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {abaFicha === "atendimentos" ? (
                <section className="ficha-section">
                  <div className="ficha-section-actions"><h4>Atendimentos</h4><button type="button" className="btn-primary compact" onClick={() => editarAtendimento()}>Novo atendimento</button></div>
                  {atendimentosDoCliente.length === 0 ? <div className="empty-row">Nenhum atendimento cadastrado.</div> : (
                    <div className="document-list">
                      {atendimentosDoCliente.map((atendimento) => (
                        <article key={atendimento.id}>
                          <strong>{atendimento.canal} · {atendimento.tipo || "Atendimento"}</strong>
                          <span>{atendimento.descricao}</span>
                          <small>{formatarDataHora(`${atendimento.data}T${atendimento.hora || "00:00"}`)} · {atendimento.responsavel || "Responsável não informado"}{atendimento.processo_numero ? ` · Processo ${atendimento.processo_numero}` : ""}</small><button type="button" className="btn-secondary compact" onClick={() => editarAtendimento(atendimento)}>Editar atendimento</button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {abaFicha === "documentos" ? (
                <section className="ficha-section">
                  <div className="ficha-section-actions">
                    <h4>Documentos</h4>
                    <button type="button" className="btn-primary compact" onClick={() => setGeradorAberto(true)}>Gerar documento</button>
                  </div>
                  {documentosDoCliente.length === 0 ? <div className="empty-row">Nenhum documento vinculado por nome ou CPF.</div> : (
                    <div className="document-list">
                      {documentosDoCliente.map((documento) => (
                        <article key={documento.id}>
                          <strong>{documento.nome_documento}</strong>
                          <span>{documento.modelo_nome} · {documento.status || "gerado"}</span>
                          <small>{formatarDataHora(documento.created_at)} · {documento.responsavel_nome || "Responsável não informado"}</small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {abaFicha === "historico" ? (
                <section className="ficha-section">
                  <div className="ficha-section-actions"><h4>Histórico geral do cliente</h4><button type="button" className="btn-primary compact" onClick={() => setHistoricoFormAberto(true)}>Novo registro</button></div>
                  <div className="history-note">Reúne atendimentos, comunicações preparadas e documentos. Os andamentos processuais permanecem separados em suas próprias movimentações.</div>
                  {historicoDoCliente.length === 0 ? <div className="empty-row">Nenhum evento geral cadastrado.</div> : (
                    <div className="document-list">
                      {historicoDoCliente.map((evento) => (
                        <article key={evento.id}>
                          <strong>{evento.titulo}</strong>
                          <span>{evento.descricao}</span>
                          <small>{formatarDataHora(evento.data)} · {evento.responsavel || "Responsável não informado"}</small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}
              {(abaFicha === "resumo" || abaFicha === "historico") ? children : null}
            </div>
          </section>
          </div>
        ) : null}
      </div>

      {modalAberto ? (
        <div className="modal-backdrop" role="presentation">
          <FormSection as="form" className="cliente-modal" onSubmit={salvarCliente}>
            <header>
              <div>
                <span className="eyebrow">Cadastro de cliente</span>
                <h3>{clienteEditando ? "Editar cliente" : "Novo cliente"}</h3>
              </div>
              <button type="button" className="drawer-close" onClick={() => setModalAberto(false)} aria-label="Fechar">×</button>
            </header>
            <div className="cliente-required-note">Os campos marcados com <strong>*</strong> são de preenchimento obrigatório.</div>
            <div className="cliente-form-sections">
              <FormSection className="cliente-form-section">
                <h4>Dados gerais</h4>
                <FormGrid className="cliente-form-grid">
                  <FormField className="wide"><span>Nome completo *</span><Input required value={formulario.nome_completo} onChange={(e) => setFormulario((f) => ({ ...f, nome_completo: e.target.value }))} /></FormField>
                  <FormField><span>CPF</span><Input value={formulario.cpf} onChange={(e) => setFormulario((f) => ({ ...f, cpf: e.target.value }))} /></FormField>
                  <FormField><span>RG</span><Input value={formulario.rg} onChange={(e) => setFormulario((f) => ({ ...f, rg: e.target.value }))} /></FormField>
                  <FormField><span>Data de nascimento</span><Input type="date" value={formulario.data_nascimento} onChange={(e) => setFormulario((f) => ({ ...f, data_nascimento: e.target.value }))} /></FormField>
                </FormGrid>
              </FormSection>
              <FormSection className="cliente-form-section">
                <h4>Contato</h4>
                <FormGrid className="cliente-form-grid">
                  <FormField><span>Telefone</span><Input value={formulario.telefone} onChange={(e) => setFormulario((f) => ({ ...f, telefone: e.target.value }))} /></FormField>
                  <FormField><span>E-mail</span><Input type="email" value={formulario.email} onChange={(e) => setFormulario((f) => ({ ...f, email: e.target.value }))} /></FormField>
                  <FormField><span>Responsável</span><Input value={formulario.responsavel} onChange={(e) => setFormulario((f) => ({ ...f, responsavel: e.target.value }))} /></FormField>
                </FormGrid>
              </FormSection>
              <FormSection className="cliente-form-section">
                <h4>Endereço e arquivos</h4>
                <FormGrid className="cliente-form-grid">
                  <FormField><span>ID CRM</span><Input value={formulario.id_crm} onChange={(e) => setFormulario((f) => ({ ...f, id_crm: e.target.value }))} /></FormField>
                  <FormField className="wide"><span>Link da pasta no Drive</span><Input value={formulario.link_pasta_cliente} onChange={(e) => setFormulario((f) => ({ ...f, link_pasta_cliente: e.target.value }))} placeholder="https://drive.google.com/..." /></FormField>
                  <FormField className="wide"><span>Endereço</span><Input value={formulario.endereco} onChange={(e) => setFormulario((f) => ({ ...f, endereco: e.target.value }))} /></FormField>
                </FormGrid>
              </FormSection>
              <FormSection className="cliente-form-section">
                <h4>Observações</h4>
                <FormGrid className="cliente-form-grid">
                  <FormField className="wide"><span>Observações</span><Textarea rows={4} value={formulario.observacoes} onChange={(e) => setFormulario((f) => ({ ...f, observacoes: e.target.value }))} /></FormField>
                </FormGrid>
              </FormSection>
            </div>
            <FormActions>
              <button type="button" className="btn-secondary" onClick={() => setModalAberto(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar cliente"}</button>
            </FormActions>
          </FormSection>
        </div>
      ) : null}

      {geradorAberto && clienteAberto ? (
        <div className="modal-backdrop document-generator-modal" role="presentation">
          <section className="document-generator-shell">
            <button type="button" className="drawer-close" onClick={() => setGeradorAberto(false)} aria-label="Fechar">×</button>
            <Suspense fallback={<div className="empty-row">Carregando gerador de documentos...</div>}>
              <GeradorDocumentos
                usuario={usuario}
                responsavel={usuario.nome}
                contextoDocumento={contextoDocumentoCliente()}
                onDocumentoGerado={registrarDocumentoGerado}
                onSuccess={avisar}
              />
            </Suspense>
          </section>
        </div>
      ) : null}

      {processoFormAberto && clienteAberto ? <div className="modal-backdrop"><FormSection as="form" className="cliente-modal entidade-modal" onSubmit={salvarProcessoCliente}><header><div><span className="eyebrow">Processo do cliente</span><h3>{processoForm.id ? "Editar processo" : "Adicionar processo"}</h3></div><button type="button" className="drawer-close" onClick={() => setProcessoFormAberto(false)}>×</button></header><FormGrid className="cliente-form-grid"><FormField className="wide"><span>Número CNJ</span><Input value={processoForm.numero_processo} onChange={(e) => setProcessoForm((f) => ({ ...f, numero_processo: e.target.value }))} placeholder="Pode ser incluído posteriormente" /></FormField><FormField><span>Réu</span><Input value={processoForm.reu} onChange={(e) => setProcessoForm((f) => ({ ...f, reu: e.target.value }))} /></FormField><FormField><span>Banco</span><Input value={processoForm.banco_reu} onChange={(e) => setProcessoForm((f) => ({ ...f, banco_reu: e.target.value }))} /></FormField><FormField><span>Ação</span><Input value={processoForm.tipo_acao} onChange={(e) => setProcessoForm((f) => ({ ...f, tipo_acao: e.target.value }))} /></FormField><FormField><span>Tribunal</span><Input value={processoForm.tribunal} onChange={(e) => setProcessoForm((f) => ({ ...f, tribunal: e.target.value }))} /></FormField><FormField><span>Comarca</span><Input value={processoForm.comarca} onChange={(e) => setProcessoForm((f) => ({ ...f, comarca: e.target.value }))} /></FormField><FormField><span>Vara/Juízo</span><Input value={processoForm.vara} onChange={(e) => setProcessoForm((f) => ({ ...f, vara: e.target.value }))} /></FormField><FormField><span>Distribuição</span><Input type="date" value={processoForm.data_distribuicao} onChange={(e) => setProcessoForm((f) => ({ ...f, data_distribuicao: e.target.value }))} /></FormField><FormField><span>Responsável</span><Input value={processoForm.responsavel} onChange={(e) => setProcessoForm((f) => ({ ...f, responsavel: e.target.value }))} /></FormField><FormField><span>Situação</span><Input value={processoForm.situacao} onChange={(e) => setProcessoForm((f) => ({ ...f, situacao: e.target.value }))} /></FormField><FormField className="wide"><span>Observações</span><Textarea rows={3} value={processoForm.observacoes} onChange={(e) => setProcessoForm((f) => ({ ...f, observacoes: e.target.value }))} /></FormField></FormGrid><FormActions><button type="button" className="btn-secondary" onClick={() => setProcessoFormAberto(false)}>Cancelar</button><button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar processo"}</button></FormActions></FormSection></div> : null}

      {atendimentoFormAberto && clienteAberto ? <div className="modal-backdrop"><FormSection as="form" className="cliente-modal entidade-modal" onSubmit={salvarAtendimentoCliente}><header><div><span className="eyebrow">Contato com cliente</span><h3>{atendimentoForm.id ? "Editar atendimento" : "Novo atendimento"}</h3></div><button type="button" className="drawer-close" onClick={() => setAtendimentoFormAberto(false)}>×</button></header><FormGrid className="cliente-form-grid"><FormField><span>Tipo</span><Input value={atendimentoForm.tipo} onChange={(e) => setAtendimentoForm((f) => ({ ...f, tipo: e.target.value }))} /></FormField><FormField><span>Canal</span><Input value={atendimentoForm.canal} onChange={(e) => setAtendimentoForm((f) => ({ ...f, canal: e.target.value }))} /></FormField><FormField><span>Data</span><Input type="date" value={atendimentoForm.data} onChange={(e) => setAtendimentoForm((f) => ({ ...f, data: e.target.value }))} /></FormField><FormField><span>Horário</span><Input type="time" value={atendimentoForm.hora} onChange={(e) => setAtendimentoForm((f) => ({ ...f, hora: e.target.value }))} /></FormField><FormField><span>Responsável</span><Input value={atendimentoForm.responsavel} onChange={(e) => setAtendimentoForm((f) => ({ ...f, responsavel: e.target.value }))} /></FormField><FormField className="wide"><span>Assunto e observações *</span><Textarea required rows={4} value={atendimentoForm.descricao} onChange={(e) => setAtendimentoForm((f) => ({ ...f, descricao: e.target.value }))} /></FormField></FormGrid><FormActions><button type="button" className="btn-secondary" onClick={() => setAtendimentoFormAberto(false)}>Cancelar</button><button type="submit" className="btn-primary">Salvar atendimento</button></FormActions></FormSection></div> : null}

      {historicoFormAberto && clienteAberto ? <div className="modal-backdrop"><FormSection as="form" className="cliente-modal entidade-modal" onSubmit={salvarHistoricoCliente}><header><div><span className="eyebrow">Histórico do cliente</span><h3>Novo registro</h3></div><button type="button" className="drawer-close" onClick={() => setHistoricoFormAberto(false)}>×</button></header><FormGrid className="cliente-form-grid"><FormField className="wide"><span>Descrição *</span><Textarea required rows={6} value={historicoDescricao} onChange={(e) => setHistoricoDescricao(e.target.value)} /></FormField></FormGrid><FormActions><button type="button" className="btn-secondary" onClick={() => setHistoricoFormAberto(false)}>Cancelar</button><button type="submit" className="btn-primary">Salvar no histórico</button></FormActions></FormSection></div> : null}

      {emailAberto && clienteAberto ? (
        <Suspense fallback={<div className="modal-backdrop"><section className="cliente-modal"><div className="empty-row">Carregando compositor de e-mail...</div></section></div>}>
          <EmailComposer
            cliente={clienteAberto}
            processos={processosDoCliente}
            processoInicial={processoEmail}
            usuario={usuario}
            onClose={() => setEmailAberto(false)}
            onRegistrado={registrarAtendimentoEmail}
            showToast={avisar}
          />
        </Suspense>
      ) : null}

      {analisadorAberto && clienteAberto ? (
        <Suspense fallback={<div className="modal-backdrop"><section className="cliente-modal"><div className="empty-row">Carregando analisador...</div></section></div>}>
          <ContentAnalyzer
            cliente={clienteAberto}
            processos={processosDoCliente}
            usuario={usuario}
            onClose={() => setAnalisadorAberto(false)}
            onRegistrado={registrarAtendimentoEmail}
            showToast={avisar}
          />
        </Suspense>
      ) : null}

      {importacaoAberta ? (
        <div className="modal-backdrop" role="presentation">
          <section className="cliente-modal importacao-modal">
            <header><div><span className="eyebrow">Importação temporária</span><h3>Importar clientes</h3></div><button type="button" className="drawer-close" onClick={() => setImportacaoAberta(false)} aria-label="Fechar">×</button></header>
            {importacaoCarregando ? <div className="empty-row">Validando sessão e preparando prévia...</div> : (
              <>
                <div className="importacao-resumo"><span>Total válido: <strong>{importacaoResultado.length}</strong></span><span>Novos: <strong>{importacaoResultado.filter((item) => item.status === "novo").length}</strong></span><span>Já existentes: <strong>{importacaoResultado.filter((item) => item.status === "existente").length}</strong></span><span>Possíveis duplicidades/erros: <strong>{importacaoResultado.filter((item) => item.status === "possivel").length}</strong></span></div>
                <div className="importacao-lista">{importacaoResultado.filter((item) => item.status !== "existente").slice(0, 80).map((item) => <div key={item.nome_completo}><strong>{item.nome_completo}</strong><small>{item.status === "novo" ? "Será cadastrado" : item.motivo}</small></div>)}</div>
                <FormActions><button type="button" className="btn-secondary" onClick={() => setImportacaoAberta(false)}>Cancelar</button><button type="button" className="btn-primary" disabled={importacaoExecutando || !importacaoResultado.some((item) => item.status === "novo")} onClick={executarImportacao}>{importacaoExecutando ? "Cadastrando..." : "Confirmar importação"}</button></FormActions>
              </>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
