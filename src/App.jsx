import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { resolverTipoAcesso } from "./lib/userAccess";
import MeuPlanner from "./MeuPlanner";
import TreinamentosOperacionais from "./components/TreinamentosOperacionais";
import "./App.css";
const GeradorDocumentos = lazy(() => import("./GeradorDocumentos"));
const EsteiraProcessualPlatino = lazy(() => import("./components/esteira/EsteiraProcessualPlatino"));
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
    documentos: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" /></>,
    planner: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M3 11h18" /><path d="m8 16 2 2 4-4" /></>,
    feedback: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8" /><path d="M8 13h5" /></>,
    treinamento: <><path d="m3 9 9-5 9 5-9 5-9-5Z" /><path d="M7 11.5V16c3 2 7 2 10 0v-4.5" /><path d="M21 9v6" /></>,
    esteira: <><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h7" /><path d="m15 16 2 2 4-5" /></>,
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
  const abas = [["inicio", "Início", "dashboard"], ...(admin || permissoes.documentos !== false ? [["documentos", "Documentos", "documentos"]] : []), ["treinamentos", "Treinamentos", "treinamento"], ...(!admin ? [["feedbacks", "Meus feedbacks", "feedback"]] : [])];
  if (admin || permissoes.esteira_processual !== false) {
    const indiceTreinamentos = abas.findIndex(([id]) => id === "treinamentos");
    if (!abas.some(([id]) => id === "esteira-processual")) {
      abas.splice(indiceTreinamentos === -1 ? abas.length : indiceTreinamentos, 0, ["esteira-processual", "Processual", "esteira"]);
    }
  }
  return <div className="app-layout">
    <aside className="sidebar">
      <div className="brand"><img src="/logo-interface.png" alt="Platino" className="brand-icon" /><div><strong>Platino</strong><span>Workspace</span></div></div>
      <nav aria-label="Menu principal">{abas.map(([id, nome, icon]) => <NavItem key={id} active={aba === id} icon={icon} onClick={() => { setAba(id); if (id === "feedbacks") carregarFeedbacks(); }}>{nome}</NavItem>)}</nav>
      <button className="sidebar-logout" onClick={onLogout}><UiIcon name="logout" /> Sair</button>
    </aside>
    <main className="main-content">
      <header className="topbar"><h1>{abas.find(([id]) => id === aba)?.[1]}</h1><span>{usuario.nome}</span></header>
      {aba === "inicio" && <><section className="panel"><span className="eyebrow">Workspace Platino</span><h2>Olá, {usuario.nome?.split(" ")[0]}!</h2><p>Acesse seus documentos e materiais de treinamento pelo menu.</p></section>{!admin && permissoes.planner !== false && <MeuPlanner funcionariaLogadaId={usuario.id} />}</>}
      {aba === "documentos" && <Suspense fallback={<section className="panel">Carregando documentos...</section>}><GeradorDocumentos usuario={usuario} responsavel={usuario.nome} onSuccess={showToast} /></Suspense>}
      {aba === "esteira-processual" && <Suspense fallback={<section className="panel">Carregando esteira processual...</section>}><EsteiraProcessualPlatino usuario={usuario} showToast={showToast} /></Suspense>}
      {aba === "treinamentos" && <TreinamentosOperacionais usuario={usuario} />}
      {aba === "feedbacks" && <section className="panel"><h2>Meus feedbacks</h2><button className="btn-secondary" onClick={carregarFeedbacks}>Atualizar</button><ListaFeedbacks feedbacks={feedbacks} /></section>}
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
