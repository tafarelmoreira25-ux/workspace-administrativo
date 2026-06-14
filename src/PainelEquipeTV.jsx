import { useEffect, useMemo, useState } from "react";

function formatarPrazo(data) {
  if (!data) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${data}T12:00:00`),
  );
}

function tarefaAtrasada(tarefa) {
  if (!tarefa.data_limite || tarefa.status === "concluida") return false;
  return tarefa.data_limite < new Date().toISOString().slice(0, 10);
}

function CartaoTV({ tarefa, funcionarios, tipo }) {
  const responsavel = funcionarios.find(
    (item) => String(item.id) === String(tarefa.funcionaria_id),
  );
  const nomeResponsavel =
    tarefa.responsavel_texto || responsavel?.nome || "Equipe";

  return (
    <article className={`tv-task-card tv-task-${tipo}`}>
      <div className="tv-task-heading">
        <div className="tv-task-labels">
          <span className="tv-responsavel">{nomeResponsavel}</span>
          {tarefa.categoria && (
            <span className="tv-category">{tarefa.categoria}</span>
          )}
        </div>
        {tarefaAtrasada(tarefa) && (
          <span className="tv-overdue">Prazo vencido</span>
        )}
      </div>
      <h3>{tarefa.titulo}</h3>
      {tarefa.descricao && <p>{tarefa.descricao}</p>}
      {tarefa.apontamento && (
        <div className="tv-note">
          <strong>Apontamento</strong>
          <span>{tarefa.apontamento}</span>
        </div>
      )}
      <footer>
        <span>Prazo: {formatarPrazo(tarefa.data_limite)}</span>
        {tarefa.status === "concluida" && tarefa.concluida_em && (
          <span>
            Concluida em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(tarefa.concluida_em))}
          </span>
        )}
      </footer>
    </article>
  );
}

function ColunaTV({
  classe,
  etiqueta,
  titulo,
  tarefas,
  funcionarios,
  vazio,
  tipo,
}) {
  return (
    <section className={`tv-column ${classe}`}>
      <header>
        <div>
          <span>{etiqueta}</span>
          <h2>{titulo}</h2>
        </div>
        <strong>{tarefas.length}</strong>
      </header>

      <div className="tv-column-list">
        {tarefas.length === 0 ? (
          <p className="tv-empty">{vazio}</p>
        ) : (
          tarefas.map((tarefa) => (
            <CartaoTV
              funcionarios={funcionarios}
              key={tarefa.id}
              tarefa={tarefa}
              tipo={tipo}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function PainelEquipeTV({
  tarefas = [],
  funcionarios = [],
  onAtualizar,
  onSair,
}) {
  const [agora, setAgora] = useState(new Date());
  const [atualizando, setAtualizando] = useState(false);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState(new Date());
  const [erroSincronizacao, setErroSincronizacao] = useState(false);

  useEffect(() => {
    const intervalo = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    let ativo = true;
    let sincronizando = false;

    async function sincronizarAutomaticamente() {
      if (sincronizando || !onAtualizar) return;
      sincronizando = true;

      try {
        await onAtualizar();
        if (ativo) {
          setUltimaSincronizacao(new Date());
          setErroSincronizacao(false);
        }
      } catch (error) {
        console.error("Erro ao sincronizar o painel da TV:", error);
        if (ativo) setErroSincronizacao(true);
      } finally {
        sincronizando = false;
      }
    }

    const intervalo = window.setInterval(sincronizarAutomaticamente, 15_000);

    function sincronizarAoRetomar() {
      if (document.visibilityState === "visible") {
        sincronizarAutomaticamente();
      }
    }

    window.addEventListener("online", sincronizarAutomaticamente);
    document.addEventListener("visibilitychange", sincronizarAoRetomar);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("online", sincronizarAutomaticamente);
      document.removeEventListener("visibilitychange", sincronizarAoRetomar);
    };
  }, [onAtualizar]);

  const tarefasVisiveis = useMemo(
    () => tarefas.filter((tarefa) => tarefa.exibir_tv !== false),
    [tarefas],
  );

  const urgentes = useMemo(
    () =>
      tarefasVisiveis
        .filter(
          (tarefa) =>
            tarefa.status === "pendente" && tarefa.prioridade === "urgente",
        )
        .sort((a, b) =>
          String(a.data_limite || "9999").localeCompare(
            String(b.data_limite || "9999"),
          ),
        ),
    [tarefasVisiveis],
  );

  const pendentes = useMemo(
    () =>
      tarefasVisiveis
        .filter(
          (tarefa) =>
            tarefa.status === "pendente" && tarefa.prioridade !== "urgente",
        )
        .sort((a, b) => {
          const prioridadeA = a.prioridade === "alta" ? 0 : 1;
          const prioridadeB = b.prioridade === "alta" ? 0 : 1;
          return (
            prioridadeA - prioridadeB ||
            String(a.data_limite || "9999").localeCompare(
              String(b.data_limite || "9999"),
            )
          );
        }),
    [tarefasVisiveis],
  );

  const concluidas = useMemo(
    () =>
      tarefasVisiveis
        .filter((tarefa) => tarefa.status === "concluida")
        .sort(
          (a, b) =>
            new Date(b.concluida_em || b.updated_at || b.created_at) -
            new Date(a.concluida_em || a.updated_at || a.created_at),
        )
        .slice(0, 10),
    [tarefasVisiveis],
  );

  async function atualizar() {
    setAtualizando(true);
    try {
      await onAtualizar?.();
      setUltimaSincronizacao(new Date());
      setErroSincronizacao(false);
    } catch (error) {
      console.error("Erro ao atualizar o painel da TV:", error);
      setErroSincronizacao(true);
    } finally {
      setAtualizando(false);
    }
  }

  async function alternarTelaCheia() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  return (
    <div className="tv-page">
      <header className="tv-topbar">
        <div className="tv-brand">
          <img src="/logo-interface.png" alt="Logo Platino" />
          <div>
            <span>PLATINO WORKSPACE</span>
            <h1>Painel Operacional da Equipe</h1>
          </div>
        </div>

        <div className="tv-summary">
          <div>
            <strong>{urgentes.length}</strong>
            <span>Urgentes</span>
          </div>
          <div>
            <strong>{pendentes.length}</strong>
            <span>Pendentes</span>
          </div>
          <div>
            <strong>{concluidas.length}</strong>
            <span>Concluidas recentes</span>
          </div>
        </div>

        <div className="tv-clock">
          <strong>
            {agora.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          <span>
            {agora.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </span>
        </div>

        <div className="tv-controls">
          <button onClick={atualizar} disabled={atualizando}>
            {atualizando ? "Atualizando..." : "Atualizar"}
          </button>
          <button onClick={alternarTelaCheia}>Tela cheia</button>
          <button onClick={onSair}>Sair do painel</button>
        </div>
      </header>

      <main className="tv-board">
        <ColunaTV
          classe="tv-column-urgent"
          etiqueta="Atencao imediata"
          funcionarios={funcionarios}
          tarefas={urgentes}
          tipo="urgent"
          titulo="Urgentes"
          vazio="Nenhuma tarefa urgente."
        />
        <ColunaTV
          classe="tv-column-pending"
          etiqueta="Em andamento"
          funcionarios={funcionarios}
          tarefas={pendentes}
          tipo="pending"
          titulo="Pendentes"
          vazio="Nenhuma tarefa pendente."
        />
        <ColunaTV
          classe="tv-column-done"
          etiqueta="Ultimas entregas"
          funcionarios={funcionarios}
          tarefas={concluidas}
          tipo="done"
          titulo="Concluidas"
          vazio="Nenhuma tarefa concluida."
        />
      </main>

      <footer className="tv-footer">
        <span className={`online-dot ${erroSincronizacao ? "sync-error" : ""}`} />
        {erroSincronizacao
          ? "Sem conexao. Nova tentativa automatica em instantes."
          : `Sincronizacao automatica ativa · ultima atualizacao ${ultimaSincronizacao.toLocaleTimeString(
              "pt-BR",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              },
            )}`}
      </footer>
    </div>
  );
}
