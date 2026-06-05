import { useState, useEffect } from 'react';
// Atenção: Você precisará ajustar o caminho abaixo para onde está o seu arquivo de conexão do Supabase!
import { supabase } from '../supabaseClient'; 

export default function MeuHistorico({ funcionariaLogadaId }) {
  // Criando os espaços para guardar os dados
  const [tarefasConcluidas, setTarefasConcluidas] = useState([]);
  const [meusFeedbacks, setMeusFeedbacks] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // // ==========================================
  // INÍCIO DA PARTE 2: A BUSCA NO BANCO
  // ==========================================

  // O useEffect é o gatilho. Ele diz: "Assim que a tela carregar, faça a busca"
  useEffect(() => {
    if (funcionariaLogadaId) {
      buscarHistorico();
    }
  }, [funcionariaLogadaId]);

  // Esta é a função mensageira que vai até o Supabase
  const buscarHistorico = async () => {
    setCarregando(true); // Liga o aviso de "Carregando..." na tela

    // 1. Puxando as Tarefas
    const { data: dataTarefas, error: errorTarefas } = await supabase
      .from('tarefas')
      .select('*')
      .eq('funcionaria_id', funcionariaLogadaId) // Traz apenas as tarefas da dona do painel
      .eq('status', 'concluída'); // ATENÇÃO: se no seu painel você escreve "Concluído" ou "concluido", mude aqui para ficar igual!

    if (errorTarefas) {
      console.error("Erro nas tarefas:", errorTarefas);
    } else {
      setTarefasConcluidas(dataTarefas); // Guarda as tarefas no espaço de memória
    }

    // 2. Puxando os Feedbacks
    const { data: dataFeedbacks, error: errorFeedbacks } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('funcionaria_id', funcionariaLogadaId); // Traz todos os feedbacks dela

    if (errorFeedbacks) {
      console.error("Erro nos feedbacks:", errorFeedbacks);
    } else {
      setMeusFeedbacks(dataFeedbacks); // Guarda os feedbacks no espaço de memória
    }

    setCarregando(false); // Desliga o aviso de "Carregando..."
  };

  // ==========================================
  // FIM DA PARTE 2
  // ==========================================
  // INÍCIO DA PARTE 3: CALCULANDO O PLACAR
  // ==========================================
  
  // O sistema vai pegar todos os feedbacks e somar a pontuação automaticamente
  const pontosTotais = meusFeedbacks.reduce((soma, feedback) => {
    return soma + (feedback.pontos || 0);
  }, 0);

  // ==========================================
  // INÍCIO DA PARTE 4: A TELA VISUAL
  // ==========================================
  
  // Enquanto o mensageiro estiver buscando os dados, mostra isso:
  if (carregando) {
    return <p>Buscando o histórico no banco de dados...</p>;
  }

  // Quando ele voltar com os dados, desenha a tela final:
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Meu Histórico Profissional</h2>

      {/* BLOCO 1: O PLACAR */}
      <div style={{ background: '#f4f4f4', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Pontuação Atual</h3>
        {/* Se a pontuação for positiva fica verde, se for negativa fica vermelha */}
        <h1 style={{ color: pontosTotais >= 0 ? "green" : "red", margin: 0 }}>
          {pontosTotais} Pts
        </h1>
      </div>

      {/* BLOCO 2: AS TAREFAS */}
      <div style={{ background: '#eefbfa', padding: '15px', borderRadius: '8px' }}>
        <h3>Tarefas Concluídas ({tarefasConcluidas.length})</h3>
        
        {/* Se não tiver tarefas, mostra uma mensagem. Se tiver, cria a lista. */}
        {tarefasConcluidas.length === 0 ? (
          <p>Você ainda não possui tarefas finalizadas.</p>
        ) : (
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {tarefasConcluidas.map((tarefa) => (
              <li key={tarefa.id} style={{ borderBottom: "1px solid #ccc", padding: "10px 0" }}>
                <strong>{tarefa.titulo}</strong>
                {/* Se a coluna data_conclusao já existir no banco, podemos mostrar a data depois */}
                <p style={{ margin: '5px 0', color: '#555' }}>Pontos da missão: +{tarefa.pontos_tarefa}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
  // ==========================================
}