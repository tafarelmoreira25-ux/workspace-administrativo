import MeuHistorico from './MeuHistorico';
import MeuPlanner from './MeuPlanner';
import GeradorDocumentos from './GeradorDocumentos';
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// 1. CONFIGURAÇÕES E CONEXÕES
// ==========================================
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
      {type === 'feedback' ? '💬' : type === 'ranking' ? '🏆' : type === 'tarefas' ? '📋' : '👥'}
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
    const { error: authError } = await supabase.auth.signInWithPassword({
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
      await onLogin({
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

    await onLogin({ ...funcData, tipo: "funcionaria" });
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
  const { listaTarefas, setListaTarefas, funcionarios, setFuncionarios, showToast } = state;
  const [abaAtiva, setAbaAtiva] = useState("dashboard"); 

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [funcId, setFuncId] = useState("");
  const [pontosTarefa, setPontosTarefa] = useState(10);
  const [dataLimite, setDataLimite] = useState("");

  const [feedbackFuncId, setFeedbackFuncId] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackTipo, setFeedbackTipo] = useState("positivo");

  const tarefasPendentes = listaTarefas.filter((t) => t.status === "pendente");

  async function handleCriarTarefa(e) {
    e.preventDefault();
    if (!titulo || !funcId) return alert("Preencha o título e selecione a responsável.");

    const novaTarefa = {
      titulo: titulo,
      descricao: descricao,
      funcionaria_id: parseInt(funcId),
      pontos_tarefa: parseInt(pontosTarefa),
      data_limite: dataLimite || null,
      status: "pendente"
    };

    const { data, error } = await supabase.from("tarefas").insert([novaTarefa]).select();

    if (error) {
      alert("Erro ao salvar tarefa: " + error.message);
    } else {
      if (data) setListaTarefas((anteriores) => [...anteriores, data[0]]);
      showToast("Tarefa delegada com sucesso!");
      setTitulo("");
      setDescricao("");
      setFuncId("");
      setDataLimite("");
    }
  }

  async function alterarPontosFuncionario(id, quantidade) {
    const funcionario = funcionarios.find(f => f.id === id);
    if (!funcionario) return;

    const novosPontos = Math.max(0, (funcionario.pontos || 0) + quantidade);

    const { error } = await supabase
      .from("funcionarios")
      .update({ pontos: novosPontos })
      .eq("id", id);

    if (error) {
      alert("Erro ao atualizar pontos: " + error.message);
    } else {
      setFuncionarios((anteriores) =>
        anteriores.map((f) => (f.id === id ? { ...f, pontos: novosPontos } : f))
      );
      showToast(`Pontos atualizados com sucesso!`);
    }
  }

  async function handleEnviarFeedback(e) {
    e.preventDefault();
    if (!feedbackFuncId || !feedbackMsg) return alert("Selecione a funcionária e digite a mensagem.");

    const novoFeedback = {
      funcionaria_id: parseInt(feedbackFuncId),
      mensagem: feedbackMsg,
      tipo: feedbackTipo
    };

    const { error } = await supabase.from("feedbacks").insert([novoFeedback]);

    if (error) {
      alert("Erro ao enviar feedback: " + error.message);
    } else {
      showToast("Feedback enviado com sucesso!");
      setFeedbackMsg("");
      setFeedbackFuncId("");
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
          <a onClick={() => setAbaAtiva("dashboard")} className={abaAtiva === "dashboard" ? "active-tab" : ""}>Dashboard</a>
          <a onClick={() => setAbaAtiva("tarefas")} className={abaAtiva === "tarefas" ? "active-tab" : ""}>Tarefas</a>
          <a onClick={() => setAbaAtiva("equipe")} className={abaAtiva === "equipe" ? "active-tab" : ""}>Equipe</a>
          <a onClick={() => setAbaAtiva("documentos")} className={abaAtiva === "documentos" ? "active-tab" : ""}>Documentos PDF</a>
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

        {abaAtiva === "dashboard" && (
          <>
            <section className="cards-grid">
              <div className="card" onClick={() => setAbaAtiva("tarefas")} style={{ cursor: 'pointer' }}>
                <IconPlaceholder type="tarefas" />
                <span>Tarefas Pendentes</span>
                <strong>{tarefasPendentes.length}</strong>
              </div>
              <div className="card" onClick={() => setAbaAtiva("equipe")} style={{ cursor: 'pointer' }}>
                <IconPlaceholder type="ranking" />
                <span>Ranking Geral</span>
                <strong>Top 3</strong>
              </div>
              <div className="card" onClick={() => setAbaAtiva("equipe")} style={{ cursor: 'pointer' }}>
                <IconPlaceholder type="feedback" />
                <span>Feedbacks</span>
                <strong>Gerenciar</strong>
              </div>
              <div className="card" onClick={() => setAbaAtiva("equipe")} style={{ cursor: 'pointer' }}>
                <IconPlaceholder type="equipe" />
                <span>Equipe</span>
                <strong>{funcionarios.length} Ativas</strong>
              </div>
            </section>

            <section className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="panel large">
                <h2 className="section-title">Acompanhamento da Esteira (Visão Geral)</h2>
                {listaTarefas.length === 0 ? <p>Nenhuma tarefa listada no sistema.</p> : null}
                {listaTarefas.map((tarefa) => {
                  const func = funcionarios.find((item) => item.id === tarefa.funcionaria_id);
                  return (
                    <div className="task-item" key={tarefa.id}>
                      <div>
                        <h3>{tarefa.titulo}</h3>
                        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>{tarefa.descricao}</p>
                        <small>
                          Responsável: <strong>{func?.nome || 'Não atribuída'}</strong> | 
                          Pontos: {tarefa.pontos_tarefa || 10} | 
                          Prazo: {tarefa.data_limite ? new Date(tarefa.data_limite).toLocaleDateString('pt-BR') : 'Sem prazo'}
                        </small>
                      </div>
                      <span className={`status ${tarefa.status}`}>{tarefa.status}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {abaAtiva === "tarefas" && (
          <section className="content-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="panel">
              <h2>Delegar Nova Tarefa</h2>
              <form onSubmit={handleCriarTarefa} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input 
                  type="text" placeholder="Título da tarefa" value={titulo} 
                  onChange={(e) => setTitulo(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required
                />
                <textarea 
                  placeholder="Descrição das tratativas ou procedimentos" value={descricao} 
                  onChange={(e) => setDescricao(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', height: '100px' }}
                />
                <select 
                  value={funcId} onChange={(e) => setFuncId(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required
                >
                  <option value="">Atribuir para...</option>
                  {funcionarios.map(f => (
                    <option key={f.id} value={f.id}>{f.nome} ({f.cargo})</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Pontos da Missão</label>
                    <input 
                      type="number" value={pontosTarefa} onChange={(e) => setPontosTarefa(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Data Limite / Prazo</label>
                    <input 
                      type="date" value={dataLimite} onChange={(e) => setDataLimite(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>Publicar Tarefa na Esteira</button>
              </form>
            </div>

            <div className="panel">
              <h2>Lista Completa das Atividades</h2>
              {listaTarefas.map((tarefa) => (
                <div className="task-item" key={tarefa.id} style={{ padding: '12px', marginBottom: '8px' }}>
                  <div>
                    <h4>{tarefa.titulo}</h4>
                    <span className={`status ${tarefa.status}`} style={{ fontSize: '10px', padding: '2px 8px' }}>{tarefa.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {abaAtiva === "equipe" && (
          <section className="content-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="panel">
              <h2>Membros da Equipe e Placar de Pontos</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '15px' }}>
                {funcionarios.map((f) => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <strong style={{ fontSize: '16px', color: '#1e3a8a' }}>{f.nome}</strong>
                      <p style={{ fontSize: '13px', margin: 0 }}>Esteira: {f.cargo}</p>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#22c55e' }}>✨ {f.pontos || 0} Pontos Acumulados</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn-success" onClick={() => alterarPontosFuncionario(f.id, 10)} style={{ padding: '6px 12px', fontSize: '12px' }}>+10 Pts</button>
                      <button className="btn-secondary" onClick={() => alterarPontosFuncionario(f.id, -10)} style={{ padding: '6px 12px', fontSize: '12px', background: '#fee2e2', color: '#ef4444', border: 'none' }}>-10 Pts</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>Enviar Feedback Profissional</h2>
              <form onSubmit={handleEnviarFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <select 
                  value={feedbackFuncId} onChange={(e) => setFeedbackFuncId(e.target.value)}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required
                >
                  <option value="">Escolha a colaboradora...</option>
                  {funcionarios.map(f => (
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
                <button type="submit" className="btn-primary">Registrar Feedback no Painel</button>
              </form>
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
  const { listaTarefas, setListaTarefas, recarregarTarefas, showToast } = state;
  const [abaAtiva, setAbaAtiva] = useState("tarefas");
  const [tarefaConcluindoId, setTarefaConcluindoId] = useState(null);

  const minhasTarefas = listaTarefas.filter(
    (tarefa) => String(tarefa.funcionaria_id) === String(usuario.id),
  );

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
        "A tarefa não foi atualizada no banco. O acesso desta usuária precisa da permissão de atualização no Supabase.",
      );
      setTarefaConcluindoId(null);
      return;
    }

    setListaTarefas((atuais) =>
      atuais.map((item) =>
        item.id === tarefa.id ? { ...item, status: tarefaAtualizada.status } : item,
      ),
    );

    try {
      await recarregarTarefas();
      showToast("Parabéns! Tarefa concluída com sucesso.");
    } catch (erroRecarregamento) {
      console.error("Erro ao confirmar tarefa no servidor:", erroRecarregamento);
      showToast("Tarefa concluída. Atualize a página para sincronizar a lista.");
    } finally {
      setTarefaConcluindoId(null);
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
          <a onClick={() => setAbaAtiva("tarefas")} className={abaAtiva === "tarefas" ? "active-tab" : ""}>Minhas Tarefas</a>
          <a onClick={() => setAbaAtiva("historico")} className={abaAtiva === "historico" ? "active-tab" : ""}>Meu Histórico</a>
          <a onClick={() => setAbaAtiva("planner")} className={abaAtiva === "planner" ? "active-tab" : ""}>Meu Planner</a>
          <a onClick={() => setAbaAtiva("documentos")} className={abaAtiva === "documentos" ? "active-tab" : ""}>Documentos PDF</a>
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

        {abaAtiva === "tarefas" && (
          <section className="content-grid">
            <div className="panel large">
              <h2>Minhas tarefas</h2>
              {minhasTarefas.length === 0 ? <p>Nenhuma tarefa atribuída no momento.</p> : null}
              
              {minhasTarefas.map((tarefa) => (
                <div className="task-item" key={tarefa.id}>
                  <div>
                    <h3>{tarefa.titulo}</h3>
                    <p>{tarefa.descricao}</p>
                    <small>
                      Prazo final: {tarefa.data_limite ? new Date(tarefa.data_limite).toLocaleDateString('pt-BR') : 'Sem prazo definido'} | 
                      Recompensa: +{tarefa.pontos_tarefa || 10} Pontos
                    </small>
                  </div>
                  <div className="task-actions">
                    <span className={`status ${tarefa.status}`}>
                      {tarefa.status}
                    </span>
                    {tarefa.status === "pendente" && (
                      <button
                        className="btn-success"
                        disabled={tarefaConcluindoId === tarefa.id}
                        onClick={() => concluirTarefa(tarefa)}
                      >
                        {tarefaConcluindoId === tarefa.id ? "Confirmando..." : "Concluir"}
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
        )}

        {abaAtiva === "historico" && (
          <MeuHistorico funcionariaLogadaId={usuario.id} />
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
  const [toastMessage, setToastMessage] = useState("");

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  }

  async function recarregarTarefas() {
    const { data, error } = await supabase
      .from("tarefas")
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;
    setListaTarefas(data || []);
    return data || [];
  }

  async function recarregarFuncionarios() {
    const { data, error } = await supabase
      .from("funcionarios")
      .select("*")
      .order("pontos", { ascending: false });

    if (error) throw error;
    setFuncionarios(data || []);
    return data || [];
  }

  async function handleLogin(usuario) {
    setUsuarioLogado(usuario);

    try {
      await Promise.all([recarregarTarefas(), recarregarFuncionarios()]);
    } catch (error) {
      console.error("Erro ao carregar dados após o login:", error);
      showToast("Login realizado, mas houve erro ao sincronizar os dados.");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUsuarioLogado(null);
    setListaTarefas([]);
    setFuncionarios([]);
  }

  const globais = {
    listaTarefas,
    setListaTarefas,
    funcionarios,
    setFuncionarios,
    recarregarTarefas,
    showToast,
  };

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
        button, input, select, textarea { font-family: inherit; }

        .login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .login-card { width: 100%; max-width: 440px; background: var(--bg-card); border-radius: 24px; padding: 40px; box-shadow: 0 20px 40px rgba(30, 58, 138, 0.08); text-align: center; }
        
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
        .sidebar nav a:hover, .sidebar nav a.active-tab { background: #eef7ff; color: var(--accent); font-weight: bold; }

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

        .document-workspace { display: flex; flex-direction: column; gap: 24px; }
        .document-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
        .document-heading h2 { color: var(--dark); font-size: 28px; margin: 4px 0 6px; }
        .eyebrow { color: var(--accent); font-size: 12px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; }
        .document-number { background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 14px; padding: 12px 16px; color: var(--dark); }
        .document-number span { display: block; color: var(--muted); font-size: 11px; margin-bottom: 4px; text-transform: uppercase; }
        .document-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.75fr); gap: 24px; align-items: start; }
        .document-form { display: flex; flex-direction: column; gap: 24px; }
        .document-form fieldset { border: 0; padding: 0; }
        .document-form legend { color: var(--dark); font-size: 15px; font-weight: 800; margin-bottom: 14px; text-transform: uppercase; }
        .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .form-grid label { color: #475569; display: flex; flex-direction: column; font-size: 12px; font-weight: 700; gap: 6px; }
        .form-grid .span-2 { grid-column: span 2; }
        .form-grid input, .form-grid select, .form-grid textarea { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; color: var(--text); font-size: 14px; outline: none; padding: 11px 12px; width: 100%; }
        .form-grid textarea { line-height: 1.5; resize: vertical; }
        .form-grid input:focus, .form-grid select:focus, .form-grid textarea:focus { background: white; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12); }
        .form-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #b91c1c; font-size: 13px; padding: 10px 12px; }
        .document-actions { border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; padding-top: 20px; }
        button:disabled { cursor: wait; opacity: 0.65; }
        .pdf-preview { position: sticky; top: 24px; }
        .preview-page { aspect-ratio: 1 / 1.414; background: white; border: 1px solid #dbeafe; box-shadow: 0 18px 40px rgba(30, 58, 138, 0.12); color: #334155; display: flex; flex-direction: column; padding: 28px; }
        .preview-header { align-items: center; background: var(--dark); color: white; display: flex; gap: 10px; margin: -28px -28px 18px; padding: 18px 24px; }
        .preview-header img { background: white; border-radius: 50%; height: 34px; object-fit: cover; width: 34px; }
        .preview-header strong, .preview-header span { display: block; }
        .preview-header span { font-size: 8px; opacity: 0.8; }
        .preview-meta { display: flex; justify-content: space-between; color: #64748b; font-size: 8px; text-transform: uppercase; }
        .preview-page h3 { color: var(--dark); font-size: 17px; margin: 22px 0; text-align: center; text-transform: uppercase; }
        .preview-section { border-top: 1px solid #dbeafe; padding: 12px 0 4px; }
        .preview-section span, .preview-highlight span { color: var(--accent); display: block; font-size: 8px; font-weight: 800; margin-bottom: 5px; text-transform: uppercase; }
        .preview-section strong { color: var(--dark); font-size: 11px; }
        .preview-section p { display: -webkit-box; font-size: 9px; line-height: 1.5; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }
        .preview-highlight { align-items: center; background: #eff6ff; border-radius: 8px; display: flex; justify-content: space-between; margin-top: 12px; padding: 10px; }
        .preview-highlight span { margin: 0; }
        .preview-highlight strong { color: var(--dark); font-size: 12px; }
        .preview-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: auto; padding-top: 20px; }
        .preview-signatures span { border-top: 1px solid #94a3b8; color: #64748b; font-size: 8px; padding-top: 5px; text-align: center; }
        .preview-note { font-size: 11px; margin-top: 12px; text-align: center; }

        @media (max-width: 1024px) {
          .app-layout { grid-template-columns: 1fr; }
          .sidebar { height: auto; position: relative; }
          .cards-grid { grid-template-columns: repeat(2, 1fr); }
          .content-grid { grid-template-columns: 1fr; }
          .task-item { flex-direction: column; align-items: flex-start; }
          .document-grid { grid-template-columns: 1fr; }
          .pdf-preview { margin: 0 auto; max-width: 480px; position: static; width: 100%; }
        }

        @media (max-width: 640px) {
          .main-content { padding: 18px; }
          .document-heading { align-items: flex-start; flex-direction: column; }
          .document-number { width: 100%; }
          .form-grid { grid-template-columns: 1fr; }
          .form-grid .span-2 { grid-column: span 1; }
          .document-actions { flex-direction: column-reverse; }
          .document-actions button { width: 100%; }
        }
      `}</style>
      
      <Toast message={toastMessage} onClose={() => setToastMessage("")} />

      {!usuarioLogado ? (
        <Login onLogin={handleLogin} />
      ) : usuarioLogado.tipo === "admin" ? (
        <AdminDashboard usuario={usuarioLogado} onLogout={handleLogout} state={globais} />
      ) : (
        <EmployeeDashboard usuario={usuarioLogado} onLogout={handleLogout} state={globais} />
      )}
    </>
  );
}
