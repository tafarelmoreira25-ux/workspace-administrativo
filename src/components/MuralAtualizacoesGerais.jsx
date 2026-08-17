import { useEffect, useState } from "react";
import {
  destinoDaAtualizacaoGeral,
  filtrarAtualizacoesGeraisAtivas,
  tempoDecorridoAtualizacao,
} from "../lib/generalUpdates";
import { supabase } from "../lib/supabase";

const LIMITE_POST_ITS = 3;

export default function MuralAtualizacoesGerais({ onNavigate }) {
  const [atualizacoes, setAtualizacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    const carregar = () => {
      supabase.rpc("listar_atualizacoes_gerais").then(({ data, error }) => {
        if (!ativo) return;
        setCarregando(false);
        if (error) {
          setAtualizacoes([]);
          return;
        }
        setAtualizacoes(filtrarAtualizacoesGeraisAtivas(data || []));
      });
    };
    carregar();
    const intervalo = window.setInterval(carregar, 60_000);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, []);

  const visiveis = filtrarAtualizacoesGeraisAtivas(atualizacoes)
    .slice(0, LIMITE_POST_ITS);

  return (
    <section className="general-updates-board" aria-label="Últimas atualizações gerais">
      <div className="general-updates-heading">
        <div><span aria-hidden="true">📌</span><strong>Últimas atualizações</strong></div>
        <small>Visíveis por 5 horas</small>
      </div>
      <div className="general-updates-notes">
        {carregando ? (
          <div className="general-update-note is-empty"><strong>Atualizando mural...</strong></div>
        ) : visiveis.length === 0 ? (
          <div className="general-update-note is-empty">
            <strong>Mural em dia</strong>
            <p>Novidades processuais e conclusões importantes aparecerão aqui.</p>
          </div>
        ) : visiveis.map((atualizacao) => (
          <button
            className={`general-update-note tone-${atualizacao.tom || "info"}`}
            key={atualizacao.id}
            onClick={() => onNavigate?.(destinoDaAtualizacaoGeral(atualizacao))}
            type="button"
          >
            <span className="general-update-pin" aria-hidden="true" />
            <strong>{atualizacao.titulo}</strong>
            <p>{atualizacao.mensagem}</p>
            <small>{tempoDecorridoAtualizacao(atualizacao.created_at)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
