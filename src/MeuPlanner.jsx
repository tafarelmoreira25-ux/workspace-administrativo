import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export default function MeuPlanner({ funcionariaLogadaId }) {
  const [notas, setNotas] = useState([]);
  const [conteudo, setConteudo] = useState('');
  const [categoria, setCategoria] = useState('Avisos');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!funcionariaLogadaId) return;

    async function buscarNotas() {
      const { data, error } = await supabase
        .from('planner_diario')
        .select('*')
        .eq('funcionaria_id', funcionariaLogadaId)
        .order('created_at', { ascending: false });

      if (error) {
        alert(`Erro ao abrir o planner: ${error.message}`);
      }

      if (data) setNotas(data);
      setCarregando(false);
    }

    buscarNotas();
  }, [funcionariaLogadaId]);

  const adicionarNota = async (event) => {
    event.preventDefault();
    if (!conteudo.trim()) return;

    const novaNota = {
      funcionaria_id: funcionariaLogadaId,
      categoria,
      conteudo: conteudo.trim(),
      concluido: false,
    };

    const { data, error } = await supabase
      .from('planner_diario')
      .insert([novaNota])
      .select();

    if (!error && data) {
      setNotas((atuais) => [data[0], ...atuais]);
      setConteudo('');
    } else {
      alert(`Erro ao salvar nota no planner: ${error?.message || 'registro não confirmado'}`);
    }
  };

  const alternarStatus = async (id, statusAtual) => {
    const { data, error } = await supabase
      .from('planner_diario')
      .update({ concluido: !statusAtual })
      .eq('id', id)
      .eq('funcionaria_id', funcionariaLogadaId)
      .select('id, concluido')
      .maybeSingle();

    if (!error && data) {
      setNotas((atuais) =>
        atuais.map((nota) =>
          nota.id === id ? { ...nota, concluido: data.concluido } : nota,
        ),
      );
    } else {
      alert(`Erro ao atualizar nota: ${error?.message || 'registro não confirmado'}`);
    }
  };

  const deletarNota = async (id) => {
    const { data, error } = await supabase
      .from('planner_diario')
      .delete()
      .eq('id', id)
      .eq('funcionaria_id', funcionariaLogadaId)
      .select('id')
      .maybeSingle();

    if (!error && data) {
      setNotas((atuais) => atuais.filter((nota) => nota.id !== id));
    } else {
      alert(`Erro ao excluir nota: ${error?.message || 'registro não confirmado'}`);
    }
  };

  const colunas = [
    {
      categoria: 'Avisos',
      legenda: 'Acompanhar',
      titulo: 'Avisos importantes',
      vazio: 'Nenhum aviso no momento.',
      classe: 'planner-avisos',
      cor: '#6fa8ed',
    },
    {
      categoria: 'Metas',
      legenda: 'Priorizar',
      titulo: 'Metas do dia',
      vazio: 'Registre seus objetivos de hoje.',
      classe: 'planner-metas',
      cor: '#7d91e8',
    },
    {
      categoria: 'Cronograma',
      legenda: 'Planejar',
      titulo: 'Cronograma',
      vazio: 'Organize seus horários.',
      classe: 'planner-cronograma',
      cor: '#55b9d5',
    },
  ];

  if (carregando) {
    return <p className="loading-state">Abrindo seu planner...</p>;
  }

  return (
    <div className="planner-workspace">
      <div className="planner-header panel">
        <span className="eyebrow">Organização pessoal</span>
        <h2>Meu Planner Diário</h2>
        <p>Registre prioridades, acompanhe metas e mantenha o dia sob controle.</p>

        <form onSubmit={adicionarNota} className="planner-form">
          <select
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
            aria-label="Categoria da nota"
          >
            <option value="Avisos">Lembretes e avisos</option>
            <option value="Metas">Metas do dia</option>
            <option value="Cronograma">Cronograma de horários</option>
          </select>

          <input
            type="text"
            placeholder="O que você precisa registrar?"
            value={conteudo}
            onChange={(event) => setConteudo(event.target.value)}
          />

          <button type="submit" className="btn-primary">
            Adicionar nota
          </button>
        </form>
      </div>

      <div className="planner-grid">
        {colunas.map((coluna) => {
          const notasDaColuna = notas.filter(
            (nota) => nota.categoria === coluna.categoria,
          );

          return (
            <section
              className={`planner-column ${coluna.classe}`}
              key={coluna.categoria}
            >
              <div className="planner-column-title">
                <span className="planner-dot" />
                <div>
                  <span>{coluna.legenda}</span>
                  <h3>{coluna.titulo}</h3>
                </div>
              </div>

              {notasDaColuna.length === 0 && (
                <p className="planner-empty">{coluna.vazio}</p>
              )}

              {notasDaColuna.map((nota) => (
                <NotaCard
                  key={nota.id}
                  nota={nota}
                  onToggle={alternarStatus}
                  onDelete={deletarNota}
                  corCheck={coluna.cor}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function NotaCard({ nota, onToggle, onDelete, corCheck }) {
  return (
    <div
      className={`note-card ${nota.concluido ? 'completed' : ''}`}
      style={{ '--note-accent': corCheck }}
    >
      <input
        type="checkbox"
        checked={nota.concluido}
        onChange={() => onToggle(nota.id, nota.concluido)}
        className="note-check"
        aria-label={nota.concluido ? 'Marcar como pendente' : 'Marcar como concluído'}
      />
      <span className="note-text">{nota.conteudo}</span>
      <button
        onClick={() => onDelete(nota.id)}
        className="note-delete"
        title="Excluir"
        aria-label="Excluir nota"
      >
        ×
      </button>
    </div>
  );
}
