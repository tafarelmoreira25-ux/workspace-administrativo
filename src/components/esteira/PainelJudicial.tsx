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

const ETAPAS_PROCESSUAIS: FaseProcessual[] = [
  "Solicitado para Ajuizamento",
  "Documentos Pendentes",
  "Documentos Concluídos",
  "Enviado para Elite",
  "Pasta Retornada",
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
    fase_atual: processo?.fase_atual || "Solicitado para Ajuizamento",
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

  const processosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return processos.filter((processo) => {
      if (!termo) return true;
      return [
        processo.autor_reu,
        processo.nome_cliente,
        processo.banco_reu,
        processo.numero_processo,
        processo.vara,
        processo.status_judicial,
        processo.emenda_inicial,
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
        showToast("Não foi possível carregar o histórico dos autos.");
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
    const nome = ficha.nome_cliente.trim();
    const banco = ficha.banco_reu.trim();

    if (!nome) {
      showToast("Informe o nome do cliente.");
      return;
    }

    const temNumero = Boolean(ficha.numero_processo.trim());
    const fase = temNumero && ficha.fase_atual === "Solicitado para Ajuizamento"
      ? "Protocolo Liberado"
      : ficha.fase_atual;

    setSalvando(true);
    const { data, error } = await supabase
      .from("processos")
      .update({
        nome_cliente: nome,
        banco_reu: banco || null,
        autor_reu: banco ? `${nome} X ${banco}` : nome,
        numero_processo: ficha.numero_processo.trim() || null,
        vara: ficha.vara.trim() || null,
        fase_atual: fase,
        status_judicial: temNumero ? ficha.status_judicial.trim() || "TRAMITANDO" : null,
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
      showToast("Não foi possível salvar o processo.");
      return;
    }

    const atualizado = data as Processo;
    onProcessoAtualizado(atualizado);
    setProcessoAberto(atualizado);
    showToast("Processo atualizado.");
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
      .insert({ processo_id: processoAberto.id, descricao: texto, tipo: "historico_autos" })
      .select("*")
      .single();
    setSalvando(false);

    if (error) {
      showToast("Não foi possível registrar o andamento.");
      return;
    }

    setMovimentacoes((atuais) => [data as MovimentacaoProcessual, ...atuais]);
    setDescricao("");
    showToast("Andamento registrado.");
  }

  return (
    <div className="painel-judicial">
      <div className="judicial-toolbar">
        <div>
          <span className="eyebrow">Processos</span>
          <h2>Controle jurídico das pastas</h2>
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
              <th>Autor x réu</th>
              <th>Processo</th>
              <th>Distribuído</th>
              <th>Situação</th>
              <th>Status</th>
              <th>Justiça gratuita</th>
              <th>Emenda inicial</th>
              <th>Link</th>
              <th>Observações</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {processosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={10}>Nenhum processo encontrado.</td>
              </tr>
            ) : processosFiltrados.map((processo) => {
              const prazo = calcularPrazoElite(processo.data_envio_elite);
              const protocolado = Boolean(processo.numero_processo);

              return (
                <tr key={processo.id}>
                  <td><strong>{processo.autor_reu || processo.nome_cliente}</strong></td>
                  <td>{processo.numero_processo || "Pendente"}</td>
                  <td>{formatarData(processo.data_distribuicao)}</td>
                  <td>
                    <span className={`judicial-phase ${protocolado ? "protocolado" : "pendente"}`}>
                      {protocolado ? "Protocolado" : "Pendente"}
                    </span>
                  </td>
                  <td><span className="judicial-phase">{processo.status_judicial || processo.fase_atual}</span></td>
                  <td>{processo.justica_gratuita || "Não Solicitada"}</td>
                  <td>{processo.emenda_inicial || "-"}</td>
                  <td>{processo.link_processo ? <a href={processo.link_processo} target="_blank" rel="noreferrer">Abrir</a> : "-"}</td>
                  <td>{processo.observacoes || "-"}</td>
                  <td>
                    <button
                      className="btn-secondary compact"
                      onClick={() => setProcessoAberto(processo)}
                      type="button"
                    >
                      {protocolado ? "Abrir processo" : "Abrir pasta"}
                    </button>
                    {!protocolado && prazo.dataLimite && (
                      <span className={`prazo-chip ${prazo.sinalizacao}`}>
                        {prazo.rotulo}
                      </span>
                    )}
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
            <span className="eyebrow">Ficha jurídica</span>
            <h3>{processoAberto.nome_cliente}</h3>
            <p>{processoAberto.numero_processo || "Pasta pendente de protocolo"}</p>

            <form className="processo-ficha-form" onSubmit={salvarFicha}>
              <label>
                <span>Nome do cliente</span>
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
                  {ETAPAS_PROCESSUAIS.map((fase) => (
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
                    Abrir link do processo
                  </a>
                )}
                <button className="btn-primary" disabled={salvando} type="submit">
                  Salvar processo
                </button>
              </div>
            </form>

            <form className="movimentacao-form" onSubmit={adicionarMovimentacao}>
              <label>
                <span>Histórico dos autos</span>
                <textarea
                  value={descricao}
                  onChange={(evento) => setDescricao(evento.target.value)}
                  placeholder="Registre a movimentação mais recente que será usada no retorno ao cliente"
                  rows={4}
                />
              </label>
              <button className="btn-primary full" disabled={salvando} type="submit">
                Adicionar andamento
              </button>
            </form>

            <div className="movimentacao-list">
              {movimentacoes.length === 0 ? (
                <p>Nenhum andamento registrado.</p>
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
