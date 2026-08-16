import { useState } from "react";

function formatarData(data) {
  if (!data) return "Data não registrada";
  const texto = String(data);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: texto.includes("T") ? "short" : undefined,
  }).format(new Date(texto.includes("T") ? texto : `${texto}T12:00:00`));
}

function linkGoogleDrive(url) {
  return /^https:\/\/(drive|docs)\.google\.com\//i.test(String(url || "").trim());
}

export default function MeuHistorico({ tarefas = [], onVoltar }) {
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(tarefas.length / 15));
  const tarefasVisiveis = tarefas.slice((pagina - 1) * 15, pagina * 15);

  return (
    <div className="panel large">
      <div className="panel-title-row">
        <h2>Meu Histórico de Atividades</h2>
        <div className="task-history-actions">
          <small>{tarefas.length} concluída(s)</small>
          {onVoltar && <button className="btn-secondary compact" onClick={onVoltar} type="button">Voltar para tarefas da equipe</button>}
        </div>
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
              {linkGoogleDrive(tarefa.drive_document_url || tarefa.evidencia_url) && <a className="drive-document-link" href={tarefa.drive_document_url || tarefa.evidencia_url} target="_blank" rel="noreferrer">↗ Ver documento no Google Drive</a>}
            </div>
            <span className="status concluida">Concluída</span>
          </div>
        ))
      )}
      {tarefas.length > 15 && <div className="task-history-actions">
        <button className="btn-secondary compact" disabled={pagina === 1} onClick={() => setPagina((atual) => atual - 1)} type="button">Anterior</button>
        <small>PÃ¡gina {pagina} de {totalPaginas}</small>
        <button className="btn-secondary compact" disabled={pagina >= totalPaginas} onClick={() => setPagina((atual) => atual + 1)} type="button">PrÃ³xima</button>
      </div>}
    </div>
  );
}
