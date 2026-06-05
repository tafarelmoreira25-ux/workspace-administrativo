import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import MeuHistorico from './MeuHistorico';
import MeuPlanner from './MeuPlanner';

// Configuração Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [listaTarefas, setListaTarefas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState("dashboard");

  // Carrega dados iniciais
  useEffect(() => {
    async function fetchData() {
      const { data: t } = await supabase.from('tarefas').select('*');
      const { data: f } = await supabase.from('funcionarios').select('*');
      if (t) setListaTarefas(t); 
      if (f) setFuncionarios(f);
    }
    fetchData();
  }, []);

  // --- TELA DE LOGIN (Simplificada) ---
  if (!usuarioLogado) {
    return (
      <div className="login-container" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '350px' }}>
          <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Login Workspace</h2>
          <button onClick={() => setUsuarioLogado({ nome: 'Tafarel', tipo: 'admin' })} className="btn-primary" style={{ width: '100%', padding: '10px' }}>Entrar como Admin</button>
        </div>
      </div>
    );
  }

  // --- ESTRUTURA PRINCIPAL (Pós-Login) ---
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: '250px', background: '#1e293b', color: '#fff', padding: '20px' }}>
        <h3 style={{ marginBottom: '20px' }}>Menu</h3>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a onClick={() => setAbaAtiva("dashboard")} style={{ cursor: 'pointer' }}>Dashboard</a>
          <a onClick={() => setAbaAtiva("planner")} style={{ cursor: 'pointer' }}>Planner</a>
          <a onClick={() => setAbaAtiva("historico")} style={{ cursor: 'pointer' }}>Histórico</a>
          <button onClick={() => setUsuarioLogado(null)} style={{ marginTop: '20px', color: 'red' }}>Sair</button>
        </nav>
      </aside>

      <main style={{ flex: 1, padding: '40px' }}>
        {abaAtiva === "dashboard" && <h1>Bem-vindo, {usuarioLogado.nome}</h1>}
        {abaAtiva === "planner" && <MeuPlanner funcionariaLogadaId={usuarioLogado.id} />}
        {abaAtiva === "historico" && <MeuHistorico funcionariaLogadaId={usuarioLogado.id} />}
      </main>
    </div>
  );
}