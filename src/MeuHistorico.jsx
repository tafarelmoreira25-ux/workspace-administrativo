import { useState } from "react";

function formatarData(data) {
  if (!data) return "Data não registrada";
  const texto = String(data);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: texto.includes("T") ? "short" : undefined,
  }).format(new Date(texto.includes("T") ? texto : `${texto}T12:00:00`));
}

export default function MeuHistorico({ tarefas = [] }) {
  const [limite, setLimite] = useState(15);
  const tarefasVisiveis = tarefas.slice(0, limite);

  return (
    <div className="panel large">
      <div className="panel-title-row">
        <h2>Meu Histórico de Atividades</h2>
        <small>{tarefas.length} concluída(s)</small>
      </div>
      {tarefas.length === 0 ? (
        <p>Você ainda não possui tarefas concluídas.</p>
      ) : (
        tarefasVisiveis.map((tarefa) => (
          <div className="task-item" key={tarefa.id}>
            <div>
              <h3>{tarefa.titulo}</h3>
              <p>{tarefa.descricao || "Sem descrição."}</p>
              <small>
                Concluída em: {formatarData(tarefa.concluida_em)} |
                Pontos: {tarefa.pontos_tarefa || 10}
              </small>
            </div>
            <span className="status concluida">Concluída</span>
          </div>
        ))
      )}
      {limite < tarefas.length && (
        <button
          className="btn-secondary compact"
          onClick={() => setLimite((atual) => atual + 15)}
          type="button"
        >
          Mostrar mais 15
        </button>
      )}
    </div>
  );
}
