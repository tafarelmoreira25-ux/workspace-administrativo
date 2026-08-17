import { useCallback, useEffect, useMemo, useState } from "react";
import ClienteDriveSelector from "./components/ClienteDriveSelector";
import {
  calcularMetricasStatusProcessual,
  obterOpcaoStatus,
  situacaoPrazoProcessual,
  STATUS_DOCUMENTOS_PROCESSUAIS,
  STATUS_PROCURACOES_PROCESSUAIS,
  STATUS_PROTOCOLOS_PROCESSUAIS,
  validarStatusProcessual,
} from "./lib/processStatus";
import { supabase } from "./lib/supabase";
import "./statusProcessual.css";

const FORMULARIO_VAZIO = {
  id: null,
  cliente: null,
  statusDocumentos: "pendente_conferencia",
  statusProcuracao: "pendente",
  statusProtocolo: "pendente",
  numeroProcesso: "",
  observacao: "",
};

function normalizar(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mensagemErroStatusProcessual(error) {
  const mensagem = error?.message || "Erro desconhecido.";
  if (
    error?.code === "PGRST202" ||
    /listar_status_processual|schema cache/i.test(mensagem)
  ) {
    return "O módulo ainda não foi instalado no Supabase. Execute supabase/status_processual_clientes_2026.sql no SQL Editor e atualize a página.";
  }
  return `Não foi possível carregar o Status Processual: ${mensagem}`;
}

function formatarData(valor) {
  if (!valor) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(`${String(valor).slice(0, 10)}T12:00:00`),
  );
}

function formatarDataHora(valor) {
  if (!valor) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));
}

function Metrica({ rotulo, valor, tom }) {
  return (
    <article className={`process-status-metric process-status-${tom}`}>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
    </article>
  );
}

export default function StatusProcessual({ usuario, podeEditar = false, showToast }) {
  const [registros, setRegistros] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc("listar_status_processual");
    setCarregando(false);
    if (error) {
      setErro(mensagemErroStatusProcessual(error));
      return;
    }
    setRegistros(data || []);
    setErro("");
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.rpc("listar_status_processual").then(({ data, error }) => {
      if (!ativo) return;
      setCarregando(false);
      if (error) {
        setErro(mensagemErroStatusProcessual(error));
        return;
      }
      setRegistros(data || []);
      setErro("");
    });
    return () => { ativo = false; };
  }, []);

  const metricas = calcularMetricasStatusProcessual(registros);
  const registrosFiltrados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return registros.filter((registro) => {
      if (filtro !== "todos" && registro.status_protocolo !== filtro) return false;
      if (!termo) return true;
      return normalizar([
        registro.nome_cliente,
        registro.numero_processo,
        registro.observacao,
        registro.status_documentos,
        registro.status_procuracao,
        registro.status_protocolo,
      ].join(" ")).includes(termo);
    });
  }, [busca, filtro, registros]);

  function alterar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
  }

  function editar(registro) {
    setFormulario({
      id: registro.id,
      cliente: {
        id: registro.cliente_id,
        nome: registro.nome_cliente,
        pasta_drive_url: registro.pasta_drive_url,
        pasta_drive_nome: registro.pasta_drive_nome,
        drive_status: registro.drive_status,
        drive_path: registro.drive_path,
      },
      statusDocumentos: registro.status_documentos,
      statusProcuracao: registro.status_procuracao,
      statusProtocolo: registro.status_protocolo,
      numeroProcesso: registro.numero_processo || "",
      observacao: registro.observacao || "",
    });
    window.setTimeout(() => {
      document.querySelector(".process-status-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function salvar(evento) {
    evento.preventDefault();
    const falha = validarStatusProcessual(formulario);
    if (falha) return window.alert(falha);

    setSalvando(true);
    const { error } = await supabase.rpc("salvar_status_processual", {
      p_registro_id: formulario.id ? Number(formulario.id) : null,
      p_cliente_id: Number(formulario.cliente.id),
      p_status_documentos: formulario.statusDocumentos,
      p_status_procuracao: formulario.statusProcuracao,
      p_status_protocolo: formulario.statusProtocolo,
      p_numero_processo: formulario.numeroProcesso.trim() || null,
      p_observacao: formulario.observacao.trim() || null,
    });
    setSalvando(false);
    if (error) return window.alert(`Não foi possível salvar: ${error.message}`);

    setFormulario(FORMULARIO_VAZIO);
    await carregar();
    showToast?.("Status processual atualizado e registrado no histórico.");
  }

  return (
    <section className="process-status-workspace">
      <header className="process-status-hero">
        <div>
          <span className="process-status-eyebrow">Acompanhamento compartilhado</span>
          <h2>Status Processual</h2>
          <p>Acompanhe documentos, procurações e o protocolo judicial de cada cliente encaminhado para distribuição.</p>
        </div>
        <div className="process-status-access">
          <strong>{podeEditar ? "Edição liberada" : "Modo de consulta"}</strong>
          <span>{podeEditar ? "Departamento Administrativo" : "Visualização para todos os departamentos"}</span>
          <button type="button" onClick={carregar} disabled={carregando}>
            {carregando ? "Atualizando..." : "Atualizar status"}
          </button>
        </div>
      </header>

      {erro && <div className="process-status-error" role="alert">{erro}</div>}

      <div className="process-status-metrics">
        <Metrica rotulo="Clientes registrados" valor={metricas.total} tom="neutral" />
        <Metrica rotulo="Protocolados" valor={metricas.protocolados} tom="success" />
        <Metrica rotulo="Pendentes" valor={metricas.pendentes} tom="pending" />
        <Metrica rotulo="Em geração" valor={metricas.emGeracao} tom="progress" />
        <Metrica rotulo="Pastas retornadas" valor={metricas.pastasRetornadas} tom="danger" />
      </div>

      {podeEditar ? (
        <section className="process-status-editor">
          <div className="process-status-section-heading">
            <div>
              <span>Atualização administrativa</span>
              <h3>{formulario.id ? "Editar andamento do cliente" : "Registrar cliente encaminhado"}</h3>
            </div>
            {formulario.id && (
              <button type="button" onClick={() => setFormulario(FORMULARIO_VAZIO)}>Cancelar edição</button>
            )}
          </div>
          <form onSubmit={salvar}>
            <ClienteDriveSelector
              disabled={Boolean(formulario.id)}
              label="Cliente encaminhado / pasta do Google Drive"
              onSelecionar={(cliente) => alterar("cliente", cliente)}
              required
              selecionado={formulario.cliente}
            />
            <div className="process-status-form-grid">
              <label>
                Situação dos documentos
                <select value={formulario.statusDocumentos} onChange={(evento) => alterar("statusDocumentos", evento.target.value)}>
                  {STATUS_DOCUMENTOS_PROCESSUAIS.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
                </select>
              </label>
              <label>
                Situação da procuração
                <select value={formulario.statusProcuracao} onChange={(evento) => alterar("statusProcuracao", evento.target.value)}>
                  {STATUS_PROCURACOES_PROCESSUAIS.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
                </select>
              </label>
              <label>
                Status do protocolo
                <select value={formulario.statusProtocolo} onChange={(evento) => alterar("statusProtocolo", evento.target.value)}>
                  {STATUS_PROTOCOLOS_PROCESSUAIS.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
                </select>
              </label>
              {formulario.statusProtocolo === "protocolado" && (
                <label>
                  Número do processo
                  <input value={formulario.numeroProcesso} onChange={(evento) => alterar("numeroProcesso", evento.target.value)} placeholder="0000000-00.0000.0.00.0000" required />
                </label>
              )}
            </div>
            {formulario.statusProtocolo === "em_geracao" && (
              <div className="process-status-deadline-note">O prazo de 15 dias será iniciado automaticamente ao salvar este status.</div>
            )}
            <label className="process-status-observation">
              Observação do andamento
              <textarea rows="4" value={formulario.observacao} onChange={(evento) => alterar("observacao", evento.target.value)} placeholder="Registre irregularidades, documentos pendentes ou orientações para os demais departamentos." />
            </label>
            <button className="process-status-save" disabled={salvando} type="submit">
              {salvando ? "Salvando..." : "Salvar status processual"}
            </button>
          </form>
        </section>
      ) : (
        <div className="process-status-readonly">
          <span aria-hidden="true">👁</span>
          <div><strong>Consulta compartilhada</strong><p>Você pode acompanhar todos os clientes. As alterações são exclusivas do departamento Administrativo.</p></div>
        </div>
      )}

      <section className="process-status-list-section">
        <div className="process-status-section-heading">
          <div><span>Esteira de distribuição</span><h3>Clientes encaminhados</h3></div>
          <strong>{registrosFiltrados.length}</strong>
        </div>
        <div className="process-status-filters">
          <input type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar cliente, processo ou observação" />
          <select value={filtro} onChange={(evento) => setFiltro(evento.target.value)} aria-label="Filtrar pelo status do protocolo">
            <option value="todos">Todos os status</option>
            {STATUS_PROTOCOLOS_PROCESSUAIS.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
          </select>
        </div>

        {carregando ? (
          <p className="process-status-empty">Carregando clientes...</p>
        ) : registrosFiltrados.length === 0 ? (
          <p className="process-status-empty">Nenhum cliente encontrado neste filtro.</p>
        ) : (
          <div className="process-status-list">
            {registrosFiltrados.map((registro) => {
              const protocolo = obterOpcaoStatus(STATUS_PROTOCOLOS_PROCESSUAIS, registro.status_protocolo);
              const documentos = obterOpcaoStatus(STATUS_DOCUMENTOS_PROCESSUAIS, registro.status_documentos);
              const procuracao = obterOpcaoStatus(STATUS_PROCURACOES_PROCESSUAIS, registro.status_procuracao);
              const prazo = situacaoPrazoProcessual(registro.prazo_protocolo);
              return (
                <article className={`process-status-card process-status-card-${protocolo.tom}`} key={registro.id}>
                  <div className="process-status-card-heading">
                    <div><span>Cliente</span><h3>{registro.nome_cliente}</h3></div>
                    <strong className={`process-status-badge process-status-badge-${protocolo.tom}`}>{protocolo.rotulo}</strong>
                  </div>
                  <div className="process-status-details">
                    <div><span>Documentos</span><strong>{documentos.rotulo}</strong></div>
                    <div><span>Procuração</span><strong>{procuracao.rotulo}</strong></div>
                    <div><span>Número do processo</span><strong>{registro.numero_processo || "Aguardando protocolo"}</strong></div>
                    <div><span>Prazo do protocolo</span><strong className={prazo?.vencido ? "is-overdue" : ""}>{prazo ? `${formatarData(registro.prazo_protocolo)} · ${prazo.rotulo}` : "Ainda não iniciado"}</strong></div>
                  </div>
                  {registro.observacao && <p className="process-status-card-note">{registro.observacao}</p>}
                  <div className="process-status-card-footer">
                    <small>Atualizado em {formatarDataHora(registro.updated_at)} por {registro.atualizado_por_email || usuario?.nome || "Administrativo"}</small>
                    <div>
                      {registro.pasta_drive_url && <a href={registro.pasta_drive_url} target="_blank" rel="noreferrer">Abrir pasta e protocolo no Drive</a>}
                      {podeEditar && <button type="button" onClick={() => editar(registro)}>Editar status</button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
