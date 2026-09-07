import { FormEvent, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  type FaseProcessual,
  type Processo,
  calcularPrazoElite,
} from "../../lib/esteiraProcessual";

type Props = {
  processos: Processo[];
  onProcessoAtualizado: (processo: Processo) => void;
  showToast: (mensagem: string) => void;
};

const STATUS_DOCUMENTOS = ["Regular", "Irregular", "Pendente"];
const STATUS_PROCURACAO = ["Elaborando", "Assinadas", "Pendentes", "Atrasadas"];
const STATUS_ENVIO_ELITE = ["Pendente", "Enviado"];

function formatarData(data: Date | string | null | undefined) {
  if (!data) return "Ainda não iniciado";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(data));
}

function criarFormulario(processo?: Processo | null) {
  return {
    pasta_cliente_id: processo?.pasta_cliente_id || "",
    nome_cliente: processo?.nome_cliente || "",
    cpf_cliente: processo?.cpf_cliente || "",
    banco_reu: processo?.banco_reu || "",
    status_documentos: processo?.status_documentos || "Pendente",
    status_procuracao: processo?.status_procuracao || "Elaborando",
    documentos_elite_status: processo?.documentos_elite_status || "Pendente",
    pasta_retornada: Boolean(processo?.pasta_retornada),
    numero_processo: processo?.numero_processo || "",
    observacoes: processo?.observacoes || "",
  };
}

function statusOperacional(processo: Processo) {
  if (processo.pasta_retornada) return { classe: "retornada", rotulo: "Pasta retornou" };
  if (processo.numero_processo) return { classe: "protocolado", rotulo: "Protocolado" };
  if (calcularPrazoElite(processo.data_envio_elite).sinalizacao === "vermelho") {
    return { classe: "atrasado", rotulo: "Atrasado" };
  }
  return { classe: "pendente", rotulo: "Pendente" };
}

export default function EsteiraKanban({
  processos,
  onProcessoAtualizado,
  showToast,
}: Props) {
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [processoEditando, setProcessoEditando] = useState<Processo | null>(null);
  const [formulario, setFormulario] = useState(criarFormulario(null));
  const [salvando, setSalvando] = useState(false);

  const protocolos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return processos.filter((processo) => (
      processo.fase_atual !== "Arquivado" &&
      processo.fase_atual !== "Improcedente"
    )).filter((processo) => {
      if (!termo) return true;
      return [
        processo.nome_cliente,
        processo.cpf_cliente,
        processo.pasta_cliente_id,
        processo.banco_reu,
        processo.numero_processo,
        processo.observacoes,
      ].some((valor) => String(valor || "").toLowerCase().includes(termo));
    });
  }, [busca, processos]);

  function abrirNovoCadastro() {
    setProcessoEditando(null);
    setFormulario(criarFormulario(null));
    setModalAberto(true);
  }

  function abrirEdicao(processo: Processo) {
    setProcessoEditando(processo);
    setFormulario(criarFormulario(processo));
    setModalAberto(true);
  }

  async function salvarCadastro(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nome = formulario.nome_cliente.trim();
    const banco = formulario.banco_reu.trim();

    if (!nome || !banco) {
      showToast("Informe cliente e banco para cadastrar a pasta.");
      return;
    }

    const temNumero = Boolean(formulario.numero_processo.trim());
    let fase: FaseProcessual = temNumero ? "Protocolo Liberado" : "Solicitado para Ajuizamento";
    let dataEnvioElite = processoEditando?.data_envio_elite || null;
    let statusPrazo = processoEditando?.status_prazo || null;
    let dataProtocoloLiberado = processoEditando?.data_protocolo_liberado || null;

    if (formulario.documentos_elite_status === "Enviado" && !dataEnvioElite) {
      dataEnvioElite = new Date().toISOString();
      statusPrazo = calcularPrazoElite(dataEnvioElite).rotulo;
      fase = "Enviado para Elite";
    }

    if (formulario.pasta_retornada && !temNumero) {
      fase = "Pasta Retornada";
    }

    if (temNumero && !dataProtocoloLiberado) {
      dataProtocoloLiberado = new Date().toISOString();
      fase = "Protocolo Liberado";
    }

    const payload = {
      pasta_cliente_id: formulario.pasta_cliente_id.trim() || null,
      nome_cliente: nome,
      cpf_cliente: formulario.cpf_cliente.trim() || null,
      banco_reu: banco,
      autor_reu: `${nome} X ${banco}`,
      fase_atual: fase,
      status_documentos: formulario.status_documentos,
      status_procuracao: formulario.status_procuracao,
      documentos_elite_status: formulario.documentos_elite_status,
      pasta_retornada: formulario.pasta_retornada,
      data_envio_elite: dataEnvioElite,
      data_protocolo_liberado: dataProtocoloLiberado,
      numero_processo: formulario.numero_processo.trim() || null,
      status_judicial: temNumero ? "TRAMITANDO" : null,
      observacoes: formulario.observacoes.trim() || null,
      origem_registro: processoEditando?.origem_registro || "protocolo_manual",
    };

    setSalvando(true);
    const query = processoEditando
      ? supabase.from("processos").update(payload).eq("id", processoEditando.id)
      : supabase.from("processos").insert(payload);
    const { data, error } = await query.select("*").single();
    setSalvando(false);

    if (error) {
      showToast("Não foi possível salvar o protocolo.");
      return;
    }

    onProcessoAtualizado(data as Processo);
    setModalAberto(false);
    setProcessoEditando(null);
    showToast("Protocolo salvo.");
  }

  return (
    <div className="protocolos-view">
      <div className="protocolos-toolbar">
        <div>
          <span className="eyebrow">Protocolos</span>
          <h2>Pastas encaminhadas ao processual</h2>
        </div>
        <label>
          <span>Pesquisar</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Cliente, CPF, ID, banco ou processo"
          />
        </label>
        <button className="btn-primary" onClick={abrirNovoCadastro} type="button">
          Cadastrar cliente
        </button>
      </div>

      <div className="protocolos-list">
        {protocolos.length === 0 ? (
          <article className="protocolo-empty">
            <strong>Nenhuma pasta cadastrada</strong>
            <p>Cadastre o cliente quando a tratativa extrajudicial não resolver e a pasta precisar seguir para ajuizamento.</p>
          </article>
        ) : protocolos.map((processo) => {
          const prazo = calcularPrazoElite(processo.data_envio_elite);
          const status = statusOperacional(processo);

          return (
            <article className={`protocolo-card ${status.classe}`} key={processo.id}>
              <div className="protocolo-card-head">
                <div>
                  <span>Cliente</span>
                  <h3>{processo.nome_cliente}</h3>
                </div>
                <strong className={`protocolo-status ${status.classe}`}>{status.rotulo}</strong>
              </div>

              <dl className="protocolo-fields">
                <div>
                  <dt>Documentos</dt>
                  <dd>{processo.status_documentos || "Pendente"}</dd>
                </div>
                <div>
                  <dt>Procuração</dt>
                  <dd>{processo.status_procuracao || "Elaborando"}</dd>
                </div>
                <div>
                  <dt>Elite</dt>
                  <dd>{processo.documentos_elite_status || "Pendente"}</dd>
                </div>
                <div>
                  <dt>Número do processo</dt>
                  <dd>{processo.numero_processo || "Aguardando protocolo"}</dd>
                </div>
                <div>
                  <dt>Prazo do protocolo</dt>
                  <dd>{prazo.diasUteisRestantes === null ? prazo.rotulo : `${prazo.diasUteisRestantes} dias úteis`}</dd>
                </div>
              </dl>

              {processo.observacoes && (
                <p className="protocolo-observacao">{processo.observacoes}</p>
              )}

              <footer>
                <span>
                  Atualizado em {formatarData(processo.updated_at)} · ID {processo.pasta_cliente_id || "não informado"}
                </span>
                <button className="btn-secondary compact" onClick={() => abrirEdicao(processo)} type="button">
                  Editar status
                </button>
              </footer>
            </article>
          );
        })}
      </div>

      {modalAberto && (
        <div className="esteira-modal-backdrop" role="presentation">
          <form className="esteira-modal protocolo-modal" onSubmit={salvarCadastro}>
            <button
              className="modal-close"
              onClick={() => setModalAberto(false)}
              type="button"
            >
              ×
            </button>
            <span className="eyebrow">Cadastro preliminar</span>
            <h3>{processoEditando ? "Editar protocolo" : "Cadastrar cliente"}</h3>
            <div className="protocolo-modal-grid">
              <label>
                <span>Nome do cliente</span>
                <input
                  value={formulario.nome_cliente}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, nome_cliente: evento.target.value }))}
                />
              </label>
              <label>
                <span>Banco</span>
                <input
                  value={formulario.banco_reu}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, banco_reu: evento.target.value }))}
                />
              </label>
              <label>
                <span>CPF</span>
                <input
                  value={formulario.cpf_cliente}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, cpf_cliente: evento.target.value }))}
                  placeholder="000.000.000-00"
                />
              </label>
              <label>
                <span>ID da pasta</span>
                <input
                  value={formulario.pasta_cliente_id}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, pasta_cliente_id: evento.target.value }))}
                  placeholder="Código interno ou pasta Drive"
                />
              </label>
              <label>
                <span>Documentos judiciais</span>
                <select
                  value={formulario.status_documentos}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, status_documentos: evento.target.value }))}
                >
                  {STATUS_DOCUMENTOS.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                <span>Procurações</span>
                <select
                  value={formulario.status_procuracao}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, status_procuracao: evento.target.value }))}
                >
                  {STATUS_PROCURACAO.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                <span>Anexado e enviado para Elite</span>
                <select
                  value={formulario.documentos_elite_status}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, documentos_elite_status: evento.target.value }))}
                >
                  {STATUS_ENVIO_ELITE.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label>
                <span>Pasta retornada</span>
                <select
                  value={formulario.pasta_retornada ? "Sim" : "Não"}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, pasta_retornada: evento.target.value === "Sim" }))}
                >
                  <option>Não</option>
                  <option>Sim</option>
                </select>
              </label>
              <label>
                <span>Número do processo</span>
                <input
                  value={formulario.numero_processo}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, numero_processo: evento.target.value }))}
                  placeholder="Preencha quando o protocolo for liberado"
                />
              </label>
              <label className="wide">
                <span>Observações</span>
                <textarea
                  value={formulario.observacoes}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, observacoes: evento.target.value }))}
                  rows={3}
                  placeholder="Ex.: correção pendente, documentos irregulares, retorno da Elite..."
                />
              </label>
            </div>
            <button className="btn-primary full" disabled={salvando} type="submit">
              Salvar protocolo
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
