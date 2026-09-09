import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { calcularPrazoElite, type Processo } from "../../lib/esteiraProcessual";
import EsteiraKanban from "./EsteiraKanban";
import PainelJudicial from "./PainelJudicial";
import "../../esteiraProcessual.css";

type Props = {
  usuario?: { nome?: string };
  showToast?: (mensagem: string) => void;
  initialView?: Visualizacao;
};

type Visualizacao = "protocolos" | "processos";

function contarPorFase(processos: Processo[], fase: string) {
  return processos.filter((processo) => processo.fase_atual === fase).length;
}

export default function EsteiraProcessualPlatino({ usuario, showToast, initialView = "protocolos" }: Props) {
  const [visualizacao] = useState<Visualizacao>(initialView);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const avisar = useCallback(
    (mensagem: string) => {
      if (showToast) showToast(mensagem);
    },
    [showToast],
  );

  const carregarProcessos = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("processos")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      avisar("Não foi possível carregar o módulo Processual.");
      setCarregando(false);
      return;
    }

    setProcessos((data || []) as Processo[]);
    setCarregando(false);
  }, [avisar]);

  useEffect(() => {
    carregarProcessos();
  }, [carregarProcessos]);

  const indicadores = useMemo(() => {
    const atrasados = processos.filter((processo) => (
      ["Enviado para Elite", "Pasta Retornada"].includes(processo.fase_atual) &&
      calcularPrazoElite(processo.data_envio_elite).sinalizacao === "vermelho"
    )).length;

    return [
      ["Protocolos pendentes", processos.filter((processo) => !processo.numero_processo).length],
      ["Com a Elite", contarPorFase(processos, "Enviado para Elite")],
      ["Pastas retornadas", contarPorFase(processos, "Pasta Retornada")],
      ["Processos protocolados", processos.filter((processo) => Boolean(processo.numero_processo)).length],
      ["Atrasados", atrasados],
    ];
  }, [processos]);

  function atualizarProcessoLocal(processoAtualizado: Processo) {
    setProcessos((atuais) => {
      const existe = atuais.some((item) => item.id === processoAtualizado.id);
      if (!existe) return [processoAtualizado, ...atuais];
      return atuais.map((item) => (
        item.id === processoAtualizado.id ? processoAtualizado : item
      ));
    });
  }

  return (
    <section className="esteira-workspace" aria-label="Módulo Processual Platino">
      <header className="esteira-hero">
        <div className="esteira-brand-block">
          <span className="esteira-logo-orbit">
            <img src="/assets/platino-orbital-logo.png" alt="" />
          </span>
          <div>
            <span className="eyebrow">Processual</span>
            <h2>Controle de ajuizamentos e processos judiciais</h2>
            <p>
              Registre a pasta desde o pedido de ajuizamento, monitore o prazo
              de protocolo e mantenha o histórico atualizado para cada cliente.
            </p>
          </div>
        </div>
        <div className="esteira-user-tag">
          <span>Responsável</span>
          <strong>{usuario?.nome || "Equipe Platino"}</strong>
        </div>
      </header>

      <div className="esteira-metrics" aria-label="Resumo processual">
        {indicadores.map(([rotulo, total]) => (
          <article key={rotulo}>
            <span>{rotulo}</span>
            <strong>{total}</strong>
          </article>
        ))}
      </div>

      <div className="esteira-tabs">
        <button className="ghost" onClick={carregarProcessos} type="button">
          Atualizar
        </button>
      </div>

      {carregando ? (
        <div className="panel">Carregando processos...</div>
      ) : visualizacao === "protocolos" ? (
        <EsteiraKanban
          processos={processos}
          onProcessoAtualizado={atualizarProcessoLocal}
          showToast={avisar}
          usuario={usuario}
        />
      ) : (
        <PainelJudicial
          processos={processos}
          onProcessoAtualizado={atualizarProcessoLocal}
          showToast={avisar}
          usuario={usuario}
        />
      )}
    </section>
  );
}
