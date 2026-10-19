const SHORTCUTS = [
  { id: "clientes", title: "Clientes", description: "Cadastros e fichas", icon: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 3.5 5"/></> },
  { id: "extrajudicial", title: "Extrajudiciais", description: "Atendimento e movimentações", icon: <><path d="M6 3.5h8l4 4V20H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/></> },
  { id: "processual", title: "Processual", description: "Clientes com número judicial", icon: <><path d="M4 20h16M6 17h12M12 4v13M5 8h14M8 8l-3 5h6L8 8Zm8 0-3 5h6l-3-5Z"/></> },
  { id: "homologacao", title: "Homologação e quitação", description: "Negociações com instituições", icon: <><circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.5 2.5L16 9"/></> },
  { id: "documentos", title: "Gerador de documentos", description: "Modelos e documentos jurídicos", icon: <><path d="M6 3.5h8l4 4V20H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/></> },
];

export default function WorkspaceHome({ nome, onNavigate }) {
  return (
    <section className="auvel-home" aria-labelledby="home-welcome-title">
      <div className="auvel-home-intro">
        <span className="auvel-home-monogram" aria-hidden="true">a.</span>
        <p className="workspace-eyebrow">Área de Trabalho</p>
        <h1 id="home-welcome-title">Olá, {nome?.trim().split(/\s+/)[0] || "equipe"}</h1>
        <p className="auvel-home-subtitle">Selecione um módulo para continuar.</p>
      </div>

      <nav className="auvel-shortcuts" aria-label="Acessos principais">
        {SHORTCUTS.map((item) => (
          <button className="auvel-shortcut" key={item.id} type="button" onClick={() => onNavigate(item.id)}>
            <span className="auvel-shortcut-mark" aria-hidden="true"><svg viewBox="0 0 24 24">{item.icon}</svg></span>
            <span className="auvel-shortcut-copy">
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </span>
            <span className="auvel-shortcut-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </nav>
    </section>
  );
}
