import MeuHistorico from './MeuHistorico';
import MeuPlanner from './MeuPlanner';
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Configuração Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "SUA_URL_AQUI";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "SUA_CHAVE_AQUI";
const supabase = createClient(supabaseUrl, supabaseKey);

function Toast({ message, onClose }) {
  if (!message) return null;
  return <div className="toast-message" onClick={onClose}>{message}</div>;
}

function IconPlaceholder({ type }) {
  return (
    <div style={{ width: '100%', height: '80px', background: '#dbeafe', borderRadius: '16px', marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
      {type === 'feedback' ? '💬' : type === 'ranking' ? '🏆' : type === 'tarefas' ? '📋' : '👥'}
    </div>
  );
}

// TELA DE LOGIN
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function fazerLogin(event) {
    event.preventDefault();
    setCarregando(true);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (authError) { alert("Erro ao entrar"); setCarregando(false); return; }

    if (email === "tafarel@platino.com") {
      onLogin({ id: 999, nome: "Tafarel Moreira", tipo: "admin", cargo: "Supervisor" });
      return;
    }

    const { data: funcData } = await supabase.from("funcionarios").select("*").eq("email", email).single();
    onLogin({ ...funcData, tipo: "funcionaria" });
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>WORKSPACE</h1>
        <form onSubmit={fazerLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input type="email" placeholder="E-mail" onChange={(e) => setEmail(e.target.value)} style={{ padding: '12px' }} />
          <input type="password" placeholder="Senha" onChange={(e) => setSenha(e.target.value)} style={{ padding: '12px' }} />
          <button type="submit" className="btn-primary" disabled={carregando}>Entrar</button>
        </form>
      </div>
    </div>
  );
}

// PAINEL ADMINISTRADOR
function AdminDashboard({ usuario, onLogout, state }) {
  const { listaTarefas, funcionarios, showToast } = state;
  const [abaAtiva, setAbaAtiva] = useState("dashboard");

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <nav>
          <a onClick={() => setAbaAtiva("dashboard")} className={abaAtiva === "dashboard" ? "active-tab" : ""}>Dashboard</a>
          <a onClick={() => setAbaAtiva("tarefas")} className={abaAtiva === "tarefas" ? "active-tab" : ""}>Tarefas</a>
          <a onClick={() => setAbaAtiva("equipe")} className={abaAtiva === "equipe" ? "active-tab" : ""}>Equipe</a>
          <a onClick={() => setAbaAtiva("planner")} className={abaAtiva === "planner" ? "active-tab" : ""}>Planner</a>
        </nav>
        <button onClick={onLogout}>Sair</button>
      </aside>

      <main className="main-content">
        {abaAtiva === "dashboard" && <h1>Dashboard Administrativo</h1>}
        {abaAtiva === "tarefas" && <h2>Gestão de Tarefas</h2>}
        {abaAtiva === "equipe" && <h2>Gestão de Equipe</h2>}
        {abaAtiva === "planner" && <MeuPlanner funcionariaLogadaId={usuario.id} />}
      </main>
    </div>
  );
}

// PAINEL FUNCIONÁRIA
function EmployeeDashboard({ usuario, onLogout, state }) {
  const { listaTarefas, setListaTarefas, showToast } = state;
  const [abaAtiva, setAbaAtiva] = useState("tarefas");

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <nav>
          <a onClick={() => setAbaAtiva("tarefas")} className={abaAtiva === "tarefas" ? "active-tab" : ""}>Minhas Tarefas</a>
          <a onClick={() => setAbaAtiva("historico")} className={abaAtiva === "historico" ? "active-tab" : ""}>Meu Histórico</a>
          <a onClick={() => setAbaAtiva("planner")} className={abaAtiva === "planner" ? "active-tab" : ""}>Meu Planner</a>
        </nav>
        <button onClick={onLogout}>Sair</button>
      </aside>
      <main className="main-content">
        {abaAtiva === "tarefas" && <h2>Minhas Tarefas</h2>}
        {abaAtiva === "historico" && <MeuHistorico funcionariaLogadaId={usuario.id} />}
        {abaAtiva === "planner" && <MeuPlanner funcionariaLogadaId={usuario.id} />}
      </main>
    </div>
  );
}

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [listaTarefas, setListaTarefas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(""), 4000); };

  useEffect(() => {
    async function fetchData() {
      const { data: t } = await supabase.from('tarefas').select('*');
      const { data: f } = await supabase.from('funcionarios').select('*');
      if (t) setListaTarefas(t); if (f) setFuncionarios(f);
    }
    fetchData();
  }, []);

  const globais = { listaTarefas, setListaTarefas, funcionarios, setFuncionarios, showToast };

  return (
    <>
      <style>{`
        .app-layout { display: flex; min-height: 100vh; }
        .sidebar { width: 260px; background: #fff; padding: 20px; border-right: 1px solid #ddd; }
        .sidebar nav a { display: block; padding: 10px; cursor: pointer; }
        .sidebar nav a.active-tab { font-weight: bold; color: #3b82f6; }
        .main-content { flex: 1; padding: 40px; }
      `}</style>
      <Toast message={toastMessage} onClose={() => setToastMessage("")} />
      {!usuarioLogado ? (
        <Login onLogin={setUsuarioLogado} />
      ) : usuarioLogado.tipo === "admin" ? (
        <AdminDashboard usuario={usuarioLogado} onLogout={() => setUsuarioLogado(null)} state={globais} />
      ) : (
        <EmployeeDashboard usuario={usuarioLogado} onLogout={() => setUsuarioLogado(null)} state={globais} />
      )}
    </>
  );
}