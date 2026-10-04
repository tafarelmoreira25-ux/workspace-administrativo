import { formatarParteContraria } from "../../lib/formatarParteContraria";
import { FormActions, FormField, FormGrid, FormSection, Input, Select, Textarea } from "../common/FormControls";
import { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  type FaseProcessual,
  type Processo,
  calcularPrazoElite,
  contarDiasUteisEntre,
} from "../../lib/esteiraProcessual";
import { sincronizarClienteDoProcesso } from "../../lib/processDataSync";
import { numeroProtocoloExtrajudicial } from "../../lib/protocoloExtrajudicial";

type Props = {
  processos: Processo[];
  onProcessoAtualizado: (processo: Processo) => void;
  showToast: (mensagem: string) => void;
  usuario?: { nome?: string; email?: string };
  busca: string;
  onBusca: (valor: string) => void;
};

const MOTIVOS_AJUIZAMENTO = [
  "Tentativa extrajudicial frustrada",
  "Acordo extrajudicial descumprido",
  "Orientação para ajuizamento",
  "Outro",
];

const STATUS_DOCUMENTACAO = ["Pendente", "Regular", "Irregular"];
const RESPONSABILIDADES = ["Cliente", "Platino", "Elite", "Advogado", "Terceiro", "Indefinido"];
const STATUS_PROCURACAO = ["Elaborando", "Aguardando assinatura", "Assinado", "Pendente", "Atrasado"];
const STATUS_CRM = ["Pendente", "Concluído"];
const STATUS_ELITE = ["Pendente", "Enviado"];
const STATUS_RETORNO = ["Não retornada", "Retornada", "Em regularização", "Reenviada"];
const IMPACTO_SLA = ["não altera", "pausa", "reinicia"];
const STATUS_PROTOCOLO = ["Aguardando", "Liberado"];
const COLUNAS_PROTOCOLO = [
  "Cadastro/Procuração",
  "Aguardando Assinatura",
  "Análise de Documentos",
  "Distribuição",
] as const;

const ETAPAS_FORMULARIO = [
  ["dados", "Encaminhamento"],
  ["documentacao", "Documentação"],
  ["procuracao", "Procuração"],
  ["crm", "CRM"],
  ["elite", "Elite"],
  ["sla", "Prazo"],
  ["retorno", "Pasta retornada"],
  ["protocolo", "Protocolo"],
  ["distribuicao", "Distribuição"],
] as const;

type EtapaFormulario = (typeof ETAPAS_FORMULARIO)[number][0];

function formatarData(data: Date | string | null | undefined) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

function formatarDataHora(data: Date | string | null | undefined) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data));
}

function hojeInput() {
  return new Date().toISOString().slice(0, 10);
}

function dataHoraLocalInput(data?: string | null) {
  if (!data) return "";
  const parsed = new Date(data);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

function isoOuNull(dataLocal: string) {
  if (!dataLocal) return null;
  const parsed = new Date(dataLocal);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function criarFormulario(processo?: Processo | null, responsavel = "") {
  return {
    nome_cliente: processo?.nome_cliente || "",
    cpf_cliente: processo?.cpf_cliente || "",
    id_crm: processo?.id_crm || processo?.pasta_cliente_id || "",
    link_pasta_cliente: processo?.link_pasta_cliente || "",
    banco_reu: processo?.banco_reu || "",
    produto: processo?.produto || "",
    numero_contrato: processo?.numero_contrato || "",
    motivo_ajuizamento: processo?.motivo_ajuizamento || MOTIVOS_AJUIZAMENTO[0],
    observacoes: processo?.observacoes || "",
    responsavel: processo?.responsavel || responsavel,
    documentacao_status: processo?.documentacao_status || processo?.status_documentos || "Pendente",
    documentacao_motivo: processo?.documentacao_motivo || "",
    documentacao_faltantes: processo?.documentacao_faltantes || "",
    documentacao_responsabilidade: processo?.documentacao_responsabilidade || "Indefinido",
    documentacao_observacao: processo?.documentacao_observacao || "",
    documentacao_data: processo?.documentacao_data || "",
    procuracao_status: processo?.procuracao_status || processo?.status_procuracao || "Elaborando",
    declaracao_hipossuficiencia_status: processo?.declaracao_hipossuficiencia_status || "Elaborando",
    declaracao_ir_status: processo?.declaracao_ir_status || "Elaborando",
    procuracoes_outros: processo?.procuracoes_outros || "",
    crm_documentos_status: processo?.crm_documentos_status || "Pendente",
    documentos_elite_status: processo?.documentos_elite_status || "Pendente",
    pasta_retorno_status: processo?.pasta_retorno_status || (processo?.pasta_retornada ? "Retornada" : "Não retornada"),
    pasta_retorno_data: processo?.pasta_retorno_data || "",
    pasta_retorno_motivo: processo?.pasta_retorno_motivo || "",
    pasta_retorno_descricao: processo?.pasta_retorno_descricao || "",
    pasta_retorno_responsabilidade: processo?.pasta_retorno_responsabilidade || "Indefinido",
    pasta_retorno_documento_faltante: processo?.pasta_retorno_documento_faltante || "",
    pasta_retorno_data_regularizacao: processo?.pasta_retorno_data_regularizacao || "",
    pasta_retorno_data_reenvio: processo?.pasta_retorno_data_reenvio || "",
    pasta_retorno_observacao: processo?.pasta_retorno_observacao || "",
    pasta_retorno_impacto_sla: processo?.pasta_retorno_impacto_sla || "não altera",
    protocolo_status: processo?.protocolo_status || (processo?.numero_processo ? "Liberado" : "Aguardando"),
    numero_processo: processo?.numero_processo || "",
    protocolo_data_liberacao: dataHoraLocalInput(processo?.protocolo_data_liberacao || processo?.data_protocolo_liberado),
    tribunal: processo?.tribunal || "",
    comarca: processo?.comarca || "",
    vara: processo?.vara || "",
    link_consulta: processo?.link_consulta || processo?.link_processo || "",
    data_distribuicao: processo?.data_distribuicao || "",
  };
}

function etapaAtual(processo: Processo): FaseProcessual {
  if (processo.numero_processo) return "Distribuição";
  if ((processo.protocolo_status || "") === "Liberado") return "Protocolo Liberado";
  if (["Retornada", "Em regularização", "Reenviada"].includes(processo.pasta_retorno_status || "")) return "Pasta Retornada";
  if (processo.data_envio_elite) return "SLA";
  if (processo.documentos_elite_status === "Enviado") return "Enviado para Elite";
  if (processo.crm_documentos_status === "Concluído") return "CRM";
  if ([processo.procuracao_status, processo.declaracao_hipossuficiencia_status, processo.declaracao_ir_status].some((status) => status === "Assinado")) return "Procuração";
  if (processo.documentacao_status && processo.documentacao_status !== "Pendente") return "Documentação";
  return "Solicitado para Ajuizamento";
}

function timelineConcluida(chave: string, processo: Processo) {
  if (chave === "dados") return Boolean(processo.nome_cliente && processo.banco_reu);
  if (chave === "documentacao") return processo.documentacao_status === "Regular" || processo.status_documentos === "Regular";
  if (chave === "procuracao") return [processo.procuracao_status, processo.declaracao_hipossuficiencia_status].some((status) => status === "Assinado");
  if (chave === "crm") return processo.crm_documentos_status === "Concluído";
  if (chave === "elite") return processo.documentos_elite_status === "Enviado";
  if (chave === "sla") return Boolean(processo.data_envio_elite);
  if (chave === "retorno") return ["Retornada", "Em regularização", "Reenviada"].includes(processo.pasta_retorno_status || "");
  if (chave === "protocolo") return processo.protocolo_status === "Liberado" || Boolean(processo.numero_processo);
  if (chave === "distribuicao") return Boolean(processo.numero_processo);
  return false;
}

function etapaFormularioInicial(processo?: Processo | null): EtapaFormulario {
  if (!processo) return "dados";
  if (processo.numero_processo) return "distribuicao";
  if (processo.protocolo_status === "Liberado") return "protocolo";
  if (["Retornada", "Em regularização", "Reenviada"].includes(processo.pasta_retorno_status || "")) return "retorno";
  if (processo.data_envio_elite) return "sla";
  if (processo.documentos_elite_status === "Enviado") return "elite";
  if (processo.crm_documentos_status === "Concluído") return "crm";
  if ([processo.procuracao_status, processo.declaracao_hipossuficiencia_status, processo.declaracao_ir_status].some((status) => status === "Assinado")) return "procuracao";
  if (processo.documentacao_status && processo.documentacao_status !== "Pendente") return "documentacao";
  return "dados";
}

function classeSla(sinalizacao: string) {
  if (sinalizacao === "atencao") return "atencao";
  if (sinalizacao === "critico") return "critico";
  if (sinalizacao === "vermelho" || sinalizacao === "atrasado") return "atrasado";
  return "neutro";
}

function detalheEtapaProtocolo(chave: EtapaFormulario, processo: Processo) {
  if (chave === "dados") return processo.banco_reu || "Dados iniciais do encaminhamento";
  if (chave === "documentacao") return processo.documentacao_status || processo.status_documentos || "Pendente";
  if (chave === "procuracao") return processo.procuracao_status || processo.status_procuracao || "Pendente";
  if (chave === "crm") return processo.crm_documentos_status || "Pendente";
  if (chave === "elite") return processo.documentos_elite_status || "Pendente";
  if (chave === "sla") return processo.data_envio_elite ? `Iniciado em ${formatarData(processo.data_envio_elite)}` : "Aguardando envio";
  if (chave === "retorno") return processo.pasta_retorno_status || "Não retornada";
  if (chave === "protocolo") return processo.protocolo_status || "Aguardando";
  return processo.numero_processo || "Aguardando distribuição";
}

function proximaEtapaPendente(processo: Processo) {
  return ETAPAS_FORMULARIO.find(([chave]) => !timelineConcluida(chave, processo))?.[0] || null;
}

function campoMudou(a: unknown, b: unknown) {
  return String(a || "") !== String(b || "");
}

async function registrarAuditoria(processoId: string, usuario: string, alteracoes: Array<[string, unknown, unknown]>) {
  const relevantes = alteracoes.filter(([, anterior, novo]) => campoMudou(anterior, novo));
  if (relevantes.length === 0) return;

  await supabase.from("processos_auditoria").insert(relevantes.map(([campo, anterior, novo]) => ({
    processo_id: processoId,
    campo,
    valor_anterior: String(anterior || ""),
    valor_novo: String(novo || ""),
    usuario,
  })));

  const registros = relevantes.map(([campo, anterior, novo]) => ({
    processo_id: processoId,
    tipo: "auditoria_protocolo",
    categoria: "Movimentação processual",
    titulo: `Protocolo: ${campo}`,
    fase: "transicao_judicial",
    ordem_fase: 2,
    fonte: "Módulo Protocolos",
    origem: "manual",
    responsavel: usuario || null,
    descricao: `${usuario || "Usuário"} alterou ${campo}: "${anterior || "vazio"}" → "${novo || "vazio"}"`,
  }));

  await supabase.from("movimentacoes").insert(registros);
}

export default function EsteiraKanban({
  processos,
  onProcessoAtualizado,
  showToast,
  usuario,
  busca,
}: Props) {
  const [modalAberto, setModalAberto] = useState(false);
  const [processoEditando, setProcessoEditando] = useState<Processo | null>(null);
  const [processoVisualizando, setProcessoVisualizando] = useState<Processo | null>(null);
  const [formulario, setFormulario] = useState(criarFormulario(null, usuario?.nome || ""));
  const [salvando, setSalvando] = useState(false);
  const [etapaFormulario, setEtapaFormulario] = useState<EtapaFormulario>("dados");

  const protocolos = processos;
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const detalheController = useRef<AbortController | null>(null);
  useEffect(() => () => detalheController.current?.abort(), []);

  async function abrirDetalhe(processo: Processo) {
    detalheController.current?.abort();
    const controller = new AbortController();
    detalheController.current = controller;
    setCarregandoDetalhe(true);
    const { data, error } = await supabase.from("processos").select("*").eq("id", processo.id).single().abortSignal(controller.signal);
    if (controller.signal.aborted) return;
    setCarregandoDetalhe(false);
    if (error || !data) { showToast("Não foi possível carregar os detalhes do protocolo."); return; }
    setProcessoVisualizando(data as Processo);
  }

  function abrirNovoCadastro() {
    setProcessoEditando(null);
    setFormulario(criarFormulario(null, usuario?.nome || ""));
    setEtapaFormulario("dados");
    setModalAberto(true);
  }

  function abrirEdicao(processo: Processo) {
    setProcessoEditando(processo);
    setFormulario(criarFormulario(processo, usuario?.nome || ""));
    setEtapaFormulario(etapaFormularioInicial(processo));
    setModalAberto(true);
  }

  async function garantirClienteDoProtocolo(nome: string) {
    const cpf = formulario.cpf_cliente.trim();
    const idCrm = formulario.id_crm.trim();
    let cliente = null;

    if (processoEditando?.cliente_id) {
      const resultado = await supabase.from("clientes").select("*").eq("id", processoEditando.cliente_id).maybeSingle();
      if (resultado.error) throw resultado.error;
      cliente = resultado.data;
    }

    if (!cliente && idCrm) {
      const resultado = await supabase.from("clientes").select("*").eq("id_crm", idCrm).limit(2);
      if (resultado.error) throw resultado.error;
      if (resultado.data?.length === 1) cliente = resultado.data[0];
    }

    if (!cliente && cpf) {
      const resultado = await supabase.from("clientes").select("*").eq("cpf", cpf).limit(2);
      if (resultado.error) throw resultado.error;
      if (resultado.data?.length === 1) cliente = resultado.data[0];
    }

    if (!cliente) {
      const resultado = await supabase.from("clientes").select("*").ilike("nome_completo", nome).limit(2);
      if (resultado.error) throw resultado.error;
      if (resultado.data?.length === 1) cliente = resultado.data[0];
    }

    const dadosCliente = {
      nome,
      nome_completo: nome,
      cpf: cpf || cliente?.cpf || null,
      id_crm: idCrm || cliente?.id_crm || null,
      link_pasta_cliente: formulario.link_pasta_cliente.trim() || cliente?.link_pasta_cliente || null,
      telefone: cliente?.telefone || null,
      responsavel: formulario.responsavel.trim() || cliente?.responsavel || usuario?.nome || null,
      updated_by: usuario?.email || usuario?.nome || null,
    };

    const operacao = cliente
      ? supabase.from("clientes").update(dadosCliente).eq("id", cliente.id)
      : supabase.from("clientes").insert({ ...dadosCliente, origem: "Protocolo", created_by: usuario?.email || usuario?.nome || null });
    const resultado = await operacao.select("*").single();
    if (resultado.error) throw resultado.error;
    return resultado.data;
  }

  async function salvarCadastro(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nome = formulario.nome_cliente.trim();
    const banco = formulario.banco_reu.trim();

    if (!nome) {
      showToast("Informe o cliente.");
      return;
    }

    if (formulario.protocolo_status === "Liberado" && (!formulario.numero_processo.trim() || !formulario.protocolo_data_liberacao)) {
      showToast("Para liberar o protocolo, informe número do processo e data de liberação.");
      return;
    }

    setSalvando(true);
    let clienteVinculado;
    try {
      clienteVinculado = await garantirClienteDoProtocolo(nome);
    } catch (error) {
      setSalvando(false);
      showToast(`Não foi possível vincular o protocolo ao cadastro do cliente: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      return;
    }

    const agora = new Date().toISOString();
    let dataEnvioElite = processoEditando?.data_envio_elite || null;
    let slaIniciado = processoEditando?.sla_iniciado_em || null;
    let slaEncerrado = processoEditando?.sla_encerrado_em || null;
    let slaDiasUtilizados = processoEditando?.sla_dias_uteis_utilizados || null;
    let dataProtocoloLiberado = processoEditando?.data_protocolo_liberado || null;
    let protocoloDataLiberacao = isoOuNull(formulario.protocolo_data_liberacao);

    if (formulario.documentos_elite_status === "Enviado" && !dataEnvioElite) {
      dataEnvioElite = agora;
      slaIniciado = agora;
    }

    if (formulario.protocolo_status === "Liberado") {
      dataProtocoloLiberado = protocoloDataLiberacao || dataProtocoloLiberado || agora;
      protocoloDataLiberacao = protocoloDataLiberacao || dataProtocoloLiberado;
      if (!slaEncerrado) slaEncerrado = protocoloDataLiberacao;
      if (dataEnvioElite && protocoloDataLiberacao) {
        slaDiasUtilizados = contarDiasUteisEntre(new Date(dataEnvioElite), new Date(protocoloDataLiberacao), [], false);
      }
    }

    const payload = {
      cliente_id: clienteVinculado.id,
      cliente: nome,
      pasta_cliente_id: formulario.id_crm.trim() || null,
      link_pasta_cliente: formulario.link_pasta_cliente.trim() || null,
      id_crm: formulario.id_crm.trim() || null,
      nome_cliente: nome,
      cpf_cliente: formulario.cpf_cliente.trim() || null,
      banco_reu: banco,
      autor_reu: banco ? `${nome} X ${banco}` : nome,
      produto: formulario.produto.trim() || null,
      numero_contrato: formulario.numero_contrato.trim() || null,
      motivo_ajuizamento: formulario.motivo_ajuizamento,
      observacoes: formulario.observacoes.trim() || null,
      responsavel: formulario.responsavel.trim() || usuario?.nome || null,
      documentacao_status: formulario.documentacao_status,
      status_documentos: formulario.documentacao_status,
      documentacao_motivo: formulario.documentacao_status === "Irregular" ? formulario.documentacao_motivo.trim() || null : null,
      documentacao_faltantes: formulario.documentacao_status === "Irregular" ? formulario.documentacao_faltantes.trim() || null : null,
      documentacao_responsabilidade: formulario.documentacao_status === "Irregular" ? formulario.documentacao_responsabilidade : null,
      documentacao_observacao: formulario.documentacao_status === "Irregular" ? formulario.documentacao_observacao.trim() || null : null,
      documentacao_data: formulario.documentacao_status === "Irregular" ? formulario.documentacao_data || hojeInput() : formulario.documentacao_data || null,
      procuracao_status: formulario.procuracao_status,
      status_procuracao: formulario.procuracao_status,
      declaracao_hipossuficiencia_status: formulario.declaracao_hipossuficiencia_status,
      declaracao_ir_status: formulario.declaracao_ir_status,
      procuracoes_outros: formulario.procuracoes_outros.trim() || null,
      crm_documentos_status: formulario.crm_documentos_status,
      crm_documentos_data: formulario.crm_documentos_status === "Concluído" ? (processoEditando?.crm_documentos_data || agora) : null,
      crm_documentos_responsavel: formulario.crm_documentos_status === "Concluído" ? formulario.responsavel.trim() || usuario?.nome || null : null,
      crm_documentos_usuario: formulario.crm_documentos_status === "Concluído" ? usuario?.email || usuario?.nome || null : null,
      documentos_elite_status: formulario.documentos_elite_status,
      data_envio_elite: dataEnvioElite,
      sla_iniciado_em: slaIniciado,
      sla_encerrado_em: slaEncerrado,
      sla_dias_uteis_utilizados: slaDiasUtilizados,
      pasta_retornada: formulario.pasta_retorno_status !== "Não retornada",
      pasta_retorno_status: formulario.pasta_retorno_status,
      pasta_retorno_data: formulario.pasta_retorno_data || null,
      pasta_retorno_motivo: formulario.pasta_retorno_motivo.trim() || null,
      pasta_retorno_descricao: formulario.pasta_retorno_descricao.trim() || null,
      pasta_retorno_responsabilidade: formulario.pasta_retorno_responsabilidade,
      pasta_retorno_documento_faltante: formulario.pasta_retorno_documento_faltante.trim() || null,
      pasta_retorno_data_regularizacao: formulario.pasta_retorno_data_regularizacao || null,
      pasta_retorno_data_reenvio: formulario.pasta_retorno_data_reenvio || null,
      pasta_retorno_observacao: formulario.pasta_retorno_observacao.trim() || null,
      pasta_retorno_impacto_sla: formulario.pasta_retorno_impacto_sla,
      protocolo_status: formulario.protocolo_status,
      numero: formulario.numero_processo.trim() || null,
      numero_processo: formulario.numero_processo.trim() || null,
      protocolo_data_liberacao: protocoloDataLiberacao,
      data_protocolo_liberado: dataProtocoloLiberado,
      tribunal: formulario.tribunal.trim() || null,
      comarca: formulario.comarca.trim() || null,
      vara: formulario.vara.trim() || null,
      link_consulta: formulario.link_consulta.trim() || null,
      link_processo: formulario.link_consulta.trim() || null,
      data_distribuicao: formulario.data_distribuicao || null,
      fase_atual: formulario.protocolo_status === "Liberado" ? "Protocolo Liberado" : etapaAtual({ ...(processoEditando || {}), documentos_elite_status: formulario.documentos_elite_status, data_envio_elite: dataEnvioElite, pasta_retorno_status: formulario.pasta_retorno_status, numero_processo: formulario.numero_processo, protocolo_status: formulario.protocolo_status } as Processo),
      status_judicial: formulario.protocolo_status === "Liberado" ? "TRAMITANDO" : processoEditando?.status_judicial || null,
      status_prazo: dataEnvioElite ? calcularPrazoElite(dataEnvioElite).rotulo : null,
      origem_registro: processoEditando?.origem_registro || "encaminhamento_processual",
      updated_by: usuario?.email || usuario?.nome || null,
    };

    const query = processoEditando
      ? supabase.from("processos").update(payload).eq("id", processoEditando.id)
      : supabase.from("processos").insert({ ...payload, created_by: usuario?.email || usuario?.nome || null });
    const { data, error } = await query.select("*").single();
    setSalvando(false);

    if (error) {
      showToast(`Não foi possível salvar o protocolo: ${error.message}`);
      return;
    }

    if (processoEditando) {
      await registrarAuditoria(String(processoEditando.id), usuario?.email || usuario?.nome || "Usuário", [
        ["Elite", processoEditando.documentos_elite_status, payload.documentos_elite_status],
        ["Prazo", processoEditando.sla_iniciado_em || processoEditando.data_envio_elite, payload.sla_iniciado_em],
        ["Pasta retornada", processoEditando.pasta_retorno_status, payload.pasta_retorno_status],
        ["Protocolo", processoEditando.numero_processo, payload.numero_processo],
      ]);
    } else if (data?.id) {
      await registrarAuditoria(String(data.id), usuario?.email || usuario?.nome || "Usuário", [["Encaminhamento", "", "Criado"]]);
    }


    if (data?.id) {
      const observacao = formulario.observacoes.trim();
      const descricaoHistorico = [
        `Etapa: ${payload.fase_atual || "Encaminhamento pendente"}`,
        `Documentação: ${formulario.documentacao_status}`,
        `Procuração: ${formulario.procuracao_status}`,
        `Elite: ${formulario.documentos_elite_status}`,
        `Protocolo: ${formulario.protocolo_status}`,
        observacao ? `Observações: ${observacao}` : null,
      ].filter(Boolean).join(" · ");
      const historico = await supabase.from("clientes_historico").insert({ cliente_id: clienteVinculado.id, processo_id: data.id, tipo: "protocolo", descricao: descricaoHistorico, origem: "Módulo Protocolos", created_by: usuario?.email || usuario?.nome || null });
      if (historico.error) showToast(`Protocolo salvo, mas o histórico do cliente não pôde ser atualizado: ${historico.error.message}`);
    }

    void sincronizarClienteDoProcesso(supabase, data as Processo, usuario).catch((erro) => {
      console.warn("Falha ao sincronizar cliente/processo", erro);
    });
    onProcessoAtualizado(data as Processo);
    setModalAberto(false);
    setProcessoEditando(null);
    showToast("Protocolo salvo.");
  }

  const indiceEtapa = ETAPAS_FORMULARIO.findIndex(([chave]) => chave === etapaFormulario);
  const etapaAnterior = indiceEtapa > 0 ? ETAPAS_FORMULARIO[indiceEtapa - 1][0] : null;
  const proximaEtapa = indiceEtapa < ETAPAS_FORMULARIO.length - 1 ? ETAPAS_FORMULARIO[indiceEtapa + 1][0] : null;

  return (
    <div className="protocolos-view protocolos-grid-view">
      <div className="protocolos-toolbar protocolos-page-title">
        <FormField><span>Buscar protocolo</span><Input value={busca} onChange={(event) => onBusca(event.target.value)} placeholder="Cliente, ID ou banco" /></FormField>
        <div className="protocolos-actions">
          <button className="btn-primary" onClick={abrirNovoCadastro} type="button">Novo encaminhamento</button>
        </div>
      </div>

      {carregandoDetalhe ? <p role="status">Carregando detalhes...</p> : null}
      <div className="protocolos-kanban">
        {COLUNAS_PROTOCOLO.map((coluna) => {
          const itens = protocolos.filter((processo) => processo.etapa === coluna);
          return <section className="protocolo-kanban-coluna" key={coluna}>
            <header><h3>{coluna}</h3><span>{itens.length}</span></header>
            <div className="protocolo-kanban-lista">
              {itens.map((processo) => {
                const dias = processo.dias_na_etapa || 0;
                return <button className="protocolo-list-item" key={processo.id} type="button" onClick={() => void abrirDetalhe(processo)} aria-label={`Abrir protocolo de ${processo.nome_cliente}`}>
                  <span className="protocolo-list-identidade"><strong>{processo.nome_cliente}</strong><small> ? {processo.id_crm || processo.id}</small></span>
                  <span className="protocolo-list-banco">{formatarParteContraria(processo.banco_reu) || "Instituição não informada"}</span>
                  <span className="protocolo-list-tempo">{dias} {dias === 1 ? "dia" : "dias"}</span>
                  <span className="protocolo-list-badge">{processo.status_principal || "Em preparação"}</span>
                  <span className="protocolo-list-abrir" aria-hidden="true">&#8250;</span>
                </button>;
              })}
              {!itens.length && <p className="kanban-vazio">Nenhum protocolo nesta etapa.</p>}
            </div>
          </section>;
        })}
      </div>

      {processoVisualizando ? <div className="esteira-modal-backdrop" role="presentation"><section className="esteira-modal protocolo-visualizacao" role="dialog" aria-modal="true" aria-label="Visualização do protocolo"><button className="modal-close" onClick={() => setProcessoVisualizando(null)} type="button">×</button><span className="eyebrow">Progresso do encaminhamento</span><h3>{processoVisualizando.nome_cliente}</h3><p>{processoVisualizando.banco_reu || "Instituição não informada"}</p><div className="protocolo-progress-heading"><div><strong>Ordem de progresso</strong><small>Acompanhe a preparação para distribuição.</small></div><b>{Math.round((ETAPAS_FORMULARIO.filter(([chave]) => timelineConcluida(chave, processoVisualizando)).length / ETAPAS_FORMULARIO.length) * 100)}%</b></div><div className="protocolo-progress-list">{ETAPAS_FORMULARIO.map(([chave, rotulo]) => { const concluida = timelineConcluida(chave, processoVisualizando); const atual = chave === proximaEtapaPendente(processoVisualizando); return <div className={concluida ? "done" : atual ? "current" : "pending"} key={chave}><span className="protocolo-progress-marker">{concluida ? "✓" : ""}</span><div><strong>{rotulo}</strong><small>{detalheEtapaProtocolo(chave, processoVisualizando)}</small></div></div>; })}</div>{processoVisualizando.documentacao_status === "Irregular" ? <section className="protocolo-view-alert"><h4>Irregularidade documental</h4><p>{processoVisualizando.documentacao_motivo || "Motivo não informado"}</p><small>{processoVisualizando.documentacao_faltantes ? `Documentos faltantes: ${processoVisualizando.documentacao_faltantes}` : "Documentos faltantes não informados"}</small></section> : null}<section className="protocolo-view-observacoes"><h4>Observações</h4><p>{processoVisualizando.observacoes || processoVisualizando.documentacao_observacao || processoVisualizando.pasta_retorno_observacao || "Nenhuma observação registrada."}</p></section><FormActions><button className="btn-secondary" onClick={() => setProcessoVisualizando(null)} type="button">Fechar</button><button className="btn-primary" onClick={() => { const atual = processoVisualizando; setProcessoVisualizando(null); abrirEdicao(atual); }} type="button">Editar protocolo</button></FormActions></section></div> : null}

      {modalAberto && (
        <div className="esteira-modal-backdrop" role="presentation">
          <FormSection as="form" className="esteira-modal protocolo-modal protocolo-modal-wide" onSubmit={salvarCadastro}>
            <button className="modal-close" onClick={() => setModalAberto(false)} type="button">×</button>
            <span className="eyebrow">{processoEditando ? "Editar protocolo" : "Novo encaminhamento"}</span>
            <h3>{processoEditando ? processoEditando.nome_cliente : "Encaminhar cliente para ajuizamento"}</h3>

            <div className="protocolo-timeline" aria-label="Esteira de ajuizamento">
              {ETAPAS_FORMULARIO.map(([chave, rotulo]) => {
                const contexto = { ...(processoEditando || {}), ...formulario } as Processo;
                const concluida = timelineConcluida(chave, contexto);
                return <button className={`${etapaFormulario === chave ? "active" : ""} ${concluida ? "done" : ""}`} key={chave} onClick={() => setEtapaFormulario(chave)} type="button"><span>{concluida ? "✓" : ""}</span><div><strong>{rotulo}</strong><small>{concluida ? "Concluída" : etapaFormulario === chave ? "Em andamento" : "Aguardando"}</small></div></button>;
              })}
            </div>

            {etapaFormulario === "dados" ? <FormSection className="protocolo-form-section">
              <h4>Dados do encaminhamento</h4>
              <FormGrid className="protocolo-modal-grid">
                <FormField><span>Cliente *</span><Input value={formulario.nome_cliente} onChange={(e) => setFormulario((f) => ({ ...f, nome_cliente: e.target.value }))} /></FormField>
                <FormField><span>CPF</span><Input value={formulario.cpf_cliente} onChange={(e) => setFormulario((f) => ({ ...f, cpf_cliente: e.target.value }))} /></FormField>
                <FormField><span>ID CRM</span><Input value={formulario.id_crm} onChange={(e) => setFormulario((f) => ({ ...f, id_crm: e.target.value }))} /></FormField>
                <FormField><span>Link da pasta no Drive</span><Input value={formulario.link_pasta_cliente} onChange={(e) => setFormulario((f) => ({ ...f, link_pasta_cliente: e.target.value }))} placeholder="https://drive.google.com/..." /></FormField>
                <FormField><span>Instituição financeira *</span><Input value={formulario.banco_reu} onChange={(e) => setFormulario((f) => ({ ...f, banco_reu: e.target.value }))} /></FormField>
                <FormField><span>Produto</span><Input value={formulario.produto} onChange={(e) => setFormulario((f) => ({ ...f, produto: e.target.value }))} /></FormField>
                <FormField><span>Número do contrato</span><Input value={formulario.numero_contrato} onChange={(e) => setFormulario((f) => ({ ...f, numero_contrato: e.target.value }))} /></FormField>
                <FormField><span>Motivo do ajuizamento</span><Select value={formulario.motivo_ajuizamento} onChange={(e) => setFormulario((f) => ({ ...f, motivo_ajuizamento: e.target.value }))}>{MOTIVOS_AJUIZAMENTO.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField><span>Responsável</span><Input value={formulario.responsavel} onChange={(e) => setFormulario((f) => ({ ...f, responsavel: e.target.value }))} /></FormField>
                <FormField className="wide"><span>Observação</span><Textarea rows={2} value={formulario.observacoes} onChange={(e) => setFormulario((f) => ({ ...f, observacoes: e.target.value }))} /></FormField>
              </FormGrid>
            </FormSection> : null}

            {etapaFormulario === "documentacao" ? <FormSection className="protocolo-form-section">
              <h4>Documentação</h4>
              <FormGrid className="protocolo-modal-grid">
                <FormField><span>Status</span><Select value={formulario.documentacao_status} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_status: e.target.value }))}>{STATUS_DOCUMENTACAO.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                {formulario.documentacao_status === "Irregular" ? <>
                  <FormField><span>Motivo</span><Input value={formulario.documentacao_motivo} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_motivo: e.target.value }))} /></FormField>
                  <FormField><span>Documentos faltantes</span><Input value={formulario.documentacao_faltantes} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_faltantes: e.target.value }))} /></FormField>
                  <FormField><span>Responsabilidade</span><Select value={formulario.documentacao_responsabilidade} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_responsabilidade: e.target.value }))}>{RESPONSABILIDADES.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                  <FormField><span>Data</span><Input type="date" value={formulario.documentacao_data} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_data: e.target.value }))} /></FormField>
                  <FormField className="wide"><span>Observação</span><Textarea rows={2} value={formulario.documentacao_observacao} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_observacao: e.target.value }))} /></FormField>
                </> : null}
              </FormGrid>
            </FormSection> : null}

            {etapaFormulario === "procuracao" ? <FormSection className="protocolo-form-section">
              <h4>Procurações e declarações</h4>
              <FormGrid className="protocolo-modal-grid">
                <FormField><span>Procuração</span><Select value={formulario.procuracao_status} onChange={(e) => setFormulario((f) => ({ ...f, procuracao_status: e.target.value }))}>{STATUS_PROCURACAO.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField><span>Declaração de hipossuficiência</span><Select value={formulario.declaracao_hipossuficiencia_status} onChange={(e) => setFormulario((f) => ({ ...f, declaracao_hipossuficiencia_status: e.target.value }))}>{STATUS_PROCURACAO.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField><span>Declaração de IR</span><Select value={formulario.declaracao_ir_status} onChange={(e) => setFormulario((f) => ({ ...f, declaracao_ir_status: e.target.value }))}>{STATUS_PROCURACAO.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField className="wide"><span>Outros configuráveis</span><Input value={formulario.procuracoes_outros} onChange={(e) => setFormulario((f) => ({ ...f, procuracoes_outros: e.target.value }))} placeholder="Ex.: declaração adicional, termo específico..." /></FormField>
              </FormGrid>
            </FormSection> : null}

            {etapaFormulario === "crm" ? <FormSection className="protocolo-form-section">
              <h4>Conferência no CRM</h4>
              <FormGrid className="protocolo-modal-grid">
                <FormField><span>Documentos conferidos/anexados no Drive</span><Select value={formulario.crm_documentos_status} onChange={(e) => setFormulario((f) => ({ ...f, crm_documentos_status: e.target.value }))}>{STATUS_CRM.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <div className="sla-preview"><span>Armazenamento</span><strong>Google Drive</strong><small>O sistema registra apenas a conferência. Os arquivos permanecem na pasta oficial do cliente.</small></div>
              </FormGrid>
            </FormSection> : null}

            {etapaFormulario === "elite" ? <FormSection className="protocolo-form-section">
              <h4>Encaminhamento à Elite</h4>
              <FormGrid className="protocolo-modal-grid">
                <FormField><span>Elite</span><Select value={formulario.documentos_elite_status} onChange={(e) => setFormulario((f) => ({ ...f, documentos_elite_status: e.target.value }))}>{STATUS_ELITE.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <div className="sla-preview">
                  <span>Enviado</span><strong>{formatarDataHora(processoEditando?.data_envio_elite)}</strong>
                  <small>Ao marcar como Enviado e salvar, o prazo de 15 dias úteis inicia automaticamente.</small>
                </div>
              </FormGrid>
            </FormSection> : null}

            {etapaFormulario === "sla" ? <FormSection className="protocolo-form-section">
              <h4>Controle do prazo</h4>
              {processoEditando?.data_envio_elite ? (() => {
                const prazo = calcularPrazoElite(processoEditando.data_envio_elite);
                return <div className="protocolo-sla-resumo"><div><span>Data inicial</span><strong>{formatarDataHora(processoEditando.data_envio_elite)}</strong></div><div><span>Dias úteis decorridos</span><strong>{prazo.diasUteisDecorridos}</strong></div><div><span>Prazo restante</span><strong>{prazo.diasUteisRestantes}</strong></div><div><span>Data prevista</span><strong>{formatarData(prazo.dataPrevista)}</strong></div><div><span>Situação</span><strong className={`sla-status ${classeSla(prazo.sinalizacao)}`}>{prazo.rotulo}</strong></div></div>;
              })() : <div className="empty-row">O prazo começará quando o encaminhamento à Elite for marcado como Enviado e salvo.</div>}
            </FormSection> : null}

            {etapaFormulario === "retorno" ? <FormSection className="protocolo-form-section">
              <h4>Pasta retornada</h4>
              <FormGrid className="protocolo-modal-grid">
                <FormField><span>Status</span><Select value={formulario.pasta_retorno_status} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_status: e.target.value }))}>{STATUS_RETORNO.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField><span>Data do retorno</span><Input type="date" value={formulario.pasta_retorno_data} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_data: e.target.value }))} /></FormField>
                <FormField><span>Motivo</span><Input value={formulario.pasta_retorno_motivo} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_motivo: e.target.value }))} /></FormField>
                <FormField><span>Responsabilidade</span><Select value={formulario.pasta_retorno_responsabilidade} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_responsabilidade: e.target.value }))}>{RESPONSABILIDADES.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField><span>Documento faltante</span><Input value={formulario.pasta_retorno_documento_faltante} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_documento_faltante: e.target.value }))} /></FormField>
                <FormField><span>Impacto no prazo</span><Select value={formulario.pasta_retorno_impacto_sla} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_impacto_sla: e.target.value }))}>{IMPACTO_SLA.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField><span>Data da regularização</span><Input type="date" value={formulario.pasta_retorno_data_regularizacao} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_data_regularizacao: e.target.value }))} /></FormField>
                <FormField><span>Data do reenvio</span><Input type="date" value={formulario.pasta_retorno_data_reenvio} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_data_reenvio: e.target.value }))} /></FormField>
                <FormField className="wide"><span>Descrição/observação</span><Textarea rows={2} value={formulario.pasta_retorno_descricao || formulario.pasta_retorno_observacao} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_descricao: e.target.value, pasta_retorno_observacao: e.target.value }))} /></FormField>
              </FormGrid>
            </FormSection> : null}

            {etapaFormulario === "protocolo" ? <FormSection className="protocolo-form-section">
              <h4>Liberação do protocolo</h4>
              <FormGrid className="protocolo-modal-grid">
                <FormField><span>Status do protocolo</span><Select value={formulario.protocolo_status} onChange={(e) => setFormulario((f) => ({ ...f, protocolo_status: e.target.value }))}>{STATUS_PROTOCOLO.map((item) => <option key={item}>{item}</option>)}</Select></FormField>
                <FormField><span>Número do processo *</span><Input value={formulario.numero_processo} onChange={(e) => setFormulario((f) => ({ ...f, numero_processo: e.target.value }))} /></FormField>
                <FormField><span>Data da liberação *</span><Input type="datetime-local" value={formulario.protocolo_data_liberacao} onChange={(e) => setFormulario((f) => ({ ...f, protocolo_data_liberacao: e.target.value }))} /></FormField>
              </FormGrid>
            </FormSection> : null}

            {etapaFormulario === "distribuicao" ? <FormSection className="protocolo-form-section">
              <h4>Dados da distribuição</h4>
              <FormGrid className="protocolo-modal-grid">
                <FormField><span>Tribunal</span><Input value={formulario.tribunal} onChange={(e) => setFormulario((f) => ({ ...f, tribunal: e.target.value }))} /></FormField>
                <FormField><span>Comarca</span><Input value={formulario.comarca} onChange={(e) => setFormulario((f) => ({ ...f, comarca: e.target.value }))} /></FormField>
                <FormField><span>Vara</span><Input value={formulario.vara} onChange={(e) => setFormulario((f) => ({ ...f, vara: e.target.value }))} /></FormField>
                <FormField><span>Link do processo</span><Input value={formulario.link_consulta} onChange={(e) => setFormulario((f) => ({ ...f, link_consulta: e.target.value }))} placeholder="Link de consulta no tribunal" /></FormField>
                <FormField><span>Data da distribuição</span><Input type="date" value={formulario.data_distribuicao} onChange={(e) => setFormulario((f) => ({ ...f, data_distribuicao: e.target.value }))} /></FormField>
              </FormGrid>
            </FormSection> : null}

            <FormActions className="protocolo-modal-actions">
              <button className="btn-secondary" onClick={() => setModalAberto(false)} type="button">Cancelar</button>
              <div className="protocolo-step-actions">
                {etapaAnterior ? <button className="btn-secondary" onClick={() => setEtapaFormulario(etapaAnterior)} type="button">Anterior</button> : null}
                {proximaEtapa ? <button className="btn-secondary" onClick={() => setEtapaFormulario(proximaEtapa)} type="button">Próxima etapa</button> : null}
                <button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : `Salvar ${ETAPAS_FORMULARIO[indiceEtapa][1]}`}</button>
              </div>
            </FormActions>
          </FormSection>
        </div>
      )}
    </div>
  );
}
