import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexão com o banco de dados (mesmo padrão do seu App.jsx)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "SUA_URL_AQUI";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "SUA_CHAVE_AQUI";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function MeuPlanner({ funcionariaLogadaId }) {
  const [notas, setNotas] = useState([]);
  const [conteudo, setConteudo] = useState("");
  const [categoria, setCategoria] = useState("Avisos");
  const [carregando, setCarregando] = useState(true);

  // Busca as notas assim que a tela abre
  useEffect(() => {
    if (funcionariaLogadaId) buscarNotas();
  }, [funcionariaLogadaId]);

  const buscarNotas = async () => {
    const { data } = await supabase
      .from('planner_diario')
      .select('*')
      .eq('funcionaria_id', funcionariaLogadaId)
      .order('created_at', { ascending: false }); // As mais novas aparecem primeiro
    
    if (data) setNotas(data);
    setCarregando(false);
  };

  // Salva uma nova nota
  const adicionarNota = async (e) => {
    e.preventDefault();
    if (!conteudo.trim()) return;

    const novaNota = {
      funcionaria_id: funcionariaLogadaId,
      categoria: categoria,
      conteudo: conteudo,
      concluido: false
    };

    const { data, error } = await supabase.from('planner_diario').insert([novaNota]).select();

    if (!error && data) {
      setNotas([data[0], ...notas]); // Adiciona na tela na hora
      setConteudo(""); // Limpa o campo de texto
    } else {
      alert("Erro ao salvar nota no planner.");
    }
  };

  // Marca como concluído ou pendente
  const alternarStatus = async (id, statusAtual) => {
    const { error } = await supabase.from('planner_diario').update({ concluido: !statusAtual }).eq('id', id);
    if (!error) {
      setNotas(notas.map(n => n.id === id ? { ...n, concluido: !statusAtual } : n));
    }
  };

  // Apaga a nota
  const deletarNota = async (id) => {
    const { error } = await supabase.from('planner_diario').delete().eq('id', id);
    if (!error) {
      setNotas(notas.filter(n => n.id !== id));
    }
  };

  // Separando as notas pelas colunas corretas
  const avisos = notas.filter(n => n.categoria === "Avisos");
  const metas = notas.filter(n => n.categoria === "Metas");
  const cronograma = notas.filter(n => n.categoria === "Cronograma");

  if (carregando) return <p>Abrindo seu planner...</p>;

  return (
    <div style={{ padding: '10px', fontFamily: 'sans-serif' }}>
      
      {/* CABEÇALHO DO PLANNER */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
        <h2 style={{ margin: '0 0 16px 0', color: '#1e3a8a' }}>✨ Meu Planner Diário</h2>
        
        <form onSubmit={adicionarNota} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select 
            value={categoria} 
            onChange={(e) => setCategoria(e.target.value)}
            style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none' }}
          >
            <option value="Avisos">📌 Lembretes e Avisos</option>
            <option value="Metas">🎯 Metas do Dia</option>
            <option value="Cronograma">⏰ Cronograma de Horários</option>
          </select>
          
          <input 
            type="text" 
            placeholder="O que você precisa registrar?" 
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none' }}
          />
          
          <button type="submit" style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
            + Adicionar
          </button>
        </form>
      </div>

      {/* AS TRÊS COLUNAS ACOLHEDORAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* COLUNA 1: AVISOS (Amarelinho/Laranja pastel) */}
        <div style={{ background: '#fffbeb', padding: '20px', borderRadius: '16px', border: '1px solid #fde68a' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>📌 Avisos Importantes</h3>
          {avisos.length === 0 && <p style={{ fontSize: '14px', color: '#92400e' }}>Nenhum aviso no momento.</p>}
          {avisos.map(nota => (
            <NotaCard key={nota.id} nota={nota} onToggle={alternarStatus} onDelete={deletarNota} corCheck="#d97706" />
          ))}
        </div>

        {/* COLUNA 2: METAS (Rosa pastel) */}
        <div style={{ background: '#fdf2f8', padding: '20px', borderRadius: '16px', border: '1px solid #fbcfe8' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#be185d', display: 'flex', alignItems: 'center', gap: '8px' }}>🎯 Metas do Dia</h3>
          {metas.length === 0 && <p style={{ fontSize: '14px', color: '#9d174d' }}>Quais são seus objetivos hoje?</p>}
          {metas.map(nota => (
            <NotaCard key={nota.id} nota={nota} onToggle={alternarStatus} onDelete={deletarNota} corCheck="#db2777" />
          ))}
        </div>

        {/* COLUNA 3: CRONOGRAMA (Verde/Azul pastel) */}
        <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}>⏰ Cronograma</h3>
          {cronograma.length === 0 && <p style={{ fontSize: '14px', color: '#166534' }}>Organize seus horários.</p>}
          {cronograma.map(nota => (
            <NotaCard key={nota.id} nota={nota} onToggle={alternarStatus} onDelete={deletarNota} corCheck="#16a34a" />
          ))}
        </div>

      </div>
    </div>
  );
}

// Componente visual de cada "post-it" (Nota)
function NotaCard({ nota, onToggle, onDelete, corCheck }) {
  return (
    <div style={{ 
      background: 'white', padding: '12px', borderRadius: '12px', marginBottom: '10px', 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)', borderLeft: `4px solid ${corCheck}`,
      opacity: nota.concluido ? 0.6 : 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <input 
          type="checkbox" 
          checked={nota.concluido} 
          onChange={() => onToggle(nota.id, nota.concluido)}
          style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: corCheck }}
        />
        <span style={{ textDecoration: nota.concluido ? 'line-through' : 'none', color: '#334155', fontSize: '14px', lineHeight: '1.4' }}>
          {nota.conteudo}
        </span>
      </div>
      <button onClick={() => onDelete(nota.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '16px' }} title="Excluir">
        ✖
      </button>
    </div>
  );
}