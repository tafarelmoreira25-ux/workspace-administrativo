import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import GeradorDocumentos from "../../GeradorDocumentos";

type Cliente = {
  id: string | number;
  nome_completo: string;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  id_crm: string | null;
  responsavel: string | null;
  observacoes: string | null;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

type ProcessoResumo = {
  id: string;
  cliente_id?: string | null;
  nome_cliente?: string | null;
  cpf_cliente?: string | null;
  banco_reu?: string | null;
  numero_processo?: string | null;
  fase_atual?: string | null;
  status_judicial?: string | null;
  justica_gratuita?: string | null;
  responsavel?: string | null;
  updated_at?: string | null;
};

type DocumentoResumo = {
  id: string;
  nome_documento: string;
  modelo_nome: string;
  cliente_nome: string | null;
  cpf_cnpj: string | null;
  numero_processo: string | null;
  responsavel_nome: string | null;
  status: string | null;
  created_at: string | null;
};

type AtendimentoResumo = {
  id: string;
  cliente_id?: string | null;
  processo_id?: string | null;
  cliente_nome: string;
  processo_numero?: string | null;
  data: string;
  hora?: string | null;
  canal: string;
  tipo?: string | null;
  descricao: string;
  responsavel?: string | null;
  anexo_url?: string | null;
  created_at?: string | null;
};

type Props = {
  usuario: { nome?: string; email?: string };
  showToast?: (message: string) => void;
};

const FORMULARIO_INICIAL = {
  nome_completo: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  telefone: "",
  email: "",
  endereco: "",
  id_crm: "",
  responsavel: "",
  observacoes: "",
};

function normalizarBusca(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatarData(data?: string | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(data));
}

function formatarDataHora(data?: string | null) {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data));
}

function criarFormulario(cliente?: Cliente | null, responsavel = "") {
  if (!cliente) return { ...FORMULARIO_INICIAL, responsavel };
  return {
    nome_completo: cliente.nome_completo || "",
    cpf: cliente.cpf || "",
    rg: cliente.rg || "",
    data_nascimento: cliente.data_nascimento || "",
    telefone: cliente.telefone || "",
    email: cliente.email || "",
    endereco: cliente.endereco || "",
    id_crm: cliente.id_crm || "",
    responsavel: cliente.responsavel || responsavel,
    observacoes: cliente.observacoes || "",
  };
}

function limparTexto(valor: string) {
  const texto = valor.trim();
  return texto || null;
}

export default function ClientesModule({ usuario, showToast }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [processos, setProcessos] = useState<ProcessoResumo[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoResumo[]>([]);
  const [atendimentos, setAtendimentos] = useState<AtendimentoResumo[]>([]);
  const [busca, setBusca] = useState("");
  const [clienteAberto, setClienteAberto] = useState<Cliente | null>(null);
  const [abaFicha, setAbaFicha] = useState("resumo");
  const [modalAberto, setModalAberto] = useState(false);
  const [geradorAberto, setGeradorAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [formulario, setFormulario] = useState(() => criarFormulario(null, usuario.nome || ""));
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const avisar = useCallback((mensagem: string) => {
    if (showToast) showToast(mensagem);
    else window.alert(mensagem);
  }, [showToast]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro("");

    const [clientesResultado, processosResultado, documentosResultado, atendimentosResultado] = await Promise.allSettled([
      supabase.from("clientes").select("*").order("updated_at", { ascending: false }).limit(250),
      supabase.from("processos").select("id, cliente_id, nome_cliente, cpf_cliente, banco_reu, numero_processo, fase_atual, status_judicial, justica_gratuita, responsavel, updated_at").order("updated_at", { ascending: false }).limit(500),
      supabase.from("documentos_juridicos").select("id, nome_documento, modelo_nome, cliente_nome, cpf_cnpj, numero_processo, responsavel_nome, status, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("processual_atendimentos").select("*").order("data", { ascending: false }).limit(500),
    ]);

    if (clientesResultado.status === "fulfilled" && !clientesResultado.value.error) {
      setClientes((clientesResultado.value.data || []) as Cliente[]);
    } else {
      const detalhe = clientesResultado.status === "fulfilled" ? clientesResultado.value.error?.message : clientesResultado.reason?.message;
      setErro(`Não foi possível carregar clientes. Confira se a migration de clientes foi executada. ${detalhe || ""}`.trim());
    }

    if (processosResultado.status === "fulfilled" && !processosResultado.value.error) {
      setProcessos((processosResultado.value.data || []) as ProcessoResumo[]);
    }

    if (documentosResultado.status === "fulfilled" && !documentosResultado.value.error) {
      setDocumentos((documentosResultado.value.data || []) as DocumentoResumo[]);
    }

    if (atendimentosResultado.status === "fulfilled" && !atendimentosResultado.value.error) {
      setAtendimentos((atendimentosResultado.value.data || []) as AtendimentoResumo[]);
    }

    setCarregando(false);
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const clientesFiltrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    if (!termo) return clientes;
    return clientes.filter((cliente) => normalizarBusca(`${cliente.nome_completo} ${cliente.cpf || ""} ${cliente.id_crm || ""}`).includes(termo));
  }, [busca, clientes]);

  const processosDoCliente = useMemo(() => {
    if (!clienteAberto) return [];
    const id = String(clienteAberto.id);
    const cpf = normalizarBusca(clienteAberto.cpf || "");
    const nome = normalizarBusca(clienteAberto.nome_completo || "");
    return processos.filter((processo) => {
      const mesmoId = String(processo.cliente_id || "") === id;
      const mesmoCpf = cpf && normalizarBusca(processo.cpf_cliente || "") === cpf;
      const mesmoNome = nome && normalizarBusca(processo.nome_cliente || "") === nome;
      return mesmoId || mesmoCpf || mesmoNome;
    });
  }, [clienteAberto, processos]);

  const documentosDoCliente = useMemo(() => {
    if (!clienteAberto) return [];
    const cpf = normalizarBusca(clienteAberto.cpf || "");
    const nome = normalizarBusca(clienteAberto.nome_completo || "");
    return documentos.filter((documento) => {
      const mesmoCpf = cpf && normalizarBusca(documento.cpf_cnpj || "") === cpf;
      const mesmoNome = nome && normalizarBusca(documento.cliente_nome || "") === nome;
      return mesmoCpf || mesmoNome;
    });
  }, [clienteAberto, documentos]);

  const atendimentosDoCliente = useMemo(() => {
    if (!clienteAberto) return [];
    const id = String(clienteAberto.id);
    const nome = normalizarBusca(clienteAberto.nome_completo || "");
    return atendimentos.filter((atendimento) => {
      const mesmoId = String(atendimento.cliente_id || "") === id;
      const mesmoNome = nome && normalizarBusca(atendimento.cliente_nome || "") === nome;
      return mesmoId || mesmoNome;
    });
  }, [atendimentos, clienteAberto]);

  function abrirNovoCliente() {
    setClienteEditando(null);
    setFormulario(criarFormulario(null, usuario.nome || ""));
    setModalAberto(true);
  }

  function abrirEdicao(cliente: Cliente) {
    setClienteEditando(cliente);
    setFormulario(criarFormulario(cliente, usuario.nome || ""));
    setModalAberto(true);
  }

  function abrirFicha(cliente: Cliente) {
    setClienteAberto(cliente);
    setAbaFicha("resumo");
  }

  function contextoDocumentoCliente() {
    if (!clienteAberto) return null;
    return {
      cliente: {
        id: clienteAberto.id,
        nome_completo: clienteAberto.nome_completo,
        cpf: clienteAberto.cpf,
        rg: clienteAberto.rg,
        email: clienteAberto.email,
        endereco: clienteAberto.endereco,
      },
      departamento: "Processual",
    };
  }

  function registrarDocumentoGerado(resultado: { documentoRemoto?: DocumentoResumo | null }) {
    if (resultado.documentoRemoto) {
      setDocumentos((atuais) => [resultado.documentoRemoto as DocumentoResumo, ...atuais.filter((item) => item.id !== resultado.documentoRemoto?.id)]);
    }
    avisar("Documento vinculado ao cliente.");
  }

  async function salvarCliente(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!formulario.nome_completo.trim()) {
      avisar("Informe o nome completo do cliente.");
      return;
    }

    setSalvando(true);
    const payload = {
      nome_completo: formulario.nome_completo.trim(),
      cpf: limparTexto(formulario.cpf),
      rg: limparTexto(formulario.rg),
      data_nascimento: formulario.data_nascimento || null,
      telefone: limparTexto(formulario.telefone),
      email: limparTexto(formulario.email),
      endereco: limparTexto(formulario.endereco),
      id_crm: limparTexto(formulario.id_crm),
      responsavel: limparTexto(formulario.responsavel),
      observacoes: limparTexto(formulario.observacoes),
      updated_by: usuario.email || usuario.nome || null,
    };

    const operacao = clienteEditando
      ? supabase.from("clientes").update(payload).eq("id", clienteEditando.id).select("*").single()
      : supabase.from("clientes").insert({ ...payload, created_by: usuario.email || usuario.nome || null }).select("*").single();

    const { data, error } = await operacao;
    setSalvando(false);

    if (error) {
      avisar(`Não foi possível salvar o cliente: ${error.message}`);
      return;
    }

    const clienteSalvo = data as Cliente;
    setClientes((atuais) => {
      const semAtual = atuais.filter((cliente) => String(cliente.id) !== String(clienteSalvo.id));
      return [clienteSalvo, ...semAtual];
    });
    setClienteAberto((atual) => atual && String(atual.id) === String(clienteSalvo.id) ? clienteSalvo : atual);
    setModalAberto(false);
    avisar(clienteEditando ? "Cliente atualizado." : "Cliente cadastrado.");
  }

  function processosCount(cliente: Cliente) {
    const id = String(cliente.id);
    const cpf = normalizarBusca(cliente.cpf || "");
    const nome = normalizarBusca(cliente.nome_completo || "");
    return processos.filter((processo) => (
      String(processo.cliente_id || "") === id ||
      (cpf && normalizarBusca(processo.cpf_cliente || "") === cpf) ||
      (nome && normalizarBusca(processo.nome_cliente || "") === nome)
    )).length;
  }

  return (
    <section className="clientes-workspace">
      <header className="module-page-header">
        <div>
          <span className="eyebrow">Clientes</span>
          <h2>Base de clientes</h2>
          <p>Cadastro único do cliente, separado dos processos judiciais e preparado para múltiplas demandas.</p>
        </div>
        <button type="button" className="btn-primary" onClick={abrirNovoCliente}>+ Novo cliente</button>
      </header>

      <div className="clientes-layout">
        <section className="clientes-list-panel">
          <div className="clientes-toolbar">
            <label>
              <span>Buscar por nome, CPF ou ID</span>
              <input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Nome, CPF ou ID CRM" />
            </label>
            <button type="button" className="btn-secondary" onClick={carregarDados}>Atualizar</button>
          </div>

          {erro ? <div className="client-warning">{erro}</div> : null}

          <div className="clientes-table-wrap">
            <table className="clientes-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CPF</th>
                  <th>ID CRM</th>
                  <th>Telefone</th>
                  <th>Processos</th>
                  <th>Responsável</th>
                  <th>Última atualização</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr><td colSpan={8}><div className="empty-row">Carregando clientes...</div></td></tr>
                ) : clientesFiltrados.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-row">Nenhum cliente encontrado.</div></td></tr>
                ) : clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id}>
                    <td><strong>{cliente.nome_completo}</strong><small>{cliente.email || "E-mail não informado"}</small></td>
                    <td>{cliente.cpf || "—"}</td>
                    <td>{cliente.id_crm || "—"}</td>
                    <td>{cliente.telefone || "—"}</td>
                    <td><span className="table-chip">{processosCount(cliente)}</span></td>
                    <td>{cliente.responsavel || "—"}</td>
                    <td>{formatarDataHora(cliente.updated_at || cliente.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn-secondary compact" onClick={() => abrirFicha(cliente)}>Abrir ficha</button>
                        <button type="button" className="btn-secondary compact" onClick={() => abrirEdicao(cliente)}>Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {clienteAberto ? (
          <aside className="cliente-ficha-panel">
            <header>
              <button type="button" className="drawer-close" onClick={() => setClienteAberto(null)} aria-label="Fechar ficha">×</button>
              <span className="eyebrow">Ficha cliente</span>
              <h3>{clienteAberto.nome_completo}</h3>
              <dl className="cliente-ficha-topo">
                <div><dt>CPF</dt><dd>{clienteAberto.cpf || "—"}</dd></div>
                <div><dt>ID CRM</dt><dd>{clienteAberto.id_crm || "—"}</dd></div>
                <div><dt>Telefone</dt><dd>{clienteAberto.telefone || "—"}</dd></div>
                <div><dt>E-mail</dt><dd>{clienteAberto.email || "—"}</dd></div>
                <div><dt>Responsável</dt><dd>{clienteAberto.responsavel || "—"}</dd></div>
              </dl>
            </header>

            <nav className="cliente-ficha-tabs" aria-label="Abas da ficha do cliente">
              {["resumo", "processos", "atendimentos", "documentos", "historico"].map((item) => (
                <button key={item} type="button" className={abaFicha === item ? "active" : ""} onClick={() => setAbaFicha(item)}>
                  {item === "historico" ? "Histórico" : item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </nav>

            <div className="cliente-ficha-content">
              {abaFicha === "resumo" ? (
                <section className="ficha-section">
                  <h4>Resumo cadastral</h4>
                  <dl className="ficha-details">
                    <div><dt>RG</dt><dd>{clienteAberto.rg || "—"}</dd></div>
                    <div><dt>Nascimento</dt><dd>{formatarData(clienteAberto.data_nascimento)}</dd></div>
                    <div><dt>Endereço</dt><dd>{clienteAberto.endereco || "—"}</dd></div>
                    <div><dt>Observações</dt><dd>{clienteAberto.observacoes || "Nenhuma observação cadastrada."}</dd></div>
                  </dl>
                </section>
              ) : null}

              {abaFicha === "processos" ? (
                <section className="ficha-section">
                  <div className="ficha-section-actions">
                    <h4>Processos do cliente</h4>
                    <div>
                      <button type="button" className="btn-secondary compact">Novo encaminhamento ao processual</button>
                      <button type="button" className="btn-secondary compact">Cadastrar processo existente</button>
                    </div>
                  </div>
                  {processosDoCliente.length === 0 ? <div className="empty-row">Nenhum processo cadastrado.</div> : (
                    <div className="clientes-table-wrap compact-table">
                      <table className="clientes-table">
                        <thead><tr><th>Processo</th><th>Réu</th><th>Banco</th><th>Situação</th><th>Fase</th><th>Resultado</th><th>Responsável</th></tr></thead>
                        <tbody>{processosDoCliente.map((processo) => (
                          <tr key={processo.id}>
                            <td>{processo.numero_processo || "Pendente"}</td>
                            <td>{processo.banco_reu || "—"}</td>
                            <td>{processo.banco_reu || "—"}</td>
                            <td><span className="table-chip">{processo.numero_processo ? "Protocolado" : "Pendente"}</span></td>
                            <td>{processo.fase_atual || "—"}</td>
                            <td>{processo.status_judicial || "—"}</td>
                            <td>{processo.responsavel || "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {abaFicha === "atendimentos" ? (
                <section className="ficha-section">
                  <h4>Atendimentos</h4>
                  {atendimentosDoCliente.length === 0 ? <div className="empty-row">Nenhum atendimento cadastrado.</div> : (
                    <div className="document-list">
                      {atendimentosDoCliente.map((atendimento) => (
                        <article key={atendimento.id}>
                          <strong>{atendimento.canal} · {atendimento.tipo || "Atendimento"}</strong>
                          <span>{atendimento.descricao}</span>
                          <small>{formatarDataHora(`${atendimento.data}T${atendimento.hora || "00:00"}`)} · {atendimento.responsavel || "Responsável não informado"}{atendimento.processo_numero ? ` · Processo ${atendimento.processo_numero}` : ""}</small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {abaFicha === "documentos" ? (
                <section className="ficha-section">
                  <div className="ficha-section-actions">
                    <h4>Documentos</h4>
                    <button type="button" className="btn-primary compact" onClick={() => setGeradorAberto(true)}>Gerar documento</button>
                  </div>
                  {documentosDoCliente.length === 0 ? <div className="empty-row">Nenhum documento vinculado por nome ou CPF.</div> : (
                    <div className="document-list">
                      {documentosDoCliente.map((documento) => (
                        <article key={documento.id}>
                          <strong>{documento.nome_documento}</strong>
                          <span>{documento.modelo_nome} · {documento.status || "gerado"}</span>
                          <small>{formatarDataHora(documento.created_at)} · {documento.responsavel_nome || "Responsável não informado"}</small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {abaFicha === "historico" ? (
                <section className="ficha-section">
                  <h4>Histórico geral do cliente</h4>
                  <div className="history-note">Preparado para eventos gerais do cliente. Os andamentos de cada processo continuarão separados em suas próprias movimentações.</div>
                  <div className="empty-row">Nenhum evento geral cadastrado.</div>
                </section>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {modalAberto ? (
        <div className="modal-backdrop" role="presentation">
          <form className="cliente-modal" onSubmit={salvarCliente}>
            <header>
              <div>
                <span className="eyebrow">Cadastro cliente</span>
                <h3>{clienteEditando ? "Editar cliente" : "Novo cliente"}</h3>
              </div>
              <button type="button" className="drawer-close" onClick={() => setModalAberto(false)} aria-label="Fechar">×</button>
            </header>
            <div className="cliente-form-grid">
              <label className="wide"><span>Nome completo *</span><input required value={formulario.nome_completo} onChange={(e) => setFormulario((f) => ({ ...f, nome_completo: e.target.value }))} /></label>
              <label><span>CPF</span><input value={formulario.cpf} onChange={(e) => setFormulario((f) => ({ ...f, cpf: e.target.value }))} /></label>
              <label><span>RG</span><input value={formulario.rg} onChange={(e) => setFormulario((f) => ({ ...f, rg: e.target.value }))} /></label>
              <label><span>Data nascimento</span><input type="date" value={formulario.data_nascimento} onChange={(e) => setFormulario((f) => ({ ...f, data_nascimento: e.target.value }))} /></label>
              <label><span>Telefone</span><input value={formulario.telefone} onChange={(e) => setFormulario((f) => ({ ...f, telefone: e.target.value }))} /></label>
              <label><span>E-mail</span><input type="email" value={formulario.email} onChange={(e) => setFormulario((f) => ({ ...f, email: e.target.value }))} /></label>
              <label><span>ID CRM</span><input value={formulario.id_crm} onChange={(e) => setFormulario((f) => ({ ...f, id_crm: e.target.value }))} /></label>
              <label><span>Responsável</span><input value={formulario.responsavel} onChange={(e) => setFormulario((f) => ({ ...f, responsavel: e.target.value }))} /></label>
              <label className="wide"><span>Endereço</span><input value={formulario.endereco} onChange={(e) => setFormulario((f) => ({ ...f, endereco: e.target.value }))} /></label>
              <label className="wide"><span>Observações</span><textarea rows={4} value={formulario.observacoes} onChange={(e) => setFormulario((f) => ({ ...f, observacoes: e.target.value }))} /></label>
            </div>
            <footer>
              <button type="button" className="btn-secondary" onClick={() => setModalAberto(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar cliente"}</button>
            </footer>
          </form>
        </div>
      ) : null}

      {geradorAberto && clienteAberto ? (
        <div className="modal-backdrop document-generator-modal" role="presentation">
          <section className="document-generator-shell">
            <button type="button" className="drawer-close" onClick={() => setGeradorAberto(false)} aria-label="Fechar">×</button>
            <GeradorDocumentos
              usuario={usuario}
              responsavel={usuario.nome}
              contextoDocumento={contextoDocumentoCliente()}
              onDocumentoGerado={registrarDocumentoGerado}
              onSuccess={avisar}
            />
          </section>
        </div>
      ) : null}
    </section>
  );
}
