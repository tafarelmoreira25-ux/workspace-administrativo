import { useState } from "react";
import {
  filtrarTreinamentos,
  TREINAMENTOS_OPERACIONAIS,
} from "../lib/trainingResources";
import "../trainingResources.css";

function IconeTreinamento({ tipo }) {
  if (tipo === "PDF") {
    return <span className="training-resource-icon training-resource-pdf has-image">
      <img alt="" aria-hidden="true" src="/assets/icons/pdf-treinamento.png" />
    </span>;
  }
  const icone = tipo === "Apresentação" ? "▶" : tipo === "Google Docs" ? "G" : "DOC";
  return <span className={`training-resource-icon training-resource-${tipo.toLowerCase().replaceAll(" ", "-")}`}>{icone}</span>;
}

export default function TreinamentosOperacionais({ usuario }) {
  const [busca, setBusca] = useState("");
  const [equipe, setEquipe] = useState("Todas");
  const resultados = filtrarTreinamentos({ busca, equipe });

  return (
    <section className="training-hub">
      <header className="training-hub-hero">
        <span className="training-hub-emblem" aria-hidden="true">🎓</span>
        <div>
          <span className="eyebrow">Conhecimento operacional</span>
          <h1>Central de Treinamentos</h1>
          <p>Consulte os manuais oficiais e encontre rapidamente os materiais de referência.</p>
        </div>
        <div className="training-hub-summary">
          <small>Materiais cadastrados</small>
          <strong>{TREINAMENTOS_OPERACIONAIS.length}</strong>
          <span>Disponíveis no Google Drive</span>
        </div>
      </header>

      <div className="training-hub-toolbar panel">
        <label>
          <span>Pesquisar treinamento</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Ex.: audiência, GOV, processo, contrato..."
          />
        </label>
        <label>
          <span>Área</span>
          <select value={equipe} onChange={(evento) => setEquipe(evento.target.value)}>
            <option>Todas</option>
            <option>Administrativo</option>
            <option>Jurídico</option>
            <option>Processual</option>
          </select>
        </label>
      </div>

      <div className="training-hub-meta">
        <strong>{resultados.length} material(is) encontrado(s)</strong>
        <span>Olá, {usuario?.nome?.split(" ")[0] || "colaborador"}. Abra o treinamento em uma nova aba.</span>
      </div>

      {resultados.length ? (
        <div className="training-resource-grid">
          {resultados.map((treinamento) => (
            <article className="training-resource-card" key={treinamento.id}>
              <div className="training-resource-card-top">
                <IconeTreinamento tipo={treinamento.tipo} />
                <span>{treinamento.equipe}</span>
              </div>
              <div>
                <small>{treinamento.tipo}</small>
                <h2>{treinamento.titulo}</h2>
                <p>{treinamento.descricao}</p>
              </div>
              <div className="training-resource-tags">
                {treinamento.categorias.slice(0, 3).map((categoria) => <span key={categoria}>{categoria}</span>)}
                {!treinamento.categorias.length && <span>VISÃO GERAL</span>}
              </div>
              <a href={treinamento.url} target="_blank" rel="noreferrer">Abrir treinamento <span aria-hidden="true">↗</span></a>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel training-hub-empty">
          <span aria-hidden="true">⌕</span>
          <strong>Nenhum treinamento encontrado</strong>
          <p>Tente pesquisar por outra atividade ou selecione todas as áreas.</p>
        </div>
      )}
    </section>
  );
}
