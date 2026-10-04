import { FormField, FormGrid, FormSection, Input, Select, Textarea } from "./components/common/FormControls";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentCategoryIcon, DocumentModelIcon } from "./components/documentos/ModelLibraryModal";
import {
  DOCUMENT_DRAFT_KEY, DOCUMENT_HISTORY_KEY,
  DOCUMENT_USAGE_KEY, DOCUMENT_WORKSPACE_SCHEMA, DOCUMENT_CATEGORIES,
  enriquecerModelos, erroCampo, formatarValorCampo, listarConflitosFixos, normalizarBusca,
  normalizarNomeArquivo, proximaVersao, rascunhoValido,
} from "./lib/documentWorkspace";
import { criarOpcoesIniciaisProcuracao, listarDocumentosProcuracao, mensagemConjuntoGerado } from "./lib/procuracaoConjunto";
import { supabase } from "./lib/supabase";
import { DOCUMENT_TEMPLATES, valorInicialCampo } from "./config/documentTemplates";
import { gerarPdfModelo, pendenciaModeloOriginal } from "./lib/documentPdf";
import "./documentWorkspace.css";

const MODELO_PROCURACAO = {
  id: "procuracao-ad-judicia", nome: "Procuração Ad Judicia", titulo: "Procuração Ad Judicia", modo: "procuracao",
  categoria: "procuracoes", categoriaNome: "Procurações", icone: "signature",
  descricao: "Procuração para representação judicial do cliente.",
  templateDocx: "/modelos/procuracoes/procuracao-ad-judicia-2026.docx",
  campos: [...DOCUMENT_TEMPLATES.find((modelo) => modelo.modo === "declaracao-hipossuficiencia").campos,
    { nome: "banco", rotulo: "Banco", obrigatorio: true },
    { nome: "numeroContrato", rotulo: "Número do contrato", obrigatorio: true }],
};
const MODELOS = [...enriquecerModelos(DOCUMENT_TEMPLATES), MODELO_PROCURACAO];
const DOCUMENT_MODEL_NAMES_KEY = "platino.documentos.nomes-modelos.v1";
const DOCUMENT_DRAFT_INACTIVITY_MS = 5 * 60 * 1000;

function dataLocalIso() {
  const hoje = new Date();
  return new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function montarNomeAutomatico(modelo, dados) {
  const cliente = String(dados.nomeCliente || dados.nomeContratante || "Cliente").trim() || "Cliente";
  const partes = [modelo.nome, cliente];
  return partes.join("_").replace(/\s{2,}/g, " ").slice(0, 180);
}

function montarNomesDoConjunto(modelo, dados) {
  const nomes = { [modelo.modo]: montarNomeAutomatico(modelo, dados) };
  if (modelo.modo === "procuracao") {
    nomes.hipossuficiencia = montarNomeAutomatico({ ...modelo, nome: "Declaração de Hipossuficiência" }, dados);
    nomes["isencao-irpf"] = montarNomeAutomatico({ ...modelo, nome: "Declaração de Isenção de Imposto de Renda" }, dados);
  }
  return nomes;
}

function destinoPadrao(modelo) {
  const pastas = { procuracoes: "PROCURAÇÕES", declaracoes: "DECLARAÇÕES", notificacoes: "NOTIFICAÇÕES_E_INTIMAÇÕES", contestacoes: "CONTESTAÇÕES", termos: "TERMOS", distratos: "DISTRATOS", relatorios: "RELATÓRIOS", "recibos-certidoes": "RECIBOS_E_CERTIDÕES" };
  return `Drive do cliente / ${pastas[modelo.categoria] || "DOCUMENTOS"}`;
}

function criarFormularioInicial(responsavel, modelo = MODELOS[0], departamento = "Jurídico") {
  const hoje = dataLocalIso();
  const camposDoModelo = Object.fromEntries(modelo.campos.map((campo) => [campo.nome, campo.valorInicial === "responsavel" ? responsavel || "" : valorInicialCampo(campo, hoje)]));
  return {
    modeloId: modelo.id, tipo: modelo.nome, titulo: modelo.titulo || modelo.nome,
    dataEmissao: hoje,
    responsavel: responsavel || "", departamento: departamento || "Jurídico",
    destino: destinoPadrao(modelo), observacaoInterna: "", salvarNaPasta: false, versao: 1,
    ...camposDoModelo,
    ...(modelo.modo === "procuracao" ? criarOpcoesIniciaisProcuracao(hoje) : {}),
  };
}

function dadosDoContextoDocumento(contexto = {}) {
  const cliente = contexto.cliente || {};
  const processo = contexto.processo || {};
  const origemTribunal = [processo.tribunal, processo.comarca, processo.vara].filter(Boolean).join(" / ");
  return Object.fromEntries(Object.entries({
    nomeCliente: cliente.nome_completo || cliente.nome || processo.nome_cliente,
    cpfCnpj: cliente.cpf || processo.cpf_cliente,
    nomeContratante: cliente.nome_completo || cliente.nome || processo.nome_cliente,
    cpfContratante: cliente.cpf || processo.cpf_cliente,
    enderecoContratante: cliente.endereco,
    rg: cliente.rg,
    email: cliente.email,
    endereco: cliente.endereco,
    banco: processo.banco_reu || processo.reu,
    cnpjBanco: processo.cnpj_banco,
    enderecoBanco: processo.endereco_banco,
    numeroContrato: processo.numero_contrato,
    numeroProcesso: processo.numero_processo,
    vara: processo.vara,
    comarca: processo.comarca,
    dataDistribuicao: processo.data_distribuicao || processo.distribuido_em,
    origemTribunal,
    segredoJustica: processo.segredo_justica ? "Sim" : "Não",
    assunto: processo.tipo_acao || processo.produto,
    justicaGratuita: processo.justica_gratuita,
    autorNome: processo.autor || cliente.nome_completo || cliente.nome || processo.nome_cliente,
    autorAdvogado: processo.autor_advogado,
    reuNome: processo.reu || processo.banco_reu,
    reuAdvogado: processo.reu_advogado,
    statusLabel: processo.situacao || processo.status_judicial || processo.fase_judicial || processo.fase_atual,
    dataConsulta: contexto.dataConsulta,
    statusDescricao: contexto.statusDescricao || contexto.observacaoInterna || processo.observacoes,
    prazoAtual: contexto.prazoAtual || processo.proximo_prazo || processo.emenda_status || processo.custas_status,
    responsavelProvidencia: contexto.responsavelProvidencia || processo.responsavel,
    dataUltimaMovimentacao: contexto.dataUltimaMovimentacao || processo.ultima_movimentacao_data,
    ultimaMovimentacao: contexto.ultimaMovimentacao || processo.ultima_movimentacao,
    proximosPassos: contexto.proximosPassos,
    anexosResumo: contexto.anexosResumo,
    linkConsulta: processo.link_consulta || contexto.linkConsulta,
    observacaoInterna: contexto.observacaoInterna,
    departamento: contexto.departamento || "Processual",
  }).filter(([, valor]) => valor !== undefined && valor !== null && valor !== ""));
}

function lerJsonLocal(chave, fallback) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? fallback; } catch { return fallback; }
}

function persistirRascunho(dados) {
  const salvoEm = new Date();
  localStorage.setItem(DOCUMENT_DRAFT_KEY, JSON.stringify({
    schema: DOCUMENT_WORKSPACE_SCHEMA,
    dados,
    salvoEm: salvoEm.toISOString(),
  }));
  return salvoEm;
}

function formatarDataHora(data) {
  if (!data) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data));
}

function criarArquivo(tipo, nome, bytes, criarUrl = true, mime = "application/pdf") {
  return { tipo, nome, bytes, mime, url: criarUrl ? URL.createObjectURL(new Blob([bytes], { type: mime })) : "" };
}

async function gerarArquivos(dados, modelo, nomeDocumento, criarUrls = true, nomesDoConjunto = {}) {
  const base = normalizarNomeArquivo(nomeDocumento || modelo.nome).replace(/\.(pdf|docx)$/i, "");
  if (modelo.modo === "procuracao") {
    const documentos = listarDocumentosProcuracao(dados);
    const modos = {
      procuracao: "procuracao",
      hipossuficiencia: "declaracao-hipossuficiencia",
      "isencao-irpf": "declaracao-isencao-irpf",
    };
    return Promise.all(documentos.map(async (tipo) => {
      const modeloDoDocumento = MODELOS.find((item) => item.modo === modos[tipo]);
      if (!modeloDoDocumento?.templateDocx) throw new Error(`Modelo oficial não configurado para ${tipo}.`);
      const nome = `${normalizarNomeArquivo(nomesDoConjunto[tipo] || nomeDocumento || modeloDoDocumento.nome).replace(/\.(pdf|docx)$/i, "")}.pdf`;
      const dadosDocumento = tipo === "isencao-irpf"
        ? { ...dados, dataDocumento: dados.dataDocumentoIrpf || dados.dataDocumento }
        : dados;
      const bytes = await gerarPdfModelo(dadosDocumento, modeloDoDocumento);
      return criarArquivo(tipo, nome, bytes, criarUrls);
    }));
  }
  const bytes = await gerarPdfModelo(dados, modelo);
  return [criarArquivo(modelo.modo, `${base}.pdf`, bytes, criarUrls)];
}

function baixarArquivos(arquivos) {
  arquivos.forEach((arquivo, indice) => window.setTimeout(() => {
    const link = document.createElement("a"); link.href = arquivo.url; link.download = arquivo.nome;
    document.body.appendChild(link); link.click(); link.remove();
  }, indice * 140));
}

function CampoDocumento({ campo, valor, erro, onChange, onBlur }) {
  const inputId = `doc-field-${campo.nome}`;
  const props = { id: inputId, name: campo.nome, value: valor || "", onChange, onBlur, required: campo.obrigatorio, "aria-invalid": Boolean(erro), "aria-describedby": erro ? `${inputId}-error` : undefined };
  if (campo.tipo === "file") {
    return <FormField className={`legal-doc-field ${campo.tipo === "textarea" || campo.tipo === "file" ? "wide" : ""} ${erro ? "invalid" : ""}`} htmlFor={inputId}><span className="legal-doc-label-row"><span>{campo.rotulo}{campo.obrigatorio ? " *" : ""}</span></span><Input id={inputId} name={campo.nome} type="file" accept={campo.accept} onChange={onChange} onBlur={onBlur} required={campo.obrigatorio} aria-invalid={Boolean(erro)} aria-describedby={erro ? `${inputId}-error` : undefined} />{valor?.nome ? <small>{valor.nome}</small> : null}{erro ? <small className="legal-doc-field-error" id={`${inputId}-error`}>{erro}</small> : null}</FormField>;
  }
  return <FormField className={`legal-doc-field ${campo.tipo === "textarea" || campo.tipo === "file" ? "wide" : ""} ${erro ? "invalid" : ""}`} htmlFor={inputId}><span className="legal-doc-label-row"><span>{campo.rotulo}{campo.obrigatorio ? " *" : ""}</span></span>{campo.tipo === "textarea" ? <Textarea {...props} rows="2" placeholder={campo.placeholder} /> : campo.tipo === "select" ? <Select {...props}>{campo.opcoes.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</Select> : <Input {...props} type={campo.tipo || "text"} placeholder={campo.placeholder} min={campo.min} />}{erro ? <small className="legal-doc-field-error" id={`${inputId}-error`}>{erro}</small> : null}</FormField>;
}


function ModalSucesso({ resultado, onClose, onDownload, onOpen, onCopy, onSignature, onLibrary, onAnother }) {
  if (!resultado) return null;
  const rotuloDownload = `Baixar PDF${resultado.arquivos.length > 1 ? "s" : ""}`;
  return <div className="legal-doc-success-backdrop"><section className="legal-doc-success-modal" role="dialog" aria-modal="true" aria-labelledby="success-title"><button type="button" className="model-library-close" onClick={onClose} aria-label="Fechar confirmação">×</button><span className="legal-doc-success-icon">✓</span><span className="eyebrow">Geração concluída</span><h2 id="success-title">Documento gerado com sucesso</h2><p>{resultado.arquivos.length} {resultado.arquivos.length === 1 ? "arquivo foi preparado" : "arquivos foram preparados"} para conferência e download.</p>{resultado.aviso ? <div className="legal-doc-archive-warning">{resultado.aviso}</div> : null}<dl className="legal-doc-success-details"><div><dt>Documento</dt><dd>{resultado.nomeDocumento}</dd></div><div><dt>Cliente</dt><dd>{resultado.cliente || "Não vinculado"}</dd></div><div><dt>Data e horário</dt><dd>{formatarDataHora(resultado.criadoEm)}</dd></div><div><dt>Responsável</dt><dd>{resultado.responsavel}</dd></div><div><dt>Número</dt><dd>{resultado.numeroDocumento}</dd></div><div><dt>Versão</dt><dd>{String(resultado.versao).padStart(2, "0")}</dd></div><div className="wide"><dt>Destino</dt><dd>{resultado.destino}</dd></div><div><dt>Status</dt><dd><span className="legal-doc-status-pill">{resultado.status}</span></dd></div></dl><div className="legal-doc-success-actions primary"><button type="button" className="btn-primary" onClick={onOpen}>Abrir documento</button><button type="button" className="btn-secondary" onClick={onDownload}>{rotuloDownload}</button><button type="button" className="btn-secondary" onClick={onCopy} disabled={!resultado.link}>Copiar link</button><button type="button" className="btn-secondary" onClick={onSignature}>Enviar para assinatura</button></div><div className="legal-doc-success-actions secondary"><button type="button" onClick={onLibrary}>Novo documento</button><button type="button" onClick={onAnother}>Gerar outro documento com estes dados</button></div></section></div>;
}
function DocumentosRecentes({ documentos, busca, onBusca, onOpen, onDuplicate, onVersion }) {
  const termo = normalizarBusca(busca);
    const filtrados = documentos
    .filter((item) => !termo || normalizarBusca(`${item.nomeDocumento} ${item.modeloNome} ${item.cliente} ${item.responsavel}`).includes(termo));
  return <section className="legal-doc-recent-section"><div className="legal-doc-recent-heading"><div><span className="eyebrow">Rastreabilidade</span><h2>Documentos recentes</h2><p>{"Gerados nesta edição."}</p></div><FormField><span>Buscar</span><Input type="search" value={busca} onChange={(evento) => onBusca(evento.target.value)} placeholder="Pesquisar no histórico..." /></FormField></div>{filtrados.length === 0 ? <div className="legal-doc-recent-empty"><DocumentCategoryIcon name="clock" size={25} /><strong>Nenhum documento recente</strong><p>{"O histórico temporário é encerrado ao sair do gerador."}</p></div> : <div className="legal-doc-recent-list compact">{filtrados.slice(0, 8).map((item) => <article key={item.id}><span className="model-card-icon compact"><DocumentModelIcon size={22} /></span><div><strong>{item.nomeDocumento}</strong><p>{item.modeloNome} - {item.cliente || "Cliente não vinculado"}</p><small>{formatarDataHora(item.criadoEm)} - {item.responsavel}</small></div><span className="legal-doc-history-status">{item.status || "Gerado"}</span><div className="legal-doc-history-actions"><button type="button" onClick={() => onOpen(item)} disabled={!item.link && !item.storagePath}>Abrir</button><details className="legal-doc-history-menu"><summary aria-label="Mais ações">...</summary><div><button type="button" onClick={() => onDuplicate(item)}>Duplicar</button><button type="button" onClick={() => onVersion(item)}>Nova versão</button></div></details></div></article>)}</div>}</section>;
}

export default function GeradorDocumentos(props) {
  const [categoria, setCategoria] = useState(null);
  const [modelo, setModelo] = useState(null);
  const [nomesCompartilhados, setNomesCompartilhados] = useState(() => lerJsonLocal(DOCUMENT_MODEL_NAMES_KEY, {}));
  useEffect(() => {
    let ativo = true;
    supabase.from("modelos_juridicos_config").select("modelo_id, nome_exibicao").then(({ data, error }) => {
      if (!ativo || error) return;
      const nomes = Object.fromEntries((data || []).map((item) => [item.modelo_id, item.nome_exibicao]));
      setNomesCompartilhados(nomes);
      localStorage.setItem(DOCUMENT_MODEL_NAMES_KEY, JSON.stringify(nomes));
    });
    return () => { ativo = false; };
  }, []);
  const kit = ["procuracao", "declaracao-hipossuficiencia", "declaracao-isencao-irpf"];
  const categorias = [{ id: "kit-inicial", nome: "Kit Processual Inicial", icone: "signature" }, ...DOCUMENT_CATEGORIES.filter((item) => !["todos", "mais-utilizados", "favoritos"].includes(item.id))]
    .map((item) => ({ ...item, nome: item.id === "notificacao-extrajudicial" ? "Notificações Extrajudiciais" : item.nome, modelos: MODELOS.filter((documento) => item.id === "kit-inicial" ? kit.includes(documento.modo) : !kit.includes(documento.modo) && documento.categoria === item.id) }))
    .filter((item) => item.modelos.length);
  const nomes = { ...nomesCompartilhados, ...lerJsonLocal(DOCUMENT_MODEL_NAMES_KEY, {}) };
  if (modelo) return <EditorDocumento {...props} modeloInicial={modelo} modelosDaCategoria={categoria.modelos} onVoltar={() => setModelo(null)} onNovaSelecao={() => { setModelo(null); setCategoria(null); }} />;
  return <section className="legal-doc-workspace legal-doc-workspace-compact">
    <header className="legal-doc-compact-header"><h1>Gerador de Documentos</h1></header>
    <section className="legal-doc-selection" aria-labelledby="document-selection-title">
      {categoria ? <button type="button" className="btn-secondary" onClick={() => setCategoria(null)}>Voltar às categorias</button> : null}
      <h2 id="document-selection-title">{categoria?.nome || "Escolha uma categoria"}</h2>
      <p>{categoria ? "Selecione o documento que deseja preencher." : "Selecione uma categoria para consultar os documentos disponíveis."}</p>
      <div className="legal-doc-selection-grid">
        {categoria ? categoria.modelos.map((item) => <button type="button" className="legal-doc-selection-card" key={item.id} onClick={() => setModelo(item)}><span className="model-card-icon"><DocumentModelIcon size={28} /></span><strong>{nomes[item.id] || item.nome}</strong><span>{item.descricao}</span></button>)
          : categorias.map((item) => <button type="button" className="legal-doc-selection-card" key={item.id} onClick={() => setCategoria(item)}><span className="model-card-icon"><DocumentCategoryIcon name={item.icone} size={28} /></span><strong>{item.nome}</strong><span>{item.modelos.length} {item.modelos.length === 1 ? "documento disponível" : "documentos disponíveis"}</span></button>)}
      </div>
    </section>
  </section>;
}

function EditorDocumento({ responsavel, usuario, onSuccess, contextoDocumento, onDocumentoGerado, onStatusDocumento, modeloInicial, dadosIniciais, dataRascunho, modelosDaCategoria, onVoltar, onNovaSelecao }) {
  const departamentoUsuario = usuario?.setor || usuario?.departamento || "Jurídico";
  const [dados, setDados] = useState(() => ({ ...criarFormularioInicial(responsavel, modeloInicial, departamentoUsuario), ...dadosDoContextoDocumento(contextoDocumento), ...(contextoDocumento ? { contextoDocumento } : {}), ...dadosIniciais }));
  const [nomesModelos, setNomesModelos] = useState(() => lerJsonLocal(DOCUMENT_MODEL_NAMES_KEY, {}));
  const [editandoNomeModelo, setEditandoNomeModelo] = useState(false);
  const [nomeModeloEmEdicao, setNomeModeloEmEdicao] = useState("");
  const [salvandoNomeModelo, setSalvandoNomeModelo] = useState(false);
  const [usoModelos, setUsoModelos] = useState(() => lerJsonLocal(DOCUMENT_USAGE_KEY, {}));
  const [tocados, setTocados] = useState(() => new Set());
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [dirty, setDirty] = useState(false);
  const [salvoEm, setSalvoEm] = useState(() => dataRascunho ? new Date(dataRascunho) : null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [sufixoDocumento] = useState(() => String(Date.now()).slice(-5));
  const primeiraSecaoRef = useRef(null);
  const dadosRef = useRef(dados);
  const dirtyRef = useRef(false);

  useEffect(() => {
    localStorage.removeItem(DOCUMENT_HISTORY_KEY);
    if (!rascunhoValido(lerJsonLocal(DOCUMENT_DRAFT_KEY, null))) localStorage.removeItem(DOCUMENT_DRAFT_KEY);
    let ativo = true;
    supabase.from("modelos_juridicos_config").select("modelo_id, nome_exibicao").then(({ data, error }) => {
      if (!ativo || error) return;
      const nomes = Object.fromEntries((data || []).map((item) => [item.modelo_id, item.nome_exibicao]));
      setNomesModelos(nomes);
      localStorage.setItem(DOCUMENT_MODEL_NAMES_KEY, JSON.stringify(nomes));
    });
    return () => { ativo = false; };
  }, []);

  const gestor = normalizarBusca(usuario?.nome || "") === "tafarel" || [usuario?.tipo, usuario?.role, usuario?.perfil].some((perfil) => ["admin", "administrador"].includes(normalizarBusca(perfil || "")));
  const modelos = useMemo(() => MODELOS.map((modelo) => ({ ...modelo, nome: nomesModelos[modelo.id] || modelo.nome, totalGeracoes: Number(usoModelos[modelo.id] || 0) })), [nomesModelos, usoModelos]);
  const modeloSelecionado = modelos.find((modelo) => modelo.id === dados.modeloId) || modelos[0];
  const numeroDocumento = useMemo(() => `${dados.dataEmissao?.replaceAll("-", "") || "sem-data"}-${sufixoDocumento}`, [dados.dataEmissao, sufixoDocumento]);
  const obrigatorios = modeloSelecionado.campos.filter((campo) => campo.obrigatorio);
  const pendentes = obrigatorios.filter((campo) => erroCampo(campo, dados[campo.nome]));
  const nomeSugerido = montarNomeAutomatico(modeloSelecionado, dados);
  const versaoSugerida = proximaVersao(nomeSugerido, historico);
  const duplicado = Boolean(nomeSugerido && versaoSugerida > Number(dados.versao || 1));
  const declaracaoIrpfInvalida = modeloSelecionado.modo === "procuracao" && dados.gerarIsencaoIrpf && (!String(dados.exercicios || "").trim() || !String(dados.dataDocumentoIrpf || "").trim());
  const conflitosFixos = useMemo(() => {
    const conflitos = listarConflitosFixos(modeloSelecionado, dados);
    if (modeloSelecionado.modo === "procuracao" && dados.gerarIsencaoIrpf) {
      const modeloIrpf = modelos.find((item) => item.modo === "declaracao-isencao-irpf");
      if (modeloIrpf) conflitos.push(...listarConflitosFixos(modeloIrpf, { ...dados, dataDocumento: dados.dataDocumentoIrpf }));
    }
    return conflitos;
  }, [modeloSelecionado, modelos, dados]);
  const pendenciaOriginal = pendenciaModeloOriginal(modeloSelecionado);

  const focarCampo = useCallback((nome) => {
    setTocados((atuais) => new Set([...atuais, nome]));
    window.setTimeout(() => { const campo = document.getElementById(`doc-field-${nome}`); campo?.scrollIntoView({ behavior: "smooth", block: "center" }); campo?.focus(); }, 80);
  }, []);


  useEffect(() => {
    function conectado() { setOnline(true); } function desconectado() { setOnline(false); }
    window.addEventListener("online", conectado); window.addEventListener("offline", desconectado);
    return () => { window.removeEventListener("online", conectado); window.removeEventListener("offline", desconectado); };
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    const temporizador = window.setTimeout(() => {
      const dataSalvamento = persistirRascunho(dados);
      setSalvoEm(dataSalvamento);
      setDirty(false);
    }, DOCUMENT_DRAFT_INACTIVITY_MS);
    return () => window.clearTimeout(temporizador);
  }, [dados, dirty]);

  useEffect(() => {
    dadosRef.current = dados;
    dirtyRef.current = dirty;
  }, [dados, dirty]);

  useEffect(() => {
    const preservarAntesDeRecarregar = () => {
      if (dirtyRef.current) persistirRascunho(dadosRef.current);
    };
    window.addEventListener("beforeunload", preservarAntesDeRecarregar);
    return () => window.removeEventListener("beforeunload", preservarAntesDeRecarregar);
  }, []);

  useEffect(() => () => {
    if (dirtyRef.current) persistirRascunho(dadosRef.current);
  }, []);

  useEffect(() => () => { resultado?.arquivos?.forEach((arquivo) => URL.revokeObjectURL(arquivo.url)); }, [resultado]);
  function atualizarDados(parcial) { setDados((atual) => ({ ...atual, ...parcial })); setDirty(true); setErro(""); }
  function atualizarCampo(evento) {
    const { name, type, value, checked, files } = evento.target;
    if (type === "file") {
      const arquivo = files?.[0];
      setTocados((atuais) => new Set([...atuais, name]));
      if (!arquivo) {
        atualizarDados({ [name]: null });
        return;
      }
      const leitor = new FileReader();
      leitor.onload = () => atualizarDados({ [name]: { nome: arquivo.name, tipo: arquivo.type, dataUrl: leitor.result } });
      leitor.readAsDataURL(arquivo);
      return;
    }
    const parcial = { [name]: type === "checkbox" ? checked : formatarValorCampo(name, value) };
    if (name === "nacionalidade") parcial.nacionalidadePreenchidaManualmente = true;
    atualizarDados(parcial);
    setTocados((atuais) => new Set([...atuais, name]));
  }
  function marcarTocado(evento) { setTocados((atuais) => new Set([...atuais, evento.target.name])); }

  function selecionarModelo(modelo) {
    const inicial = criarFormularioInicial(responsavel, modelo, departamentoUsuario);
    modelo.campos.forEach((campo) => { if (dados[campo.nome]) inicial[campo.nome] = dados[campo.nome]; });
    Object.assign(inicial, { ...dadosDoContextoDocumento(dados.contextoDocumento), contextoDocumento: dados.contextoDocumento, dataEmissao: dados.dataEmissao, departamento: dados.departamento, salvarNaPasta: dados.salvarNaPasta, observacaoInterna: dados.observacaoInterna || "", nacionalidadePreenchidaManualmente: Boolean(dados.nacionalidadePreenchidaManualmente) });
    setEditandoNomeModelo(false);
    atualizarDados(inicial); setTocados(new Set());
    primeiraSecaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }


  async function salvarNomeDoModelo() {
    if (!gestor) return;
    const nome = nomeModeloEmEdicao.trim().replace(/\s{2,}/g, " ");
    if (nome.length < 3) { setErro("Informe pelo menos 3 caracteres para o nome do modelo."); return; }
    setSalvandoNomeModelo(true);
    const proximaConfiguracao = { ...nomesModelos, [modeloSelecionado.id]: nome };
    try {
      const { error: erroSalvar } = await supabase.from("modelos_juridicos_config").upsert({ modelo_id: modeloSelecionado.id, nome_exibicao: nome }, { onConflict: "modelo_id" });
      if (erroSalvar) throw erroSalvar;
      setNomesModelos(proximaConfiguracao);
      localStorage.setItem(DOCUMENT_MODEL_NAMES_KEY, JSON.stringify(proximaConfiguracao));
      setEditandoNomeModelo(false);
      onSuccess?.("Nome do modelo atualizado para toda a equipe.");
    } catch (erroSalvar) {
      console.error("Erro ao salvar o nome do modelo:", erroSalvar);
      setErro("Não foi possível salvar o nome compartilhado. Execute a configuração de modelos jurídicos no Supabase e tente novamente.");
    } finally {
      setSalvandoNomeModelo(false);
    }
  }


  function limparFormulario() {
    const inicial = criarFormularioInicial(responsavel, modeloSelecionado, departamentoUsuario);
    localStorage.removeItem(DOCUMENT_DRAFT_KEY);
    dadosRef.current = inicial;
    dirtyRef.current = false;
    setDados(inicial);
    setTocados(new Set());


    setSalvoEm(null);
    setDirty(false);
  }

  function cancelarEdicao() {
    if (!window.confirm("Descartar as alterações deste documento?")) return;
    limparFormulario();
  }

  function baixarResultadoELimpar() {
    if (!resultado?.arquivos?.length) return;
    baixarArquivos(resultado.arquivos);
    window.setTimeout(() => {
      limparFormulario();
      setResultado(null);
    }, resultado.arquivos.length * 140 + 350);
  }

  async function arquivarNoSupabase(arquivos, registro) {
    if (!dados.salvarNaPasta) return { registro, aviso: "O registro automático foi desativado; os arquivos estão disponíveis apenas para download nesta sessão." };
    const nomesArquivos = arquivos.map((arquivo) => arquivo.nome);
    const { data: salvo, error: salvarError } = await supabase.from("documentos_juridicos").insert({ nome_documento: registro.nomeDocumento, nome_arquivo: arquivos[0].nome, modelo_id: registro.modeloId, modelo_nome: registro.modeloNome, categoria: modeloSelecionado.categoriaNome, cliente_id: dados.contextoDocumento?.cliente?.id || null, processo_id: dados.contextoDocumento?.processo?.id || null, tipo_documento: modeloSelecionado.modo, cliente_nome: registro.cliente || null, cpf_cnpj: dados.cpfCnpj || dados.cpfContratante || null, numero_contrato: dados.numeroContrato || null, numero_processo: dados.numeroProcesso || null, link_pasta_cliente: dados.contextoDocumento?.cliente?.link_pasta_cliente || dados.contextoDocumento?.processo?.link_pasta_cliente || null, responsavel_nome: registro.responsavel, departamento: dados.departamento || null, destino: dados.destino || null, versao: registro.versao, status: "Gerado", assinado: false, arquivo_principal_path: null, arquivos_paths: [], metadata: { dados, arquivos: nomesArquivos, contextoDocumento: dados.contextoDocumento || null, armazenamento: "drive_externo", observacao_armazenamento: "Arquivo não armazenado no Supabase. Arquivamento oficial na pasta do cliente no Drive." } }).select("*").single();
    if (salvarError) throw salvarError;
    return { registro: { ...registro, id: salvo.id, storagePath: "", link: "", documentoRemoto: salvo }, aviso: "PDF gerado para download. Arquive o arquivo final na pasta do cliente no Drive." };
  }

  async function handleGerarPdf(evento) {
    evento?.preventDefault(); if (gerando) return; setTocados(new Set(modeloSelecionado.campos.map((campo) => campo.nome)));
    if (!dados.dataEmissao) { setErro("Informe a data de emissão."); document.getElementById("document-emission")?.focus(); return; }
    if (pendentes.length) { setErro(`Preencha ${pendentes.length} ${pendentes.length === 1 ? "campo obrigatório pendente" : "campos obrigatórios pendentes"}.`); focarCampo(pendentes[0].nome); return; }
    if (declaracaoIrpfInvalida) { setErro("Informe os exercícios e a data da declaração de isenção de Imposto de Renda."); document.getElementById("exercicios-conjunto")?.focus(); return; }
    if (conflitosFixos.length) { setErro("A geração foi bloqueada porque os dados informados contradizem trechos fixos do Word original. Revise as inconsistências exibidas."); return; }
    setGerando(true); setErro("");
    try {
      const versao = duplicado ? versaoSugerida : Number(dados.versao) || 1;
      const nomesParaGeracao = montarNomesDoConjunto(modeloSelecionado, dados, numeroDocumento, versao);
      const nomeDocumento = nomesParaGeracao[modeloSelecionado.modo];
      const dadosGeracao = { ...dados, versao, numeroDocumento };
      const arquivos = await gerarArquivos(dadosGeracao, modeloSelecionado, nomeDocumento, true, nomesParaGeracao); const criadoEm = new Date().toISOString();
      const registroBase = { id: `local-${Date.now()}`, nomeDocumento, modeloId: modeloSelecionado.id, modeloNome: modeloSelecionado.nome, icone: modeloSelecionado.icone, cliente: dados.nomeCliente || dados.nomeContratante, responsavel: responsavel || "Não informado", criadoEm, versao, status: "Gerado", destino: dados.destino, metadata: { dados: dadosGeracao } };
      let arquivamento = { registro: registroBase, aviso: "" };
      try { arquivamento = await arquivarNoSupabase(arquivos, registroBase); } catch (archiveError) { console.warn("Documento gerado sem arquivamento remoto:", archiveError); }
      const registro = { ...arquivamento.registro, arquivos: arquivos.map((arquivo) => ({ nome: arquivo.nome })) };
      const novoHistorico = [registro, ...historico.filter((item) => item.id !== registro.id)].slice(0, 8); setHistorico(novoHistorico); localStorage.removeItem(DOCUMENT_DRAFT_KEY); dirtyRef.current = false; setDirty(false);
      setUsoModelos((atuais) => { const proximo = { ...atuais, [modeloSelecionado.id]: Number(atuais[modeloSelecionado.id] || 0) + 1 }; localStorage.setItem(DOCUMENT_USAGE_KEY, JSON.stringify(proximo)); return proximo; });
      setResultado({ ...registro, arquivos, aviso: arquivamento.aviso || "PDF gerado para download. Arquive o arquivo final na pasta do cliente no Drive.", numeroDocumento });
      onDocumentoGerado?.({ ...registro, arquivos, aviso: arquivamento.aviso, numeroDocumento, documentoRemoto: registro.documentoRemoto || null, modelo: modeloSelecionado, dados: dadosGeracao });
      onSuccess?.(modeloSelecionado.modo === "procuracao" ? mensagemConjuntoGerado(listarDocumentosProcuracao(dados)) : "Documento PDF gerado com sucesso!");
    } catch (generationError) { console.error(generationError); setErro(generationError instanceof Error ? generationError.message : "Não foi possível gerar o PDF. Revise os dados e tente novamente."); } finally { setGerando(false); }
  }

  async function abrirHistorico(item) { let link = item.link; if (!link && item.storagePath) { const { data } = await supabase.storage.from("documentos-juridicos").createSignedUrl(item.storagePath, 60 * 60); link = data?.signedUrl; } if (link) window.open(link, "_blank", "noopener,noreferrer"); }
  function carregarRegistro(item, novaVersao = false) { const modelo = modelos.find((modeloItem) => modeloItem.id === item.modeloId); if (!modelo) { setErro("Este modelo foi removido da biblioteca e não pode ser reutilizado."); return; } const dadosSalvos = { ...(item.metadata?.dados || {}) }; delete dadosSalvos.nomeDocumento; const versao = novaVersao ? (Number(item.versao) || 1) + 1 : 1; setDados({ ...criarFormularioInicial(responsavel, modelo, departamentoUsuario), ...dadosSalvos, modeloId: modelo.id, versao }); setDirty(true); primeiraSecaoRef.current?.scrollIntoView({ behavior: "smooth" }); }
  async function copiarLink() { if (!resultado?.link) return; await navigator.clipboard.writeText(resultado.link); onSuccess?.("Link interno copiado."); }
  async function prepararAssinatura() { if (resultado?.id && !String(resultado.id).startsWith("local-")) await supabase.from("documentos_juridicos").update({ status: "Aguardando assinatura" }).eq("id", resultado.id); setResultado((atual) => ({ ...atual, status: "Aguardando assinatura" })); onStatusDocumento?.({ ...resultado, status: "Aguardando assinatura" }); onSuccess?.("Documento marcado como pronto para assinatura."); }

  return <section className="legal-doc-workspace legal-doc-workspace-compact" ref={primeiraSecaoRef}>
    <header className="legal-doc-compact-header"><h1>Gerador de Documentos</h1></header>
    {!online ? <p className="legal-doc-offline" role="status">Sem conexão. Você pode salvar o rascunho localmente.</p> : null}
    <FormSection as="form" className="legal-doc-compact-form" onSubmit={handleGerarPdf} noValidate>
      <button type="button" className="btn-secondary legal-doc-back" disabled={gerando} onClick={onVoltar}>Voltar aos documentos</button>
      <div className="legal-doc-model-toolbar">
        <FormField htmlFor="document-model"><span>Modelo</span><Select id="document-model" value={modeloSelecionado.id} disabled={gerando} onChange={(evento) => selecionarModelo(modelos.find((modelo) => modelo.id === evento.target.value))}>{modelos.filter((modelo) => modelosDaCategoria.some((item) => item.id === modelo.id)).map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>)}</Select></FormField>
        {gestor ? <button type="button" className="btn-secondary" disabled={gerando} onClick={() => { setNomeModeloEmEdicao(modeloSelecionado.nome); setEditandoNomeModelo((aberto) => !aberto); }}>{editandoNomeModelo ? "Cancelar" : "Renomear modelo"}</button> : null}
      </div>
      {gestor && editandoNomeModelo ? <div className="legal-doc-model-name-editor"><FormField htmlFor="nomeModelo"><span>Nome do modelo</span><Input id="nomeModelo" value={nomeModeloEmEdicao} onChange={(evento) => setNomeModeloEmEdicao(evento.target.value)} maxLength="100" /></FormField><button type="button" className="btn-primary" disabled={salvandoNomeModelo || gerando} onClick={salvarNomeDoModelo}>{salvandoNomeModelo ? "Salvando…" : "Salvar nome"}</button></div> : null}
      <fieldset className="legal-doc-entry-fields" disabled={gerando}>
        <legend>Dados do documento</legend>
        <FormGrid className="legal-doc-fields-grid legal-doc-fields-flat" key={modeloSelecionado.id}>
          {modeloSelecionado.campos.map((campo) => <CampoDocumento key={campo.nome} campo={campo} valor={dados[campo.nome]} erro={tocados.has(campo.nome) ? erroCampo(campo, dados[campo.nome]) : ""} onChange={atualizarCampo} onBlur={marcarTocado} />)}
          <FormField htmlFor="document-emission"><span>Data de emissão *</span><Input id="document-emission" type="date" name="dataEmissao" value={dados.dataEmissao || ""} onChange={atualizarCampo} required /></FormField>
        </FormGrid>
        {modeloSelecionado.modo === "procuracao" ? <FormGrid className="legal-doc-bundle-options">
          <FormField><Input type="checkbox" name="gerarHipossuficiencia" checked={Boolean(dados.gerarHipossuficiencia)} onChange={atualizarCampo} /><span>Declaração de Hipossuficiência</span></FormField>
          <FormField><Input type="checkbox" name="gerarIsencaoIrpf" checked={Boolean(dados.gerarIsencaoIrpf)} onChange={atualizarCampo} /><span>Declaração de Isenção de IRPF</span></FormField>
          {dados.gerarIsencaoIrpf ? <><FormField htmlFor="exercicios-conjunto"><span>Exercícios da isenção *</span><Input id="exercicios-conjunto" name="exercicios" value={dados.exercicios || ""} onChange={atualizarCampo} placeholder="2024, 2025" /></FormField><FormField htmlFor="irpf-date"><span>Data da declaração de IRPF *</span><Input id="irpf-date" type="date" name="dataDocumentoIrpf" value={dados.dataDocumentoIrpf || ""} onChange={atualizarCampo} /></FormField></> : null}
        </FormGrid> : null}
        <details className="legal-doc-control-details">
          <summary>Controle e arquivamento</summary>
          <FormGrid className="legal-doc-fields-grid">
            {!modeloSelecionado.campos.some((campo) => campo.nome === "numeroProcesso") ? <FormField><span>Número do processo</span><Input name="numeroProcesso" value={dados.numeroProcesso || ""} onChange={atualizarCampo} /></FormField> : null}
            <FormField><span>Responsável</span><Input value={responsavel || ""} readOnly /></FormField>
            <FormField><span>Departamento</span><Select name="departamento" value={dados.departamento || ""} onChange={atualizarCampo}><option>Administrativo</option><option>Jurídico</option><option>Processual</option><option>Supervisão</option></Select></FormField>
            <FormField className="wide"><span>Observação interna</span><Textarea name="observacaoInterna" value={dados.observacaoInterna || ""} onChange={atualizarCampo} rows="2" /></FormField>
            <FormField><Input type="checkbox" name="salvarNaPasta" checked={Boolean(dados.salvarNaPasta)} onChange={atualizarCampo} /><span>Vincular ao cadastro do cliente</span></FormField>
            <FormField><span>Destino</span><Input name="destino" value={dados.destino || ""} onChange={atualizarCampo} /></FormField>
          </FormGrid>
        </details>
      </fieldset>
      {pendenciaOriginal ? <p className="legal-doc-form-error" role="alert">{pendenciaOriginal}</p> : null}
      {conflitosFixos.length ? <ul className="legal-doc-conflicts" role="alert">{conflitosFixos.map((conflito, indice) => <li key={indice}>{conflito.modeloNome}: {conflito.mensagem}</li>)}</ul> : null}
      {erro ? <p className="legal-doc-form-error" role="alert">{erro}</p> : null}
      <div className="legal-doc-compact-actions">
        <div><button type="button" className="btn-secondary" disabled={gerando} onClick={cancelarEdicao}>Limpar</button>{salvoEm ? <span role="status">Salvo às {salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span> : null}</div>
        <button type="submit" className="btn-primary" disabled={gerando || Boolean(pendenciaOriginal) || conflitosFixos.length > 0}>{gerando ? "Gerando…" : "Gerar PDF"}</button>
      </div>
    </FormSection>
    {historico.length ? <details className="legal-doc-history-details"><summary>Documentos recentes</summary><DocumentosRecentes documentos={historico} busca={buscaHistorico} onBusca={setBuscaHistorico} onOpen={abrirHistorico} onDuplicate={(item) => carregarRegistro(item, false)} onVersion={(item) => carregarRegistro(item, true)} /></details> : null}
    <ModalSucesso resultado={resultado} onClose={() => setResultado(null)} onDownload={baixarResultadoELimpar} onOpen={() => window.open(resultado.arquivos[0].url, "_blank", "noopener,noreferrer")} onCopy={copiarLink} onSignature={prepararAssinatura} onLibrary={() => { setResultado(null); limparFormulario(); onNovaSelecao(); }} onAnother={() => { setResultado(null); setDados((atual) => ({ ...atual, versao: 1 })); setDirty(true); }} />
  </section>;
}
