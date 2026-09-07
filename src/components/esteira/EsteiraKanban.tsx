import { FormEvent, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  CHECKLIST_ELITE,
  type ArquivosChecklistElite,
  type FaseProcessual,
  type Processo,
  calcularPrazoElite,
  checklistEliteCompleto,
  enviarChecklistElite,
} from "../../lib/esteiraProcessual";

type Props = {
  processos: Processo[];
  onProcessoAtualizado: (processo: Processo) => void;
  showToast: (mensagem: string) => void;
};

const COLUNAS_KANBAN: FaseProcessual[] = [
  "Solicitado para Ajuizamento",
  "Documentos Pendentes",
  "Documentos Concluídos",
  "Enviado para Elite",
  "Pasta Retornada",
  "Protocolo Liberado",
];

const ROTULOS_FASE: Record<FaseProcessual, string> = {
  "Solicitado para Ajuizamento": "Solicitado",
  "Documentos Pendentes": "Docs pendentes",
  "Documentos Concluídos": "Docs concluídos",
  "Pré-Distribuição": "Pré-distribuição",
  "Enviado para Elite": "Enviado para Elite",
  "Pasta Retornada": "Pasta retornada",
  "Protocolo Liberado": "Protocolo liberado",
  Tramitando: "Tramitando",
  Arquivado: "Arquivado",
  Improcedente: "Improcedente",
};

const STATUS_JUDICIAL_PADRAO = [
  "TRAMITANDO",
  "ARQUIVADO",
  "IMPROCEDENTE",
  "SENTENÇA PROCEDENTE",
  "SENTENÇA PARCIALMENTE PROCEDENTE",
  "NÃO CONFIRMADO NA CONSULTA PÚBLICA",
];

function formatarData(data: Date | string | null | undefined) {
  if (!data) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

function faseTemPrazo(fase: FaseProcessual) {
  return ["Enviado para Elite", "Pasta Retornada", "Protocolo Liberado"].includes(fase);
}

export default function EsteiraKanban({
  processos,
  onProcessoAtualizado,
  showToast,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [uploadProcesso, setUploadProcesso] = useState<Processo | null>(null);
  const [protocoloProcesso, setProtocoloProcesso] = useState<Processo | null>(null);
  const [arquivos, setArquivos] = useState<ArquivosChecklistElite>({});
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tipoCadastro, setTipoCadastro] = useState<"novo" | "existente">("novo");
  const [novoProcesso, setNovoProcesso] = useState({
    nome_cliente: "",
    banco_reu: "",
    numero_processo: "",
    data_distribuicao: "",
    status_judicial: "TRAMITANDO",
    justica_gratuita: "Não Solicitada",
    emenda_inicial: "",
    link_processo: "",
    observacoes: "",
  });

  const processosPorFase = useMemo(
    () => Object.fromEntries(
      COLUNAS_KANBAN.map((fase) => [
        fase,
        processos.filter((processo) => processo.fase_atual === fase),
      ]),
    ) as Record<FaseProcessual, Processo[]>,
    [processos],
  );

  async function criarProcesso(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nome = novoProcesso.nome_cliente.trim();
    if (!nome) {
      showToast("Informe o nome do cliente.");
      return;
    }
    if (tipoCadastro === "existente" && !novoProcesso.numero_processo.trim()) {
      showToast("Informe o número do processo já protocolado.");
      return;
    }

    const registroExistente = tipoCadastro === "existente";
    const faseInicial = registroExistente ? "Protocolo Liberado" : "Solicitado para Ajuizamento";
    const banco = novoProcesso.banco_reu.trim();

    setSalvando(true);
    const { data, error } = await supabase
      .from("processos")
      .insert({
        nome_cliente: nome,
        autor_reu: banco ? `${nome} X ${banco}` : nome,
        banco_reu: banco || null,
        fase_atual: faseInicial,
        numero_processo: novoProcesso.numero_processo.trim() || null,
        data_distribuicao: novoProcesso.data_distribuicao || null,
        status_judicial: registroExistente ? novoProcesso.status_judicial : null,
        justica_gratuita: novoProcesso.justica_gratuita,
        emenda_inicial: novoProcesso.emenda_inicial.trim() || null,
        link_processo: novoProcesso.link_processo.trim() || null,
        observacoes: novoProcesso.observacoes.trim() || null,
        origem_registro: registroExistente ? "planilha_oficial" : "novo_encaminhamento",
      })
      .select("*")
      .single();
    setSalvando(false);

    if (error) {
      showToast("Não foi possível criar o registro.");
      return;
    }

    onProcessoAtualizado(data as Processo);
    setNovoProcesso({
      nome_cliente: "",
      banco_reu: "",
      numero_processo: "",
      data_distribuicao: "",
      status_judicial: "TRAMITANDO",
      justica_gratuita: "Não Solicitada",
      emenda_inicial: "",
      link_processo: "",
      observacoes: "",
    });
    showToast(registroExistente ? "Processo existente cadastrado." : "Novo ajuizamento cadastrado.");
  }

  async function atualizarFase(
    processo: Processo,
    fase: FaseProcessual,
    extras: Partial<Processo> = {},
  ) {
    setSalvando(true);
    const { data, error } = await supabase
      .from("processos")
      .update({ fase_atual: fase, ...extras })
      .eq("id", processo.id)
      .select("*")
      .single();
    setSalvando(false);

    if (error) {
      showToast("Não foi possível atualizar a etapa.");
      return;
    }

    onProcessoAtualizado(data as Processo);
    showToast("Etapa atualizada.");
  }

  function receberCard(faseDestino: FaseProcessual) {
    if (!dragId) return;
    const processo = processos.find((item) => item.id === dragId);
    setDragId(null);
    if (!processo || processo.fase_atual === faseDestino) return;

    if (faseDestino === "Enviado para Elite" && !checklistEliteCompleto(processo.checklist_elite)) {
      setUploadProcesso(processo);
      setArquivos({});
      return;
    }

    if (faseDestino === "Enviado para Elite") {
      const dataEnvio = processo.data_envio_elite || new Date().toISOString();
      const prazo = calcularPrazoElite(dataEnvio);
      atualizarFase(processo, faseDestino, {
        data_envio_elite: dataEnvio,
        status_prazo: prazo.rotulo,
      });
      return;
    }

    if (faseDestino === "Pasta Retornada" && !processo.data_envio_elite) {
      showToast("Marque o envio para a Elite antes de registrar retorno da pasta.");
      return;
    }

    if (faseDestino === "Protocolo Liberado" && !processo.numero_processo) {
      setProtocoloProcesso(processo);
      setNumeroProcesso("");
      return;
    }

    atualizarFase(processo, faseDestino);
  }

  async function confirmarEnvioElite(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!uploadProcesso) return;
    setSalvando(true);

    try {
      const checklist = await enviarChecklistElite(uploadProcesso.id, arquivos);
      const dataEnvio = new Date().toISOString();
      const prazo = calcularPrazoElite(dataEnvio);
      const { data, error } = await supabase
        .from("processos")
        .update({
          fase_atual: "Enviado para Elite",
          data_envio_elite: dataEnvio,
          status_prazo: prazo.rotulo,
          checklist_elite: checklist,
        })
        .eq("id", uploadProcesso.id)
        .select("*")
        .single();

      if (error) throw error;
      onProcessoAtualizado(data as Processo);
      setUploadProcesso(null);
      setArquivos({});
      showToast("Checklist anexado e processo enviado para a Elite.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Falha no upload do checklist.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarProtocolo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!protocoloProcesso) return;
    const numero = numeroProcesso.trim();
    if (!numero) {
      showToast("Informe o número do processo.");
      return;
    }

    await atualizarFase(protocoloProcesso, "Protocolo Liberado", {
      numero_processo: numero,
      status_judicial: protocoloProcesso.status_judicial || "TRAMITANDO",
      data_distribuicao: new Date().toISOString().slice(0, 10),
    });
    setProtocoloProcesso(null);
    setNumeroProcesso("");
  }

  return (
    <div className="esteira-kanban-view">
      <form className="esteira-create-card extended" onSubmit={criarProcesso}>
        <div className="esteira-form-mode">
          <button
            className={tipoCadastro === "novo" ? "active" : ""}
            onClick={() => setTipoCadastro("novo")}
            type="button"
          >
            Novo ajuizamento
          </button>
          <button
            className={tipoCadastro === "existente" ? "active" : ""}
            onClick={() => setTipoCadastro("existente")}
            type="button"
          >
            Processo já protocolado
          </button>
        </div>
        <label>
          <span>Cliente</span>
          <input
            value={novoProcesso.nome_cliente}
            onChange={(evento) => setNovoProcesso((atual) => ({
              ...atual,
              nome_cliente: evento.target.value,
            }))}
            placeholder="Nome do cliente"
          />
        </label>
        <label>
          <span>Banco réu</span>
          <input
            value={novoProcesso.banco_reu}
            onChange={(evento) => setNovoProcesso((atual) => ({
              ...atual,
              banco_reu: evento.target.value,
            }))}
            placeholder="Banco ou instituição"
          />
        </label>
        {tipoCadastro === "existente" && (
          <>
            <label>
              <span>Número do processo</span>
              <input
                value={novoProcesso.numero_processo}
                onChange={(evento) => setNovoProcesso((atual) => ({
                  ...atual,
                  numero_processo: evento.target.value,
                }))}
                placeholder="0000000-00.0000.0.00.0000"
              />
            </label>
            <label>
              <span>Distribuído em</span>
              <input
                type="date"
                value={novoProcesso.data_distribuicao}
                onChange={(evento) => setNovoProcesso((atual) => ({
                  ...atual,
                  data_distribuicao: evento.target.value,
                }))}
              />
            </label>
            <label>
              <span>Status judicial</span>
              <select
                value={novoProcesso.status_judicial}
                onChange={(evento) => setNovoProcesso((atual) => ({
                  ...atual,
                  status_judicial: evento.target.value,
                }))}
              >
                {STATUS_JUDICIAL_PADRAO.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Justiça gratuita</span>
              <select
                value={novoProcesso.justica_gratuita}
                onChange={(evento) => setNovoProcesso((atual) => ({
                  ...atual,
                  justica_gratuita: evento.target.value,
                }))}
              >
                <option>Deferida</option>
                <option>Indeferida</option>
                <option>Não Solicitada</option>
              </select>
            </label>
            <label>
              <span>Emenda inicial</span>
              <input
                value={novoProcesso.emenda_inicial}
                onChange={(evento) => setNovoProcesso((atual) => ({
                  ...atual,
                  emenda_inicial: evento.target.value,
                }))}
                placeholder="Juntada, prazo decorrido..."
              />
            </label>
            <label>
              <span>Link do processo</span>
              <input
                value={novoProcesso.link_processo}
                onChange={(evento) => setNovoProcesso((atual) => ({
                  ...atual,
                  link_processo: evento.target.value,
                }))}
                placeholder="Link do PJe/e-SAJ/consulta"
              />
            </label>
          </>
        )}
        <label className="wide">
          <span>Observações</span>
          <input
            value={novoProcesso.observacoes}
            onChange={(evento) => setNovoProcesso((atual) => ({
              ...atual,
              observacoes: evento.target.value,
            }))}
            placeholder="Resumo rápido do caso ou última movimentação"
          />
        </label>
        <button className="btn-primary" disabled={salvando} type="submit">
          Cadastrar
        </button>
      </form>

      <div className="esteira-kanban">
        {COLUNAS_KANBAN.map((fase) => (
          <section
            className="kanban-column"
            key={fase}
            onDragOver={(evento) => evento.preventDefault()}
            onDrop={() => receberCard(fase)}
          >
            <header>
              <span>{ROTULOS_FASE[fase]}</span>
              <strong>{processosPorFase[fase].length}</strong>
            </header>
            <div className="kanban-card-list">
              {processosPorFase[fase].length === 0 ? (
                <p className="kanban-empty">Sem pastas nesta etapa.</p>
              ) : processosPorFase[fase].map((processo) => {
                const prazo = calcularPrazoElite(processo.data_envio_elite);
                return (
                  <article
                    className="process-card"
                    draggable
                    key={processo.id}
                    onDragStart={() => setDragId(processo.id)}
                  >
                    <div>
                      <strong>{processo.nome_cliente}</strong>
                      <span>{processo.banco_reu || "Banco não informado"}</span>
                    </div>
                    {faseTemPrazo(processo.fase_atual) && (
                      <span className={`prazo-chip ${prazo.sinalizacao}`}>
                        {prazo.rotulo} · {formatarData(prazo.dataLimite)}
                      </span>
                    )}
                    {processo.numero_processo && (
                      <small>Processo {processo.numero_processo}</small>
                    )}
                    {processo.status_judicial && (
                      <small>Status: {processo.status_judicial}</small>
                    )}
                    {processo.observacoes && <p>{processo.observacoes}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {uploadProcesso && (
        <div className="esteira-modal-backdrop" role="presentation">
          <form className="esteira-modal" onSubmit={confirmarEnvioElite}>
            <button
              className="modal-close"
              onClick={() => setUploadProcesso(null)}
              type="button"
            >
              ×
            </button>
            <span className="eyebrow">Checklist judicial</span>
            <h3>{uploadProcesso.nome_cliente}</h3>
            <p>Anexe os documentos assinados antes de enviar a pasta para a Elite.</p>
            <div className="checklist-upload-grid">
              {CHECKLIST_ELITE.map((item) => (
                <label key={item.id}>
                  <span>{item.label}</span>
                  <input
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(evento) => {
                      const arquivo = evento.target.files?.[0];
                      setArquivos((atuais) => ({ ...atuais, [item.id]: arquivo }));
                    }}
                    required
                    type="file"
                  />
                </label>
              ))}
            </div>
            <button className="btn-primary full" disabled={salvando} type="submit">
              Anexar e enviar para Elite
            </button>
          </form>
        </div>
      )}

      {protocoloProcesso && (
        <div className="esteira-modal-backdrop" role="presentation">
          <form className="esteira-modal" onSubmit={confirmarProtocolo}>
            <button
              className="modal-close"
              onClick={() => setProtocoloProcesso(null)}
              type="button"
            >
              ×
            </button>
            <span className="eyebrow">Protocolo liberado</span>
            <h3>{protocoloProcesso.nome_cliente}</h3>
            <label>
              <span>Número do processo</span>
              <input
                autoFocus
                value={numeroProcesso}
                onChange={(evento) => setNumeroProcesso(evento.target.value)}
                placeholder="0000000-00.0000.0.00.0000"
              />
            </label>
            <button className="btn-primary full" disabled={salvando} type="submit">
              Salvar protocolo
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
