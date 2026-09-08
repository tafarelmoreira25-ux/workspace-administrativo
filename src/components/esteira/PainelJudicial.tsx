import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import GeradorDocumentos from "../../GeradorDocumentos";
import {
  type FaseProcessual,
  type MovimentacaoProcessual,
  type Processo,
} from "../../lib/esteiraProcessual";

type Props = {
  processos: Processo[];
  onProcessoAtualizado: (processo: Processo) => void;
  showToast: (mensagem: string) => void;
  usuario?: { nome?: string; email?: string };
};

type TarefaProcessual = {
  id: string;
  titulo: string;
  descricao?: string | null;
  cliente_nome?: string | null;
  processo_numero?: string | null;
  tipo: string;
  data: string;
  horario?: string | null;
  responsavel?: string | null;
  prioridade: string;
  status: string;
  lembrete?: string | null;
  observacao?: string | null;
};

type AtendimentoProcessual = {
  id: string;
  cliente_nome: string;
  processo_numero?: string | null;
  data: string;
  hora?: string | null;
  canal: string;
  tipo?: string | null;
  descricao: string;
  responsavel?: string | null;
  anexo_url?: string | null;
};

type DocumentoProcessual = {
  id: string;
  cliente_id?: string | null;
  processo_id?: string | null;
  nome_documento: string;
  modelo_nome: string;
  tipo_documento?: string | null;
  cliente_nome?: string | null;
  numero_processo?: string | null;
  versao?: number | null;
  status?: string | null;
  assinado?: boolean | null;
  responsavel_nome?: string | null;
  created_at?: string | null;
  comunicado_em?: string | null;
  comunicado_canal?: string | null;
};

const SITUACOES = ["Pendente de protocolo", "Em andamento", "Suspenso / Sobrestado", "Encerrado"];
const FASES_JUDICIAIS = [
  "Pré-ajuizamento",
  "Distribuição",
  "Petição inicial",
  "Análise inicial",
  "Emenda",
  "Citação",
  "Contestação",
  "Réplica",
  "Instrução",
  "Audiência",
  "Conclusos",
  "Sentença",
  "Fase recursal",
  "Cumprimento",
  "Execução",
  "Trânsito em julgado",
  "Baixa",
  "Arquivado",
];
const RESULTADOS = [
  "Sem julgamento",
  "Procedente",
  "Parcialmente procedente",
  "Improcedente",
  "Extinto sem resolução do mérito",
  "Extinto com resolução do mérito",
  "Acordo homologado",
  "Cancelamento da distribuição",
  "Outro",
];
const JUSTICA_GRATUITA = ["Não analisada", "Deferida", "Indeferida"];
const EMENDA = ["Não solicitada", "Solicitada", "Pendente", "Juntada", "Prazo decorrido", "Não se aplica"];
const SIM_NAO = ["Todos", "Sim", "Não"];
const ABAS_FICHA = ["Resumo", "Histórico", "Movimentações", "Tarefas e Prazos", "Atendimentos", "Documentos", "Ocorrências", "Relatórios", "Auditoria"];
const CATEGORIAS_TIMELINE = [
  "Movimentação processual",
  "Atendimento",
  "Tarefa",
  "Prazo",
  "Documento",
  "Custas",
  "Ocorrência",
  "Protocolo",
  "Alteração cadastral",
  "Relatório",
  "Sistema",
];
const FILTROS_TIMELINE = ["Todos", "Processo", "Atendimentos", "Tarefas", "Documentos", "Custas", "Ocorrências", "Relatórios"];
const IMPORTANCIAS = ["Normal", "Relevante", "Crítico"];
const FONTES_ORIGEM = ["Manual", "PJe", "e-SAJ", "Projudi", "Eproc", "Diário oficial", "Cliente", "Elite", "Outro"];
const TIPOS_TAREFA = ["Contato cliente", "Revisar processo", "Verificar protocolo", "Cobrar assinatura", "Solicitar documento", "Custas", "Reunião", "Audiência", "Prazo processual", "Tarefa interna", "Outro"];
const PRIORIDADES_TAREFA = ["Baixa", "Normal", "Alta", "Crítica"];
const STATUS_TAREFA = ["Pendente", "Em andamento", "Concluída", "Cancelada", "Atrasada"];
const CANAIS_ATENDIMENTO = ["WhatsApp", "Telefone", "E-mail", "Reunião", "Presencial", "Outro"];
const STATUS_DOCUMENTO = ["Gerado", "Aguardando assinatura", "Assinado", "Anexado", "Enviado", "Substituído", "Cancelado"];

function criarMovimentacaoForm() {
  return {
    data: new Date().toISOString().slice(0, 16),
    categoria: "Movimentação processual",
    titulo: "",
    descricao_tecnica: "",
    resumo_cliente: "",
    fonte: "Manual",
    link: "",
    importancia: "Normal",
    anexo_url: "",
    proxima_providencia: "",
    proxima_revisao: "",
    criar_tarefa_relacionada: false,
  };
}

function criarTarefaForm(responsavel = "") {
  return {
    titulo: "",
    descricao: "",
    tipo: "Revisar processo",
    data: new Date().toISOString().slice(0, 10),
    horario: "",
    responsavel,
    prioridade: "Normal",
    status: "Pendente",
    lembrete: "",
    observacao: "",
  };
}

function criarAtendimentoForm(responsavel = "") {
  return {
    data: new Date().toISOString().slice(0, 10),
    hora: new Date().toTimeString().slice(0, 5),
    canal: "WhatsApp",
    tipo: "Contato cliente",
    descricao: "",
    responsavel,
    anexo_url: "",
  };
}

function normalizar(valor = "") {
  return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function formatarData(data?: string | Date | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

function formatarDataHora(data?: string | Date | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data));
}

function formatarDataInput(data = new Date()) {
  return data.toISOString().slice(0, 10);
}

function somarDias(data: Date, dias: number) {
  const proxima = new Date(data);
  proxima.setDate(proxima.getDate() + dias);
  return proxima;
}

function calcularAlertaRevisao(processo?: Processo | null) {
  if (!processo?.ultima_revisao) {
    return { classe: "critica", rotulo: "Sem revisão interna registrada", dias: null as number | null };
  }

  const ultima = new Date(processo.ultima_revisao);
  if (Number.isNaN(ultima.getTime())) {
    return { classe: "critica", rotulo: "Revisão inválida", dias: null as number | null };
  }

  const hoje = new Date();
  ultima.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.max(0, Math.floor((hoje.getTime() - ultima.getTime()) / 86400000));

  if (dias >= 90) return { classe: "critica", rotulo: `Crítica: ${dias} dias sem revisão`, dias };
  if (dias >= 60) return { classe: "alta", rotulo: `Alta: ${dias} dias sem revisão`, dias };
  if (dias >= 30) return { classe: "atencao", rotulo: `Atenção: ${dias} dias sem revisão`, dias };
  return { classe: "ok", rotulo: `Revisado há ${dias} dias`, dias };
}

function categoriaPorFiltro(filtro: string) {
  const mapa: Record<string, string[]> = {
    Processo: ["Movimentação processual", "Protocolo", "Sistema", "Alteração cadastral"],
    Atendimentos: ["Atendimento"],
    Tarefas: ["Tarefa", "Prazo"],
    Documentos: ["Documento"],
    Custas: ["Custas"],
    "Ocorrências": ["Ocorrência"],
    "Relatórios": ["Relatório"],
  };
  return mapa[filtro] || [];
}

function situacaoDoProcesso(processo: Processo) {
  if (processo.situacao) return processo.situacao;
  if (!processo.numero_processo) return "Pendente de protocolo";
  if (["Arquivado", "Improcedente"].includes(processo.fase_atual || "")) return "Encerrado";
  return "Em andamento";
}

function faseDoProcesso(processo: Processo) {
  return processo.fase_judicial || processo.fase_atual || "Pré-ajuizamento";
}

function resultadoDoProcesso(processo: Processo) {
  return processo.resultado || processo.status_judicial || "Sem julgamento";
}

function boolFiltro(valor: boolean | null | undefined, filtro: string) {
  if (filtro === "Todos") return true;
  return filtro === "Sim" ? Boolean(valor) : !valor;
}

function criarFicha(processo: Processo | null, responsavel = "") {
  return {
    cliente_id: processo?.cliente_id || "",
    nome_cliente: processo?.nome_cliente || "",
    cpf_cliente: processo?.cpf_cliente || "",
    id_crm: processo?.id_crm || processo?.pasta_cliente_id || "",
    link_pasta_cliente: processo?.link_pasta_cliente || "",
    autor: processo?.autor || processo?.nome_cliente || "",
    reu: processo?.reu || processo?.banco_reu || "",
    banco_reu: processo?.banco_reu || "",
    produto: processo?.produto || "",
    numero_contrato: processo?.numero_contrato || "",
    numero_processo: processo?.numero_processo || "",
    data_distribuicao: processo?.data_distribuicao || "",
    tribunal: processo?.tribunal || "",
    comarca: processo?.comarca || "",
    vara: processo?.vara || "",
    tipo_acao: processo?.tipo_acao || "",
    link_consulta: processo?.link_consulta || processo?.link_processo || "",
    responsavel: processo?.responsavel || responsavel,
    situacao: situacaoDoProcesso(processo || ({} as Processo)),
    fase_judicial: faseDoProcesso(processo || ({} as Processo)),
    resultado: resultadoDoProcesso(processo || ({} as Processo)),
    justica_gratuita: processo?.justica_gratuita || "Não analisada",
    emenda_status: processo?.emenda_status || processo?.emenda_inicial || "Não solicitada",
    observacoes: processo?.observacoes || "",
    proximo_prazo: processo?.proximo_prazo || "",
    ultima_revisao: processo?.ultima_revisao || "",
    proxima_revisao: processo?.proxima_revisao || "",
    custas_status: processo?.custas_status || "Não informado",
    com_pendencia: Boolean(processo?.com_pendencia),
    pasta_retornada: Boolean(processo?.pasta_retornada),
    sem_revisao: Boolean(processo?.sem_revisao),
    recursal: Boolean(processo?.recursal),
  };
}

function limpar(valor: string) {
  const texto = valor.trim();
  return texto || null;
}

function badgeClass(valor: string) {
  if (["Encerrado", "Arquivado", "Improcedente"].includes(valor)) return "encerrado";
  if (["Pendente de protocolo", "Pendente", "Solicitada", "Prazo decorrido"].includes(valor)) return "pendente";
  if (["Suspenso / Sobrestado", "Fase recursal"].includes(valor)) return "alerta";
  return "andamento";
}

export default function PainelJudicial({
  processos,
  onProcessoAtualizado,
  showToast,
  usuario,
}: Props) {
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState({
    situacao: "Todos",
    fase: "Todos",
    resultado: "Todos",
    banco: "Todos",
    responsavel: "Todos",
    justica: "Todos",
    emenda: "Todos",
    comPendencia: "Todos",
    custas: "Todos",
    pastaRetornada: "Todos",
    semRevisao: "Todos",
    encerrado: "Todos",
    recursal: "Todos",
  });
  const [processoAberto, setProcessoAberto] = useState<Processo | null>(null);
  const [modalCadastro, setModalCadastro] = useState(false);
  const [ficha, setFicha] = useState(criarFicha(null, usuario?.nome || ""));
  const [abaFicha, setAbaFicha] = useState("Resumo");
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoProcessual[]>([]);
  const [tarefasProcesso, setTarefasProcesso] = useState<TarefaProcessual[]>([]);
  const [atendimentosProcesso, setAtendimentosProcesso] = useState<AtendimentoProcessual[]>([]);
  const [documentosProcesso, setDocumentosProcesso] = useState<DocumentoProcessual[]>([]);
  const [auditoria, setAuditoria] = useState<Array<{ id: string; campo: string; valor_anterior: string; valor_novo: string; usuario: string; created_at: string }>>([]);
  const [movimentacaoForm, setMovimentacaoForm] = useState(criarMovimentacaoForm);
  const [tarefaForm, setTarefaForm] = useState(() => criarTarefaForm(usuario?.nome || ""));
  const [atendimentoForm, setAtendimentoForm] = useState(() => criarAtendimentoForm(usuario?.nome || ""));
  const [timelineFiltro, setTimelineFiltro] = useState("Todos");
  const [revisaoObservacao, setRevisaoObservacao] = useState("");
  const [geradorAberto, setGeradorAberto] = useState(false);
  const [contextoGerador, setContextoGerador] = useState<Record<string, unknown> | null>(null);
  const [comunicandoDocumento, setComunicandoDocumento] = useState<DocumentoProcessual | null>(null);
  const [comunicacaoCanal, setComunicacaoCanal] = useState("WhatsApp");
  const [comunicacaoObservacao, setComunicacaoObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const bancos = useMemo(() => ["Todos", ...Array.from(new Set(processos.map((p) => p.banco_reu).filter(Boolean))) as string[]], [processos]);
  const responsaveis = useMemo(() => ["Todos", ...Array.from(new Set(processos.map((p) => p.responsavel).filter(Boolean))) as string[]], [processos]);
  const custas = useMemo(() => ["Todos", ...Array.from(new Set(processos.map((p) => p.custas_status).filter(Boolean))) as string[]], [processos]);

  const processosFiltrados = useMemo(() => {
    const termo = normalizar(busca);
    return processos.filter((processo) => {
      const situacao = situacaoDoProcesso(processo);
      const fase = faseDoProcesso(processo);
      const resultado = resultadoDoProcesso(processo);
      const encerrado = situacao === "Encerrado";
      const recursal = Boolean(processo.recursal || fase === "Fase recursal");
      const semRevisao = Boolean(processo.sem_revisao || !processo.ultima_revisao);
      const textoBusca = normalizar([
        processo.nome_cliente,
        processo.cpf_cliente,
        processo.id_crm,
        processo.pasta_cliente_id,
        processo.numero_processo,
        processo.banco_reu,
        processo.autor_reu,
      ].join(" "));

      return (!termo || textoBusca.includes(termo)) &&
        (filtros.situacao === "Todos" || situacao === filtros.situacao) &&
        (filtros.fase === "Todos" || fase === filtros.fase) &&
        (filtros.resultado === "Todos" || resultado === filtros.resultado) &&
        (filtros.banco === "Todos" || processo.banco_reu === filtros.banco) &&
        (filtros.responsavel === "Todos" || processo.responsavel === filtros.responsavel) &&
        (filtros.justica === "Todos" || processo.justica_gratuita === filtros.justica) &&
        (filtros.emenda === "Todos" || processo.emenda_status === filtros.emenda || processo.emenda_inicial === filtros.emenda) &&
        boolFiltro(processo.com_pendencia, filtros.comPendencia) &&
        (filtros.custas === "Todos" || processo.custas_status === filtros.custas) &&
        boolFiltro(processo.pasta_retornada, filtros.pastaRetornada) &&
        boolFiltro(semRevisao, filtros.semRevisao) &&
        boolFiltro(encerrado, filtros.encerrado) &&
        boolFiltro(recursal, filtros.recursal);
    });
  }, [busca, filtros, processos]);

  useEffect(() => {
    setFicha(criarFicha(processoAberto, usuario?.nome || ""));
    setAbaFicha("Resumo");
    setTimelineFiltro("Todos");
    setMovimentacaoForm(criarMovimentacaoForm());
    setTarefaForm(criarTarefaForm(usuario?.nome || ""));
    setAtendimentoForm(criarAtendimentoForm(usuario?.nome || ""));
    setRevisaoObservacao("");
    if (!processoAberto) {
      setMovimentacoes([]);
      setTarefasProcesso([]);
      setAtendimentosProcesso([]);
      setDocumentosProcesso([]);
      setAuditoria([]);
      return;
    }

    let ativo = true;
    async function carregarDetalhes() {
      const [movs, audit, tarefas, atendimentos, documentos] = await Promise.allSettled([
        supabase.from("movimentacoes").select("*").eq("processo_id", processoAberto.id).order("data_registro", { ascending: false }),
        supabase.from("processos_auditoria").select("*").eq("processo_id", processoAberto.id).order("created_at", { ascending: false }),
        supabase.from("processual_tarefas").select("*").eq("processo_id", processoAberto.id).order("data", { ascending: true }),
        supabase.from("processual_atendimentos").select("*").eq("processo_id", processoAberto.id).order("data", { ascending: false }),
        supabase.from("documentos_juridicos").select("*").eq("processo_id", processoAberto.id).order("created_at", { ascending: false }),
      ]);

      if (!ativo) return;
      if (movs.status === "fulfilled" && !movs.value.error) {
        setMovimentacoes(((movs.value.data || []) as MovimentacaoProcessual[]).filter((mov) => !mov.deleted_at));
      }
      if (audit.status === "fulfilled" && !audit.value.error) setAuditoria((audit.value.data || []) as typeof auditoria);
      if (tarefas.status === "fulfilled" && !tarefas.value.error) setTarefasProcesso((tarefas.value.data || []) as TarefaProcessual[]);
      if (atendimentos.status === "fulfilled" && !atendimentos.value.error) setAtendimentosProcesso((atendimentos.value.data || []) as AtendimentoProcessual[]);
      if (documentos.status === "fulfilled" && !documentos.value.error) setDocumentosProcesso((documentos.value.data || []) as DocumentoProcessual[]);
    }

    carregarDetalhes();
    return () => { ativo = false; };
  }, [processoAberto, usuario?.nome]);

  function abrirCadastroExistente() {
    setProcessoAberto(null);
    setFicha(criarFicha(null, usuario?.nome || ""));
    setModalCadastro(true);
  }

  function abrirFicha(processo: Processo) {
    setProcessoAberto(processo);
    setModalCadastro(false);
  }

  async function salvarProcesso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!ficha.nome_cliente.trim()) {
      showToast("Informe o cliente.");
      return;
    }
    if (modalCadastro && !ficha.numero_processo.trim()) {
      showToast("Informe o Número CNJ do processo existente.");
      return;
    }

    const payload = {
      cliente_id: limpar(ficha.cliente_id),
      nome_cliente: ficha.nome_cliente.trim(),
      cpf_cliente: limpar(ficha.cpf_cliente),
      id_crm: limpar(ficha.id_crm),
      pasta_cliente_id: limpar(ficha.id_crm),
      link_pasta_cliente: limpar(ficha.link_pasta_cliente),
      autor: limpar(ficha.autor) || ficha.nome_cliente.trim(),
      reu: limpar(ficha.reu) || limpar(ficha.banco_reu),
      banco_reu: limpar(ficha.banco_reu),
      autor_reu: `${limpar(ficha.autor) || ficha.nome_cliente.trim()} X ${limpar(ficha.reu) || limpar(ficha.banco_reu) || "Réu não informado"}`,
      produto: limpar(ficha.produto),
      numero_contrato: limpar(ficha.numero_contrato),
      numero_processo: limpar(ficha.numero_processo),
      data_distribuicao: ficha.data_distribuicao || null,
      tribunal: limpar(ficha.tribunal),
      comarca: limpar(ficha.comarca),
      vara: limpar(ficha.vara),
      tipo_acao: limpar(ficha.tipo_acao),
      link_consulta: limpar(ficha.link_consulta),
      link_processo: limpar(ficha.link_consulta),
      responsavel: limpar(ficha.responsavel) || usuario?.nome || null,
      situacao: ficha.situacao,
      fase_judicial: ficha.fase_judicial,
      fase_atual: ficha.fase_judicial as FaseProcessual,
      resultado: ficha.resultado,
      status_judicial: ficha.resultado,
      justica_gratuita: ficha.justica_gratuita,
      emenda_status: ficha.emenda_status,
      emenda_inicial: ficha.emenda_status,
      observacoes: limpar(ficha.observacoes),
      proximo_prazo: ficha.proximo_prazo || null,
      ultima_revisao: ficha.ultima_revisao || null,
      proxima_revisao: ficha.proxima_revisao || null,
      custas_status: limpar(ficha.custas_status),
      com_pendencia: ficha.com_pendencia,
      pasta_retornada: ficha.pasta_retornada,
      sem_revisao: ficha.sem_revisao,
      recursal: ficha.recursal || ficha.fase_judicial === "Fase recursal",
      protocolo_status: ficha.numero_processo.trim() ? "Liberado" : "Aguardando",
      origem_registro: processoAberto?.origem_registro || "processo_legado_migracao",
      updated_by: usuario?.email || usuario?.nome || null,
    };

    setSalvando(true);
    const query = processoAberto
      ? supabase.from("processos").update(payload).eq("id", processoAberto.id)
      : supabase.from("processos").insert({ ...payload, created_by: usuario?.email || usuario?.nome || null });
    const { data, error } = await query.select("*").single();
    setSalvando(false);

    if (error) {
      showToast(`Não foi possível salvar o processo: ${error.message}`);
      return;
    }

    const salvo = data as Processo;
    onProcessoAtualizado(salvo);
    setProcessoAberto(salvo);
    setModalCadastro(false);
    showToast(processoAberto ? "Processo atualizado." : "Processo existente cadastrado.");
  }

  async function adicionarMovimentacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!processoAberto) return;
    const titulo = movimentacaoForm.titulo.trim();
    const descricaoTecnica = movimentacaoForm.descricao_tecnica.trim();
    if (!titulo || !descricaoTecnica) {
      showToast("Informe o título e a descrição técnica da movimentação.");
      return;
    }

    const dataRegistro = new Date(movimentacaoForm.data || new Date()).toISOString();
    const payload = {
      processo_id: processoAberto.id,
      data_registro: dataRegistro,
      descricao: descricaoTecnica,
      tipo: movimentacaoForm.categoria === "Movimentação processual" ? "movimentacao_judicial" : normalizar(movimentacaoForm.categoria).replace(/\s+/g, "_"),
      categoria: movimentacaoForm.categoria,
      titulo,
      descricao_tecnica: descricaoTecnica,
      resumo_cliente: limpar(movimentacaoForm.resumo_cliente),
      responsavel: limpar(ficha.responsavel) || usuario?.nome || null,
      fonte: movimentacaoForm.fonte,
      link: limpar(movimentacaoForm.link),
      importancia: movimentacaoForm.importancia,
      anexo_url: limpar(movimentacaoForm.anexo_url),
      proxima_providencia: limpar(movimentacaoForm.proxima_providencia),
      proxima_revisao: movimentacaoForm.proxima_revisao || null,
      criar_tarefa_relacionada: movimentacaoForm.criar_tarefa_relacionada,
      origem: "manual",
      created_by_nome: usuario?.nome || usuario?.email || null,
    };

    setSalvando(true);
    const { data, error } = await supabase
      .from("movimentacoes")
      .insert(payload)
      .select("*")
      .single();
    setSalvando(false);

    if (error) {
      showToast(`Não foi possível registrar a movimentação: ${error.message}`);
      return;
    }

    setMovimentacoes((atuais) => [data as MovimentacaoProcessual, ...atuais]);
    const atualizacaoProcesso: Partial<Processo> = {};
    if (movimentacaoForm.categoria === "Movimentação processual") {
      atualizacaoProcesso.ultima_movimentacao = titulo;
      atualizacaoProcesso.ultima_movimentacao_data = dataRegistro;
    }
    if (movimentacaoForm.proxima_revisao) {
      atualizacaoProcesso.proxima_revisao = movimentacaoForm.proxima_revisao;
    }
    if (Object.keys(atualizacaoProcesso).length > 0) {
      await supabase.from("processos").update(atualizacaoProcesso).eq("id", processoAberto.id);
      const atualizado = { ...processoAberto, ...atualizacaoProcesso };
      setProcessoAberto(atualizado);
      onProcessoAtualizado(atualizado);
    }
    setMovimentacaoForm(criarMovimentacaoForm());
    showToast("Movimentação registrada.");
  }

  async function registrarRevisaoInterna() {
    if (!processoAberto) return;
    const agora = new Date();
    const proximaRevisao = formatarDataInput(somarDias(agora, 30));
    const observacao = revisaoObservacao.trim();
    const payloadMovimentacao = {
      processo_id: processoAberto.id,
      data_registro: agora.toISOString(),
      descricao: observacao || "Revisão interna do processo realizada.",
      tipo: "revisao_interna",
      categoria: "Sistema",
      titulo: "Revisão interna",
      descricao_tecnica: observacao || "Revisão interna do processo realizada.",
      responsavel: usuario?.nome || ficha.responsavel || null,
      fonte: "Manual",
      importancia: "Normal",
      origem: "manual",
      proxima_revisao: proximaRevisao,
      created_by_nome: usuario?.nome || usuario?.email || null,
    };
    const atualizacaoProcesso = {
      ultima_revisao: formatarDataInput(agora),
      ultima_revisao_em: agora.toISOString(),
      ultima_revisao_por: usuario?.nome || usuario?.email || null,
      ultima_revisao_observacao: observacao || null,
      proxima_revisao: proximaRevisao,
      sem_revisao: false,
    };

    setSalvando(true);
    const [movimento, processo] = await Promise.all([
      supabase.from("movimentacoes").insert(payloadMovimentacao).select("*").single(),
      supabase.from("processos").update(atualizacaoProcesso).eq("id", processoAberto.id).select("*").single(),
    ]);
    setSalvando(false);

    if (movimento.error || processo.error) {
      showToast(`Não foi possível registrar a revisão: ${(movimento.error || processo.error)?.message}`);
      return;
    }

    setMovimentacoes((atuais) => [movimento.data as MovimentacaoProcessual, ...atuais]);
    const atualizado = processo.data as Processo;
    setProcessoAberto(atualizado);
    setFicha(criarFicha(atualizado, usuario?.nome || ""));
    onProcessoAtualizado(atualizado);
    setRevisaoObservacao("");
    showToast("Revisão interna registrada.");
  }

  async function arquivarMovimentacao(movimentacao: MovimentacaoProcessual) {
    if (!processoAberto) return;
    setSalvando(true);
    const { error } = await supabase
      .from("movimentacoes")
      .update({ deleted_at: new Date().toISOString(), deleted_by: usuario?.nome || usuario?.email || null })
      .eq("id", movimentacao.id);
    setSalvando(false);

    if (error) {
      showToast(`Não foi possível arquivar o registro: ${error.message}`);
      return;
    }
    setMovimentacoes((atuais) => atuais.filter((item) => item.id !== movimentacao.id));
    showToast("Registro arquivado no histórico.");
  }

  async function criarTarefaProcesso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!processoAberto) return;
    if (!tarefaForm.titulo.trim()) {
      showToast("Informe o título da tarefa.");
      return;
    }

    const payload = {
      cliente_id: processoAberto.cliente_id || null,
      processo_id: processoAberto.id,
      cliente_nome: processoAberto.nome_cliente,
      processo_numero: processoAberto.numero_processo,
      titulo: tarefaForm.titulo.trim(),
      descricao: limpar(tarefaForm.descricao),
      tipo: tarefaForm.tipo,
      data: tarefaForm.data,
      horario: tarefaForm.horario || null,
      responsavel: limpar(tarefaForm.responsavel) || usuario?.nome || null,
      prioridade: tarefaForm.prioridade,
      status: tarefaForm.status,
      lembrete: limpar(tarefaForm.lembrete),
      observacao: limpar(tarefaForm.observacao),
      created_by_nome: usuario?.nome || usuario?.email || null,
    };

    setSalvando(true);
    const { data, error } = await supabase.from("processual_tarefas").insert(payload).select("*").single();
    if (!error) {
      await supabase.from("movimentacoes").insert({
        processo_id: processoAberto.id,
        categoria: "Tarefa",
        titulo: tarefaForm.titulo.trim(),
        descricao: tarefaForm.descricao.trim() || tarefaForm.titulo.trim(),
        descricao_tecnica: tarefaForm.descricao.trim() || tarefaForm.titulo.trim(),
        responsavel: payload.responsavel,
        fonte: "Manual",
        importancia: tarefaForm.prioridade === "Crítica" ? "Crítico" : tarefaForm.prioridade === "Alta" ? "Relevante" : "Normal",
        origem: "manual",
        created_by_nome: usuario?.nome || usuario?.email || null,
      });
    }
    setSalvando(false);

    if (error) {
      showToast(`Não foi possível criar a tarefa: ${error.message}`);
      return;
    }
    setTarefasProcesso((atuais) => [...atuais, data as TarefaProcessual]);
    setTarefaForm(criarTarefaForm(usuario?.nome || ""));
    showToast("Tarefa vinculada ao processo.");
  }

  async function atualizarStatusTarefaProcesso(tarefa: TarefaProcessual, status: string) {
    const { data, error } = await supabase.from("processual_tarefas").update({ status, updated_by_nome: usuario?.nome || usuario?.email || null }).eq("id", tarefa.id).select("*").single();
    if (error) {
      showToast("Não foi possível atualizar a tarefa.");
      return;
    }
    setTarefasProcesso((atuais) => atuais.map((item) => item.id === tarefa.id ? data as TarefaProcessual : item));
    if (status === "Concluída" && window.confirm("Tarefa concluída. Registrar atendimento agora?")) {
      setAbaFicha("Atendimentos");
      setAtendimentoForm((form) => ({
        ...form,
        descricao: `Atendimento relacionado à tarefa: ${tarefa.titulo}`,
        responsavel: tarefa.responsavel || usuario?.nome || "",
      }));
    }
  }

  async function criarAtendimentoProcesso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!processoAberto) return;
    if (!atendimentoForm.descricao.trim()) {
      showToast("Descreva o atendimento.");
      return;
    }

    const dataRegistro = new Date(`${atendimentoForm.data}T${atendimentoForm.hora || "00:00"}`).toISOString();
    const payload = {
      cliente_id: processoAberto.cliente_id || null,
      processo_id: processoAberto.id,
      cliente_nome: processoAberto.nome_cliente,
      processo_numero: processoAberto.numero_processo,
      data: atendimentoForm.data,
      hora: atendimentoForm.hora || null,
      canal: atendimentoForm.canal,
      tipo: limpar(atendimentoForm.tipo),
      descricao: atendimentoForm.descricao.trim(),
      responsavel: limpar(atendimentoForm.responsavel) || usuario?.nome || null,
      anexo_url: limpar(atendimentoForm.anexo_url),
      created_by_nome: usuario?.nome || usuario?.email || null,
    };

    setSalvando(true);
    const { data, error } = await supabase.from("processual_atendimentos").insert(payload).select("*").single();
    let movimentoCriado: MovimentacaoProcessual | null = null;
    if (!error) {
      const movimento = await supabase.from("movimentacoes").insert({
        processo_id: processoAberto.id,
        data_registro: dataRegistro,
        categoria: "Atendimento",
        titulo: `${atendimentoForm.canal} — ${atendimentoForm.tipo || "Atendimento"}`,
        descricao: atendimentoForm.descricao.trim(),
        descricao_tecnica: atendimentoForm.descricao.trim(),
        responsavel: payload.responsavel,
        fonte: atendimentoForm.canal,
        importancia: "Normal",
        anexo_url: payload.anexo_url,
        origem: "manual",
        created_by_nome: usuario?.nome || usuario?.email || null,
      }).select("*").single();
      if (!movimento.error) movimentoCriado = movimento.data as MovimentacaoProcessual;
    }
    setSalvando(false);

    if (error) {
      showToast(`Não foi possível registrar o atendimento: ${error.message}`);
      return;
    }
    setAtendimentosProcesso((atuais) => [data as AtendimentoProcessual, ...atuais]);
    if (movimentoCriado) setMovimentacoes((atuais) => [movimentoCriado, ...atuais]);
    setAtendimentoForm(criarAtendimentoForm(usuario?.nome || ""));
    showToast("Atendimento registrado no processo e na timeline.");
  }

  function contextoDocumentoProcesso() {
    if (!processoAberto) return null;
    return {
      cliente: {
        id: processoAberto.cliente_id,
        nome_completo: processoAberto.nome_cliente,
        cpf: processoAberto.cpf_cliente,
        link_pasta_cliente: processoAberto.link_pasta_cliente,
      },
      processo: processoAberto,
      departamento: "Processual",
      ...(contextoGerador || {}),
    };
  }

  function abrirGeradorDocumento(contextoExtra: Record<string, unknown> | null = null) {
    setContextoGerador(contextoExtra);
    setGeradorAberto(true);
  }

  async function registrarDocumentoGerado(resultado: { documentoRemoto?: DocumentoProcessual | null; modelo?: { nome?: string; modo?: string } }) {
    if (!processoAberto) return;
    const documento = resultado.documentoRemoto;
    if (documento) setDocumentosProcesso((atuais) => [documento, ...atuais.filter((item) => item.id !== documento.id)]);
    const modeloNome = resultado.modelo?.nome || documento?.modelo_nome || "Documento";
    const { data } = await supabase.from("movimentacoes").insert({
      processo_id: processoAberto.id,
      categoria: "Documento",
      titulo: `${modeloNome} gerado`,
      descricao: `${modeloNome} gerado por ${usuario?.nome || "usuário"}.`,
      descricao_tecnica: `${modeloNome} gerado e vinculado ao processo.`,
      responsavel: usuario?.nome || usuario?.email || null,
      fonte: "Gerador de Documentos",
      importancia: resultado.modelo?.modo === "procuracao" ? "Relevante" : "Normal",
      anexo_url: null,
      origem: "manual",
      created_by_nome: usuario?.nome || usuario?.email || null,
    }).select("*").single();
    if (data) setMovimentacoes((atuais) => [data as MovimentacaoProcessual, ...atuais]);
    showToast("Documento vinculado ao processo e registrado na timeline.");
  }

  async function atualizarStatusDocumento(documento: DocumentoProcessual, status: string, assinado = documento.assinado) {
    if (!processoAberto) return;
    const { data, error } = await supabase.from("documentos_juridicos").update({ status, assinado }).eq("id", documento.id).select("*").single();
    if (error) {
      showToast("Não foi possível atualizar o documento.");
      return;
    }
    const atualizado = data as DocumentoProcessual;
    setDocumentosProcesso((atuais) => atuais.map((item) => item.id === documento.id ? atualizado : item));
    if (status === "Assinado" && String(documento.tipo_documento || documento.modelo_nome || "").toLowerCase().includes("procur")) {
      const processoAtualizado = {
        ...processoAberto,
        procuracao_status: "Assinado",
        status_procuracao: "Assinado",
      };
      await supabase.from("processos").update({ procuracao_status: "Assinado", status_procuracao: "Assinado" }).eq("id", processoAberto.id);
      setProcessoAberto(processoAtualizado);
      onProcessoAtualizado(processoAtualizado);
    }
    await supabase.from("movimentacoes").insert({
      processo_id: processoAberto.id,
      categoria: "Documento",
      titulo: `Documento ${status.toLowerCase()}`,
      descricao: `${documento.nome_documento} marcado como ${status}.`,
      descricao_tecnica: `${documento.nome_documento} marcado como ${status}.`,
      responsavel: usuario?.nome || usuario?.email || null,
      fonte: "Documentos",
      importancia: status === "Assinado" ? "Relevante" : "Normal",
      origem: "manual",
      created_by_nome: usuario?.nome || usuario?.email || null,
    });
    showToast("Status do documento atualizado.");
  }

  async function marcarDocumentoComunicado() {
    if (!processoAberto || !comunicandoDocumento) return;
    const agora = new Date();
    const observacao = comunicacaoObservacao.trim() || `Documento comunicado: ${comunicandoDocumento.nome_documento}`;
    const { data, error } = await supabase.from("documentos_juridicos").update({
      comunicado_em: agora.toISOString(),
      comunicado_canal: comunicacaoCanal,
      comunicado_observacao: observacao,
    }).eq("id", comunicandoDocumento.id).select("*").single();
    if (!error) {
      const atendimento = await supabase.from("processual_atendimentos").insert({
        cliente_id: processoAberto.cliente_id || null,
        processo_id: processoAberto.id,
        cliente_nome: processoAberto.nome_cliente,
        processo_numero: processoAberto.numero_processo,
        data: agora.toISOString().slice(0, 10),
        hora: agora.toTimeString().slice(0, 5),
        canal: comunicacaoCanal,
        tipo: "Comunicação de documento",
        descricao: observacao,
        responsavel: usuario?.nome || usuario?.email || null,
        created_by_nome: usuario?.nome || usuario?.email || null,
      }).select("*").single();
      await supabase.from("movimentacoes").insert({
        processo_id: processoAberto.id,
        categoria: "Atendimento",
        titulo: `Documento comunicado por ${comunicacaoCanal}`,
        descricao: observacao,
        descricao_tecnica: observacao,
        responsavel: usuario?.nome || usuario?.email || null,
        fonte: comunicacaoCanal,
        importancia: "Normal",
        origem: "manual",
        created_by_nome: usuario?.nome || usuario?.email || null,
      });
      if (!atendimento.error) setAtendimentosProcesso((atuais) => [atendimento.data as AtendimentoProcessual, ...atuais]);
    }
    if (error) {
      showToast("Não foi possível registrar a comunicação.");
      return;
    }
    setDocumentosProcesso((atuais) => atuais.map((item) => item.id === comunicandoDocumento.id ? data as DocumentoProcessual : item));
    setComunicandoDocumento(null);
    setComunicacaoObservacao("");
    setComunicacaoCanal("WhatsApp");
    showToast("Comunicação registrada e atendimento criado.");
  }

  const fichaAberta = processoAberto || (modalCadastro ? ({} as Processo) : null);
  const ultimoRelatorio = documentosProcesso.find((documento) => normalizar(`${documento.tipo_documento || ""} ${documento.modelo_nome || ""} ${documento.nome_documento || ""}`).includes("relatorio"));
  const dataUltimoRelatorio = ultimoRelatorio?.created_at ? new Date(ultimoRelatorio.created_at) : null;
  const movimentacoesPosterioresRelatorio = dataUltimoRelatorio
    ? movimentacoes.filter((movimentacao) => new Date(movimentacao.data_registro) > dataUltimoRelatorio).length
    : movimentacoes.length;
  const resumoMovimentacoesRelatorio = movimentacoes
    .filter((movimentacao) => !dataUltimoRelatorio || new Date(movimentacao.data_registro) > dataUltimoRelatorio)
    .slice(0, 8)
    .map((movimentacao) => `- ${formatarDataHora(movimentacao.data_registro)}: ${movimentacao.titulo || movimentacao.descricao}`)
    .join("\n");

  return (
    <div className="painel-judicial processos-module">
      <div className="judicial-toolbar processos-toolbar">
        <div>
          <span className="eyebrow">Processos</span>
          <h2>Controle jurídico da carteira processual</h2>
          <p>Processos protocolados e pastas ainda pendentes de protocolo em uma visão única.</p>
        </div>
        <label>
          <span>Busca</span>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente, CPF, ID, CNJ ou banco" />
        </label>
        <button className="btn-primary" onClick={abrirCadastroExistente} type="button">Cadastrar processo existente</button>
      </div>

      <section className="processos-filters">
        <label><span>Situação</span><select value={filtros.situacao} onChange={(e) => setFiltros((f) => ({ ...f, situacao: e.target.value }))}>{["Todos", ...SITUACOES].map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Fase</span><select value={filtros.fase} onChange={(e) => setFiltros((f) => ({ ...f, fase: e.target.value }))}>{["Todos", ...FASES_JUDICIAIS].map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Resultado</span><select value={filtros.resultado} onChange={(e) => setFiltros((f) => ({ ...f, resultado: e.target.value }))}>{["Todos", ...RESULTADOS].map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Banco</span><select value={filtros.banco} onChange={(e) => setFiltros((f) => ({ ...f, banco: e.target.value }))}>{bancos.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Responsável</span><select value={filtros.responsavel} onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))}>{responsaveis.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Justiça gratuita</span><select value={filtros.justica} onChange={(e) => setFiltros((f) => ({ ...f, justica: e.target.value }))}>{["Todos", ...JUSTICA_GRATUITA].map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Emenda</span><select value={filtros.emenda} onChange={(e) => setFiltros((f) => ({ ...f, emenda: e.target.value }))}>{["Todos", ...EMENDA].map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Com pendência</span><select value={filtros.comPendencia} onChange={(e) => setFiltros((f) => ({ ...f, comPendencia: e.target.value }))}>{SIM_NAO.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Custas</span><select value={filtros.custas} onChange={(e) => setFiltros((f) => ({ ...f, custas: e.target.value }))}>{custas.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Pasta retornada</span><select value={filtros.pastaRetornada} onChange={(e) => setFiltros((f) => ({ ...f, pastaRetornada: e.target.value }))}>{SIM_NAO.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Sem revisão</span><select value={filtros.semRevisao} onChange={(e) => setFiltros((f) => ({ ...f, semRevisao: e.target.value }))}>{SIM_NAO.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Encerrado</span><select value={filtros.encerrado} onChange={(e) => setFiltros((f) => ({ ...f, encerrado: e.target.value }))}>{SIM_NAO.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label><span>Recursal</span><select value={filtros.recursal} onChange={(e) => setFiltros((f) => ({ ...f, recursal: e.target.value }))}>{SIM_NAO.map((o) => <option key={o}>{o}</option>)}</select></label>
      </section>

      <div className="judicial-table-wrap processos-table-wrap">
        <table className="judicial-table processos-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Processo</th>
              <th>Réu</th>
              <th>Banco</th>
              <th>Situação</th>
              <th>Fase</th>
              <th>Resultado</th>
              <th>Última movimentação</th>
              <th>Última revisão</th>
              <th>Próximo prazo</th>
              <th>Responsável</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {processosFiltrados.length === 0 ? (
              <tr><td colSpan={12}>Nenhum processo encontrado.</td></tr>
            ) : processosFiltrados.map((processo) => {
              const situacao = situacaoDoProcesso(processo);
              const fase = faseDoProcesso(processo);
              const resultado = resultadoDoProcesso(processo);
              return (
                <tr key={processo.id}>
                  <td><strong>{processo.nome_cliente}</strong><small>{processo.cpf_cliente || processo.id_crm || "Sem CPF/ID"}</small></td>
                  <td>{processo.numero_processo || "Pendente"}</td>
                  <td>{processo.reu || processo.banco_reu || "—"}</td>
                  <td>{processo.banco_reu || "—"}</td>
                  <td><span className={`process-badge ${badgeClass(situacao)}`}>{situacao}</span></td>
                  <td>{fase}</td>
                  <td>{resultado}</td>
                  <td><span className="truncate-cell">{processo.ultima_movimentacao || "—"}</span></td>
                  <td>{formatarData(processo.ultima_revisao)}</td>
                  <td>{formatarData(processo.proximo_prazo)}</td>
                  <td>{processo.responsavel || "—"}</td>
                  <td><button className="btn-secondary compact" onClick={() => abrirFicha(processo)} type="button">Abrir ficha</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {fichaAberta && (
        <aside className="judicial-drawer process-drawer" aria-label="Ficha do processo">
          <form className="judicial-drawer-panel process-ficha" onSubmit={salvarProcesso}>
            <button className="modal-close" onClick={() => { setProcessoAberto(null); setModalCadastro(false); }} type="button">×</button>
            <header className="process-ficha-header">
              <span className="eyebrow">Ficha processo</span>
              <h3>{ficha.nome_cliente || "Novo processo existente"}</h3>
              <p>{ficha.numero_processo || "Número CNJ pendente"}</p>
              <div className="process-badge-row">
                <span className={`process-badge ${badgeClass(ficha.situacao)}`}>{ficha.situacao}</span>
                <span className={`process-badge ${badgeClass(ficha.fase_judicial)}`}>{ficha.fase_judicial}</span>
                <span className={`process-badge ${badgeClass(ficha.resultado)}`}>{ficha.resultado}</span>
              </div>
            </header>

            <nav className="process-ficha-tabs" aria-label="Abas da ficha do processo">
              {ABAS_FICHA.map((aba) => <button key={aba} type="button" className={abaFicha === aba ? "active" : ""} onClick={() => setAbaFicha(aba)}>{aba}</button>)}
            </nav>

            <div className="process-ficha-content">
              {abaFicha === "Resumo" ? <>
                <section className="process-form-section">
                  <h4>Informações principais</h4>
                  <div className="process-form-grid">
                    <label><span>Cliente *</span><input value={ficha.nome_cliente} onChange={(e) => setFicha((f) => ({ ...f, nome_cliente: e.target.value }))} /></label>
                    <label><span>CPF</span><input value={ficha.cpf_cliente} onChange={(e) => setFicha((f) => ({ ...f, cpf_cliente: e.target.value }))} /></label>
                    <label><span>ID CRM</span><input value={ficha.id_crm} onChange={(e) => setFicha((f) => ({ ...f, id_crm: e.target.value }))} /></label>
                    <label><span>Link pasta Drive</span><input value={ficha.link_pasta_cliente} onChange={(e) => setFicha((f) => ({ ...f, link_pasta_cliente: e.target.value }))} placeholder="Pasta do cliente no Drive" /></label>
                    <label><span>Autor</span><input value={ficha.autor} onChange={(e) => setFicha((f) => ({ ...f, autor: e.target.value }))} /></label>
                    <label><span>Réu</span><input value={ficha.reu} onChange={(e) => setFicha((f) => ({ ...f, reu: e.target.value }))} /></label>
                    <label><span>Banco</span><input value={ficha.banco_reu} onChange={(e) => setFicha((f) => ({ ...f, banco_reu: e.target.value }))} /></label>
                    <label><span>Produto</span><input value={ficha.produto} onChange={(e) => setFicha((f) => ({ ...f, produto: e.target.value }))} /></label>
                    <label><span>Contrato</span><input value={ficha.numero_contrato} onChange={(e) => setFicha((f) => ({ ...f, numero_contrato: e.target.value }))} /></label>
                    <label><span>Número CNJ</span><input value={ficha.numero_processo} onChange={(e) => setFicha((f) => ({ ...f, numero_processo: e.target.value }))} /></label>
                    <label><span>Distribuição</span><input type="date" value={ficha.data_distribuicao} onChange={(e) => setFicha((f) => ({ ...f, data_distribuicao: e.target.value }))} /></label>
                    <label><span>Tribunal</span><input value={ficha.tribunal} onChange={(e) => setFicha((f) => ({ ...f, tribunal: e.target.value }))} /></label>
                    <label><span>Comarca</span><input value={ficha.comarca} onChange={(e) => setFicha((f) => ({ ...f, comarca: e.target.value }))} /></label>
                    <label><span>Vara</span><input value={ficha.vara} onChange={(e) => setFicha((f) => ({ ...f, vara: e.target.value }))} /></label>
                    <label><span>Tipo ação</span><input value={ficha.tipo_acao} onChange={(e) => setFicha((f) => ({ ...f, tipo_acao: e.target.value }))} /></label>
                    <label><span>Responsável</span><input value={ficha.responsavel} onChange={(e) => setFicha((f) => ({ ...f, responsavel: e.target.value }))} /></label>
                    <label><span>Link consulta</span><input value={ficha.link_consulta} onChange={(e) => setFicha((f) => ({ ...f, link_consulta: e.target.value }))} /></label>
                    <label><span>Situação</span><select value={ficha.situacao} onChange={(e) => setFicha((f) => ({ ...f, situacao: e.target.value }))}>{SITUACOES.map((o) => <option key={o}>{o}</option>)}</select></label>
                    <label><span>Fase</span><select value={ficha.fase_judicial} onChange={(e) => setFicha((f) => ({ ...f, fase_judicial: e.target.value }))}>{FASES_JUDICIAIS.map((o) => <option key={o}>{o}</option>)}</select></label>
                    <label><span>Resultado</span><select value={ficha.resultado} onChange={(e) => setFicha((f) => ({ ...f, resultado: e.target.value }))}>{RESULTADOS.map((o) => <option key={o}>{o}</option>)}</select></label>
                    <label><span>Justiça gratuita</span><select value={ficha.justica_gratuita} onChange={(e) => setFicha((f) => ({ ...f, justica_gratuita: e.target.value }))}>{JUSTICA_GRATUITA.map((o) => <option key={o}>{o}</option>)}</select></label>
                    <label><span>Emenda</span><select value={ficha.emenda_status} onChange={(e) => setFicha((f) => ({ ...f, emenda_status: e.target.value }))}>{EMENDA.map((o) => <option key={o}>{o}</option>)}</select></label>
                    <label><span>Próximo prazo</span><input type="date" value={ficha.proximo_prazo} onChange={(e) => setFicha((f) => ({ ...f, proximo_prazo: e.target.value }))} /></label>
                    <label><span>Última revisão</span><input type="date" value={ficha.ultima_revisao} onChange={(e) => setFicha((f) => ({ ...f, ultima_revisao: e.target.value }))} /></label>
                    <label><span>Próxima revisão</span><input type="date" value={ficha.proxima_revisao} onChange={(e) => setFicha((f) => ({ ...f, proxima_revisao: e.target.value }))} /></label>
                    <label><span>Custas</span><input value={ficha.custas_status} onChange={(e) => setFicha((f) => ({ ...f, custas_status: e.target.value }))} /></label>
                    <label className="check-line"><input type="checkbox" checked={ficha.com_pendencia} onChange={(e) => setFicha((f) => ({ ...f, com_pendencia: e.target.checked }))} /> Com pendência</label>
                    <label className="check-line"><input type="checkbox" checked={ficha.pasta_retornada} onChange={(e) => setFicha((f) => ({ ...f, pasta_retornada: e.target.checked }))} /> Pasta retornada</label>
                    <label className="check-line"><input type="checkbox" checked={ficha.sem_revisao} onChange={(e) => setFicha((f) => ({ ...f, sem_revisao: e.target.checked }))} /> Sem revisão</label>
                    <label className="check-line"><input type="checkbox" checked={ficha.recursal} onChange={(e) => setFicha((f) => ({ ...f, recursal: e.target.checked }))} /> Recursal</label>
                    <label className="wide"><span>Observações</span><textarea rows={3} value={ficha.observacoes} onChange={(e) => setFicha((f) => ({ ...f, observacoes: e.target.value }))} /></label>
                  </div>
                </section>
                <aside className="process-next-actions">
                  <h4>Próximas ações</h4>
                  <article className={`review-alert ${calcularAlertaRevisao(processoAberto).classe}`}>
                    <strong>Revisão processual</strong>
                    <span>{calcularAlertaRevisao(processoAberto).rotulo}</span>
                    <small>Próxima revisão: {formatarData(processoAberto?.proxima_revisao || ficha.proxima_revisao)}</small>
                  </article>
                  <article>
                    <strong>Última movimentação judicial</strong>
                    <span>{processoAberto?.ultima_movimentacao || "Não registrada"}</span>
                    <small>{formatarDataHora(processoAberto?.ultima_movimentacao_data)}</small>
                  </article>
                  <article>
                    <strong>Última revisão pela Platino</strong>
                    <span>{formatarData(processoAberto?.ultima_revisao || ficha.ultima_revisao)}</span>
                    <small>{processoAberto?.ultima_revisao_por || usuario?.nome || "Responsável não informado"}</small>
                  </article>
                  <article><strong>Pendências</strong><span>{ficha.com_pendencia ? "Há pendência registrada" : "Nenhuma pendência marcada"}</span></article>
                  <article><strong>Último atendimento</strong><span>{processoAberto?.ultimo_atendimento || "Não registrado"}</span></article>
                  <article><strong>Último relatório enviado</strong><span>{processoAberto?.ultimo_relatorio_enviado || "Não registrado"}</span></article>
                </aside>
              </> : null}

              {abaFicha === "Movimentações" ? (
                <section className="process-form-section">
                  <div className="section-title-row">
                    <div>
                      <h4>Registrar movimentação</h4>
                      <p>Registro manual preparado para integrações futuras com tribunais, APIs, importações e IA.</p>
                    </div>
                    <span className="process-badge andamento">Origem manual</span>
                  </div>
                  <form className="movimentacao-form movement-form-grid" onSubmit={adicionarMovimentacao}>
                    <label><span>Data e hora</span><input type="datetime-local" value={movimentacaoForm.data} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, data: e.target.value }))} /></label>
                    <label><span>Categoria</span><select value={movimentacaoForm.categoria} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, categoria: e.target.value }))}>{CATEGORIAS_TIMELINE.map((opcao) => <option key={opcao}>{opcao}</option>)}</select></label>
                    <label><span>Importância</span><select value={movimentacaoForm.importancia} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, importancia: e.target.value }))}>{IMPORTANCIAS.map((opcao) => <option key={opcao}>{opcao}</option>)}</select></label>
                    <label><span>Fonte</span><select value={movimentacaoForm.fonte} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, fonte: e.target.value }))}>{FONTES_ORIGEM.map((opcao) => <option key={opcao}>{opcao}</option>)}</select></label>
                    <label className="wide"><span>Título *</span><input value={movimentacaoForm.titulo} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex.: Sentença publicada, emenda determinada, audiência designada" /></label>
                    <label className="wide"><span>Descrição técnica *</span><textarea rows={4} value={movimentacaoForm.descricao_tecnica} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, descricao_tecnica: e.target.value }))} /></label>
                    <label className="wide"><span>Resumo para cliente</span><textarea rows={3} value={movimentacaoForm.resumo_cliente} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, resumo_cliente: e.target.value }))} /></label>
                    <label><span>Link</span><input value={movimentacaoForm.link} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://" /></label>
                    <label><span>Anexo</span><input value={movimentacaoForm.anexo_url} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, anexo_url: e.target.value }))} placeholder="Link ou caminho do arquivo" /></label>
                    <label><span>Próxima revisão</span><input type="date" value={movimentacaoForm.proxima_revisao} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, proxima_revisao: e.target.value }))} /></label>
                    <label className="wide"><span>Próxima providência</span><input value={movimentacaoForm.proxima_providencia} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, proxima_providencia: e.target.value }))} /></label>
                    <label className="check-line wide"><input type="checkbox" checked={movimentacaoForm.criar_tarefa_relacionada} onChange={(e) => setMovimentacaoForm((f) => ({ ...f, criar_tarefa_relacionada: e.target.checked }))} /> Criar tarefa relacionada futuramente</label>
                    <div className="movement-actions"><button className="btn-primary" disabled={salvando} type="submit">Registrar movimentação</button></div>
                  </form>
                  <TimelineProcessual movimentacoes={movimentacoes} filtro={timelineFiltro} onFiltro={setTimelineFiltro} onArquivar={arquivarMovimentacao} />
                </section>
              ) : null}
              {abaFicha === "Histórico" ? (
                <section className="process-form-section">
                  <div className="section-title-row">
                    <div>
                      <h4>Histórico permanente</h4>
                      <p>Linha do tempo unificada do processo, preservando a categoria e a fonte de cada evento.</p>
                    </div>
                  </div>
                  <div className="review-register">
                    <div>
                      <strong>Revisão interna</strong>
                      <span>Registre quando a Platino revisou o processo. Isso não substitui a última movimentação judicial.</span>
                    </div>
                    <input value={revisaoObservacao} onChange={(e) => setRevisaoObservacao(e.target.value)} placeholder="Observação opcional da revisão" />
                    <button className="btn-secondary" disabled={salvando || !processoAberto} onClick={registrarRevisaoInterna} type="button">Registrar revisão</button>
                  </div>
                  <TimelineProcessual movimentacoes={movimentacoes} filtro={timelineFiltro} onFiltro={setTimelineFiltro} onArquivar={arquivarMovimentacao} />
                </section>
              ) : null}
              {abaFicha === "Tarefas e Prazos" ? (
                <section className="process-form-section">
                  <div className="section-title-row">
                    <div>
                      <h4>Tarefas e prazos do processo</h4>
                      <p>Crie atividades vinculadas ao processo. Prazos processuais aparecem também na agenda operacional.</p>
                    </div>
                    <span className="process-badge andamento">{tarefasProcesso.length} registros</span>
                  </div>
                  <form className="movimentacao-form movement-form-grid" onSubmit={criarTarefaProcesso}>
                    <label className="wide"><span>Título</span><input value={tarefaForm.titulo} onChange={(e) => setTarefaForm((f) => ({ ...f, titulo: e.target.value }))} /></label>
                    <label className="wide"><span>Descrição</span><textarea rows={3} value={tarefaForm.descricao} onChange={(e) => setTarefaForm((f) => ({ ...f, descricao: e.target.value }))} /></label>
                    <label><span>Tipo</span><select value={tarefaForm.tipo} onChange={(e) => setTarefaForm((f) => ({ ...f, tipo: e.target.value }))}>{TIPOS_TAREFA.map((opcao) => <option key={opcao}>{opcao}</option>)}</select></label>
                    <label><span>Data</span><input type="date" value={tarefaForm.data} onChange={(e) => setTarefaForm((f) => ({ ...f, data: e.target.value }))} /></label>
                    <label><span>Horário</span><input type="time" value={tarefaForm.horario} onChange={(e) => setTarefaForm((f) => ({ ...f, horario: e.target.value }))} /></label>
                    <label><span>Responsável</span><input value={tarefaForm.responsavel} onChange={(e) => setTarefaForm((f) => ({ ...f, responsavel: e.target.value }))} /></label>
                    <label><span>Prioridade</span><select value={tarefaForm.prioridade} onChange={(e) => setTarefaForm((f) => ({ ...f, prioridade: e.target.value }))}>{PRIORIDADES_TAREFA.map((opcao) => <option key={opcao}>{opcao}</option>)}</select></label>
                    <label><span>Status</span><select value={tarefaForm.status} onChange={(e) => setTarefaForm((f) => ({ ...f, status: e.target.value }))}>{STATUS_TAREFA.map((opcao) => <option key={opcao}>{opcao}</option>)}</select></label>
                    <label><span>Lembrete</span><input value={tarefaForm.lembrete} onChange={(e) => setTarefaForm((f) => ({ ...f, lembrete: e.target.value }))} /></label>
                    <label className="wide"><span>Observação</span><textarea rows={2} value={tarefaForm.observacao} onChange={(e) => setTarefaForm((f) => ({ ...f, observacao: e.target.value }))} /></label>
                    <div className="movement-actions"><button className="btn-primary" disabled={salvando} type="submit">Criar tarefa</button></div>
                  </form>
                  <ListaTarefasProcesso tarefas={tarefasProcesso} onStatus={atualizarStatusTarefaProcesso} />
                </section>
              ) : null}
              {abaFicha === "Atendimentos" ? (
                <section className="process-form-section">
                  <div className="section-title-row">
                    <div>
                      <h4>Atendimentos do processo</h4>
                      <p>Registre contatos permanentes. Cada atendimento também entra no histórico do processo.</p>
                    </div>
                    <span className="process-badge andamento">{atendimentosProcesso.length} registros</span>
                  </div>
                  <form className="movimentacao-form movement-form-grid" onSubmit={criarAtendimentoProcesso}>
                    <label><span>Data</span><input type="date" value={atendimentoForm.data} onChange={(e) => setAtendimentoForm((f) => ({ ...f, data: e.target.value }))} /></label>
                    <label><span>Hora</span><input type="time" value={atendimentoForm.hora} onChange={(e) => setAtendimentoForm((f) => ({ ...f, hora: e.target.value }))} /></label>
                    <label><span>Canal</span><select value={atendimentoForm.canal} onChange={(e) => setAtendimentoForm((f) => ({ ...f, canal: e.target.value }))}>{CANAIS_ATENDIMENTO.map((opcao) => <option key={opcao}>{opcao}</option>)}</select></label>
                    <label><span>Tipo</span><input value={atendimentoForm.tipo} onChange={(e) => setAtendimentoForm((f) => ({ ...f, tipo: e.target.value }))} /></label>
                    <label className="wide"><span>Descrição</span><textarea rows={4} value={atendimentoForm.descricao} onChange={(e) => setAtendimentoForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Cliente informado sobre custas." /></label>
                    <label><span>Responsável</span><input value={atendimentoForm.responsavel} onChange={(e) => setAtendimentoForm((f) => ({ ...f, responsavel: e.target.value }))} /></label>
                    <label><span>Anexo</span><input value={atendimentoForm.anexo_url} onChange={(e) => setAtendimentoForm((f) => ({ ...f, anexo_url: e.target.value }))} /></label>
                    <div className="movement-actions"><button className="btn-primary" disabled={salvando} type="submit">Registrar atendimento</button></div>
                  </form>
                  <ListaAtendimentosProcesso atendimentos={atendimentosProcesso} />
                </section>
              ) : null}
              {abaFicha === "Auditoria" ? <section className="process-form-section"><h4>Auditoria</h4>{auditoria.length === 0 ? <div className="empty-row">Nenhum registro de auditoria.</div> : auditoria.map((item) => <article className="audit-row" key={item.id}><strong>{item.campo}</strong><span>{item.valor_anterior || "vazio"} → {item.valor_novo || "vazio"}</span><small>{item.usuario || "Usuário"} · {formatarDataHora(item.created_at)}</small></article>)}</section> : null}
              {abaFicha === "Documentos" ? (
                <section className="process-form-section">
                  <div className="section-title-row">
                    <div>
                      <h4>Documentos do processo</h4>
                      <p>Produção pelo Gerador existente e acervo vinculado ao cliente/processo.</p>
                    </div>
                    <button className="btn-primary compact" onClick={() => abrirGeradorDocumento()} type="button">Gerar documento</button>
                  </div>
                  <ListaDocumentosProcesso documentos={documentosProcesso} onStatus={atualizarStatusDocumento} onComunicar={setComunicandoDocumento} />
                  <section className="report-box">
                    <div>
                      <strong>Relatório processual</strong>
                      <span>Último relatório: {ultimoRelatorio ? formatarDataHora(ultimoRelatorio.created_at) : "não localizado"} · {movimentacoesPosterioresRelatorio} movimentações posteriores.</span>
                    </div>
                    <label><input type="checkbox" /> Contestação</label>
                    <label><input type="checkbox" /> Réplica</label>
                    <label><input type="checkbox" /> Conclusos</label>
                    <button className="btn-secondary compact" type="button" onClick={() => abrirGeradorDocumento({
                      modeloId: "relatorio-atualizacao-processual",
                      modeloModo: "relatorio-atualizacao-processual",
                      statusDescricao: processoAberto?.observacoes || processoAberto?.status_judicial || processoAberto?.fase_judicial || "Processo em acompanhamento pela equipe responsável.",
                      ultimaMovimentacao: resumoMovimentacoesRelatorio || processoAberto?.ultima_movimentacao || "Nenhuma movimentação posterior localizada.",
                      dataUltimaMovimentacao: movimentacoes[0]?.data_registro || processoAberto?.ultima_movimentacao_data,
                      proximosPassos: processoAberto?.proxima_revisao ? `Próxima revisão em ${formatarData(processoAberto.proxima_revisao)}.` : "Acompanhar novas movimentações e atualizar o cliente conforme necessidade.",
                      anexosResumo: "Documentos arquivados na pasta do cliente no Drive.",
                      observacaoInterna: `Relatório de andamento processual.` + "\n" + `Movimentações posteriores ao último relatório:` + "\n" + (resumoMovimentacoesRelatorio || "Nenhuma movimentação posterior localizada."),
                    })}>Gerar relatório de andamento</button>
                  </section>
                </section>
              ) : null}
              {!["Resumo", "Histórico", "Movimentações", "Tarefas e Prazos", "Atendimentos", "Documentos", "Auditoria"].includes(abaFicha) ? <section className="process-form-section"><h4>{abaFicha}</h4><div className="empty-row">Área preparada para vincular {abaFicha.toLowerCase()} do processo.</div></section> : null}
            </div>

            <footer className="process-ficha-actions">
              <div className="process-link-actions">
                {ficha.link_pasta_cliente ? <a href={ficha.link_pasta_cliente} target="_blank" rel="noreferrer">Abrir pasta Drive</a> : null}
                {ficha.link_consulta ? <a href={ficha.link_consulta} target="_blank" rel="noreferrer">Abrir consulta</a> : null}
              </div>
              <div><button className="btn-secondary" onClick={() => { setProcessoAberto(null); setModalCadastro(false); }} type="button">Fechar</button><button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : "Salvar processo"}</button></div>
            </footer>
          </form>
        </aside>
      )}
      {geradorAberto && processoAberto ? (
        <div className="document-generator-backdrop">
          <section className="document-generator-shell">
            <button type="button" className="drawer-close" onClick={() => { setGeradorAberto(false); setContextoGerador(null); }} aria-label="Fechar">×</button>
            <GeradorDocumentos
              usuario={usuario}
              responsavel={usuario?.nome}
              contextoDocumento={contextoDocumentoProcesso()}
              onDocumentoGerado={registrarDocumentoGerado}
              onStatusDocumento={(resultado) => {
                if (resultado?.documentoRemoto) atualizarStatusDocumento(resultado.documentoRemoto, resultado.status || "Aguardando assinatura");
              }}
              onSuccess={showToast}
            />
          </section>
        </div>
      ) : null}
      {comunicandoDocumento ? (
        <div className="modal-backdrop">
          <section className="cliente-modal">
            <header>
              <div><span className="eyebrow">Comunicação</span><h3>Marcar como comunicado</h3></div>
              <button className="drawer-close" onClick={() => setComunicandoDocumento(null)} type="button">×</button>
            </header>
            <div className="cliente-form-grid">
              <label><span>Documento</span><input value={comunicandoDocumento.nome_documento} readOnly /></label>
              <label><span>Canal</span><select value={comunicacaoCanal} onChange={(e) => setComunicacaoCanal(e.target.value)}>{CANAIS_ATENDIMENTO.map((canal) => <option key={canal}>{canal}</option>)}</select></label>
              <label className="wide"><span>Observação</span><textarea rows={4} value={comunicacaoObservacao} onChange={(e) => setComunicacaoObservacao(e.target.value)} /></label>
            </div>
            <footer><button className="btn-secondary" onClick={() => setComunicandoDocumento(null)} type="button">Cancelar</button><button className="btn-primary" onClick={marcarDocumentoComunicado} type="button">Salvar comunicação</button></footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TimelineProcessual({
  movimentacoes,
  filtro,
  onFiltro,
  onArquivar,
}: {
  movimentacoes: MovimentacaoProcessual[];
  filtro: string;
  onFiltro: (filtro: string) => void;
  onArquivar: (movimentacao: MovimentacaoProcessual) => void;
}) {
  const categorias = categoriaPorFiltro(filtro);
  const itens = movimentacoes.filter((movimentacao) => {
    if (movimentacao.deleted_at) return false;
    if (filtro === "Todos") return true;
    return categorias.includes(movimentacao.categoria || "Movimentação processual");
  });

  return (
    <div className="timeline-shell">
      <div className="timeline-filters">
        {FILTROS_TIMELINE.map((opcao) => (
          <button key={opcao} type="button" className={filtro === opcao ? "active" : ""} onClick={() => onFiltro(opcao)}>
            {opcao}
          </button>
        ))}
      </div>
      {itens.length === 0 ? (
        <div className="empty-row">Nenhum evento registrado para este filtro.</div>
      ) : (
        <div className="timeline-list">
          {itens.map((movimentacao) => {
            const categoria = movimentacao.categoria || "Movimentação processual";
            const importancia = movimentacao.importancia || "Normal";
            return (
              <article className="timeline-item" key={movimentacao.id}>
                <div className="timeline-marker" />
                <div className="timeline-card">
                  <header>
                    <div>
                      <time dateTime={movimentacao.data_registro}>{formatarDataHora(movimentacao.data_registro)}</time>
                      <h5>{movimentacao.titulo || movimentacao.tipo || "Movimentação registrada"}</h5>
                    </div>
                    <div className="timeline-badges">
                      <span>{categoria}</span>
                      <span className={`importance ${normalizar(importancia)}`}>{importancia}</span>
                    </div>
                  </header>
                  <p>{movimentacao.descricao_tecnica || movimentacao.descricao}</p>
                  {movimentacao.resumo_cliente ? <blockquote>{movimentacao.resumo_cliente}</blockquote> : null}
                  <footer>
                    <span>Responsável: {movimentacao.responsavel || movimentacao.created_by_nome || "Não informado"}</span>
                    <span>Fonte: {movimentacao.fonte || "Manual"}</span>
                    {movimentacao.proxima_providencia ? <span>Providência: {movimentacao.proxima_providencia}</span> : null}
                    {movimentacao.proxima_revisao ? <span>Próxima revisão: {formatarData(movimentacao.proxima_revisao)}</span> : null}
                    {movimentacao.link ? <a href={movimentacao.link} target="_blank" rel="noreferrer">Abrir link</a> : null}
                    {movimentacao.anexo_url ? <a href={movimentacao.anexo_url} target="_blank" rel="noreferrer">Abrir anexo</a> : null}
                    <button type="button" onClick={() => onArquivar(movimentacao)}>Arquivar</button>
                  </footer>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListaTarefasProcesso({
  tarefas,
  onStatus,
}: {
  tarefas: TarefaProcessual[];
  onStatus: (tarefa: TarefaProcessual, status: string) => void;
}) {
  if (tarefas.length === 0) return <div className="empty-row">Nenhuma tarefa ou prazo vinculado ao processo.</div>;
  return (
    <div className="process-linked-list">
      {tarefas.map((tarefa) => (
        <article key={tarefa.id}>
          <div>
            <strong>{tarefa.titulo}</strong>
            <span>{tarefa.tipo} · {formatarData(tarefa.data)}{tarefa.horario ? `, ${tarefa.horario}` : ""}</span>
            {tarefa.descricao ? <p>{tarefa.descricao}</p> : null}
          </div>
          <div>
            <small>{tarefa.prioridade} · {tarefa.responsavel || "Sem responsável"}</small>
            <select value={tarefa.status} onChange={(e) => onStatus(tarefa, e.target.value)}>
              {STATUS_TAREFA.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </article>
      ))}
    </div>
  );
}

function ListaDocumentosProcesso({
  documentos,
  onStatus,
  onComunicar,
}: {
  documentos: DocumentoProcessual[];
  onStatus: (documento: DocumentoProcessual, status: string, assinado?: boolean) => void;
  onComunicar: (documento: DocumentoProcessual) => void;
}) {
  if (documentos.length === 0) return <div className="empty-row">Nenhum documento vinculado ao processo.</div>;
  return (
    <div className="process-doc-table">
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Documento</th>
            <th>Data</th>
            <th>Versão</th>
            <th>Status</th>
            <th>Assinado</th>
            <th>Responsável</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((documento) => (
            <tr key={documento.id}>
              <td>{documento.tipo_documento || documento.modelo_nome}</td>
              <td><strong>{documento.nome_documento}</strong><small>{documento.numero_processo || "Sem processo informado"}</small></td>
              <td>{formatarDataHora(documento.created_at)}</td>
              <td>{String(documento.versao || 1).padStart(2, "0")}</td>
              <td><select value={documento.status || "Gerado"} onChange={(e) => onStatus(documento, e.target.value)}>{STATUS_DOCUMENTO.map((status) => <option key={status}>{status}</option>)}</select></td>
              <td><input type="checkbox" checked={Boolean(documento.assinado)} onChange={(e) => onStatus(documento, e.target.checked ? "Assinado" : documento.status || "Gerado", e.target.checked)} /></td>
              <td>{documento.responsavel_nome || "—"}</td>
              <td><button className="btn-secondary compact" type="button" onClick={() => onComunicar(documento)}>{documento.comunicado_em ? "Comunicado" : "Marcar comunicado"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaAtendimentosProcesso({ atendimentos }: { atendimentos: AtendimentoProcessual[] }) {
  if (atendimentos.length === 0) return <div className="empty-row">Nenhum atendimento vinculado ao processo.</div>;
  return (
    <div className="process-linked-list">
      {atendimentos.map((atendimento) => (
        <article key={atendimento.id}>
          <div>
            <strong>{atendimento.canal} · {atendimento.tipo || "Atendimento"}</strong>
            <span>{formatarData(atendimento.data)}{atendimento.hora ? `, ${atendimento.hora}` : ""} · {atendimento.responsavel || "Sem responsável"}</span>
            <p>{atendimento.descricao}</p>
          </div>
          {atendimento.anexo_url ? <a href={atendimento.anexo_url} target="_blank" rel="noreferrer">Abrir anexo</a> : null}
        </article>
      ))}
    </div>
  );
}
