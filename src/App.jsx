import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// 1. CONFIGURAÇÕES E CONEXÕES
// ==========================================
// O Vite puxa essas chaves automaticamente do seu arquivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "SUA_URL_AQUI";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "SUA_CHAVE_AQUI";
const supabase = createClient(supabaseUrl, supabaseKey);

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

function IconPlaceholder({ type }) {
  return (
    <div style={{
      width: '100%', height: '80px', background: '#dbeafe', 
      borderRadius: '16px', marginBottom: '15px', display: 'flex', 
      alignItems: 'center', justifyContent: 'center', fontSize: '32px',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
    }}>
      {type === 'feedback' ? '💬' : type === 'ranking' ? '🏆' : type === 'tarefas' ? '📋' : '📚'}
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

    if (!email || !senha) {
      alert("Por favor, preencha e-mail e senha.");
      setCarregando(false);
      return;
    }

    // Autenticação Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: senha,
    });

    if (authError) {
      alert("Erro ao entrar: E-mail ou senha incorretos.");
      setCarregando(false);
      return;
    }

    // Verifica se é o Administrador
    if (email === "tafarel@platino.com") {
      onLogin({
        id: 999,
        nome: "Tafarel Moreira",
        tipo: "admin",
        cargo: "Supervisor",
      });
      return;
    }

    // Busca os dados da funcionária
    const { data: funcData, error: funcError } = await supabase
      .from("funcionarios")
      .select("*")
      .eq("email", email)
      .single();

    if (funcError || !funcData) {
      alert("Acesso negado. Usuário não encontrado na equipe.");
      setCarregando(false);
      return;
    }

    onLogin({ ...funcData, tipo: "funcionaria" });
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/logo.png" alt="Logo Platino" className="brand-badge" />
        <h1>WORKSPACE ADMINISTRATIVO</h1>
        <p>Gestão Inteligente e Centralizada.</p>
        
        <form onSubmit={fazerLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
          <div>
            <label style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: '14px', marginBottom: '6px', display: 'block' }}>E-mail corporativo</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="exemplo@empresa.com"
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #c0c7d1' }}
            />
          </div>
          
          <div>
            <label style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: '14px', marginBottom: '6px', display: 'block' }}>Senha</label>
            <input 
              type="password" 
              value={senha} 
              onChange={(e) => setSenha(e.target.value)} 
              placeholder="Sua senha de acesso"
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #c0c7d1' }}
            />
          </div>

          <button type="submit" className="btn-primary full" disabled={carregando} style={{ padding: '14px', fontSize: '16px' }}>
            {carregando ? "Autenticando..." : "Entrar no Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 4. PAINEL DO ADMINISTRADOR
// ==========================================

function AdminDashboard({ usuario, onLogout, state }) {
  const { listaTarefas, setListaTarefas, funcionarios, showToast } = state;

  const tarefasPendentes = listaTarefas.filter((t) => t.status === "pendente");
  const tarefasConcluidas = listaTarefas.filter((t) => t.status === "concluida");

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="Logo Platino" className="brand-icon" />
          <div>
            <strong>WORKSPACE</strong>
            <span>Administrativo</span>
          </div>
        </div>
        <nav>
          <a>Dashboard</a>
          <a>Tarefas</a>
          <a>Equipe</a>
        </nav>
        <button className="btn-secondary full" onClick={onLogout}>Sair do Sistema</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Painel de Supervisão</h1>
            <p>Controle centralizado da esteira operacional.</p>
          </div>
          <div className="profile-pill">
            <span>{usuario.nome}</span>
          </div>
        </header>

        <section className="cards-grid">
          <div className="card">
            <IconPlaceholder type="tarefas" />
            <span>Tarefas Pendentes</span>
            <strong>{tarefasPendentes.length}</strong>
          </div>
          <div className="card">
            <IconPlaceholder type="ranking" />
            <span>Ranking Geral</span>
            <strong>Top 3</strong>
          </div>
          <div className="card">
            <IconPlaceholder type="feedback" />
            <span>Feedbacks</span>
            <strong>Gerenciar</strong>
          </div>
          <div className="card">
            <IconPlaceholder type="documentos" />
            <span>Equipe</span>
            <strong>{funcionarios.length} Ativas</strong>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel large">
            <h2 className="section-title">Acompanhamento da Esteira (Tarefas)</h2>
            {listaTarefas.map((tarefa) => {
              const func = funcionarios.find((item) => item.id === tarefa.funcionaria_id);
              return (
                <div className="task-item" key={tarefa.id}>
                  <div>
                    <h3>{tarefa.titulo}</h3>
                    <p style={{fontSize: '14px', color: '#64748b', marginBottom: '8px'}}>{tarefa.descricao}</p>
                    <small>Responsável: <strong>{func?.nome || 'Não atribuída'}</strong> | Pontos: {tarefa.pontos}</small>
                  </div>
                  <span className={`status ${tarefa.status}`}>{tarefa.status.replaceAll("_", " ")}</span>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

// ==========================================
// 5. PAINEL DA FUNCIONÁRIA
// ==========================================

function EmployeeDashboard({ usuario, onLogout, state }) {
  const { listaTarefas, setListaTarefas, showToast } = state;
  const minhasTarefas = listaTarefas.filter((tarefa) => tarefa.funcionaria_id === usuario.id);

  async function concluirTarefa(tarefa) {
    const { error } = await supabase.from('tarefas').update({ status: 'concluida' }).eq('id', tarefa.id);
    if (!error) {
      setListaTarefas((atuais) => atuais.map((t) => t.id === tarefa.id ? { ...t, status: "concluida" } : t));
      showToast("Parabéns! Tarefa concluída com sucesso.");
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
         <img src="/logo.png" alt="Logo Platino" className="brand-icon" />
          <div>
            <strong>WORKSPACE</strong>
            <span>Administrativo</span>
          </div>
        </div>
        <nav>
          <a>Minhas Tarefas</a>
          <a>Central de Recursos</a>
        </nav>
        <button className="btn-secondary full" onClick={onLogout}>Sair</button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>Olá, {usuario.nome}</h1>
            <p>Acompanhe sua pauta diária na esteira operacional.</p>
          </div>
          <div className="profile-pill">
            <span>{usuario.cargo}</span>
          </div>
        </header>

        <section className="content-grid">
          <div className="panel large">
            <h2>Minhas tarefas</h2>
            {minhasTarefas.length === 0 ? <p>Nenhuma tarefa atribuída no momento.</p> : null}
            
            {minhasTarefas.map((tarefa) => (
              <div className="task-item" key={tarefa.id}>
                <div>
                  <h3>{tarefa.titulo}</h3>
                  <p>{tarefa.descricao}</p>
                  <small>Prazo: {tarefa.prazo}</small>
                </div>
                <div className="task-actions">
                  <span className={`status ${tarefa.status}`}>
                    {tarefa.status.replaceAll("_", " ")}
                  </span>
                  {tarefa.status === "pendente" && (
                    <button className="btn-success" onClick={() => concluirTarefa(tarefa)}>
                      Concluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="side-stack">
            <div className="panel" style={{ border: '1px solid #3b82f6' }}>
              <h2 style={{ color: '#1e3a8a' }}>Central de Recursos</h2>
              <p style={{ marginBottom: '16px', fontSize: '14px' }}>Acesse rapidamente os documentos e planilhas da operação.</p>
              
              <a href="https://docs.google.com/spreadsheets/d/1MvKj4uO1GJL1XKJMqM5c2dauAG6q8yKt7fYxGaRMBKI/edit?usp=sharing" target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                <button className="btn-primary full" style={{ marginBottom: '10px' }}>📊 Planilha Geral 2026</button>
              </a>

              <a href="https://drive.google.com/drive/folders/1lAyvvD_NawsHSDpcYxXdruhv5COmjXXI?usp=drive_link" target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                <button className="btn-secondary full" style={{ marginBottom: '10px' }}>📁 Modelos Judiciais (Drive)</button>
              </a>

              <a href="https://ledjqodwccotuxdrkjgk.supabase.co/storage/v1/object/sign/TRATATIVAS%20JURIDICO/esteira-juridico.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NmQyNjRmMy1mNjg4LTQ1YmItYjlkNS1mMjQ1MjM3YTJhODUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJUUkFUQVRJVkFTIEpVUklESUNPL2VzdGVpcmEtanVyaWRpY28ucGRmIiwiaWF0IjoxNzgwMzg2Mzc2LCJleHAiOjE4MTE5MjIzNzZ9.xoVDXx75TgGiuBIzfhi5n1X01sWAWOkGsyYU4HMOU-M" target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                <button className="btn-secondary full" style={{ marginBottom: '10px' }}>📄 Esteira Jurídico (PDF)</button>
              </a>

              <a href="https://ledjqodwccotuxdrkjgk.supabase.co/storage/v1/object/sign/TRATATIVAS%20ADM/esteira-adm.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV83NmQyNjRmMy1mNjg4LTQ1YmItYjlkNS1mMjQ1MjM3YTJhODUiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJUUkFUQVRJVkFTIEFETS9lc3RlaXJhLWFkbS5wZGYiLCJpYXQiOjE3ODAzODY0MTUsImV4cCI6MTgxMTkyMjQxNX0.foSBNz4TUEF_QuIVLXa8auQvUFeoqHMTiH-GFTaSJYQ" target="_blank" rel="noreferrer" style={{textDecoration: 'none'}}>
                <button className="btn-secondary full">📄 Esteira ADM (PDF)</button>
              </a>
            </div>
          </div>
        </section>
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
  const [toastMessage, setToastMessage] = useState("");

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  }

  // Busca dados do Supabase ao iniciar
  useEffect(() => {
    async function fetchData() {
      const { data: tarefasData } = await supabase.from('tarefas').select('*');
      if (tarefasData) setListaTarefas(tarefasData);

      const { data: funcData } = await supabase.from('funcionarios').select('*');
      if (funcData) setFuncionarios(funcData);
    }
    fetchData();
  }, []);

  const globais = { listaTarefas, setListaTarefas, funcionarios, showToast };

  return (
    <>
      <style>{`
        :root {
          --bg-main: #eef7ff;
          --bg-card: #ffffff;
          --accent: #3b82f6;
          --dark: #1e3a8a;
          --text: #334155;
          --muted: #64748b;
          --green: #22c55e;
          --warning: #f59e0b;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Inter, sans-serif; }
        body { background: var(--bg-main); color: var(--text); }
        button, input { font-family: inherit; }

        .login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .login-card { width: 100%; max-width: 440px; background: var(--bg-card); border-radius: 24px; padding: 40px; box-shadow: 0 20px 40px rgba(30, 58, 138, 0.08); text-align: center; }
        
        /* CORRIGIDO AQUI: Estilos focados em Imagem */
        .brand-badge { 
          width: 100px; 
          height: 100px; 
          border-radius: 50%; 
          object-fit: cover;
          display: block;
          margin: 0 auto 20px auto; 
          box-shadow: 0 8px 16px rgba(30, 58, 138, 0.15); 
        }

        .brand-icon { 
          width: 46px; 
          height: 46px; 
          border-radius: 50%; 
          object-fit: cover;
          box-shadow: 0 4px 8px rgba(30, 58, 138, 0.1);
        }
        
        h1 { font-size: 22px; color: var(--dark); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        p { color: var(--muted); line-height: 1.5; }

        .app-layout { min-height: 100vh; display: grid; grid-template-columns: 260px 1fr; }
        .sidebar { background: var(--bg-card); border-right: 1px solid #dbeafe; padding: 24px; display: flex; flex-direction: column; gap: 30px; height: 100vh; position: sticky; top: 0; }
        
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand strong { display: block; color: var(--dark); font-size: 16px; letter-spacing: 0.5px;}
        .brand span { font-size: 12px; color: var(--muted); text-transform: uppercase;}

        .sidebar nav { display: flex; flex-direction: column; gap: 8px; flex: 1; }
        .sidebar nav a { padding: 12px 16px; border-radius: 12px; color: var(--text); font-weight: 500; cursor: pointer; transition: 0.2s; }
        .sidebar nav a:hover { background: #eef7ff; color: var(--accent); }

        .main-content { padding: 32px; }
        .topbar { background: var(--bg-card); border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(30, 58, 138, 0.03); display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; }
        
        .profile-pill { padding: 10px 18px; border-radius: 999px; background: #eef7ff; color: var(--accent); font-weight: 700; border: 1px solid #bfdbfe; }

        .cards-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .card, .panel { background: var(--bg-card); border-radius: 20px; padding: 24px; box-shadow: 0 10px 30px rgba(30, 58, 138, 0.03); border: 1px solid #e2e8f0; }
        .card { border-bottom: 4px solid var(--accent); transition: transform 0.2s; text-align: center; }
        .card:hover { transform: translateY(-4px); }
        .card span { display: block; color: var(--muted); font-size: 14px; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; }
        .card strong { color: var(--dark); font-size: 24px; }

        .content-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr); gap: 24px; align-items: start; }
        .side-stack { display: flex; flex-direction: column; gap: 20px; }
        .panel h2 { color: var(--dark); margin-bottom: 20px; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }

        .task-item { padding: 20px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .task-item h3 { color: var(--dark); margin-bottom: 6px; font-size: 16px; }
        
        .status { padding: 6px 12px; border-radius: 999px; font-size: 12px; text-transform: uppercase; font-weight: 700; white-space: nowrap; }
        .status.pendente { background: #fef3c7; color: #b45309; }
        .status.concluida { background: #dcfce7; color: #15803d; }

        .btn-primary, .btn-secondary, .btn-success { border: none; padding: 12px 20px; border-radius: 12px; cursor: pointer; font-weight: 600; transition: 0.2s; }
        .btn-primary:hover, .btn-secondary:hover, .btn-success:hover { filter: brightness(0.95); }
        .btn-primary { background: var(--accent); color: white; }
        .btn-secondary { background: #f1f5f9; color: var(--text); border: 1px solid #cbd5e1; }
        .btn-success { background: var(--green); color: white; }
        .full { width: 100%; }

        .toast-message { position: fixed; bottom: 30px; right: 30px; background: var(--dark); color: white; padding: 16px 24px; border-radius: 12px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.2); font-weight: 500; animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (max-width: 1024px) {
          .app-layout { grid-template-columns: 1fr; }
          .sidebar { height: auto; position: relative; }
          .cards-grid { grid-template-columns: repeat(2, 1fr); }
          .content-grid { grid-template-columns: 1fr; }
          .task-item { flex-direction: column; align-items: flex-start; }
        }
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