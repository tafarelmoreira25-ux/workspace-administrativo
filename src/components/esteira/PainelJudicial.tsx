import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  type FaseProcessual,
  type MovimentacaoProcessual,
  type Processo,
  calcularPrazoElite,
} from "../../lib/esteiraProcessual";

type Props = {
  processos: Processo[];
  onProcessoAtualizado: (processo: Processo) => void;
  showToast: (mensagem: string) => void;
};

const FASES_JUDICIAIS: FaseProcessual[] = [
  "Protocolo Liberado",
  "Tramitando",
  "Arquivado",
  "Improcedente",
];

const STATUS_JUDICIAL = [
  "TRAMITANDO",
  "ARQUIVADO",
  "IMPROCEDENTE",
  "SENTENÇA PROCEDENTE",
  "SENTENÇA PARCIALMENTE PROCEDENTE",
  "JULGADO/EXTINTO — SEM BAIXA DEFINITIVA",
  "NÃO CONFIRMADO NA CONSULTA PÚBLICA",
];

function formatarData(data?: string | Date | null) {
  if (!data) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

function criarFicha(processo: Processo | null) {
  return {
    nome_cliente: processo?.nome_cliente || "",
    banco_reu: processo?.banco_reu || "",
    numero_processo: processo?.numero_processo || "",
    vara: processo?.vara || "",
    fase_atual: processo?.fase_atual || "Protocolo Liberado",
    status_judicial: processo?.status_judicial || "TRAMITANDO",
    justica_gratuita: processo?.justica_gratuita || "Não Solicitada",
    data_distribuicao: processo?.data_distribuicao || "",
    emenda_inicial: processo?.emenda_inicial || "",
    link_processo: processo?.link_processo || "",
    observacoes: processo?.observacoes || "",
  };
}

export default function PainelJudicial({
  processos,
  onProcessoAtualizado,
  showToast,
}: Props) {
  const [busca, setBusca] = useState("");
  const [processoAberto, setProcessoAberto] = useState<Processo | null>(null);
  const [ficha, setFicha] = useState(criarFicha(null));
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoProcessual[]>([]);
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const processosJudiciais = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return processos
      .filter((processo) => (
        FASES_JUDICIAIS.includes(processo.fase_atual) ||
        Boolean(processo.numero_processo)
      ))
      .filter((processo) => {
        if (!termo) return true;
        return [
          processo.nome_cliente,
          processo.banco_reu,
          processo.numero_processo,
          processo.vara,
          processo.status_judicial,
          processo.observacoes,
        ].some((valor) => String(valor || "").toLowerCase().includes(termo));
      });
  }, [busca, processos]);

  useEffect(() => {
    setFicha(criarFicha(processoAberto));
    if (!processoAberto) {
      setMovimentacoes([]);
      return;
    }

    let ativo = true;
    async function carregarMovimentacoes() {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .eq("processo_id", processoAberto.id)
        .order("data_registro", { ascending: false });

      if (!ativo) return;
      if (error) {
        showToast("Não foi possível carregar as movimentações.");
        return;
      }
      setMovimentacoes((data || []) as MovimentacaoProcessual[]);
    }

    carregarMovimentacoes();
    return () => {
      ativo = false;
    };
  }, [processoAberto, showToast]);

  async function salvarFicha(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!processoAberto) return;

    setSalvando(true);
    const { data, error } = await supabase
      .from("processos")
      .update({
        nome_cliente: ficha.nome_cliente.trim(),
        banco_reu: ficha.banco_reu.trim() || null,
        autor_reu: ficha.banco_reu.trim()
          ? `${ficha.nome_cliente.trim()} X ${ficha.banco_reu.trim()}`
          : ficha.nome_cliente.trim(),
        numero_processo: ficha.numero_processo.trim() || null,
        vara: ficha.vara.trim() || null,
        fase_atual: ficha.fase_atual,
        status_judicial: ficha.status_judicial.trim() || null,
        justica_gratuita: ficha.justica_gratuita,
        data_distribuicao: ficha.data_distribuicao || null,
        emenda_inicial: ficha.emenda_inicial.trim() || null,
        link_processo: ficha.link_processo.trim() || null,
        observacoes: ficha.observacoes.trim() || null,
      })
      .eq("id", processoAberto.id)
      .select("*")
      .single();
    setSalvando(false);

    if (error) {
      showToast("Não foi possível salvar a ficha.");
      return;
    }

    const atualizado = data as Processo;
    onProcessoAtualizado(atualizado);
    setProcessoAberto(atualizado);
    showToast("Ficha atualizada.");
  }

  async function adicionarMovimentacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!processoAberto) return;
    const texto = descricao.trim();
    if (!texto) {
      showToast("Descreva o andamento antes de salvar.");
      return;
    }

    setSalvando(true);
    const { data, error } = await supabase
      .from("movimentacoes")
      .insert({ processo_id: processoAberto.id, descricao: texto })
      .select("*")
      .single();
    setSalvando(false);

    if (error) {
      showToast("Não foi possível registrar a movimentação.");
      return;
    }

    setMovimentacoes((atuais) => [data as MovimentacaoProcessual, ...atuais]);
    setDescricao("");
    showToast("Movimentação registrada.");
  }

  return (
    <div className="painel-judicial">
      <div className="judicial-toolbar">
        <div>
          <span className="eyebrow">CRM Judicial</span>
          <h2>Pastas com protocolo</h2>
        </div>
        <label>
          <span>Pesquisar</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Cliente, processo, banco, vara, status ou observação"
          />
        </label>
      </div>

      <div className="judicial-table-wrap">
        <table className="judicial-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Banco réu</th>
              <th>Número</th>
              <th>Distribuído</th>
              <th>Vara</th>
              <th>JG</th>
              <th>Status</th>
              <th>Prazo Elite</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {processosJudiciais.length === 0 ? (
              <tr>
                <td colSpan={9}>Nenhuma pasta judicial encontrada.</td>
              </tr>
            ) : processosJudiciais.map((processo) => {
              const prazo = calcularPrazoElite(processo.data_envio_elite);
              return (
                <tr key={processo.id}>
                  <td><strong>{processo.nome_cliente}</strong></td>
                  <td>{processo.banco_reu || "-"}</td>
                  <td>{processo.numero_processo || "-"}</td>
                  <td>{formatarData(processo.data_distribuicao)}</td>
                  <td>{processo.vara || "-"}</td>
                  <td>{processo.justica_gratuita || "Não Solicitada"}</td>
                  <td><span className="judicial-phase">{processo.status_judicial || processo.fase_atual}</span></td>
                  <td>
                    <span className={`prazo-chip ${prazo.sinalizacao}`}>
                      {prazo.rotulo} · {formatarData(prazo.dataLimite)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-secondary compact"
                      onClick={() => setProcessoAberto(processo)}
                      type="button"
                    >
                      Abrir pasta
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {processoAberto && (
        <aside className="judicial-drawer" aria-label="Ficha do processo">
          <div className="judicial-drawer-panel">
            <button
              className="modal-close"
              onClick={() => setProcessoAberto(null)}
              type="button"
            >
              ×
            </button>
            <span className="eyebrow">Pasta judicial</span>
            <h3>{processoAberto.nome_cliente}</h3>
            <p>{processoAberto.numero_processo || "Protocolo ainda sem número vinculado"}</p>

            <form className="processo-ficha-form" onSubmit={salvarFicha}>
              <label>
                <span>Cliente</span>
                <input
                  value={ficha.nome_cliente}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, nome_cliente: evento.target.value }))}
                />
              </label>
              <label>
                <span>Banco réu</span>
                <input
                  value={ficha.banco_reu}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, banco_reu: evento.target.value }))}
                />
              </label>
              <label>
                <span>Número do processo</span>
                <input
                  value={ficha.numero_processo}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, numero_processo: evento.target.value }))}
                />
              </label>
              <label>
                <span>Vara</span>
                <input
                  value={ficha.vara}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, vara: evento.target.value }))}
                  placeholder="Ex.: 2ª Vara Cível"
                />
              </label>
              <label>
                <span>Distribuído em</span>
                <input
                  type="date"
                  value={ficha.data_distribuicao}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, data_distribuicao: evento.target.value }))}
                />
              </label>
              <label>
                <span>Justiça gratuita</span>
                <select
                  value={ficha.justica_gratuita}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, justica_gratuita: evento.target.value }))}
                >
                  <option>Deferida</option>
                  <option>Indeferida</option>
                  <option>Não Solicitada</option>
                </select>
              </label>
              <label>
                <span>Etapa interna</span>
                <select
                  value={ficha.fase_atual}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, fase_atual: evento.target.value as FaseProcessual }))}
                >
                  {FASES_JUDICIAIS.map((fase) => (
                    <option key={fase}>{fase}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status judicial</span>
                <select
                  value={ficha.status_judicial}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, status_judicial: evento.target.value }))}
                >
                  {STATUS_JUDICIAL.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Emenda inicial</span>
                <input
                  value={ficha.emenda_inicial}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, emenda_inicial: evento.target.value }))}
                />
              </label>
              <label>
                <span>Link do processo</span>
                <input
                  value={ficha.link_processo}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, link_processo: evento.target.value }))}
                />
              </label>
              <label className="wide">
                <span>Observações</span>
                <textarea
                  value={ficha.observacoes}
                  onChange={(evento) => setFicha((atual) => ({ ...atual, observacoes: evento.target.value }))}
                  rows={3}
                />
              </label>
              <div className="drawer-form-actions">
                {ficha.link_processo && (
                  <a href={ficha.link_processo} target="_blank" rel="noreferrer">
                    Abrir link
                  </a>
                )}
                <button className="btn-primary" disabled={salvando} type="submit">
                  Salvar ficha
                </button>
              </div>
            </form>

            <form className="movimentacao-form" onSubmit={adicionarMovimentacao}>
              <label>
                <span>Novo andamento</span>
                <textarea
                  value={descricao}
                  onChange={(evento) => setDescricao(evento.target.value)}
                  placeholder="Descreva a movimentação processual"
                  rows={4}
                />
              </label>
              <button className="btn-primary full" disabled={salvando} type="submit">
                Adicionar movimentação
              </button>
            </form>

            <div className="movimentacao-list">
              {movimentacoes.length === 0 ? (
                <p>Nenhuma movimentação registrada.</p>
              ) : movimentacoes.map((movimentacao) => (
                <article key={movimentacao.id}>
                  <time dateTime={movimentacao.data_registro}>
                    {formatarData(movimentacao.data_registro)}
                  </time>
                  <p>{movimentacao.descricao}</p>
                </article>
              ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
