import { useEffect, useRef, useState } from "react";
import {
  DOCUMENT_CATEGORIES,
  filtrarModelos,
  ordenarModelos,
} from "../../lib/documentWorkspace";

const ICON_PATHS = {
  library: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" /></>,
  trend: <><path d="m4 16 5-5 4 4 7-8" /><path d="M15 7h5v5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />,
  signature: <><path d="M4 18c3-1 5-4 7-8 1-2 3-3 4-1 1 3-4 8-2 9 1 1 3-2 4-2 1 0 1 2 3 1" /><path d="M5 21h14" /></>,
  statement: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 12h7M9 16h7" /></>,
  send: <><path d="m3 11 18-8-7 18-3-7z" /><path d="m11 14 4-4" /></>,
  shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  scale: <><path d="M12 3v18M5 6h14M5 6l-3 6h6zM19 6l-3 6h6zM8 21h8" /></>,
  report: <><path d="M5 3h14v18H5z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  file: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></>,
};

export function DocumentCategoryIcon({ name, size = 22 }) {
  return (
    <svg
      aria-hidden="true"
      className="doc-category-icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      {ICON_PATHS[name] || ICON_PATHS.file}
    </svg>
  );
}

export default function ModelLibraryModal({
  aberto,
  modelos,
  selecionadoId,
  favoritos,
  recentes,
  onClose,
  onSelect,
  onToggleFavorite,
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [ordenacao, setOrdenacao] = useState("mais-utilizados");
  const [modeloVisualizado, setModeloVisualizado] = useState(null);
  const buscaRef = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buscaRef.current?.focus();
    function fecharComEscape(evento) {
      if (evento.key === "Escape") {
        if (modeloVisualizado) setModeloVisualizado(null);
        else onClose();
      }
    }
    window.addEventListener("keydown", fecharComEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [aberto, modeloVisualizado, onClose]);

  if (!aberto) return null;

  const resultados = ordenarModelos(
    filtrarModelos(modelos, { busca, categoria, favoritos, recentes }),
    ordenacao,
    favoritos,
  );

  function limparFiltros() {
    setBusca("");
    setCategoria("todos");
    setOrdenacao("mais-utilizados");
  }

  return (
    <div className="model-library-backdrop" onMouseDown={(evento) => evento.target === evento.currentTarget && onClose()}>
      <section className="model-library-modal" role="dialog" aria-modal="true" aria-labelledby="model-library-title">
        <header className="model-library-header">
          <div className="model-library-heading">
            <span className="model-library-mark"><DocumentCategoryIcon name="library" size={25} /></span>
            <div>
              <span className="eyebrow">Central de documentos</span>
              <h2 id="model-library-title">Biblioteca de modelos jurídicos</h2>
              <p>Encontre o documento pela finalidade, área responsável ou categoria.</p>
            </div>
          </div>
          <button type="button" className="model-library-close" onClick={onClose} aria-label="Fechar biblioteca">×</button>
        </header>

        <div className="model-library-toolbar">
          <label className="model-library-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={buscaRef}
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Pesquisar por nome, finalidade ou categoria…"
              aria-label="Pesquisar modelos"
            />
          </label>
          <label className="model-library-sort">
            <span>Ordenar por</span>
            <select value={ordenacao} onChange={(evento) => setOrdenacao(evento.target.value)}>
              <option value="mais-utilizados">Mais utilizados</option>
              <option value="alfabetica">Ordem alfabética</option>
              <option value="recentes">Adicionados recentemente</option>
              <option value="favoritos">Favoritos</option>
            </select>
          </label>
        </div>

        <nav className="model-library-filters" aria-label="Categorias de modelos">
          {DOCUMENT_CATEGORIES.map((item) => (
            <button
              type="button"
              key={item.id}
              className={categoria === item.id ? "active" : ""}
              onClick={() => setCategoria(item.id)}
              aria-pressed={categoria === item.id}
            >
              <DocumentCategoryIcon name={item.icone} size={16} />
              {item.nome}
            </button>
          ))}
        </nav>

        <div className="model-library-result-meta">
          <strong>{resultados.length} {resultados.length === 1 ? "modelo encontrado" : "modelos encontrados"}</strong>
          <span>Estrutura preparada para receber novos modelos.</span>
        </div>

        {resultados.length === 0 ? (
          <div className="model-library-empty">
            <span><DocumentCategoryIcon name="library" size={30} /></span>
            <h3>Nenhum modelo encontrado</h3>
            <p>Tente pesquisar por outro termo ou remova os filtros selecionados.</p>
            <button type="button" className="btn-secondary" onClick={limparFiltros}>Limpar filtros</button>
          </div>
        ) : (
          <div className="model-library-grid">
            {resultados.map((modelo) => {
              const selecionado = modelo.id === selecionadoId;
              const favorito = favoritos.includes(modelo.id);
              return (
                <article className={`model-card ${selecionado ? "selected" : ""}`} key={modelo.id}>
                  <div className="model-card-topline">
                    <span className="model-card-icon"><DocumentCategoryIcon name={modelo.icone} size={24} /></span>
                    <div className="model-card-badges">
                      {modelo.selo ? <span>{modelo.selo}</span> : null}
                      {selecionado ? <span className="selected-badge">✓ Modelo selecionado</span> : null}
                    </div>
                    <button
                      type="button"
                      className={`model-favorite ${favorito ? "active" : ""}`}
                      onClick={() => onToggleFavorite(modelo.id)}
                      aria-label={favorito ? `Remover ${modelo.nome} dos favoritos` : `Adicionar ${modelo.nome} aos favoritos`}
                      aria-pressed={favorito}
                    >
                      <DocumentCategoryIcon name="star" size={19} />
                    </button>
                  </div>
                  <div className="model-card-copy">
                    <span>{modelo.categoriaNome}</span>
                    <h3>{modelo.nome}</h3>
                    <p>{modelo.descricao}</p>
                  </div>
                  <div className="model-card-details">
                    <span>{modelo.campos.filter((campo) => campo.obrigatorio).length} campos obrigatórios</span>
                    <span>≈ {modelo.minutos} min</span>
                  </div>
                  <div className="model-card-actions">
                    <button type="button" className="btn-secondary compact" onClick={() => setModeloVisualizado(modelo)}>Visualizar modelo</button>
                    <button type="button" className="btn-primary compact" onClick={() => onSelect(modelo)}>{selecionado ? "Continuar com este modelo" : "Usar este modelo"}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {modeloVisualizado ? (
          <div className="model-detail-backdrop" onMouseDown={(evento) => evento.target === evento.currentTarget && setModeloVisualizado(null)}>
            <section className="model-detail-panel" role="dialog" aria-modal="true" aria-labelledby="model-detail-title">
              <button type="button" className="model-library-close" onClick={() => setModeloVisualizado(null)} aria-label="Fechar visualização">×</button>
              <span className="model-card-icon large"><DocumentCategoryIcon name={modeloVisualizado.icone} size={30} /></span>
              <span className="eyebrow">{modeloVisualizado.categoriaNome}</span>
              <h2 id="model-detail-title">{modeloVisualizado.nome}</h2>
              <p>{modeloVisualizado.descricao}</p>
              <div className="model-detail-preview">
                <span>Prévia estrutural</span>
                <strong>{modeloVisualizado.titulo || modeloVisualizado.nome}</strong>
                <div />
                <div />
                <div className="short" />
                <small>O conteúdo final será preenchido com os dados informados.</small>
              </div>
              <ul>
                <li>{modeloVisualizado.campos.length} campos no total.</li>
                <li>Tempo estimado de {modeloVisualizado.minutos} minutos.</li>
                <li>Geração em PDF com identidade visual Platino.</li>
              </ul>
              <button type="button" className="btn-primary" onClick={() => onSelect(modeloVisualizado)}>Usar este modelo</button>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
