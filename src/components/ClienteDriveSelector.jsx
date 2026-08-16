import { useEffect, useId, useState } from "react";
import { supabase } from "../lib/supabase";

function mensagemConsultaDrive(error) {
  if (!error) return "";
  if (error.code === "PGRST202" || /listar_clientes_drive_disponiveis|schema cache/i.test(error.message || "")) {
    return "A atualização para incluir os clientes históricos ainda não foi instalada no Supabase.";
  }
  return error.message || "Não foi possível consultar os clientes do Google Drive.";
}

export default function ClienteDriveSelector({
  label = "Cliente / pasta do Google Drive",
  selecionado,
  onSelecionar,
  required = false,
  disabled = false,
}) {
  const id = useId();
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto || disabled) return undefined;
    let ativo = true;
    const timer = window.setTimeout(async () => {
      setCarregando(true);
      let consulta = await supabase.rpc("listar_clientes_drive_disponiveis", {
        p_busca: busca.trim() || null,
        p_limite: 30,
      });
      // Mantém a tela utilizável durante a publicação coordenada do novo SQL.
      if (consulta.error?.code === "PGRST202") {
        consulta = await supabase.rpc("listar_clientes_drive_ativos", {
          p_busca: busca.trim() || null,
          p_limite: 30,
        });
      }
      if (!ativo) return;
      setCarregando(false);
      setErro(mensagemConsultaDrive(consulta.error));
      setResultados(consulta.error ? [] : consulta.data || []);
    }, 220);
    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [aberto, busca, disabled]);

  function escolher(cliente) {
    onSelecionar(cliente);
    setBusca(cliente.nome || "");
    setAberto(false);
    setErro("");
  }

  const valorVisivel = aberto ? busca : selecionado?.nome || busca;

  return (
    <div className="drive-client-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      <div className={`drive-client-combobox ${aberto ? "is-open" : ""}`}>
        <span className="drive-folder-icon" aria-hidden="true">📁</span>
        <input
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={aberto}
          aria-controls={`${id}-options`}
          autoComplete="off"
          disabled={disabled}
          required={required && !selecionado}
          value={valorVisivel}
          placeholder="Pesquisar cliente ativo ou antigo..."
          onFocus={() => {
            setBusca(selecionado?.nome || "");
            setAberto(true);
          }}
          onChange={(event) => {
            setBusca(event.target.value);
            onSelecionar(null);
            setAberto(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setAberto(false);
          }}
          onBlur={() => window.setTimeout(() => setAberto(false), 160)}
        />
        {selecionado && (
          <button
            className="drive-client-clear"
            type="button"
            aria-label="Remover cliente selecionado"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onSelecionar(null);
              setBusca("");
              setAberto(true);
            }}
          >
            ×
          </button>
        )}
        {aberto && (
          <div className="drive-client-options" id={`${id}-options`} role="listbox">
            {carregando ? (
              <p>Consultando pastas sincronizadas...</p>
            ) : erro ? (
              <p className="drive-client-error">{erro}</p>
            ) : resultados.length === 0 ? (
              <p>Nenhuma pasta de cliente encontrada.</p>
            ) : resultados.map((cliente) => (
              <button
                key={cliente.id}
                type="button"
                role="option"
                aria-selected={String(selecionado?.id) === String(cliente.id)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => escolher(cliente)}
              >
                <span aria-hidden="true">📁</span>
                <span>
                  <strong>{cliente.nome}</strong>
                  <small>{cliente.drive_path || cliente.pasta_drive_nome || "Pasta sincronizada do Google Drive"}</small>
                  <em className={`drive-client-kind ${cliente.drive_status === "arquivado" ? "is-archived" : "is-active"}`}>
                    {cliente.drive_status === "arquivado" ? "Arquivo histórico" : "Cliente ativo"}
                  </em>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selecionado && (
        <div className={`drive-client-selected ${selecionado.drive_status === "arquivado" ? "is-archived" : ""}`}>
          <span>
            <strong>{selecionado.drive_status === "arquivado" ? "Pasta histórica vinculada" : "Pasta ativa vinculada"}</strong>
            <small>{selecionado.drive_path || "Esta tarefa ficará relacionada ao cliente do Drive."}</small>
          </span>
          <a href={selecionado.pasta_drive_url} target="_blank" rel="noreferrer">Abrir pasta</a>
        </div>
      )}
    </div>
  );
}
