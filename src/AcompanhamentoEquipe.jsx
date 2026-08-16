import { useMemo, useState } from "react";
import MeuHistorico from "./MeuHistorico";

const ENCERRADOS = new Set(["concluida", "cancelada", "arquivada"]);
const ITENS_POR_PAGINA = 15;

function paginasParaExibir(atual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, indice) => indice + 1);
  const paginas = new Set([1, total, atual - 1, atual, atual + 1]);
  const validas = [...paginas].filter((pagina) => pagina >= 1 && pagina <= total).sort((a, b) => a - b);
  const resultado = [];
  validas.forEach((pagina, indice) => {
    if (indice > 0 && pagina - validas[indice - 1] > 1) resultado.push(`reticencias-${pagina}`);
    resultado.push(pagina);
  });
  return resultado;
}

function prazoDa(tarefa) {
  const valor = tarefa.prazo_limite || (tarefa.data_limite ? `${tarefa.data_limite}T23:59:59` : null);
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function formatar(data) {
  if (!data) return "Não informado";
  const valor = new Date(data);
  if (Number.isNaN(valor.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(valor);
}

function situacao(tarefa) {
  if (tarefa.status === "concluida") {
    const prazo = prazoDa(tarefa);
    const conclusao = tarefa.concluida_em ? new Date(tarefa.concluida_em) : null;
    return prazo && conclusao && conclusao > prazo ? "Concluída com atraso" : "Concluída no prazo";
  }
  if (tarefa.status === "cancelada") return "Cancelada";
  if (tarefa.status === "arquivada") return "Arquivada";
  const prazo = prazoDa(tarefa);
  if (!prazo) return "Em aberto";
  const agora = new Date();
  if (prazo < agora) return "Atrasada";
  if (prazo.toDateString() === agora.toDateString()) return "Vence hoje";
  return "Em aberto";
}

export default function AcompanhamentoEquipe({ tarefas = [], funcionarios = [], historicoPessoal = [], onAtualizar }) {
  const [filtro, setFiltro] = useState("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [visualizacao, setVisualizacao] = useState("equipe");
  const nomes = useMemo(() => new Map(funcionarios.map((p) => [String(p.id), p.nome])), [funcionarios]);
  const calculadas = useMemo(() => tarefas.map((t) => ({ ...t, situacaoCalculada: situacao(t) })), [tarefas]);
  const registros = calculadas.filter((tarefa) => {
    if (filtro === "abertas" && ENCERRADOS.has(tarefa.status)) return false;
    if (filtro === "vencem_hoje" && tarefa.situacaoCalculada !== "Vence hoje") return false;
    if (filtro === "atrasadas" && tarefa.situacaoCalculada !== "Atrasada") return false;
    if (filtro === "concluidas" && tarefa.status !== "concluida") return false;
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const responsavel = nomes.get(String(tarefa.funcionaria_id)) || "";
    return !termo || `${tarefa.id_externo || tarefa.id} ${tarefa.titulo || ""} ${tarefa.nome_cliente || ""} ${responsavel}`.toLocaleLowerCase("pt-BR").includes(termo);
  });
  const total = (nome) => calculadas.filter((t) => nome === "abertas" ? !ENCERRADOS.has(t.status) : nome === "concluidas" ? t.status === "concluida" : t.situacaoCalculada === nome).length;
  const totalPaginas = Math.max(1, Math.ceil(registros.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const registrosVisiveis = registros.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);

  function selecionarFiltro(valor) {
    setFiltro(valor);
    setPagina(1);
  }

  function alterarBusca(evento) {
    setBusca(evento.target.value);
    setPagina(1);
  }

  if (visualizacao === "historico") {
    return <MeuHistorico tarefas={historicoPessoal} onVoltar={() => setVisualizacao("equipe")} />;
  }

  return <section className="panel large">
    <div className="panel-title-row"><div><span className="eyebrow">Consulta compartilhada</span><h2>Acompanhamento da equipe</h2><p>Todos podem verificar o andamento. A execução continua restrita ao responsável.</p></div><button className="btn-secondary compact" onClick={onAtualizar} type="button">Atualizar</button></div>
    <div className="dashboard-grid central-metrics">
      <button className="card central-metric normal" onClick={() => selecionarFiltro("abertas")} type="button"><span>Em aberto</span><strong>{total("abertas")}</strong></button>
      <button className="card central-metric warning" onClick={() => selecionarFiltro("vencem_hoje")} type="button"><span>Vencem hoje</span><strong>{total("Vence hoje")}</strong></button>
      <button className="card central-metric danger" onClick={() => selecionarFiltro("atrasadas")} type="button"><span>Atrasadas</span><strong>{total("Atrasada")}</strong></button>
      <button className="card central-metric success" onClick={() => selecionarFiltro("concluidas")} type="button"><span>Concluídas</span><strong>{total("concluidas")}</strong></button>
      <button className="card central-metric normal" onClick={() => setVisualizacao("historico")} type="button"><span>Meu histórico</span><strong>{historicoPessoal.length}</strong><small>Ver tarefas concluídas</small></button>
    </div>
    <div className="task-filters"><input aria-label="Buscar tarefas da equipe" onChange={alterarBusca} placeholder="Buscar por ID, cliente, tarefa ou responsável" value={busca} /><div className="task-kind-switch">{[["todas", "Todas"], ["abertas", "Em aberto"], ["vencem_hoje", "Vencem hoje"], ["atrasadas", "Atrasadas"], ["concluidas", "Concluídas"]].map(([valor, rotulo]) => <button className={filtro === valor ? "active" : ""} key={valor} onClick={() => selecionarFiltro(valor)} type="button">{rotulo}</button>)}</div></div>
    {registros.length === 0 ? <p>Nenhuma tarefa encontrada neste filtro.</p> : <><div className="central-table">{registrosVisiveis.map((tarefa) => <div className="central-table-row" key={tarefa.id}><div><strong>{tarefa.id_externo || `#${tarefa.id}`} · {tarefa.titulo}</strong><small>{tarefa.nome_cliente || "Cliente não informado"}</small></div><span>{nomes.get(String(tarefa.funcionaria_id)) || `Responsável #${tarefa.funcionaria_id}`}</span><span className={`status ${tarefa.status}`}>{tarefa.situacaoCalculada}</span><small>Prazo: {formatar(tarefa.prazo_limite || tarefa.data_limite)}{tarefa.concluida_em ? ` · Feita: ${formatar(tarefa.concluida_em)}` : ""}</small></div>)}</div>
      <nav aria-label="Paginação das tarefas" className="task-history-actions pagination-numbered">
        <button className="btn-secondary compact" disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)} type="button">Anterior</button>
        {paginasParaExibir(paginaAtual, totalPaginas).map((item) => typeof item === "number" ? <button aria-current={paginaAtual === item ? "page" : undefined} className={`btn-secondary compact ${paginaAtual === item ? "active" : ""}`} key={item} onClick={() => setPagina(item)} type="button">{item}</button> : <span key={item}>…</span>)}
        <button className="btn-secondary compact" disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)} type="button">Próxima</button>
        <small>{registros.length} tarefa(s)</small>
      </nav></>}
  </section>;
}
