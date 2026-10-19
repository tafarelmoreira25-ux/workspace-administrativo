import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { resolverTipoAcesso } from "./lib/userAccess";
import "./App.css";

const WorkspaceJuridico = lazy(() => import("./components/WorkspaceJuridico"));
const GeradorDocumentos = lazy(() => import("./GeradorDocumentos"));
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
  async function enviar(event) {
    event.preventDefault(); setBusy(true); setErro("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    try {
      if (error) throw error;
      await onLogin(await carregarPerfil(data.user));
    } catch (e) {
      await supabase.auth.signOut(); setErro(e.message || "Não foi possível entrar.");
    } finally { setBusy(false); }
  }
  return <main className="legal-login"><form onSubmit={enviar}><img src="/assets/platino-orbital-logo.png" alt="Platino"/><h1>Workspace jurídico</h1><label>E-mail<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>Senha<input type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)}/></label>{erro && <p role="alert">{erro}</p>}<button disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button></form></main>;
}

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [aba, setAba] = useState("inicio");
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
  async function sair() { await supabase.auth.signOut(); setUsuario(null); setAba("inicio"); }
  if (loading) return <main className="legal-login">Carregando…</main>;
  if (!usuario) return <Login onLogin={setUsuario}/>;
  const abas = [["inicio", "Início"], ["extrajudicial", "Extrajudicial"], ["processual", "Processual"], ["homologacao", "Homologação"], ["documentos", "Gerador de Documentos"]];
  return <div className="legal-app"><aside className="legal-sidebar"><a className="legal-brand" href="#inicio" onClick={e => { e.preventDefault(); setAba("inicio"); }}>PLATINO <small>JURÍDICO</small></a><nav aria-label="Menu principal">{abas.map(([id, title]) => <button key={id} className={aba === id ? "selected" : ""} onClick={() => setAba(id)}>{title}</button>)}</nav><div className="legal-user"><span>{usuario.nome || usuario.email}</span><button onClick={sair}>Sair</button></div></aside><main className="legal-main"><header><span>Workspace jurídico</span><strong>{abas.find(([id]) => id === aba)?.[1]}</strong></header><Suspense fallback={<section className="legal-panel">Carregando…</section>}>{aba === "documentos" ? <GeradorDocumentos usuario={usuario} responsavel={usuario.nome} onSuccess={avisar}/> : <WorkspaceJuridico view={aba} usuario={usuario} notify={avisar}/>}</Suspense></main>{toast && <div className="toast-message" role="status">{toast}</div>}</div>;
}
