import MeuHistorico from './MeuHistorico';
import MeuPlanner from './MeuPlanner';
import GeradorDocumentos from './GeradorDocumentos';
import PainelEquipeTV from './PainelEquipeTV';
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

// ==========================================
// 1. CONFIGURAÇÕES E CONEXÕES
// ==========================================
const ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL || "tafarel@platino.com"
).toLowerCase();
const RESPONSABILIDADE_MENSAL_PREFIXO = "__RESPONSABILIDADE_MENSAL__";
const CATEGORIAS_TAREFA = [
  "GOV",
  "PROCURAÇÕES",
  "ENC. PROCESSUAL",
  "AUDIÊNCIA",
  "SEGUROS",
  "LAUDO",
  "NOTIFICAÇÃO EXTRAJUDICIAL",
];

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

  return { ...data, tipo: "funcionaria" };
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
  return status === "concluida" ? "Concluida" : "Pendente";
}

function rotuloPrioridade(prioridade) {
  if (prioridade === "urgente") return "Urgente";
  if (prioridade === "alta") return "Alta";
  return "Normal";
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
    historico: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
    planner: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 11h18" /><path d="m8 16 2 2 4-4" /></>,
    tv: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="m8 2 4 3 4-3" /><path d="M8 22h8" /></>,
    ranking: <><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4" /><path d="M17 6h3v2a4 4 0 0 1-4 4" /></>,
    feedback: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></>,
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
      <UiIcon name={icon} />
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
  const [carregando, setCarregando] = useState(false);

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

      <section className="hero-content login-showcase" aria-label="Apresentacao CeliOS">
        <div className="floating-badge showcase-badge">
          <UiIcon name="spark" size={18} />
          WORKSPACE INTELIGENTE
        </div>

        <h2>
          Gestão <span>inteligente.</span><br />
          Fluidez <span>operacional.</span>
        </h2>

        <p>
          Delegue tarefas, acompanhe sua equipe e gere documentos com precisão em um único ambiente.
        </p>

        <div className="brand-emblem-showcase" aria-hidden="true">
          <span className="emblem-orbit orbit-a" />
          <span className="emblem-orbit orbit-b" />
          <span className="emblem-halo" />
          <div className="emblem-glass-plate">
            <img
              src="/assets/celios-symbol.png"
              alt=""
              className="emblem-symbol"
            />
          </div>
        </div>

        <div className="showcase-stats">
          <div className="showcase-stat-card">
            <strong>01</strong>
            <span>Operação centralizada</span>
          </div>

          <div className="showcase-stat-card">
            <strong>24h</strong>
            <span>Visão contínua</span>
          </div>

          <div className="showcase-stat-card">
            <strong>PDF</strong>
            <span>Documentos automáticos</span>
          </div>
        </div>
      </section>

      <section className="glass-card login-card" aria-label="Login CeliOS">
        <div className="login-brand">
          <div className="brand-badge-wrap">
            <img
              src="/assets/celios-symbol.png"
              alt="CeliOS"
              className="brand-badge"
            />
          </div>
          <div>
            <strong>CeliOS</strong>
            <span>Enterprise Operating System</span>
          </div>
        </div>

        <span className="eyebrow secure-badge">
          <UiIcon name="spark" size={14} /> ACESSO SEGURO
        </span>

        <h1>Bem-vindo ao Workspace</h1>
        <p>Entre para acessar sua central administrativa.</p>

        <form className="login-form" onSubmit={fazerLogin}>
          <label className="glass-field">
            <span>E-mail corporativo</span>
            <div className="glass-input">
              <UiIcon name="equipe" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@empresa.com"
              />
            </div>
          </label>

          <label className="glass-field">
            <span>Senha</span>
            <div className="glass-input">
              <UiIcon name="logout" size={20} />
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha de acesso"
              />
            </div>
          </label>

          <a href="#" className="forgot-password">
            Esqueci minha senha
          </a>

          <button
            type="submit"
            className="glass-button full login-submit"
            disabled={carregando}
          >
            <span>{carregando ? "Autenticando..." : "Entrar no Workspace"}</span>
          </button>

          <div className="login-divider">
            <span>ou continue com</span>
          </div>

          <button type="button" className="sso-button">
            <UiIcon name="logout" size={14} />
            <span>SSO</span>
          </button>
        </form>

        <div className="login-card-softline" aria-hidden="true" />
      </section>

      <div className="login-footer login-footer-left">
        © 2026 <strong>CeliOS.</strong> Todos os direitos reservados.
      </div>

      <div className="login-footer login-footer-right">
        <span className="version-icon" />
        Versão 2.0.0
      </div>
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

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [funcId, setFuncId] = useState("");
  const [pontosTarefa, setPontosTarefa] = useState(10);
  const [dataLimite, setDataLimite] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [categoria, setCategoria] = useState(CATEGORIAS_TAREFA[0]);
  const [apontamento, setApontamento] = useState("");
  const [exibirTv, setExibirTv] = useState(true);
  const [tarefaManual, setTarefaManual] = useState(false);
  const [responsavelManual, setResponsavelManual] = useState("");

  const [feedbackFuncId, setFeedbackFuncId] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackTipo, setFeedbackTipo] = useState("positivo");
  const [enviandoFeedback, setEnviandoFeedback] = useState(false);
  const [responsabilidadeFuncId, setResponsabilidadeFuncId] = useState("");
  const [responsabilidadeMes, setResponsabilidadeMes] = useState(obterMesAtual);
  const [responsabilidadeTexto, setResponsabilidadeTexto] = useState("");
  const [salvandoResponsabilidades, setSalvandoResponsabilidades] =
    useState(false);

  const equipe = funcionarios.filter(
    (funcionario) => funcionario.email?.toLowerCase() !== ADMIN_EMAIL,
  );
  const tarefasPendentes = listaTarefas.filter((t) => t.status === "pendente");
  const tarefasUrgentes = tarefasPendentes.filter(
    (tarefa) => tarefa.prioridade === "urgente",
  );
  const tarefasFiltradas = listaTarefas.filter((tarefa) => {
    const correspondeCategoria =
      filtroCategoria === "todas" || tarefa.categoria === filtroCategoria;
    if (!correspondeCategoria) return false;
    if (filtroTarefas === "todas") return true;
    if (filtroTarefas === "manuais") return tarefa.tarefa_manual === true;
    if (filtroTarefas === "urgente") {
      return tarefa.status === "pendente" && tarefa.prioridade === "urgente";
    }
    return tarefa.status === filtroTarefas;
  });
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
    if (!titulo || (!tarefaManual && !funcId)) {
      return alert(
        tarefaManual
          ? "Preencha o titulo da tarefa manual."
          : "Preencha o titulo e selecione a responsavel.",
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
        p_status: "pendente",
        p_prioridade: prioridade,
        p_categoria: categoria,
        p_apontamento: apontamento.trim() || null,
        p_exibir_tv: exibirTv,
      });
      data = Array.isArray(resposta.data) ? resposta.data[0] : resposta.data;
      error = resposta.error;
    } else {
      const resposta = await supabase
        .from("tarefas")
        .insert({
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          funcionaria_id: Number(funcId),
          pontos_tarefa: Math.max(0, Number(pontosTarefa) || 0),
          data_limite: dataLimite || null,
          status: "pendente",
          prioridade,
          categoria,
          apontamento: apontamento.trim() || null,
          exibir_tv: exibirTv,
          tarefa_manual: false,
        })
        .select()
        .single();
      data = resposta.data;
      error = resposta.error;
    }

    if (error) {
      alert("Erro ao salvar tarefa: " + error.message);
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
      setDataLimite("");
      setPrioridade("normal");
      setCategoria(CATEGORIAS_TAREFA[0]);
      setApontamento("");
      setExibirTv(true);
    }

    setSalvandoTarefa(false);
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
          <img src="/assets/celios-button-icon.png" alt="CeliOS" className="brand-icon" />
          <div>
            <strong>CeliOS</strong>
            <span>Operating Workspace</span>
          </div>
        </div>
        <nav>
          <span className="nav-label">Navegação</span>
          <NavItem active={abaAtiva === "dashboard"} icon="dashboard" onClick={() => setAbaAtiva("dashboard")} options={["Indicadores", "Urgências", "Ranking"]}>Dashboard</NavItem>
          <NavItem active={abaAtiva === "tarefas"} icon="tarefas" onClick={() => setAbaAtiva("tarefas")} options={["Criar tarefa", "Apontamentos", "Filtros rápidos"]}>Tarefas</NavItem>
          <NavItem active={false} icon="tv" onClick={() => setModoTv(true)} options={["Modo painel", "Operação ao vivo"]}>Painel TV</NavItem>
          <NavItem active={abaAtiva === "responsabilidades"} icon="planner" onClick={() => setAbaAtiva("responsabilidades")} options={["Rotina mensal", "Responsáveis", "Preview"]}>Tarefas do Mês</NavItem>
          <NavItem active={abaAtiva === "equipe"} icon="equipe" onClick={() => setAbaAtiva("equipe")} options={["Equipe", "Feedbacks", "Pontuação"]}>Equipe</NavItem>
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
          <div className="profile-pill">
            <span className="online-dot" />
            <div><small>Supervisor online</small><span>{usuario.nome}</span></div>
          </div>
        </header>

        {abaAtiva === "dashboard" && (
          <>
            <section className="cards-grid">
              <div className="card" onClick={() => { setFiltroTarefas("pendente"); setAbaAtiva("tarefas"); }} style={{ cursor: 'pointer' }}>
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

            <section className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="panel large">
                <h2 className="section-title">Acompanhamento da Esteira (Visão Geral)</h2>
                {listaTarefas.length === 0 ? <p>Nenhuma tarefa listada no sistema.</p> : null}
                {listaTarefas.map((tarefa) => {
                  const func = funcionarios.find(
                    (item) => String(item.id) === String(tarefa.funcionaria_id),
                  );
                  const nomeResponsavel =
                    tarefa.responsavel_texto ||
                    func?.nome ||
                    (tarefa.tarefa_manual ? "Equipe" : "Nao atribuida");
                  return (
                    <div className="task-item" key={tarefa.id}>
                      <div>
                        <h3>{tarefa.titulo}</h3>
                        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>{tarefa.descricao}</p>
                        <small>
                          Responsavel: <strong>{nomeResponsavel}</strong> |
                          {!tarefa.tarefa_manual &&
                            ` Pontos: ${tarefa.pontos_tarefa ?? 0} |`}
                          Prazo: {formatarData(tarefa.data_limite)}
                        </small>
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
                        <span className={`status ${tarefa.status}`}>
                          {rotuloStatusTarefa(tarefa.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

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
                <button className="btn-secondary" onClick={() => setModoTv(true)}>
                  Visualizar painel
                </button>
                <button className="btn-primary" onClick={abrirPainelTvNovaAba}>
                  Abrir na TV
                </button>
              </div>
            </section>

            <section className="task-editor-grid">
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
                  <label>
                    Titulo
                    <input
                      type="text"
                      placeholder="Ex.: Conferir contratos recebidos"
                      value={titulo}
                      onChange={(event) => setTitulo(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Descricao
                    <textarea
                      placeholder="Descreva a entrega e os procedimentos."
                      value={descricao}
                      onChange={(event) => setDescricao(event.target.value)}
                      rows="4"
                    />
                  </label>
                  <label>
                    Categoria
                    <select
                      value={categoria}
                      onChange={(event) => setCategoria(event.target.value)}
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
                          {equipe.map((funcionario) => (
                            <option key={funcionario.id} value={funcionario.id}>
                              {funcionario.nome} ({funcionario.cargo})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Prioridade
                      <select
                        value={prioridade}
                        onChange={(event) => setPrioridade(event.target.value)}
                      >
                        <option value="normal">Normal</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </label>
                  </div>
                  <div className={tarefaManual ? "" : "task-form-row"}>
                    {!tarefaManual && (
                      <label>
                        Pontos
                        <input
                          min="0"
                          type="number"
                          value={pontosTarefa}
                          onChange={(event) =>
                            setPontosTarefa(event.target.value)
                          }
                        />
                      </label>
                    )}
                    <label>
                      Prazo
                      <input
                        type="date"
                        value={dataLimite}
                        onChange={(event) => setDataLimite(event.target.value)}
                      />
                    </label>
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
                    className="btn-primary"
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

              <div className="panel">
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
                              {equipe.map((funcionario) => (
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
                            <option value="pendente">Pendente</option>
                            <option value="concluida">Concluida</option>
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
              </div>
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
                    <option value="pendente">Pendentes</option>
                    <option value="urgente">Urgentes</option>
                    <option value="concluida">Concluidas</option>
                  </select>
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

              {tarefasFiltradas.length === 0 && (
                <div className="monthly-empty">
                  Nenhuma tarefa encontrada neste filtro.
                </div>
              )}

              <div className="admin-task-list">
                {tarefasFiltradas.map((tarefa) => {
                  const responsavel = equipe.find(
                    (funcionario) =>
                      String(funcionario.id) ===
                      String(tarefa.funcionaria_id),
                  );
                  const nomeResponsavel =
                    tarefa.responsavel_texto ||
                    responsavel?.nome ||
                    (tarefa.tarefa_manual ? "Equipe" : "Nao atribuida");

                  return (
                    <article
                      className={`admin-task-card priority-${tarefa.prioridade || "normal"}`}
                      key={tarefa.id}
                    >
                      <div className="admin-task-main">
                        <div className="admin-task-badges">
                          <span className={`status ${tarefa.status}`}>
                            {rotuloStatusTarefa(tarefa.status)}
                          </span>
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
                        <h3>{tarefa.titulo}</h3>
                        {tarefa.descricao && <p>{tarefa.descricao}</p>}
                        {tarefa.apontamento && (
                          <div className="admin-task-note">
                            <strong>Apontamento:</strong>{" "}
                            {tarefa.apontamento}
                          </div>
                        )}
                        <small>
                          Responsavel: {nomeResponsavel} | Prazo:{" "}
                          {formatarData(tarefa.data_limite)}
                          {!tarefa.tarefa_manual &&
                            ` | Pontos: ${tarefa.pontos_tarefa ?? 0}`}
                        </small>
                      </div>
                      <div className="admin-task-actions">
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
            </section>
          </div>
        )}

        {abaAtiva === "responsabilidades" && (
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
          <section className="content-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="panel">
              <h2>Membros da Equipe e Placar de Pontos</h2>
              <div className="team-list">
                {equipe.map((f) => (
                  <div className="team-member" key={f.id}>
                    <div className="member-avatar">{f.nome?.charAt(0)}</div>
                    <div>
                      <strong>{f.nome}</strong>
                      <p>Esteira: {f.cargo}</p>
                      <span className="points-badge">{f.pontos || 0} pontos acumulados</span>
                    </div>
                    <div className="member-actions">
                      <button className="btn-success compact" onClick={() => alterarPontosFuncionario(f.id, 10)}>+10</button>
                      <button className="btn-danger compact" onClick={() => alterarPontosFuncionario(f.id, -10)}>-10</button>
                    </div>
                  </div>
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
          </section>
        )}

        {abaAtiva === "documentos" && (
          <GeradorDocumentos responsavel={usuario.nome} onSuccess={showToast} />
        )}
      </main>
    </div>
  );
}

// ==========================================
// 5. PAINEL DA FUNCIONÁRIA (ATUALIZADO COM PLANNER E HISTÓRICO)
// ==========================================

function EmployeeDashboard({ usuario, onLogout, state }) {
  const {
    listaTarefas,
    setListaTarefas,
    feedbacks,
    responsabilidadesMensais,
    recarregarTarefas,
    recarregarFeedbacks,
    recarregarResponsabilidadesMensais,
    showToast,
  } = state;
  const [abaAtiva, setAbaAtiva] = useState("tarefas");
  const [tarefaConcluindoId, setTarefaConcluindoId] = useState(null);

  const minhasTarefas = listaTarefas.filter(
    (tarefa) => String(tarefa.funcionaria_id) === String(usuario.id),
  );
  const tarefasPendentes = minhasTarefas.filter((tarefa) => tarefa.status === "pendente");
  const tarefasConcluidas = minhasTarefas.filter((tarefa) => tarefa.status === "concluida");
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

  async function concluirTarefa(tarefa) {
    setTarefaConcluindoId(tarefa.id);

    const { data: tarefaAtualizada, error } = await supabase
      .from("tarefas")
      .update({ status: "concluida" })
      .eq("id", tarefa.id)
      .eq("funcionaria_id", usuario.id)
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("Erro ao concluir tarefa:", error);
      alert(`Não foi possível concluir a tarefa: ${error.message}`);
      setTarefaConcluindoId(null);
      return;
    }

    if (!tarefaAtualizada || tarefaAtualizada.status !== "concluida") {
      alert(
        "O banco não confirmou a conclusão. Execute a configuração do Supabase indicada no README.",
      );
      setTarefaConcluindoId(null);
      return;
    }

    setListaTarefas((atuais) =>
      atuais.map((item) =>
        String(item.id) === String(tarefa.id)
          ? { ...item, status: "concluida" }
          : item,
      ),
    );

    try {
      await recarregarTarefas();
      showToast("Parabéns! Tarefa concluída com sucesso.");
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
         <img src="/assets/celios-button-icon.png" alt="CeliOS" className="brand-icon" />
          <div>
            <strong>CeliOS</strong>
            <span>Operating Workspace</span>
          </div>
        </div>
        <nav>
          <span className="nav-label">Meu espaço</span>
          <NavItem active={abaAtiva === "tarefas"} icon="tarefas" onClick={() => setAbaAtiva("tarefas")}>Minhas Tarefas</NavItem>
          <NavItem active={abaAtiva === "feedbacks"} icon="feedback" onClick={() => setAbaAtiva("feedbacks")}>
            Meus Feedbacks ({meusFeedbacks.length})
          </NavItem>
          <NavItem active={abaAtiva === "historico"} icon="historico" onClick={() => setAbaAtiva("historico")}>Meu Histórico</NavItem>
          <NavItem active={abaAtiva === "planner"} icon="planner" onClick={() => setAbaAtiva("planner")}>Meu Planner</NavItem>
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
          <div className="profile-pill">
            <span className="online-dot" />
            <div><small>Colaboradora online</small><span>{usuario.cargo}</span></div>
          </div>
        </header>

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
                <button className="btn-secondary compact" onClick={recarregarTarefas}>
                  Atualizar
                </button>
              </div>
              {tarefasPendentes.length === 0 ? (
                <p>Nenhuma tarefa pendente no momento.</p>
              ) : null}
              
              {tarefasPendentes.map((tarefa) => (
                <div className="task-item" key={tarefa.id}>
                  <div>
                    <h3>{tarefa.titulo}</h3>
                    <p>{tarefa.descricao}</p>
                    {tarefa.apontamento && (
                      <div className="employee-task-note">
                        <strong>Apontamento:</strong> {tarefa.apontamento}
                      </div>
                    )}
                    <small>
                      Prazo final: {formatarData(tarefa.data_limite)} |
                      Recompensa: +{tarefa.pontos_tarefa || 10} Pontos
                    </small>
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
                    <span className={`status ${tarefa.status}`}>
                      {rotuloStatusTarefa(tarefa.status)}
                    </span>
                    <button
                      className="btn-success"
                      disabled={tarefaConcluindoId === tarefa.id}
                      onClick={() => concluirTarefa(tarefa)}
                    >
                      {tarefaConcluindoId === tarefa.id ? "Confirmando..." : "Concluir"}
                    </button>
                  </div>
                </div>
              ))}
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
          </div>
        )}

        {abaAtiva === "historico" && (
          <MeuHistorico tarefas={tarefasConcluidas} />
        )}

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

        {abaAtiva === "planner" && (
          <MeuPlanner funcionariaLogadaId={usuario.id} />
        )}

        {abaAtiva === "documentos" && (
          <GeradorDocumentos responsavel={usuario.nome} onSuccess={showToast} />
        )}

      </main>
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
    let ativo = true;

    async function restaurarSessao() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session?.user) return;

        const perfil = await buscarPerfilUsuario(data.session.user);
        if (!ativo) return;

        setUsuarioLogado(perfil);
        await sincronizarDados();
      } catch (error) {
        console.error("Erro ao restaurar sessão:", error);
        await supabase.auth.signOut();
      } finally {
        if (ativo) setInicializando(false);
      }
    }

    restaurarSessao();
    return () => {
      ativo = false;
    };
  }, [sincronizarDados]);

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

    if (usuarioLogado.tipo === "funcionaria") {
      alteracaoTarefa.filter = `funcionaria_id=eq.${usuarioLogado.id}`;
    }

    const canalTarefas = supabase
      .channel(`tarefas-${usuarioLogado.tipo}-${usuarioLogado.id}`)
      .on("postgres_changes", alteracaoTarefa, (evento) => {
        recarregarTarefas()
          .then(() => {
            if (
              usuarioLogado.tipo === "funcionaria" &&
              evento.eventType === "INSERT" &&
              evento.new?.status === "pendente"
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

        .login-page-liquid { min-height: 100vh; position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(420px, 1.12fr) minmax(390px, 520px); align-items: center; gap: clamp(34px, 5vw, 88px); padding: clamp(30px, 5vw, 78px) clamp(34px, 5vw, 86px); background: #f8fbff url('/assets/celios-login-background.png') center / cover no-repeat; color: #102a56; isolation: isolate; }
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
        .brand-icon { width: 48px; height: 48px; border-radius: 16px; object-fit: cover; box-shadow: 0 12px 30px rgba(37,99,235,.16), 0 0 22px rgba(141,187,255,.26); }
        .brand strong { display: block; color: #0f2a55; font-size: 16px; letter-spacing: 1.8px; }
        .brand span { display: block; margin-top: 2px; color: #6b7c93; font-size: 9px; text-transform: uppercase; letter-spacing: 1.2px; }
        .sidebar nav { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; position: relative; z-index: 2; }
        .nav-label { display: none; }
        .nav-item { position: relative; width: auto; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; color: #526780; background: rgba(248,251,255,.48); border: 1px solid rgba(255,255,255,.62); border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 800; text-align: center; transition: .24s ease; box-shadow: inset 0 1px 0 rgba(255,255,255,.88); }
        .nav-item:hover { color: #2563eb; background: rgba(255,255,255,.82); transform: translateY(-2px); box-shadow: 0 14px 34px rgba(37,99,235,.12), inset 0 1px 0 rgba(255,255,255,.95); }
        .nav-item.active-tab { color: #fff; background: linear-gradient(135deg, #6aa2ff, #2563eb); border-color: rgba(255,255,255,.76); box-shadow: 0 18px 34px rgba(37,99,235,.22), inset 0 1px 0 rgba(255,255,255,.55); }
        .nav-item.active-tab .ui-icon { color: #fff; filter: drop-shadow(0 0 8px rgba(255,255,255,.38)); }
        .nav-menu-popover { position: absolute; left: 50%; top: calc(100% + 10px); min-width: 190px; display: grid; gap: 7px; padding: 12px; color: #46617f; background: rgba(255,255,255,.78); border: 1px solid rgba(255,255,255,.74); border-radius: 18px; box-shadow: 0 22px 56px rgba(44,86,145,.16); backdrop-filter: blur(26px); opacity: 0; pointer-events: none; transform: translate(-50%, -6px) scale(.98); transition: .2s ease; }
        .nav-menu-popover small { padding: 8px 10px; background: rgba(240,247,255,.68); border-radius: 12px; font-size: 10px; font-weight: 800; text-align: left; white-space: nowrap; }
        .nav-item:hover .nav-menu-popover { opacity: 1; transform: translate(-50%, 0) scale(1); }
        .sidebar-logout { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 14px; color: #526780; background: rgba(255,255,255,.58); border: 1px solid rgba(255,255,255,.72); border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 800; transition: .2s; }
        .sidebar-logout:hover { color: #2563eb; transform: translateY(-2px); box-shadow: 0 14px 34px rgba(37,99,235,.12); }

        .main-content { min-width: 0; padding: 28px clamp(24px, 3.2vw, 48px) 48px; }
        .topbar { min-height: 94px; display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 28px; padding: 22px 26px; background: rgba(255,255,255,.55); border: 1px solid rgba(255,255,255,.8); border-radius: 24px; box-shadow: 0 15px 45px rgba(57, 100, 157, .08); backdrop-filter: blur(22px); }
        .topbar p { font-size: 13px; }
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
        .task-actions { display: flex; align-items: center; gap: 9px; }
        .status { padding: 6px 10px; border-radius: 999px; font-size: 9px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; white-space: nowrap; }
        .status.pendente { color: #a66e16; background: rgba(255, 229, 170, .55); border: 1px solid rgba(216,164,54,.15); }
        .status.concluida { color: #268c77; background: rgba(190, 241, 228, .6); border: 1px solid rgba(66,191,165,.14); }
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
        .task-form { margin-top: 20px; }
        .task-form label { display: flex; flex-direction: column; gap: 7px; }
        .task-kind-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding: 5px; background: rgba(232,242,254,.78); border: 1px solid rgba(104,148,201,.13); border-radius: 13px; }
        .task-kind-switch button { padding: 10px 12px; color: #7182a0; background: transparent; border: 0; border-radius: 9px; cursor: pointer; font-size: 11px; font-weight: 800; }
        .task-kind-switch button.active { color: #fff; background: linear-gradient(135deg, #4f8ff7, #3d78db); box-shadow: 0 8px 18px rgba(55,118,216,.2); }
        .task-form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
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
        .task-list-controls select { min-width: 150px; padding: 9px 12px !important; }
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
        .tv-board { flex: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(14px, 1.5vw, 24px); padding: 24px 0 17px; min-height: 0; }
        .tv-column { display: flex; flex-direction: column; min-height: 0; padding: clamp(15px, 1.5vw, 22px); background: rgba(15,39,76,.72); border: 1px solid rgba(150,194,241,.11); border-radius: 21px; box-shadow: 0 22px 55px rgba(0,0,0,.16); }
        .tv-column > header { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 17px; padding-bottom: 15px; border-bottom: 1px solid rgba(151,194,240,.1); }
        .tv-column > header span { color: var(--tv-accent); font-size: 8px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; }
        .tv-column > header h2 { margin-top: 3px; color: #fff; font-size: clamp(17px, 1.5vw, 23px); }
        .tv-column > header > strong { width: 38px; height: 38px; display: grid; place-items: center; color: var(--tv-accent); background: var(--tv-soft); border-radius: 12px; font-size: 16px; }
        .tv-column-urgent { --tv-accent: #ff7892; --tv-soft: rgba(255,101,133,.12); }
        .tv-column-pending { --tv-accent: #f4bc57; --tv-soft: rgba(244,188,87,.12); }
        .tv-column-done { --tv-accent: #5ed7b7; --tv-soft: rgba(94,215,183,.12); }
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
        .member-avatar { width: 43px; height: 43px; display: grid; place-items: center; color: #fff; background: linear-gradient(145deg, #83b6f5, #4f82cf); border-radius: 14px; box-shadow: 0 8px 18px rgba(66,114,178,.2); font-weight: 800; }
        .team-member strong { display: block; color: var(--dark); font-size: 13px; }
        .team-member p { margin: 2px 0; font-size: 10px; }
        .points-badge { color: var(--green); font-size: 10px; font-weight: 800; }
        .member-actions { display: flex; gap: 6px; }
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
          .profile-pill { width: 100%; }
          .cards-grid { grid-template-columns: 1fr; }
          .card { min-height: 145px; }
          .task-actions, .member-actions { width: 100%; }
          .task-management-header, .task-list-heading, .admin-task-card { align-items: flex-start; flex-direction: column; }
          .task-management-actions, .task-list-controls, .admin-task-actions { width: 100%; }
          .task-management-actions button, .admin-task-actions button { flex: 1; }
          .task-list-controls select { flex: 1; min-width: 0; }
          .task-form-row { grid-template-columns: 1fr; }
          .employee-monthly-list { grid-template-columns: 1fr; }
          .team-member { grid-template-columns: 43px 1fr; }
          .member-actions { grid-column: span 2; }
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
           LOGIN CELIOS — VERSÃO IGUAL AO MODELO DA REFERÊNCIA
           Imagem esperada em: public/assets/celios-login-bg-3d.png
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
            url('/assets/celios-login-bg-3d.png') right center / auto 100% no-repeat !important;
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
              url('/assets/celios-login-bg-3d.png') right center / auto 100% no-repeat !important;
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
              url('/assets/celios-login-bg-3d.png') 38% center / cover no-repeat !important;
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
           AJUSTES FINAIS LOGIN CELIOS
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
            url("/assets/celios-login-bg-3d.png") center center / cover no-repeat !important;
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
           FUNDO MAIS NÍTIDO, AZUL E VALORIZADO — CeliOS Login
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
          background: url("/assets/celios-login-bg-3d.png") center center / cover no-repeat !important;
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

      `}</style>
      
      <Toast message={toastMessage} onClose={() => setToastMessage("")} />

      {inicializando ? (
        <div className="login-page login-page-liquid">
          <section className="glass-card login-card loading-card" aria-label="Carregando CeliOS">
            <div className="login-brand">
              <div className="brand-badge-wrap">
                <img
                  src="/assets/celios-symbol.png"
                  alt="CeliOS"
                  className="brand-badge"
                />
              </div>
              <div>
                <strong>CeliOS</strong>
                <span>Enterprise Operating System</span>
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

