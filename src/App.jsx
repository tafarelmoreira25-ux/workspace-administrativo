import AcompanhamentoEquipe from './AcompanhamentoEquipe';
import MeuPlanner from './MeuPlanner';
import PainelEquipeTV from './PainelEquipeTV';
import ClienteDriveSelector from './components/ClienteDriveSelector';
import { GOOGLE_DRIVE_CLIENTES_ROOT_URL } from './lib/googleDriveClients';
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { criarResumoBoasVindas } from "./homeGreeting";
import {
  STATUS_TASKMANAGER,
  obterEtapaTaskManager,
  obterStatusTaskManager,
  tarefaNoMacroStatus,
} from "./taskWorkflow";

const GeradorDocumentos = lazy(() => import("./GeradorDocumentos"));
const ProcessualGerador = lazy(() => import("./ProcessualGerador"));

// ==========================================
// 1. CONFIGURAÇÕES E CONEXÕES
// ==========================================
const ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL || "tafarel@platino.com"
).toLowerCase();
const NOMES_SUPERVISORES = ["tafarel", "nicolas"];
const ITENS_POR_PAGINA = 15;
const TEMPO_LIMITE_INICIALIZACAO_MS = 8_000;
const RESPONSABILIDADE_MENSAL_PREFIXO = "__RESPONSABILIDADE_MENSAL__";
const CATEGORIAS_TAREFA = [
  "CONTRATO",
  "NOTIFICAÇÃO EXTRAJUDICIAL",
  "GOV",
  "NOTIFICAÇÃO DE REQUERIMENTO (E-MAIL)",
  "CANCELAMENTO DE SEGURO",
  "DOCUMENTOS",
  "AUXILIAR CLIENTE",
  "PROCURAÇÕES",
  "ENCAMINHAR PROCESSUAL",
  "ATUALIZAÇÃO PROCESSUAL",
  "CITAÇÃO",
  "LAUDO",
  "TERMOS",
  "AGENDAR AUDIÊNCIA",
  "DISTRATO",
  "CERTIDÃO",
  "HOMOLOGAÇÃO",
  "CLIENTE SOLICITA RETORNO",
  "OUTROS",
];
const ACOES_TAREFA_VISUAIS = [
  { valor: "CONTRATO", icone: "📄", rotulo: "Contrato" },
  { valor: "NOTIFICAÇÃO EXTRAJUDICIAL", icone: "✉️", rotulo: "Notificação extrajudicial" },
  { valor: "GOV", icone: "🏛️", rotulo: "GOV" },
  { valor: "NOTIFICAÇÃO DE REQUERIMENTO (E-MAIL)", icone: "📧", rotulo: "Notificação de requerimento" },
  { valor: "CANCELAMENTO DE SEGURO", icone: "🛡️", rotulo: "Cancelamento de seguro" },
  { valor: "DOCUMENTOS", icone: "📁", rotulo: "Documentos" },
  { valor: "AUXILIAR CLIENTE", icone: "🤝", rotulo: "Auxiliar cliente" },
  { valor: "PROCURAÇÕES", icone: "🖋️", rotulo: "Procurações" },
  { valor: "ENCAMINHAR PROCESSUAL", icone: "⚖️", rotulo: "Encaminhar processual" },
  { valor: "ATUALIZAÇÃO PROCESSUAL", icone: "🔄", rotulo: "Atualização processual" },
  { valor: "CITAÇÃO", icone: "📩", rotulo: "Citação" },
  { valor: "LAUDO", icone: "📋", rotulo: "Laudo" },
  { valor: "TERMOS", icone: "📝", rotulo: "Termos" },
  { valor: "AGENDAR AUDIÊNCIA", icone: "📅", rotulo: "Agendar audiência" },
  { valor: "DISTRATO", icone: "❌", rotulo: "Distrato" },
  { valor: "CERTIDÃO", icone: "📜", rotulo: "Certidão" },
  { valor: "HOMOLOGAÇÃO", icone: "✅", rotulo: "Homologação" },
  { valor: "CLIENTE SOLICITA RETORNO", icone: "📞", rotulo: "Cliente solicita retorno" },
  { valor: "OUTROS", icone: "📌", rotulo: "Outros" },
];
const PRIORIDADES_VISUAIS = [
  { valor: "baixa", icone: "🟢", rotulo: "Baixa" },
  { valor: "normal", icone: "🔵", rotulo: "Normal" },
  { valor: "alta", icone: "🟡", rotulo: "Alta" },
  { valor: "urgente", icone: "🔴", rotulo: "Urgente" },
  { valor: "critica", icone: "🔴", rotulo: "Crítica" },
];
const CODIGOS_TIPO_TAREFA = {
  "CONTRATO": "CONTRATO", "NOTIFICAÇÃO EXTRAJUDICIAL": "NOTIFICACAO_EXTRAJUDICIAL",
  "GOV": "GOV", "NOTIFICAÇÃO DE REQUERIMENTO (E-MAIL)": "NOTIFICACAO_EMAIL",
  "CANCELAMENTO DE SEGURO": "CANCELAMENTO_SEGURO", "DOCUMENTOS": "DOCUMENTOS",
  "AUXILIAR CLIENTE": "AUXILIAR_CLIENTE", "PROCURAÇÕES": "PROCURACOES",
  "ENCAMINHAR PROCESSUAL": "ENCAMINHAR_PROCESSUAL", "ATUALIZAÇÃO PROCESSUAL": "ATUALIZACAO_PROCESSUAL",
  "CITAÇÃO": "CITACAO", "LAUDO": "LAUDO", "TERMOS": "TERMOS",
  "AGENDAR AUDIÊNCIA": "AGENDAR_AUDIENCIA", "DISTRATO": "DISTRATO", "CERTIDÃO": "CERTIDAO",
  "HOMOLOGAÇÃO": "HOMOLOGACAO", "CLIENTE SOLICITA RETORNO": "CLIENTE_RETORNO", "OUTROS": "OUTROS",
};
const STATUS_TAREFA = [
  { valor: "nova", rotulo: "Nova" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "devolvida", rotulo: "Devolvida para correção" },
  { valor: "aguardando_cliente", rotulo: "Aguardando cliente" },
  { valor: "aguardando_banco", rotulo: "Aguardando banco" },
  { valor: "aguardando_judiciario", rotulo: "Aguardando Judiciário" },
  { valor: "impedida", rotulo: "Impedida" },
  { valor: "concluida", rotulo: "Concluída" },
  { valor: "cancelada", rotulo: "Cancelada" },
  { valor: "arquivada", rotulo: "Arquivada" },
];
const STATUS_ABERTOS = new Set([
  "pendente",
  "nova",
  "em_andamento",
  "devolvida",
  "aguardando_cliente",
  "aguardando_banco",
  "aguardando_judiciario",
  "impedida",
  "delegada",
  "recebida",
  "em_execucao",
  "aguardando_informacao",
  "devolvida_conferencia",
  "devolvida_correcao",
  "bloqueada",
]);
const FILTROS_TAREFAS_PRINCIPAIS = [
  ["pendentes", "Pendentes"],
  ["atrasadas", "Atrasadas"],
  ["arquivadas", "Perdidas / Arquivadas"],
];
const ROTULOS_FILTRO_TAREFAS = {
  vencem_hoje: "Vencem hoje",
  proximas_48h: "Próximas 48h",
  urgentes: "Urgentes",
  devolvidas: "Devolvidas",
  recem_delegadas: "Recém-delegadas",
  em_andamento: "Em andamento",
};
const MOTIVOS_DEVOLUCAO = [
  "Dados incorretos",
  "Documento faltante",
  "Documento ilegível",
  "Informação divergente",
  "Assinatura ausente",
  "Outro",
];
const DOCUMENTOS_INICIAIS = [
  { chave: "contrato_assinado", rotulo: "Contrato assinado" },
  { chave: "documento_identificacao", rotulo: "RG ou CNH" },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "comprovante_residencia", rotulo: "Comprovante de residência" },
  { chave: "comprovante_renda", rotulo: "Comprovante de renda" },
];
const BUCKET_IMAGENS_COMPROVACAO = "comprovacoes-tarefas";
const TAMANHO_MAXIMO_IMAGEM_COMPROVACAO = 5 * 1024 * 1024;
function limitarTempo(promise, tempoMs, mensagem) {
  let temporizador;
  const limite = new Promise((_, rejeitar) => {
    temporizador = window.setTimeout(() => rejeitar(new Error(mensagem)), tempoMs);
  });

  return Promise.race([promise, limite]).finally(() => {
    window.clearTimeout(temporizador);
  });
}

function obterDataLocalISO(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function tarefaAtrasada(tarefa) {
  if (!STATUS_ABERTOS.has(tarefa?.status) || !tarefa?.data_limite) return false;
  return tarefa.data_limite < obterDataLocalISO();
}

function urlGoogleDriveValida(url) {
  return /^https:\/\/(drive|docs)\.google\.com\//i.test(url?.trim() || "");
}

function tarefaExigeComprovacao(tarefa) {
  return tarefa?.requer_comprovacao !== false;
}

function parteNomeComprovante(valor, padrao) {
  const normalizado = String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalizado || padrao;
}

function nomeComprovanteDrive(tarefa) {
  return `${obterDataLocalISO()}_${parteNomeComprovante(tarefa.nome_cliente, "CLIENTE")}_${parteNomeComprovante(tarefa.titulo, "TAREFA")}_CONCLUIDA_EQUIPE.pdf`;
}

function validarEntregaPop(entrega, tarefa) {
  if (!entrega.observacoes?.trim()) return "Informe a devolutiva do que foi executado.";
  if (tarefaExigeComprovacao(tarefa) && !urlGoogleDriveValida(entrega.driveUrl)) {
    return "Cole um link válido do Google Drive para comprovar o arquivamento.";
  }
  if (!entrega.crmAtualizado) return "Confirme a atualização do CRM.";
  if (!entrega.planilhaAtualizada) return "Confirme a atualização da Planilha Geral.";
  return null;
}

function validarImagemComprovacao(arquivo) {
  if (!arquivo) return null;
  if (!arquivo.type?.startsWith("image/")) return "Selecione uma imagem em JPG, PNG, WEBP ou HEIC.";
  if (arquivo.size > TAMANHO_MAXIMO_IMAGEM_COMPROVACAO) return "A imagem deve ter no máximo 5 MB.";
  return null;
}

async function enviarImagemComprovacao(tarefa, arquivo) {
  if (!arquivo) return null;
  const falha = validarImagemComprovacao(arquivo);
  if (falha) throw new Error(falha);
  const { data: autenticacao, error: erroAutenticacao } = await supabase.auth.getUser();
  if (erroAutenticacao || !autenticacao?.user?.id) throw new Error("Não foi possível identificar o usuário para anexar a imagem.");
  const extensao = (arquivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const caminho = `${autenticacao.user.id}/${tarefa.id}/${Date.now()}-${parteNomeComprovante(tarefa.titulo, "TAREFA")}.${extensao}`;
  const { error } = await supabase.storage.from(BUCKET_IMAGENS_COMPROVACAO).upload(caminho, arquivo, {
    cacheControl: "3600",
    contentType: arquivo.type,
    upsert: false,
  });
  if (error) throw new Error(`Não foi possível enviar a imagem. Execute anexos_conclusao_tarefas_2026.sql no Supabase e tente novamente. ${error.message}`);
  return caminho;
}

async function registrarImagemComprovacao(tarefa, caminho) {
  if (!caminho) return null;
  const { data, error } = await supabase.rpc("registrar_anexo_imagem_tarefa", {
    p_tarefa_id: Number(tarefa.id),
    p_imagem_path: caminho,
  });
  if (error) throw new Error(`A tarefa foi concluída, mas a imagem não pôde ser vinculada. Execute anexos_conclusao_tarefas_2026.sql no Supabase. ${error.message}`);
  return Array.isArray(data) ? data[0] : data;
}

function gerarResultadoEsperadoTarefa(acao) {
  const acaoFormatada = String(acao || "a solicitação")
    .trim()
    .toLocaleLowerCase("pt-BR");
  return `Executar ${acaoFormatada}, registrar a devolutiva e inserir o link do documento no Google Drive quando aplicável.`;
}

function tituloAutomaticoDaTarefa(categoria, outraAcao = "") {
  if (categoria === "OUTROS") return outraAcao.trim();
  return ACOES_TAREFA_VISUAIS.find((acao) => acao.valor === categoria)?.rotulo || categoria;
}

function SeletorAcaoVisual({ valor, onChange }) {
  return <fieldset className="task-choice-fieldset">
    <legend>Ação a ser executada</legend>
    <div className="task-action-picker" role="radiogroup" aria-label="Ação a ser executada">
      {ACOES_TAREFA_VISUAIS.map((acao) => {
        const selecionada = valor === acao.valor;
        return <button
          type="button"
          role="radio"
          aria-checked={selecionada}
          key={acao.valor}
          className={`task-action-chip ${selecionada ? "active" : ""}`}
          onClick={() => onChange(acao.valor)}
        >
          <span aria-hidden="true">{acao.icone}</span>
          <strong>{acao.rotulo}</strong>
          {selecionada && <b aria-label="Selecionada">✓</b>}
        </button>;
      })}
    </div>
  </fieldset>;
}

function SeletorPrioridadeVisual({ valor, onChange }) {
  return <fieldset className="task-choice-fieldset priority-choice-fieldset">
    <legend>Prioridade</legend>
    <div className="priority-picker" role="radiogroup" aria-label="Prioridade da tarefa">
      {PRIORIDADES_VISUAIS.map((prioridade) => {
        const selecionada = valor === prioridade.valor;
        return <button
          type="button"
          role="radio"
          aria-checked={selecionada}
          key={prioridade.valor}
          className={`priority-choice priority-${prioridade.valor} ${selecionada ? "active" : ""}`}
          onClick={() => onChange(prioridade.valor)}
        >
          <span aria-hidden="true">{prioridade.icone}</span>
          {prioridade.rotulo}
        </button>;
      })}
    </div>
  </fieldset>;
}

function criarPerfilIntegranteVazio() {
  return {
    id: null,
    nome: "",
    email: "",
    cargo: "",
    setor: "",
    data_admissao: "",
    foto_url: "",
    observacao_interna: "",
    permissoes: { tarefas: true, planner: true, documentos: true },
  };
}

function criarDesligamentoVazio(funcionarioId = "") {
  return {
    funcionario_id: funcionarioId ? String(funcionarioId) : "",
    destino: "transferir",
    nova_funcionaria_id: "",
    data_desligamento: new Date().toISOString().slice(0, 10),
    observacao: "",
  };
}

async function buscarPerfilUsuario(usuarioAuth) {
  const email = usuarioAuth?.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("A conta autenticada não possui um e-mail válido.");
  }

  if (email === ADMIN_EMAIL) {
    return {
      id: usuarioAuth.id,
      nome: "Tafarel Moreira",
      email,
      tipo: "admin",
      cargo: "Supervisor",
    };
  }

  const { data, error } = await supabase
    .from("funcionarios")
    .select("*")
    .ilike("email", email)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Usuário não encontrado no cadastro da equipe.");
  if (data.ativo === false) {
    throw new Error("Este perfil está inativo. Procure o supervisor responsável.");
  }

  const nomeNormalizado = normalizarTexto(data.nome || "");
  const supervisor =
    /supervisor/i.test(data.cargo || "") ||
    NOMES_SUPERVISORES.some((nome) => nomeNormalizado.includes(nome));
  return { ...data, tipo: supervisor ? "admin" : "funcionaria" };
}

function formatarData(data) {
  if (!data) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${data}T12:00:00`));
}

function formatarDataHora(data) {
  if (!data) return "Data não registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function obterMesAtual() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function formatarMes(mes) {
  if (!mes) return "";

  const data = new Date(`${mes.slice(0, 7)}-01T12:00:00`);
  const rotulo = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(data);

  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

function tarefaEhResponsabilidadeMensal(tarefa) {
  return tarefa?.descricao?.startsWith(
    `${RESPONSABILIDADE_MENSAL_PREFIXO}:`,
  );
}

function converterTarefaEmResponsabilidade(tarefa) {
  const [, mesReferencia = "", ordem = "0"] =
    tarefa.descricao?.split(":") || [];

  return {
    id: `tarefa-${tarefa.id}`,
    funcionaria_id: tarefa.funcionaria_id,
    mes_referencia: `${mesReferencia}-01`,
    titulo: tarefa.titulo,
    ordem: Number(ordem) || 0,
    origem: "tarefas",
  };
}

function rotuloTipoFeedback(tipo) {
  return tipo === "construtivo"
    ? "Ponto de melhoria"
    : "Reconhecimento positivo";
}

function rotuloStatusTarefa(status) {
  if (status === "pendente") return "Nova";
  const rotulos = { delegada: "Delegada", recebida: "Recebida", em_execucao: "Em execução", aguardando_informacao: "Aguardando informação", devolvida_conferencia: "Aguardando conferência", devolvida_correcao: "Devolvida para correção", bloqueada: "Bloqueada" };
  if (rotulos[status]) return rotulos[status];
  return STATUS_TAREFA.find((item) => item.valor === status)?.rotulo || status;
}

function rotuloPrioridade(prioridade) {
  if (prioridade === "critica") return "Crítica";
  if (prioridade === "urgente") return "Urgente";
  if (prioridade === "alta") return "Alta";
  if (prioridade === "baixa") return "Baixa";
  return "Normal";
}

function normalizarTexto(texto = "") {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function ResumoFluxoTarefa({ tarefa, compacto = false }) {
  const status = obterStatusTaskManager(tarefa);
  const etapa = obterEtapaTaskManager(tarefa);

  return (
    <div className={`task-workflow-summary ${compacto ? "compact" : ""}`}>
      <div className="task-workflow-heading">
        <span className={`workflow-status workflow-status-${status.chave}`}>
          {status.rotulo}
        </span>
        <span className="workflow-phase">
          Fase {etapa.numero} de 9 · {etapa.nome}
        </span>
      </div>
      {!compacto && (
        <>
          <div className="workflow-progress" aria-label={`Etapa ${status.passo} de 5: ${status.rotulo}`}>
            {STATUS_TASKMANAGER.map((item) => (
              <span
                className={item.passo <= status.passo ? `active ${status.chave}` : ""}
                key={item.chave}
              />
            ))}
          </div>
          <small>{status.ajuda} · Destino: {etapa.departamento}</small>
        </>
      )}
    </div>
  );
}

function tarefaAtribuidaAoUsuario(tarefa, usuario, funcionario) {
  if (
    funcionario?.id != null &&
    String(tarefa?.funcionaria_id) === String(funcionario.id)
  ) {
    return true;
  }

  return (
    Boolean(tarefa?.responsavel_texto) &&
    normalizarTexto(tarefa.responsavel_texto.trim()) ===
      normalizarTexto(usuario?.nome?.trim() || "")
  );
}

function tarefaExigeChecklistDocumentos(tarefa) {
  const codigoEtapa = String(tarefa?.codigo_etapa || "").toUpperCase();
  const texto = normalizarTexto(`${tarefa?.titulo || ""} ${tarefa?.descricao || ""}`);

  return (
    codigoEtapa === "ADM-007" ||
    texto.includes("5 documentos iniciais") ||
    texto.includes("cinco documentos iniciais") ||
    texto.includes("conferir documentos iniciais")
  );
}

function checklistDocumentosCompleto(tarefa) {
  if (tarefa?.checklist_documentos_completo === true) return true;
  const documentos = tarefa?.checklist_documentos || {};
  return DOCUMENTOS_INICIAIS.every(
    ({ chave }) => documentos[chave] === true,
  );
}

function inicioDaSemana(data = new Date()) {
  const inicio = new Date(data);
  inicio.setHours(0, 0, 0, 0);
  const dia = inicio.getDay();
  inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1));
  return inicio;
}

function fimDaSemana(data = new Date()) {
  const fim = inicioDaSemana(data);
  fim.setDate(fim.getDate() + 6);
  fim.setHours(23, 59, 59, 999);
  return fim;
}

function dataLimiteLocal(data) {
  if (!data) return null;
  const limite = new Date(`${String(data).slice(0, 10)}T23:59:59`);
  return Number.isNaN(limite.getTime()) ? null : limite;
}

function calcularPerformanceSemanal(funcionariaId, tarefas) {
  const agora = new Date();
  const inicio = inicioDaSemana(agora);
  const fim = fimDaSemana(agora);
  const avaliadas = tarefas.filter((tarefa) => {
    if (String(tarefa.funcionaria_id) !== String(funcionariaId)) return false;
    if (!tarefa.data_limite || tarefa.status === "cancelada" || tarefa.status === "arquivada") {
      return false;
    }

    const limite = dataLimiteLocal(tarefa.data_limite);
    const conclusao = tarefa.concluida_em ? new Date(tarefa.concluida_em) : null;
    const concluidaNaSemana =
      conclusao && conclusao >= inicio && conclusao <= fim;
    const prazoVenceuNaSemana =
      limite && limite >= inicio && limite <= fim && limite < agora;

    return Boolean(concluidaNaSemana || prazoVenceuNaSemana);
  });

  const perdas = avaliadas.filter((tarefa) => {
    if (tarefa.prazo_perdido === true) return true;
    const limite = dataLimiteLocal(tarefa.data_limite);
    if (!limite) return false;
    if (tarefa.status === "concluida" && tarefa.concluida_em) {
      return new Date(tarefa.concluida_em) > limite;
    }
    return STATUS_ABERTOS.has(tarefa.status) && limite < agora;
  }).length;

  return {
    avaliadas: avaliadas.length,
    perdas,
    percentualPerda: avaliadas.length
      ? Math.round((perdas / avaliadas.length) * 100)
      : null,
    altaPerformance: avaliadas.length > 0 && perdas === 0,
  };
}

// ==========================================
// 2. COMPONENTES VISUAIS
// ==========================================

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="toast-message" onClick={onClose}>
      {message}
    </div>
  );
}

function UiIcon({ name, size = 20 }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    tarefas: <><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="m3 6 1 1 2-2" /><path d="m3 12 1 1 2-2" /><path d="m3 18 1 1 2-2" /></>,
    equipe: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    documentos: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" /></>,
    processual: <><path d="M6 3h12v18H6z" /><path d="M9 7h6" /><path d="M9 11h6" /><path d="M9 15h4" /></>,
    historico: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
    planner: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 11h18" /><path d="m8 16 2 2 4-4" /></>,
    tv: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="m8 2 4 3 4-3" /><path d="M8 22h8" /></>,
    ranking: <><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4" /><path d="M17 6h3v2a4 4 0 0 1-4 4" /></>,
    feedback: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></>,
    notificacao: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    olho: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-6" /></>,
    spark: <><path d="m12 3-1.8 4.5L6 9l4.2 1.5L12 15l1.8-4.5L18 9l-4.2-1.5Z" /><path d="m5 15-.8 2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-1Z" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className="ui-icon"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name] || paths.spark}
    </svg>
  );
}

function NavItem({ active, icon, children, onClick, options = [] }) {
  return (
    <button className={`nav-item ${active ? "active-tab" : ""}`} onClick={onClick}>
      {icon === "documentos" ? (
        <img
          src="/assets/pdf-document-icon.png"
          alt=""
          className="nav-image-icon"
        />
      ) : (
        <UiIcon name={icon} />
      )}
      <span>{children}</span>
      {options.length > 0 && (
        <span className="nav-menu-popover" aria-hidden="true">
          {options.map((option) => (
            <small key={option}>{option}</small>
          ))}
        </span>
      )}
    </button>
  );
}

function MetricIcon({ type }) {
  return (
    <div className={`metric-icon metric-${type}`}>
      <UiIcon name={type} size={24} />
    </div>
  );
}

function PerformanceBadge({ performance, mostrarRotulo = false }) {
  if (!performance?.altaPerformance) return null;

  const descricao = `Alta Performance: 0% de perda em ${performance.avaliadas} prazo(s) avaliado(s) nesta semana.`;
  return (
    <span className={`performance-badge ${mostrarRotulo ? "with-label" : ""}`} title={descricao}>
      <span aria-hidden="true">★</span>
      {mostrarRotulo && <strong>Alta Performance</strong>}
      <span className="sr-only">{descricao}</span>
    </span>
  );
}

function mensagemErroOperacional(error) {
  const mensagem = error?.message || "Erro desconhecido.";
  if (mensagem.includes("Use a acao Devolver Tarefa") || mensagem.includes("justificativa da devolucao")) {
    return "A proteção antiga de devolução do Supabase ainda está ativa. Reexecute o arquivo motor_operacional_tarefas_2026.sql atualizado.";
  }
  if (
    mensagem.includes("concluir_tarefa_propria_supervisor") ||
    mensagem.includes("Could not find the function public.concluir_tarefa_propria_supervisor")
  ) {
    return "A função de conclusão de tarefas do gestor ainda não está instalada no Supabase. Execute o arquivo concluir_tarefa_propria_supervisor.sql no SQL Editor e atualize a página.";
  }
  if (error?.code === "PGRST202" || mensagem.includes("schema cache") || mensagem.includes("delegar_tarefa_operacional")) {
    return "A estrutura da Central de Tarefas ainda não foi instalada no Supabase. Execute, na ordem, motor_operacional_tarefas_2026.sql e central_tarefas_modulos_2026.sql no SQL Editor.";
  }
  return mensagem;
}

const AVATARES_EQUIPE = {
  "tabata@platino.com": "0% 0%",
  "nicolas@platino.com": "50% 0%",
  "giullian@platino.com": "100% 0%",
  "yasmin@adm.com": "0% 100%",
  "tafa@adm.com": "50% 100%",
};

const FOTOS_FIXAS_EQUIPE = {
  "janaina@platino.com": "/assets/equipe/janaina.jpeg",
};

const FOTOS_FIXAS_EQUIPE_POR_NOME = {
  thayla: "/assets/equipe/thayla-venturini.jpeg",
  "thayla venturini": "/assets/equipe/thayla-venturini.jpeg",
};

const GRUPOS_EQUIPE_GESTOR = [
  {
    id: "administrativo",
    titulo: "Perfil usuários ADM",
    descricao: "Gestão e operação administrativa",
    ordem: [["tafarel"], ["yasmim", "yasmin"], ["thayla"]],
  },
  {
    id: "juridico",
    titulo: "Perfil usuários Jurídico",
    descricao: "Supervisão e operação jurídica",
    ordem: [["nicolas"], ["tabata"], ["giullian"], ["janaina"], ["elaine"]],
  },
];

function identificarGrupoEquipe(funcionario) {
  const nome = normalizarTexto(funcionario?.nome || "");
  const grupoExplicito = GRUPOS_EQUIPE_GESTOR.find((grupo) =>
    grupo.ordem.some((apelidos) => apelidos.some((apelido) => nome.includes(apelido))),
  );
  if (grupoExplicito) return grupoExplicito.id;
  return normalizarTexto(funcionario?.setor || funcionario?.cargo || "").includes("jurid")
    ? "juridico"
    : "administrativo";
}

function ordenarEquipe(membros, ordem) {
  const posicao = (funcionario) => {
    const nome = normalizarTexto(funcionario?.nome || "");
    const indice = ordem.findIndex((apelidos) =>
      apelidos.some((apelido) => nome.includes(apelido)),
    );
    return indice === -1 ? ordem.length : indice;
  };
  return membros.slice().sort((a, b) =>
    posicao(a) - posicao(b) || (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
  );
}

function AvatarMembro({ funcionario, performance, compacto = false }) {
  const email = funcionario?.email?.trim().toLowerCase();
  const nome = normalizarTexto(funcionario?.nome || "");
  const posicaoSprite = AVATARES_EQUIPE[email];
  const fotoUrl =
    funcionario?.foto_url ||
    FOTOS_FIXAS_EQUIPE[email] ||
    FOTOS_FIXAS_EQUIPE_POR_NOME[nome];
  return (
    <div className={`member-avatar-wrap ${compacto ? "compact" : ""}`}>
      <div className="member-avatar">
        {fotoUrl ? (
          <img src={fotoUrl} alt={`Foto de ${funcionario.nome}`} />
        ) : posicaoSprite ? (
          <span
            aria-label={`Foto de ${funcionario.nome}`}
            className="employee-avatar-sprite"
            role="img"
            style={{ backgroundPosition: posicaoSprite }}
          />
        ) : (
          funcionario?.nome?.charAt(0) || "?"
        )}
      </div>
      <PerformanceBadge performance={performance} />
    </div>
  );
}

function ModalDevolucao({ tarefa, onClose, onConfirmar }) {
  const [motivo, setMotivo] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const comentarioValido = comentario.trim().length >= 10;

  async function confirmar(event) {
    event.preventDefault();
    if (!motivo || !comentarioValido) return;
    setEnviando(true);
    try {
      await onConfirmar({
        motivo,
        comentario: comentario.trim(),
      });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="devolucao-titulo"
        aria-modal="true"
        className="return-modal"
        role="dialog"
      >
        <div className="return-modal-heading">
          <div>
            <span className="eyebrow">Bloqueio com histórico obrigatório</span>
            <h2 id="devolucao-titulo">Devolver tarefa #{tarefa.id_externo || tarefa.id}</h2>
            <p>{tarefa.titulo}</p>
          </div>
          <button
            aria-label="Fechar devolução"
            className="modal-close"
            disabled={enviando}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="stack-form return-form" onSubmit={confirmar}>
          <label>
            Motivo do impedimento
            <select
              autoFocus
              onChange={(event) => setMotivo(event.target.value)}
              required
              value={motivo}
            >
              <option value="">Selecione um motivo...</option>
              {MOTIVOS_DEVOLUCAO.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Comentário explicativo
            <textarea
              minLength="10"
              onChange={(event) => setComentario(event.target.value)}
              placeholder="Informe a pendência, o erro, a informação necessária ou por que não será possível executar."
              required
              rows="5"
              value={comentario}
            />
            <small className={comentarioValido ? "field-ok" : "field-help"}>
              Mínimo de 10 caracteres. A pendência ficará registrada no histórico.
            </small>
          </label>
          <div className="return-modal-actions">
            <button
              className="btn-secondary"
              disabled={enviando}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="btn-return"
              disabled={enviando || !motivo || !comentarioValido}
              type="submit"
            >
              {enviando ? "Registrando..." : "Registrar impedimento"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EntregaPop({ tarefa, valor, onChange }) {
  const atualizar = (campo, novoValor) => onChange({ ...valor, [campo]: novoValor });
  const criterios = Array.isArray(tarefa.criterios_conclusao) ? tarefa.criterios_conclusao : [];
  const comprovacaoObrigatoria = tarefaExigeComprovacao(tarefa);
  return (
    <section className="document-checklist pop-delivery-checklist">
      <div className="document-checklist-heading">
        <div><span className="eyebrow">POP 1.0 · prestação de contas</span><h4>Checklist de conclusão</h4><p>Documentos são comprovados por link do Drive. Imagens de apoio podem ser anexadas abaixo.</p></div>
      </div>
      <label>Observações / devolutiva<textarea rows="3" value={valor.observacoes || ""} onChange={(e) => atualizar("observacoes", e.target.value)} placeholder="Descreva objetivamente o que foi executado e eventuais pendências." /></label>
      <label className="drive-link-field"><span>Link do Documento no Google Drive {comprovacaoObrigatoria ? "*" : "(opcional)"}</span><input type="url" value={valor.driveUrl || ""} onChange={(e) => atualizar("driveUrl", e.target.value)} placeholder="https://drive.google.com/file/d/..." aria-describedby={`drive-link-help-${tarefa.id}`} required={comprovacaoObrigatoria} /><small id={`drive-link-help-${tarefa.id}`}>Insira o link do arquivo salvo na pasta do cliente no Google Drive para comprovação da tarefa.</small></label>
      <small className="drive-link-filename">Nome técnico registrado automaticamente: {nomeComprovanteDrive(tarefa)}</small>
      <div className="document-checklist-grid">
        {criterios.map((criterio) => <label className={valor.checklist?.[criterio] ? "checked" : ""} key={criterio}><input type="checkbox" checked={valor.checklist?.[criterio] || false} onChange={(e) => atualizar("checklist", { ...(valor.checklist || {}), [criterio]: e.target.checked })} /><span>{criterio}</span></label>)}
        <label className={valor.crmAtualizado ? "checked" : ""}><input type="checkbox" checked={valor.crmAtualizado || false} onChange={(e) => atualizar("crmAtualizado", e.target.checked)} /><span>CRM atualizado</span></label>
        <label className={valor.planilhaAtualizada ? "checked" : ""}><input type="checkbox" checked={valor.planilhaAtualizada || false} onChange={(e) => atualizar("planilhaAtualizada", e.target.checked)} /><span>Planilha Geral atualizada</span></label>
      </div>
      {/(distrato|desist.ncia|fim de servi.o|encerramento)/i.test(normalizarTexto(`${tarefa.titulo} ${tarefa.descricao}`)) && <div className="return-alert"><strong>Arquivo morto:</strong> confirme o distrato assinado e as provas sociais; depois mova a pasta para 02_ARQUIVO_MORTO.</div>}
    </section>
  );
}

function ModalConclusaoTarefa({ tarefa, entrega, enviando, onChange, onClose, onConfirmar, onDevolver }) {
  const [imagem, setImagem] = useState(null);
  const [erroImagem, setErroImagem] = useState("");

  function selecionarImagem(evento) {
    const arquivo = evento.target.files?.[0] || null;
    const falha = validarImagemComprovacao(arquivo);
    setErroImagem(falha || "");
    setImagem(falha ? null : arquivo);
  }

  async function confirmar(evento) {
    evento.preventDefault();
    if (erroImagem) return;
    await onConfirmar(imagem);
  }

  return <div className="modal-backdrop" role="presentation">
    <section aria-labelledby="conclusao-titulo" aria-modal="true" className="return-modal completion-modal" role="dialog">
      <div className="return-modal-heading">
        <div>
          <span className="eyebrow">Prestação de contas</span>
          <h2 id="conclusao-titulo">Concluir tarefa</h2>
          <p>{tarefa.titulo} · {tarefa.nome_cliente || "Cliente não informado"}</p>
        </div>
        <button aria-label="Fechar conclusão" className="modal-close" disabled={enviando} onClick={onClose} type="button">×</button>
      </div>
      <form className="stack-form completion-form" onSubmit={confirmar}>
        <div className="completion-intro"><strong>Registre o que foi realizado.</strong><span>As observações e comprovações ficam no histórico da tarefa.</span></div>
        <EntregaPop tarefa={tarefa} valor={entrega} onChange={onChange} />
        <label className="completion-image-field">
          <span>Imagem de comprovação <em>(opcional)</em></span>
          <input accept="image/jpeg,image/png,image/webp,image/heic" onChange={selecionarImagem} type="file" />
          <small>Anexe uma captura, foto ou comprovante visual em JPG, PNG, WEBP ou HEIC, até 5 MB.</small>
          {imagem && <strong className="selected-proof-image">Imagem selecionada: {imagem.name}</strong>}
          {erroImagem && <small className="field-error">{erroImagem}</small>}
        </label>
        <div className="return-modal-actions completion-actions">
          <button className="btn-secondary" disabled={enviando} onClick={onClose} type="button">Cancelar</button>
          <button className="btn-return" disabled={enviando} onClick={onDevolver} type="button">Devolver tarefa</button>
          <button className="btn-success" disabled={enviando || Boolean(erroImagem)} type="submit">{enviando ? "Registrando..." : "Concluir tarefa"}</button>
        </div>
      </form>
    </section>
  </div>;
}

function LinhaTempoTarefa({ tarefa }) {
  const etapas = [
    ["delegada", "Delegada"], ["recebida", "Aceita"], ["em_execucao", "Executada"],
    ["devolvida_conferencia", "Em conferência"], ["concluida", "Concluída"],
  ];
  const indiceAtual = etapas.findIndex(([status]) => status === tarefa.status);
  return <div className="task-timeline" aria-label="Linha do tempo da tarefa">
    {etapas.map(([status, rotulo], indice) => <div className={`task-timeline-step ${indice <= indiceAtual ? "done" : ""}`} key={status}><span>●</span><small>{rotulo}</small></div>)}
  </div>;
}

function ChecklistDocumentos({ tarefa, onAtualizada }) {
  const [documentos, setDocumentos] = useState(
    tarefa.checklist_documentos || {},
  );
  const [salvando, setSalvando] = useState(false);

  const totalMarcados = DOCUMENTOS_INICIAIS.filter(
    ({ chave }) => documentos[chave] === true,
  ).length;
  const completo = totalMarcados === DOCUMENTOS_INICIAIS.length;
  const confirmado = checklistDocumentosCompleto(tarefa);
  const bloqueado = tarefa.status === "devolvida" || tarefa.status === "concluida";

  async function salvarChecklist() {
    if (!completo || bloqueado) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc(
        "salvar_checklist_documentos",
        {
          p_tarefa_id: Number(tarefa.id),
          p_documentos: documentos,
        },
      );
      if (error) throw error;
      const atualizada = Array.isArray(data) ? data[0] : data;
      if (!atualizada) throw new Error("O banco não confirmou o checklist.");
      onAtualizada(atualizada);
    } catch (error) {
      console.error("Erro ao salvar checklist:", error);
      alert(`Não foi possível confirmar os documentos: ${error.message}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className={`document-checklist ${confirmado ? "complete" : ""}`}>
      <div className="document-checklist-heading">
        <div>
          <span className="eyebrow">Etapa 2 · check-in obrigatório</span>
          <h4>5 documentos iniciais</h4>
        </div>
        <span className="checklist-progress">
          {confirmado ? "5/5 confirmado" : `${totalMarcados}/5`}
        </span>
      </div>
      <div className="document-checklist-grid">
        {DOCUMENTOS_INICIAIS.map(({ chave, rotulo }) => (
          <label className={documentos[chave] ? "checked" : ""} key={chave}>
            <input
              checked={documentos[chave] === true}
              disabled={bloqueado || confirmado}
              onChange={(event) =>
                setDocumentos((atuais) => ({
                  ...atuais,
                  [chave]: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>{rotulo}</span>
          </label>
        ))}
      </div>
      {confirmado ? (
        <div className="checklist-confirmed">
          ✓ Documentação conferida. A etapa está liberada para conclusão.
        </div>
      ) : (
        <>
          <p>O avanço para o Jurídico só será liberado após os cinco itens.</p>
          <button
            className="btn-primary compact"
            disabled={!completo || salvando || bloqueado}
            onClick={salvarChecklist}
            type="button"
          >
            {salvando ? "Confirmando..." : "Confirmar 5 documentos"}
          </button>
        </>
      )}
    </section>
  );
}

function ListaFeedbacks({
  feedbacks,
  funcionarios = [],
  mostrarDestinataria = false,
  vazio = "Nenhum feedback registrado.",
}) {
  if (feedbacks.length === 0) return <p>{vazio}</p>;

  return (
    <div className="feedback-list">
      {feedbacks.map((feedback) => {
        const destinataria = funcionarios.find(
          (item) =>
            String(item.id) === String(feedback.funcionaria_id),
        );

        return (
          <article
            className={`feedback-card feedback-${feedback.tipo}`}
            key={feedback.id}
          >
            <div className="feedback-card-heading">
              <span>{rotuloTipoFeedback(feedback.tipo)}</span>
              <time dateTime={feedback.created_at}>
                {formatarDataHora(feedback.created_at)}
              </time>
            </div>
            {mostrarDestinataria ? (
              <strong>
                Para: {destinataria?.nome || "Colaboradora não identificada"}
              </strong>
            ) : (
              <strong>Enviado por Tafarel Moreira</strong>
            )}
            <p>{feedback.mensagem}</p>
          </article>
        );
      })}
    </div>
  );
}

// ==========================================
// 3. TELA DE LOGIN (COM SENHA E SUPABASE)
// ==========================================

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);
  const [avisoRecuperacao, setAvisoRecuperacao] = useState("");

  async function fazerLogin(event) {
    event.preventDefault();
    setCarregando(true);
    const emailNormalizado = email.trim().toLowerCase();

    if (!emailNormalizado || !senha) {
      alert("Por favor, preencha e-mail e senha.");
      setCarregando(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailNormalizado,
        password: senha,
      });

      if (authError) throw authError;

      const perfil = await buscarPerfilUsuario(authData.user);
      await onLogin(perfil);
    } catch (error) {
      console.error("Erro de login:", error);
      await supabase.auth.signOut();
      alert(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : `Não foi possível entrar: ${error.message}`,
      );
    } finally {
      setCarregando(false);
    }
  }

  async function solicitarRecuperacao() {
    const emailNormalizado = email.trim().toLowerCase();
    if (!emailNormalizado) {
      setAvisoRecuperacao("Informe seu e-mail corporativo para recuperar a senha.");
      return;
    }

    setEnviandoRecuperacao(true);
    setAvisoRecuperacao("");
    const destino = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(emailNormalizado, {
      redirectTo: destino,
    });
    setEnviandoRecuperacao(false);

    setAvisoRecuperacao(
      error
        ? `Não foi possível enviar a recuperação: ${error.message}`
        : "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.",
    );
  }

  return (
    <div className="login-page login-page-liquid">
      <div className="liquid-bg" aria-hidden="true">
        <span className="ambient ambient-one" />
        <span className="ambient ambient-two" />
        <span className="ambient ambient-three" />
        <span className="orbital-line orbital-one" />
        <span className="orbital-line orbital-two" />

        <span className="blue-focus blue-focus-one" />
        <span className="blue-focus blue-focus-two" />
        <span className="glow-dot dot-a" />
        <span className="glow-dot dot-b" />
        <span className="glow-dot dot-c" />
        <span className="energy-line line-a" />
        <span className="energy-line line-b" />
      </div>

      <section className="glass-card login-card" aria-label="Login Platino equipe">
        <div className="login-card-accent" aria-hidden="true" />
        <div className="login-heading">
          <h1>Bem-vindo de volta! <span aria-hidden="true">👋</span></h1>
          <p>Acesse sua conta corporativa.</p>
        </div>

        <form className="login-form" onSubmit={fazerLogin}>
          <label className="glass-field floating-field">
            <span className="sr-only">E-mail corporativo</span>
            <div className="glass-input">
              <UiIcon name="equipe" size={19} />
              <div className="floating-input-wrap">
                <input
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" "
                />
                <span>E-mail corporativo</span>
              </div>
            </div>
          </label>

          <label className="glass-field floating-field">
            <span className="sr-only">Senha</span>
            <div className="glass-input">
              <UiIcon name="logout" size={19} />
              <div className="floating-input-wrap">
                <input
                  autoComplete="current-password"
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder=" "
                />
                <span>Senha</span>
              </div>
              <button
                type="button"
                className="password-visibility"
                onClick={() => setMostrarSenha((atual) => !atual)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Exibir senha"}
                title={mostrarSenha ? "Ocultar senha" : "Exibir senha"}
              >
                <UiIcon name="olho" size={19} />
              </button>
            </div>
          </label>

          <button
            className="forgot-password"
            disabled={enviandoRecuperacao}
            onClick={solicitarRecuperacao}
            type="button"
          >
            {enviandoRecuperacao ? "Enviando..." : "Esqueci minha senha"}
          </button>

          {avisoRecuperacao && <p className="auth-message" role="status">{avisoRecuperacao}</p>}

          <button
            type="submit"
            className="glass-button full login-submit"
            disabled={carregando}
          >
            {carregando && <span className="login-spinner" aria-hidden="true" />}
            <span>{carregando ? "Entrando..." : "Entrar"}</span>
          </button>

        </form>
      </section>

      <div className="login-footer login-footer-minimal">
        <span>© 2026 <strong>Platino equipe</strong></span>
        <span>Versão 2.0.0</span>
      </div>
    </div>
  );
}

function RedefinirSenha({ onConcluida }) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvarNovaSenha(evento) {
    evento.preventDefault();
    if (senha.length < 8) {
      setMensagem("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setMensagem("A confirmação não corresponde à nova senha.");
      return;
    }

    setSalvando(true);
    setMensagem("");
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setMensagem(`Não foi possível atualizar a senha: ${error.message}`);
      return;
    }

    await supabase.auth.signOut();
    window.history.replaceState({}, "", `${window.location.origin}${window.location.pathname}`);
    onConcluida();
  }

  return (
    <div className="login-page login-page-liquid">
      <section className="glass-card login-card" aria-label="Criar nova senha">
        <div className="login-brand"><div><strong>Platino equipe</strong><span>Workspace Administrativo</span></div></div>
        <div className="login-heading"><span>Recuperação de acesso</span><h1>Crie uma nova senha</h1><p>Use pelo menos 8 caracteres.</p></div>
        <form className="login-form" onSubmit={salvarNovaSenha}>
          <label className="glass-field"><span>Nova senha</span><div className="glass-input"><UiIcon name="logout" size={20} /><input autoComplete="new-password" onChange={(evento) => setSenha(evento.target.value)} required type="password" value={senha} /></div></label>
          <label className="glass-field"><span>Confirmar nova senha</span><div className="glass-input"><UiIcon name="logout" size={20} /><input autoComplete="new-password" onChange={(evento) => setConfirmacao(evento.target.value)} required type="password" value={confirmacao} /></div></label>
          {mensagem && <p className="auth-message" role="alert">{mensagem}</p>}
          <button className="glass-button full" disabled={salvando} type="submit">{salvando ? "Salvando..." : "Salvar nova senha"}</button>
        </form>
      </section>
    </div>
  );
}

function LinkComprovanteDrive({ tarefa }) {
  const url = tarefa?.drive_document_url || tarefa?.evidencia_url;
  if (!urlGoogleDriveValida(url)) return null;
  return <a className="drive-document-link" href={url} target="_blank" rel="noreferrer">↗ Ver documento no Google Drive</a>;
}

function LinkImagemComprovacao({ tarefa }) {
  const caminho = tarefa?.imagem_comprovacao_path;
  const [imagemAssinada, setImagemAssinada] = useState({ caminho: "", url: "" });

  useEffect(() => {
    let ativo = true;
    if (!caminho) return undefined;
    supabase.storage.from(BUCKET_IMAGENS_COMPROVACAO).createSignedUrl(caminho, 3600)
      .then(({ data }) => { if (ativo) setImagemAssinada({ caminho, url: data?.signedUrl || "" }); });
    return () => { ativo = false; };
  }, [caminho]);

  if (!caminho) return null;
  return imagemAssinada.caminho === caminho && imagemAssinada.url
    ? <a className="drive-document-link image-proof-link" href={imagemAssinada.url} target="_blank" rel="noreferrer">🖼 Ver imagem anexada</a>
    : <small className="image-proof-pending">Imagem de comprovação anexada.</small>;
}

function CartaoGestaoMembro({
  funcionario,
  performance,
  gestorPrincipal,
  onEditar,
  onAlterarPontos,
  onTransferir,
  onAlterarAtivacao,
}) {
  return (
    <div className={`team-member ${funcionario.ativo === false ? "member-inactive" : ""} ${performance?.altaPerformance ? "member-high-performance" : ""}`}>
      <AvatarMembro funcionario={funcionario} performance={performance} />
      <div className="member-details">
        <div className="member-name-row">
          <strong>{funcionario.nome}</strong>
          <PerformanceBadge performance={performance} mostrarRotulo />
        </div>
        <p>{funcionario.cargo || "Cargo não informado"} · {funcionario.setor || "Setor não informado"}</p>
        <span className={`member-status ${funcionario.ativo === false ? "inactive" : "active"}`}>
          {funcionario.ativo === false ? "Inativa" : "Ativa"}
        </span>
        {gestorPrincipal ? (
          <span className="manager-primary-badge">Gestor principal</span>
        ) : (
          <span className="points-badge">{funcionario.pontos || 0} pontos acumulados</span>
        )}
        {!gestorPrincipal && (
          <div className={`weekly-performance ${performance?.perdas ? "has-loss" : ""}`}>
            <strong>
              {performance?.percentualPerda === null
                ? "Semana ainda sem prazos avaliados"
                : `${performance.percentualPerda}% de perda de prazos`}
            </strong>
            {performance?.avaliadas > 0 && (
              <small>{performance.avaliadas} prazo(s) avaliado(s) · {performance.perdas} atraso(s)</small>
            )}
          </div>
        )}
      </div>
      {gestorPrincipal ? (
        <small className="manager-primary-note">Acesso principal configurado na Vercel e no Supabase.</small>
      ) : (
        <div className="member-actions">
          <button className="btn-secondary compact" onClick={() => onEditar(funcionario)}>Editar</button>
          <button className="btn-success compact" onClick={() => onAlterarPontos(funcionario.id, 10)}>+10</button>
          <button className="btn-danger compact" onClick={() => onAlterarPontos(funcionario.id, -10)}>-10</button>
          <button className="btn-secondary compact" onClick={() => onTransferir(funcionario)}>Transferir</button>
          <button className="btn-danger compact" onClick={() => onAlterarAtivacao(funcionario)}>
            {funcionario.ativo === false ? "Reativar" : "Inativar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. PAINEL DO ADMINISTRADOR
// ==========================================

function AdminDashboard({ usuario, onLogout, state }) {
  const {
    listaTarefas,
    setListaTarefas,
    funcionarios,
    setFuncionarios,
    feedbacks,
    setFeedbacks,
    responsabilidadesMensais,
    setResponsabilidadesMensais,
    recarregarTarefas,
    recarregarFuncionarios,
    recarregarFeedbacks,
    recarregarResponsabilidadesMensais,
    showToast,
  } = state;
  const [abaAtiva, setAbaAtiva] = useState("dashboard"); 
  const [salvandoTarefa, setSalvandoTarefa] = useState(false);
  const [modoTv, setModoTv] = useState(
    () => new URLSearchParams(window.location.search).get("modo") === "tv",
  );
  const [tarefaEmEdicao, setTarefaEmEdicao] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [filtroTarefas, setFiltroTarefas] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todas");
  const [filtroPrazo, setFiltroPrazo] = useState("");
  const [tarefasSelecionadas, setTarefasSelecionadas] = useState([]);
  const [processandoEmMassa, setProcessandoEmMassa] = useState(false);
  const [tarefaConcluindoId, setTarefaConcluindoId] = useState(null);
  const [tarefaEmConclusao, setTarefaEmConclusao] = useState(null);
  const [tarefaEmDevolucao, setTarefaEmDevolucao] = useState(null);
  const [entregasConclusao, setEntregasConclusao] = useState({});
  const [modoEquipe, setModoEquipe] = useState("membros");
  const [perfilIntegrante, setPerfilIntegrante] = useState(criarPerfilIntegranteVazio);
  const [salvandoIntegrante, setSalvandoIntegrante] = useState(false);
  const [desligamento, setDesligamento] = useState(criarDesligamentoVazio);
  const [processandoDesligamento, setProcessandoDesligamento] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [funcId, setFuncId] = useState("");
  const [dataLimite, setDataLimite] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [categoria, setCategoria] = useState(CATEGORIAS_TAREFA[0]);
  const [apontamento, setApontamento] = useState("");
  const [exibirTv, setExibirTv] = useState(true);
  const [tarefaManual, setTarefaManual] = useState(false);
  const [responsavelManual, setResponsavelManual] = useState("");
  const [nomeClienteTarefa, setNomeClienteTarefa] = useState("");
  const [clienteDriveTarefa, setClienteDriveTarefa] = useState(null);
  const [setorSolicitante, setSetorSolicitante] = useState("Supervisão");
  const [acaoOutra, setAcaoOutra] = useState("");
  const [setorExecutor, setSetorExecutor] = useState("Administrativo");

  const [feedbackFuncId, setFeedbackFuncId] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackTipo, setFeedbackTipo] = useState("positivo");
  const [enviandoFeedback, setEnviandoFeedback] = useState(false);
  const [responsabilidadeFuncId, setResponsabilidadeFuncId] = useState("");
  const [responsabilidadeMes, setResponsabilidadeMes] = useState(obterMesAtual);
  const [responsabilidadeTexto, setResponsabilidadeTexto] = useState("");
  const [salvandoResponsabilidades, setSalvandoResponsabilidades] =
    useState(false);
  const [mostrarTarefasMes, setMostrarTarefasMes] = useState(false);
  const [paginaTarefas, setPaginaTarefas] = useState(1);
  const [paginaHistorico, setPaginaHistorico] = useState(1);

  const funcionarioDoUsuario = funcionarios.find(
    (funcionario) =>
      funcionario.email?.trim().toLowerCase() ===
      usuario.email?.trim().toLowerCase(),
  );
  const equipeCompleta = funcionarios.filter(
    (funcionario) => funcionario.email?.toLowerCase() !== ADMIN_EMAIL,
  );
  const equipe = equipeCompleta.filter((funcionario) => funcionario.ativo !== false);
  const destinatariosTarefa = funcionarios.filter(
    (funcionario) => funcionario.ativo !== false,
  );
  const performanceEquipe = new Map(
    equipeCompleta.map((funcionario) => [
      String(funcionario.id),
      calcularPerformanceSemanal(funcionario.id, listaTarefas),
    ]),
  );
  const gestorPrincipalCadastrado = funcionarios.find(
    (funcionario) => funcionario.email?.trim().toLowerCase() === ADMIN_EMAIL,
  );
  const gestorPrincipal = gestorPrincipalCadastrado || {
    id: "gestor-principal",
    nome: usuario.nome || "Tafarel",
    email: ADMIN_EMAIL,
    cargo: "Gestor",
    setor: "Administrativo",
    ativo: true,
  };
  const membrosGestaoEquipe = gestorPrincipalCadastrado
    ? funcionarios
    : [gestorPrincipal, ...funcionarios];
  const equipesGestor = GRUPOS_EQUIPE_GESTOR.map((grupo) => ({
    ...grupo,
    membros: ordenarEquipe(
      membrosGestaoEquipe.filter((funcionario) => identificarGrupoEquipe(funcionario) === grupo.id),
      grupo.ordem,
    ),
  }));
  const tarefasPendentes = listaTarefas.filter((t) => STATUS_ABERTOS.has(t.status));
  const tarefasUrgentes = tarefasPendentes.filter(
    (tarefa) => tarefa.prioridade === "urgente",
  );
  const tarefasFiltradas = listaTarefas.filter((tarefa) => {
    const correspondeCategoria =
      filtroCategoria === "todas" || tarefa.categoria === filtroCategoria;
    if (!correspondeCategoria) return false;
    if (
      filtroResponsavel === "minhas" &&
      !tarefaAtribuidaAoUsuario(tarefa, usuario, funcionarioDoUsuario)
    ) return false;
    if (
      !["todas", "minhas"].includes(filtroResponsavel) &&
      String(tarefa.funcionaria_id) !== filtroResponsavel
    ) return false;
    if (filtroPrazo && tarefa.data_limite !== filtroPrazo) return false;
    if (filtroTarefas === "todas") return true;
    if (filtroTarefas === "manuais") return tarefa.tarefa_manual === true;
    if (filtroTarefas === "urgente") {
      return STATUS_ABERTOS.has(tarefa.status) && tarefa.prioridade === "urgente";
    }
    if (filtroTarefas === "abertas") return STATUS_ABERTOS.has(tarefa.status);
    if (filtroTarefas.startsWith("macro:")) {
      return tarefaNoMacroStatus(tarefa, filtroTarefas.replace("macro:", ""));
    }
    return tarefa.status === filtroTarefas;
  });
  const tarefasOperacionaisFiltradas = tarefasFiltradas.filter((tarefa) =>
    STATUS_ABERTOS.has(tarefa.status),
  );
  const tarefasHistoricoFiltradas = listaTarefas.filter(
    (tarefa) => !STATUS_ABERTOS.has(tarefa.status),
  );
  const tarefasOperacionaisVisiveis = tarefasOperacionaisFiltradas.slice(
    (paginaTarefas - 1) * ITENS_POR_PAGINA,
    paginaTarefas * ITENS_POR_PAGINA,
  );
  const tarefasHistoricoVisiveis = tarefasHistoricoFiltradas.slice(
    (paginaHistorico - 1) * ITENS_POR_PAGINA,
    paginaHistorico * ITENS_POR_PAGINA,
  );
  const responsabilidadesSelecionadas = responsabilidadesMensais
    .filter(
      (item) =>
        String(item.funcionaria_id) === String(responsabilidadeFuncId) &&
        item.mes_referencia?.slice(0, 7) === responsabilidadeMes,
    )
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const funcionariaResponsabilidades = equipe.find(
    (funcionario) =>
      String(funcionario.id) === String(responsabilidadeFuncId),
  );

  function obterTextoResponsabilidades(funcionariaId, mes) {
    return responsabilidadesMensais
      .filter(
        (item) =>
          String(item.funcionaria_id) === String(funcionariaId) &&
          item.mes_referencia?.slice(0, 7) === mes,
      )
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map((item) => item.titulo)
      .join("\n");
  }

  function selecionarFuncionariaResponsabilidades(funcionariaId) {
    setResponsabilidadeFuncId(funcionariaId);
    setResponsabilidadeTexto(
      obterTextoResponsabilidades(funcionariaId, responsabilidadeMes),
    );
  }

  function selecionarMesResponsabilidades(mes) {
    setResponsabilidadeMes(mes);
    setResponsabilidadeTexto(
      obterTextoResponsabilidades(responsabilidadeFuncId, mes),
    );
  }

  async function handleCriarTarefa(e) {
    e.preventDefault();
    const tituloDelegado = tituloAutomaticoDaTarefa(categoria, acaoOutra);
    if ((tarefaManual && !titulo.trim()) || (!tarefaManual && (!funcId || !dataLimite || !clienteDriveTarefa?.id || !nomeClienteTarefa || !setorSolicitante || !setorExecutor || !descricao.trim() || !tituloDelegado))) {
      return alert(
        tarefaManual
          ? "Preencha o titulo da tarefa manual."
          : "Preencha cliente, ação, solicitação, setor solicitante, responsável e prazo.",
      );
    }
    setSalvandoTarefa(true);

    let data;
    let error;

    if (tarefaManual) {
      const resposta = await supabase.rpc("salvar_tarefa_manual_supervisor", {
        p_tarefa_id: null,
        p_titulo: titulo.trim(),
        p_descricao: descricao.trim() || null,
        p_responsavel_texto: responsavelManual.trim() || null,
        p_data_limite: dataLimite || null,
        p_status: "nova",
        p_prioridade: prioridade,
        p_categoria: categoria,
        p_apontamento: apontamento.trim() || null,
        p_exibir_tv: exibirTv,
      });
      data = Array.isArray(resposta.data) ? resposta.data[0] : resposta.data;
      error = resposta.error;
    } else {
      const resposta = await supabase.rpc("delegar_tarefa_operacional", {
        p_cliente_id: Number(clienteDriveTarefa.id), p_tratativa_id: null, p_nome_cliente: nomeClienteTarefa.trim(),
        p_tipo_codigo: CODIGOS_TIPO_TAREFA[categoria], p_titulo: tituloDelegado,
        p_solicitacao: descricao.trim(), p_resultado_esperado: gerarResultadoEsperadoTarefa(categoria === "OUTROS" ? acaoOutra : categoria),
        p_setor_solicitante: setorSolicitante, p_setor_executor: setorExecutor,
        p_funcionaria_id: Number(funcId), p_prazo_limite: new Date(dataLimite).toISOString(),
        p_prioridade: prioridade,
        p_criterios: apontamento.trim() ? { apontamento_inicial: apontamento.trim() } : null,
      });
      data = resposta.data;
      error = resposta.error;
    }

    if (error) {
      alert("Erro ao salvar tarefa: " + mensagemErroOperacional(error));
    } else {
      setListaTarefas((anteriores) => [data, ...anteriores]);
      showToast(
        tarefaManual
          ? "Tarefa manual adicionada ao painel."
          : "Tarefa delegada com sucesso!",
      );
      setTitulo("");
      setDescricao("");
      setFuncId("");
      setResponsavelManual("");
      setNomeClienteTarefa("");
      setClienteDriveTarefa(null);
      setAcaoOutra("");
      setDataLimite("");
      setPrioridade("normal");
      setCategoria(CATEGORIAS_TAREFA[0]);
      setApontamento("");
      setExibirTv(true);
    }

    setSalvandoTarefa(false);
  }

  async function conferirTarefaOperacional(tarefa, acao) {
    const motivo = acao === "corrigir"
      ? window.prompt("Descreva objetivamente a correção necessária (mínimo de 10 caracteres):")
      : null;
    if (acao === "corrigir" && (!motivo || motivo.trim().length < 10)) return;
    const { data, error } = await supabase.rpc("movimentar_tarefa_operacional", {
      p_tarefa_id: Number(tarefa.id), p_acao: acao, p_motivo: motivo?.trim() || null,
      p_checklist: null, p_observacoes: null, p_nome_arquivo: null, p_drive_url: null,
      p_crm_atualizado: false, p_planilha_atualizada: false,
    });
    if (error) return alert(`Não foi possível conferir a tarefa: ${error.message}`);
    const atualizada = Array.isArray(data) ? data[0] : data;
    setListaTarefas((atuais) => atuais.map((item) => String(item.id) === String(atualizada.id) ? atualizada : item));
    showToast(acao === "aprovar" ? "Tarefa conferida e concluída." : "Correção enviada ao responsável.");
  }

  async function concluirMinhaTarefa(tarefa, imagemComprovacao = null) {
    const entrega = entregasConclusao[tarefa.id] || {};
    const falha = validarEntregaPop(entrega, tarefa);
    if (falha) {
      alert(`Tarefa não pode ser concluída. ${falha}`);
      return;
    }
    setTarefaConcluindoId(tarefa.id);
    try {
      const caminhoImagem = await enviarImagemComprovacao(tarefa, imagemComprovacao);
      const { data, error } = await supabase.rpc(
        "concluir_tarefa_propria_supervisor",
        {
          p_tarefa_id: Number(tarefa.id),
          p_observacoes: entrega.observacoes.trim(),
          p_drive_url: entrega.driveUrl.trim() || null,
        },
      );
      if (error) throw error;

      let tarefaAtualizada = Array.isArray(data) ? data[0] : data;
      if (!tarefaAtualizada) {
        throw new Error("O banco não confirmou a conclusão.");
      }

      if (caminhoImagem) {
        const tarefaComImagem = await registrarImagemComprovacao(tarefa, caminhoImagem);
        if (tarefaComImagem) tarefaAtualizada = tarefaComImagem;
      }

      setListaTarefas((atuais) =>
        atuais.map((item) =>
          String(item.id) === String(tarefaAtualizada.id)
            ? tarefaAtualizada
            : item,
        ),
      );
      setTarefasSelecionadas((atuais) =>
        atuais.filter((id) => id !== String(tarefa.id)),
      );
      if (String(tarefaEmEdicao?.id) === String(tarefa.id)) {
        setTarefaEmEdicao(null);
      }
      setTarefaEmConclusao(null);
      setEntregasConclusao((atuais) => ({ ...atuais, [tarefa.id]: {} }));
      showToast("Tratativa concluída dentro do prazo operacional.");
    } catch (error) {
      console.error("Erro ao concluir tarefa do supervisor:", error);
      alert(
        "Não foi possível concluir a tarefa: " +
          mensagemErroOperacional(error),
      );
    } finally {
      setTarefaConcluindoId(null);
    }
  }

  async function devolverMinhaTarefa({ motivo, comentario }) {
    if (!tarefaEmDevolucao) return;
    try {
      const resposta = tarefaEmDevolucao.origem === "operacional"
        ? await supabase.rpc("movimentar_tarefa_operacional", {
            p_tarefa_id: Number(tarefaEmDevolucao.id), p_acao: "devolver_solicitante",
            p_motivo: `${motivo}: ${comentario}`, p_checklist: null, p_observacoes: comentario,
            p_nome_arquivo: null, p_drive_url: null, p_crm_atualizado: false, p_planilha_atualizada: false,
          })
        : await supabase.rpc("devolver_tarefa", {
            p_tarefa_id: Number(tarefaEmDevolucao.id), p_motivo: motivo, p_comentario: comentario,
          });
      if (resposta.error) throw resposta.error;
      const atualizada = Array.isArray(resposta.data) ? resposta.data[0] : resposta.data;
      if (!atualizada) throw new Error("O banco não confirmou a devolução.");
      setListaTarefas((atuais) => atuais.map((item) => String(item.id) === String(atualizada.id) ? atualizada : item));
      setTarefaEmDevolucao(null);
      showToast("Tarefa devolvida com a observação registrada.");
    } catch (error) {
      alert(`Não foi possível devolver a tarefa: ${mensagemErroOperacional(error)}`);
    }
  }

  function iniciarEdicaoTarefa(tarefa) {
    setTarefaEmEdicao({
      ...tarefa,
      funcionaria_id: tarefa.funcionaria_id
        ? String(tarefa.funcionaria_id)
        : "",
      responsavel_texto: tarefa.responsavel_texto || "",
      pontos_tarefa: tarefa.pontos_tarefa ?? 0,
      data_limite: tarefa.data_limite || "",
      prioridade: tarefa.prioridade || "normal",
      categoria: tarefa.categoria || CATEGORIAS_TAREFA[0],
      apontamento: tarefa.apontamento || "",
      exibir_tv: tarefa.exibir_tv !== false,
    });
  }

  function atualizarCampoEdicao(campo, valor) {
    setTarefaEmEdicao((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvarEdicaoTarefa(event) {
    event.preventDefault();
    if (!tarefaEmEdicao) return;

    setSalvandoEdicao(true);
    try {
      const resposta = tarefaEmEdicao.tarefa_manual
        ? await supabase.rpc("salvar_tarefa_manual_supervisor", {
            p_tarefa_id: Number(tarefaEmEdicao.id),
            p_titulo: tarefaEmEdicao.titulo.trim(),
            p_descricao: tarefaEmEdicao.descricao?.trim() || null,
            p_responsavel_texto:
              tarefaEmEdicao.responsavel_texto?.trim() || null,
            p_data_limite: tarefaEmEdicao.data_limite || null,
            p_status: tarefaEmEdicao.status,
            p_prioridade: tarefaEmEdicao.prioridade,
            p_categoria: tarefaEmEdicao.categoria,
            p_apontamento: tarefaEmEdicao.apontamento?.trim() || null,
            p_exibir_tv: tarefaEmEdicao.exibir_tv,
          })
        : await supabase.rpc("atualizar_tarefa_supervisor", {
          p_tarefa_id: Number(tarefaEmEdicao.id),
          p_titulo: tarefaEmEdicao.titulo.trim(),
          p_descricao: tarefaEmEdicao.descricao?.trim() || null,
          p_funcionaria_id: Number(tarefaEmEdicao.funcionaria_id),
          p_pontos_tarefa: Math.max(
            0,
            Number(tarefaEmEdicao.pontos_tarefa) || 0,
          ),
          p_data_limite: tarefaEmEdicao.data_limite || null,
          p_status: tarefaEmEdicao.status,
          p_prioridade: tarefaEmEdicao.prioridade,
          p_categoria: tarefaEmEdicao.categoria,
          p_apontamento: tarefaEmEdicao.apontamento?.trim() || null,
          p_exibir_tv: tarefaEmEdicao.exibir_tv,
        });

      const { data, error } = resposta;

      if (error) throw error;

      const tarefaAtualizada = Array.isArray(data) ? data[0] : data;
      if (!tarefaAtualizada) {
        throw new Error("O banco nao confirmou a atualizacao.");
      }

      setListaTarefas((atuais) =>
        atuais.map((tarefa) =>
          String(tarefa.id) === String(tarefaAtualizada.id)
            ? tarefaAtualizada
            : tarefa,
        ),
      );
      setTarefaEmEdicao(null);
      await recarregarTarefas();
      showToast("Tarefa e apontamento atualizados.");
    } catch (error) {
      console.error("Erro ao editar tarefa:", error);
      alert(
        "Nao foi possivel atualizar a tarefa: " +
          (error?.message || "operacao nao confirmada"),
      );
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function excluirTarefa(tarefa) {
    const confirmou = window.confirm(
      `Excluir definitivamente a tarefa "${tarefa.titulo}"?`,
    );
    if (!confirmou) return;

    const { data, error } = await supabase
      .from("tarefas")
      .delete()
      .eq("id", tarefa.id)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      alert(
        "Nao foi possivel excluir a tarefa: " +
          (error?.message || "operacao nao confirmada"),
      );
      return;
    }

    setListaTarefas((atuais) =>
      atuais.filter((item) => String(item.id) !== String(tarefa.id)),
    );
    if (String(tarefaEmEdicao?.id) === String(tarefa.id)) {
      setTarefaEmEdicao(null);
    }
    showToast("Tarefa excluida.");
  }

  function alternarSelecaoTarefa(id) {
    const chave = String(id);
    setTarefasSelecionadas((atuais) =>
      atuais.includes(chave)
        ? atuais.filter((item) => item !== chave)
        : [...atuais, chave],
    );
  }

  function alternarTodasTarefas() {
    const idsVisiveis = tarefasOperacionaisVisiveis.map((tarefa) => String(tarefa.id));
    const todasSelecionadas =
      idsVisiveis.length > 0 &&
      idsVisiveis.every((id) => tarefasSelecionadas.includes(id));

    setTarefasSelecionadas((atuais) =>
      todasSelecionadas
        ? atuais.filter((id) => !idsVisiveis.includes(id))
        : [...new Set([...atuais, ...idsVisiveis])],
    );
  }

  async function alterarStatusEmMassa(status) {
    if (tarefasSelecionadas.length === 0) return;
    const confirmou = window.confirm(
      `Alterar ${tarefasSelecionadas.length} tarefa(s) para "${rotuloStatusTarefa(status)}"?`,
    );
    if (!confirmou) return;

    setProcessandoEmMassa(true);
    try {
      const ids = tarefasSelecionadas.map(Number);
      const alteracoes = status === "arquivada"
        ? { status, exibir_tv: false }
        : { status };
      const { error } = await supabase
        .from("tarefas")
        .update(alteracoes)
        .in("id", ids);
      if (error) throw error;
      setTarefasSelecionadas([]);
      await recarregarTarefas();
      showToast(`${ids.length} tarefa(s) atualizada(s).`);
    } catch (error) {
      alert(`Não foi possível atualizar as tarefas: ${error.message}`);
    } finally {
      setProcessandoEmMassa(false);
    }
  }

  async function excluirSelecionadas() {
    if (tarefasSelecionadas.length === 0) return;
    const confirmou = window.confirm(
      `Excluir definitivamente ${tarefasSelecionadas.length} tarefa(s)? Esta ação não pode ser desfeita.`,
    );
    if (!confirmou) return;

    setProcessandoEmMassa(true);
    try {
      const ids = tarefasSelecionadas.map(Number);
      const { error } = await supabase.from("tarefas").delete().in("id", ids);
      if (error) throw error;
      setTarefasSelecionadas([]);
      await recarregarTarefas();
      showToast(`${ids.length} tarefa(s) excluída(s).`);
    } catch (error) {
      alert(`Não foi possível excluir as tarefas: ${error.message}`);
    } finally {
      setProcessandoEmMassa(false);
    }
  }

  function abrirPainelTvNovaAba() {
    const url = new URL(window.location.href);
    url.searchParams.set("modo", "tv");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }

  function sairDoModoTv() {
    const url = new URL(window.location.href);
    url.searchParams.delete("modo");
    window.history.replaceState({}, "", url);
    setModoTv(false);
  }

  async function alterarPontosFuncionario(id, quantidade) {
    const funcionario = funcionarios.find(f => f.id === id);
    if (!funcionario) return;

    const novosPontos = Math.max(0, (funcionario.pontos || 0) + quantidade);

    const { data, error } = await supabase
      .from("funcionarios")
      .update({ pontos: novosPontos })
      .eq("id", id)
      .select("id, pontos")
      .maybeSingle();

    if (error || !data) {
      alert("Erro ao atualizar pontos: " + (error?.message || "alteração não confirmada"));
    } else {
      setFuncionarios((anteriores) =>
        anteriores.map((f) => (f.id === id ? { ...f, pontos: data.pontos } : f))
      );
      showToast(`Pontos atualizados com sucesso!`);
    }
  }

  function iniciarCadastroIntegrante(funcionario = null) {
    setPerfilIntegrante(
      funcionario
        ? {
            ...criarPerfilIntegranteVazio(),
            ...funcionario,
            data_admissao: funcionario.data_admissao || "",
            foto_url: funcionario.foto_url || "",
            observacao_interna: funcionario.observacao_interna || "",
            permissoes: {
              ...criarPerfilIntegranteVazio().permissoes,
              ...(funcionario.permissoes || {}),
            },
          }
        : criarPerfilIntegranteVazio(),
    );
    setModoEquipe("cadastro");
  }

  function atualizarPerfilIntegrante(campo, valor) {
    setPerfilIntegrante((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvarPerfilIntegrante(event) {
    event.preventDefault();
    setSalvandoIntegrante(true);
    try {
      const { data, error } = await supabase.rpc("salvar_funcionario_supervisor", {
        p_funcionario_id: perfilIntegrante.id ? Number(perfilIntegrante.id) : null,
        p_nome: perfilIntegrante.nome.trim(),
        p_email: perfilIntegrante.email.trim().toLowerCase(),
        p_cargo: perfilIntegrante.cargo.trim() || null,
        p_setor: perfilIntegrante.setor.trim() || null,
        p_data_admissao: perfilIntegrante.data_admissao || null,
        p_foto_url: perfilIntegrante.foto_url.trim() || null,
        p_permissoes: perfilIntegrante.permissoes,
        p_observacao_interna: perfilIntegrante.observacao_interna.trim() || null,
      });
      if (error) throw error;
      const salvo = Array.isArray(data) ? data[0] : data;
      if (!salvo) throw new Error("O banco não confirmou o cadastro.");
      await recarregarFuncionarios();
      setModoEquipe("membros");
      showToast(perfilIntegrante.id ? "Cadastro atualizado." : "Integrante cadastrada. Configure o acesso em Authentication.");
    } catch (error) {
      alert(`Não foi possível salvar a integrante: ${error.message}`);
    } finally {
      setSalvandoIntegrante(false);
    }
  }

  function iniciarDesligamento(funcionario) {
    setDesligamento(criarDesligamentoVazio(funcionario.id));
    setModoEquipe("desligamento");
  }

  async function reativarIntegrante(funcionario) {
    if (!window.confirm(`Reativar o acesso interno de ${funcionario.nome}?`)) return;
    const { error } = await supabase
      .from("funcionarios")
      .update({ ativo: true, data_desligamento: null })
      .eq("id", funcionario.id);
    if (error) return alert(`Não foi possível reativar: ${error.message}`);
    await recarregarFuncionarios();
    showToast("Integrante reativada.");
  }

  async function executarDesligamento(event) {
    event.preventDefault();
    if (desligamento.destino === "transferir" && !desligamento.nova_funcionaria_id) {
      return alert("Selecione quem receberá as tarefas abertas.");
    }
    const origem = equipeCompleta.find((item) => String(item.id) === desligamento.funcionario_id);
    if (!origem || !window.confirm(`Confirmar o desligamento de ${origem.nome}?`)) return;
    setProcessandoDesligamento(true);
    try {
      const { data, error } = await supabase.rpc("desligar_funcionario_supervisor", {
        p_funcionario_id: Number(desligamento.funcionario_id),
        p_destino: desligamento.destino,
        p_nova_funcionaria_id: desligamento.nova_funcionaria_id ? Number(desligamento.nova_funcionaria_id) : null,
        p_data_desligamento: desligamento.data_desligamento,
        p_observacao: desligamento.observacao.trim() || null,
      });
      if (error) throw error;
      await Promise.all([recarregarFuncionarios(), recarregarTarefas()]);
      setModoEquipe("membros");
      setDesligamento(criarDesligamentoVazio());
      showToast(`Desligamento concluído. ${data?.tarefas_processadas || 0} tarefa(s) tratada(s).`);
    } catch (error) {
      alert(`Não foi possível concluir o desligamento: ${error.message}`);
    } finally {
      setProcessandoDesligamento(false);
    }
  }

  async function transferirTarefasFuncionario(origem) {
    const destinos = equipe.filter((item) => String(item.id) !== String(origem.id));
    if (destinos.length === 0) return alert("Não há outra integrante ativa para receber as tarefas.");
    const opcoes = destinos.map((item) => `${item.id} - ${item.nome}`).join("\n");
    const destinoId = window.prompt(`Informe o ID da nova responsável:\n${opcoes}`);
    const destino = destinos.find((item) => String(item.id) === String(destinoId));
    if (!destino) return;
    if (!window.confirm(`Transferir todas as tarefas abertas de ${origem.nome} para ${destino.nome}?`)) return;

    const ids = listaTarefas
      .filter((tarefa) => String(tarefa.funcionaria_id) === String(origem.id) && STATUS_ABERTOS.has(tarefa.status))
      .map((tarefa) => tarefa.id);
    if (ids.length === 0) return showToast("Não existem tarefas abertas para transferir.");
    const { error } = await supabase.from("tarefas").update({ funcionaria_id: destino.id }).in("id", ids);
    if (error) return alert(`Não foi possível transferir: ${error.message}`);
    await recarregarTarefas();
    showToast(`${ids.length} tarefa(s) transferida(s) para ${destino.nome}.`);
  }

  async function handleEnviarFeedback(e) {
    e.preventDefault();
    const mensagem = feedbackMsg.trim();
    if (!feedbackFuncId || !mensagem) {
      return alert("Selecione a funcionária e digite a mensagem.");
    }
    setEnviandoFeedback(true);

    const novoFeedback = {
      funcionaria_id: Number(feedbackFuncId),
      mensagem,
      tipo: feedbackTipo,
    };

    try {
      const { data, error } = await supabase
        .from("feedbacks")
        .insert(novoFeedback)
        .select("*")
        .single();

      if (error || !data) {
        throw error || new Error("O banco não confirmou o registro.");
      }

      setFeedbacks((anteriores) => [
        data,
        ...anteriores.filter((feedback) => feedback.id !== data.id),
      ]);
      showToast("Feedback enviado com sucesso!");
      setFeedbackMsg("");
      setFeedbackFuncId("");
    } catch (error) {
      alert(
        "Erro ao enviar feedback: " +
          (error?.message || "registro não confirmado"),
      );
    } finally {
      setEnviandoFeedback(false);
    }
  }

  async function handleSalvarResponsabilidades(e) {
    e.preventDefault();

    if (!responsabilidadeFuncId || !responsabilidadeMes) {
      return alert("Selecione a funcionária e o mês de referência.");
    }

    const tarefas = responsabilidadeTexto
      .split(/\r?\n/)
      .map((tarefa) => tarefa.trim())
      .filter(Boolean);

    setSalvandoResponsabilidades(true);

    try {
      const marcador =
        `${RESPONSABILIDADE_MENSAL_PREFIXO}:${responsabilidadeMes}:`;
      const { data: registrosAnteriores, error: erroConsulta } = await supabase
        .from("tarefas")
        .select("id")
        .eq("funcionaria_id", Number(responsabilidadeFuncId))
        .eq("status", "responsabilidade_mensal")
        .eq("data_limite", `${responsabilidadeMes}-01`);

      if (erroConsulta) throw erroConsulta;

      let data = [];
      let tarefasSalvas = [];
      if (tarefas.length > 0) {
        const registros = tarefas.map((tituloTarefa, indice) => ({
          titulo: tituloTarefa,
          descricao: `${marcador}${indice + 1}`,
          funcionaria_id: Number(responsabilidadeFuncId),
          pontos_tarefa: 0,
          data_limite: `${responsabilidadeMes}-01`,
          status: "responsabilidade_mensal",
        }));
        const { data: novosRegistros, error: erroInsercao } = await supabase
          .from("tarefas")
          .insert(registros)
          .select("*");

        if (erroInsercao) throw erroInsercao;
        tarefasSalvas = novosRegistros || [];
        data = (tarefasSalvas || []).map(converterTarefaEmResponsabilidade);
      }

      const idsAnteriores = (registrosAnteriores || []).map(
        (registro) => registro.id,
      );
      if (idsAnteriores.length > 0) {
        const { error: erroRemocao } = await supabase
          .from("tarefas")
          .delete()
          .in("id", idsAnteriores);

        if (erroRemocao) {
          const idsNovos = tarefasSalvas.map((registro) => registro.id);
          if (idsNovos.length > 0) {
            await supabase.from("tarefas").delete().in("id", idsNovos);
          }
          throw erroRemocao;
        }
      }

      setResponsabilidadesMensais((atuais) => [
        ...atuais.filter(
          (item) =>
            !(
              String(item.funcionaria_id) ===
                String(responsabilidadeFuncId) &&
              item.mes_referencia?.slice(0, 7) === responsabilidadeMes
            ),
        ),
        ...(data || []),
      ]);
      await recarregarResponsabilidadesMensais();
      showToast(
        tarefas.length > 0
          ? "Responsabilidades mensais salvas com sucesso!"
          : "Responsabilidades do mês removidas.",
      );
    } catch (error) {
      console.error("Erro ao salvar responsabilidades mensais:", error);
      alert(
        "Não foi possível salvar as responsabilidades: " +
          (error?.message || "operação não confirmada"),
      );
    } finally {
      setSalvandoResponsabilidades(false);
    }
  }

  if (modoTv) {
    return (
      <PainelEquipeTV
        funcionarios={equipe}
        onAtualizar={recarregarTarefas}
        onSair={sairDoModoTv}
        tarefas={listaTarefas}
      />
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/assets/platino-infohub-icon.png" alt="Platino" className="brand-icon" />
          <div>
            <strong>PLATINO</strong>
            <span>Operating Workspace</span>
          </div>
        </div>
        <nav>
          <span className="nav-label">Navegação</span>
          <NavItem active={abaAtiva === "dashboard"} icon="dashboard" onClick={() => setAbaAtiva("dashboard")} options={["Indicadores", "Urgências", "Ranking"]}>Dashboard</NavItem>
          <NavItem active={abaAtiva === "tarefas"} icon="tarefas" onClick={() => setAbaAtiva("tarefas")} options={["Criar tarefa", "Apontamentos", "Filtros rápidos"]}>Tarefas</NavItem>
          <NavItem active={abaAtiva === "clientes"} icon="equipe" onClick={() => setAbaAtiva("clientes")}>Clientes</NavItem>
          <NavItem active={abaAtiva === "urgencias"} icon="feedback" onClick={() => setAbaAtiva("urgencias")}>Urgências</NavItem>
          <NavItem active={abaAtiva === "historico"} icon="planner" onClick={() => setAbaAtiva("historico")}>Histórico de tarefas</NavItem>
          <NavItem active={false} icon="tv" onClick={() => setModoTv(true)} options={["Modo painel", "Operação ao vivo"]}>Painel TV</NavItem>
          <NavItem active={abaAtiva === "equipe"} icon="equipe" onClick={() => setAbaAtiva("equipe")} options={["Equipe", "Feedbacks", "Pontuação"]}>Equipe</NavItem>
          <NavItem active={abaAtiva === "processual"} icon="processual" onClick={() => setAbaAtiva("processual")} options={["Organizar resumo", "Prévia", "Gerar PDF"]}>Processual</NavItem>
          <NavItem active={abaAtiva === "documentos"} icon="documentos" onClick={() => setAbaAtiva("documentos")} options={["Gerador PDF", "Prévia viva", "Assistente IA"]}>Documentos</NavItem>
        </nav>
        <button className="sidebar-logout" onClick={onLogout}><UiIcon name="logout" /> Sair do Sistema</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Painel de Supervisão</h1>
            <p>Controle centralizado da esteira operacional.</p>
          </div>
          <div className="topbar-actions">
            <CentralNotificacoesBell />
            <div className="profile-pill">
              <span className="online-dot" />
              <div><small>Supervisor online</small><span>{usuario.nome}</span></div>
            </div>
          </div>
        </header>

        {abaAtiva === "dashboard" && (
          <>
            <CentralInicio tarefas={listaTarefas} usuario={usuario} onNavigate={setAbaAtiva} />
            <section className="cards-grid">
              <div className="card" onClick={() => { setFiltroTarefas("abertas"); setAbaAtiva("tarefas"); }} style={{ cursor: 'pointer' }}>
                <MetricIcon type="tarefas" />
                <span>Tarefas Pendentes</span>
                <strong>{tarefasPendentes.length}</strong>
              </div>
              <div className="card" onClick={() => { setFiltroTarefas("urgente"); setAbaAtiva("tarefas"); }} style={{ cursor: 'pointer' }}>
                <MetricIcon type="tv" />
                <span>Tarefas Urgentes</span>
                <strong>{tarefasUrgentes.length}</strong>
              </div>
              <div className="card" onClick={() => setAbaAtiva("equipe")} style={{ cursor: 'pointer' }}>
                <MetricIcon type="feedback" />
                <span>Feedbacks</span>
                <strong>{feedbacks.length} registrados</strong>
              </div>
              <div className="card" onClick={() => setAbaAtiva("equipe")} style={{ cursor: 'pointer' }}>
                <MetricIcon type="equipe" />
                <span>Equipe</span>
                <strong>{equipe.length} Ativas</strong>
              </div>
            </section>

            <section className="panel large">
              <div className="panel-title-row">
                <div><h2>Central de operações</h2><p>A página inicial mostra apenas indicadores e atalhos.</p></div>
                <div className="task-history-actions">
                  <button className="btn-primary" onClick={() => setAbaAtiva("tarefas")}>Delegar tarefa</button>
                  <button className="btn-secondary" onClick={() => setAbaAtiva("historico")}>Ver histórico</button>
                </div>
              </div>
            </section>
          </>
        )}

        {abaAtiva === "clientes" && <ModuloClientes podeSincronizar />}
        {abaAtiva === "urgencias" && <ModuloUrgencias usuario={usuario} funcionarios={funcionarios} showToast={showToast} />}

        {abaAtiva === "tarefas" && (
          <div className="task-management">
            <section className="panel task-management-header">
              <div>
                <span className="eyebrow">Central de operacoes</span>
                <h2>Gestao das tarefas da equipe</h2>
                <p>
                  Delegue, altere prioridades, registre apontamentos e escolha
                  o que sera exibido na TV.
                </p>
              </div>
              <div className="task-management-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setMostrarTarefasMes((atual) => !atual)}
                >
                  {mostrarTarefasMes ? "Ocultar tarefas do mês" : "Tarefas do mês"}
                </button>
                <button className="btn-secondary" onClick={() => setModoTv(true)}>
                  Visualizar painel
                </button>
                <button className="btn-primary" onClick={abrirPainelTvNovaAba}>
                  Abrir na TV
                </button>
              </div>
            </section>

            <section className={`task-editor-grid ${tarefaEmEdicao ? "with-editor" : "single-column"}`}>
              <div className="panel">
                <h2>
                  {tarefaManual
                    ? "Adicionar tarefa manual na TV"
                    : "Delegar nova tarefa"}
                </h2>
                <form className="stack-form task-form" onSubmit={handleCriarTarefa}>
                  <div className="task-kind-switch">
                    <button
                      className={!tarefaManual ? "active" : ""}
                      onClick={() => setTarefaManual(false)}
                      type="button"
                    >
                      Tarefa delegada
                    </button>
                    <button
                      className={tarefaManual ? "active" : ""}
                      onClick={() => setTarefaManual(true)}
                      type="button"
                    >
                      Manual da TV
                    </button>
                  </div>
                  {tarefaManual && <label>
                    Titulo
                    <input
                      type="text"
                      placeholder="Ex.: Conferir contratos recebidos"
                      value={titulo}
                      onChange={(event) => setTitulo(event.target.value)}
                      required
                    />
                  </label>}
                  {!tarefaManual && <div className="task-form-row">
                    <ClienteDriveSelector
                      required
                      selecionado={clienteDriveTarefa}
                      onSelecionar={(cliente) => {
                        setClienteDriveTarefa(cliente);
                        setNomeClienteTarefa(cliente?.nome || "");
                      }}
                    />
                    <label>Setor solicitante<select required value={setorSolicitante} onChange={(event) => setSetorSolicitante(event.target.value)}><option>Supervisão</option><option>Administrativo</option><option>Jurídico</option><option>Comercial</option><option>Processual</option></select></label>
                  </div>}
                  <label>
                    Solicitação
                    <textarea
                      placeholder="Descreva exatamente o que precisa ser executado."
                      value={descricao}
                      onChange={(event) => setDescricao(event.target.value)}
                      rows="4"
                      required={!tarefaManual}
                    />
                  </label>
                  <SeletorAcaoVisual valor={categoria} onChange={setCategoria} />
                  {categoria === "OUTROS" && !tarefaManual && <label>Descreva a outra ação<input required value={acaoOutra} onChange={(event) => setAcaoOutra(event.target.value)} placeholder="Informe exatamente o que deverá ser executado" /></label>}
                  {!tarefaManual && <div className="task-auto-title"><span>Título gerado automaticamente</span><strong>{tituloAutomaticoDaTarefa(categoria, acaoOutra) || "Descreva a ação para definir o título"}</strong></div>}
                  <div className="task-form-details">
                  <div className="task-form-row">
                    {!tarefaManual && <label>Setor executor<select required value={setorExecutor} onChange={(event) => setSetorExecutor(event.target.value)}><option>Administrativo</option><option>Jurídico</option><option>Comercial</option><option>Processual</option></select></label>}
                    {tarefaManual ? (
                      <label>
                        Responsavel ou setor
                        <input
                          placeholder="Ex.: Equipe, Tafarel ou Financeiro"
                          value={responsavelManual}
                          onChange={(event) =>
                            setResponsavelManual(event.target.value)
                          }
                        />
                      </label>
                    ) : (
                      <label>
                        Responsavel
                        <select
                          value={funcId}
                          onChange={(event) => setFuncId(event.target.value)}
                          required
                        >
                          <option value="">Selecione...</option>
                          {destinatariosTarefa.map((funcionario) => (
                            <option key={funcionario.id} value={funcionario.id}>
                              {funcionario.nome} ({funcionario.cargo})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="task-form-row">
                    <label>
                      Prazo obrigatório
                      <input
                        type={tarefaManual ? "date" : "datetime-local"}
                        value={dataLimite}
                        onChange={(event) => setDataLimite(event.target.value)}
                        required
                      />
                    </label>
                    <SeletorPrioridadeVisual valor={prioridade} onChange={setPrioridade} />
                  </div>
                  </div>
                  <label>
                    Apontamento inicial
                    <textarea
                      placeholder="Ex.: Aguardando documento do cliente."
                      value={apontamento}
                      onChange={(event) => setApontamento(event.target.value)}
                      rows="3"
                    />
                  </label>
                  <label className="task-check-label">
                    <input
                      type="checkbox"
                      checked={exibirTv}
                      onChange={(event) => setExibirTv(event.target.checked)}
                    />
                    Exibir esta tarefa no painel da TV
                  </label>
                  <button
                    type="submit"
                    className="btn-primary task-delegation-submit"
                    disabled={salvandoTarefa}
                  >
                    {salvandoTarefa
                      ? "Publicando..."
                      : tarefaManual
                        ? "Adicionar ao painel"
                        : "Delegar tarefa"}
                  </button>
                </form>
              </div>

              {tarefaEmEdicao && <div className="panel">
                {tarefaEmEdicao ? (
                  <>
                    <div className="panel-title-row">
                      <h2>Editar tarefa #{tarefaEmEdicao.id}</h2>
                      <button
                        className="btn-secondary compact"
                        onClick={() => setTarefaEmEdicao(null)}
                        type="button"
                      >
                        Cancelar
                      </button>
                    </div>
                    <form
                      className="stack-form task-form"
                      onSubmit={salvarEdicaoTarefa}
                    >
                      <label>
                        Titulo
                        <input
                          value={tarefaEmEdicao.titulo}
                          onChange={(event) =>
                            atualizarCampoEdicao("titulo", event.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        Descricao
                        <textarea
                          value={tarefaEmEdicao.descricao || ""}
                          onChange={(event) =>
                            atualizarCampoEdicao("descricao", event.target.value)
                          }
                          rows="3"
                        />
                      </label>
                      <label>
                        Categoria
                        <select
                          value={tarefaEmEdicao.categoria}
                          onChange={(event) =>
                            atualizarCampoEdicao(
                              "categoria",
                              event.target.value,
                            )
                          }
                          required
                        >
                          {CATEGORIAS_TAREFA.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="task-form-row">
                        {tarefaEmEdicao.tarefa_manual ? (
                          <label>
                            Responsavel ou setor
                            <input
                              value={tarefaEmEdicao.responsavel_texto}
                              onChange={(event) =>
                                atualizarCampoEdicao(
                                  "responsavel_texto",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        ) : (
                          <label>
                            Responsavel
                            <select
                              value={tarefaEmEdicao.funcionaria_id}
                              onChange={(event) =>
                                atualizarCampoEdicao(
                                  "funcionaria_id",
                                  event.target.value,
                                )
                              }
                            >
                              {destinatariosTarefa.map((funcionario) => (
                                <option
                                  key={funcionario.id}
                                  value={funcionario.id}
                                >
                                  {funcionario.nome}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label>
                          Status
                          <select
                            value={tarefaEmEdicao.status}
                            onChange={(event) =>
                              atualizarCampoEdicao("status", event.target.value)
                            }
                          >
                            {STATUS_TAREFA.map((item) => (
                              <option
                                disabled={item.valor === "devolvida"}
                                key={item.valor}
                                value={item.valor}
                              >
                                {item.rotulo}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="task-form-row">
                        <label>
                          Prioridade
                          <select
                            value={tarefaEmEdicao.prioridade}
                            onChange={(event) =>
                              atualizarCampoEdicao(
                                "prioridade",
                                event.target.value,
                              )
                            }
                          >
                            <option value="normal">Normal</option>
                            <option value="alta">Alta</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </label>
                        <label>
                          Prazo
                          <input
                            type="date"
                            value={tarefaEmEdicao.data_limite}
                            onChange={(event) =>
                              atualizarCampoEdicao(
                                "data_limite",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                      {!tarefaEmEdicao.tarefa_manual && (
                        <label>
                          Pontos
                          <input
                            min="0"
                            type="number"
                            value={tarefaEmEdicao.pontos_tarefa}
                            onChange={(event) =>
                              atualizarCampoEdicao(
                                "pontos_tarefa",
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      )}
                      <label>
                        Apontamento atualizado
                        <textarea
                          placeholder="Registre o andamento, bloqueio ou proxima acao."
                          value={tarefaEmEdicao.apontamento}
                          onChange={(event) =>
                            atualizarCampoEdicao(
                              "apontamento",
                              event.target.value,
                            )
                          }
                          rows="4"
                        />
                      </label>
                      <label className="task-check-label">
                        <input
                          type="checkbox"
                          checked={tarefaEmEdicao.exibir_tv}
                          onChange={(event) =>
                            atualizarCampoEdicao(
                              "exibir_tv",
                              event.target.checked,
                            )
                          }
                        />
                        Exibir esta tarefa no painel da TV
                      </label>
                      <button
                        className="btn-primary"
                        disabled={salvandoEdicao}
                        type="submit"
                      >
                        {salvandoEdicao ? "Salvando..." : "Salvar alteracoes"}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="task-editor-empty">
                    <MetricIcon type="tarefas" />
                    <h2>Selecione uma tarefa</h2>
                    <p>
                      Use o botao Editar na lista abaixo para atualizar status,
                      prioridade, prazo, responsavel e apontamento.
                    </p>
                  </div>
                )}
              </div>}
            </section>

            <section className="panel task-list-panel">
              <div className="panel-title-row task-list-heading">
                <div>
                  <span className="eyebrow">Esteira operacional</span>
                  <h2>Atividades da equipe</h2>
                </div>
                <div className="task-list-controls">
                  <select
                    value={filtroTarefas}
                    onChange={(event) => setFiltroTarefas(event.target.value)}
                    aria-label="Filtrar tarefas"
                  >
                    <option value="todas">Todas</option>
                    <option value="manuais">Manuais da TV</option>
                    <option value="abertas">Abertas</option>
                    <option value="urgente">Urgentes</option>
                    {STATUS_TASKMANAGER.map((item) => (
                      <option key={item.chave} value={`macro:${item.chave}`}>
                        {item.rotulo}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filtroResponsavel}
                    onChange={(event) => setFiltroResponsavel(event.target.value)}
                    aria-label="Filtrar por colaboradora"
                  >
                    <option value="todas">Todas as colaboradoras</option>
                    <option value="minhas">Minhas tarefas — Tafarel</option>
                    {equipeCompleta.map((funcionario) => (
                      <option key={funcionario.id} value={funcionario.id}>
                        {funcionario.nome}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={filtroPrazo}
                    onChange={(event) => setFiltroPrazo(event.target.value)}
                    aria-label="Filtrar por prazo"
                  />
                  <select
                    value={filtroCategoria}
                    onChange={(event) => setFiltroCategoria(event.target.value)}
                    aria-label="Filtrar por categoria"
                  >
                    <option value="todas">Todas as categorias</option>
                    {CATEGORIAS_TAREFA.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-secondary compact"
                    onClick={recarregarTarefas}
                  >
                    Atualizar
                  </button>
                </div>
              </div>

              <div className="task-bulk-toolbar">
                <label>
                  <input
                    type="checkbox"
                    checked={
                      tarefasOperacionaisVisiveis.length > 0 &&
                      tarefasOperacionaisVisiveis.every((tarefa) =>
                        tarefasSelecionadas.includes(String(tarefa.id)),
                      )
                    }
                    onChange={alternarTodasTarefas}
                  />
                  Selecionar todas ({tarefasSelecionadas.length})
                </label>
                <div>
                  <button
                    className="btn-secondary compact"
                    disabled={processandoEmMassa || tarefasSelecionadas.length === 0}
                    onClick={() => alterarStatusEmMassa("arquivada")}
                  >
                    Arquivar selecionadas
                  </button>
                  <button
                    className="btn-danger compact"
                    disabled={processandoEmMassa || tarefasSelecionadas.length === 0}
                    onClick={excluirSelecionadas}
                  >
                    Excluir definitivamente
                  </button>
                </div>
              </div>

              {tarefasOperacionaisFiltradas.length === 0 && (
                <div className="monthly-empty">
                  Nenhuma tarefa encontrada neste filtro.
                </div>
              )}

              <div className="admin-task-list">
                {tarefasOperacionaisVisiveis.map((tarefa) => {
                  const responsavel = destinatariosTarefa.find(
                    (funcionario) =>
                      String(funcionario.id) ===
                      String(tarefa.funcionaria_id),
                  );
                  const nomeResponsavel =
                    tarefa.responsavel_texto ||
                    responsavel?.nome ||
                    (tarefa.tarefa_manual ? "Equipe" : "Nao atribuida");
                  const tarefaDoUsuario = tarefaAtribuidaAoUsuario(
                    tarefa,
                    usuario,
                    funcionarioDoUsuario,
                  );

                  return (
                    <article
                      className={`admin-task-card priority-${tarefa.prioridade || "normal"}`}
                      key={tarefa.id}
                    >
                      <input
                        className="task-select-checkbox"
                        type="checkbox"
                        checked={tarefasSelecionadas.includes(String(tarefa.id))}
                        onChange={() => alternarSelecaoTarefa(tarefa.id)}
                        aria-label={`Selecionar tarefa ${tarefa.titulo}`}
                      />
                      <div className="admin-task-main">
                        <div className="admin-task-badges">
                          <span
                            className={`priority-badge priority-${tarefa.prioridade || "normal"}`}
                          >
                            {rotuloPrioridade(tarefa.prioridade)}
                          </span>
                          {tarefa.categoria && (
                            <span className="category-badge">
                              {tarefa.categoria}
                            </span>
                          )}
                          <span className="tv-visibility-badge">
                            {tarefa.exibir_tv === false
                              ? "Oculta na TV"
                              : "Visivel na TV"}
                          </span>
                          {tarefa.tarefa_manual && (
                            <span className="manual-task-badge">
                              Manual da TV
                            </span>
                          )}
                        </div>
                        <ResumoFluxoTarefa tarefa={tarefa} compacto />
                        <h3>{tarefa.titulo}</h3>
                        {tarefa.descricao && <p>{tarefa.descricao}</p>}
                        {tarefa.apontamento && (
                          <div className="admin-task-note">
                            <strong>Apontamento:</strong>{" "}
                            {tarefa.apontamento}
                          </div>
                        )}
                        {tarefa.status === "devolvida" && (
                          <div className="return-alert">
                            <div>
                              <strong>Devolvida · {tarefa.motivo_devolucao || "Correção necessária"}</strong>
                              <small>{formatarDataHora(tarefa.devolvida_em)}</small>
                            </div>
                            <p>{tarefa.comentario_devolucao || "A colaboradora solicitou correção antes de continuar."}</p>
                          </div>
                        )}
                        <small>
                          Responsavel: {nomeResponsavel} | Prazo:{" "}
                          {formatarData(tarefa.data_limite)}
                          {!tarefa.tarefa_manual && tarefa.origem !== "operacional" &&
                            ` | Pontos: ${tarefa.pontos_tarefa ?? 0}`}
                        </small>
                        <LinkComprovanteDrive tarefa={tarefa} />
                        <LinkImagemComprovacao tarefa={tarefa} />
                      </div>
                      <div className="admin-task-actions">
                        {tarefaDoUsuario && tarefa.status !== "devolvida_conferencia" && (
                          <button
                            className="btn-success compact"
                            disabled={tarefaConcluindoId === tarefa.id}
                            onClick={() => setTarefaEmConclusao(tarefa)}
                          >
                            {tarefaConcluindoId === tarefa.id
                              ? "Concluindo..."
                              : "Concluir minha tarefa"}
                          </button>
                        )}
                        {tarefa.status === "devolvida_conferencia" && <>
                          <button className="btn-success compact" onClick={() => conferirTarefaOperacional(tarefa, "aprovar")}>Aprovar e concluir</button>
                          <button className="btn-return compact" onClick={() => conferirTarefaOperacional(tarefa, "corrigir")}>Devolver para ajuste</button>
                        </>}
                        <button
                          className="btn-secondary compact"
                          onClick={() => iniciarEdicaoTarefa(tarefa)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-danger compact"
                          onClick={() => excluirTarefa(tarefa)}
                        >
                          Excluir
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {tarefasOperacionaisFiltradas.length > ITENS_POR_PAGINA && (
                <div className="task-history-actions">
                  <button className="btn-secondary compact" disabled={paginaTarefas === 1} onClick={() => setPaginaTarefas((pagina) => pagina - 1)}>Anterior</button>
                  <small>Página {paginaTarefas} de {Math.ceil(tarefasOperacionaisFiltradas.length / ITENS_POR_PAGINA)}</small>
                  <button className="btn-secondary compact" disabled={paginaTarefas >= Math.ceil(tarefasOperacionaisFiltradas.length / ITENS_POR_PAGINA)} onClick={() => setPaginaTarefas((pagina) => pagina + 1)}>Próxima</button>
                </div>
              )}
            </section>
          </div>
        )}

        {abaAtiva === "historico" && (
          <section className="panel large task-list-panel">
            <div className="panel-title-row">
              <div><span className="eyebrow">Consulta opcional</span><h2>Histórico de tarefas</h2><p>Concluídas, arquivadas e canceladas ficam somente nesta tela.</p></div>
              <button className="btn-secondary" onClick={recarregarTarefas}>Atualizar</button>
            </div>
            {tarefasHistoricoVisiveis.length === 0 ? <div className="monthly-empty">Nenhuma tarefa no histórico.</div> : tarefasHistoricoVisiveis.map((tarefa) => {
              const responsavel = funcionarios.find((item) => String(item.id) === String(tarefa.funcionaria_id));
              return (
                <article className="admin-task-card" key={tarefa.id}>
                  <div className="admin-task-main">
                    <div className="admin-task-badges"><span className={`status ${tarefa.status}`}>{rotuloStatusTarefa(tarefa.status)}</span>{tarefa.categoria && <span className="category-badge">{tarefa.categoria}</span>}</div>
                    <h3>{tarefa.titulo}</h3>{tarefa.descricao && <p>{tarefa.descricao}</p>}
                    <small>Responsável: {tarefa.responsavel_texto || responsavel?.nome || "Não atribuída"} | Prazo: {formatarData(tarefa.data_limite)}</small>
                    <LinkComprovanteDrive tarefa={tarefa} />
                  </div>
                </article>
              );
            })}
            {tarefasHistoricoFiltradas.length > ITENS_POR_PAGINA && <div className="task-history-actions"><button className="btn-secondary compact" disabled={paginaHistorico === 1} onClick={() => setPaginaHistorico((pagina) => pagina - 1)}>Anterior</button><small>Página {paginaHistorico} de {Math.ceil(tarefasHistoricoFiltradas.length / ITENS_POR_PAGINA)}</small><button className="btn-secondary compact" disabled={paginaHistorico >= Math.ceil(tarefasHistoricoFiltradas.length / ITENS_POR_PAGINA)} onClick={() => setPaginaHistorico((pagina) => pagina + 1)}>Próxima</button></div>}
          </section>
        )}

        {abaAtiva === "tarefas" && mostrarTarefasMes && (
          <section className="monthly-admin-grid">
            <div className="panel monthly-editor">
              <span className="eyebrow">Planejamento recorrente</span>
              <h2>Tarefas fixas do mês</h2>
              <p className="monthly-intro">
                Escolha a colaboradora e escreva uma responsabilidade por
                linha. A ordem digitada será a ordem apresentada no painel
                dela.
              </p>

              <form className="stack-form" onSubmit={handleSalvarResponsabilidades}>
                <label>
                  Colaboradora
                  <select
                    value={responsabilidadeFuncId}
                    onChange={(e) =>
                      selecionarFuncionariaResponsabilidades(e.target.value)
                    }
                    required
                  >
                    <option value="">Selecione...</option>
                    {equipe.map((funcionario) => (
                      <option key={funcionario.id} value={funcionario.id}>
                        {funcionario.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Mês de referência
                  <input
                    type="month"
                    value={responsabilidadeMes}
                    onChange={(e) =>
                      selecionarMesResponsabilidades(e.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Responsabilidades
                  <textarea
                    className="monthly-textarea"
                    value={responsabilidadeTexto}
                    onChange={(e) => setResponsabilidadeTexto(e.target.value)}
                    placeholder={"ANALISAR CONTRATO ASSINADO E ANEXAR NO CRM\nANEXAR DOCUMENTOS NO DRIVE E NO CRM\nNOTIFICAÇÃO EXTRAJUDICIAL"}
                    rows="12"
                  />
                </label>

                <small className="form-helper">
                  Para remover todas as tarefas do mês selecionado, deixe a
                  lista vazia e salve.
                </small>

                <button
                  className="btn-primary"
                  disabled={salvandoResponsabilidades}
                  type="submit"
                >
                  {salvandoResponsabilidades
                    ? "Salvando..."
                    : "Salvar tarefas do mês"}
                </button>
              </form>
            </div>

            <div className="panel monthly-preview">
              <div className="panel-title-row">
                <div>
                  <span className="eyebrow">Pré-visualização</span>
                  <h2>
                    {funcionariaResponsabilidades?.nome ||
                      "Selecione uma colaboradora"}
                  </h2>
                </div>
                <span className="month-badge">
                  {formatarMes(responsabilidadeMes)}
                </span>
              </div>

              {responsabilidadesSelecionadas.length === 0 ? (
                <div className="monthly-empty">
                  Nenhuma responsabilidade salva para esta colaboradora neste
                  mês.
                </div>
              ) : (
                <ol className="monthly-list">
                  {responsabilidadesSelecionadas.map((item, indice) => (
                    <li key={item.id}>
                      <span>{indice + 1}</span>
                      <strong>{item.titulo}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}

        {abaAtiva === "equipe" && (
          <section className="team-management-workspace">
            <div className="panel team-management-header">
              <div>
                <span className="eyebrow">Administração da equipe</span>
                <h2>Integrantes e acessos</h2>
                <p>Cadastre perfis, mantenha dados profissionais e conduza desligamentos preservando o histórico.</p>
              </div>
              <div className="team-tabs">
                <button className={modoEquipe === "membros" ? "active" : ""} onClick={() => setModoEquipe("membros")}>Membros</button>
                <button className={modoEquipe === "cadastro" ? "active" : ""} onClick={() => iniciarCadastroIntegrante()}>Adicionar integrante</button>
                <button className={modoEquipe === "desligamento" ? "active" : ""} onClick={() => { setDesligamento(criarDesligamentoVazio()); setModoEquipe("desligamento"); }}>Desligamento</button>
              </div>
            </div>

            {modoEquipe === "membros" && <div className="content-grid team-management-grid">
            <div className="panel team-directory-panel">
              <div className="panel-title-row">
                <div>
                  <span className="eyebrow">Visão por área</span>
                  <h2>Gestão de membros da equipe</h2>
                </div>
                <strong>{membrosGestaoEquipe.filter((membro) => membro.ativo !== false).length} ativos</strong>
              </div>
              <div className="team-groups">
                {equipesGestor.map((grupo) => (
                  <section className={`team-group team-group-${grupo.id}`} key={grupo.id}>
                    <div className="team-group-heading">
                      <div>
                        <span>{grupo.descricao}</span>
                        <h3>{grupo.titulo}</h3>
                      </div>
                      <strong>{grupo.membros.filter((membro) => membro.ativo !== false).length}</strong>
                    </div>
                    <div className="team-list">
                      {grupo.membros.map((f) => (
                        <CartaoGestaoMembro
                          funcionario={f}
                          gestorPrincipal={f.email?.trim().toLowerCase() === ADMIN_EMAIL}
                          key={f.id}
                          onAlterarAtivacao={(funcionario) => funcionario.ativo === false ? reativarIntegrante(funcionario) : iniciarDesligamento(funcionario)}
                          onAlterarPontos={alterarPontosFuncionario}
                          onEditar={iniciarCadastroIntegrante}
                          onTransferir={transferirTarefasFuncionario}
                          performance={performanceEquipe.get(String(f.id))}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>Enviar Feedback Profissional</h2>
              <form className="stack-form" onSubmit={handleEnviarFeedback}>
                <select 
                  value={feedbackFuncId} onChange={(e) => setFeedbackFuncId(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required
                >
                  <option value="">Escolha a colaboradora...</option>
                  {equipe.map(f => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
                <select 
                  value={feedbackTipo} onChange={(e) => setFeedbackTipo(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                >
                  <option value="positivo">Elogio / Reconhecimento Positivo</option>
                  <option value="construtivo">Ponto de Melhoria / Alinhamento</option>
                </select>
                <textarea 
                  placeholder="Escreva a mensagem de feedback ou orientação motivacional..." value={feedbackMsg} 
                  onChange={(e) => setFeedbackMsg(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', height: '120px' }} required
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={enviandoFeedback}
                >
                  {enviandoFeedback
                    ? "Registrando feedback..."
                    : "Registrar Feedback no Painel"}
                </button>
              </form>
            </div>

            <div className="panel feedback-history-panel">
              <div className="panel-title-row">
                <h2>Histórico de Feedbacks Enviados</h2>
                <button
                  className="btn-secondary compact"
                  onClick={recarregarFeedbacks}
                >
                  Atualizar
                </button>
              </div>
              <ListaFeedbacks
                feedbacks={feedbacks}
                funcionarios={funcionarios}
                mostrarDestinataria
                vazio="Nenhum feedback profissional foi enviado ainda."
              />
            </div>
            </div>}

            {modoEquipe === "cadastro" && (
              <div className="panel employee-profile-panel">
                <div className="panel-title-row">
                  <div>
                    <span className="eyebrow">{perfilIntegrante.id ? "Editar cadastro" : "Nova integrante"}</span>
                    <h2>{perfilIntegrante.id ? perfilIntegrante.nome : "Dados profissionais"}</h2>
                  </div>
                  <button className="btn-secondary compact" onClick={() => setModoEquipe("membros")}>Cancelar</button>
                </div>
                <form className="stack-form" onSubmit={salvarPerfilIntegrante}>
                  <div className="employee-profile-grid">
                    <label>Nome completo<input required value={perfilIntegrante.nome} onChange={(e) => atualizarPerfilIntegrante("nome", e.target.value)} /></label>
                    <label>E-mail corporativo<input required type="email" value={perfilIntegrante.email} onChange={(e) => atualizarPerfilIntegrante("email", e.target.value)} /></label>
                    <label>Cargo<input value={perfilIntegrante.cargo} onChange={(e) => atualizarPerfilIntegrante("cargo", e.target.value)} /></label>
                    <label>Setor<input value={perfilIntegrante.setor} onChange={(e) => atualizarPerfilIntegrante("setor", e.target.value)} /></label>
                    <label>Data de admissão<input type="date" value={perfilIntegrante.data_admissao} onChange={(e) => atualizarPerfilIntegrante("data_admissao", e.target.value)} /></label>
                    <label>URL da foto<input type="url" placeholder="https://..." value={perfilIntegrante.foto_url} onChange={(e) => atualizarPerfilIntegrante("foto_url", e.target.value)} /></label>
                  </div>
                  <fieldset className="permission-fieldset">
                    <legend>Permissões do workspace</legend>
                    <div className="permission-grid">
                      {[["tarefas", "Tarefas"], ["planner", "Planner"], ["documentos", "Documentos PDF"]].map(([chave, rotulo]) => (
                        <label key={chave}><input type="checkbox" checked={perfilIntegrante.permissoes[chave] !== false} onChange={(e) => atualizarPerfilIntegrante("permissoes", { ...perfilIntegrante.permissoes, [chave]: e.target.checked })} />{rotulo}</label>
                      ))}
                    </div>
                  </fieldset>
                  <label>Observação interna<textarea rows="4" value={perfilIntegrante.observacao_interna} onChange={(e) => atualizarPerfilIntegrante("observacao_interna", e.target.value)} /></label>
                  <div className="auth-notice"><strong>Acesso ao sistema</strong><span>Este cadastro cria o perfil interno. Para um novo login, crie ou convide o usuário em Authentication → Users no Supabase com o mesmo e-mail.</span></div>
                  <button className="btn-primary" disabled={salvandoIntegrante}>{salvandoIntegrante ? "Salvando..." : "Salvar integrante"}</button>
                </form>
              </div>
            )}

            {modoEquipe === "desligamento" && (
              <div className="panel offboarding-panel">
                <span className="eyebrow">Fluxo guiado</span>
                <h2>Desligamento de integrante</h2>
                <form className="stack-form" onSubmit={executarDesligamento}>
                  <label>Integrante<select required value={desligamento.funcionario_id} onChange={(e) => setDesligamento((atual) => ({ ...atual, funcionario_id: e.target.value, nova_funcionaria_id: "" }))}><option value="">Selecione...</option>{equipe.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
                  <div className="offboarding-summary">Tarefas abertas identificadas: <strong>{listaTarefas.filter((t) => String(t.funcionaria_id) === desligamento.funcionario_id && STATUS_ABERTOS.has(t.status)).length}</strong>. O histórico concluído e os feedbacks serão preservados.</div>
                  <label>Tratamento das tarefas abertas<select value={desligamento.destino} onChange={(e) => setDesligamento((atual) => ({ ...atual, destino: e.target.value }))}><option value="transferir">Transferir para outra integrante</option><option value="arquivar">Arquivar</option><option value="cancelar">Cancelar</option></select></label>
                  {desligamento.destino === "transferir" && <label>Nova responsável<select required value={desligamento.nova_funcionaria_id} onChange={(e) => setDesligamento((atual) => ({ ...atual, nova_funcionaria_id: e.target.value }))}><option value="">Selecione...</option>{equipe.filter((f) => String(f.id) !== desligamento.funcionario_id).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>}
                  <label>Data do desligamento<input required type="date" value={desligamento.data_desligamento} onChange={(e) => setDesligamento((atual) => ({ ...atual, data_desligamento: e.target.value }))} /></label>
                  <label>Motivo / observação interna<textarea required rows="4" value={desligamento.observacao} onChange={(e) => setDesligamento((atual) => ({ ...atual, observacao: e.target.value }))} /></label>
                  <div className="auth-notice"><strong>Etapa externa necessária</strong><span>Após concluir, desative ou remova a sessão da integrante em Authentication → Users. A chave service_role não deve ser usada no React.</span></div>
                  <button className="btn-danger" disabled={processandoDesligamento}>{processandoDesligamento ? "Processando..." : "Confirmar desligamento"}</button>
                </form>
              </div>
            )}
          </section>
        )}

        {abaAtiva === "documentos" && (
          <Suspense fallback={<section className="panel"><p>Carregando gerador de documentos...</p></section>}>
            <GeradorDocumentos usuario={usuario} responsavel={usuario.nome} onSuccess={showToast} />
          </Suspense>
        )}

        {abaAtiva === "processual" && (
          <Suspense fallback={<section className="panel"><p>Carregando módulo processual...</p></section>}>
            <ProcessualGerador responsavel={usuario.nome} onSuccess={showToast} />
          </Suspense>
        )}
      </main>
      {tarefaEmDevolucao && <ModalDevolucao tarefa={tarefaEmDevolucao} onClose={() => setTarefaEmDevolucao(null)} onConfirmar={devolverMinhaTarefa} />}
      {tarefaEmConclusao && (
        <ModalConclusaoTarefa
          tarefa={tarefaEmConclusao}
          entrega={entregasConclusao[tarefaEmConclusao.id] || {}}
          enviando={tarefaConcluindoId === tarefaEmConclusao.id}
          onChange={(valor) => setEntregasConclusao((atuais) => ({ ...atuais, [tarefaEmConclusao.id]: valor }))}
          onClose={() => setTarefaEmConclusao(null)}
          onConfirmar={(imagem) => concluirMinhaTarefa(tarefaEmConclusao, imagem)}
          onDevolver={() => { setTarefaEmConclusao(null); setTarefaEmDevolucao(tarefaEmConclusao); }}
        />
      )}
    </div>
  );
}

// ==========================================
// 5. PAINEL DA FUNCIONÁRIA (ATUALIZADO COM PLANNER E HISTÓRICO)
// ==========================================

function CentralInicio({ tarefas, usuario, onNavigate }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(intervalo);
  }, []);
  const minhas = tarefas.filter((t) => String(t.funcionaria_id) === String(usuario.id));
  const abertas = minhas.filter((t) => STATUS_ABERTOS.has(t.status));
  const dataAtual = new Date(agora);
  const hoje = obterDataLocalISO(dataAtual);
  const em48h = new Date(agora + 48 * 60 * 60 * 1000);
  const metricas = [
    ["Atrasadas", abertas.filter(tarefaAtrasada).length, "critical", "tarefas", "atrasadas"],
    ["Vencem hoje", abertas.filter((t) => (t.prazo_limite || t.data_limite || "").slice(0, 10) === hoje).length, "urgent", "tarefas", "vencem_hoje"],
    ["Próximas 48h", abertas.filter((t) => t.prazo_limite && new Date(t.prazo_limite) > dataAtual && new Date(t.prazo_limite) <= em48h).length, "warning", "tarefas", "proximas_48h"],
    ["Urgentes", abertas.filter((t) => ["urgente", "critica"].includes(t.prioridade)).length, "urgent", "tarefas", "urgentes"],
    ["Devolvidas", abertas.filter((t) => ["devolvida", "devolvida_correcao"].includes(t.status)).length, "warning", "tarefas", "devolvidas"],
    ["Recém-delegadas", abertas.filter((t) => t.status === "delegada").length, "normal", "tarefas", "recem_delegadas"],
    ["Em andamento", abertas.filter((t) => t.status === "em_execucao").length, "normal", "tarefas", "em_andamento"],
    ["Concluídas", minhas.filter((t) => t.status === "concluida").length, "success", "acompanhamento", null],
  ];
  const atencao = abertas.filter((t) => tarefaAtrasada(t) || ["urgente", "critica"].includes(t.prioridade) || ["devolvida", "devolvida_correcao"].includes(t.status)).slice(0, 8);
  const resumoBoasVindas = criarResumoBoasVindas({
    nome: usuario.nome,
    tarefasAbertas: abertas,
    tarefasConcluidas: minhas.filter((t) => t.status === "concluida").length,
    hoje,
  });
  return <div className="central-home"><section className={`welcome-summary ${resumoBoasVindas.tom}`} role="status"><div><span className="eyebrow">Resumo da sua pauta</span><h2>{resumoBoasVindas.titulo}</h2><p>{resumoBoasVindas.mensagem}</p></div>{resumoBoasVindas.filtro ? <button type="button" className="btn-primary compact" onClick={() => onNavigate("tarefas", resumoBoasVindas.filtro)}>Ver prioridades</button> : <span className="welcome-summary-ok">Tudo certo</span>}</section><section className="dashboard-grid central-metrics">{metricas.map(([rotulo, valor, tom, destino, filtro]) => <button type="button" className={`card central-metric ${tom}`} key={rotulo} onClick={() => onNavigate(destino, filtro)}><span>{rotulo}</span><strong>{valor}</strong></button>)}</section><section className="panel large"><div className="panel-title-row"><div><span className="eyebrow">Prioridade operacional</span><h2>Atenção imediata</h2></div><button className="btn-primary compact" onClick={() => onNavigate("delegar")}>Delegar tarefa</button></div>{atencao.length === 0 ? <p>Nenhuma ocorrência crítica neste momento.</p> : <div className="central-table">{atencao.map((t) => <div className="central-table-row" key={t.id}><strong>{t.id_externo || `#${t.id}`}</strong><span>{t.nome_cliente || "Cliente não informado"}</span><span>{t.titulo}</span><span className={`status ${t.status}`}>{rotuloStatusTarefa(t.status)}</span><small>{formatarData(t.data_limite)}</small></div>)}</div>}</section></div>;
}

function InicioColaborador({ tarefas, usuario, onNavigate, feedbacks, onAtualizarFeedbacks }) {
  const [mostrarFeedbacks, setMostrarFeedbacks] = useState(false);

  return <>
    <CentralInicio tarefas={tarefas} usuario={usuario} onNavigate={onNavigate} />
    <section className="panel feedback-home-card">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">Desenvolvimento profissional</span>
          <h2>Meus feedbacks</h2>
          <p>Consulte os reconhecimentos e alinhamentos recebidos.</p>
        </div>
        <button className="btn-primary compact" type="button" onClick={() => setMostrarFeedbacks((atual) => !atual)}>
          {mostrarFeedbacks ? "Ocultar feedbacks" : "Ver feedbacks"}
        </button>
      </div>
      <button className="card central-metric normal feedback-home-trigger" type="button" onClick={() => setMostrarFeedbacks(true)}>
        <span>Feedbacks recebidos</span>
        <strong>{feedbacks.length}</strong>
        <small>Toque para consultar</small>
      </button>
      {mostrarFeedbacks && <div className="feedback-home-content">
        <div className="task-history-actions">
          <strong>Feedbacks recebidos</strong>
          <button className="btn-secondary compact" type="button" onClick={onAtualizarFeedbacks}>Atualizar</button>
        </div>
        <ListaFeedbacks feedbacks={feedbacks} vazio="Você ainda não recebeu nenhum feedback profissional." />
      </div>}
    </section>
  </>;
}

function ModuloClientes({ podeSincronizar = false }) {
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [sincronizando, setSincronizando] = useState(false);

  useEffect(() => {
    let ativo = true;
    supabase.rpc("listar_clientes_central").then(({ data, error: erroConsulta }) => {
      if (!ativo) return;
      if (erroConsulta) setErro(mensagemErroOperacional(erroConsulta));
      else { setClientes(data || []); setErro(""); }
    });
    return () => { ativo = false; };
  }, []);
  const termo = normalizarTexto(busca);
  const clientesDrive = clientes.filter((cliente) => cliente.drive_folder_id && cliente.drive_status === "ativo");
  const filtrados = clientesDrive.filter((cliente) => !termo || normalizarTexto(`${cliente.nome} ${cliente.pasta_drive_nome || ""}`).includes(termo));
  const ultimaSincronizacao = clientesDrive.reduce((maisRecente, cliente) => {
    if (!cliente.drive_last_synced_at) return maisRecente;
    return !maisRecente || cliente.drive_last_synced_at > maisRecente
      ? cliente.drive_last_synced_at
      : maisRecente;
  }, "");

  async function sincronizarDrive() {
    setSincronizando(true);
    setErro("");
    setAviso("");
    const { data, error } = await supabase.functions.invoke("sincronizar-clientes-drive", { body: {} });
    if (error || data?.error) {
      setErro(data?.error || error?.message || "Não foi possível sincronizar o Google Drive.");
      setSincronizando(false);
      return;
    }
    const consulta = await supabase.rpc("listar_clientes_central");
    setSincronizando(false);
    if (consulta.error) {
      setErro(mensagemErroOperacional(consulta.error));
      return;
    }
    setClientes(consulta.data || []);
    const resumo = data?.resumo || {};
    setAviso(`Drive atualizado: ${resumo.total_recebido || 0} pastas verificadas, ${resumo.inseridos || 0} novas e ${resumo.atualizados || 0} atualizadas.`);
  }

  return (
    <section className="panel large client-management-panel">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">Base corporativa sincronizada</span>
          <h2>Clientes do Google Drive</h2>
          <p>As pastas de <strong>01_CLIENTES_ATIVOS</strong> são a fonte oficial para delegação de tarefas.</p>
        </div>
        <div className="task-history-actions">
          <a className="btn-secondary compact" href={GOOGLE_DRIVE_CLIENTES_ROOT_URL} target="_blank" rel="noreferrer">Abrir pasta geral</a>
          {podeSincronizar && <button type="button" className="btn-primary compact" disabled={sincronizando} onClick={sincronizarDrive}>{sincronizando ? "Sincronizando..." : "Atualizar do Google Drive"}</button>}
        </div>
      </div>

      <div className="drive-sync-summary">
        <div><span>Clientes ativos</span><strong>{clientesDrive.length}</strong></div>
        <div><span>Última sincronização</span><strong>{ultimaSincronizacao ? formatarDataHora(ultimaSincronizacao) : "Pendente"}</strong></div>
        <div><span>Origem</span><strong>Google Drive da empresa</strong></div>
      </div>
      {aviso && <div className="drive-sync-success" role="status">{aviso}</div>}
      {erro && <div className="return-alert">{erro}</div>}
      <input className="central-search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar uma pasta de cliente ativo" />
      {filtrados.length === 0 ? (
        <div className="drive-clients-empty">
          <span aria-hidden="true">📁</span>
          <strong>Nenhum cliente sincronizado</strong>
          <p>{podeSincronizar ? "Configure a integração e clique em Atualizar do Google Drive." : "Solicite ao gestor a sincronização da pasta de clientes ativos."}</p>
        </div>
      ) : (
        <div className="central-table">
          {filtrados.slice(0, 100).map((cliente) => (
            <div className="central-table-row client-row" key={cliente.id}>
              <div><strong>{cliente.nome}</strong><small>{cliente.pasta_drive_nome}</small></div>
              <span>Google Drive</span>
              <span className="drive-client-status">Sincronizado</span>
              <span>{cliente.drive_modified_time ? formatarDataHora(cliente.drive_modified_time) : "Data não informada"}</span>
              <div className="client-row-actions">
                <a href={cliente.pasta_drive_url} target="_blank" rel="noreferrer">Abrir pasta</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ModuloUrgencias({ funcionarios, showToast }) {
  const vazio = { cliente: "", cpf: "", setor: "Administrativo", responsavel: "", tarefa: "", motivo: "", prazo: "", prioridade: "urgente", observacao: "", drive: "" };
  const [form, setForm] = useState(vazio); const [lista, setLista] = useState([]); const [destinatarios, setDestinatarios] = useState(funcionarios || []); const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    let ativo = true;
    Promise.all([
      supabase.from("urgencias").select("*").order("created_at", { ascending: false }),
      supabase.rpc("listar_destinatarios_tarefa"),
    ]).then(([urgencias, pessoas]) => {
      if (!ativo) return;
      if (!urgencias.error) setLista(urgencias.data || []);
      if (pessoas.data) setDestinatarios(pessoas.data);
    });
    return () => { ativo = false; };
  }, []);
  const alterar = (campo, valor) => setForm((a) => ({ ...a, [campo]: valor }));
  async function criar(e) { e.preventDefault(); setSalvando(true); const { data, error } = await supabase.rpc("criar_urgencia", { p_nome_cliente: form.cliente.trim(), p_cpf_ou_id: form.cpf.trim() || null, p_setor: form.setor, p_funcionaria_id: form.responsavel ? Number(form.responsavel) : null, p_tarefa: form.tarefa.trim(), p_motivo: form.motivo.trim(), p_prazo: new Date(form.prazo).toISOString(), p_prioridade: form.prioridade, p_observacao: form.observacao.trim() || null, p_drive_url: form.drive.trim() || null }); setSalvando(false); if (error) return alert(`Erro ao registrar urgência: ${mensagemErroOperacional(error)}`); setLista((a) => [Array.isArray(data) ? data[0] : data, ...a]); setForm(vazio); showToast("Urgência registrada e notificada."); }
  async function mover(item, status) { const { data, error } = await supabase.rpc("movimentar_urgencia", { p_urgencia_id: Number(item.id), p_status: status, p_observacao: null }); if (error) return alert(error.message); const atualizada = Array.isArray(data) ? data[0] : data; setLista((a) => a.map((u) => u.id === atualizada.id ? atualizada : u)); }
  return <div className="urgency-layout"><section className="panel"><span className="eyebrow">Quadro independente</span><h2>Registrar urgência</h2><form className="stack-form" onSubmit={criar}><div className="task-form-row"><label>Cliente<input required value={form.cliente} onChange={(e) => alterar("cliente", e.target.value)} /></label><label>CPF ou ID<input value={form.cpf} onChange={(e) => alterar("cpf", e.target.value)} /></label></div><div className="task-form-row"><label>Setor<select value={form.setor} onChange={(e) => alterar("setor", e.target.value)}><option>Administrativo</option><option>Jurídico</option><option>Comercial</option><option>Processual</option></select></label><label>Responsável<select value={form.responsavel} onChange={(e) => alterar("responsavel", e.target.value)}><option value="">Ainda não definido</option>{destinatarios.map((p) => <option value={p.id} key={p.id}>{p.nome}</option>)}</select></label></div><label>Tarefa necessária<input required value={form.tarefa} onChange={(e) => alterar("tarefa", e.target.value)} /></label><label>Motivo da urgência<textarea required rows="3" value={form.motivo} onChange={(e) => alterar("motivo", e.target.value)} /></label><div className="task-form-row"><label>Prazo limite<input required type="datetime-local" value={form.prazo} onChange={(e) => alterar("prazo", e.target.value)} /></label><label>Prioridade<select value={form.prioridade} onChange={(e) => alterar("prioridade", e.target.value)}><option value="alta">Alta</option><option value="urgente">Urgente</option><option value="critica">Crítica</option></select></label></div><label>Link do Drive<input type="url" value={form.drive} onChange={(e) => alterar("drive", e.target.value)} placeholder="https://drive.google.com/..." /></label><label>Observação<textarea rows="2" value={form.observacao} onChange={(e) => alterar("observacao", e.target.value)} /></label><button className="btn-primary" disabled={salvando}>{salvando ? "Registrando..." : "Registrar urgência"}</button></form></section><section className="panel large"><div className="panel-title-row"><h2>Urgências abertas</h2><strong>{lista.filter((u) => !["resolvida","cancelada"].includes(u.status)).length}</strong></div><div className="central-table">{lista.slice(0, 15).map((u) => <div className={`urgency-row priority-${u.prioridade}`} key={u.id}><div><strong>{u.codigo} · {u.nome_cliente}</strong><p>{u.tarefa_necessaria}</p><small>{u.motivo} · Prazo {formatarDataHora(u.prazo_limite)}</small></div><span className={`status ${u.status}`}>{u.status.replaceAll("_", " ")}</span><div className="task-history-actions">{u.status === "aberta" && <button className="btn-secondary compact" onClick={() => mover(u,"visualizada")}>Visualizar</button>}{["aberta","visualizada"].includes(u.status) && <button className="btn-primary compact" onClick={() => mover(u,"em_atendimento")}>Atender</button>}{u.status === "em_atendimento" && <button className="btn-success compact" onClick={() => mover(u,"resolvida")}>Resolver</button>}</div></div>)}</div></section></div>;
}

function CentralNotificacoesBell() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let ativo = true;
    const carregar = () => {
      supabase
        .from("notificacoes_operacionais")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)
        .then(({ data }) => {
          if (!ativo) return;
          setNotificacoes(data || []);
          setCarregando(false);
        });
    };
    carregar();
    const canal = supabase
      .channel("central-notificacoes-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes_operacionais" }, carregar)
      .subscribe();
    return () => { ativo = false; supabase.removeChannel(canal); };
  }, []);
  async function ler(item) {
    if (item.lida_em) return;
    const { error } = await supabase.rpc("marcar_notificacao_lida", { p_notificacao_id: Number(item.id) });
    if (!error) setNotificacoes((atual) => atual.map((n) => n.id === item.id ? { ...n, lida_em: new Date().toISOString() } : n));
  }

  const naoLidas = notificacoes.filter((notificacao) => !notificacao.lida_em).length;
  const textoContador = naoLidas > 99 ? "99+" : String(naoLidas);

  return (
    <div className="notification-bell-wrap">
      <button
        type="button"
        className={`notification-bell ${aberto ? "is-open" : ""}`}
        onClick={() => setAberto((atual) => !atual)}
        aria-label={naoLidas ? `Abrir notificações: ${naoLidas} não lidas` : "Abrir notificações"}
        aria-expanded={aberto}
        aria-controls="notification-popover"
      >
        <UiIcon name="notificacao" size={21} />
        {naoLidas > 0 && <span className="notification-badge" aria-hidden="true">{textoContador}</span>}
      </button>

      {aberto && (
        <section id="notification-popover" className="notification-popover" aria-label="Notificações">
          <div className="notification-popover-header">
            <div>
              <span className="eyebrow">Atualizações operacionais</span>
              <h2>Notificações</h2>
            </div>
            <strong>{naoLidas} não lida{naoLidas === 1 ? "" : "s"}</strong>
          </div>
          <div className="notification-popover-list">
            {carregando ? <p className="notification-empty">Carregando notificações...</p> : notificacoes.length === 0 ? <p className="notification-empty">Nenhuma notificação por enquanto.</p> : notificacoes.slice(0, 12).map((notificacao) => (
              <button
                type="button"
                onClick={() => ler(notificacao)}
                className={`notification-item ${notificacao.lida_em ? "read" : "unread"}`}
                key={notificacao.id}
              >
                <span aria-hidden="true">•</span>
                <div>
                  <strong>{notificacao.titulo}</strong>
                  <p>{notificacao.mensagem}</p>
                  <small>{formatarDataHora(notificacao.created_at)}</small>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FormularioDelegacaoUsuario({ usuario, funcionarios, onCriada, showToast }) {
  const formularioVazio = { cliente: "", clienteDrive: null, tipo: CATEGORIAS_TAREFA[0], outraAcao: "", solicitacao: "", setorExecutor: "Administrativo", responsavelId: "", prazo: "", prioridade: "normal", apontamento: "" };
  const [form, setForm] = useState(formularioVazio);
  const [salvando, setSalvando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const [destinatarios, setDestinatarios] = useState(funcionarios || []);
  useEffect(() => {
    supabase.rpc("listar_destinatarios_tarefa").then(({ data, error }) => {
      if (!error && data) setDestinatarios(data);
    });
  }, []);
  const equipeDisponivel = destinatarios.filter((item) => item.ativo !== false && String(item.id) !== String(usuario.id));
  const alterar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  function dataLocalInput(data) {
    const deslocamento = data.getTimezoneOffset() * 60_000;
    return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
  }

  function definirPrazo(tipo) {
    const data = new Date();
    if (tipo === "duas_horas") data.setHours(data.getHours() + 2, 0, 0, 0);
    if (tipo === "hoje_18") {
      data.setHours(18, 0, 0, 0);
      if (data <= new Date()) data.setDate(data.getDate() + 1);
    }
    if (tipo === "amanha_10") { data.setDate(data.getDate() + 1); data.setHours(10, 0, 0, 0); }
    if (tipo === "dois_dias") { data.setDate(data.getDate() + 2); data.setHours(18, 0, 0, 0); }
    alterar("prazo", dataLocalInput(data));
  }

  async function delegar(event) {
    event.preventDefault();
    if (!form.clienteDrive?.id) return alert("Selecione uma pasta de cliente sincronizada com o Google Drive.");
    if (form.tipo === "OUTROS" && !form.outraAcao.trim()) return alert("Descreva a ação solicitada.");
    if (!form.prazo) return alert("Selecione um prazo rápido ou escolha uma data em Mais opções.");
    const tituloDelegado = tituloAutomaticoDaTarefa(form.tipo, form.outraAcao);
    setSalvando(true);
    try {
      const { data, error } = await supabase.rpc("delegar_tarefa_operacional", {
        p_cliente_id: Number(form.clienteDrive.id), p_tratativa_id: null, p_nome_cliente: form.cliente.trim(),
        p_tipo_codigo: CODIGOS_TIPO_TAREFA[form.tipo], p_titulo: tituloDelegado,
        p_solicitacao: `${form.tipo === "OUTROS" ? `Ação: ${form.outraAcao.trim()}\n` : ""}${form.solicitacao.trim()}`,
        p_resultado_esperado: gerarResultadoEsperadoTarefa(form.tipo === "OUTROS" ? form.outraAcao : form.tipo),
        p_setor_solicitante: usuario.setor || usuario.cargo || "Equipe",
        p_setor_executor: form.setorExecutor, p_funcionaria_id: Number(form.responsavelId),
        p_prazo_limite: new Date(form.prazo).toISOString(), p_prioridade: form.prioridade,
        p_criterios: form.apontamento.trim() ? { apontamento_inicial: form.apontamento.trim() } : null,
      });
      if (error) throw error;
      const criada = Array.isArray(data) ? data[0] : data;
      onCriada(criada);
      setEnviada(true);
      window.setTimeout(() => setEnviada(false), 1800);
      showToast(`Tarefa ${criada.id_externo || criada.id} delegada com sucesso.`);
      setForm(formularioVazio);
      setMaisOpcoes(false);
    } catch (error) {
      alert(`Não foi possível delegar a tarefa: ${mensagemErroOperacional(error)}`);
    } finally { setSalvando(false); }
  }

  return <section className="panel large delegation-panel">
    {enviada && <div className="delegation-sent" role="status"><span>✉</span><strong>Tarefa delegada com sucesso.</strong></div>}
    <div className="panel-title-row"><div><span className="eyebrow">Delegação rápida</span><h2>Delegar nova tarefa</h2><p>Organize a solicitação, escolha a ação e acompanhe o prazo com clareza.</p></div></div>
    <form className="stack-form task-form task-delegation-form" onSubmit={delegar}>
      <div className="task-form-row">
        <ClienteDriveSelector
          required
          selecionado={form.clienteDrive}
          onSelecionar={(cliente) => setForm((atual) => ({
            ...atual,
            clienteDrive: cliente,
            cliente: cliente?.nome || "",
          }))}
        />
        <label>Setor solicitante<input readOnly value={usuario.setor || usuario.cargo || "Equipe"} aria-label="Setor solicitante" /></label>
      </div>
      <SeletorAcaoVisual valor={form.tipo} onChange={(valor) => alterar("tipo", valor)} />
      {form.tipo === "OUTROS" && <label>Descreva a ação<input required value={form.outraAcao} onChange={(e) => alterar("outraAcao", e.target.value)} placeholder="Informe exatamente o que deverá ser executado" /></label>}
      <div className="task-auto-title"><span>Título gerado automaticamente</span><strong>{tituloAutomaticoDaTarefa(form.tipo, form.outraAcao) || "Descreva a ação para definir o título"}</strong></div>
      <label>Solicitação<textarea required rows="4" value={form.solicitacao} onChange={(e) => alterar("solicitacao", e.target.value)} placeholder="Descreva com objetividade o que precisa ser feito." /></label>
      <div className="task-form-details">
        <div className="task-form-row">
          <label>Setor executor<select value={form.setorExecutor} onChange={(e) => alterar("setorExecutor", e.target.value)}><option>Administrativo</option><option>Jurídico</option><option>Comercial</option><option>Processual</option></select></label>
          <label>Responsável<select required value={form.responsavelId} onChange={(e) => { const id = e.target.value; const pessoa = destinatarios.find((item) => String(item.id) === id); setForm((atual) => ({ ...atual, responsavelId: id, setorExecutor: pessoa?.setor || atual.setorExecutor })); }}><option value="">Quem vai executar?</option>{equipeDisponivel.map((pessoa) => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome} — {pessoa.setor || pessoa.cargo}</option>)}</select></label>
        </div>
        <div className="task-form-row">
          <div className="quick-deadline"><strong>Prazo obrigatório</strong><div>{[["duas_horas","Em 2 horas"],["hoje_18","Hoje às 18h"],["amanha_10","Amanhã às 10h"],["dois_dias","Em 2 dias"]].map(([valor, rotulo]) => <button className="btn-secondary compact" type="button" key={valor} onClick={() => definirPrazo(valor)}>{rotulo}</button>)}</div><small>{form.prazo ? `Prazo selecionado: ${formatarDataHora(new Date(form.prazo).toISOString())}` : "Selecione uma opção rápida ou informe uma data."}</small></div>
          <SeletorPrioridadeVisual valor={form.prioridade} onChange={(valor) => alterar("prioridade", valor)} />
        </div>
      </div>
      <button className="advanced-toggle" type="button" onClick={() => setMaisOpcoes((valor) => !valor)}>{maisOpcoes ? "Ocultar opções" : "Ajustar prazo e opções"}</button>
      {maisOpcoes && <div className="advanced-fields"><label>Escolher outra data e hora<input required type="datetime-local" value={form.prazo} onChange={(e) => alterar("prazo", e.target.value)} /></label><label>Apontamento inicial<textarea rows="3" value={form.apontamento} onChange={(e) => alterar("apontamento", e.target.value)} placeholder="Ex.: Aguardando retorno do cliente." /></label></div>}
      <button className="btn-primary delegation-submit" disabled={salvando} type="submit">{salvando ? "Delegando..." : "Delegar tarefa"}</button>
    </form>
  </section>;
}

function EmployeeDashboard({ usuario, onLogout, state }) {
  const {
    listaTarefas,
    setListaTarefas,
    funcionarios,
    feedbacks,
    responsabilidadesMensais,
    recarregarTarefas,
    recarregarFeedbacks,
    recarregarResponsabilidadesMensais,
    showToast,
  } = state;
  const [abaAtiva, setAbaAtiva] = useState("inicio");
  const [tarefaConcluindoId, setTarefaConcluindoId] = useState(null);
  const [tarefaEmConclusao, setTarefaEmConclusao] = useState(null);
  const [tarefaEmDevolucao, setTarefaEmDevolucao] = useState(null);
  const [paginaPendentes, setPaginaPendentes] = useState(1);
  const [filtroOperacional, setFiltroOperacional] = useState("pendentes");
  const [buscaTarefa, setBuscaTarefa] = useState("");
  const [entregasPop, setEntregasPop] = useState({});

  const minhasTarefas = listaTarefas.filter(
    (tarefa) => String(tarefa.funcionaria_id) === String(usuario.id),
  );
  const termoBusca = normalizarTexto(buscaTarefa.trim());
  const hoje = obterDataLocalISO();
  const agora = new Date();
  const em48h = new Date(agora.getTime() + 48 * 60 * 60 * 1000);
  const tarefasPendentes = minhasTarefas.filter((tarefa) => {
    const encontrada = !termoBusca || normalizarTexto(`${tarefa.id_externo || tarefa.id} ${tarefa.nome_cliente || ""} ${tarefa.titulo || ""} ${usuario.nome}`).includes(termoBusca);
    if (!encontrada) return false;
    if (filtroOperacional === "atrasadas") return tarefaAtrasada(tarefa);
    if (filtroOperacional === "arquivadas") return ["arquivada", "cancelada"].includes(tarefa.status);
    if (filtroOperacional === "vencem_hoje") return STATUS_ABERTOS.has(tarefa.status) && (tarefa.prazo_limite || tarefa.data_limite || "").slice(0, 10) === hoje;
    if (filtroOperacional === "proximas_48h") return STATUS_ABERTOS.has(tarefa.status) && tarefa.prazo_limite && new Date(tarefa.prazo_limite) > agora && new Date(tarefa.prazo_limite) <= em48h;
    if (filtroOperacional === "urgentes") return STATUS_ABERTOS.has(tarefa.status) && ["urgente", "critica"].includes(tarefa.prioridade);
    if (filtroOperacional === "devolvidas") return STATUS_ABERTOS.has(tarefa.status) && ["devolvida", "devolvida_correcao"].includes(tarefa.status);
    if (filtroOperacional === "recem_delegadas") return tarefa.status === "delegada";
    if (filtroOperacional === "em_andamento") return tarefa.status === "em_execucao";
    return STATUS_ABERTOS.has(tarefa.status);
  });
  const tarefasConcluidas = minhasTarefas.filter((tarefa) => tarefa.status === "concluida");
  const minhaPerformance = calcularPerformanceSemanal(usuario.id, minhasTarefas);
  const tarefasPendentesVisiveis = tarefasPendentes.slice(
    (paginaPendentes - 1) * ITENS_POR_PAGINA,
    paginaPendentes * ITENS_POR_PAGINA,
  );
  const meusFeedbacks = feedbacks.filter(
    (feedback) =>
      String(feedback.funcionaria_id) === String(usuario.id),
  );
  const mesAtual = obterMesAtual();
  const minhasResponsabilidadesDoMes = responsabilidadesMensais
    .filter(
      (item) =>
        String(item.funcionaria_id) === String(usuario.id) &&
        item.mes_referencia?.slice(0, 7) === mesAtual,
    )
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const filtroIndicadorAtivo = ROTULOS_FILTRO_TAREFAS[filtroOperacional] || null;

  function navegarDaTelaInicial(destino, filtro = null) {
    if (destino === "tarefas" && filtro) {
      setFiltroOperacional(filtro);
      setBuscaTarefa("");
      setPaginaPendentes(1);
    }
    setAbaAtiva(destino);
  }

  async function atualizarMeusFeedbacks() {
    try {
      const registros = await recarregarFeedbacks();
      const quantidade = registros.filter(
        (feedback) =>
          String(feedback.funcionaria_id) === String(usuario.id),
      ).length;
      showToast(
        quantidade > 0
          ? `${quantidade} feedback(s) carregado(s).`
          : "Nenhum feedback destinado ao seu cadastro.",
      );
    } catch (error) {
      console.error("Erro ao carregar feedbacks da funcionária:", error);
      alert(
        "Não foi possível consultar seus feedbacks: " +
          (error?.message || "acesso não confirmado pelo Supabase"),
      );
    }
  }

  function atualizarTarefaLocal(tarefaAtualizada) {
    setListaTarefas((atuais) =>
      atuais.map((item) =>
        String(item.id) === String(tarefaAtualizada.id)
          ? tarefaAtualizada
          : item,
      ),
    );
  }

  async function devolverTarefa({ motivo, comentario }) {
    try {
      const operacional = tarefaEmDevolucao.origem === "operacional";
      const { data, error } = operacional
        ? await supabase.rpc("movimentar_tarefa_operacional", {
            p_tarefa_id: Number(tarefaEmDevolucao.id), p_acao: "devolver_solicitante",
            p_motivo: `${motivo}: ${comentario}`, p_checklist: null, p_observacoes: comentario,
            p_nome_arquivo: null, p_drive_url: null, p_crm_atualizado: false, p_planilha_atualizada: false,
          })
        : await supabase.rpc("devolver_tarefa", {
            p_tarefa_id: Number(tarefaEmDevolucao.id), p_motivo: motivo, p_comentario: comentario,
          });
      if (error) throw error;
      const tarefaAtualizada = Array.isArray(data) ? data[0] : data;
      if (!tarefaAtualizada) {
        throw new Error("O banco não confirmou a devolução.");
      }

      atualizarTarefaLocal(tarefaAtualizada);
      setTarefaEmDevolucao(null);
      await recarregarTarefas();
      showToast("Impedimento registrado e tarefa movida para pendência.");
    } catch (error) {
      console.error("Erro ao devolver tarefa:", error);
      alert(`Não foi possível devolver a tarefa: ${error.message}`);
    }
  }

  function checklistAtualizado(tarefaAtualizada) {
    atualizarTarefaLocal(tarefaAtualizada);
    showToast("Check-in confirmado: 5 documentos validados.");
  }

  async function movimentarTarefa(tarefa, acao, motivo = null) {
    const { data, error } = await supabase.rpc("movimentar_tarefa_operacional", {
      p_tarefa_id: Number(tarefa.id), p_acao: acao, p_motivo: motivo,
      p_checklist: null, p_observacoes: null, p_nome_arquivo: null,
      p_drive_url: null, p_crm_atualizado: false, p_planilha_atualizada: false,
    });
    if (error) return alert(`Não foi possível movimentar a tarefa: ${error.message}`);
    atualizarTarefaLocal(Array.isArray(data) ? data[0] : data);
    await recarregarTarefas();
    showToast(acao === "aceitar" ? "Tarefa aceita e registrada." : "Status da tarefa atualizado.");
    return Array.isArray(data) ? data[0] : data;
  }

  async function iniciarTarefaSimplificada(tarefa) {
    setTarefaConcluindoId(tarefa.id);
    try {
      let tarefaAtual = tarefa;
      if (tarefa.status === "delegada") {
        tarefaAtual = await movimentarTarefa(tarefa, "aceitar");
        if (!tarefaAtual) return;
      }

      await movimentarTarefa(tarefaAtual, "iniciar");
      showToast("Tarefa iniciada. O prazo continua visivel ate a conclusao.");
    } finally {
      setTarefaConcluindoId(null);
    }
  }

  function informarEspera(tarefa) {
    const motivo = window.prompt("Informe o que está pendente e de quem depende (mínimo de 10 caracteres):");
    if (motivo?.trim().length >= 10) movimentarTarefa(tarefa, "aguardar", motivo.trim());
  }

  async function concluirTarefa(tarefa, imagemComprovacao = null) {
    if (
      tarefaExigeChecklistDocumentos(tarefa) &&
      !checklistDocumentosCompleto(tarefa)
    ) {
      alert(
        "A Etapa 2 está bloqueada. Confirme obrigatoriamente os 5 documentos iniciais antes de avançar para o Jurídico.",
      );
      return;
    }

    const entrega = entregasPop[tarefa.id] || {};
    const falhaPop = validarEntregaPop(entrega, tarefa);
    if (falhaPop) {
      alert(`Tarefa não pode ser concluída. ${falhaPop}`);
      return;
    }

    setTarefaConcluindoId(tarefa.id);

    let tarefaAtualizada;
    let error;
    let caminhoImagem;

    try {
      caminhoImagem = await enviarImagemComprovacao(tarefa, imagemComprovacao);
    } catch (erroImagem) {
      alert(erroImagem.message);
      setTarefaConcluindoId(null);
      return;
    }

    if (tarefa.origem === "operacional") {
      const resposta = await supabase.rpc("movimentar_tarefa_operacional", {
        p_tarefa_id: Number(tarefa.id), p_acao: "devolver_conferencia", p_motivo: null,
        p_checklist: entrega.checklist || {}, p_observacoes: entrega.observacoes.trim(),
        p_nome_arquivo: nomeComprovanteDrive(tarefa), p_drive_url: entrega.driveUrl.trim(),
        p_crm_atualizado: entrega.crmAtualizado, p_planilha_atualizada: entrega.planilhaAtualizada,
      });
      error = resposta.error;
      tarefaAtualizada = Array.isArray(resposta.data) ? resposta.data[0] : resposta.data;
    } else if (tarefa.origem === "esteira") {
      const resposta = await supabase.rpc("concluir_tarefa_pop", {
        p_tarefa_id: Number(tarefa.id), p_observacoes: entrega.observacoes.trim(),
        p_nome_arquivo: nomeComprovanteDrive(tarefa), p_drive_url: entrega.driveUrl.trim(),
        p_crm_atualizado: entrega.crmAtualizado, p_planilha_atualizada: entrega.planilhaAtualizada,
        p_resultado: tarefaExigeChecklistDocumentos(tarefa) ? "regular" : "nao_se_aplica",
      });
      error = resposta.error;
      tarefaAtualizada = resposta.data?.tarefa_concluida || resposta.data || null;
    } else {
      const resposta = await supabase.rpc("concluir_tarefa_pop", {
        p_tarefa_id: Number(tarefa.id), p_observacoes: entrega.observacoes.trim(),
        p_nome_arquivo: nomeComprovanteDrive(tarefa), p_drive_url: entrega.driveUrl.trim(),
        p_crm_atualizado: entrega.crmAtualizado, p_planilha_atualizada: entrega.planilhaAtualizada,
        p_resultado: "nao_se_aplica",
      });
      error = resposta.error;
      tarefaAtualizada = resposta.data?.tarefa_concluida || resposta.data;
    }

    if (error) {
      console.error("Erro ao concluir tarefa:", error);
      alert(`Não foi possível concluir a tarefa: ${error.message}`);
      setTarefaConcluindoId(null);
      return;
    }

    const statusEsperado = tarefa.origem === "operacional" ? "devolvida_conferencia" : "concluida";
    if (!tarefaAtualizada || tarefaAtualizada.status !== statusEsperado) {
      alert(
        "O banco não confirmou a conclusão. Execute a configuração do Supabase indicada no README.",
      );
      setTarefaConcluindoId(null);
      return;
    }

    if (caminhoImagem) {
      try {
        const tarefaComImagem = await registrarImagemComprovacao(tarefa, caminhoImagem);
        if (tarefaComImagem) tarefaAtualizada = tarefaComImagem;
      } catch (erroAnexo) {
        console.error("Erro ao vincular imagem de comprovação:", erroAnexo);
        alert(erroAnexo.message);
      }
    }

    atualizarTarefaLocal(tarefaAtualizada);
    setTarefaEmConclusao(null);

    try {
      await recarregarTarefas();
      showToast(tarefa.origem === "operacional" ? "Tarefa devolvida para conferência." : "Parabéns! Tarefa concluída com sucesso.");
    } catch (erroRecarregamento) {
      console.error("Erro ao recarregar tarefas:", erroRecarregamento);
      showToast("Tarefa concluída no banco.");
    } finally {
      setTarefaConcluindoId(null);
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/assets/platino-infohub-icon.png" alt="Platino" className="brand-icon" />
          <div>
            <strong>PLATINO</strong>
            <span>Operating Workspace</span>
          </div>
        </div>
        <nav>
          <span className="nav-label">Central de Tarefas</span>
          <NavItem active={abaAtiva === "inicio"} icon="dashboard" onClick={() => setAbaAtiva("inicio")}>Início</NavItem>
          <NavItem active={abaAtiva === "tarefas"} icon="tarefas" onClick={() => setAbaAtiva("tarefas")}>Tarefas e urgências</NavItem>
          <NavItem active={abaAtiva === "delegar"} icon="tarefas" onClick={() => setAbaAtiva("delegar")}>Delegar tarefa</NavItem>
          <NavItem active={abaAtiva === "acompanhamento"} icon="dashboard" onClick={() => setAbaAtiva("acompanhamento")}>Tarefas da equipe</NavItem>
          <NavItem active={abaAtiva === "clientes"} icon="equipe" onClick={() => setAbaAtiva("clientes")}>Clientes</NavItem>
          <NavItem active={abaAtiva === "documentos"} icon="documentos" onClick={() => setAbaAtiva("documentos")}>Documentos PDF</NavItem>
        </nav>
        <button className="sidebar-logout" onClick={onLogout}><UiIcon name="logout" /> Sair</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Olá, {usuario.nome}</h1>
            <p>Acompanhe sua pauta diária na esteira operacional.</p>
          </div>
          <div className="topbar-actions">
            <CentralNotificacoesBell />
            <div className={`profile-pill ${minhaPerformance.altaPerformance ? "profile-high-performance" : ""}`}>
              <AvatarMembro
                compacto
                funcionario={usuario}
                performance={minhaPerformance}
              />
              <span className="online-dot" />
              <div>
                <small>Colaboradora online</small>
                <span>{usuario.cargo}</span>
                <PerformanceBadge
                  mostrarRotulo
                  performance={minhaPerformance}
                />
              </div>
            </div>
          </div>
        </header>

        {abaAtiva === "inicio" && <><InicioColaborador tarefas={listaTarefas} usuario={usuario} onNavigate={navegarDaTelaInicial} feedbacks={meusFeedbacks} onAtualizarFeedbacks={atualizarMeusFeedbacks} /><section className="dashboard-planner-section"><MeuPlanner funcionariaLogadaId={usuario.id} /></section></>}

        {abaAtiva === "tarefas" && (
          <div className="employee-tasks-workspace">
            <section className="panel monthly-employee-panel">
              <div className="panel-title-row">
                <div>
                  <span className="eyebrow">Responsabilidades recorrentes</span>
                  <h2>Tarefas de {formatarMes(mesAtual)}</h2>
                </div>
                <button
                  className="btn-secondary compact"
                  onClick={recarregarResponsabilidadesMensais}
                >
                  Atualizar
                </button>
              </div>

              {minhasResponsabilidadesDoMes.length === 0 ? (
                <div className="monthly-empty">
                  O supervisor ainda não cadastrou suas responsabilidades para
                  este mês.
                </div>
              ) : (
                <ol className="monthly-list employee-monthly-list">
                  {minhasResponsabilidadesDoMes.map((item, indice) => (
                    <li key={item.id}>
                      <span>{indice + 1}</span>
                      <strong>{item.titulo}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="content-grid">
              <div className="panel large">
              <div className="panel-title-row">
                <h2>Minhas tarefas pendentes</h2>
                <div className="task-history-actions">
                  <button className="btn-secondary compact" onClick={() => setAbaAtiva("historico")}>Ver histórico</button>
                  <button className="btn-secondary compact" onClick={recarregarTarefas}>
                    Atualizar
                  </button>
                </div>
              </div>
              <div className="task-filters">
                <input aria-label="Buscar tarefa" placeholder="Buscar por ID, cliente ou responsável" value={buscaTarefa} onChange={(e) => { setBuscaTarefa(e.target.value); setPaginaPendentes(1); }} />
                <div className="task-kind-switch">
                  {FILTROS_TAREFAS_PRINCIPAIS.map(([valor, rotulo]) => <button type="button" key={valor} className={filtroOperacional === valor ? 'active' : ''} onClick={() => { setFiltroOperacional(valor); setPaginaPendentes(1); }}>{rotulo}</button>)}
                  {filtroIndicadorAtivo ? <button type="button" className="active" title="Remover filtro do indicador" onClick={() => { setFiltroOperacional("pendentes"); setPaginaPendentes(1); }}>{filtroIndicadorAtivo} ×</button> : null}
                  <button type="button" onClick={() => setAbaAtiva("historico")}>Concluídas</button>
                </div>
              </div>
              {tarefasPendentes.length === 0 ? (
                <p>Nenhuma tarefa pendente no momento.</p>
              ) : null}
              
              {tarefasPendentesVisiveis.map((tarefa) => (
                <div className="task-item" key={tarefa.id}>
                  <div>
                    <h3>{tarefa.titulo}</h3>
                    <ResumoFluxoTarefa tarefa={tarefa} />
                    {tarefa.origem === "operacional" && <LinhaTempoTarefa tarefa={tarefa} />}
                    <p>{tarefa.descricao}</p>
                    {tarefa.apontamento && (
                      <div className="employee-task-note">
                        <strong>Apontamento:</strong> {tarefa.apontamento}
                      </div>
                    )}
                    {tarefa.status === "devolvida" && (
                      <div className="return-alert employee-return-alert">
                        <div>
                          <strong>Devolvida para correção</strong>
                          <small>{formatarDataHora(tarefa.devolvida_em)}</small>
                        </div>
                        <p>
                          {tarefa.motivo_devolucao}
                          {tarefa.comentario_devolucao
                            ? ` · ${tarefa.comentario_devolucao}`
                            : ""}
                        </p>
                      </div>
                    )}
                    <small>
                      Prazo final: {formatarData(tarefa.data_limite)}
                      {tarefa.origem !== "operacional" && ` | Recompensa: +${tarefa.pontos_tarefa || 10} Pontos`}
                    </small>
                    <LinkImagemComprovacao tarefa={tarefa} />
                    {tarefaExigeChecklistDocumentos(tarefa) && (
                      <ChecklistDocumentos
                        key={`${tarefa.id}-${tarefa.updated_at || ""}`}
                        onAtualizada={checklistAtualizado}
                        tarefa={tarefa}
                      />
                    )}
                  </div>
                  <div className="task-actions">
                    {tarefa.categoria && (
                      <span className="category-badge">
                        {tarefa.categoria}
                      </span>
                    )}
                    <span
                      className={`priority-badge priority-${tarefa.prioridade || "normal"}`}
                    >
                      {rotuloPrioridade(tarefa.prioridade)}
                    </span>
                    {tarefa.status === "delegada" ? <>
                      <button className="btn-primary" disabled={tarefaConcluindoId === tarefa.id} onClick={() => iniciarTarefaSimplificada(tarefa)}>Começar tarefa</button>
                      <button className="btn-return" onClick={() => setTarefaEmDevolucao(tarefa)}>Devolver tarefa</button>
                    </> : tarefa.status === "recebida" || tarefa.status === "devolvida_correcao" ? <>
                      <button className="btn-primary" disabled={tarefaConcluindoId === tarefa.id} onClick={() => iniciarTarefaSimplificada(tarefa)}>{tarefa.status === "devolvida_correcao" ? "Corrigir tarefa" : "Começar tarefa"}</button>
                      <button className="btn-return" onClick={() => setTarefaEmDevolucao(tarefa)}>Devolver tarefa</button>
                    </> : tarefa.status === "aguardando_informacao" ? <button className="btn-primary" onClick={() => iniciarTarefaSimplificada(tarefa)}>Pendência resolvida: retomar</button> : tarefa.status === "devolvida_conferencia" ? <small className="return-waiting">Entrega enviada. Aguardando validação do supervisor.</small> : tarefa.status === "devolvida" ? (
                      <small className="return-waiting">
                        Pendência registrada. Aguardando resposta do solicitante.
                      </small>
                    ) : (
                      <>
                        <button
                          className="btn-return"
                          disabled={tarefaConcluindoId === tarefa.id}
                          onClick={() => setTarefaEmDevolucao(tarefa)}
                        >
                          Devolver tarefa
                        </button>
                        {tarefa.origem === "operacional" && tarefa.status === "em_execucao" && <button className="btn-secondary" disabled={tarefaConcluindoId === tarefa.id} onClick={() => informarEspera(tarefa)}>Registrar pendência</button>}
                        <button
                          className="btn-success"
                          disabled={
                            tarefaConcluindoId === tarefa.id ||
                            (tarefaExigeChecklistDocumentos(tarefa) &&
                              !checklistDocumentosCompleto(tarefa))
                          }
                          onClick={() => setTarefaEmConclusao(tarefa)}
                          title={
                            tarefaExigeChecklistDocumentos(tarefa) &&
                            !checklistDocumentosCompleto(tarefa)
                              ? "Confirme os 5 documentos antes de concluir"
                              : undefined
                          }
                        >
                          {tarefaConcluindoId === tarefa.id ? "Enviando..." : tarefa.origem === "operacional" ? "Enviar para validação" : "Marcar como concluída"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {tarefasPendentes.length > ITENS_POR_PAGINA && <div className="task-history-actions"><button className="btn-secondary compact" disabled={paginaPendentes === 1} onClick={() => setPaginaPendentes((pagina) => pagina - 1)}>Anterior</button><small>Página {paginaPendentes} de {Math.ceil(tarefasPendentes.length / ITENS_POR_PAGINA)}</small><button className="btn-secondary compact" disabled={paginaPendentes >= Math.ceil(tarefasPendentes.length / ITENS_POR_PAGINA)} onClick={() => setPaginaPendentes((pagina) => pagina + 1)}>Próxima</button></div>}
              </div>

              <div className="side-stack">
                <div className="panel resource-panel">
                <div className="resource-heading">
                  <MetricIcon type="documentos" />
                  <div><h2>Central de Recursos</h2><p>Acesse documentos e planilhas da operação.</p></div>
                </div>
                
                <a href="https://docs.google.com/spreadsheets/d/1MvKj4uO1GJL1XKJMqM5c2dauAG6q8yKt7fYxGaRMBKI/edit?usp=sharing" target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                  <button className="resource-link primary full"><UiIcon name="dashboard" /> Planilha Geral 2026</button>
                </a>

                <a href="https://drive.google.com/drive/folders/1lAyvvD_NawsHSDpcYxXdruhv5COmjXXI?usp=drive_link" target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                  <button className="resource-link full"><UiIcon name="documentos" /> Modelos Judiciais</button>
                </a>

                <a href="https://ledjqodwccotuxdrkjgk.supabase.co/storage/v1/object/sign/TRATATIVAS%20JURIDICO/esteira-juridico.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NmQyNjRmMy1mNjg4LTQ1YmItYjlkNS1mMjQ1MjM3YTJhODUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJUUkFUQVRJVkFTIEpVUklESUNPL2VzdGVpcmEtanVyaWRpY28ucGRmIiwiaWF0IjoxNzgwMzg2Mzc2LCJleHAiOjE4MTE5MjIzNzZ9.xoVDXx75TgGiuBIzfhi5n1X01sWAWOkGsyYU4HMOU-M" target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                  <button className="resource-link full"><UiIcon name="documentos" /> Esteira Jurídico</button>
                </a>

                <a href="https://ledjqodwccotuxdrkjgk.supabase.co/storage/v1/object/sign/TRATATIVAS%20ADM/esteira-adm.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NmQyNjRmMy1mNjg4LTQ1YmItYjlkNS1mMjQ1MjM3YTJhODUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJUUkFUQVRJVkFTIEFETS9lc3RlaXJhLWFkbS5wZGYiLCJpYXQiOjE3ODAzODY0MTUsImV4cCI6MTgxMTkyMjQxNX0.foSBNz4TUEF_QuIVLXa8auQvUFeoqHMTiH-GFTaSJYQ" target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                  <button className="resource-link full"><UiIcon name="documentos" /> Esteira Administrativo</button>
                </a>
                </div>
              </div>
            </section>
            <section className="unified-workspace-section">
              <div className="unified-workspace-divider">
                <div>
                  <span className="eyebrow">Seção de acompanhamento</span>
                  <h2>Urgências operacionais</h2>
                  <p>Registre, acompanhe e atualize atendimentos urgentes sem sair das suas tarefas.</p>
                </div>
                <span>Urgências</span>
              </div>
              <ModuloUrgencias usuario={usuario} funcionarios={funcionarios} showToast={showToast} />
            </section>
          </div>
        )}

        {abaAtiva === "delegar" && <FormularioDelegacaoUsuario usuario={usuario} funcionarios={funcionarios} showToast={showToast} onCriada={(tarefa) => setListaTarefas((atuais) => [tarefa, ...atuais])} />}
        {abaAtiva === "clientes" && <ModuloClientes />}

        {abaAtiva === "acompanhamento" && <AcompanhamentoEquipe tarefas={listaTarefas} funcionarios={funcionarios} historicoPessoal={tarefasConcluidas} onAtualizar={recarregarTarefas} />}

        {abaAtiva === "feedbacks" && (
          <section className="panel large feedback-workspace">
            <div className="panel-title-row">
              <div>
                <span className="eyebrow">Desenvolvimento profissional</span>
                <h2>Meus Feedbacks</h2>
              </div>
              <button
                className="btn-secondary compact"
                onClick={atualizarMeusFeedbacks}
              >
                Atualizar
              </button>
            </div>
            <p className="feedback-intro">
              Aqui ficam registrados os reconhecimentos e alinhamentos enviados
              diretamente para você.
            </p>
            <ListaFeedbacks
              feedbacks={meusFeedbacks}
              vazio="Você ainda não recebeu nenhum feedback profissional."
            />
          </section>
        )}

        {abaAtiva === "documentos" && (
          <Suspense fallback={<section className="panel"><p>Carregando gerador de documentos...</p></section>}>
            <GeradorDocumentos usuario={usuario} responsavel={usuario.nome} onSuccess={showToast} />
          </Suspense>
        )}

      </main>
      {tarefaEmDevolucao && (
        <ModalDevolucao
          onClose={() => setTarefaEmDevolucao(null)}
          onConfirmar={devolverTarefa}
          tarefa={tarefaEmDevolucao}
        />
      )}
      {tarefaEmConclusao && (
        <ModalConclusaoTarefa
          tarefa={tarefaEmConclusao}
          entrega={entregasPop[tarefaEmConclusao.id] || {}}
          enviando={tarefaConcluindoId === tarefaEmConclusao.id}
          onChange={(valor) => setEntregasPop((atuais) => ({ ...atuais, [tarefaEmConclusao.id]: valor }))}
          onClose={() => setTarefaEmConclusao(null)}
          onConfirmar={(imagem) => concluirTarefa(tarefaEmConclusao, imagem)}
          onDevolver={() => { setTarefaEmConclusao(null); setTarefaEmDevolucao(tarefaEmConclusao); }}
        />
      )}
    </div>
  );
}

// ==========================================
// 6. APLICAÇÃO PRINCIPAL (APP)
// ==========================================

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [listaTarefas, setListaTarefas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [responsabilidadesMensais, setResponsabilidadesMensais] = useState([]);
  const [toastMessage, setToastMessage] = useState("");
  const [inicializando, setInicializando] = useState(true);
  const [modoRecuperacao, setModoRecuperacao] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery",
  );

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  }, []);

  const recarregarTarefas = useCallback(async () => {
    const { data, error } = await supabase
      .from("tarefas")
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;
    const tarefasOperacionais = (data || []).filter(
      (tarefa) => !tarefaEhResponsabilidadeMensal(tarefa),
    );
    setListaTarefas(tarefasOperacionais);
    return tarefasOperacionais;
  }, []);

  const recarregarFuncionarios = useCallback(async () => {
    const { data, error } = await supabase
      .from("funcionarios")
      .select("*")
      .order("pontos", { ascending: false });

    if (error) throw error;
    setFuncionarios(data || []);
    return data || [];
  }, []);

  const recarregarFeedbacks = useCallback(async () => {
    const { data, error } = await supabase
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setFeedbacks(data || []);
    return data || [];
  }, []);

  const recarregarResponsabilidadesMensais = useCallback(async () => {
    const { data: tarefasLegadas, error: erroLegado } = await supabase
      .from("tarefas")
      .select("id, titulo, descricao, funcionaria_id")
      .eq("status", "responsabilidade_mensal")
      .order("id", { ascending: true });

    if (erroLegado) throw erroLegado;

    const responsabilidades = (tarefasLegadas || [])
      .map(converterTarefaEmResponsabilidade)
      .sort((a, b) => {
        const comparacaoMes = b.mes_referencia.localeCompare(
          a.mes_referencia,
        );
        return comparacaoMes || a.ordem - b.ordem;
      });

    setResponsabilidadesMensais(responsabilidades);
    return responsabilidades;
  }, []);

  const sincronizarDados = useCallback(async () => {
    await Promise.all([
      recarregarTarefas(),
      recarregarFuncionarios(),
      recarregarFeedbacks(),
      recarregarResponsabilidadesMensais(),
    ]);
  }, [
    recarregarFeedbacks,
    recarregarFuncionarios,
    recarregarResponsabilidadesMensais,
    recarregarTarefas,
  ]);

  const handleLogin = useCallback(async (perfil) => {
    setUsuarioLogado(perfil);

    try {
      await sincronizarDados();
    } catch (error) {
      console.error("Erro ao sincronizar dados após o login:", error);
      showToast("Login realizado, mas houve erro ao carregar os dados.");
    }
  }, [showToast, sincronizarDados]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUsuarioLogado(null);
    setListaTarefas([]);
    setFuncionarios([]);
    setFeedbacks([]);
    setResponsabilidadesMensais([]);
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") {
        setModoRecuperacao(true);
        setUsuarioLogado(null);
        setInicializando(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let ativo = true;

    async function restaurarSessao() {
      try {
        if (modoRecuperacao) return;
        const { data, error } = await limitarTempo(
          supabase.auth.getSession(),
          TEMPO_LIMITE_INICIALIZACAO_MS,
          "Tempo limite excedido ao verificar a sessão.",
        );
        if (error) throw error;
        if (!data.session?.user) return;

        const perfil = await limitarTempo(
          buscarPerfilUsuario(data.session.user),
          TEMPO_LIMITE_INICIALIZACAO_MS,
          "Tempo limite excedido ao carregar o perfil.",
        );
        if (!ativo) return;

        setUsuarioLogado(perfil);
        setInicializando(false);
        sincronizarDados().catch((error) => {
          console.error("Erro ao sincronizar dados após restaurar a sessão:", error);
          if (ativo) {
            showToast("Sessão restaurada. Alguns dados ainda não foram carregados.");
          }
        });
      } catch (error) {
        console.error("Erro ao restaurar sessão:", error);
        supabase.auth.signOut({ scope: "local" }).catch((logoutError) => {
          console.error("Erro ao limpar a sessão local:", logoutError);
        });
        if (ativo) {
          showToast("Não foi possível restaurar sua sessão. Entre novamente.");
        }
      } finally {
        if (ativo) setInicializando(false);
      }
    }

    restaurarSessao();
    return () => {
      ativo = false;
    };
  }, [modoRecuperacao, showToast, sincronizarDados]);

  useEffect(() => {
    if (!usuarioLogado) return undefined;

    const atualizarEmSegundoPlano = () => {
      sincronizarDados().catch((error) => {
        console.error("Erro na sincronização automática:", error);
      });
    };
    const intervalo = window.setInterval(atualizarEmSegundoPlano, 30_000);

    function atualizarAoVoltar() {
      if (document.visibilityState === "visible") atualizarEmSegundoPlano();
    }

    document.addEventListener("visibilitychange", atualizarAoVoltar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", atualizarAoVoltar);
    };
  }, [sincronizarDados, usuarioLogado]);

  useEffect(() => {
    if (!usuarioLogado) return undefined;

    const alteracaoTarefa = {
      event: "*",
      schema: "public",
      table: "tarefas",
    };

    const canalTarefas = supabase
      .channel(`tarefas-${usuarioLogado.tipo}-${usuarioLogado.id}`)
      .on("postgres_changes", alteracaoTarefa, (evento) => {
        recarregarTarefas()
          .then(() => {
            if (
              usuarioLogado.tipo === "funcionaria" &&
              evento.eventType === "INSERT" &&
              String(evento.new?.funcionaria_id) === String(usuarioLogado.id) &&
              STATUS_ABERTOS.has(evento.new?.status)
            ) {
              showToast("Uma nova tarefa foi delegada para voce.");
            }
          })
          .catch((error) => {
            console.error("Erro ao atualizar tarefas em tempo real:", error);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalTarefas);
    };
  }, [recarregarTarefas, showToast, usuarioLogado]);

  useEffect(() => {
    if (!usuarioLogado) return undefined;

    const alteracaoFeedback = {
      event: "INSERT",
      schema: "public",
      table: "feedbacks",
    };

    if (usuarioLogado.tipo === "funcionaria") {
      alteracaoFeedback.filter = `funcionaria_id=eq.${usuarioLogado.id}`;
    }

    const canal = supabase
      .channel(`feedbacks-${usuarioLogado.tipo}-${usuarioLogado.id}`)
      .on("postgres_changes", alteracaoFeedback, () => {
        recarregarFeedbacks()
          .then(() => {
            if (usuarioLogado.tipo === "funcionaria") {
              showToast("Você recebeu um novo feedback profissional.");
            }
          })
          .catch((error) => {
            console.error("Erro ao atualizar feedbacks em tempo real:", error);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [recarregarFeedbacks, showToast, usuarioLogado]);

  const globais = {
    listaTarefas,
    setListaTarefas,
    funcionarios,
    setFuncionarios,
    feedbacks,
    setFeedbacks,
    responsabilidadesMensais,
    setResponsabilidadesMensais,
    recarregarTarefas,
    recarregarFuncionarios,
    recarregarFeedbacks,
    recarregarResponsabilidadesMensais,
    showToast,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        :root {
          --bg-main: #edf5ff;
          --bg-soft: #f7fbff;
          --glass: rgba(255, 255, 255, 0.72);
          --glass-strong: rgba(255, 255, 255, 0.9);
          --accent: #4f8ff7;
          --accent-strong: #2563eb;
          --accent-soft: #d9eaff;
          --cyan: #6dd5ed;
          --dark: #102a56;
          --navy: #0c2147;
          --text: #253a5c;
          --muted: #7182a0;
          --line: rgba(102, 145, 202, 0.18);
          --green: #42bfa5;
          --warning: #e9a63a;
          --danger: #df6d87;
          --shadow: 0 22px 60px rgba(61, 104, 163, 0.13);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { background: var(--bg-main); }
        body { min-width: 320px; background: radial-gradient(circle at 85% 8%, rgba(128, 190, 255, .28), transparent 30%), radial-gradient(circle at 30% 90%, rgba(177, 220, 255, .3), transparent 32%), var(--bg-main); color: var(--text); font-family: 'Manrope', 'Segoe UI', sans-serif; }
        button, input, select, textarea { font: inherit; }
        button { color: inherit; }
        h1, h2, h3, h4 { color: var(--dark); }
        h1 { font-size: clamp(22px, 2.1vw, 30px); font-weight: 800; letter-spacing: -.7px; margin-bottom: 6px; }
        p { color: var(--muted); line-height: 1.65; }
        .ui-icon { display: block; flex: 0 0 auto; }
        .full { width: 100%; }

        .login-page-liquid { min-height: 100vh; position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(420px, 1.12fr) minmax(390px, 520px); align-items: center; gap: clamp(34px, 5vw, 88px); padding: clamp(30px, 5vw, 78px) clamp(34px, 5vw, 86px); background: #f8fbff url('/assets/platino-login-background.png') center / cover no-repeat; color: #102a56; isolation: isolate; }
        .login-page-liquid::before { content: ''; position: absolute; inset: 0; z-index: 0; background: linear-gradient(90deg, rgba(248,251,255,.7) 0%, rgba(248,251,255,.46) 46%, rgba(248,251,255,.28) 100%); pointer-events: none; }
        .liquid-bg { display: none; }
        .ambient { position: absolute; border-radius: 999px; pointer-events: none; filter: blur(18px); }
        .ambient-one { width: 470px; height: 470px; left: -160px; top: -170px; background: radial-gradient(circle, rgba(141,187,255,.32), transparent 68%); }
        .ambient-two { width: 560px; height: 560px; right: -190px; bottom: -220px; background: radial-gradient(circle, rgba(47,107,255,.2), transparent 70%); }
        .ambient-three { width: 390px; height: 390px; left: 38%; bottom: -150px; background: radial-gradient(circle, rgba(255,255,255,.86), transparent 64%); }
        .orbital-line { position: absolute; border: 1px solid rgba(37,99,235,.11); border-radius: 50%; transform: rotate(-18deg); }
        .orbital-one { width: 760px; height: 240px; left: 22%; top: 18%; }
        .orbital-two { width: 620px; height: 190px; left: 30%; top: 40%; transform: rotate(24deg); }
        .hero-content, .glass-card { position: relative; z-index: 1; }
        .hero-content { min-height: 610px; display: flex; flex-direction: column; justify-content: center; max-width: 760px; padding-left: clamp(0px, 2vw, 34px); isolation: isolate; }
        .hero-content > * { position: relative; z-index: 2; }
        .floating-badge { width: max-content; display: inline-flex; align-items: center; gap: 9px; margin-bottom: 28px; padding: 10px 18px; color: #2563eb; background: rgba(255,255,255,.64); border: 1px solid rgba(255,255,255,.78); border-radius: 999px; box-shadow: 0 16px 36px rgba(47,107,255,.1), inset 0 1px 0 rgba(255,255,255,.96); font-size: 12px; font-weight: 900; letter-spacing: 1.4px; backdrop-filter: blur(24px); }
        .hero-content h2 { position: relative; max-width: 560px; margin: 0; color: #0f2a55; font-size: clamp(58px, 6.1vw, 86px); line-height: .93; font-weight: 900; letter-spacing: 0; text-shadow: 0 18px 44px rgba(15,42,85,.08); }
        .hero-content h2::before, .hero-content h2::after { display: none; }
        .hero-content > p { position: relative; max-width: 510px; min-height: 0; margin-top: 28px; color: #6b7c93; font-size: 17px; line-height: 1.55; font-weight: 500; }
        .hero-content > p::before { display: none; }
        .brand-emblem-showcase { position: absolute; width: clamp(154px, 13vw, 214px); aspect-ratio: 1; left: clamp(430px, 35vw, 560px); top: 47%; z-index: 1; opacity: .42; pointer-events: none; transform: translateY(-50%); perspective: 1100px; }
        .emblem-halo { position: absolute; inset: 9%; border-radius: 999px; background: radial-gradient(circle, rgba(141,187,255,.36), transparent 68%); filter: blur(18px); }
        .emblem-orbit { position: absolute; inset: 15%; border: 1px solid rgba(37,99,235,.13); border-radius: 50%; }
        .orbit-a { transform: rotateX(62deg) rotateZ(-16deg); }
        .orbit-b { inset: 25%; transform: rotateX(58deg) rotateZ(27deg); opacity: .65; }
        .emblem-glass-plate { position: absolute; inset: 17%; display: grid; place-items: center; border-radius: 30px; background: linear-gradient(145deg, rgba(255,255,255,.62), rgba(232,243,255,.34)); border: 1px solid rgba(255,255,255,.72); box-shadow: 0 18px 38px rgba(31,74,132,.12), inset 0 1px 0 rgba(255,255,255,.94); backdrop-filter: blur(18px); overflow: hidden; animation: emblemFloat 7s ease-in-out infinite; }
        .emblem-symbol { position: relative; width: 112%; height: 112%; object-fit: cover; border-radius: 28px; filter: drop-shadow(0 14px 18px rgba(15,42,85,.14)); }
        .showcase-stats { display: grid; grid-template-columns: repeat(3, minmax(118px, 1fr)); gap: 18px; max-width: 500px; margin-top: 36px; }
        .metric-card, .showcase-stats > div { min-height: 136px; display: flex; flex-direction: column; justify-content: flex-end; gap: 9px; padding: 18px; color: #0f2a55; background: linear-gradient(145deg, rgba(255,255,255,.58), rgba(238,246,255,.35)); border: 1px solid rgba(255,255,255,.72); border-radius: 18px; box-shadow: 0 20px 46px rgba(31,74,132,.11), inset 0 1px 0 rgba(255,255,255,.96); backdrop-filter: blur(24px); }
        .showcase-stats svg { color: #2563eb; margin-bottom: auto; }
        .showcase-stats strong { color: #102a56; font-size: 25px; font-weight: 900; letter-spacing: 0; }
        .showcase-stats span { color: #0f2a55; font-size: 10px; line-height: 1.45; font-weight: 800; letter-spacing: .25px; text-transform: uppercase; }
        .showcase-stats > div span { font-size: 0; }
        .showcase-stats > div:nth-child(1) span::before { content: 'OPERACAO CENTRALIZADA'; font-size: 10px; line-height: 1.45; }
        .showcase-stats > div:nth-child(2) span::before { content: 'VISAO CONTINUA EM TEMPO REAL'; font-size: 10px; line-height: 1.45; }
        .showcase-stats > div:nth-child(3) strong { font-size: 0; }
        .showcase-stats > div:nth-child(3) strong::before { content: '100%'; font-size: 25px; }
        .showcase-stats > div:nth-child(3) span::before { content: 'DOCUMENTOS ORGANIZADOS'; font-size: 10px; line-height: 1.45; }
        .glass-card { width: 100%; padding: clamp(36px, 4vw, 56px); background: linear-gradient(145deg, rgba(255,255,255,.62), rgba(239,247,255,.38)); border: 1px solid rgba(255,255,255,.65); border-radius: 40px; box-shadow: 0 34px 90px rgba(47,107,255,.15), 0 12px 40px rgba(15,42,85,.08), inset 0 1px 0 rgba(255,255,255,.92); backdrop-filter: blur(24px); }
        .login-card::before { content: ''; position: absolute; inset: 1px; border-radius: inherit; background: linear-gradient(135deg, rgba(255,255,255,.82), transparent 35%, rgba(141,187,255,.14)); pointer-events: none; }
        .login-card > * { position: relative; z-index: 1; }
        .login-brand { display: flex; align-items: center; gap: 16px; margin-bottom: 42px; }
        .login-brand div span, .login-brand div strong { display: block; }
        .login-brand div strong { color: #0f2a55; font-size: 31px; font-weight: 700; letter-spacing: 8px; line-height: .95; }
        .login-brand div span { margin-top: 8px; color: #243b61; font-size: 9px; font-weight: 800; letter-spacing: 2.8px; text-transform: uppercase; }
        .brand-badge { width: 76px; height: 76px; border-radius: 24px; object-fit: cover; object-position: center; box-shadow: 0 14px 30px rgba(37,99,235,.2), 0 0 28px rgba(141,187,255,.36); }
        .secure-badge { display: inline-flex; align-items: center; gap: 8px; color: #2563eb; font-size: 12px; font-weight: 900; letter-spacing: 1.2px; }
        .login-card h1 { margin: 26px 0 7px; color: #0f2a55; font-size: clamp(27px, 2.1vw, 34px); line-height: 1.08; letter-spacing: 0; }
        .login-card > p { color: #6b7c93; font-size: 14px; }
        .login-form { display: flex; flex-direction: column; gap: 22px; margin-top: 32px; }
        .login-form label, .stack-form label { color: #0f2a55; font-size: 12px; font-weight: 800; }
        .glass-field { display: flex; flex-direction: column; gap: 9px; }
        .glass-input { min-height: 58px; display: flex; align-items: center; gap: 12px; padding: 0 18px; color: #46617f; background: rgba(246,250,255,.45); border: 1px solid rgba(255,255,255,.72); border-radius: 17px; box-shadow: inset 0 1px 0 rgba(255,255,255,.94), 0 12px 28px rgba(47,107,255,.08); backdrop-filter: blur(18px); transition: .22s ease; }
        .glass-input:focus-within { border-color: rgba(47,107,255,.42); box-shadow: 0 0 0 4px rgba(47,107,255,.09), inset 0 1px 0 rgba(255,255,255,.96); transform: translateY(-1px); }
        .login-form input { width: 100%; margin: 0; padding: 0; color: #102a56; background: transparent; border: 0; box-shadow: none; outline: 0; font-size: 14px; font-weight: 700; }
        .login-form input::placeholder { color: #71839b; font-weight: 600; }
        .auth-message { margin: -8px 0 0; color: #375579; font-size: 12px; line-height: 1.5; }
        .glass-button { min-height: 58px; display: inline-flex; align-items: center; justify-content: center; gap: 12px; margin-top: 8px; padding: 16px 20px; color: #fff; background: linear-gradient(135deg, #6aa2ff 0%, #2f6bff 52%, #2563eb 100%); border: 1px solid rgba(255,255,255,.5); border-radius: 18px; box-shadow: 0 18px 34px rgba(37,99,235,.28), inset 0 1px 0 rgba(255,255,255,.58), inset 0 -12px 22px rgba(15,42,85,.16); cursor: pointer; font-size: 15px; font-weight: 900; transition: .24s ease; }
        .glass-button:hover { transform: translateY(-2px); box-shadow: 0 23px 42px rgba(37,99,235,.34), 0 0 28px rgba(141,187,255,.42), inset 0 1px 0 rgba(255,255,255,.68); }
        .login-card-softline { height: 1px; margin-top: 34px; background: linear-gradient(90deg, transparent, rgba(37,99,235,.22), transparent); }
        .login-footer { position: absolute; z-index: 2; bottom: 31px; display: flex; align-items: center; gap: 9px; color: #788aa3; font-size: 12px; font-weight: 600; }
        .login-footer strong { color: #2563eb; }
        .login-footer-left { left: clamp(34px, 5vw, 86px); }
        .login-footer-right { right: clamp(34px, 5vw, 86px); }
        .version-icon { width: 28px; height: 28px; border: 1px solid rgba(37,99,235,.3); border-radius: 50%; background: radial-gradient(circle at center, #8dbbff 0 16%, transparent 18% 38%, rgba(37,99,235,.18) 40% 48%, transparent 51%); box-shadow: 0 0 18px rgba(37,99,235,.16); }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes emblemFloat { 0%, 100% { transform: rotateY(-12deg) rotateX(6deg) translateY(0); } 50% { transform: rotateY(-8deg) rotateX(8deg) translateY(-8px); } }

        .app-layout { min-height: 100vh; display: block; background: radial-gradient(circle at 12% 0%, rgba(141,187,255,.18), transparent 28%), linear-gradient(135deg, #f8fbff 0%, #eef4fa 100%); }
        .sidebar { position: sticky; top: 14px; z-index: 40; display: flex; align-items: center; gap: 18px; margin: 14px clamp(16px, 3vw, 36px) 0; padding: 12px 14px; color: #102a56; background: rgba(255,255,255,.62); border: 1px solid rgba(255,255,255,.75); border-radius: 28px; box-shadow: 0 22px 70px rgba(44, 86, 145, .12), inset 0 1px 0 rgba(255,255,255,.92); backdrop-filter: blur(28px); }
        .sidebar::after { content: ''; position: absolute; inset: 1px; border-radius: inherit; background: linear-gradient(135deg, rgba(255,255,255,.78), transparent 42%, rgba(141,187,255,.13)); pointer-events: none; }
        .brand { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; min-width: 210px; }
        .brand-icon { display: block; width: 48px; height: 48px; border-radius: 50%; clip-path: circle(50% at 50% 50%); object-fit: cover; background: transparent; box-shadow: 0 10px 24px rgba(19,55,145,.2), 0 0 16px rgba(37,99,235,.18); image-rendering: auto; }
        .brand strong { display: block; color: #0f2a55; font-size: 16px; letter-spacing: 1.8px; }
        .brand span { display: block; margin-top: 2px; color: #6b7c93; font-size: 9px; text-transform: uppercase; letter-spacing: 1.2px; }
        .sidebar nav { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; position: relative; z-index: 2; }
        .nav-label { display: none; }
        .nav-item { position: relative; width: auto; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; color: #526780; background: rgba(248,251,255,.48); border: 1px solid rgba(255,255,255,.62); border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 800; text-align: center; transition: .24s ease; box-shadow: inset 0 1px 0 rgba(255,255,255,.88); }
        .nav-image-icon { width: 22px; height: 22px; flex: 0 0 22px; object-fit: contain; border-radius: 6px; filter: drop-shadow(0 3px 5px rgba(196,49,34,.18)); }
        .nav-item:hover { color: #2563eb; background: rgba(255,255,255,.82); transform: translateY(-2px); box-shadow: 0 14px 34px rgba(37,99,235,.12), inset 0 1px 0 rgba(255,255,255,.95); }
        .nav-item.active-tab { color: #fff; background: linear-gradient(135deg, #6aa2ff, #2563eb); border-color: rgba(255,255,255,.76); box-shadow: 0 18px 34px rgba(37,99,235,.22), inset 0 1px 0 rgba(255,255,255,.55); }
        .nav-item.active-tab .ui-icon { color: #fff; filter: drop-shadow(0 0 8px rgba(255,255,255,.38)); }
        .nav-menu-popover { position: absolute; left: 50%; top: calc(100% + 10px); min-width: 190px; display: grid; gap: 7px; padding: 12px; color: #46617f; background: rgba(255,255,255,.78); border: 1px solid rgba(255,255,255,.74); border-radius: 18px; box-shadow: 0 22px 56px rgba(44,86,145,.16); backdrop-filter: blur(26px); opacity: 0; pointer-events: none; transform: translate(-50%, -6px) scale(.98); transition: .2s ease; }
        .nav-menu-popover small { padding: 8px 10px; background: rgba(240,247,255,.68); border-radius: 12px; font-size: 10px; font-weight: 800; text-align: left; white-space: nowrap; }
        .nav-item:hover .nav-menu-popover { opacity: 1; transform: translate(-50%, 0) scale(1); }
        .sidebar-logout { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 14px; color: #526780; background: rgba(255,255,255,.58); border: 1px solid rgba(255,255,255,.72); border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 800; transition: .2s; }
        .sidebar-logout:hover { color: #2563eb; transform: translateY(-2px); box-shadow: 0 14px 34px rgba(37,99,235,.12); }

        .main-content { min-width: 0; padding: 28px clamp(24px, 3.2vw, 48px) 48px; }
        .topbar { position: relative; z-index: 100; min-height: 94px; display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 28px; padding: 22px 26px; background: rgba(255,255,255,.55); border: 1px solid rgba(255,255,255,.8); border-radius: 24px; box-shadow: 0 15px 45px rgba(57, 100, 157, .08); backdrop-filter: blur(22px); }
        .topbar p { font-size: 13px; }
        .topbar-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
        .notification-bell-wrap { position: relative; z-index: 101; }
        .notification-bell { position: relative; display: grid; width: 46px; height: 46px; place-items: center; color: #275383; background: rgba(255,255,255,.92); border: 1px solid rgba(84,133,194,.18); border-radius: 15px; box-shadow: 0 8px 22px rgba(54,94,148,.09); cursor: pointer; transition: .2s ease; }
        .notification-bell:hover, .notification-bell.is-open { color: #fff; background: linear-gradient(135deg, #2d83e6, #2562cf); border-color: transparent; box-shadow: 0 10px 25px rgba(37,98,207,.25); transform: translateY(-1px); }
        .notification-bell:focus-visible { outline: 3px solid rgba(52,132,234,.3); outline-offset: 3px; }
        .notification-badge { position: absolute; top: -6px; right: -7px; display: grid; min-width: 20px; height: 20px; padding: 0 5px; place-items: center; color: #fff; background: #d95061; border: 2px solid #fff; border-radius: 999px; box-shadow: 0 3px 9px rgba(183,49,68,.26); font-size: 9px; font-weight: 900; line-height: 1; }
        .notification-popover { position: absolute; z-index: 102; top: calc(100% + 11px); right: 0; width: min(390px, calc(100vw - 36px)); overflow: hidden; background: rgba(255,255,255,.98); border: 1px solid rgba(88,133,191,.2); border-radius: 18px; box-shadow: 0 22px 50px rgba(29,65,111,.2); animation: notificationPopover .18s ease both; }
        .notification-popover-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 17px 18px 14px; border-bottom: 1px solid rgba(77,121,178,.12); }
        .notification-popover-header .eyebrow { display: block; margin-bottom: 3px; font-size: 8px; }
        .notification-popover-header h2 { margin: 0; color: var(--dark); font-size: 17px; }
        .notification-popover-header strong { flex: 0 0 auto; color: #286bc7; font-size: 10px; }
        .notification-popover-list { display: grid; max-height: min(520px, calc(100vh - 180px)); gap: 8px; padding: 10px; overflow-y: auto; }
        .notification-empty { margin: 14px 8px; color: var(--muted); font-size: 12px; text-align: center; }
        @keyframes notificationPopover { from { opacity: 0; transform: translateY(-5px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .profile-pill { display: flex; align-items: center; gap: 11px; padding: 10px 15px; color: var(--text); background: rgba(238, 247, 255, .9); border: 1px solid rgba(113, 165, 224, .18); border-radius: 16px; }
        .profile-pill small, .profile-pill span { display: block; }
        .profile-pill small { color: var(--muted); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .7px; }
        .profile-pill span { color: var(--dark); font-size: 12px; font-weight: 800; margin-top: 1px; }
        .online-dot { width: 9px; height: 9px; border-radius: 50%; background: #54d2ad; box-shadow: 0 0 0 4px rgba(84, 210, 173, .14), 0 0 12px rgba(84,210,173,.45); }

        .cards-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin-bottom: 24px; }
        .card, .panel { background: var(--glass); border: 1px solid rgba(255,255,255,.85); border-radius: 23px; box-shadow: var(--shadow); backdrop-filter: blur(22px); }
        .panel { padding: 25px; }
        .card { min-height: 178px; padding: 22px; cursor: pointer; transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
        .card:hover { transform: translateY(-6px); border-color: rgba(91, 151, 228, .25); box-shadow: 0 28px 65px rgba(51, 95, 154, .17); }
        .metric-icon { width: 50px; height: 50px; display: grid; place-items: center; margin-bottom: 27px; color: var(--accent-strong); background: linear-gradient(145deg, rgba(222,238,255,.95), rgba(255,255,255,.8)); border: 1px solid rgba(103,161,226,.14); border-radius: 16px; box-shadow: 0 10px 25px rgba(59,113,181,.1), inset 0 1px rgba(255,255,255,.9); }
        .metric-ranking { color: #5d7ee8; }
        .metric-feedback { color: #4a9fc6; }
        .metric-equipe { color: #5288da; }
        .card span { display: block; margin-bottom: 5px; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
        .card strong { color: var(--dark); font-size: 24px; letter-spacing: -.8px; }

        .content-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 22px; align-items: start; }
        .side-stack, .stack-form, .team-list { display: flex; flex-direction: column; gap: 14px; }
        .panel h2 { margin-bottom: 21px; color: var(--dark); font-size: 14px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; }
        .panel-title-row { min-height: 35px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
        .panel-title-row h2 { margin: 0; }
        .compact { padding: 8px 12px !important; font-size: 11px !important; }
        .task-item { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 11px; padding: 17px 18px; background: rgba(247,251,255,.8); border: 1px solid rgba(111,157,210,.14); border-radius: 16px; transition: .2s ease; }
        .task-item:hover { background: rgba(255,255,255,.94); border-color: rgba(79,143,247,.22); transform: translateX(2px); }
        .task-item:last-child { margin-bottom: 0; }
        .task-item h3, .task-item h4 { margin-bottom: 5px; color: var(--dark); font-size: 14px; }
        .task-item p { font-size: 12px; }
        .task-item small { color: #7b8ca8; font-size: 10px; line-height: 1.6; }
        .task-workflow-summary { display: grid; gap: 8px; width: min(100%, 720px); margin: 9px 0 12px; padding: 11px 12px; background: rgba(235,244,255,.7); border: 1px solid rgba(72,132,205,.13); border-radius: 12px; }
        .task-workflow-summary.compact { display: block; width: auto; margin: 9px 0 5px; padding: 0; background: transparent; border: 0; }
        .task-workflow-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .workflow-status { display: inline-flex; align-items: center; width: max-content; padding: 6px 9px; border-radius: 999px; font-size: 9px; font-weight: 900; letter-spacing: .55px; text-transform: uppercase; }
        .workflow-status-fila { color: #315f91; background: #e2f0ff; }
        .workflow-status-em-andamento { color: #225fb8; background: #dceaff; }
        .workflow-status-pendente-bloqueada { color: #a45d19; background: #fff0c9; }
        .workflow-status-validacao-supervisor { color: #6f54a8; background: #eee7ff; }
        .workflow-status-concluida { color: #247b67; background: #d8f4eb; }
        .workflow-phase { color: #526b8b; font-size: 10px; font-weight: 800; }
        .workflow-progress { display: grid; grid-template-columns: repeat(5, minmax(24px,1fr)); gap: 5px; }
        .workflow-progress span { height: 5px; background: rgba(115,143,178,.18); border-radius: 99px; }
        .workflow-progress span.active { background: #80aee9; }
        .workflow-progress span.active.pendente-bloqueada { background: #e6ad4d; }
        .workflow-progress span.active.validacao-supervisor { background: #9677d0; }
        .workflow-progress span.active.concluida { background: #51b99f; }
        .task-workflow-summary > small { margin: 0; color: #607896; }
        .task-actions { display: flex; align-items: center; gap: 9px; }
        .status { padding: 6px 10px; border-radius: 999px; font-size: 9px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; white-space: nowrap; }
        .status.pendente { color: #a66e16; background: rgba(255, 229, 170, .55); border: 1px solid rgba(216,164,54,.15); }
        .status.concluida { color: #268c77; background: rgba(190, 241, 228, .6); border: 1px solid rgba(66,191,165,.14); }
        .status.nova { color: #315f91; background: #e2f0ff; }
        .status.em_andamento { color: #225fb8; background: #dceaff; }
        .status.aguardando_cliente, .status.aguardando_banco, .status.aguardando_judiciario { color: #986713; background: #fff0c9; }
        .status.impedida { color: #b73350; background: #ffe2e9; }
        .status.cancelada, .status.arquivada { color: #667085; background: #edf1f5; }
        .priority-badge, .category-badge, .tv-visibility-badge, .manual-task-badge { display: inline-flex; align-items: center; width: max-content; padding: 6px 10px; border-radius: 999px; font-size: 9px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase; white-space: nowrap; }
        .priority-badge.priority-normal { color: #65758c; background: #edf3f8; }
        .priority-badge.priority-alta { color: #9b6414; background: #fff0c9; }
        .priority-badge.priority-urgente { color: #b73350; background: #ffe2e9; box-shadow: 0 0 0 3px rgba(223,109,135,.08); }
        .category-badge { color: #315f91; background: #e2f0ff; border: 1px solid rgba(79,143,247,.12); }
        .employee-task-note { margin: 10px 0; padding: 10px 12px; color: #516987; background: rgba(231,242,255,.74); border-left: 3px solid #5c9bf0; border-radius: 8px; font-size: 11px; line-height: 1.55; }

        .task-management { display: flex; flex-direction: column; gap: 22px; }
        .task-management-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .task-management-header h2 { margin: 5px 0 5px; font-size: 24px; }
        .task-management-header p { font-size: 12px; }
        .task-management-actions { display: flex; gap: 10px; flex: 0 0 auto; }
        .task-editor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; align-items: start; }
        .task-editor-grid.single-column { grid-template-columns: minmax(0, 1fr); }
        .task-form { margin-top: 20px; }
        .task-form label { display: flex; flex-direction: column; gap: 7px; }
        .task-kind-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding: 5px; background: rgba(232,242,254,.78); border: 1px solid rgba(104,148,201,.13); border-radius: 13px; }
        .task-kind-switch button { padding: 10px 12px; color: #7182a0; background: transparent; border: 0; border-radius: 9px; cursor: pointer; font-size: 11px; font-weight: 800; }
        .task-kind-switch button.active { color: #fff; background: linear-gradient(135deg, #4f8ff7, #3d78db); box-shadow: 0 8px 18px rgba(55,118,216,.2); }
        .task-auto-title { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 48px; padding: 10px 13px; color: #355071; background: linear-gradient(135deg, #f4f9ff, #edf5ff); border: 1px solid rgba(61,130,236,.2); border-radius: 12px; }
        .task-auto-title span { color: #5e7897; font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
        .task-auto-title strong { color: #163b70; font-size: 13px; text-align: right; }
        .task-form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .task-form-details { display: grid; gap: 13px; padding: 15px; background: linear-gradient(135deg, rgba(246,250,255,.96), rgba(238,246,255,.78)); border: 1px solid rgba(84,136,205,.16); border-radius: 16px; box-shadow: 0 8px 22px rgba(40,90,155,.04); }
        .task-choice-fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
        .task-choice-fieldset legend { margin: 0 0 9px; color: #253b59; font-size: 11px; font-weight: 800; }
        .task-action-picker { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }
        .task-action-chip { position: relative; min-height: 68px; display: flex; align-items: center; gap: 9px; padding: 11px 12px; color: #3c526f; text-align: left; background: #fff; border: 1px solid rgba(86,127,180,.2); border-radius: 14px; box-shadow: 0 3px 10px rgba(42,83,133,.04); cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease; }
        .task-action-chip:hover { transform: translateY(-2px); border-color: rgba(53,119,220,.45); box-shadow: 0 10px 20px rgba(42,83,133,.12); }
        .task-action-chip > span { flex: 0 0 auto; font-size: 20px; line-height: 1; }
        .task-action-chip strong { font-size: 10px; font-weight: 800; line-height: 1.25; text-transform: uppercase; }
        .task-action-chip b { position: absolute; top: 8px; right: 8px; display: grid; width: 18px; height: 18px; place-items: center; color: #fff; background: #3378e4; border-radius: 50%; font-size: 10px; }
        .task-action-chip.active { color: #123d7b; background: linear-gradient(135deg, #e2f0ff, #f5f9ff); border-color: #3c82ec; box-shadow: 0 10px 22px rgba(45,111,216,.17); }
        .priority-choice-fieldset { align-self: stretch; padding: 11px 12px; background: #fff; border: 1px solid rgba(86,127,180,.16); border-radius: 13px; }
        .priority-choice-fieldset legend { padding: 0 2px; margin-bottom: 7px; }
        .priority-picker { display: flex; flex-wrap: wrap; gap: 7px; }
        .priority-choice { min-height: 34px; display: inline-flex; align-items: center; gap: 4px; padding: 7px 9px; color: #60738e; background: #f8fafc; border: 1px solid transparent; border-radius: 9px; cursor: pointer; font-size: 10px; font-weight: 800; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .priority-choice:hover { transform: translateY(-1px); box-shadow: 0 5px 12px rgba(41,84,135,.12); }
        .priority-choice.active { border-color: currentColor; box-shadow: 0 5px 12px rgba(41,84,135,.1); }
        .priority-choice.priority-baixa { color: #288766; background: #eaf9f2; }
        .priority-choice.priority-normal { color: #276ecf; background: #eaf3ff; }
        .priority-choice.priority-alta { color: #9f7218; background: #fff5d8; }
        .priority-choice.priority-urgente, .priority-choice.priority-critica { color: #ba4056; background: #fff0f2; }
        .task-delegation-form > label:first-child input { min-height: 46px; font-size: 14px; font-weight: 700; }
        .task-delegation-form input[readonly] { color: #5b7090; background: #f4f8fc; cursor: default; }
        .delegation-submit, .task-delegation-submit { min-height: 46px; border-radius: 14px; background: linear-gradient(135deg, #1e62cb, #3d8af4); box-shadow: 0 12px 22px rgba(40,106,215,.24); transition: transform .18s ease, box-shadow .18s ease; }
        .delegation-submit:hover:not(:disabled), .task-delegation-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 28px rgba(40,106,215,.31); }
        .task-check-label { flex-direction: row !important; align-items: center; gap: 9px !important; padding: 11px 12px; background: rgba(238,247,255,.72); border: 1px solid rgba(104,148,201,.14); border-radius: 12px; cursor: pointer; }
        .task-check-label input { width: 17px !important; height: 17px; flex: 0 0 auto; padding: 0 !important; accent-color: var(--accent-strong); box-shadow: none !important; }
        .task-editor-empty { min-height: 420px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
        .task-editor-empty .metric-icon { margin-bottom: 18px; }
        .task-editor-empty h2 { margin-bottom: 8px; }
        .task-editor-empty p { max-width: 390px; font-size: 12px; }
        .task-list-panel { overflow: hidden; }
        .task-list-heading { align-items: flex-end; }
        .task-list-heading h2 { margin-top: 4px; }
        .task-list-controls { display: flex; align-items: center; gap: 9px; }
        .task-list-controls { flex-wrap: wrap; justify-content: flex-end; }
        .task-list-controls select { min-width: 150px; padding: 9px 12px !important; }
        .task-list-controls input[type="date"] { width: 155px; padding: 9px 12px !important; }
        .task-bulk-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; padding: 12px 14px; background: rgba(232,242,254,.62); border: 1px solid rgba(104,148,201,.13); border-radius: 14px; }
        .task-bulk-toolbar label, .task-bulk-toolbar > div { display: flex; align-items: center; gap: 9px; color: var(--dark); font-size: 11px; font-weight: 800; }
        .task-bulk-toolbar input, .task-select-checkbox { width: 17px !important; height: 17px !important; padding: 0 !important; flex: 0 0 auto; accent-color: var(--accent-strong); }
        .task-select-checkbox { margin-left: 2px; }
        .admin-task-list { display: grid; gap: 12px; }
        .admin-task-card { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 20px; overflow: hidden; padding: 18px 18px 18px 21px; background: rgba(247,251,255,.8); border: 1px solid rgba(111,157,210,.14); border-radius: 17px; }
        .admin-task-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: #9aa9bc; }
        .admin-task-card.priority-alta::before { background: #e4a23b; }
        .admin-task-card.priority-urgente::before { background: #df5e7b; }
        .admin-task-main { min-width: 0; }
        .admin-task-main h3 { margin: 9px 0 5px; font-size: 15px; }
        .admin-task-main p { font-size: 12px; }
        .admin-task-main small { display: block; margin-top: 9px; }
        .admin-task-badges { display: flex; flex-wrap: wrap; gap: 7px; }
        .tv-visibility-badge { color: #35679f; background: #e5f1ff; }
        .manual-task-badge { color: #6f54a8; background: #eee7ff; }
        .admin-task-note { margin-top: 9px; padding: 9px 11px; color: #526b8b; background: rgba(225,239,255,.72); border-radius: 9px; font-size: 11px; line-height: 1.5; }
        .admin-task-actions { display: flex; gap: 7px; flex: 0 0 auto; }

        .tv-page { min-height: 100vh; display: flex; flex-direction: column; padding: clamp(18px, 2vw, 32px); color: #e8f2ff; background: radial-gradient(circle at 12% 0%, rgba(65,133,222,.25), transparent 30%), radial-gradient(circle at 88% 5%, rgba(61,192,218,.18), transparent 28%), #07172f; }
        .tv-topbar { display: grid; grid-template-columns: minmax(280px, 1.1fr) minmax(340px, 1fr) auto; align-items: center; gap: 28px; padding-bottom: 22px; border-bottom: 1px solid rgba(164,202,245,.13); }
        .tv-brand { display: flex; align-items: center; gap: 15px; }
        .tv-brand img { width: 55px; height: 55px; object-fit: cover; border-radius: 16px; box-shadow: 0 12px 30px rgba(0,0,0,.28); }
        .tv-brand span { color: #68bdf5; font-size: 9px; font-weight: 800; letter-spacing: 1.8px; }
        .tv-brand h1 { margin: 3px 0 0; color: #fff; font-size: clamp(18px, 1.8vw, 28px); }
        .tv-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
        .tv-summary div { padding: 10px 12px; text-align: center; background: rgba(255,255,255,.055); border: 1px solid rgba(165,205,248,.1); border-radius: 13px; }
        .tv-summary strong, .tv-summary span { display: block; }
        .tv-summary strong { color: #fff; font-size: 20px; }
        .tv-summary span { margin-top: 2px; color: #8ea9ca; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; }
        .tv-clock { min-width: 170px; text-align: right; }
        .tv-clock strong, .tv-clock span { display: block; }
        .tv-clock strong { color: #fff; font-size: 29px; letter-spacing: -1px; }
        .tv-clock span { color: #8faaca; font-size: 10px; text-transform: capitalize; }
        .tv-controls { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; margin-top: -14px; }
        .tv-controls button { padding: 7px 10px; color: #9eb8d7; background: rgba(255,255,255,.04); border: 1px solid rgba(168,207,250,.12); border-radius: 9px; cursor: pointer; font-size: 9px; font-weight: 700; }
        .tv-board { flex: 1; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: clamp(14px, 1.5vw, 24px); padding: 24px 0 17px; min-height: 0; }
        .tv-column { display: flex; flex-direction: column; min-height: 0; padding: clamp(15px, 1.5vw, 22px); background: rgba(15,39,76,.72); border: 1px solid rgba(150,194,241,.11); border-radius: 21px; box-shadow: 0 22px 55px rgba(0,0,0,.16); }
        .tv-column > header { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 17px; padding-bottom: 15px; border-bottom: 1px solid rgba(151,194,240,.1); }
        .tv-column > header span { color: var(--tv-accent); font-size: 8px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; }
        .tv-column > header h2 { margin-top: 3px; color: #fff; font-size: clamp(17px, 1.5vw, 23px); }
        .tv-column > header > strong { width: 38px; height: 38px; display: grid; place-items: center; color: var(--tv-accent); background: var(--tv-soft); border-radius: 12px; font-size: 16px; }
        .tv-column-urgent { --tv-accent: #ff7892; --tv-soft: rgba(255,101,133,.12); }
        .tv-column-pending { --tv-accent: #f4bc57; --tv-soft: rgba(244,188,87,.12); }
        .tv-column-done { --tv-accent: #5ed7b7; --tv-soft: rgba(94,215,183,.12); }
        .tv-column-overdue { --tv-accent: #ff8e68; --tv-soft: rgba(255,142,104,.14); }
        .tv-column-soon { --tv-accent: #7fc6ff; --tv-soft: rgba(127,198,255,.14); }
        .tv-column-list { min-height: 0; overflow: auto; scrollbar-width: thin; scrollbar-color: rgba(151,194,240,.22) transparent; }
        .tv-task-card { position: relative; margin-bottom: 11px; padding: 15px; overflow: hidden; background: rgba(255,255,255,.055); border: 1px solid rgba(172,210,250,.09); border-radius: 15px; }
        .tv-task-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--tv-accent); }
        .tv-task-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .tv-task-labels { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .tv-responsavel { color: var(--tv-accent); font-size: 9px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; }
        .tv-category { padding: 4px 7px; color: #9ed2ff; background: rgba(83,158,231,.12); border-radius: 999px; font-size: 7px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }
        .tv-overdue { padding: 4px 7px; color: #ff8aa0; background: rgba(255,104,133,.1); border-radius: 999px; font-size: 7px; font-weight: 800; text-transform: uppercase; }
        .tv-task-card h3 { margin: 8px 0 5px; color: #f8fbff; font-size: clamp(12px, 1vw, 15px); line-height: 1.35; }
        .tv-task-card > p { color: #9db1cc; font-size: clamp(9px, .75vw, 11px); line-height: 1.5; }
        .tv-note { margin-top: 10px; padding: 9px 10px; color: #acc0da; background: rgba(4,18,43,.38); border-radius: 9px; font-size: 9px; line-height: 1.45; }
        .tv-note strong, .tv-note span { display: block; }
        .tv-note strong { margin-bottom: 2px; color: #6fbdf2; font-size: 7px; letter-spacing: .8px; text-transform: uppercase; }
        .tv-task-card footer { display: flex; justify-content: space-between; gap: 8px; margin-top: 11px; padding-top: 9px; color: #7189a8; border-top: 1px solid rgba(167,205,245,.08); font-size: 8px; }
        .tv-empty { padding: 45px 15px; color: #7189a8; border: 1px dashed rgba(157,198,240,.14); border-radius: 14px; font-size: 11px; text-align: center; }
        .tv-footer { display: flex; align-items: center; justify-content: center; gap: 9px; color: #7189a8; font-size: 9px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; }
        .tv-footer .online-dot.sync-error { background: #e9a63a; box-shadow: 0 0 0 4px rgba(233,166,58,.14), 0 0 12px rgba(233,166,58,.45); }

        input, select, textarea { width: 100%; padding: 12px 13px !important; color: var(--text); background: rgba(247,251,255,.84) !important; border: 1px solid rgba(104,148,201,.22) !important; border-radius: 12px !important; outline: none; transition: .2s ease; }
        input::placeholder, textarea::placeholder { color: #a0aec3; }
        input:focus, select:focus, textarea:focus { background: #fff !important; border-color: rgba(79,143,247,.6) !important; box-shadow: 0 0 0 4px rgba(79,143,247,.1) !important; }
        textarea { resize: vertical; line-height: 1.55; }
        .btn-primary, .btn-secondary, .btn-success, .btn-danger { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: none; padding: 12px 19px; border-radius: 12px; cursor: pointer; font-size: 12px; font-weight: 800; transition: .22s ease; }
        .btn-primary { color: #fff; background: linear-gradient(135deg, #4f8ff7, #3d78db); box-shadow: 0 12px 25px rgba(55, 118, 216, .22); }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 16px 28px rgba(55, 118, 216, .3); }
        .btn-secondary { color: #496587; background: rgba(239,247,255,.75); border: 1px solid rgba(99,145,199,.18); }
        .btn-secondary:hover { color: var(--accent-strong); background: #fff; }
        .btn-success { color: #fff; background: linear-gradient(135deg, #52c8ae, #35aa91); box-shadow: 0 8px 20px rgba(53,170,145,.18); }
        .btn-danger { color: #bb536b; background: rgba(255,232,238,.8); border: 1px solid rgba(221,109,135,.13); }
        button:disabled { cursor: wait; opacity: .58; transform: none !important; }
        .team-member { display: grid; grid-template-columns: 43px 1fr auto; align-items: center; gap: 13px; padding: 15px; background: rgba(247,251,255,.75); border: 1px solid rgba(104,148,201,.14); border-radius: 16px; }
        .member-avatar { width: 54px; height: 54px; display: grid; place-items: center; color: #fff; background: linear-gradient(145deg, #83b6f5, #4f82cf); border: 3px solid rgba(255,255,255,.98); border-radius: 50%; box-shadow: 0 10px 24px rgba(49,94,154,.28); font-size: 16px; font-weight: 800; }
        .team-member strong { display: block; color: var(--dark); font-size: 13px; }
        .team-member p { margin: 2px 0; font-size: 10px; }
        .points-badge { color: var(--green); font-size: 10px; font-weight: 800; }
        .member-status { display: inline-flex; margin: 3px 8px 3px 0; padding: 4px 7px; border-radius: 999px; font-size: 8px; font-weight: 900; text-transform: uppercase; }
        .member-status.active { color: #268c77; background: rgba(190,241,228,.6); }
        .member-status.inactive { color: #667085; background: #edf1f5; }
        .team-member.member-inactive { opacity: .68; }
        .member-actions { display: flex; gap: 6px; }
        .member-actions { flex-wrap: wrap; justify-content: flex-end; }
        .team-management-workspace { display: flex; flex-direction: column; gap: 22px; }
        .team-management-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .team-management-header h2 { margin: 5px 0; font-size: 24px; text-transform: none; }
        .team-management-header p { font-size: 12px; }
        .team-management-grid { grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr); }
        .team-directory-panel > .panel-title-row strong { color: #315f91; font-size: 12px; }
        .team-groups { display: grid; gap: 18px; }
        .team-group { position: relative; display: grid; gap: 13px; padding: 17px; overflow: hidden; background: rgba(244,249,255,.74); border: 1px solid rgba(104,148,201,.16); border-radius: 19px; }
        .team-group::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: #5b96e6; }
        .team-group-juridico::before { background: #7d72d8; }
        .team-group-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-left: 3px; }
        .team-group-heading span { display: block; margin-bottom: 3px; color: #7084a1; font-size: 9px; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; }
        .team-group-heading h3 { color: #18365f; font-size: 15px; }
        .team-group-heading > strong { min-width: 31px; height: 31px; display: grid; place-items: center; color: #315f91; background: rgba(221,237,255,.88); border-radius: 10px; font-size: 12px; }
        .team-group-juridico .team-group-heading > strong { color: #6254b3; background: rgba(234,230,255,.9); }
        .team-group .team-list { gap: 10px; }
        .manager-primary-badge { display: inline-flex; margin: 3px 8px 3px 0; padding: 4px 7px; color: #315f91; background: #e2f0ff; border-radius: 999px; font-size: 8px; font-weight: 900; text-transform: uppercase; }
        .manager-primary-note { max-width: 190px; color: #607896; font-size: 9px; line-height: 1.45; text-align: right; }
        .team-tabs { display: flex; gap: 7px; padding: 5px; background: rgba(232,242,254,.78); border-radius: 14px; }
        .team-tabs button { padding: 10px 14px; color: var(--muted); background: transparent; border: 0; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 800; }
        .team-tabs button.active { color: #fff; background: linear-gradient(135deg, #4f8ff7, #3d78db); }
        .employee-profile-panel, .offboarding-panel { width: min(100%, 900px); }
        .employee-profile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .employee-profile-grid label, .employee-profile-panel > form > label, .offboarding-panel label { display: flex; flex-direction: column; gap: 7px; }
        .permission-fieldset { padding: 16px; border: 1px solid rgba(104,148,201,.18); border-radius: 14px; }
        .permission-fieldset legend { padding: 0 7px; color: var(--dark); font-size: 11px; font-weight: 800; }
        .permission-grid { display: flex; flex-wrap: wrap; gap: 12px; }
        .permission-grid label { display: flex; align-items: center; gap: 8px; padding: 9px 12px; background: rgba(238,247,255,.72); border-radius: 10px; font-size: 11px; }
        .permission-grid input { width: 17px !important; height: 17px; padding: 0 !important; }
        .auth-notice, .offboarding-summary { display: flex; flex-direction: column; gap: 4px; padding: 14px; color: #526b8b; background: rgba(225,239,255,.72); border-left: 3px solid var(--accent); border-radius: 11px; font-size: 11px; line-height: 1.55; }
        .auth-notice strong, .offboarding-summary strong { color: var(--dark); }
        .offboarding-panel > h2 { margin: 6px 0 20px; font-size: 24px; text-transform: none; }
        .automation-workspace, .process-workspace { display: flex; flex-direction: column; gap: 22px; }
        .automation-heading, .process-heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        .automation-heading h2, .process-heading h2 { margin: 5px 0; font-size: 26px; text-transform: none; }
        .automation-heading > strong { padding: 12px 16px; color: var(--accent-strong); background: var(--accent-soft); border-radius: 14px; }
        .automation-help { max-width: 760px; margin-top: 12px; padding: 11px 13px; color: #526b8b; background: rgba(232,242,254,.68); border: 1px solid rgba(104,148,201,.14); border-radius: 12px; font-size: 11px; line-height: 1.55; }
        .automation-grid, .process-grid { display: grid; grid-template-columns: minmax(320px,.75fr) minmax(0,1.25fr); gap: 22px; align-items: start; }
        .template-list, .process-list { display: grid; gap: 12px; }
        .template-card, .process-card { display: flex; justify-content: space-between; gap: 18px; padding: 16px; background: rgba(247,251,255,.8); border: 1px solid rgba(111,157,210,.14); border-radius: 16px; }
        .template-card.inactive { opacity: .55; }
        .template-card h3, .process-card h3 { margin: 8px 0 4px; font-size: 15px; }
        .template-card p, .process-card p { font-size: 11px; }
        .template-card small, .process-card small { color: var(--muted); font-size: 9px; }
        .template-actions, .process-card > div:last-child { min-width: 160px; display: flex; flex-direction: column; gap: 7px; }
        .process-metrics { display: flex; gap: 10px; }
        .process-metrics strong { min-width: 85px; padding: 12px; color: var(--dark); background: rgba(238,247,255,.9); border-radius: 14px; text-align: center; font-size: 20px; }
        .process-metrics span { display: block; color: var(--muted); font-size: 8px; text-transform: uppercase; }
        .process-search { max-width: 230px; }
        .process-card { border-left: 4px solid #e9a63a; }
        .process-card.risk-baixo { border-left-color: var(--green); }
        .process-card.risk-alto, .process-card.risk-critico { border-left-color: var(--danger); }
        .process-update-form { display: grid; grid-template-columns: 150px 150px 150px 1fr auto; gap: 9px; align-items: start; }
        .timeline-list { display: grid; gap: 12px; margin-top: 20px; }
        .timeline-list article { display: grid; grid-template-columns: 110px 1fr; gap: 16px; padding: 14px; border-left: 3px solid var(--accent); background: rgba(247,251,255,.8); border-radius: 12px; }
        .timeline-list time { color: var(--muted); font-size: 10px; }
        .timeline-list strong { color: var(--accent-strong); font-size: 10px; text-transform: uppercase; }
        .timeline-list p { font-size: 12px; }
        .processual-generator { display: flex; flex-direction: column; gap: 22px; }
        .processual-generator-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .processual-original-card { display: flex; align-items: center; gap: 22px; max-width: 820px; }
        .processual-original-card h3 { margin: 5px 0 8px; color: var(--dark); font-size: 20px; }
        .processual-original-card p { max-width: 620px; color: var(--muted); line-height: 1.6; }
        .processual-original-icon { display: grid; place-items: center; width: 88px; height: 104px; flex: 0 0 88px; color: #b42318; background: linear-gradient(145deg, #fff, #ffe7e3); border: 1px solid rgba(180,35,24,.18); border-radius: 18px; box-shadow: 0 14px 30px rgba(180,35,24,.12); font-size: 13px; font-weight: 900; }
        .processual-download { display: inline-flex; margin-top: 12px; text-decoration: none; }
        .processual-link-field { display: flex; flex-direction: column; gap: 7px; margin-top: 20px; color: var(--dark); font-size: 11px; font-weight: 800; }
        .processual-generator-heading h2 { margin: 5px 0; font-size: 28px; text-transform: none; }
        .processual-generator-heading p { font-size: 12px; }
        .processual-code { padding: 11px 14px; color: var(--accent-strong); background: var(--accent-soft); border-radius: 12px; font-size: 11px; font-weight: 800; white-space: nowrap; }
        .processual-input-grid { display: grid; grid-template-columns: minmax(340px,.85fr) minmax(400px,1.15fr); gap: 22px; align-items: start; }
        .processual-source { display: flex; flex-direction: column; gap: 10px; color: var(--dark); font-size: 13px; font-weight: 800; }
        .processual-source textarea { min-height: 430px; }
        .processual-preview-page { min-height: 640px; padding: 32px; color: #253a5c; background: #fff; border: 1px solid #dfe7f1; border-radius: 8px; box-shadow: 0 20px 55px rgba(25,65,120,.12); }
        .processual-preview-page header { padding-bottom: 20px; border-bottom: 2px solid #153c75; }
        .processual-preview-page header > span { color: var(--accent-strong); font-size: 10px; font-weight: 900; letter-spacing: 1.5px; }
        .processual-preview-page header h2 { margin: 9px 0; font-size: 17px; text-transform: uppercase; }
        .processual-preview-page header div { display: flex; justify-content: space-between; gap: 10px; font-size: 9px; }
        .processual-preview-page section { margin-top: 16px; }
        .processual-preview-page section h3 { margin-bottom: 10px; font-size: 11px; text-transform: uppercase; }
        .processual-preview-page section > p { font-size: 9px; }
        .processual-summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; }
        .processual-summary-grid p { margin: 0; font-size: 9px; line-height: 1.4; }
        .task-history-actions { display: flex; align-items: center; gap: 8px; }
        .pagination-numbered { justify-content: center; flex-wrap: wrap; margin-top: 18px; }
        .pagination-numbered .active { color: white; background: var(--accent-strong); border-color: var(--accent-strong); }
        .preview-process-block { margin-bottom: 16px; }
        .preview-process-block strong { color: #153c75; font-size: 10px; text-transform: uppercase; }
        .preview-process-block p { margin-top: 5px; color: #415674; font-size: 10px; line-height: 1.6; white-space: pre-wrap; }
        .processual-preview-page footer { margin-top: 18px; padding-top: 12px; border-top: 1px solid #dfe7f1; }
        .processual-preview-page footer p { margin-bottom: 6px; font-size: 7px; line-height: 1.4; }
        .processual-form-sections { display: grid; gap: 24px; }
        .processual-form-sections fieldset { padding: 18px; border: 1px solid rgba(104,148,201,.18); border-radius: 16px; }
        .processual-form-sections legend { padding: 0 8px; color: var(--dark); font-size: 12px; font-weight: 900; text-transform: uppercase; }
        .processual-form-sections label { display: flex; flex-direction: column; gap: 7px; color: var(--dark); font-size: 11px; font-weight: 800; }
        .processual-form-sections .span-2 { grid-column: 1 / -1; }
        .field-review { padding: 10px; background: #fff9e8; border: 1px solid #f2d691; border-radius: 12px; }
        .field-review small { color: #9a6815; font-size: 9px; }
        .attachment-picker { cursor: pointer; }
        .attachment-picker input { display: none; }
        .processual-attachments > small { color: var(--muted); }
        .attachment-list { display: grid; gap: 10px; margin-top: 16px; }
        .attachment-list article { display: grid; grid-template-columns: auto minmax(220px,1fr) 190px auto auto; gap: 10px; align-items: center; padding: 12px; background: rgba(247,251,255,.8); border-radius: 14px; }
        .attachment-list article > div:nth-child(2) { display: grid; gap: 7px; }
        .attachment-order { display: grid; justify-items: center; gap: 3px; }
        .attachment-order button { width: 25px; height: 22px; border: 0; border-radius: 6px; cursor: pointer; }
        .attachment-list article > label { display: flex; align-items: center; gap: 6px; font-size: 10px; }
        .attachment-list article > label input { width: 16px !important; height: 16px; padding: 0 !important; }
        .attachment-buttons { display: flex; gap: 6px; }
        .processual-final-actions { display: flex; justify-content: flex-end; gap: 10px; }
        .whatsapp-panel textarea { margin-bottom: 12px; }
        .report-list { display: grid; gap: 9px; }
        .report-list article { display: grid; grid-template-columns: 180px 1fr auto; gap: 12px; padding: 12px 14px; background: rgba(247,251,255,.8); border-radius: 12px; }
        .report-list article strong { color: var(--accent-strong); font-size: 11px; }
        .report-list article span { color: var(--dark); font-size: 11px; font-weight: 700; }
        .report-list article small { color: var(--muted); font-size: 9px; }
        .feedback-history-panel { grid-column: 1 / -1; }
        .feedback-list { display: grid; gap: 12px; }
        .feedback-card { position: relative; overflow: hidden; padding: 17px 18px; background: rgba(247,251,255,.82); border: 1px solid rgba(104,148,201,.15); border-radius: 16px; }
        .feedback-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 4px; background: #5da7ef; }
        .feedback-card.feedback-positivo::before { background: #43b99f; }
        .feedback-card.feedback-construtivo::before { background: #e6a84e; }
        .feedback-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 8px; }
        .feedback-card-heading span { color: var(--accent-strong); font-size: 10px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; }
        .feedback-card-heading time { color: var(--muted); font-size: 10px; white-space: nowrap; }
        .feedback-card strong { display: block; margin-bottom: 7px; color: var(--dark); font-size: 12px; }
        .feedback-card p { color: #4b607e; font-size: 13px; line-height: 1.65; white-space: pre-wrap; }
        .feedback-workspace .panel-title-row { align-items: flex-end; }
        .feedback-workspace .panel-title-row h2 { margin: 5px 0 0; }
        .feedback-intro { margin: -8px 0 20px; font-size: 13px; }
        .feedback-home-card { margin-top: 22px; }
        .feedback-home-trigger { width: 100%; min-height: 110px; }
        .feedback-home-trigger small { display: block; margin-top: 6px; color: var(--muted); font-size: 11px; }
        .feedback-home-content { display: grid; gap: 14px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(77,121,178,.12); }
        .feedback-home-content .task-history-actions { justify-content: space-between; }
        .monthly-admin-grid { display: grid; grid-template-columns: minmax(320px, .8fr) minmax(0, 1.2fr); gap: 22px; align-items: start; }
        .monthly-editor h2 { margin: 6px 0 8px; font-size: 24px; letter-spacing: -.7px; text-transform: none; }
        .monthly-intro { margin-bottom: 22px; font-size: 13px; line-height: 1.65; }
        .monthly-editor .stack-form label { display: flex; flex-direction: column; gap: 7px; }
        .monthly-textarea { min-height: 265px; }
        .form-helper { color: var(--muted); font-size: 10px; line-height: 1.5; }
        .monthly-preview { min-height: 510px; overflow: hidden; position: relative; }
        .monthly-preview::after, .monthly-employee-panel::after { content: ''; position: absolute; width: 260px; height: 260px; right: -110px; top: -130px; border-radius: 50%; background: radial-gradient(circle, rgba(87, 160, 248, .16), transparent 68%); pointer-events: none; }
        .monthly-preview .panel-title-row, .monthly-employee-panel .panel-title-row { position: relative; z-index: 1; }
        .monthly-preview .panel-title-row h2, .monthly-employee-panel .panel-title-row h2 { margin: 5px 0 0; font-size: 20px; letter-spacing: -.4px; text-transform: none; }
        .month-badge { flex: 0 0 auto; padding: 8px 12px; color: var(--accent-strong); background: rgba(220,237,255,.78); border: 1px solid rgba(79,143,247,.15); border-radius: 999px; font-size: 10px; font-weight: 800; }
        .monthly-list { display: grid; gap: 11px; margin: 0; padding: 0; list-style: none; }
        .monthly-list li { display: flex; align-items: center; gap: 13px; padding: 15px 16px; color: var(--text); background: rgba(247,251,255,.84); border: 1px solid rgba(104,148,201,.14); border-radius: 15px; }
        .monthly-list li > span { width: 29px; height: 29px; flex: 0 0 auto; display: grid; place-items: center; color: #fff; background: linear-gradient(145deg, #72acf1, #477fd2); border-radius: 10px; box-shadow: 0 7px 16px rgba(66,114,178,.18); font-size: 10px; font-weight: 800; }
        .monthly-list strong { color: var(--dark); font-size: 12px; line-height: 1.45; }
        .monthly-empty { padding: 34px 22px; color: var(--muted); background: rgba(241,248,255,.62); border: 1px dashed rgba(104,148,201,.25); border-radius: 16px; font-size: 12px; line-height: 1.6; text-align: center; }
        .employee-tasks-workspace { display: flex; flex-direction: column; gap: 22px; }
        .dashboard-planner-section { margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(104,148,201,.16); }
        .dashboard-planner-section::before { content: 'Planejamento pessoal'; display: block; margin-bottom: 12px; color: #4e7ec1; font-size: 10px; font-weight: 850; letter-spacing: .11em; text-transform: uppercase; }
        .unified-workspace-section { display: grid; gap: 14px; padding-top: 28px; border-top: 1px solid rgba(104,148,201,.18); }
        .unified-workspace-divider { display: flex; align-items: end; justify-content: space-between; gap: 20px; padding: 0 4px; }
        .unified-workspace-divider h2 { margin: 4px 0 5px; color: var(--dark); font-size: 22px; letter-spacing: -.5px; text-transform: none; }
        .unified-workspace-divider p { max-width: 610px; margin: 0; color: var(--muted); font-size: 12px; }
        .unified-workspace-divider > span { flex: 0 0 auto; padding: 7px 11px; color: #2b68c3; background: rgba(222,237,255,.78); border: 1px solid rgba(65,125,216,.17); border-radius: 999px; font-size: 9px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
        .monthly-employee-panel { position: relative; overflow: hidden; }
        .employee-monthly-list { grid-template-columns: repeat(2, minmax(0, 1fr)); position: relative; z-index: 1; }
        .resource-panel { overflow: hidden; position: relative; }
        .resource-panel::before { content: ''; position: absolute; inset: 0 0 auto; height: 3px; background: linear-gradient(90deg, #6cb4ff, #6dd5ed); }
        .resource-heading { display: flex; align-items: center; gap: 13px; margin-bottom: 18px; }
        .resource-heading .metric-icon { margin: 0; }
        .resource-heading h2 { margin: 0 0 3px; }
        .resource-heading p { font-size: 11px; }
        .resource-link { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; padding: 12px 13px; color: #506b8e; background: rgba(247,251,255,.8); border: 1px solid rgba(104,148,201,.15); border-radius: 12px; cursor: pointer; font-size: 11px; font-weight: 700; text-align: left; transition: .2s; }
        .resource-link:hover { color: var(--accent-strong); background: #fff; transform: translateX(2px); }
        .resource-link.primary { color: #fff; background: linear-gradient(135deg, #5a97ee, #4c83dc); }

        .toast-message { position: fixed; right: 28px; bottom: 28px; z-index: 1000; padding: 15px 20px; color: #fff; background: rgba(12,33,71,.94); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; box-shadow: 0 18px 45px rgba(12,33,71,.3); font-size: 12px; font-weight: 700; backdrop-filter: blur(18px); animation: slideUp .3s ease-out; }
        @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .document-workspace { display: flex; flex-direction: column; gap: 24px; }
        .document-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 28px; background: linear-gradient(145deg, rgba(255,255,255,.68), rgba(239,247,255,.42)); border: 1px solid rgba(255,255,255,.78); border-radius: 28px; box-shadow: 0 24px 70px rgba(44,86,145,.1), inset 0 1px 0 rgba(255,255,255,.94); backdrop-filter: blur(26px); }
        .document-heading-icon { width: 76px; height: 76px; flex: 0 0 76px; object-fit: contain; border-radius: 18px; filter: drop-shadow(0 12px 14px rgba(196,49,34,.2)); }
        .document-heading h2 { color: var(--dark); font-size: 34px; letter-spacing: 0; margin: 4px 0 6px; }
        .eyebrow { color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; }
        .document-number { color: var(--dark); background: rgba(255,255,255,.68); border: 1px solid rgba(255,255,255,.85); border-radius: 18px; padding: 13px 17px; box-shadow: 0 12px 34px rgba(61,104,163,.08), inset 0 1px 0 rgba(255,255,255,.92); backdrop-filter: blur(20px); }
        .document-number span { display: block; color: var(--muted); font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
        .document-grid { display: grid; grid-template-columns: minmax(0, 1.28fr) minmax(360px, .82fr); gap: 24px; align-items: start; }
        .document-form { display: flex; flex-direction: column; gap: 24px; }
        .document-form fieldset { border: 0; padding: 0; }
        .document-form legend { color: var(--dark); font-size: 15px; font-weight: 800; margin-bottom: 14px; text-transform: uppercase; }
        .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .form-grid label { color: #475569; display: flex; flex-direction: column; font-size: 12px; font-weight: 700; gap: 6px; }
        .form-grid .span-2 { grid-column: span 2; }
        .form-grid textarea { line-height: 1.5; resize: vertical; }
        .template-summary { background: rgba(232,244,255,.75); border: 1px solid rgba(113,165,224,.18); border-radius: 12px; padding: 10px 12px; }
        .smart-summary { position: relative; overflow: hidden; border-radius: 18px; background: linear-gradient(145deg, rgba(255,255,255,.72), rgba(232,244,255,.55)); box-shadow: inset 0 1px 0 rgba(255,255,255,.95); }
        .doc-progress { height: 8px; overflow: hidden; margin: 12px 0 8px; background: rgba(174,199,230,.24); border-radius: 999px; }
        .doc-progress span { display: block; height: 100%; background: linear-gradient(90deg, #8dbbff, #2563eb); border-radius: inherit; box-shadow: 0 0 18px rgba(37,99,235,.25); transition: width .25s ease; }
        .smart-summary > strong { color: #2563eb; font-size: 11px; }
        .template-summary span { color: var(--dark); display: block; font-size: 11px; font-weight: 800; margin-bottom: 3px; text-transform: uppercase; }
        .template-summary p { font-size: 12px; }
        .form-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #b91c1c; font-size: 13px; padding: 10px 12px; }
        .document-actions { border-top: 1px solid var(--line); display: flex; justify-content: flex-end; gap: 10px; padding-top: 20px; }
        .pdf-preview { position: sticky; top: 112px; display: flex; flex-direction: column; gap: 16px; }
        .ai-support-card { padding: 18px; background: linear-gradient(145deg, rgba(255,255,255,.7), rgba(238,247,255,.48)); border: 1px solid rgba(255,255,255,.78); border-radius: 24px; box-shadow: 0 18px 50px rgba(44,86,145,.1), inset 0 1px 0 rgba(255,255,255,.94); backdrop-filter: blur(24px); }
        .ai-support-card h3 { margin: 3px 0 12px; color: #102a56; font-size: 18px; }
        .ai-support-card p { margin-top: 8px; padding: 10px 12px; color: #526b8b; background: rgba(255,255,255,.58); border: 1px solid rgba(255,255,255,.7); border-radius: 14px; font-size: 12px; line-height: 1.45; }
        .preview-page { aspect-ratio: 1 / 1.414; display: flex; flex-direction: column; padding: 28px; overflow: hidden; color: #334155; background: linear-gradient(145deg, rgba(255,255,255,.88), rgba(239,247,255,.68)); border: 1px solid rgba(255,255,255,.9); box-shadow: 0 28px 70px rgba(33,74,132,.15), inset 0 1px 0 rgba(255,255,255,.95); border-radius: 24px; backdrop-filter: blur(22px); }
        .live-preview-page { min-height: 580px; }
        .preview-brand-row { display: flex; align-items: center; gap: 12px; margin: 18px 0 24px; padding: 13px; background: rgba(255,255,255,.55); border: 1px solid rgba(255,255,255,.74); border-radius: 18px; }
        .preview-brand-row img { width: 42px; height: 42px; border-radius: 14px; object-fit: cover; box-shadow: 0 8px 22px rgba(37,99,235,.14); }
        .preview-brand-row strong, .preview-brand-row span { display: block; }
        .preview-brand-row strong { color: #102a56; letter-spacing: 2px; }
        .preview-brand-row span { color: #6b7c93; font-size: 8px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; }
        .live-field-list { display: grid; gap: 8px; width: 100%; margin: 18px 0; }
        .live-field-list div { padding: 10px 11px; background: rgba(248,251,255,.78); border: 1px solid rgba(196,216,242,.38); border-radius: 12px; text-align: left; }
        .live-field-list span, .live-field-list strong { display: block; }
        .live-field-list span { color: #7b8ca8; font-size: 8px; font-weight: 900; text-transform: uppercase; }
        .live-field-list strong { margin-top: 3px; color: #102a56; font-size: 11px; line-height: 1.35; }
        .preview-header { align-items: center; background: linear-gradient(135deg, #16396e, #285da4); color: white; display: flex; gap: 10px; margin: -28px -28px 18px; padding: 18px 24px; }
        .preview-header img { background: white; border-radius: 50%; height: 34px; object-fit: cover; width: 34px; }
        .preview-header strong, .preview-header span { display: block; }
        .preview-header span { font-size: 8px; opacity: 0.8; }
        .preview-meta { display: flex; justify-content: space-between; color: #64748b; font-size: 8px; text-transform: uppercase; }
        .preview-page h3 { color: var(--dark); font-size: 17px; margin: 22px 0; text-align: center; text-transform: uppercase; }
        .preview-section { border-top: 1px solid #e5effb; padding: 12px 0 4px; }
        .preview-section span, .preview-highlight span { color: var(--accent); display: block; font-size: 8px; font-weight: 800; margin-bottom: 5px; text-transform: uppercase; }
        .preview-section strong { color: var(--dark); font-size: 11px; }
        .preview-section p { display: -webkit-box; font-size: 9px; line-height: 1.5; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }
        .preview-highlight { align-items: center; background: #eff7ff; border-radius: 8px; display: flex; justify-content: space-between; margin-top: 12px; padding: 10px; }
        .preview-highlight span { margin: 0; }
        .preview-highlight strong { color: var(--dark); font-size: 12px; }
        .preview-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: auto; padding-top: 20px; }
        .preview-signatures span { border-top: 1px solid #94a3b8; color: #64748b; font-size: 8px; padding-top: 5px; text-align: center; }
        .template-preview-info { align-items: center; display: flex; flex: 1; flex-direction: column; justify-content: center; text-align: center; }
        .template-preview-info > span { color: var(--accent); font-size: 9px; font-weight: 800; text-transform: uppercase; }
        .template-preview-info h3 { margin: 14px 0; }
        .template-preview-info p { font-size: 10px; margin-bottom: 18px; }
        .template-preview-info strong { background: #eff7ff; border-radius: 8px; color: var(--dark); font-size: 9px; padding: 9px; word-break: break-all; }
        .preview-note { font-size: 11px; margin-top: 12px; text-align: center; }

        .planner-workspace { display: flex; flex-direction: column; gap: 22px; }
        .planner-header { position: relative; overflow: hidden; padding: 30px; }
        .planner-header::after { content: ''; position: absolute; width: 260px; height: 260px; right: -90px; top: -120px; border-radius: 50%; background: radial-gradient(circle, rgba(107, 183, 255, .22), transparent 68%); pointer-events: none; }
        .planner-header h2 { margin: 5px 0 7px; color: var(--dark); font-size: 28px; letter-spacing: -1px; text-transform: none; }
        .planner-header > p { max-width: 580px; font-size: 13px; }
        .planner-form { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(190px, .6fr) minmax(260px, 1.5fr) auto; gap: 12px; margin-top: 24px; }
        .planner-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
        .planner-column { min-height: 330px; padding: 21px; background: rgba(255,255,255,.58); border: 1px solid rgba(255,255,255,.86); border-radius: 22px; box-shadow: 0 18px 45px rgba(53, 96, 154, .09); backdrop-filter: blur(18px); }
        .planner-avisos { --column-color: #6fa8ed; --column-soft: rgba(111,168,237,.13); }
        .planner-metas { --column-color: #7d91e8; --column-soft: rgba(125,145,232,.13); }
        .planner-cronograma { --column-color: #55b9d5; --column-soft: rgba(85,185,213,.13); }
        .planner-column-title { display: flex; align-items: center; gap: 11px; margin-bottom: 19px; padding-bottom: 15px; border-bottom: 1px solid rgba(108,151,204,.13); }
        .planner-dot { width: 38px; height: 38px; flex: 0 0 auto; border-radius: 13px; background: var(--column-soft); border: 1px solid color-mix(in srgb, var(--column-color) 22%, transparent); box-shadow: inset 0 1px rgba(255,255,255,.8); }
        .planner-dot::after { content: ''; display: block; width: 9px; height: 9px; margin: 14px; border-radius: 50%; background: var(--column-color); box-shadow: 0 0 12px var(--column-color); }
        .planner-column-title span:not(.planner-dot) { display: block; margin-bottom: 2px; color: var(--column-color); font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
        .planner-column-title h3 { color: var(--dark); font-size: 14px; }
        .planner-empty { padding: 34px 10px; color: #8a9bb2; font-size: 12px; text-align: center; }
        .note-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; margin-bottom: 10px; padding: 13px 12px; background: rgba(255,255,255,.82); border: 1px solid rgba(104,148,201,.13); border-left: 3px solid var(--note-accent); border-radius: 13px; box-shadow: 0 7px 20px rgba(48,91,148,.06); transition: .2s ease; }
        .note-card:hover { transform: translateY(-2px); background: #fff; box-shadow: 0 11px 25px rgba(48,91,148,.1); }
        .note-card.completed { opacity: .56; }
        .note-card.completed .note-text { text-decoration: line-through; }
        .note-check { width: 17px !important; height: 17px; padding: 0 !important; accent-color: var(--note-accent); cursor: pointer; box-shadow: none !important; }
        .note-text { color: #435a79; font-size: 12px; line-height: 1.45; }
        .note-delete { width: 27px; height: 27px; color: #9aabc0; background: transparent; border: 0; border-radius: 8px; cursor: pointer; font-size: 17px; line-height: 1; transition: .2s; }
        .note-delete:hover { color: #c3536f; background: rgba(255,231,237,.8); }
        .loading-state { padding: 28px; color: var(--muted); text-align: center; }

        @media (max-width: 1024px) {
          .app-layout { display: block; }
          .sidebar { height: auto; position: sticky; top: 10px; flex-wrap: wrap; padding: 12px; }
          .sidebar nav { display: flex; flex-wrap: wrap; justify-content: flex-start; }
          .nav-label { display: none; }
          .nav-item { justify-content: center; }
          .sidebar-logout { position: relative; right: auto; top: auto; width: auto; margin-left: auto; }
          .cards-grid { grid-template-columns: repeat(2, 1fr); }
          .content-grid { grid-template-columns: 1fr; }
          .monthly-admin-grid { grid-template-columns: 1fr; }
          .planner-grid { grid-template-columns: 1fr; }
          .task-editor-grid { grid-template-columns: 1fr; }
          .tv-topbar { grid-template-columns: 1fr auto; }
          .tv-summary { grid-column: 1 / -1; grid-row: 2; }
          .tv-clock { grid-column: 2; grid-row: 1; }
          .tv-board { grid-template-columns: 1fr; overflow: visible; }
          .tv-column { min-height: 360px; }
          .task-item { flex-direction: column; align-items: flex-start; }
          .document-grid { grid-template-columns: 1fr; }
          .pdf-preview { margin: 0 auto; max-width: 480px; position: static; width: 100%; }
          .login-page { grid-template-columns: 1fr; }
          .login-showcase { display: none; }
          .login-card { max-width: 480px; margin: auto; }
          .login-page-liquid { grid-template-columns: minmax(0, 1fr) minmax(350px, 430px); gap: 24px; padding: 28px; }
          .login-page-liquid .login-showcase { display: flex; min-height: 560px; }
          .hero-content h2 { font-size: clamp(44px, 5.8vw, 62px); }
          .brand-emblem-showcase { left: 60%; top: 43%; width: min(18vw, 170px); opacity: .26; }
          .showcase-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: 420px; gap: 12px; }
          .metric-card, .showcase-stats > div { min-height: 118px; padding: 14px; }
        }

        @media (max-width: 640px) {
          .main-content { padding: 16px; }
          .sidebar { align-items: stretch; }
          .sidebar nav { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); }
          .nav-item { justify-content: flex-start; }
          .sidebar-logout { position: static; }
          .topbar { align-items: flex-start; flex-direction: column; padding: 20px; }
          .topbar-actions { width: 100%; justify-content: space-between; }
          .profile-pill { flex: 1; width: auto; }
          .cards-grid { grid-template-columns: 1fr; }
          .card { min-height: 145px; }
          .task-actions, .member-actions { width: 100%; }
          .task-management-header, .task-list-heading, .admin-task-card { align-items: flex-start; flex-direction: column; }
          .task-management-actions, .task-list-controls, .admin-task-actions { width: 100%; }
          .task-bulk-toolbar { align-items: stretch; flex-direction: column; }
          .task-bulk-toolbar > div { flex-wrap: wrap; }
          .task-management-actions button, .admin-task-actions button { flex: 1; }
          .task-list-controls select { flex: 1; min-width: 0; }
          .task-form-row { grid-template-columns: 1fr; }
          .employee-monthly-list { grid-template-columns: 1fr; }
          .team-member { grid-template-columns: 43px 1fr; }
          .member-actions, .manager-primary-note { grid-column: span 2; }
          .manager-primary-note { max-width: none; text-align: left; }
          .team-management-header { align-items: stretch; flex-direction: column; }
          .team-tabs { flex-direction: column; }
          .employee-profile-grid { grid-template-columns: 1fr; }
          .automation-heading, .process-heading, .template-card, .process-card { align-items: stretch; flex-direction: column; }
          .automation-grid, .process-grid { grid-template-columns: 1fr; }
          .process-update-form { grid-template-columns: 1fr; }
          .processual-generator-heading { align-items: stretch; flex-direction: column; }
          .processual-original-card { align-items: flex-start; flex-direction: column; }
          .processual-input-grid { grid-template-columns: 1fr; }
          .attachment-list article { grid-template-columns: 1fr; }
          .attachment-order { display: flex; justify-content: flex-start; align-items: center; }
          .report-list article { grid-template-columns: 1fr; }
          .document-heading { align-items: flex-start; flex-direction: column; }
          .document-number { width: 100%; }
          .form-grid { grid-template-columns: 1fr; }
          .form-grid .span-2 { grid-column: span 1; }
          .document-actions { flex-direction: column-reverse; }
          .document-actions button { width: 100%; }
          .planner-header { padding: 23px; }
          .planner-form { grid-template-columns: 1fr; }
          .planner-form button { width: 100%; }
          .tv-page { padding: 14px; }
          .tv-topbar { grid-template-columns: 1fr; gap: 14px; }
          .tv-clock { grid-column: 1; grid-row: auto; text-align: left; }
          .tv-summary { grid-column: 1; grid-row: auto; }
          .tv-controls { justify-content: flex-start; margin-top: 0; }
          .tv-brand h1 { font-size: 18px; }
          .login-page { padding: 18px; }
          .login-card { padding: 30px 23px; border-radius: 24px; }
          .showcase-stats { gap: 18px; }
          .login-page-liquid { min-height: 100svh; display: flex; flex-direction: column; justify-content: center; padding: 20px; }
          .login-page-liquid::before { inset: 8px; border-radius: 22px; }
          .login-page-liquid .login-showcase { display: flex; min-height: auto; width: 100%; padding: 16px 4px 0; }
          .hero-content .floating-badge, .hero-content h2, .hero-content > p, .brand-emblem-showcase, .showcase-stats { display: none; }
          .glass-card { max-width: 460px; padding: 30px 22px; border-radius: 28px; }
          .login-brand { margin-bottom: 30px; }
          .login-brand div strong { font-size: 25px; letter-spacing: 5px; }
          .login-brand div span { font-size: 8px; letter-spacing: 1.8px; }
          .brand-badge { width: 62px; height: 62px; border-radius: 20px; }
          .login-footer { position: static; justify-content: center; width: 100%; font-size: 11px; }
          .login-footer-right { margin-top: -8px; }
        }


        /* =====================================================
           LOGIN PLATINO — VERSÃO IGUAL AO MODELO DA REFERÊNCIA
           Imagem esperada em: public/assets/platino-login-background.png
        ===================================================== */
        .login-page-liquid {
          min-height: 100svh !important;
          width: 100% !important;
          position: relative !important;
          overflow: hidden !important;
          display: grid !important;
          grid-template-columns: minmax(560px, 1fr) minmax(500px, 620px) !important;
          align-items: stretch !important;
          gap: clamp(36px, 5vw, 86px) !important;
          padding: clamp(44px, 5.2vw, 78px) clamp(46px, 5.6vw, 96px) !important;
          color: #102a56 !important;
          isolation: isolate !important;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.66) 22%, rgba(255,255,255,0.16) 46%, rgba(255,255,255,0.46) 69%, rgba(255,255,255,0.88) 100%),
            radial-gradient(circle at 8% 16%, rgba(255,255,255,0.92), transparent 28%),
            radial-gradient(circle at 86% 48%, rgba(240,248,255,0.82), transparent 35%),
            url('/assets/platino-login-background.png') right center / auto 100% no-repeat !important;
        }

        .login-page-liquid::before {
          content: "" !important;
          position: absolute !important;
          inset: 8px !important;
          z-index: 0 !important;
          pointer-events: none !important;
          border-radius: 28px !important;
          border: 1px solid rgba(185, 207, 235, 0.52) !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.90),
            inset 0 -1px 0 rgba(37,99,235,0.05) !important;
        }

        .login-page-liquid::after {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: 0 !important;
          pointer-events: none !important;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.22), rgba(239,247,255,0.18)),
            radial-gradient(circle at 48% 45%, rgba(47,107,255,0.08), transparent 26%),
            radial-gradient(circle at 74% 50%, rgba(255,255,255,0.46), transparent 32%) !important;
        }

        .login-page-liquid .liquid-bg {
          display: block !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: 0 !important;
          pointer-events: none !important;
        }

        .login-page-liquid .ambient {
          position: absolute !important;
          border-radius: 999px !important;
          filter: blur(24px) !important;
          opacity: 0.62 !important;
        }

        .login-page-liquid .ambient-one {
          width: 360px !important;
          height: 360px !important;
          left: -120px !important;
          top: -130px !important;
          background: radial-gradient(circle, rgba(141,187,255,0.18), transparent 68%) !important;
        }

        .login-page-liquid .ambient-two {
          width: 460px !important;
          height: 460px !important;
          right: -160px !important;
          bottom: -170px !important;
          background: radial-gradient(circle, rgba(37,99,235,0.12), transparent 70%) !important;
        }

        .login-page-liquid .ambient-three,
        .login-page-liquid .orbital-line {
          display: none !important;
        }

        .login-page-liquid .login-showcase,
        .login-page-liquid .login-card,
        .login-page-liquid .login-footer {
          position: relative !important;
          z-index: 2 !important;
        }

        .login-page-liquid .login-showcase {
          grid-column: 1 !important;
          display: flex !important;
          min-height: calc(100svh - clamp(88px, 10.4vw, 156px)) !important;
          width: 100% !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: center !important;
          padding: clamp(20px, 2.8vw, 42px) 0 0 clamp(10px, 1vw, 18px) !important;
        }

        .login-page-liquid .brand-emblem-showcase {
          display: none !important;
        }

        .login-page-liquid .showcase-badge {
          display: inline-flex !important;
          align-items: center !important;
          gap: 10px !important;
          width: fit-content !important;
          margin-bottom: clamp(50px, 7vh, 78px) !important;
          padding: 12px 23px !important;
          color: #2563eb !important;
          background: rgba(255,255,255,0.60) !important;
          border: 1px solid rgba(255,255,255,0.76) !important;
          border-radius: 999px !important;
          box-shadow:
            0 18px 38px rgba(37,99,235,0.10),
            inset 0 1px 0 rgba(255,255,255,0.90) !important;
          backdrop-filter: blur(18px) !important;
          -webkit-backdrop-filter: blur(18px) !important;
          font-size: 12px !important;
          font-weight: 900 !important;
          letter-spacing: 1.7px !important;
        }

        .login-page-liquid .hero-content h2 {
          max-width: 455px !important;
          margin: 0 !important;
          color: #102a56 !important;
          font-size: clamp(50px, 4.7vw, 74px) !important;
          line-height: 0.96 !important;
          font-weight: 950 !important;
          letter-spacing: -2.4px !important;
          text-shadow: 0 12px 34px rgba(15,42,85,0.08) !important;
        }

        .login-page-liquid .hero-content h2::before,
        .login-page-liquid .hero-content h2::after,
        .login-page-liquid .hero-content > p::before {
          content: none !important;
        }

        .login-page-liquid .hero-content h2 span {
          color: #2563eb !important;
        }

        .login-page-liquid .hero-content > p {
          display: block !important;
          max-width: 420px !important;
          margin: 26px 0 0 !important;
          color: rgba(60, 83, 116, 0.78) !important;
          font-size: 17px !important;
          line-height: 1.55 !important;
          font-weight: 600 !important;
        }

        .login-page-liquid .showcase-stats {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(118px, 152px)) !important;
          gap: 24px !important;
          margin-top: auto !important;
          margin-bottom: 54px !important;
        }

        .login-page-liquid .showcase-stats > div {
          min-height: 172px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          padding: 24px 21px 22px !important;
          border-radius: 20px !important;
          background: rgba(255,255,255,0.48) !important;
          border: 1px solid rgba(255,255,255,0.70) !important;
          box-shadow:
            0 22px 42px rgba(36, 72, 118, 0.09),
            inset 0 1px 0 rgba(255,255,255,0.86) !important;
          backdrop-filter: blur(20px) saturate(126%) !important;
          -webkit-backdrop-filter: blur(20px) saturate(126%) !important;
        }

        .login-page-liquid .showcase-stats svg {
          color: #2563eb !important;
        }

        .login-page-liquid .showcase-stats strong {
          color: #102a56 !important;
          font-size: 30px !important;
          font-weight: 950 !important;
          letter-spacing: -1px !important;
        }

        .login-page-liquid .showcase-stats span {
          color: #102a56 !important;
          font-size: 10px !important;
          line-height: 1.35 !important;
          font-weight: 950 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.2px !important;
        }

        .login-page-liquid .showcase-stats > div::after {
          content: "" !important;
          width: 26px !important;
          height: 3px !important;
          margin-top: 12px !important;
          border-radius: 999px !important;
          background: #2563eb !important;
          box-shadow: 0 0 14px rgba(37,99,235,0.28) !important;
        }

        .login-page-liquid .login-card {
          grid-column: 2 !important;
          justify-self: end !important;
          align-self: center !important;
          width: 100% !important;
          max-width: 620px !important;
          min-height: min(78svh, 790px) !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          position: relative !important;
          z-index: 2 !important;
          padding: clamp(48px, 4.5vw, 72px) clamp(48px, 4.3vw, 68px) !important;
          border-radius: 38px !important;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.58), rgba(235,246,255,0.36)) !important;
          border: 1px solid rgba(255,255,255,0.68) !important;
          box-shadow:
            0 38px 88px rgba(42, 82, 132, 0.15),
            0 14px 36px rgba(37, 99, 235, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.94),
            inset 0 -1px 0 rgba(37,99,235,0.06) !important;
          backdrop-filter: blur(30px) saturate(138%) !important;
          -webkit-backdrop-filter: blur(30px) saturate(138%) !important;
        }

        .login-page-liquid .login-card::before {
          content: "" !important;
          position: absolute !important;
          inset: 1px !important;
          border-radius: inherit !important;
          pointer-events: none !important;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.07) 42%, rgba(141,187,255,0.14)),
            radial-gradient(circle at 20% 0%, rgba(255,255,255,0.72), transparent 32%) !important;
        }

        .login-page-liquid .login-card > * {
          position: relative !important;
          z-index: 1 !important;
        }

        .login-page-liquid .login-brand {
          justify-content: center !important;
          gap: 18px !important;
          margin-bottom: clamp(44px, 5vh, 66px) !important;
        }

        .login-page-liquid .brand-badge {
          width: 74px !important;
          height: 74px !important;
          border-radius: 24px !important;
          object-fit: cover !important;
          background: rgba(255,255,255,0.62) !important;
          box-shadow:
            0 20px 36px rgba(37,99,235,0.14),
            0 0 26px rgba(141,187,255,0.32),
            inset 0 1px 0 rgba(255,255,255,0.88) !important;
        }

        .login-page-liquid .login-brand div strong {
          color: #102a56 !important;
          font-size: clamp(31px, 2.6vw, 43px) !important;
          font-weight: 700 !important;
          letter-spacing: 9px !important;
          line-height: 1 !important;
        }

        .login-page-liquid .login-brand div span {
          margin-top: 9px !important;
          color: #405979 !important;
          font-size: 8px !important;
          letter-spacing: 2.8px !important;
          font-weight: 900 !important;
        }

        .login-page-liquid .secure-badge {
          display: inline-flex !important;
          align-items: center !important;
          gap: 10px !important;
          width: fit-content !important;
          color: #2563eb !important;
          letter-spacing: 1.4px !important;
          font-size: 12px !important;
          font-weight: 950 !important;
        }

        .login-page-liquid .login-card h1 {
          max-width: 440px !important;
          margin: 24px 0 10px !important;
          color: #102a56 !important;
          font-size: clamp(32px, 2.6vw, 42px) !important;
          line-height: 1.05 !important;
          letter-spacing: -1.4px !important;
          font-weight: 950 !important;
        }

        .login-page-liquid .login-card > p {
          color: #667890 !important;
          font-size: 15px !important;
          font-weight: 600 !important;
        }

        .login-page-liquid .login-form {
          margin-top: 36px !important;
          gap: 22px !important;
        }

        .login-page-liquid .glass-field > span {
          color: #102a56 !important;
          font-size: 13px !important;
          font-weight: 900 !important;
        }

        .login-page-liquid .glass-input {
          min-height: 59px !important;
          padding: 0 17px !important;
          background: rgba(255,255,255,0.42) !important;
          border: 1px solid rgba(255,255,255,0.76) !important;
          border-radius: 17px !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.94),
            0 12px 28px rgba(47,107,255,0.055) !important;
        }

        .login-page-liquid .glass-input svg {
          color: #516986 !important;
        }

        .login-page-liquid .glass-input:focus-within {
          border-color: rgba(47,107,255,0.42) !important;
          box-shadow:
            0 0 0 4px rgba(47,107,255,0.08),
            inset 0 1px 0 rgba(255,255,255,0.96),
            0 14px 30px rgba(47,107,255,0.08) !important;
        }

        .login-page-liquid .forgot-password {
          appearance: none !important;
          align-self: flex-start !important;
          margin: -7px 0 0 !important;
          padding: 0 !important;
          color: #2563eb !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          cursor: pointer !important;
          font-size: 13px !important;
          font-weight: 850 !important;
        }

        .login-page-liquid .glass-button {
          min-height: 61px !important;
          margin-top: 10px !important;
          color: #ffffff !important;
          background:
            linear-gradient(135deg, #7fb5ff 0%, #3f83ff 48%, #2563eb 100%) !important;
          border: 1px solid rgba(255,255,255,0.66) !important;
          border-radius: 18px !important;
          box-shadow:
            0 20px 42px rgba(37,99,235,0.26),
            inset 0 1px 0 rgba(255,255,255,0.72),
            inset 0 -14px 24px rgba(15,42,85,0.17) !important;
          font-size: 16px !important;
          font-weight: 950 !important;
        }

        .login-page-liquid .button-png-icon {
          width: 23px !important;
          height: 23px !important;
          border-radius: 50% !important;
          object-fit: cover !important;
          box-shadow: 0 0 14px rgba(255,255,255,0.50) !important;
        }

        .login-page-liquid .glass-button:disabled {
          opacity: 0.76 !important;
          cursor: not-allowed !important;
          filter: grayscale(0.08) !important;
        }

        .login-page-liquid .login-separator {
          display: flex !important;
          align-items: center !important;
          gap: 16px !important;
          margin: 29px 0 18px !important;
          color: #5d718d !important;
          font-size: 12px !important;
          font-weight: 800 !important;
        }

        .login-page-liquid .login-separator::before,
        .login-page-liquid .login-separator::after {
          content: "" !important;
          flex: 1 !important;
          height: 1px !important;
          background: linear-gradient(90deg, transparent, rgba(91,126,170,0.22), transparent) !important;
        }

        .login-page-liquid .sso-button {
          min-height: 47px !important;
          align-self: center !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          padding: 0 24px !important;
          color: #102a56 !important;
          background: rgba(255,255,255,0.42) !important;
          border: 1px solid rgba(255,255,255,0.76) !important;
          border-radius: 14px !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.90),
            0 12px 24px rgba(37,99,235,0.08) !important;
          cursor: pointer !important;
          font-weight: 850 !important;
        }

        .login-page-liquid .login-card-softline {
          display: none !important;
        }

        .login-page-liquid .login-footer {
          z-index: 2 !important;
          color: rgba(73, 92, 120, 0.70) !important;
          text-shadow: 0 1px 0 rgba(255,255,255,0.76) !important;
        }

        .login-page-liquid .login-footer strong {
          color: #2563eb !important;
        }

        @media (max-width: 1200px) {
          .login-page-liquid {
            grid-template-columns: minmax(430px, 1fr) minmax(430px, 520px) !important;
            gap: 34px !important;
            padding: 34px !important;
            background:
              linear-gradient(90deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.50) 35%, rgba(255,255,255,0.72) 100%),
              url('/assets/platino-login-background.png') right center / auto 100% no-repeat !important;
          }

          .login-page-liquid .login-showcase {
            min-height: calc(100svh - 68px) !important;
          }

          .login-page-liquid .showcase-stats {
            grid-template-columns: repeat(3, minmax(104px, 1fr)) !important;
            gap: 15px !important;
          }

          .login-page-liquid .login-card {
            max-width: 520px !important;
            padding: 42px !important;
          }
        }

        @media (max-width: 920px) {
          .login-page-liquid {
            display: flex !important;
            min-height: 100svh !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 18px !important;
            background:
              linear-gradient(180deg, rgba(255,255,255,0.72), rgba(247,251,255,0.90)),
              url('/assets/platino-login-background.png') 38% center / cover no-repeat !important;
          }

          .login-page-liquid .login-showcase {
            display: none !important;
          }

          .login-page-liquid .login-card {
            grid-column: auto !important;
            justify-self: center !important;
            width: min(100%, 470px) !important;
            max-width: 470px !important;
            min-height: auto !important;
            padding: 32px 24px !important;
            border-radius: 29px !important;
            background: linear-gradient(145deg, rgba(255,255,255,0.82), rgba(241,248,255,0.70)) !important;
          }

          .login-page-liquid .login-footer {
            display: none !important;
          }

          .login-page-liquid .login-brand {
            margin-bottom: 30px !important;
          }

          .login-page-liquid .brand-badge {
            width: 62px !important;
            height: 62px !important;
            border-radius: 20px !important;
          }

          .login-page-liquid .login-brand div strong {
            font-size: 25px !important;
            letter-spacing: 5px !important;
          }
        }


        /* ===========================
           AJUSTES FINAIS LOGIN PLATINO
           Escrita limpa + botão corrigido + destaques azuis
        =========================== */

        .login-page-liquid {
          position: relative !important;
          overflow: hidden !important;
          min-height: 100vh !important;
          display: grid !important;
          grid-template-columns: 1.1fr 0.9fr !important;
          align-items: center !important;
          gap: 40px !important;
          padding: 42px 48px 70px !important;
          border-radius: 28px !important;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.72), rgba(245,249,255,0.80)),
            url("/assets/platino-login-background.png") center center / cover no-repeat !important;
          isolation: isolate !important;
        }

        .login-page-liquid::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: 0 !important;
          background:
            radial-gradient(circle at 28% 40%, rgba(45, 119, 255, 0.16), transparent 18%),
            radial-gradient(circle at 53% 56%, rgba(87, 171, 255, 0.14), transparent 20%),
            linear-gradient(90deg, rgba(255,255,255,0.28), rgba(255,255,255,0.18)) !important;
          pointer-events: none !important;
        }

        .login-page-liquid::after {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background:
            radial-gradient(circle at 30% 42%, rgba(45, 119, 255, 0.12), transparent 18%),
            radial-gradient(circle at 58% 50%, rgba(87, 171, 255, 0.10), transparent 20%),
            radial-gradient(circle at 68% 24%, rgba(77, 140, 255, 0.08), transparent 14%) !important;
          pointer-events: none !important;
          z-index: 0 !important;
        }

        .liquid-bg,
        .hero-content,
        .login-card,
        .login-footer {
          position: relative !important;
          z-index: 2 !important;
        }

        .liquid-bg { display: block !important; position: absolute !important; inset: 0 !important; pointer-events: none !important; }

        .hero-content { max-width: 520px !important; min-height: auto !important; padding-left: 0 !important; display: flex !important; flex-direction: column !important; justify-content: center !important; }
        .hero-content h2 { max-width: 540px !important; font-size: clamp(52px, 6vw, 76px) !important; line-height: 0.95 !important; font-weight: 900 !important; letter-spacing: -2px !important; color: #0d2b66 !important; margin: 0 0 22px !important; text-shadow: 0 18px 44px rgba(15,42,85,0.08) !important; }
        .hero-content h2 span { color: #2f6bff !important; }
        .hero-content h2::before,
        .hero-content h2::after,
        .hero-content > p::before,
        .showcase-stats > div strong::before,
        .showcase-stats > div span::before { content: none !important; display: none !important; }
        .hero-content > p { max-width: 460px !important; min-height: 0 !important; font-size: 18px !important; line-height: 1.6 !important; color: #667a96 !important; margin: 0 0 34px !important; font-weight: 500 !important; }
        .showcase-badge { display: inline-flex !important; align-items: center !important; gap: 10px !important; width: max-content !important; padding: 12px 18px !important; border-radius: 999px !important; background: rgba(255,255,255,0.58) !important; border: 1px solid rgba(255,255,255,0.8) !important; box-shadow: 0 12px 30px rgba(62, 95, 160, 0.08) !important; color: #2f6bff !important; font-size: 13px !important; font-weight: 700 !important; letter-spacing: 0.08em !important; margin-bottom: 28px !important; backdrop-filter: blur(10px) !important; }

        .brand-emblem-showcase { position: absolute !important; left: 36% !important; top: 52% !important; transform: translate(-50%, -50%) !important; width: min(720px, 62vw) !important; aspect-ratio: 1 / 1 !important; pointer-events: none !important; z-index: 1 !important; opacity: 0.92 !important; }
        .emblem-glass-plate { width: 100% !important; height: 100% !important; display: grid !important; place-items: center !important; background: transparent !important; border: 0 !important; box-shadow: none !important; overflow: visible !important; backdrop-filter: none !important; }
        .emblem-symbol { width: 100% !important; height: 100% !important; object-fit: contain !important; border-radius: 0 !important; opacity: 0.92 !important; filter: drop-shadow(0 0 22px rgba(58, 132, 255, 0.22)) drop-shadow(0 18px 42px rgba(44, 96, 192, 0.18)) !important; animation: floatSymbol 6s ease-in-out infinite !important; }
        .emblem-halo { position: absolute !important; inset: 18% !important; border-radius: 999px !important; background: radial-gradient(circle, rgba(74, 142, 255, 0.18), transparent 72%) !important; filter: blur(20px) !important; animation: pulseHalo 3.8s ease-in-out infinite !important; }
        .emblem-orbit { position: absolute !important; left: 50% !important; top: 50% !important; border-radius: 999px !important; border: 1px solid rgba(102, 157, 255, 0.18) !important; transform: translate(-50%, -50%) !important; }
        .orbit-a { width: 88% !important; height: 88% !important; inset: auto !important; }
        .orbit-b { width: 74% !important; height: 74% !important; inset: auto !important; }

        .showcase-stats { display: grid !important; grid-template-columns: repeat(3, minmax(90px, 1fr)) !important; gap: 34px !important; max-width: 480px !important; margin-top: 22px !important; position: relative !important; z-index: 3 !important; }
        .showcase-stat-card,
        .showcase-stats > div { min-height: auto !important; padding: 0 !important; border-radius: 0 !important; background: transparent !important; border: 0 !important; box-shadow: none !important; backdrop-filter: none !important; display: block !important; color: #102d67 !important; }
        .showcase-stats svg,
        .showcase-stat-card .ui-icon { display: none !important; }
        .showcase-stat-card strong,
        .showcase-stats > div strong { display: block !important; font-size: 22px !important; line-height: 1 !important; font-weight: 900 !important; color: #2f6bff !important; margin: 0 0 8px !important; letter-spacing: -0.2px !important; }
        .showcase-stat-card span,
        .showcase-stats > div span { display: block !important; color: #7f8da3 !important; font-size: 11px !important; line-height: 1.25 !important; font-weight: 700 !important; letter-spacing: 0 !important; text-transform: uppercase !important; }

        .login-card { justify-self: end !important; width: 100% !important; max-width: 470px !important; padding: 38px 42px !important; border-radius: 34px !important; background: rgba(255,255,255,0.58) !important; border: 1px solid rgba(255,255,255,0.82) !important; box-shadow: 0 28px 70px rgba(44, 84, 158, 0.12), inset 0 1px 0 rgba(255,255,255,0.9) !important; backdrop-filter: blur(18px) !important; }
        .login-brand { display: flex !important; align-items: center !important; gap: 16px !important; margin-bottom: 26px !important; }
        .brand-badge-wrap { width: 68px !important; height: 68px !important; border-radius: 22px !important; display: grid !important; place-items: center !important; background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(241,247,255,0.72)) !important; border: 1px solid rgba(255,255,255,0.85) !important; box-shadow: 0 10px 26px rgba(43, 85, 167, 0.10), inset 0 1px 0 rgba(255,255,255,0.95) !important; flex: 0 0 auto !important; }
        .brand-badge { width: 48px !important; height: 48px !important; border-radius: 0 !important; object-fit: contain !important; image-rendering: auto !important; filter: drop-shadow(0 0 10px rgba(68, 148, 255, 0.20)) contrast(1.05) saturate(1.06) !important; box-shadow: none !important; }
        .login-brand strong,
        .login-brand div strong { display: block !important; font-size: 22px !important; line-height: 1 !important; letter-spacing: 0.22em !important; color: #102d67 !important; font-weight: 800 !important; }
        .login-brand span,
        .login-brand div span { display: block !important; margin-top: 4px !important; font-size: 11px !important; letter-spacing: 0.18em !important; text-transform: uppercase !important; color: #5f7391 !important; font-weight: 800 !important; }
        .secure-badge { display: inline-flex !important; align-items: center !important; gap: 8px !important; color: #2f6bff !important; font-size: 13px !important; font-weight: 800 !important; margin-bottom: 18px !important; }
        .login-card h1 { font-size: 34px !important; line-height: 1.05 !important; font-weight: 900 !important; color: #0f2b66 !important; margin: 0 0 10px !important; }
        .login-card p,
        .login-page-liquid .login-card > p { color: #6a7d97 !important; font-size: 17px !important; font-weight: 500 !important; margin-bottom: 26px !important; }
        .login-form,
        .login-page-liquid .login-form { display: flex !important; flex-direction: column !important; gap: 18px !important; margin-top: 0 !important; }
        .glass-field > span,
        .login-page-liquid .glass-field > span { display: block !important; font-size: 14px !important; font-weight: 700 !important; color: #18386d !important; margin-bottom: 10px !important; }
        .glass-input,
        .login-page-liquid .glass-input { display: flex !important; align-items: center !important; gap: 12px !important; padding: 0 14px !important; height: 56px !important; min-height: 56px !important; border-radius: 18px !important; background: rgba(255,255,255,0.52) !important; border: 1px solid rgba(197, 214, 241, 0.95) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,0.92) !important; }
        .glass-input .ui-icon,
        .login-page-liquid .glass-input svg { color: #6c7f9d !important; flex-shrink: 0 !important; }
        .glass-input input { flex: 1 !important; height: 100% !important; border: none !important; outline: none !important; background: transparent !important; color: #17376f !important; font-size: 15px !important; }
        .glass-input input::placeholder { color: #7a8ea8 !important; }
        .forgot-password,
        .login-page-liquid .forgot-password { display: inline-block !important; align-self: flex-start !important; margin-top: -6px !important; padding: 0 !important; font-size: 13px !important; font-weight: 700 !important; color: #2f6bff !important; text-decoration: none !important; background: transparent !important; border: 0 !important; box-shadow: none !important; cursor: pointer !important; }
        .login-submit,
        .login-page-liquid .glass-button.login-submit { margin-top: 4px !important; height: 58px !important; min-height: 58px !important; border: none !important; border-radius: 18px !important; background: linear-gradient(135deg, #7db1ff 0%, #3d7cff 48%, #205de9 100%) !important; color: #fff !important; font-size: 18px !important; font-weight: 800 !important; display: flex !important; align-items: center !important; justify-content: center !important; box-shadow: 0 14px 34px rgba(47, 107, 255, 0.28), inset 0 1px 0 rgba(255,255,255,0.55) !important; position: relative !important; overflow: hidden !important; cursor: pointer !important; gap: 0 !important; }
        .login-submit::before { content: "" !important; position: absolute !important; top: 0 !important; left: -40% !important; width: 36% !important; height: 100% !important; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent) !important; transform: skewX(-20deg) !important; animation: buttonShine 3.8s linear infinite !important; }
        .login-submit span { position: relative !important; z-index: 1 !important; }
        .button-png-icon { display: none !important; }
        .login-divider { display: flex !important; align-items: center !important; gap: 14px !important; margin-top: 2px !important; color: #7c8da5 !important; font-size: 13px !important; justify-content: center !important; }
        .login-divider::before,
        .login-divider::after { content: "" !important; height: 1px !important; flex: 1 !important; background: rgba(189, 204, 228, 0.88) !important; }
        .login-separator { display: none !important; }
        .sso-button,
        .login-page-liquid .sso-button { align-self: center !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; padding: 12px 20px !important; border-radius: 16px !important; border: 1px solid rgba(197, 214, 241, 0.95) !important; background: rgba(255,255,255,0.56) !important; color: #24497f !important; font-weight: 700 !important; cursor: pointer !important; box-shadow: none !important; min-height: auto !important; }

        .blue-focus { position: absolute !important; border-radius: 999px !important; filter: blur(30px) !important; opacity: 0.45 !important; pointer-events: none !important; animation: pulseGlow 4s ease-in-out infinite !important; }
        .blue-focus-one { width: 180px !important; height: 180px !important; left: 26% !important; top: 36% !important; background: radial-gradient(circle, rgba(59, 131, 246, 0.28), transparent 70%) !important; }
        .blue-focus-two { width: 140px !important; height: 140px !important; left: 46% !important; top: 62% !important; background: radial-gradient(circle, rgba(120, 196, 255, 0.24), transparent 70%) !important; }
        .glow-dot { position: absolute !important; width: 10px !important; height: 10px !important; border-radius: 999px !important; background: #79b7ff !important; box-shadow: 0 0 12px rgba(84, 161, 255, 0.8), 0 0 24px rgba(84, 161, 255, 0.45) !important; animation: pulseDot 2.8s ease-in-out infinite !important; }
        .dot-a { left: 5% !important; top: 62% !important; }
        .dot-b { left: 58% !important; top: 30% !important; animation-delay: 0.8s !important; }
        .dot-c { left: 72% !important; top: 80% !important; animation-delay: 1.5s !important; }
        .energy-line { position: absolute !important; border-radius: 999px !important; pointer-events: none !important; opacity: 0.55 !important; filter: blur(0.2px) !important; }
        .line-a { left: -4% !important; bottom: 16% !important; width: 42% !important; height: 4px !important; background: linear-gradient(90deg, transparent, rgba(107, 181, 255, 0.9), transparent) !important; transform: rotate(22deg) !important; animation: flowLine 6s linear infinite !important; }
        .line-b { right: 18% !important; top: 18% !important; width: 24% !important; height: 3px !important; background: linear-gradient(90deg, transparent, rgba(151, 212, 255, 0.8), transparent) !important; transform: rotate(-18deg) !important; animation: flowLineAlt 5s linear infinite reverse !important; }
        .login-footer { position: absolute !important; bottom: 22px !important; font-size: 13px !important; color: #7f91a9 !important; z-index: 3 !important; }
        .login-footer-left { left: 42px !important; }
        .login-footer-right { right: 42px !important; display: flex !important; align-items: center !important; gap: 8px !important; }
        .version-icon { width: 18px !important; height: 18px !important; border-radius: 999px !important; border: 1px solid rgba(47, 107, 255, 0.45) !important; box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.08) !important; }

        @keyframes pulseDot { 0%, 100% { transform: scale(1); opacity: 0.75; } 50% { transform: scale(1.8); opacity: 1; } }
        @keyframes pulseGlow { 0%, 100% { opacity: 0.28; transform: scale(1); } 50% { opacity: 0.48; transform: scale(1.08); } }
        @keyframes flowLine { 0% { opacity: 0.18; transform: translateX(0) rotate(22deg); } 50% { opacity: 0.75; } 100% { opacity: 0.18; transform: translateX(24px) rotate(22deg); } }
        @keyframes flowLineAlt { 0% { opacity: 0.18; transform: translateX(0) rotate(-18deg); } 50% { opacity: 0.75; } 100% { opacity: 0.18; transform: translateX(24px) rotate(-18deg); } }
        @keyframes buttonShine { 0% { left: -40%; } 100% { left: 130%; } }
        @keyframes floatSymbol { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes pulseHalo { 0%, 100% { opacity: 0.25; transform: scale(1); } 50% { opacity: 0.42; transform: scale(1.06); } }

        @media (max-width: 1200px) {
          .login-page-liquid { grid-template-columns: 1fr !important; padding: 28px 24px 70px !important; }
          .login-card { justify-self: center !important; max-width: 520px !important; }
          .hero-content { max-width: 100% !important; padding-top: 8px !important; }
          .brand-emblem-showcase { left: 50% !important; top: 48% !important; width: min(620px, 90vw) !important; opacity: 0.3 !important; }
          .showcase-stats { max-width: 100% !important; }
        }

        @media (max-width: 768px) {
          .hero-content h2 { font-size: 44px !important; }
          .showcase-stats { grid-template-columns: 1fr !important; }
          .login-card { padding: 28px 22px !important; }
          .login-footer { position: static !important; margin-top: 12px !important; }
        }

      

        /* =====================================================
           FUNDO MAIS NÍTIDO, AZUL E VALORIZADO — Platino Login
           Ajuste final aplicado no arquivo completo
        ===================================================== */

        .login-page-liquid {
          background:
            radial-gradient(circle at 36% 45%, rgba(47, 107, 255, 0.16), transparent 22%),
            radial-gradient(circle at 48% 58%, rgba(84, 176, 255, 0.14), transparent 24%),
            linear-gradient(135deg, rgba(250, 253, 255, 0.34), rgba(238, 246, 255, 0.42)) !important;
        }

        .login-page-liquid::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background: url("/assets/platino-login-background.png") center center / cover no-repeat !important;
          filter: brightness(0.96) contrast(1.22) saturate(1.32) !important;
          opacity: 1 !important;
          z-index: 0 !important;
          pointer-events: none !important;
        }

        .login-page-liquid::after {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background:
            radial-gradient(circle at 31% 45%, rgba(0, 102, 255, 0.12), transparent 20%),
            radial-gradient(circle at 44% 60%, rgba(80, 180, 255, 0.10), transparent 22%),
            radial-gradient(circle at 58% 32%, rgba(47, 107, 255, 0.08), transparent 18%),
            linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 48%, rgba(255,255,255,0.16)) !important;
          z-index: 1 !important;
          pointer-events: none !important;
        }

        .liquid-bg,
        .hero-content,
        .login-card,
        .login-footer {
          position: relative !important;
          z-index: 3 !important;
        }

        .brand-emblem-showcase {
          opacity: 1 !important;
        }

        .emblem-symbol {
          filter:
            drop-shadow(0 0 24px rgba(47, 107, 255, 0.34))
            drop-shadow(0 20px 48px rgba(20, 74, 160, 0.24))
            contrast(1.12)
            saturate(1.18) !important;
        }

        .blue-focus-one {
          opacity: 0.64 !important;
          background: radial-gradient(circle, rgba(35, 112, 255, 0.46), transparent 68%) !important;
        }

        .blue-focus-two {
          opacity: 0.60 !important;
          background: radial-gradient(circle, rgba(72, 184, 255, 0.38), transparent 68%) !important;
        }

        .glow-dot {
          width: 12px !important;
          height: 12px !important;
          background: #4fa8ff !important;
          box-shadow:
            0 0 14px rgba(47, 107, 255, 0.95),
            0 0 34px rgba(84, 180, 255, 0.65) !important;
        }

        .energy-line {
          opacity: 0.78 !important;
          filter: blur(0.1px) !important;
        }

        .line-a {
          background: linear-gradient(90deg, transparent, rgba(47, 137, 255, 0.95), rgba(153, 220, 255, 0.75), transparent) !important;
        }

        .line-b {
          background: linear-gradient(90deg, transparent, rgba(98, 190, 255, 0.85), transparent) !important;
        }

        .login-card {
          background: rgba(255, 255, 255, 0.48) !important;
          backdrop-filter: blur(18px) saturate(1.2) !important;
          box-shadow:
            0 34px 84px rgba(38, 92, 178, 0.17),
            inset 0 1px 0 rgba(255,255,255,0.92) !important;
        }

        .showcase-badge,
        .showcase-stat-card {
          background: rgba(255, 255, 255, 0.46) !important;
          backdrop-filter: blur(13px) saturate(1.12) !important;
        }

        .hero-content h2 {
          text-shadow: 0 14px 34px rgba(18, 54, 118, 0.08) !important;
        }

        .hero-content p {
          color: #5f7493 !important;
        }

        /* Login final: layout responsivo sem depender de mockup unico como fundo. */
        .login-page-liquid {
          min-height: 100svh !important;
          height: 100svh !important;
          overflow: hidden !important;
          display: grid !important;
          grid-template-columns: minmax(420px, 1fr) minmax(390px, 500px) !important;
          align-items: center !important;
          gap: clamp(36px, 6vw, 96px) !important;
          padding: clamp(28px, 4vw, 58px) clamp(28px, 5vw, 76px) !important;
          background:
            radial-gradient(circle at 42% 48%, rgba(47,107,255,0.13), transparent 20%),
            radial-gradient(circle at 18% 16%, rgba(141,187,255,0.28), transparent 30%),
            radial-gradient(circle at 86% 18%, rgba(255,255,255,0.96), transparent 32%),
            linear-gradient(135deg, #f8fbff 0%, #eef6ff 52%, #ffffff 100%) !important;
        }

        .login-page-liquid::before {
          content: "" !important;
          position: absolute !important;
          inset: 10px !important;
          border: 1px solid rgba(176,198,228,0.36) !important;
          border-radius: 26px !important;
          background:
            linear-gradient(120deg, rgba(255,255,255,0.62), rgba(255,255,255,0.14) 42%, rgba(141,187,255,0.10)),
            repeating-linear-gradient(115deg, transparent 0 92px, rgba(37,99,235,0.035) 93px 94px) !important;
          pointer-events: none !important;
          z-index: 0 !important;
        }

        .login-page-liquid .login-showcase {
          width: 100% !important;
          max-width: 620px !important;
          min-height: 0 !important;
          padding: 0 !important;
          justify-self: start !important;
          z-index: 2 !important;
        }

        .login-page-liquid .hero-content h2 {
          max-width: 560px !important;
          min-height: 0 !important;
          margin: 0 0 24px !important;
          font-size: 0 !important;
          letter-spacing: 0 !important;
          color: transparent !important;
        }

        .login-page-liquid .hero-content h2::after {
          display: none !important;
          content: none !important;
        }

        .login-page-liquid .hero-content > p {
          max-width: 560px !important;
          margin: 0 0 42px !important;
          color: #5f7493 !important;
          font-size: 18px !important;
          line-height: 1.55 !important;
        }

        .login-page-liquid .brand-emblem-showcase {
          left: auto !important;
          right: -6vw !important;
          top: 50% !important;
          width: clamp(220px, 28vw, 390px) !important;
          opacity: 0.18 !important;
          transform: translateY(-50%) !important;
          z-index: 1 !important;
        }

        .login-page-liquid .emblem-symbol {
          opacity: 1 !important;
          filter: drop-shadow(0 18px 40px rgba(47,107,255,0.18)) !important;
        }

        .login-page-liquid .showcase-stats {
          max-width: 500px !important;
          gap: clamp(18px, 3vw, 42px) !important;
          margin-top: 0 !important;
          position: relative !important;
          z-index: 3 !important;
        }

        .login-page-liquid .login-card {
          justify-self: end !important;
          max-width: 500px !important;
          min-height: auto !important;
          padding: clamp(34px, 4vw, 54px) !important;
          background: rgba(255,255,255,0.56) !important;
          border: 1px solid rgba(255,255,255,0.78) !important;
          backdrop-filter: blur(24px) saturate(1.18) !important;
          -webkit-backdrop-filter: blur(24px) saturate(1.18) !important;
        }

        .login-page-liquid .login-submit {
          gap: 0 !important;
        }

        .login-page-liquid .button-png-icon,
        .login-page-liquid .login-submit img {
          display: none !important;
        }

        @media (max-width: 1180px) {
          .login-page-liquid {
            grid-template-columns: minmax(340px, 1fr) minmax(360px, 440px) !important;
            gap: 28px !important;
            padding: 26px !important;
          }

          .login-page-liquid .brand-emblem-showcase {
            display: none !important;
          }

          .login-page-liquid .hero-content h2::before {
            font-size: clamp(42px, 5.6vw, 62px) !important;
          }
        }

        @media (max-width: 760px) {
          .login-page-liquid {
            height: auto !important;
            min-height: 100svh !important;
            overflow-y: auto !important;
            display: flex !important;
            justify-content: center !important;
            padding: 20px !important;
          }

          .login-page-liquid .login-showcase {
            display: none !important;
          }

          .login-page-liquid .login-card {
            width: 100% !important;
            max-width: 460px !important;
            padding: 28px 22px !important;
            border-radius: 28px !important;
          }

          .login-footer {
            display: none !important;
          }
        }

        /* Login minimalista */
        .login-page-liquid {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-height: 100svh !important;
          height: auto !important;
          padding: 32px 20px 76px !important;
          background: #f4f7fb !important;
          border-radius: 0 !important;
        }

        .login-page-liquid::before {
          inset: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: linear-gradient(180deg, #f8fafc 0%, #eef3f9 100%) !important;
          filter: none !important;
        }

        .login-page-liquid::after,
        .login-page-liquid .liquid-bg,
        .login-page-liquid .login-showcase,
        .login-page-liquid .brand-badge-wrap {
          display: none !important;
        }

        .login-page-liquid .login-card {
          width: min(100%, 430px) !important;
          max-width: 430px !important;
          min-height: auto !important;
          margin: 0 !important;
          padding: 42px 38px !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 22px !important;
          background: #ffffff !important;
          box-shadow: 0 18px 50px rgba(15, 42, 85, 0.08) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .login-page-liquid .login-card::before { display: none !important; }
        .login-page-liquid .login-brand { justify-content: flex-start !important; margin-bottom: 34px !important; }
        .login-page-liquid .login-brand div strong { font-size: 27px !important; letter-spacing: 6px !important; }
        .login-page-liquid .login-brand div span { margin-top: 7px !important; font-size: 8px !important; }
        .login-page-liquid .login-card h1 { font-size: 30px !important; }
        .login-page-liquid .glass-input { background: #f8fafc !important; border-color: #dbe3ee !important; box-shadow: none !important; }
        .login-page-liquid .login-footer { color: #8a98aa !important; }

        @media (max-width: 520px) {
          .login-page-liquid { padding: 18px !important; }
          .login-page-liquid .login-card { padding: 32px 24px !important; border-radius: 18px !important; }
          .login-page-liquid .login-footer { display: none !important; }
        }

        /* Composição final do login */
        .login-page-liquid {
          position: relative !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          justify-items: start !important;
          align-items: center !important;
          min-height: 100svh !important;
          padding: clamp(32px, 5vw, 74px) clamp(24px, 8vw, 148px) 82px !important;
          background: #f8fafc url('/assets/platino-login-background.png') center / cover no-repeat !important;
        }

        .login-page-liquid::after {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: 0 !important;
          pointer-events: none !important;
          background: linear-gradient(90deg, rgba(248,251,255,.38), rgba(248,251,255,.08) 52%, transparent 72%) !important;
        }

        .login-page-liquid .login-card {
          grid-column: 1 !important;
          justify-self: start !important;
          align-self: center !important;
          width: min(100%, 430px) !important;
          max-width: 430px !important;
          min-height: auto !important;
          padding: 42px 38px !important;
          border: 1px solid rgba(226,232,240,.94) !important;
          border-radius: 22px !important;
          background: rgba(255,255,255,.94) !important;
          box-shadow: 0 20px 54px rgba(15,42,85,.13) !important;
        }

        .login-page-liquid::before {
          display: block !important;
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          background: linear-gradient(90deg, rgba(255,255,255,.12), rgba(255,255,255,.06) 52%, rgba(255,255,255,.3)) !important;
          pointer-events: none !important;
        }

        .login-page-liquid .login-card {
          position: relative !important;
          z-index: 2 !important;
          justify-self: center !important;
          align-self: center !important;
          width: min(100%, 440px) !important;
          max-width: 440px !important;
          padding: 42px 40px 40px !important;
          overflow: hidden !important;
          border: 1px solid rgba(184, 199, 219, .72) !important;
          border-radius: 20px !important;
          background: rgba(255, 255, 255, .96) !important;
          box-shadow: 0 24px 70px rgba(21, 60, 117, .12), 0 2px 8px rgba(21, 60, 117, .04) !important;
        }

        .login-card-accent {
          position: absolute !important;
          z-index: 3 !important;
          inset: 0 0 auto !important;
          height: 4px !important;
          background: linear-gradient(90deg, #173f83, #3b82f6 54%, #78b7ff) !important;
        }

        .login-page-liquid .login-brand {
          justify-content: flex-start !important;
          margin: 0 0 40px !important;
        }

        .login-page-liquid .login-brand div strong {
          color: #102d5c !important;
          font-family: "Segoe UI", Arial, sans-serif !important;
          font-size: 24px !important;
          font-weight: 800 !important;
          letter-spacing: .08em !important;
        }

        .login-page-liquid .login-brand div span {
          margin-top: 7px !important;
          color: #8492a6 !important;
          font-size: 9px !important;
          font-weight: 800 !important;
          letter-spacing: .14em !important;
        }

        .login-heading { margin-bottom: 30px !important; }
        .login-heading > span { color: #316ed7 !important; font-size: 10px !important; font-weight: 900 !important; letter-spacing: .12em !important; text-transform: uppercase !important; }
        .login-page-liquid .login-heading h1 { margin: 10px 0 7px !important; color: #102d5c !important; font-size: 30px !important; font-weight: 800 !important; letter-spacing: -.04em !important; }
        .login-page-liquid .login-heading p { margin: 0 !important; color: #718096 !important; font-size: 14px !important; }

        .login-page-liquid .login-form { gap: 19px !important; margin: 0 !important; }
        .login-page-liquid .glass-field { gap: 8px !important; }
        .login-page-liquid .glass-field > span { margin: 0 !important; color: #284568 !important; font-size: 12px !important; font-weight: 800 !important; }
        .login-page-liquid .glass-input { height: 52px !important; min-height: 52px !important; padding: 0 15px !important; border: 1px solid #d7e0eb !important; border-radius: 12px !important; background: #f8fafc !important; box-shadow: none !important; }
        .login-page-liquid .glass-input:focus-within { border-color: #4d83dc !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, .1) !important; transform: none !important; }
        .login-page-liquid .glass-input svg { color: #7186a2 !important; }
        .login-page-liquid .glass-input input { height: auto !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; color: #162f52 !important; font-size: 14px !important; font-weight: 600 !important; }
        .login-page-liquid .forgot-password { align-self: flex-end !important; margin: -7px 0 0 !important; color: #356fd3 !important; font-size: 11px !important; font-weight: 700 !important; }
        .login-page-liquid .login-submit { height: 52px !important; min-height: 52px !important; margin-top: 4px !important; border-radius: 12px !important; background: linear-gradient(135deg, #2f73df, #1e5fc9) !important; box-shadow: 0 10px 24px rgba(37, 99, 201, .22) !important; font-size: 14px !important; font-weight: 800 !important; }
        .login-page-liquid .login-submit::before { display: none !important; }

        .login-page-liquid .login-footer-minimal {
          position: absolute !important;
          z-index: 3 !important;
          right: auto !important;
          bottom: 27px !important;
          left: 50% !important;
          display: flex !important;
          align-items: center !important;
          gap: 18px !important;
          width: max-content !important;
          margin: 0 !important;
          color: #8795a8 !important;
          font-size: 10px !important;
          transform: translateX(-50%) !important;
        }

        .login-page-liquid .login-footer-minimal span + span { padding-left: 18px !important; border-left: 1px solid #cbd5e1 !important; }
        .login-page-liquid .login-footer-minimal strong { color: #356fd3 !important; }

        /* Login enxuto: marca, credenciais e ação principal. */
        .login-page-liquid .login-card { width: min(100%, 420px) !important; padding: 36px 36px 34px !important; border-radius: 18px !important; background: rgba(255,255,255,.92) !important; box-shadow: 0 20px 40px rgba(15,42,85,.08) !important; }
        .login-page-liquid .login-brand { margin-bottom: 30px !important; }
        .login-page-liquid .login-brand div { display: flex; align-items: center; gap: 10px; }
        .login-page-liquid .login-brand div strong { font-size: 23px !important; letter-spacing: .06em !important; }
        .login-page-liquid .login-brand .login-workspace-badge { display: inline-flex !important; width: auto; margin: 0 !important; padding: 4px 8px; color: #356fd3 !important; background: #edf5ff; border: 1px solid #d9e9ff; border-radius: 999px; font-size: 9px !important; letter-spacing: .06em !important; line-height: 1; text-transform: uppercase; }
        .login-heading { margin-bottom: 24px !important; }
        .login-heading > span { display: none !important; }
        .login-page-liquid .login-heading h1 { margin: 0 0 7px !important; font-size: 29px !important; letter-spacing: -.035em !important; }
        .login-page-liquid .login-heading h1 span { display: inline; font-size: .8em; }
        .login-page-liquid .login-form { gap: 14px !important; }
        .login-page-liquid .floating-field { gap: 0 !important; }
        .login-page-liquid .floating-field .glass-input { height: 56px !important; min-height: 56px !important; }
        .floating-input-wrap { position: relative; display: flex; flex: 1; align-items: stretch; min-width: 0; height: 100%; }
        .login-page-liquid .floating-input-wrap input { width: 100%; height: 100% !important; padding: 14px 0 0 !important; }
        .floating-input-wrap > span { position: absolute; top: 50%; left: 0; color: #718096; font-size: 13px; font-weight: 600; pointer-events: none; transform: translateY(-50%); transition: .16s ease; }
        .floating-input-wrap input:focus + span, .floating-input-wrap input:not(:placeholder-shown) + span { top: 13px; color: #356fd3; font-size: 9px; font-weight: 800; letter-spacing: .02em; transform: translateY(-50%); }
        .password-visibility { display: grid; width: 34px; height: 34px; padding: 0; place-items: center; color: #7186a2; background: transparent; border: 0; border-radius: 9px; cursor: pointer; transition: .18s ease; }
        .password-visibility:hover { color: #2563eb; background: #edf5ff; }
        .password-visibility:focus-visible { outline: 3px solid rgba(59,130,246,.22); outline-offset: 1px; }
        .login-page-liquid .forgot-password { margin: -3px 0 3px !important; text-decoration: none; }
        .login-page-liquid .forgot-password:hover:not(:disabled) { color: #174fa8 !important; text-decoration: underline; }
        .login-page-liquid .login-submit { min-height: 54px !important; height: 54px !important; margin-top: 3px !important; border-radius: 10px !important; gap: 8px !important; transition: transform .18s ease, box-shadow .18s ease !important; }
        .login-page-liquid .login-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(37,99,201,.28) !important; }
        .login-page-liquid .login-submit:disabled { cursor: wait; opacity: .78; transform: none; }
        .login-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.45); border-top-color: #fff; border-radius: 50%; animation: loginSpin .7s linear infinite; }
        @keyframes loginSpin { to { transform: rotate(360deg); } }

        /* Gamificação semanal, devolução obrigatória e check-in documental */
        .sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
        .performance-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 5px; color: #79520a; background: linear-gradient(145deg, #fff7bd, #f6c84a); border: 1px solid rgba(207,148,25,.45); border-radius: 999px; box-shadow: 0 5px 14px rgba(190,132,17,.24), inset 0 1px 0 rgba(255,255,255,.9); font-size: 13px; line-height: 1; }
        .performance-badge.with-label { gap: 5px; height: 24px; padding: 0 8px; }
        .performance-badge.with-label strong { color: #79520a; font-size: 8px; font-weight: 900; letter-spacing: .55px; text-transform: uppercase; }
        .member-avatar-wrap { position: relative; width: 54px; height: 54px; flex: 0 0 auto; }
        .member-avatar-wrap .member-avatar { overflow: hidden; }
        .member-avatar-wrap .member-avatar img { width: 100%; height: 100%; object-fit: cover; image-rendering: auto; }
        .employee-avatar-sprite { width: 100%; height: 100%; display: block; background-image: url('/assets/equipe/avatares-equipe-2026.png'); background-repeat: no-repeat; background-size: 300% 200%; image-rendering: auto; transform: scale(1.08); }
        .member-avatar-wrap > .performance-badge { position: absolute; right: -8px; bottom: -7px; z-index: 2; }
        .member-avatar-wrap.compact { width: 64px; height: 64px; }
        .member-avatar-wrap.compact .member-avatar { width: 64px; height: 64px; border-radius: 50%; }
        .member-avatar-wrap.compact > .performance-badge { right: -7px; bottom: -8px; }
        .member-name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
        .member-name-row > strong { display: inline-block; }
        .member-details { min-width: 0; }
        .team-member.member-high-performance { border-color: rgba(225,174,55,.44); background: linear-gradient(135deg, rgba(255,252,230,.92), rgba(246,251,255,.82)); box-shadow: 0 12px 34px rgba(190,132,17,.1); }
        .weekly-performance { display: flex; flex-direction: column; gap: 1px; margin-top: 8px; padding: 7px 9px; color: #2d7b69; background: rgba(216,247,236,.7); border-radius: 9px; }
        .weekly-performance strong { color: inherit; font-size: 9px; }
        .weekly-performance small { color: #648078; font-size: 8px; }
        .weekly-performance.has-loss { color: #b34c58; background: rgba(255,226,229,.72); }
        .profile-pill.profile-high-performance { border-color: rgba(225,174,55,.42); background: linear-gradient(135deg, rgba(255,251,222,.94), rgba(238,247,255,.92)); box-shadow: 0 10px 30px rgba(190,132,17,.1); }
        .profile-pill .performance-badge { display: inline-flex; width: max-content; margin-top: 5px; }
        .profile-pill .performance-badge > span { display: inline; margin: 0; color: #79520a; font-size: 12px; }
        .profile-pill .performance-badge strong { display: inline; }
        .status.devolvida { color: #a64250; background: rgba(255,222,226,.74); border: 1px solid rgba(198,69,86,.2); }
        .btn-return { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px; color: #fff; background: linear-gradient(135deg, #de6a77, #bd4657); border: 0; border-radius: 12px; box-shadow: 0 8px 20px rgba(189,70,87,.2); cursor: pointer; font-size: 11px; font-weight: 800; transition: .2s ease; }
        .btn-return:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 11px 24px rgba(189,70,87,.28); }
        .btn-return:disabled { opacity: .48; cursor: not-allowed; box-shadow: none; }
        .modal-backdrop { position: fixed; z-index: 9999; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(12,32,64,.5); backdrop-filter: blur(8px); }
        .return-modal { width: min(560px, 100%); padding: 26px; color: var(--text); background: rgba(255,255,255,.98); border: 1px solid rgba(255,255,255,.92); border-radius: 22px; box-shadow: 0 32px 90px rgba(13,37,76,.3); }
        .return-modal-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
        .return-modal-heading h2 { margin: 5px 0 3px; color: var(--dark); font-size: 21px; }
        .return-modal-heading p { margin: 0; font-size: 12px; }
        .modal-close { width: 34px; height: 34px; color: #5d7089; background: #edf4fb; border: 0; border-radius: 10px; cursor: pointer; font-size: 23px; line-height: 1; }
        .return-form label { gap: 7px; }
        .field-help, .field-ok { margin-top: -2px; font-size: 9px; }
        .field-help { color: #8b6870; }
        .field-ok { color: #278a72; }
        .return-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
        .return-alert { margin: 10px 0; padding: 12px 14px; color: #803642; background: linear-gradient(135deg, rgba(255,234,237,.92), rgba(255,246,241,.88)); border: 1px solid rgba(196,70,87,.18); border-left: 4px solid #cf5363; border-radius: 11px; }
        .return-alert > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .return-alert strong { color: #943c49; font-size: 11px; }
        .return-alert small { color: #9c6f76; font-size: 8px; }
        .return-alert p { margin: 5px 0 0; color: #76545a; font-size: 10px; line-height: 1.5; }
        .return-waiting { max-width: 145px; color: #a15560; font-size: 9px; font-weight: 800; line-height: 1.35; text-align: right; }
        .document-checklist { width: min(680px, 100%); margin-top: 16px; padding: 16px; background: linear-gradient(145deg, rgba(244,249,255,.95), rgba(255,255,255,.94)); border: 1px solid rgba(85,137,205,.2); border-radius: 15px; box-shadow: inset 0 1px 0 rgba(255,255,255,.9); }
        .document-checklist.complete { border-color: rgba(54,170,143,.3); background: linear-gradient(145deg, rgba(235,252,246,.95), rgba(255,255,255,.96)); }
        .document-checklist-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .document-checklist-heading h4 { margin: 3px 0 0; color: #183b69; font-size: 14px; }
        .checklist-progress { flex: 0 0 auto; padding: 5px 8px; color: #326dbd; background: #e4f0ff; border-radius: 999px; font-size: 9px; font-weight: 900; }
        .document-checklist.complete .checklist-progress { color: #247b67; background: #daf5ec; }
        .document-checklist-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .document-checklist-grid label { display: flex; align-items: center; gap: 9px; min-height: 38px; padding: 8px 10px; color: #536a86; background: rgba(255,255,255,.8); border: 1px solid rgba(104,148,201,.15); border-radius: 10px; cursor: pointer; font-size: 10px; font-weight: 750; }
        .document-checklist-grid label.checked { color: #247b67; background: rgba(222,249,240,.78); border-color: rgba(54,170,143,.28); }
        .document-checklist-grid input { width: 16px; height: 16px; accent-color: #35aa91; }
        .document-checklist > p { margin: 11px 0 9px; color: #718199; font-size: 9px; }
        .pop-delivery-checklist > label { display: grid; gap: 6px; margin-top: 11px; color: #35536f; font-size: 10px; font-weight: 800; }
        .pop-delivery-checklist > label input, .pop-delivery-checklist > label textarea { width: 100%; }
        .drive-link-field { padding: 12px; background: rgba(232,243,255,.72); border: 1px solid rgba(75,132,201,.2); border-radius: 11px; }
        .drive-link-field small, .drive-link-filename { color: #6b8199; font-size: 9px; font-weight: 600; line-height: 1.45; }
        .drive-link-filename { display: block; margin: 8px 0 12px; overflow-wrap: anywhere; }
        .image-proof-link, .image-proof-pending { margin-top: 7px; }
        .image-proof-pending { display: block; color: #4f7196; font-size: 10px; font-weight: 700; }
        .completion-modal { width: min(720px, 100%); max-height: min(88svh, 840px); overflow: auto; }
        .completion-form { gap: 14px; }
        .completion-intro { display: grid; gap: 3px; padding: 12px 14px; color: #315574; background: linear-gradient(135deg, #edf7ff, #f8fbff); border: 1px solid rgba(75,132,201,.18); border-radius: 12px; }
        .completion-intro strong { color: #173d71; font-size: 12px; }
        .completion-intro span { font-size: 10px; line-height: 1.45; }
        .completion-modal .document-checklist { width: 100%; margin-top: 0; }
        .completion-image-field { display: grid; gap: 7px; padding: 13px; color: #35536f; background: #fbfdff; border: 1px dashed rgba(75,132,201,.3); border-radius: 12px; font-size: 11px; font-weight: 800; }
        .completion-image-field em { color: #718199; font-style: normal; font-weight: 600; }
        .completion-image-field input { width: 100%; padding: 9px; background: #fff; border: 1px solid rgba(75,132,201,.18); border-radius: 9px; font-size: 11px; }
        .completion-image-field small { color: #718199; font-size: 9px; font-weight: 600; line-height: 1.45; }
        .selected-proof-image { color: #247b67; font-size: 10px; overflow-wrap: anywhere; }
        .field-error { color: #b84252 !important; }
        .completion-actions { margin-top: 2px; }
        .drive-document-link { display: inline-flex; align-items: center; width: max-content; margin-top: 10px; padding: 8px 10px; color: #245c9f; background: rgba(228,240,255,.84); border: 1px solid rgba(73,128,196,.2); border-radius: 9px; font-size: 10px; font-weight: 800; text-decoration: none; }
        .drive-document-link:hover { color: #123f76; background: #dceeff; }
        .task-timeline { display: flex; align-items: flex-start; gap: 0; margin: 10px 0 12px; overflow-x: auto; }
        .task-timeline-step { position: relative; min-width: 92px; color: #a6b2c2; display: grid; gap: 3px; font-weight: 750; }
        .task-timeline-step:not(:last-child)::after { content: ""; position: absolute; left: 13px; right: -4px; top: 7px; height: 2px; background: #dce4ee; }
        .task-timeline-step span { position: relative; z-index: 1; color: #c2ccd8; }
        .task-timeline-step.done span { color: #357bd8; }
        .task-timeline-step.done:not(:last-child)::after { background: #77a9e8; }
        .central-home { display: grid; gap: 20px; }
        .welcome-summary { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 145px; padding: 27px 30px; overflow: hidden; color: #173962; background: linear-gradient(135deg, #f5f9ff 0%, #eef5ff 100%); border: 1px solid rgba(67,105,152,.13); border-left: 5px solid #4b83cf; border-radius: 20px; box-shadow: 0 14px 32px rgba(39,78,128,.08); }
        .welcome-summary::after { content: ""; position: absolute; width: 190px; height: 190px; right: -70px; top: -95px; border-radius: 50%; background: rgba(75,131,207,.08); pointer-events: none; }
        .welcome-summary > * { position: relative; z-index: 1; }
        .welcome-summary h2 { margin: 5px 0 7px; font-size: clamp(22px, 2.4vw, 32px); }
        .welcome-summary p { max-width: 760px; margin: 0; color: #526b8b; font-size: 15px; line-height: 1.6; }
        .welcome-summary.critical { background: linear-gradient(135deg, #fff7f8 0%, #fff0f2 100%); border-left-color: #d94b55; }
        .welcome-summary.urgent, .welcome-summary.warning { background: linear-gradient(135deg, #fffaf3 0%, #fff5e6 100%); border-left-color: #ed8b36; }
        .welcome-summary.success { background: linear-gradient(135deg, #f3fcf9 0%, #eaf8f3 100%); border-left-color: #35aa91; }
        .welcome-summary-ok { flex: none; padding: 9px 13px; color: #247b67; background: rgba(255,255,255,.72); border: 1px solid rgba(53,170,145,.2); border-radius: 999px; font-size: 12px; font-weight: 850; }
        .central-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .central-metric { text-align: left; cursor: pointer; border: 1px solid rgba(67,105,152,.12); }
        .central-metric strong { display: block; margin-top: 8px; font-size: 30px; color: #173962; }
        .central-metric.critical { border-left: 4px solid #d94b55; }
        .central-metric.urgent { border-left: 4px solid #ed8b36; }
        .central-metric.warning { border-left: 4px solid #e5bd3d; }
        .central-metric.success { border-left: 4px solid #35aa91; }
        .central-search { width: 100%; margin: 12px 0 18px; }
        .drive-client-field { position: relative; display: grid; gap: 7px; min-width: 0; }
        .drive-client-field > label { color: #284568; font-size: 11px; font-weight: 800; }
        .drive-client-combobox { position: relative; min-width: 0; }
        .drive-client-combobox .drive-folder-icon { position: absolute; z-index: 2; left: 14px; top: 50%; transform: translateY(-50%); font-size: 16px; pointer-events: none; }
        .drive-client-combobox input { width: 100%; min-height: 44px; margin: 0; padding-left: 42px; padding-right: 42px; }
        .drive-client-combobox.is-open input { border-color: #4c8ef7; box-shadow: 0 0 0 3px rgba(76,142,247,.12); }
        .drive-client-clear { position: absolute; z-index: 3; right: 8px; top: 50%; width: 32px; height: 32px; transform: translateY(-50%); border: 0; border-radius: 9px; background: transparent; color: #637b9a; font-size: 22px; cursor: pointer; }
        .drive-client-options { position: absolute; z-index: 80; top: calc(100% + 7px); left: 0; right: 0; display: grid; max-height: 310px; overflow-y: auto; padding: 7px; background: #fff; border: 1px solid rgba(60,112,182,.22); border-radius: 14px; box-shadow: 0 22px 52px rgba(25,65,117,.2); }
        .drive-client-options > p { padding: 14px; font-size: 11px; }
        .drive-client-options .drive-client-error { color: #b63e4a; }
        .drive-client-options button { display: flex; align-items: center; gap: 10px; min-height: 50px; padding: 9px 11px; text-align: left; background: transparent; border: 0; border-radius: 10px; cursor: pointer; }
        .drive-client-options button:hover, .drive-client-options button[aria-selected="true"] { background: #edf5ff; }
        .drive-client-options button > span:last-child { display: grid; gap: 2px; min-width: 0; }
        .drive-client-options strong, .drive-client-options small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .drive-client-options strong { color: #173962; font-size: 11px; }
        .drive-client-options small { color: #7182a0; font-size: 9px; }
        .drive-client-selected { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; background: #eff8f5; border: 1px solid rgba(50,165,137,.18); border-radius: 11px; }
        .drive-client-selected > span { display: grid; gap: 2px; }
        .drive-client-selected strong { color: #267563; font-size: 10px; }
        .drive-client-selected small { color: #66857d; font-size: 9px; }
        .drive-client-selected a { flex: 0 0 auto; color: #2f6fd0; font-size: 10px; font-weight: 800; }
        .drive-sync-summary { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; margin: 18px 0 6px; }
        .drive-sync-summary > div { display: grid; gap: 5px; padding: 14px; background: #f6faff; border: 1px solid rgba(69,119,183,.12); border-radius: 13px; }
        .drive-sync-summary span { color: #7182a0; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .7px; }
        .drive-sync-summary strong { color: #173962; font-size: 12px; }
        .drive-sync-success { margin: 12px 0 0; padding: 11px 13px; color: #247b67; background: #effaf6; border: 1px solid rgba(48,164,135,.18); border-radius: 11px; font-size: 11px; font-weight: 700; }
        .drive-clients-empty { display: grid; justify-items: center; gap: 8px; padding: 42px 20px; text-align: center; border: 1px dashed rgba(74,120,180,.25); border-radius: 14px; background: #f9fbfe; }
        .drive-clients-empty > span { font-size: 30px; }
        .drive-clients-empty strong { color: #173962; }
        .drive-clients-empty p { max-width: 460px; font-size: 11px; }
        .drive-client-status { width: max-content; padding: 5px 8px; color: #257963; background: #eaf8f3; border-radius: 999px; font-size: 9px; font-weight: 800; }
        .central-table { display: grid; gap: 8px; }
        .central-table-row { display: grid; grid-template-columns: 130px 1.1fr 1.5fr 150px 120px; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(247,250,254,.9); border: 1px solid rgba(79,126,184,.1); border-radius: 12px; }
        .central-table-row a { color: #2f6fd0; font-weight: 800; }
        .client-management-panel .panel-title-row { align-items: flex-start; }
        .client-row > div:first-child { display: grid; gap: 3px; }
        .client-row > div:first-child small { color: var(--muted); font-size: 9px; }
        .client-row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 9px; }
        .client-row-actions small { color: #8a6a26; font-size: 10px; }
        .client-editor { display: grid; gap: 16px; margin: 4px 0 22px; padding: 20px; background: linear-gradient(135deg, #f5f9ff, #fff); border: 1px solid rgba(66,123,200,.2); border-radius: 16px; box-shadow: 0 10px 24px rgba(34,76,128,.07); }
        .client-editor-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .client-editor-heading h3 { margin: 4px 0 0; color: var(--dark); }
        .client-editor-heading .model-library-close { color: #52677e; border-color: #dce4ed; }
        .client-editor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
        .client-editor-grid label { display: grid; gap: 6px; color: #284568; font-size: 11px; font-weight: 800; }
        .client-editor-grid .wide { grid-column: 1 / -1; }
        .client-editor-grid input { min-height: 42px; margin: 0; }
        .client-editor-help { margin: -4px 0 0; color: #617896; font-size: 11px; }
        .client-editor-actions { display: flex; justify-content: flex-end; gap: 9px; }
        .urgency-layout { display: grid; grid-template-columns: minmax(320px,.8fr) minmax(480px,1.5fr); gap: 18px; align-items: start; }
        .urgency-row { display: grid; grid-template-columns: 1fr auto; gap: 10px 16px; padding: 15px; border: 1px solid rgba(79,126,184,.13); border-left: 4px solid #ed8b36; border-radius: 13px; background: #fff; }
        .urgency-row.priority-critica { border-left-color: #d94b55; background: #fff8f8; }
        .urgency-row .task-history-actions { grid-column: 1 / -1; }
        .notification-list { display: grid; gap: 9px; }
        .notification-item { width: 100%; display: flex; gap: 12px; padding: 14px; text-align: left; background: #f7faff; border: 1px solid rgba(72,119,180,.12); border-radius: 13px; }
        .notification-item.unread { background: #edf5ff; border-color: rgba(48,111,208,.24); }
        .notification-item > span { color: #3981df; }
        .notification-item.read { opacity: .7; }
        .delegation-panel { position: relative; overflow: visible; }
        .delegation-sent { position: absolute; inset: 0; z-index: 8; display: grid; place-content: center; justify-items: center; gap: 12px; color: #195c49; background: rgba(242,253,248,.96); backdrop-filter: blur(8px); animation: delegationFade 1.8s ease both; }
        .delegation-sent span { font-size: 54px; animation: sendLetter 1s cubic-bezier(.2,.8,.2,1) both; }
        .quick-deadline { display: grid; gap: 9px; padding: 14px; background: rgba(239,246,255,.78); border: 1px solid rgba(68,126,201,.14); border-radius: 14px; }
        .quick-deadline > div { display: flex; flex-wrap: wrap; gap: 8px; }
        .quick-deadline small { color: #607896; font-weight: 700; }
        .advanced-toggle { width: max-content; padding: 0; color: #3977c8; background: transparent; border: 0; font-weight: 800; cursor: pointer; }
        .advanced-fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; padding: 14px; background: rgba(248,250,253,.86); border: 1px dashed rgba(81,125,181,.2); border-radius: 14px; }
        @keyframes sendLetter { 0% { transform: translate(-120px,45px) rotate(-16deg); opacity: 0; } 55% { opacity: 1; } 100% { transform: translate(0,0) rotate(0); } }
        @keyframes delegationFade { 0%,75% { opacity: 1; } 100% { opacity: 0; } }
        .checklist-confirmed { margin-top: 11px; padding: 9px 11px; color: #247b67; background: rgba(214,246,236,.82); border-radius: 9px; font-size: 10px; font-weight: 800; }

        @media (max-width: 520px) {
          .login-page-liquid { padding: 22px 16px 70px !important; }
          .login-page-liquid .login-card { padding: 36px 25px 30px !important; border-radius: 17px !important; }
          .login-page-liquid .login-brand { margin-bottom: 32px !important; }
          .login-page-liquid .login-footer-minimal { display: flex !important; bottom: 20px !important; }
          .document-checklist-grid { grid-template-columns: 1fr; }
          .central-metrics { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .welcome-summary { align-items: flex-start; flex-direction: column; min-height: 0; padding: 21px 19px; gap: 15px; }
          .welcome-summary .btn-primary { width: 100%; }
          .central-table-row { grid-template-columns: 1fr; }
          .drive-sync-summary { grid-template-columns: 1fr; }
          .drive-client-selected { align-items: flex-start; flex-direction: column; }
          .client-editor-grid { grid-template-columns: 1fr; }
          .client-editor-grid .wide { grid-column: auto; }
          .client-row-actions { justify-content: flex-start; }
          .urgency-layout { grid-template-columns: 1fr; }
          .task-action-picker { grid-template-columns: repeat(2, minmax(0,1fr)); }
          .task-action-chip { min-height: 62px; padding: 10px; }
          .task-auto-title { align-items: flex-start; flex-direction: column; gap: 4px; }
          .task-auto-title strong { text-align: left; }
          .priority-picker { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); }
          .priority-choice { justify-content: center; }
          .advanced-fields { grid-template-columns: 1fr; }
          .return-modal { padding: 21px 17px; border-radius: 18px; }
          .return-modal-actions { flex-direction: column-reverse; }
          .return-modal-actions button { width: 100%; }
        }

        /* Estrutura responsiva final: prevalece sobre os estilos legados. */
        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { width: 100%; max-width: 100%; overflow-x: clip; }
        .app-layout { width: 100%; min-width: 0; }
        .sidebar { width: min(1600px, calc(100% - 32px)); max-width: 1600px; display: grid; grid-template-columns: auto minmax(0,1fr) auto; grid-template-areas: "brand navigation logout"; align-items: center; gap: 14px; margin: 14px auto 0; }
        .sidebar .brand { grid-area: brand; min-width: max-content; }
        .sidebar nav { grid-area: navigation; width: 100%; min-width: 0; display: grid; grid-template-columns: repeat(auto-fit,minmax(88px,1fr)); gap: 6px; }
        .sidebar nav .nav-label { display: none; }
        .sidebar-logout { grid-area: logout; min-width: max-content; }
        .nav-item { width: 100%; min-width: 0; padding: 9px 8px; line-height: 1.15; white-space: normal; }
        .nav-item > span:not(.nav-menu-popover) { min-width: 0; overflow-wrap: anywhere; }
        .main-content { width: min(1600px,100%); max-width: 1600px; min-width: 0; margin-inline: auto; }
        .main-content > *, .panel, .card, .task-item, .content-grid, .side-stack { min-width: 0; max-width: 100%; }
        .task-item { display: grid; grid-template-columns: minmax(0,1fr); align-items: start; gap: 14px; }
        .task-item > div:first-child { width: 100%; min-width: 0; }
        .task-actions { width: 100%; display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: 8px; padding-top: 12px; border-top: 1px solid rgba(92,137,192,.12); }
        .task-actions button { flex: 0 1 auto; min-height: 40px; white-space: normal; }
        .document-checklist { width: 100%; max-width: 760px; }
        .document-checklist input, .document-checklist textarea { max-width: 100%; }
        .employee-tasks-workspace .content-grid { grid-template-columns: minmax(0,1fr) minmax(260px,320px); }
        .central-table-row, .urgency-row { min-width: 0; overflow-wrap: anywhere; }

        @media (max-width: 1280px) {
          .sidebar { width: calc(100% - 20px); margin-top: 10px; border-radius: 22px; }
          .sidebar nav { grid-template-columns: repeat(5,minmax(86px,1fr)); }
          .main-content { padding-inline: 18px; }
          .employee-tasks-workspace .content-grid { grid-template-columns: minmax(0,1fr); }
          .unified-workspace-divider { align-items: flex-start; flex-direction: column; }
          .side-stack { width: 100%; }
        }

        @media (max-width: 900px) {
          .sidebar { position: relative; top: auto; grid-template-columns: minmax(0,1fr) auto; grid-template-areas: "brand logout" "navigation navigation"; padding: 12px; }
          .sidebar nav { grid-template-columns: repeat(3,minmax(0,1fr)); }
          .topbar { flex-direction: column; align-items: stretch; gap: 14px; }
          .topbar-actions { width: 100%; justify-content: space-between; }
          .profile-pill { flex: 1; width: auto; }
          .content-grid, .urgency-layout { grid-template-columns: minmax(0,1fr); }
          .task-form-row, .advanced-fields { grid-template-columns: minmax(0,1fr); }
        }

        @media (max-width: 600px) {
          .sidebar { width: calc(100% - 12px); margin-top: 6px; border-radius: 18px; }
          .sidebar .brand span { display: none; }
          .sidebar nav { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .nav-item { min-height: 46px; justify-content: flex-start; padding: 9px 10px; }
          .sidebar-logout { padding-inline: 11px; }
          .main-content { padding: 12px 8px 32px; }
          .topbar, .panel { padding: 16px; border-radius: 18px; }
          .task-item { padding: 14px; }
          .task-actions { display: grid; grid-template-columns: minmax(0,1fr); }
          .task-actions button { width: 100%; }
          .document-checklist { padding: 12px; }
          .central-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
          .central-metric { padding: 12px; }
          .central-metric strong { font-size: 24px; }
        }

        /* Login: posição lateral em telas amplas e leitura confortável nas menores. */
        .login-page-liquid {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          padding: clamp(32px, 5vw, 74px) clamp(28px, 7vw, 128px) 82px !important;
        }

        .login-page-liquid .login-card {
          grid-column: auto !important;
          justify-self: auto !important;
          margin: 0 !important;
        }

        @media (max-width: 880px) {
          .login-page-liquid {
            justify-content: center !important;
            padding: 32px 24px 76px !important;
            background-position: 64% center !important;
          }

          .login-page-liquid::after {
            background: rgba(248,251,255,.26) !important;
          }

          .login-page-liquid .login-card {
            width: min(100%, 430px) !important;
          }
        }

        @media (max-width: 520px) {
          .login-page-liquid {
            min-height: 100svh !important;
            padding: 22px 16px 70px !important;
            background-position: 60% center !important;
          }

          .login-page-liquid .login-card {
            width: 100% !important;
            padding: 32px 24px !important;
          }
        }

        /* Mantém a aparência dos campos mesmo com preenchimento automático do navegador. */
        .login-page-liquid .floating-input-wrap input {
          padding: 19px 0 2px !important;
          line-height: 1.2 !important;
        }

        .login-page-liquid .floating-input-wrap > span {
          top: 12px !important;
          font-size: 9px !important;
          font-weight: 800 !important;
          letter-spacing: .02em !important;
          transform: translateY(-50%) !important;
        }

        .login-page-liquid .floating-input-wrap input:-webkit-autofill,
        .login-page-liquid .floating-input-wrap input:-webkit-autofill:hover,
        .login-page-liquid .floating-input-wrap input:-webkit-autofill:focus,
        .login-page-liquid .floating-input-wrap input:-webkit-autofill:active {
          -webkit-text-fill-color: #102d5c !important;
          caret-color: #102d5c !important;
          -webkit-box-shadow: 0 0 0 1000px #f8fafc inset !important;
          box-shadow: 0 0 0 1000px #f8fafc inset !important;
          transition: background-color 9999s ease-out 0s !important;
        }

      `}</style>
      
      <Toast message={toastMessage} onClose={() => setToastMessage("")} />

      {modoRecuperacao ? (
        <RedefinirSenha onConcluida={() => setModoRecuperacao(false)} />
      ) : inicializando ? (
        <div className="login-page login-page-liquid">
          <section className="glass-card login-card loading-card" aria-label="Carregando Platino equipe">
            <div className="login-brand">
              <div>
                <strong>Platino equipe</strong>
                <span>Workspace Administrativo</span>
              </div>
            </div>
            <p>Carregando o workspace...</p>
          </section>
        </div>
      ) : !usuarioLogado ? (
        <Login onLogin={handleLogin} />
      ) : usuarioLogado.tipo === "admin" ? (
        <AdminDashboard usuario={usuarioLogado} onLogout={handleLogout} state={globais} />
      ) : (
        <EmployeeDashboard usuario={usuarioLogado} onLogout={handleLogout} state={globais} />
      )}
    </>
  );
}

