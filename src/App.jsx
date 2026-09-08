import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { resolverTipoAcesso } from "./lib/userAccess";
import MeuPlanner from "./MeuPlanner";
import TreinamentosOperacionais from "./components/TreinamentosOperacionais";
import "./App.css";
const GeradorDocumentos = lazy(() => import("./GeradorDocumentos"));
const EsteiraProcessualPlatino = lazy(() => import("./components/esteira/EsteiraProcessualPlatino"));
const ClientesModule = lazy(() => import("./components/clientes/ClientesModule"));
const OperacionalProcessualModule = lazy(() => import("./components/operacional/OperacionalProcessualModule"));
const DocumentosAcervo = lazy(() => import("./components/documentos/DocumentosAcervo"));
const GerencialProcessualModule = lazy(() => import("./components/gerencial/GerencialProcessualModule"));
const GlobalSearch = lazy(() => import("./components/gerencial/GlobalSearch"));
const CarteiraProcessual = lazy(() => import("./CarteiraProcessual"));
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "tafarel@platino.com").toLowerCase();
const TEMPO_LIMITE_INICIALIZACAO_MS = 8_000;
function limitarTempo(promise, tempoMs, mensagem) {
  let temporizador;
  const limite = new Promise((_, rejeitar) => {
    temporizador = window.setTimeout(() => rejeitar(new Error(mensagem)), tempoMs);
  });

  return Promise.race([promise, limite]).finally(() => {
    window.clearTimeout(temporizador);
  });
}

async function buscarPerfilUsuario(usuarioAuth) {
  const email = usuarioAuth?.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("A conta autenticada não possui um e-mail válido.");
  }

  const { data, error } = await supabase
    .from("funcionarios")
    .select("*")
    .ilike("email", email)
    .maybeSingle();

  if (error) throw error;
  if (!data && email === ADMIN_EMAIL) {
    return {
      id: usuarioAuth.id,
      auth_id: usuarioAuth.id,
      nome: "Tafarel Moreira",
      email,
      tipo: "admin",
      perfil: "supervisor",
      cargo: "Supervisor",
      setor: "Administrativo",
    };
  }
  if (!data) throw new Error("Usuário não encontrado no cadastro da equipe.");
  if (data.ativo === false) {
    throw new Error("Este perfil está inativo. Procure o supervisor responsável.");
  }

  const tipo = resolverTipoAcesso(data, ADMIN_EMAIL);
  return {
    ...data,
    auth_id: usuarioAuth.id,
    tipo,
  };
}

function formatarDataHora(data) {
  if (!data) return "Data não registrada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function rotuloTipoFeedback(tipo) {
  return tipo === "construtivo"
    ? "Ponto de melhoria"
    : "Reconhecimento positivo";
}

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
    equipe: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    clientes: <><path d="M16 11a4 4 0 1 0-8 0" /><path d="M4 21a8 8 0 0 1 16 0" /><circle cx="12" cy="7" r="3" /></>,
    documentos: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" /></>,
    planner: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 11h18" /><path d="m8 16 2 2 4-4" /></>,
    feedback: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></>,
    treinamento: <><path d="m3 9 9-5 9 5-9 5-9-5Z" /><path d="M7 11.5V16c3 2 7 2 10 0v-4.5" /><path d="M21 9v6" /></>,
    esteira: <><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h7" /><path d="m15 16 2 2 4-5" /></>,
    protocolo: <><path d="M9 11h6" /><path d="M9 15h4" /><path d="M8 3h8l3 3v15H5V3Z" /><path d="M16 3v4h4" /></>,
    prazos: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    agenda: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 10h18" /></>,
    indicadores: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 15l3-4 3 2 5-7" /></>,
    alertas: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>,
    busca: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    sino: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    admin: <><path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5Z" /><path d="M9 12l2 2 4-5" /></>,
    ocorrencias: <><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h10" /><circle cx="18" cy="19" r="2" /></>,
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

function NavItem({ active, icon, children, onClick, disabled = false }) {
  return (
    <button className={`nav-item ${active ? "active-tab" : ""}`} disabled={disabled} onClick={onClick}>
      <UiIcon name={icon} size={18} />
      <span>{children}</span>
    </button>
  );
}

function AreaTrabalho({ usuario, admin }) {
  const primeiroNome = usuario.nome?.split(" ")[0] || "equipe";
  const indicadores = [
    ["Tarefas de hoje", "0", "Fila operacional preparada"],
    ["Atrasadas", "0", "Sem pendências críticas"],
    ["Protocolos no prazo", "0", "Monitoramento da Elite"],
    ["Alertas ativos", "0", "Nenhum alerta novo"],
  ];
  const tabelas = [
    {
      titulo: "Tarefas de hoje",
      colunas: ["Cliente", "Atividade", "Prazo", "Prioridade", "Responsável"],
      vazio: "Nenhuma tarefa programada para hoje.",
    },
    {
      titulo: "Próximos prazos",
      colunas: ["Cliente", "Tipo", "Data limite", "Status", "Responsável"],
      vazio: "Nenhum prazo próximo cadastrado.",
    },
    {
      titulo: "Processos sem revisão",
      colunas: ["Cliente", "Processo", "Última revisão", "Status", "Ação"],
      vazio: "Nenhum processo pendente de revisão.",
    },
  ];
  const alertas = [
    "Protocolos atrasados",
    "Pastas retornadas",
    "Custas pendentes",
    "Emendas pendentes",
    "Reuniões do dia",
  ];

  return (
    <section className="workspace-home">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">Área de Trabalho</span>
          <h2>O que exige atenção hoje</h2>
          <p>Visão operacional para acompanhar prazos, protocolos, revisões e alertas do escritório.</p>
        </div>
        <div className="workspace-heading-meta">
          <strong>{primeiroNome}</strong>
          <span>{admin ? "Administrador" : "Operação"}</span>
        </div>
      </div>

      <div className="workspace-kpis">
        {indicadores.map(([titulo, valor, legenda]) => (
          <article className="workspace-kpi" key={titulo}>
            <span>{titulo}</span>
            <strong>{valor}</strong>
            <small>{legenda}</small>
          </article>
        ))}
      </div>

      <div className="workspace-grid">
        <div className="workspace-main-column">
          {tabelas.map((tabela) => (
            <section className="workspace-table-card" key={tabela.titulo}>
              <header>
                <h3>{tabela.titulo}</h3>
                <button type="button" className="btn-secondary compact">Ver todos</button>
              </header>
              <div className="dense-table-shell">
                <table>
                  <thead>
                    <tr>{tabela.colunas.map((coluna) => <th key={coluna}>{coluna}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan={tabela.colunas.length}>
                        <div className="empty-row">{tabela.vazio}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <aside className="workspace-side-column">
          <section className="workspace-table-card">
            <header>
              <h3>Alertas</h3>
              <span className="subtle-count">0 ativos</span>
            </header>
            <div className="alert-stack">
              {alertas.map((alerta) => (
                <article key={alerta}>
                  <span />
                  <div>
                    <strong>{alerta}</strong>
                    <small>Estado vazio preparado</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function PlaceholderModulo({ titulo, descricao }) {
  return (
    <section className="module-placeholder">
      <span className="eyebrow">Módulo preparado</span>
      <h2>{titulo}</h2>
      <p>{descricao}</p>
      <div className="placeholder-panel">A estrutura visual já está disponível. A lógica será conectada em uma próxima etapa.</div>
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

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [, setEnviandoRecuperacao] = useState(false);
  const [, setAvisoRecuperacao] = useState("");

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

  void solicitarRecuperacao;

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
            type="submit"
            className="glass-button full login-submit"
            disabled={carregando}
          >
            {carregando && <span className="login-spinner" aria-hidden="true" />}
            <span>{carregando ? "Entrando..." : "Entrar"}</span>
          </button>

        </form>
      </section>

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

function Workspace({ usuario, onLogout, showToast }) {
  const [aba, setAba] = useState("inicio");
  const [feedbacks, setFeedbacks] = useState([]);
  const carregarFeedbacks = useCallback(async () => {
    const { data, error } = await supabase.from("feedbacks").select("*").eq("funcionaria_id", usuario.id).order("created_at", { ascending: false });
    if (error) showToast("Não foi possível carregar os feedbacks.");
    else setFeedbacks(data || []);
  }, [usuario.id, showToast]);
  const permissoes = usuario.permissoes || {};
  const admin = usuario.tipo === "admin";
  const setorNormalizado = String(usuario.setor || usuario.cargo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const podeEditarCarteira = admin || setorNormalizado === "administrativo";
  const podeVerDocumentos = admin || permissoes.documentos !== false;
  const podeVerProcessual = admin || permissoes.esteira_processual !== false;
  const navGroups = [
    {
      titulo: "Operação",
      itens: [
        ["inicio", "Área de Trabalho", "dashboard"],
        ["clientes", "Clientes", "clientes"],
        ...(podeVerProcessual ? [["esteira-processual", "Processual", "esteira"]] : []),
        ["processual-visao", "Visão Geral", "indicadores"],
        ["processual-protocolos", "Protocolos", "protocolo"],
        ["processual-processos", "Processos", "documentos"],
        ...(podeVerProcessual ? [["carteira-historica", "Carteira histórica", "documentos"]] : []),
        ["processual-prazos", "Prazos", "prazos"],
        ["processual-ocorrencias", "Ocorrências", "ocorrencias"],
        ["atendimentos", "Atendimentos", "feedback"],
        ["agenda", "Agenda e Prazos", "agenda"],
      ],
    },
    {
      titulo: "Produção",
      itens: [
        ...(podeVerDocumentos ? [["documentos", "Gerador de Documentos", "documentos"], ["documentos-arquivo", "Documentos", "protocolo"]] : []),
        ["indicadores", "Indicadores", "indicadores"],
        ["alertas", "Alertas", "alertas"],
        ["treinamentos", "Treinamentos", "treinamento"],
      ],
    },
    {
      titulo: "Administração",
      itens: [
        ["administracao", "Administração", "admin"],
        ...(!admin ? [["feedbacks", "Meus feedbacks", "feedback"]] : []),
      ],
    },
  ];
  const abas = navGroups.flatMap((grupo) => grupo.itens);
  const rotuloAtual = abas.find(([id]) => id === aba)?.[1] || "Área de Trabalho";
  const placeholderTextos = {
    "processual-visao": ["Visão Geral", "Painel executivo do Processual com distribuição, atrasos e acompanhamento da carteira."],
    "processual-prazos": ["Prazos", "Calendário operacional de prazos, emendas, custas e retornos críticos."],
    "processual-ocorrencias": ["Ocorrências", "Registro de impedimentos, pendências documentais e eventos relevantes."],
    atendimentos: ["Atendimentos", "Histórico de contatos, retornos e solicitações relacionadas à carteira."],
    agenda: ["Agenda e Prazos", "Agenda preparada para reuniões, vencimentos e próximos atos."],
    "documentos-arquivo": ["Documentos", "Arquivo e rastreabilidade dos documentos gerados no workspace."],
    indicadores: ["Indicadores", "Métricas operacionais e jurídicas para gestão do escritório."],
    alertas: ["Alertas", "Central de riscos e pendências relevantes."],
    administracao: ["Administração", "Gestão administrativa preparada para permissões, usuários e parâmetros."],
  };
  function navegar(id) {
    setAba(id);
    if (id === "feedbacks") carregarFeedbacks();
  }

  return <div className="app-layout">
    <aside className="sidebar">
      <div className="brand"><img src="/assets/platino-orbital-logo.png" alt="Platino" className="brand-icon" /><div><strong>Processual</strong><span>Workspace</span></div></div>
      <nav aria-label="Menu principal">
        {navGroups.map((grupo) => (
          <section className="nav-group" key={grupo.titulo}>
            <span>{grupo.titulo}</span>
            {grupo.itens.map(([id, nome, icon]) => (
              <NavItem key={id} active={aba === id} icon={icon} onClick={() => navegar(id)}>{nome}</NavItem>
            ))}
          </section>
        ))}
      </nav>
      <button className="sidebar-logout" onClick={onLogout}><UiIcon name="logout" /> Sair</button>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <div>
          <h1>{rotuloAtual}</h1>
          <p>Gestão operacional do escritório em um fluxo único.</p>
        </div>
        <div className="global-search">
          <Suspense fallback={<><UiIcon name="busca" size={17} /><input type="search" placeholder="Buscar cliente, CPF, ID, processo ou banco..." aria-label="Busca global" /></>}>
            <GlobalSearch />
          </Suspense>
        </div>
        <div className="topbar-actions">
          <button type="button" className="icon-button" aria-label="Notificações"><UiIcon name="sino" size={18} /></button>
          <div className="user-chip"><strong>{usuario.nome}</strong><span>{usuario.email}</span></div>
        </div>
      </header>
      {aba === "inicio" && <><AreaTrabalho usuario={usuario} admin={admin} />{!admin && permissoes.planner !== false && <MeuPlanner funcionariaLogadaId={usuario.id} />}</>}
      {aba === "clientes" && <Suspense fallback={<section className="panel">Carregando clientes...</section>}><ClientesModule usuario={usuario} showToast={showToast} /></Suspense>}
      {aba === "documentos" && <Suspense fallback={<section className="panel">Carregando documentos...</section>}><GeradorDocumentos usuario={usuario} responsavel={usuario.nome} onSuccess={showToast} /></Suspense>}
      {aba === "esteira-processual" && <Suspense fallback={<section className="panel">Carregando esteira processual...</section>}><EsteiraProcessualPlatino usuario={usuario} showToast={showToast} /></Suspense>}
      {aba === "processual-protocolos" && <Suspense fallback={<section className="panel">Carregando protocolos...</section>}><EsteiraProcessualPlatino usuario={usuario} showToast={showToast} initialView="protocolos" /></Suspense>}
      {aba === "processual-processos" && <Suspense fallback={<section className="panel">Carregando processos...</section>}><EsteiraProcessualPlatino usuario={usuario} showToast={showToast} initialView="processos" /></Suspense>}
      {aba === "carteira-historica" && <Suspense fallback={<section className="panel">Carregando carteira histórica...</section>}><CarteiraProcessual podeEditar={podeEditarCarteira} showToast={showToast} /></Suspense>}
      {aba === "processual-prazos" && <Suspense fallback={<section className="panel">Carregando prazos...</section>}><OperacionalProcessualModule usuario={usuario} showToast={showToast} initialView="agenda" /></Suspense>}
      {aba === "processual-visao" && <Suspense fallback={<section className="panel">Carregando visão geral...</section>}><GerencialProcessualModule usuario={usuario} showToast={showToast} initialView="indicadores" /></Suspense>}
      {aba === "processual-ocorrencias" && <Suspense fallback={<section className="panel">Carregando ocorrências...</section>}><GerencialProcessualModule usuario={usuario} showToast={showToast} initialView="ocorrencias" /></Suspense>}
      {aba === "atendimentos" && <Suspense fallback={<section className="panel">Carregando atendimentos...</section>}><OperacionalProcessualModule usuario={usuario} showToast={showToast} initialView="atendimentos" /></Suspense>}
      {aba === "agenda" && <Suspense fallback={<section className="panel">Carregando agenda...</section>}><OperacionalProcessualModule usuario={usuario} showToast={showToast} initialView="agenda" /></Suspense>}
      {aba === "documentos-arquivo" && <Suspense fallback={<section className="panel">Carregando documentos...</section>}><DocumentosAcervo usuario={usuario} showToast={showToast} /></Suspense>}
      {aba === "indicadores" && <Suspense fallback={<section className="panel">Carregando indicadores...</section>}><GerencialProcessualModule usuario={usuario} showToast={showToast} initialView="indicadores" /></Suspense>}
      {aba === "alertas" && <Suspense fallback={<section className="panel">Carregando alertas...</section>}><GerencialProcessualModule usuario={usuario} showToast={showToast} initialView="alertas" /></Suspense>}
      {aba === "treinamentos" && <TreinamentosOperacionais usuario={usuario} />}
      {aba === "feedbacks" && <section className="panel"><h2>Meus feedbacks</h2><button className="btn-secondary" onClick={carregarFeedbacks}>Atualizar</button><ListaFeedbacks feedbacks={feedbacks} /></section>}
      {placeholderTextos[aba] && !["processual-prazos", "processual-visao", "processual-ocorrencias", "atendimentos", "agenda", "documentos-arquivo", "indicadores", "alertas"].includes(aba) && <PlaceholderModulo titulo={placeholderTextos[aba][0]} descricao={placeholderTextos[aba][1]} />}
    </main>
  </div>;
}
export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [inicializando, setInicializando] = useState(true);
  const [modoRecuperacao, setModoRecuperacao] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery",
  );

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  }, []);

  const handleLogin = useCallback(async (perfil) => { setUsuarioLogado(perfil); }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUsuarioLogado(null);
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
  }, [modoRecuperacao, showToast]);

  return (<>
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
      ) : (
        <Workspace key={usuarioLogado.id} usuario={usuarioLogado} onLogout={handleLogout} showToast={showToast} />
      )}
    </>
  );
}
