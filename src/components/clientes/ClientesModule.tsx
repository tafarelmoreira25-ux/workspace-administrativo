import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import GeradorDocumentos from "../../GeradorDocumentos";
import EmailComposer from "../comunicacao/EmailComposer";
import ContentAnalyzer from "../comunicacao/ContentAnalyzer";
import Pagination from "../common/Pagination";

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
  link_pasta_cliente: string | null;
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
  reu?: string | null;
  numero_processo?: string | null;
  fase_atual?: string | null;
  situacao?: string | null;
  resultado?: string | null;
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

type ImportacaoCliente = { nome_completo: string; origem: string; status: "novo" | "existente" | "possivel" | "invalido"; motivo?: string };

const FORMULARIO_INICIAL = {
  nome_completo: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  telefone: "",
  email: "",
  endereco: "",
  id_crm: "",
  link_pasta_cliente: "",
  responsavel: "",
  observacoes: "",
};

const CLIENTES_POR_PAGINA = 30;

function termoPostgrest(valor: string) {
  return valor.trim().replace(/[,()"']/g, " ").replace(/\s+/g, " ").slice(0, 120);
}

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
    link_pasta_cliente: cliente.link_pasta_cliente || "",
    responsavel: cliente.responsavel || responsavel,
    observacoes: cliente.observacoes || "",
  };
}

function limparTexto(valor: string) {
  const texto = valor.trim();
  return texto || null;
}

function corrigirCodificacao(valor: string) {
  if (!/[ÃÂâ]/.test(valor)) return valor;
  try {
    return decodeURIComponent(escape(valor));
  } catch {
    return valor;
  }
}

function extrairNomeImportacao(linha: string) {
  const primeiraColuna = (linha.split("\t")[0] || "").replace(/^\"|\"$/g, "").trim();
  const nome = corrigirCodificacao(primeiraColuna).replace(/^\t+/, "").split(/\s+[xX]\s+/)[0].trim();
  return nome;
}

export default function ClientesModule({ usuario, showToast }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [processos, setProcessos] = useState<ProcessoResumo[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoResumo[]>([]);
  const [atendimentos, setAtendimentos] = useState<AtendimentoResumo[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [totalClientes, setTotalClientes] = useState(0);
  const [clienteAberto, setClienteAberto] = useState<Cliente | null>(null);
  const [abaFicha, setAbaFicha] = useState("resumo");
  const [modalAberto, setModalAberto] = useState(false);
  const [geradorAberto, setGeradorAberto] = useState(false);
  const [emailAberto, setEmailAberto] = useState(false);
  const [analisadorAberto, setAnalisadorAberto] = useState(false);
  const [processoEmail, setProcessoEmail] = useState<ProcessoResumo | null>(null);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [formulario, setFormulario] = useState(() => criarFormulario(null, usuario.nome || ""));
  const [carregando, setCarregando] = useState(true);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  const [importacaoCarregando, setImportacaoCarregando] = useState(false);
  const [importacaoExecutando, setImportacaoExecutando] = useState(false);
  const [importacaoResultado, setImportacaoResultado] = useState<ImportacaoCliente[]>([]);

  const avisar = useCallback((mensagem: string) => {
    if (showToast) showToast(mensagem);
    else window.alert(mensagem);
  }, [showToast]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro("");
    const termo = termoPostgrest(buscaAplicada);
    let clientesPorProcesso: Array<string | number> = [];

    if (termo) {
      const { data: encontrados } = await supabase
        .from("processos")
        .select("cliente_id")
        .ilike("numero_processo", `%${termo}%`)
        .not("cliente_id", "is", null)
        .limit(500);
      clientesPorProcesso = [...new Set((encontrados || []).map((item) => item.cliente_id).filter(Boolean))] as Array<string | number>;
    }

    let consulta = supabase.from("clientes").select("*", { count: "exact" });
    if (termo) {
      const filtros = [
        `nome_completo.ilike.%${termo}%`,
        `cpf.ilike.%${termo}%`,
        `id_crm.ilike.%${termo}%`,
      ];
      if (clientesPorProcesso.length) filtros.push(`id.in.(${clientesPorProcesso.join(",")})`);
      consulta = consulta.or(filtros.join(","));
    }

    const inicio = (pagina - 1) * CLIENTES_POR_PAGINA;
    const { data, count, error } = await consulta
      .order("nome_completo", { ascending: true })
      .range(inicio, inicio + CLIENTES_POR_PAGINA - 1);

    if (error) {
      setErro(`Não foi possível carregar clientes: ${error.message}`);
      setCarregando(false);
      return;
    }

    const paginaClientes = (data || []) as Cliente[];
    setClientes(paginaClientes);
    setTotalClientes(count || 0);
    const ids = paginaClientes.map((cliente) => cliente.id);
    if (ids.length) {
      const { data: processosPagina } = await supabase
        .from("processos")
        .select("id, cliente_id, nome_cliente, cpf_cliente, reu, banco_reu, numero_processo, fase_atual, situacao, resultado, status_judicial, justica_gratuita, responsavel, updated_at")
        .in("cliente_id", ids)
        .order("updated_at", { ascending: false });
      setProcessos((processosPagina || []) as ProcessoResumo[]);
    } else {
      setProcessos([]);
    }
    setCarregando(false);
  }, [buscaAplicada, pagina]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPagina(1);
      setBuscaAplicada(busca);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const clientesFiltrados = clientes;

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

  const historicoDoCliente = useMemo(() => {
    const eventosAtendimento = atendimentosDoCliente.map((atendimento) => ({
      id: `atendimento-${atendimento.id}`,
      titulo: `${atendimento.canal} · ${atendimento.tipo || "Atendimento"}`,
      descricao: atendimento.descricao,
      data: atendimento.created_at || `${atendimento.data}T${atendimento.hora || "00:00"}`,
      responsavel: atendimento.responsavel,
    }));
    const eventosDocumento = documentosDoCliente.map((documento) => ({
      id: `documento-${documento.id}`,
      titulo: `Documento · ${documento.nome_documento}`,
      descricao: `${documento.modelo_nome} · ${documento.status || "Gerado"}`,
      data: documento.created_at,
      responsavel: documento.responsavel_nome,
    }));
    return [...eventosAtendimento, ...eventosDocumento]
      .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  }, [atendimentosDoCliente, documentosDoCliente]);

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

  async function abrirFicha(cliente: Cliente) {
    setClienteAberto(cliente);
    setAbaFicha("resumo");
    setCarregandoFicha(true);
    const [processosResultado, documentosResultado, atendimentosResultado] = await Promise.allSettled([
      supabase.from("processos").select("id, cliente_id, nome_cliente, cpf_cliente, reu, banco_reu, numero_processo, fase_atual, situacao, resultado, status_judicial, justica_gratuita, responsavel, updated_at").eq("cliente_id", cliente.id).order("updated_at", { ascending: false }),
      supabase.from("documentos_juridicos").select("id, nome_documento, modelo_nome, cliente_nome, cpf_cnpj, numero_processo, responsavel_nome, status, created_at").eq("cliente_id", cliente.id).order("created_at", { ascending: false }).limit(300),
      supabase.from("processual_atendimentos").select("*").eq("cliente_id", cliente.id).order("data", { ascending: false }).limit(300),
    ]);
    if (processosResultado.status === "fulfilled" && !processosResultado.value.error) setProcessos((processosResultado.value.data || []) as ProcessoResumo[]);
    if (documentosResultado.status === "fulfilled" && !documentosResultado.value.error) setDocumentos((documentosResultado.value.data || []) as DocumentoResumo[]);
    if (atendimentosResultado.status === "fulfilled" && !atendimentosResultado.value.error) setAtendimentos((atendimentosResultado.value.data || []) as AtendimentoResumo[]);
    setCarregandoFicha(false);
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
        link_pasta_cliente: clienteAberto.link_pasta_cliente,
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

  function abrirEmail(processo?: ProcessoResumo | null) {
    setProcessoEmail(processo || null);
    setEmailAberto(true);
  }

  function registrarAtendimentoEmail(atendimento: AtendimentoResumo) {
    setAtendimentos((atuais) => [atendimento, ...atuais.filter((item) => item.id !== atendimento.id)]);
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
      link_pasta_cliente: limparTexto(formulario.link_pasta_cliente),
      responsavel: limparTexto(formulario.responsavel),
      observacoes: limparTexto(formulario.observacoes),
      updated_by: usuario.email || usuario.nome || null,
    };

    const operacao = clienteEditando
      ? supabase.from("clientes").update(payload).eq("id", clienteEditando.id).select("*").single()
      : supabase.from("clientes").insert(payload).select("*").single();

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

  async function prepararImportacao() {
    setImportacaoCarregando(true);
    setImportacaoResultado([]);
    const sessaoTimeout = new Promise((_, reject) => window.setTimeout(() => reject(new Error("Tempo limite ao validar a sessão.")), 15000));
    const { data: sessaoData, error: sessaoError } = await Promise.race([supabase.auth.getSession(), sessaoTimeout]) as Awaited<ReturnType<typeof supabase.auth.getSession>>;
    if (sessaoError || !sessaoData.session?.user) {
      setImportacaoCarregando(false);
      avisar("Importação bloqueada: faça login com um usuário autorizado.");
      return;
    }
    const consultaTimeout = new Promise((_, reject) => window.setTimeout(() => reject(new Error("Tempo limite ao consultar clientes.")), 15000));
    const { data: existentes, error: consultaError } = await Promise.race([
      supabase.from("clientes").select("id,nome_completo,cpf,telefone").limit(2000),
      consultaTimeout,
    ]) as Awaited<ReturnType<typeof supabase.from>>;
    if (consultaError) {
      setImportacaoCarregando(false);
      avisar(`Não foi possível consultar clientes: ${consultaError.message}`);
      return;
    }
    const controlador = new AbortController();
    const limite = window.setTimeout(() => controlador.abort(), 15000);
    const resposta = await fetch("/importacoes/clientes-processual.txt", { cache: "no-store", signal: controlador.signal });
    window.clearTimeout(limite);
    if (!resposta.ok) {
      setImportacaoCarregando(false);
      avisar(`Não foi possível carregar a relação de clientes (${resposta.status}).`);
      return;
    }
    const texto = await resposta.text();
    const nomes = texto.split(/\r?\n/).filter(Boolean).map((origem) => ({ nome_completo: extrairNomeImportacao(origem), origem }));
    const unicos = new Map<string, { nome_completo: string; origem: string }>();
    nomes.forEach((item) => { const chave = normalizarBusca(item.nome_completo); if (item.nome_completo && chave !== "captura de tela" && !unicos.has(chave)) unicos.set(chave, item); });
    const existentesPorNome = new Map((existentes || []).map((cliente) => [normalizarBusca(cliente.nome_completo), cliente]));
    const resultado = [...unicos.values()].map((item): ImportacaoCliente => {
      const existente = existentesPorNome.get(normalizarBusca(item.nome_completo));
      return existente ? { ...item, status: "existente", motivo: "Cliente já cadastrado." } : { ...item, status: "novo" };
    });
    setImportacaoResultado(resultado);
    setImportacaoCarregando(false);
  }

  async function executarImportacao() {
    const novos = importacaoResultado.filter((item) => item.status === "novo");
    if (!novos.length) return;
    setImportacaoExecutando(true);
    const resultados = [...importacaoResultado];
    for (let inicio = 0; inicio < novos.length; inicio += 25) {
      const lote = novos.slice(inicio, inicio + 25);
      for (const item of lote) {
        const { error } = await supabase.from("clientes").insert({ nome_completo: item.nome_completo });
        const indice = resultados.findIndex((resultado) => resultado.nome_completo === item.nome_completo);
        if (indice >= 0) resultados[indice] = error ? { ...item, status: "possivel", motivo: error.message } : { ...item, status: "existente", motivo: "Cadastrado com sucesso." };
      }
    }
    setImportacaoResultado(resultados);
    await carregarDados();
    setImportacaoExecutando(false);
    avisar("Importação concluída. Confira o relatório antes de fechar.");
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
        <div className="ficha-section-actions">
          <button type="button" className="btn-secondary" onClick={() => { setImportacaoAberta(true); prepararImportacao().catch((error) => { setImportacaoCarregando(false); avisar(error instanceof Error ? error.message : "Não foi possível preparar a importação."); }); }}>Importar clientes</button>
          <button type="button" className="btn-primary" onClick={abrirNovoCliente}>+ Novo cliente</button>
        </div>
      </header>

      <div className="clientes-layout">
        {!clienteAberto ? <section className="clientes-list-panel">
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
          <Pagination pagina={pagina} total={totalClientes} tamanho={CLIENTES_POR_PAGINA} onChange={setPagina} rotulo="clientes" />
        </section> : null}

        {clienteAberto ? (
          <section className="cliente-ficha-panel cliente-ficha-page">
            <header>
              <button type="button" className="cliente-back-button" onClick={() => { setClienteAberto(null); carregarDados(); }}>← Voltar para clientes</button>
              <span className="eyebrow">Ficha do cliente</span>
              <h3>{clienteAberto.nome_completo}</h3>
              <div className="cliente-quick-actions">
                <button type="button" className="btn-primary compact" onClick={() => abrirEmail()}>Preparar e-mail</button>
                <button type="button" className="btn-secondary compact" onClick={() => setAnalisadorAberto(true)}>Analisar e-mail/PDF</button>
                <button type="button" className="btn-secondary compact" onClick={() => abrirEdicao(clienteAberto)}>Editar cadastro</button>
              </div>
              <dl className="cliente-ficha-topo">
                <div><dt>CPF</dt><dd>{clienteAberto.cpf || "—"}</dd></div>
                <div><dt>ID CRM</dt><dd>{clienteAberto.id_crm || "—"}</dd></div>
                <div><dt>Telefone</dt><dd>{clienteAberto.telefone || "—"}</dd></div>
                <div><dt>E-mail</dt><dd>{clienteAberto.email || "—"}</dd></div>
                <div><dt>Responsável</dt><dd>{clienteAberto.responsavel || "—"}</dd></div>
                <div><dt>Pasta no Drive</dt><dd>{clienteAberto.link_pasta_cliente ? <a href={clienteAberto.link_pasta_cliente} target="_blank" rel="noreferrer">Abrir pasta</a> : "—"}</dd></div>
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
              {carregandoFicha ? <div className="empty-row">Carregando informações da ficha...</div> : null}
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
                        <thead><tr><th>Processo</th><th>Réu</th><th>Banco</th><th>Situação</th><th>Fase</th><th>Resultado</th><th>Responsável</th><th>Ações</th></tr></thead>
                        <tbody>{processosDoCliente.map((processo) => (
                          <tr key={processo.id}>
                            <td>{processo.numero_processo || "Pendente"}</td>
                            <td>{processo.reu || processo.banco_reu || "—"}</td>
                            <td>{processo.banco_reu || "—"}</td>
                            <td><span className="table-chip">{processo.situacao || (processo.numero_processo ? "Protocolado" : "Pendente")}</span></td>
                            <td>{processo.fase_atual || "—"}</td>
                            <td>{processo.resultado || processo.status_judicial || "—"}</td>
                            <td>{processo.responsavel || "—"}</td>
                            <td><button type="button" className="btn-secondary compact" onClick={() => abrirEmail(processo)}>E-mail</button></td>
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
                  <div className="history-note">Reúne atendimentos, comunicações preparadas e documentos. Os andamentos processuais permanecem separados em suas próprias movimentações.</div>
                  {historicoDoCliente.length === 0 ? <div className="empty-row">Nenhum evento geral cadastrado.</div> : (
                    <div className="document-list">
                      {historicoDoCliente.map((evento) => (
                        <article key={evento.id}>
                          <strong>{evento.titulo}</strong>
                          <span>{evento.descricao}</span>
                          <small>{formatarDataHora(evento.data)} · {evento.responsavel || "Responsável não informado"}</small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      {modalAberto ? (
        <div className="modal-backdrop" role="presentation">
          <form className="cliente-modal" onSubmit={salvarCliente}>
            <header>
              <div>
                <span className="eyebrow">Cadastro de cliente</span>
                <h3>{clienteEditando ? "Editar cliente" : "Novo cliente"}</h3>
              </div>
              <button type="button" className="drawer-close" onClick={() => setModalAberto(false)} aria-label="Fechar">×</button>
            </header>
            <div className="cliente-form-grid">
              <label className="wide"><span>Nome completo *</span><input required value={formulario.nome_completo} onChange={(e) => setFormulario((f) => ({ ...f, nome_completo: e.target.value }))} /></label>
              <label><span>CPF</span><input value={formulario.cpf} onChange={(e) => setFormulario((f) => ({ ...f, cpf: e.target.value }))} /></label>
              <label><span>RG</span><input value={formulario.rg} onChange={(e) => setFormulario((f) => ({ ...f, rg: e.target.value }))} /></label>
              <label><span>Data de nascimento</span><input type="date" value={formulario.data_nascimento} onChange={(e) => setFormulario((f) => ({ ...f, data_nascimento: e.target.value }))} /></label>
              <label><span>Telefone</span><input value={formulario.telefone} onChange={(e) => setFormulario((f) => ({ ...f, telefone: e.target.value }))} /></label>
              <label><span>E-mail</span><input type="email" value={formulario.email} onChange={(e) => setFormulario((f) => ({ ...f, email: e.target.value }))} /></label>
              <label><span>ID CRM</span><input value={formulario.id_crm} onChange={(e) => setFormulario((f) => ({ ...f, id_crm: e.target.value }))} /></label>
              <label className="wide"><span>Link da pasta no Drive</span><input value={formulario.link_pasta_cliente} onChange={(e) => setFormulario((f) => ({ ...f, link_pasta_cliente: e.target.value }))} placeholder="https://drive.google.com/..." /></label>
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

      {emailAberto && clienteAberto ? (
        <EmailComposer
          cliente={clienteAberto}
          processos={processosDoCliente}
          processoInicial={processoEmail}
          usuario={usuario}
          onClose={() => setEmailAberto(false)}
          onRegistrado={registrarAtendimentoEmail}
          showToast={avisar}
        />
      ) : null}

      {analisadorAberto && clienteAberto ? (
        <ContentAnalyzer
          cliente={clienteAberto}
          processos={processosDoCliente}
          usuario={usuario}
          onClose={() => setAnalisadorAberto(false)}
          onRegistrado={registrarAtendimentoEmail}
          showToast={avisar}
        />
      ) : null}

      {importacaoAberta ? (
        <div className="modal-backdrop" role="presentation">
          <section className="cliente-modal importacao-modal">
            <header><div><span className="eyebrow">Importação temporária</span><h3>Importar clientes</h3></div><button type="button" className="drawer-close" onClick={() => setImportacaoAberta(false)} aria-label="Fechar">×</button></header>
            {importacaoCarregando ? <div className="empty-row">Validando sessão e preparando prévia...</div> : (
              <>
                <div className="importacao-resumo"><span>Total válido: <strong>{importacaoResultado.length}</strong></span><span>Novos: <strong>{importacaoResultado.filter((item) => item.status === "novo").length}</strong></span><span>Já existentes: <strong>{importacaoResultado.filter((item) => item.status === "existente").length}</strong></span><span>Possíveis duplicidades/erros: <strong>{importacaoResultado.filter((item) => item.status === "possivel").length}</strong></span></div>
                <div className="importacao-lista">{importacaoResultado.filter((item) => item.status !== "existente").slice(0, 80).map((item) => <div key={item.nome_completo}><strong>{item.nome_completo}</strong><small>{item.status === "novo" ? "Será cadastrado" : item.motivo}</small></div>)}</div>
                <footer><button type="button" className="btn-secondary" onClick={() => setImportacaoAberta(false)}>Cancelar</button><button type="button" className="btn-primary" disabled={importacaoExecutando || !importacaoResultado.some((item) => item.status === "novo")} onClick={executarImportacao}>{importacaoExecutando ? "Cadastrando..." : "Confirmar importação"}</button></footer>
              </>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}
