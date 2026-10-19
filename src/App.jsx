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
        <header className="auvel-login-brand" aria-label="AUVEL">
          <span className="auvel-wordmark-crop"><img src="/assets/auvel/logo-wordmark.png" alt="auvel." /></span>
        </header>
        <section className="auvel-login-editorial" aria-labelledby="auvel-login-title">
          <h1 id="auvel-login-title">Gestão inteligente<br />e alta performance.</h1>
          <p><span>PROCESSOS</span><i /><span>PESSOAS</span><i /><span>RESULTADOS</span></p>
        </section>
        <form className="auvel-login-card" onSubmit={enviar}>
          <span className="auvel-monogram-crop" aria-hidden="true"><img src="/assets/auvel/logo-monogram.png" alt="" /></span>
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
  const abas = [["inicio", "Início"], ["extrajudicial", "Extrajudicial"], ["processual", "Processual"], ["homologacao", "Homologação"], ["documentos", "Gerador de Documentos"]];
  const view = aba === "inicio" ? homeScreen : aba;
  const pageTitle = view === "inicio" ? "Área de Trabalho" : view === "clientes" ? "Clientes" : abas.find(([id]) => id === aba)?.[1];
  function navigate(destination) {
    if (destination === "clientes") {
      setAba("inicio");
      setHomeScreen("clientes");
      return;
    }
    setHomeScreen("home");
    setAba(destination);
  }
  function searchWorkspace(event) {
    event.preventDefault();
    setHomeScreen("clientes");
    setAba("inicio");
  }
  return <div className="legal-app"><aside className="legal-sidebar"><a className="legal-brand" href="#inicio" onClick={e => { e.preventDefault(); setAba("inicio"); setHomeScreen("home"); }}>{"PLATINO "}<small>JURÍDICO</small></a><nav aria-label="Menu principal">{abas.map(([id, title]) => <button key={id} className={aba === id ? "selected" : ""} onClick={() => { setAba(id); if (id === "inicio") setHomeScreen("home"); }}>{title}</button>)}</nav><div className="legal-user"><span>{usuario.nome || usuario.email}</span><button onClick={sair}>Sair</button></div></aside><main className="legal-main"><header className="legal-topbar"><div className="legal-page-heading"><span>Workspace jurídico</span><strong>{pageTitle}</strong></div><div className="legal-top-actions"><form className="global-search" role="search" onSubmit={searchWorkspace}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><Input aria-label="Buscar clientes" placeholder="Buscar clientes" value={workspaceSearch} onChange={event => setWorkspaceSearch(event.target.value)}/><button type="submit">Buscar</button></form><Suspense fallback={<span className="header-icon-placeholder" />}><NotificationPanel /></Suspense><span className="header-avatar" aria-label={`Usuário ${usuario.nome || usuario.email}`} title={usuario.nome || usuario.email}>{(usuario.nome || usuario.email || "U").trim().charAt(0).toLocaleUpperCase("pt-BR")}</span></div></header><Suspense fallback={<section className="legal-panel">Carregando…</section>}>{aba === "documentos" ? <GeradorDocumentos usuario={usuario} responsavel={usuario.nome} onSuccess={avisar}/> : <WorkspaceJuridico view={view} usuario={usuario} notify={avisar} onNavigate={navigate} searchValue={workspaceSearch} onSearchChange={setWorkspaceSearch}/>}</Suspense></main>{toast && <div className="toast-message" role="status">{toast}</div>}</div>;
}
