import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { resolverTipoAcesso } from "./lib/userAccess";
import { FormField, Input } from "./components/common/FormControls";
import "./App.css";
import "./login.css";

const WorkspaceJuridico = lazy(() => import("./components/WorkspaceJuridico"));
const GeradorDocumentos = lazy(() => import("./GeradorDocumentos"));
const NotificationPanel = lazy(() => import("./components/NotificationPanel"));
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "tafarel@platino.com").toLowerCase();

async function carregarPerfil(usuario) {
  const email = usuario?.email?.trim().toLowerCase();
  if (!email) throw new Error("Conta autenticada sem e-mail válido.");
  const { data, error } = await supabase.from("funcionarios")
    .select("id,nome,email,perfil,cargo,setor,ativo").ilike("email", email).maybeSingle();
  if (error) throw error;
  if (!data || data.ativo === false) throw new Error("Conta sem perfil ativo autorizado.");
  return { ...data, auth_id: usuario.id, tipo: resolverTipoAcesso(data, ADMIN_EMAIL) };
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [senhaVisivel, setSenhaVisivel] = useState(false);

  async function enviar(event) {
    event.preventDefault();
    setBusy(true);
    setErro("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      });
      if (error) throw error;
      await onLogin(await carregarPerfil(data.user));
    } catch (e) {
      await supabase.auth.signOut();
      setErro(e.message || "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auvel-login">
      <img className="auvel-login-background" src="/assets/auvel/login-background.png" alt="" aria-hidden="true" fetchPriority="high" />
      <div className="auvel-login-wash" aria-hidden="true" />
      <div className="auvel-login-layout">
        <section className="auvel-login-editorial" aria-labelledby="auvel-login-title">
          <h1 id="auvel-login-title">Gestão inteligente<br />e alta performance.</h1>
          <p><span>PROCESSOS</span><i /><span>PESSOAS</span><i /><span>RESULTADOS</span></p>
        </section>
        <form className="auvel-login-card" onSubmit={enviar}>
          <FormField className="auvel-login-field" htmlFor="login-email">
            <span>E-mail corporativo</span>
            <Input id="login-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <div className="auvel-login-password-group">
            <FormField className="auvel-login-field" htmlFor="login-password"><span>Senha</span></FormField>
            <span className="auvel-password-field">
              <Input id="login-password" type={senhaVisivel ? "text" : "password"} autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
              <button className="auvel-password-toggle" type="button" aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"} aria-pressed={senhaVisivel} onClick={() => setSenhaVisivel((visivel) => !visivel)}>
                {senhaVisivel ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5.3 0 8.8 5 9.5 6-.3.5-1.5 2.2-3.7 3.7M6.2 6.2C3.9 7.7 2.8 9.5 2.5 10c.7 1 4.2 6 9.5 6 1 0 1.9-.2 2.7-.5" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.5" /></svg>
                )}
              </button>
            </span>
          </div>
          {erro && <p className="auvel-login-error" role="alert">{erro}</p>}
          <button className="auvel-login-submit" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        </form>
      </div>
    </main>
  );
}

function SidebarIcon({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "inicio") return <svg className="sidebar-nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m4 10 8-6 8 6v9.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5z" /><path d="M9.5 20v-6h5v6" /></svg>;
  if (name === "extrajudicial") return <svg className="sidebar-nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5v4h4M9 12h6M9 16h6" /></svg>;
  if (name === "processual") return <svg className="sidebar-nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M4 20h16M6 17h12M12 4v13M5 8h14M8 8l-3 5h6L8 8Zm8 0-3 5h6l-3-5Z" /></svg>;
  if (name === "homologacao") return <svg className="sidebar-nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="12" r="8.5" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
  return <svg className="sidebar-nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5v4h4M9 12h6M9 16h6" /></svg>;
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [aba, setAba] = useState("inicio");
  const [homeScreen, setHomeScreen] = useState("home");
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const avisar = useCallback(m => { setToast(m); window.setTimeout(() => setToast(""), 3500); }, []);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        try { const perfil = await carregarPerfil(data.session.user); if (active) setUsuario(perfil); }
        catch { await supabase.auth.signOut(); }
      }
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);
  async function sair() { await supabase.auth.signOut(); setUsuario(null); setAba("inicio"); setHomeScreen("home"); }
  if (loading) return <main className="auvel-login auvel-login--loading">Carregando…</main>;
  if (!usuario) return <Login onLogin={setUsuario}/>;
  const abas = [
    { id: "inicio", title: "Início" },
    { id: "extrajudicial", title: "Extrajudicial" },
    { id: "processual", title: "Processual" },
    { id: "homologacao", title: "Homologação" },
    { id: "documentos", title: "Gerador de Documentos" },
  ];
  const view = aba === "inicio" ? (homeScreen === "home" ? "inicio" : homeScreen) : aba;
  const pageTitle = view === "inicio" ? "Início" : view === "clientes" ? "Clientes" : abas.find((tab) => tab.id === aba)?.title;
  function searchWorkspace(event) {
    event.preventDefault();
    setHomeScreen("clientes");
    setAba("inicio");
  }
  return <div className="legal-app"><aside className="legal-sidebar"><a className="legal-brand" href="#inicio" onClick={e => { e.preventDefault(); setAba("inicio"); setHomeScreen("home"); }}>{"PLATINO "}<small>JURÍDICO</small></a><nav aria-label="Menu principal">{abas.map((tab) => <button key={tab.id} className={aba === tab.id ? "selected" : ""} onClick={() => { setAba(tab.id); if (tab.id === "inicio") setHomeScreen("home"); }}><SidebarIcon name={tab.id} /><span>{tab.title}</span></button>)}</nav><div className="legal-user"><span>{usuario.nome || usuario.email}</span><button onClick={sair}>Sair</button></div></aside><main className="legal-main"><header className="legal-topbar"><div className="legal-page-heading"><span>Workspace jurídico</span><strong>{pageTitle}</strong></div><div className="legal-top-actions"><form className="global-search" role="search" onSubmit={searchWorkspace}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><Input aria-label="Buscar clientes" placeholder="Buscar clientes" value={workspaceSearch} onChange={event => setWorkspaceSearch(event.target.value)}/></form><Suspense fallback={<span className="header-icon-placeholder" />}><NotificationPanel /></Suspense><span className="header-avatar" aria-label={`Usuário ${usuario.nome || usuario.email}`} title={usuario.nome || usuario.email}>{(usuario.nome || usuario.email || "U").trim().charAt(0).toLocaleUpperCase("pt-BR")}</span></div></header><Suspense fallback={<section className="legal-panel">Carregando…</section>}>{aba === "documentos" ? <GeradorDocumentos usuario={usuario} responsavel={usuario.nome} onSuccess={avisar}/> : <WorkspaceJuridico view={view} usuario={usuario} notify={avisar} searchValue={workspaceSearch} onSearchChange={setWorkspaceSearch}/>}</Suspense></main>{toast && <div className="toast-message" role="status">{toast}</div>}</div>;
}
