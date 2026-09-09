import { FormEvent, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  type FaseProcessual,
  type Processo,
  calcularPrazoElite,
  contarDiasUteisEntre,
} from "../../lib/esteiraProcessual";

type Props = {
  processos: Processo[];
  onProcessoAtualizado: (processo: Processo) => void;
  showToast: (mensagem: string) => void;
  usuario?: { nome?: string; email?: string };
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

const TIMELINE = [
  ["documentacao", "Documentação"],
  ["procuracao", "Procuração"],
  ["crm", "CRM"],
  ["elite", "Elite"],
  ["sla", "SLA"],
  ["retorno", "Pasta retornada"],
  ["protocolo", "Protocolo"],
  ["distribuicao", "Distribuição"],
];

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

function normalizar(valor = "") {
  return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
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

function classeSla(sinalizacao: string) {
  if (sinalizacao === "atencao") return "atencao";
  if (sinalizacao === "critico") return "critico";
  if (sinalizacao === "vermelho" || sinalizacao === "atrasado") return "atrasado";
  return "neutro";
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
    descricao: `${usuario || "Usuário"} alterou ${campo}: "${anterior || "vazio"}" → "${novo || "vazio"}"`,
  }));

  await supabase.from("movimentacoes").insert(registros);
}

export default function EsteiraKanban({
  processos,
  onProcessoAtualizado,
  showToast,
  usuario,
}: Props) {
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [processoEditando, setProcessoEditando] = useState<Processo | null>(null);
  const [formulario, setFormulario] = useState(criarFormulario(null, usuario?.nome || ""));
  const [salvando, setSalvando] = useState(false);

  const protocolos = useMemo(() => {
    const termo = normalizar(busca);
    return processos.filter((processo) => (
      processo.origem_registro === "encaminhamento_processual"
    )).filter((processo) => {
      if (!termo) return true;
      return [
        processo.nome_cliente,
        processo.cpf_cliente,
        processo.id_crm,
        processo.pasta_cliente_id,
        processo.link_pasta_cliente,
        processo.banco_reu,
        processo.numero_processo,
        processo.responsavel,
      ].some((valor) => normalizar(valor || "").includes(termo));
    });
  }, [busca, processos]);

  function abrirNovoCadastro() {
    setProcessoEditando(null);
    setFormulario(criarFormulario(null, usuario?.nome || ""));
    setModalAberto(true);
  }

  function abrirEdicao(processo: Processo) {
    setProcessoEditando(processo);
    setFormulario(criarFormulario(processo, usuario?.nome || ""));
    setModalAberto(true);
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
      status_judicial: formulario.protocolo_status === "Liberado" ? "TRAMITANDO" : null,
      status_prazo: dataEnvioElite ? calcularPrazoElite(dataEnvioElite).rotulo : null,
      origem_registro: processoEditando?.origem_registro || "encaminhamento_processual",
      updated_by: usuario?.email || usuario?.nome || null,
    };

    setSalvando(true);
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
        ["SLA", processoEditando.sla_iniciado_em || processoEditando.data_envio_elite, payload.sla_iniciado_em],
        ["Pasta retornada", processoEditando.pasta_retorno_status, payload.pasta_retorno_status],
        ["Protocolo", processoEditando.numero_processo, payload.numero_processo],
      ]);
    } else if (data?.id) {
      await registrarAuditoria(String(data.id), usuario?.email || usuario?.nome || "Usuário", [["Encaminhamento", "", "Criado"]]);
    }

    onProcessoAtualizado(data as Processo);
    setModalAberto(false);
    setProcessoEditando(null);
    showToast("Protocolo salvo.");
  }

  return (
    <div className="protocolos-view protocolos-grid-view">
      <div className="protocolos-toolbar protocolos-page-title">
        <div>
          <span className="eyebrow">Protocolos</span>
          <h2>Controle de preparação, encaminhamento e liberação de processos judiciais.</h2>
        </div>
        <label>
          <span>Pesquisar</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Cliente, CPF, ID, banco ou processo"
          />
        </label>
        <div className="protocolos-actions">
          <button className="btn-primary" onClick={abrirNovoCadastro} type="button">Novo encaminhamento</button>
          <button className="btn-secondary" onClick={abrirNovoCadastro} type="button">Cadastrar processo existente</button>
        </div>
      </div>

      <div className="protocolos-kanban">
        {(["A Fazer", "Fazendo", "Concluído"] as const).map((coluna) => {
          const itens = protocolos.filter((processo) => {
            if (processo.numero_processo || processo.protocolo_status === "Liberado") return coluna === "Concluído";
            const fazendo = Boolean(processo.data_envio_elite || processo.pasta_retornada || processo.documentacao_status === "Regular" || processo.status_documentos === "Regular");
            return coluna === (fazendo ? "Fazendo" : "A Fazer");
          });
          return <section className="protocolo-kanban-coluna" key={coluna}>
            <header><h3>{coluna}</h3><span>{itens.length}</span></header>
            <button className="kanban-nova-atividade" onClick={abrirNovoCadastro} type="button">+ Novo protocolo</button>
            <div className="protocolo-kanban-lista">
              {itens.map((processo) => {
                const prazo = calcularPrazoElite(processo.data_envio_elite);
                return <article className="protocolo-kanban-card" key={processo.id}>
                  <header><strong>{processo.nome_cliente}</strong><button type="button" onClick={() => abrirEdicao(processo)}>Editar</button></header>
                  <span>{processo.banco_reu || "Instituição não informada"}</span>
                  <div className="protocolo-card-status"><small>Documentação</small><b>{processo.documentacao_status || processo.status_documentos || "Pendente"}</b></div>
                  <div className="protocolo-card-status"><small>Procuração</small><b>{processo.procuracao_status || processo.status_procuracao || "Pendente"}</b></div>
                  <div className="protocolo-card-status"><small>Etapa</small><b>{etapaAtual(processo)}</b></div>
                  {processo.data_envio_elite && <div className={`sla-cell ${classeSla(prazo.sinalizacao)}`}><span>{prazo.rotulo}</span><small>Início: {formatarDataHora(processo.data_envio_elite)} · {prazo.diasUteisDecorridos} decorridos · {prazo.diasUteisRestantes} restantes</small></div>}
                  {processo.pasta_retornada && <em>Retornado para correção{processo.pasta_retorno_motivo ? `: ${processo.pasta_retorno_motivo}` : ""}</em>}
                  {processo.numero_processo && <code>{processo.numero_processo}</code>}
                </article>;
              })}
              {!itens.length && <p className="kanban-vazio">Nenhum protocolo nesta etapa.</p>}
            </div>
          </section>;
        })}
      </div>

      {modalAberto && (
        <div className="esteira-modal-backdrop" role="presentation">
          <form className="esteira-modal protocolo-modal protocolo-modal-wide" onSubmit={salvarCadastro}>
            <button className="modal-close" onClick={() => setModalAberto(false)} type="button">×</button>
            <span className="eyebrow">{processoEditando ? "Editar protocolo" : "Novo encaminhamento"}</span>
            <h3>{processoEditando ? processoEditando.nome_cliente : "Encaminhar cliente para ajuizamento"}</h3>

            <div className="protocolo-timeline" aria-label="Esteira de ajuizamento">
              {TIMELINE.map(([chave, rotulo]) => (
                <span className={processoEditando && timelineConcluida(chave, { ...processoEditando, ...formulario } as Processo) ? "done" : ""} key={chave}>{rotulo}</span>
              ))}
            </div>

            <section className="protocolo-form-section">
              <h4>Dados do encaminhamento</h4>
              <div className="protocolo-modal-grid">
                <label><span>Cliente *</span><input value={formulario.nome_cliente} onChange={(e) => setFormulario((f) => ({ ...f, nome_cliente: e.target.value }))} /></label>
                <label><span>CPF</span><input value={formulario.cpf_cliente} onChange={(e) => setFormulario((f) => ({ ...f, cpf_cliente: e.target.value }))} /></label>
                <label><span>ID CRM</span><input value={formulario.id_crm} onChange={(e) => setFormulario((f) => ({ ...f, id_crm: e.target.value }))} /></label>
                <label><span>Link da pasta no Drive</span><input value={formulario.link_pasta_cliente} onChange={(e) => setFormulario((f) => ({ ...f, link_pasta_cliente: e.target.value }))} placeholder="https://drive.google.com/..." /></label>
                <label><span>Instituição financeira *</span><input value={formulario.banco_reu} onChange={(e) => setFormulario((f) => ({ ...f, banco_reu: e.target.value }))} /></label>
                <label><span>Produto</span><input value={formulario.produto} onChange={(e) => setFormulario((f) => ({ ...f, produto: e.target.value }))} /></label>
                <label><span>Número do contrato</span><input value={formulario.numero_contrato} onChange={(e) => setFormulario((f) => ({ ...f, numero_contrato: e.target.value }))} /></label>
                <label><span>Motivo do ajuizamento</span><select value={formulario.motivo_ajuizamento} onChange={(e) => setFormulario((f) => ({ ...f, motivo_ajuizamento: e.target.value }))}>{MOTIVOS_AJUIZAMENTO.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Responsável</span><input value={formulario.responsavel} onChange={(e) => setFormulario((f) => ({ ...f, responsavel: e.target.value }))} /></label>
                <label className="wide"><span>Observação</span><textarea rows={2} value={formulario.observacoes} onChange={(e) => setFormulario((f) => ({ ...f, observacoes: e.target.value }))} /></label>
              </div>
            </section>

            <section className="protocolo-form-section">
              <h4>Documentação</h4>
              <div className="protocolo-modal-grid">
                <label><span>Status</span><select value={formulario.documentacao_status} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_status: e.target.value }))}>{STATUS_DOCUMENTACAO.map((item) => <option key={item}>{item}</option>)}</select></label>
                {formulario.documentacao_status === "Irregular" ? <>
                  <label><span>Motivo</span><input value={formulario.documentacao_motivo} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_motivo: e.target.value }))} /></label>
                  <label><span>Documentos faltantes</span><input value={formulario.documentacao_faltantes} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_faltantes: e.target.value }))} /></label>
                  <label><span>Responsabilidade</span><select value={formulario.documentacao_responsabilidade} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_responsabilidade: e.target.value }))}>{RESPONSABILIDADES.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label><span>Data</span><input type="date" value={formulario.documentacao_data} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_data: e.target.value }))} /></label>
                  <label className="wide"><span>Observação</span><textarea rows={2} value={formulario.documentacao_observacao} onChange={(e) => setFormulario((f) => ({ ...f, documentacao_observacao: e.target.value }))} /></label>
                </> : null}
              </div>
            </section>

            <section className="protocolo-form-section">
              <h4>Procurações e declarações</h4>
              <div className="protocolo-modal-grid">
                <label><span>Procuração</span><select value={formulario.procuracao_status} onChange={(e) => setFormulario((f) => ({ ...f, procuracao_status: e.target.value }))}>{STATUS_PROCURACAO.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Declaração de hipossuficiência</span><select value={formulario.declaracao_hipossuficiencia_status} onChange={(e) => setFormulario((f) => ({ ...f, declaracao_hipossuficiencia_status: e.target.value }))}>{STATUS_PROCURACAO.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Declaração de IR</span><select value={formulario.declaracao_ir_status} onChange={(e) => setFormulario((f) => ({ ...f, declaracao_ir_status: e.target.value }))}>{STATUS_PROCURACAO.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="wide"><span>Outros configuráveis</span><input value={formulario.procuracoes_outros} onChange={(e) => setFormulario((f) => ({ ...f, procuracoes_outros: e.target.value }))} placeholder="Ex.: declaração adicional, termo específico..." /></label>
              </div>
            </section>

            <section className="protocolo-form-section">
              <h4>CRM, Elite e SLA</h4>
              <div className="protocolo-modal-grid">
                <label><span>Documentos conferidos/anexados no Drive</span><select value={formulario.crm_documentos_status} onChange={(e) => setFormulario((f) => ({ ...f, crm_documentos_status: e.target.value }))}>{STATUS_CRM.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Elite</span><select value={formulario.documentos_elite_status} onChange={(e) => setFormulario((f) => ({ ...f, documentos_elite_status: e.target.value }))}>{STATUS_ELITE.map((item) => <option key={item}>{item}</option>)}</select></label>
                <div className="sla-preview">
                  <span>Enviado</span><strong>{formatarDataHora(processoEditando?.data_envio_elite)}</strong>
                  <small>O sistema registra a conferência; os arquivos permanecem na pasta do cliente no Drive. Ao marcar Enviado, o SLA de 20 dias úteis inicia automaticamente.</small>
                </div>
              </div>
            </section>

            <section className="protocolo-form-section">
              <h4>Pasta retornada</h4>
              <div className="protocolo-modal-grid">
                <label><span>Status</span><select value={formulario.pasta_retorno_status} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_status: e.target.value }))}>{STATUS_RETORNO.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Data do retorno</span><input type="date" value={formulario.pasta_retorno_data} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_data: e.target.value }))} /></label>
                <label><span>Motivo</span><input value={formulario.pasta_retorno_motivo} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_motivo: e.target.value }))} /></label>
                <label><span>Responsabilidade</span><select value={formulario.pasta_retorno_responsabilidade} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_responsabilidade: e.target.value }))}>{RESPONSABILIDADES.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Documento faltante</span><input value={formulario.pasta_retorno_documento_faltante} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_documento_faltante: e.target.value }))} /></label>
                <label><span>Impacto no SLA</span><select value={formulario.pasta_retorno_impacto_sla} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_impacto_sla: e.target.value }))}>{IMPACTO_SLA.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Data da regularização</span><input type="date" value={formulario.pasta_retorno_data_regularizacao} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_data_regularizacao: e.target.value }))} /></label>
                <label><span>Data do reenvio</span><input type="date" value={formulario.pasta_retorno_data_reenvio} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_data_reenvio: e.target.value }))} /></label>
                <label className="wide"><span>Descrição/observação</span><textarea rows={2} value={formulario.pasta_retorno_descricao || formulario.pasta_retorno_observacao} onChange={(e) => setFormulario((f) => ({ ...f, pasta_retorno_descricao: e.target.value, pasta_retorno_observacao: e.target.value }))} /></label>
              </div>
            </section>

            <section className="protocolo-form-section">
              <h4>Protocolo e distribuição</h4>
              <div className="protocolo-modal-grid">
                <label><span>Status do protocolo</span><select value={formulario.protocolo_status} onChange={(e) => setFormulario((f) => ({ ...f, protocolo_status: e.target.value }))}>{STATUS_PROTOCOLO.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Número do processo *</span><input value={formulario.numero_processo} onChange={(e) => setFormulario((f) => ({ ...f, numero_processo: e.target.value }))} /></label>
                <label><span>Data da liberação *</span><input type="datetime-local" value={formulario.protocolo_data_liberacao} onChange={(e) => setFormulario((f) => ({ ...f, protocolo_data_liberacao: e.target.value }))} /></label>
                <label><span>Tribunal</span><input value={formulario.tribunal} onChange={(e) => setFormulario((f) => ({ ...f, tribunal: e.target.value }))} /></label>
                <label><span>Comarca</span><input value={formulario.comarca} onChange={(e) => setFormulario((f) => ({ ...f, comarca: e.target.value }))} /></label>
                <label><span>Vara</span><input value={formulario.vara} onChange={(e) => setFormulario((f) => ({ ...f, vara: e.target.value }))} /></label>
                <label><span>Link do processo</span><input value={formulario.link_consulta} onChange={(e) => setFormulario((f) => ({ ...f, link_consulta: e.target.value }))} placeholder="Link de consulta no tribunal" /></label>
                <label><span>Data da distribuição</span><input type="date" value={formulario.data_distribuicao} onChange={(e) => setFormulario((f) => ({ ...f, data_distribuicao: e.target.value }))} /></label>
              </div>
            </section>

            <footer className="protocolo-modal-actions">
              <button className="btn-secondary" onClick={() => setModalAberto(false)} type="button">Cancelar</button>
              <button className="btn-primary" disabled={salvando} type="submit">{salvando ? "Salvando..." : "Salvar protocolo"}</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
