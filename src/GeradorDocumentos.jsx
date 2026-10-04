import { FormField, FormGrid, FormSection, Input, Select, Textarea } from "./components/common/FormControls";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ModelLibraryModal, { DocumentCategoryIcon, DocumentModelIcon } from "./components/documentos/ModelLibraryModal";
import {
  DOCUMENT_DRAFT_KEY, DOCUMENT_FAVORITES_KEY, DOCUMENT_HISTORY_KEY,
  DOCUMENT_RECENT_MODELS_KEY, DOCUMENT_USAGE_KEY, DOCUMENT_WORKSPACE_SCHEMA, agruparCampos,
  enriquecerModelos, erroCampo, formatarValorCampo, listarConflitosFixos, normalizarBusca,
  normalizarNomeArquivo, proximaVersao, rascunhoValido,
} from "./lib/documentWorkspace";
import { criarOpcoesIniciaisProcuracao, listarDocumentosProcuracao, mensagemConjuntoGerado } from "./lib/procuracaoConjunto";
import { supabase } from "./lib/supabase";
import { DOCUMENT_TEMPLATES, valorInicialCampo } from "./config/documentTemplates";
import { gerarPdfModelo, pendenciaModeloOriginal } from "./lib/documentPdf";
import "./documentWorkspace.css";

const MODELOS = enriquecerModelos(DOCUMENT_TEMPLATES);
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

function carregarHistoricoTemporario() {
  const limite = Date.now() - 12 * 60 * 60 * 1000;
  const recentes = lerJsonLocal(DOCUMENT_HISTORY_KEY, []).filter((item) => new Date(item.criadoEm || 0).getTime() >= limite);
  localStorage.setItem(DOCUMENT_HISTORY_KEY, JSON.stringify(recentes));
  return recentes;
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

function carregarRascunho(responsavel, departamento, contextoDocumento) {
  if (contextoDocumento) {
    const modeloContexto = MODELOS.find((modelo) => modelo.id === contextoDocumento.modeloId || modelo.modo === contextoDocumento.modeloModo) || MODELOS[0];
    return {
      ...criarFormularioInicial(responsavel, modeloContexto, departamento),
      ...dadosDoContextoDocumento(contextoDocumento),
      contextoDocumento,
    };
  }
  const salvo = lerJsonLocal(DOCUMENT_DRAFT_KEY, null);
  if (!rascunhoValido(salvo) || !MODELOS.some((modelo) => modelo.id === salvo.dados.modeloId)) {
    localStorage.removeItem(DOCUMENT_DRAFT_KEY);
    return criarFormularioInicial(responsavel, MODELOS[0], departamento);
  }
  const dadosSalvos = { ...salvo.dados };
  if (!dadosSalvos.nacionalidadePreenchidaManualmente && String(dadosSalvos.nacionalidade || "").trim().toLocaleLowerCase("pt-BR") === "brasileira") {
    dadosSalvos.nacionalidade = "";
  }
  return dadosSalvos;
}

function dataDoRascunhoAtual() {
  const salvo = lerJsonLocal(DOCUMENT_DRAFT_KEY, null);
  return rascunhoValido(salvo) ? new Date(salvo.salvoEm) : null;
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

function EtapasDocumento({ etapaAtual }) {
  const etapas = ["Selecionar modelo", "Identificar documento", "Preencher dados", "Revisar e gerar"];
  return <ol className="legal-doc-steps" aria-label="Etapas da geração do documento">{etapas.map((etapa, indice) => { const numero = indice + 1; const concluida = numero < etapaAtual; const atual = numero === etapaAtual; return <li key={etapa} className={`${concluida ? "done" : ""} ${atual ? "active" : ""}`} aria-current={atual ? "step" : undefined}><span>{concluida ? "✓" : numero}</span><strong>{etapa}</strong></li>; })}</ol>;
}

function CampoDocumento({ campo, valor, erro, onChange, onBlur }) {
  const inputId = `doc-field-${campo.nome}`;
  const props = { id: inputId, name: campo.nome, value: valor || "", onChange, onBlur, required: campo.obrigatorio, "aria-invalid": Boolean(erro), "aria-describedby": erro ? `${inputId}-error` : undefined };
  if (campo.tipo === "file") {
    return <FormField className={`legal-doc-field ${campo.largura === "total" ? "wide" : ""} ${erro ? "invalid" : ""}`} htmlFor={inputId}><span className="legal-doc-label-row"><span>{campo.rotulo}{campo.obrigatorio ? " *" : ""}</span></span><Input id={inputId} name={campo.nome} type="file" accept={campo.accept} onChange={onChange} onBlur={onBlur} required={campo.obrigatorio} aria-invalid={Boolean(erro)} aria-describedby={erro ? `${inputId}-error` : undefined} />{valor?.nome ? <small>{valor.nome}</small> : null}{erro ? <small className="legal-doc-field-error" id={`${inputId}-error`}>{erro}</small> : null}</FormField>;
  }
  return <FormField className={`legal-doc-field ${campo.largura === "total" ? "wide" : ""} ${erro ? "invalid" : ""}`} htmlFor={inputId}><span className="legal-doc-label-row"><span>{campo.rotulo}{campo.obrigatorio ? " *" : ""}</span></span>{campo.tipo === "textarea" ? <Textarea {...props} rows="4" placeholder={campo.placeholder} /> : campo.tipo === "select" ? <Select {...props}>{campo.opcoes.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</Select> : <Input {...props} type={campo.tipo || "text"} placeholder={campo.placeholder} min={campo.min} />}{erro ? <small className="legal-doc-field-error" id={`${inputId}-error`}>{erro}</small> : null}</FormField>;
}

function GrupoCampos({ grupo, dados, tocados, onChange, onBlur, modeloId, abertoInicial = false }) {
  const [aberto, setAberto] = useState(abertoInicial);
  const obrigatorios = grupo.campos.filter((campo) => campo.obrigatorio);
  const preenchidos = obrigatorios.filter((campo) => !erroCampo(campo, dados[campo.nome])).length;
  return <FormSection className={`legal-doc-field-group ${aberto ? "open" : ""}`}><button type="button" className="legal-doc-field-group-toggle" onClick={() => setAberto((valor) => !valor)} aria-expanded={aberto}><span><strong>{grupo.titulo}</strong><small>{preenchidos} de {obrigatorios.length} obrigatórios preenchidos</small></span><span className="legal-doc-group-progress"><i style={{ width: `${obrigatorios.length ? (preenchidos / obrigatorios.length) * 100 : 100}%` }} /></span><b aria-hidden="true">⌄</b></button>{aberto ? <FormGrid className="legal-doc-fields-grid" key={modeloId}>{grupo.campos.map((campo) => <CampoDocumento key={campo.nome} campo={campo} valor={dados[campo.nome]} erro={tocados.has(campo.nome) ? erroCampo(campo, dados[campo.nome]) : ""} onChange={onChange} onBlur={onBlur} />)}</FormGrid> : null}</FormSection>;
}

function PainelProgresso({ total, preenchidos, pendentes, onVerPendentes }) {
  const percentual = total ? Math.round((preenchidos / total) * 100) : 100;
  return <section className="legal-doc-progress-card"><div className="legal-doc-progress-heading"><div><span className="eyebrow">Progresso do documento</span><h3>{percentual}% preenchido</h3></div><strong>{preenchidos} de {total}</strong></div><div className="legal-doc-progress-track" aria-label={`${percentual}% preenchido`}><span style={{ width: `${percentual}%` }} /></div>{pendentes.length > 0 ? <><p>{pendentes.length} {pendentes.length === 1 ? "campo obrigatório impede" : "campos obrigatórios impedem"} a geração.</p><ul>{pendentes.slice(0, 4).map((campo) => <li key={campo.nome}>{campo.rotulo}</li>)}</ul><button type="button" className="btn-secondary compact" onClick={onVerPendentes}>Ver campos pendentes</button></> : <p className="legal-doc-ready">✓ Todos os campos obrigatórios estão prontos para revisão.</p>}</section>;
}

function AssistentePreenchimento({ dados, pendentes, errosVisiveis, onCorrigir }) {
  let aviso;
  if (errosVisiveis.length > 0) aviso = { tom: "error", titulo: "Revise um dado informado", texto: errosVisiveis[0].erro, campo: errosVisiveis[0].campo.nome };
  else if (pendentes.length > 0) aviso = { tom: "warning", titulo: `Faltam ${pendentes.length} ${pendentes.length === 1 ? "informação obrigatória" : "informações obrigatórias"}`, texto: `Comece por ${pendentes[0].rotulo.toLowerCase()} para avançar na preparação.`, campo: pendentes[0].nome };
  else aviso = { tom: "success", titulo: "Documento pronto para revisão", texto: "Todos os campos obrigatórios foram preenchidos. Confira a prévia antes de gerar o PDF." };
  const orientacoes = [aviso, { tom: "info", titulo: "Conferência recomendada", texto: dados.numeroContrato ? "Revise o número do contrato antes de gerar o arquivo final." : "Inclua contrato ou processo no nome quando essa referência estiver disponível." }];
  return <section className="legal-doc-assistant"><div className="legal-doc-section-title"><span><DocumentCategoryIcon name="shield" size={20} /></span><div><span className="eyebrow">Apoio contextual</span><h3>Assistente de preenchimento</h3></div></div><div className="legal-doc-advice-list">{orientacoes.map((item) => <article className={`legal-doc-advice ${item.tom}`} key={item.titulo}><span aria-hidden="true">{item.tom === "success" ? "✓" : item.tom === "info" ? "i" : "!"}</span><div><strong>{item.titulo}</strong><p>{item.texto}</p>{item.campo ? <button type="button" onClick={() => onCorrigir(item.campo)}>Corrigir agora</button> : null}</div></article>)}</div></section>;
}

function PainelPrevia({ modelo, nomeDocumento, numeroDocumento, atualizadoEm, gerando, pdfUrl, erroPrevia, fullscreen, onFullscreen, onRefresh }) {
  const [zoom, setZoom] = useState(0.78);
  const origem = pdfUrl ? `${pdfUrl}#zoom=${Math.round(zoom * 100)}&view=FitH` : "";
  return <section className={`legal-doc-preview-panel ${fullscreen ? "fullscreen" : ""}`}><header><div><span className="eyebrow">Prévia de preenchimento — sem validade jurídica</span><h3>{nomeDocumento || modelo.nome}</h3><p>{modelo.nome} · {numeroDocumento}</p></div>{fullscreen ? <button type="button" className="legal-doc-preview-close" onClick={onFullscreen} aria-label="Fechar prévia">×</button> : null}</header><div className="legal-doc-preview-status"><span className={gerando ? "loading" : "ready"}>{gerando ? "Atualizando" : "Pronta para conferência"}</span><small>Atualizada {formatarDataHora(atualizadoEm)}</small></div><div className="legal-doc-preview-tools"><button type="button" onClick={() => setZoom((valor) => Math.max(.58, valor - .1))} aria-label="Diminuir zoom">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((valor) => Math.min(1.08, valor + .1))} aria-label="Aumentar zoom">+</button><i /><button type="button" onClick={onRefresh}>↻ <span>Atualizar</span></button><button type="button" onClick={onFullscreen}>⛶ <span>Tela cheia</span></button></div><div className="legal-doc-preview-render">{gerando ? <div className="legal-doc-preview-skeleton" aria-label="Atualizando prévia"><span /><span /><span /><span /><span /></div> : null}{origem ? <iframe className="legal-doc-pdf-preview" title={`Prévia de preenchimento: ${nomeDocumento || modelo.nome}`} src={origem} /> : <div className="legal-doc-preview-placeholder">{erroPrevia || "Preparando a prévia de preenchimento…"}</div>}</div><footer><span>PDF gerado no seu navegador a partir do modelo preenchido</span></footer></section>;
}
function ModalSucesso({ resultado, onClose, onDownload, onOpen, onCopy, onSignature, onLibrary, onAnother }) {
  if (!resultado) return null;
  const rotuloDownload = `Baixar PDF${resultado.arquivos.length > 1 ? "s" : ""}`;
  return <div className="legal-doc-success-backdrop"><section className="legal-doc-success-modal" role="dialog" aria-modal="true" aria-labelledby="success-title"><button type="button" className="model-library-close" onClick={onClose} aria-label="Fechar confirmação">×</button><span className="legal-doc-success-icon">✓</span><span className="eyebrow">Geração concluída</span><h2 id="success-title">Documento gerado com sucesso</h2><p>{resultado.arquivos.length} {resultado.arquivos.length === 1 ? "arquivo foi preparado" : "arquivos foram preparados"} para conferência e download.</p>{resultado.aviso ? <div className="legal-doc-archive-warning">{resultado.aviso}</div> : null}<dl className="legal-doc-success-details"><div><dt>Documento</dt><dd>{resultado.nomeDocumento}</dd></div><div><dt>Cliente</dt><dd>{resultado.cliente || "Não vinculado"}</dd></div><div><dt>Data e horário</dt><dd>{formatarDataHora(resultado.criadoEm)}</dd></div><div><dt>Responsável</dt><dd>{resultado.responsavel}</dd></div><div><dt>Número</dt><dd>{resultado.numeroDocumento}</dd></div><div><dt>Versão</dt><dd>{String(resultado.versao).padStart(2, "0")}</dd></div><div className="wide"><dt>Destino</dt><dd>{resultado.destino}</dd></div><div><dt>Status</dt><dd><span className="legal-doc-status-pill">{resultado.status}</span></dd></div></dl><div className="legal-doc-success-actions primary"><button type="button" className="btn-primary" onClick={onOpen}>Abrir documento</button><button type="button" className="btn-secondary" onClick={onDownload}>{rotuloDownload}</button><button type="button" className="btn-secondary" onClick={onCopy} disabled={!resultado.link}>Copiar link</button><button type="button" className="btn-secondary" onClick={onSignature}>Enviar para assinatura</button></div><div className="legal-doc-success-actions secondary"><button type="button" onClick={onLibrary}>Voltar à biblioteca</button><button type="button" onClick={onAnother}>Gerar outro documento com estes dados</button></div></section></div>;
}
function DocumentosRecentes({ documentos, busca, onBusca, onOpen, onDuplicate, onVersion }) {
  const termo = normalizarBusca(busca);
  const [limiteRecente] = useState(() => Date.now() - 12 * 60 * 60 * 1000);
  const filtrados = documentos
    .filter((item) => new Date(item.criadoEm || 0).getTime() >= limiteRecente)
    .filter((item) => !termo || normalizarBusca(`${item.nomeDocumento} ${item.modeloNome} ${item.cliente} ${item.responsavel}`).includes(termo));
  return <section className="legal-doc-recent-section"><div className="legal-doc-recent-heading"><div><span className="eyebrow">Rastreabilidade</span><h2>Documentos recentes</h2><p>{"Gerados nas últimas 12 horas."}</p></div><FormField><span>Buscar</span><Input type="search" value={busca} onChange={(evento) => onBusca(evento.target.value)} placeholder="Pesquisar no histórico..." /></FormField></div>{filtrados.length === 0 ? <div className="legal-doc-recent-empty"><DocumentCategoryIcon name="clock" size={25} /><strong>Nenhum documento recente</strong><p>{"Somente documentos das últimas 12 horas aparecem aqui."}</p></div> : <div className="legal-doc-recent-list compact">{filtrados.slice(0, 8).map((item) => <article key={item.id}><span className="model-card-icon compact"><DocumentModelIcon size={22} /></span><div><strong>{item.nomeDocumento}</strong><p>{item.modeloNome} - {item.cliente || "Cliente não vinculado"}</p><small>{formatarDataHora(item.criadoEm)} - {item.responsavel}</small></div><span className="legal-doc-history-status">{item.status || "Gerado"}</span><div className="legal-doc-history-actions"><button type="button" onClick={() => onOpen(item)} disabled={!item.link && !item.storagePath}>Abrir</button><details className="legal-doc-history-menu"><summary aria-label="Mais ações">...</summary><div><button type="button" onClick={() => onDuplicate(item)}>Duplicar</button><button type="button" onClick={() => onVersion(item)}>Nova versão</button></div></details></div></article>)}</div>}</section>;
}

export default function GeradorDocumentos({ responsavel, usuario, onSuccess, contextoDocumento, onDocumentoGerado, onStatusDocumento }) {
  const departamentoUsuario = usuario?.setor || usuario?.departamento || "Jurídico";
  const [dados, setDados] = useState(() => carregarRascunho(responsavel, departamentoUsuario, contextoDocumento));
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false);
  const [nomesModelos, setNomesModelos] = useState(() => lerJsonLocal(DOCUMENT_MODEL_NAMES_KEY, {}));
  const [editandoNomeModelo, setEditandoNomeModelo] = useState(false);
  const [nomeModeloEmEdicao, setNomeModeloEmEdicao] = useState("");
  const [salvandoNomeModelo, setSalvandoNomeModelo] = useState(false);
  const [favoritos, setFavoritos] = useState(() => lerJsonLocal(DOCUMENT_FAVORITES_KEY, []));
  const [modelosRecentes, setModelosRecentes] = useState(() => lerJsonLocal(DOCUMENT_RECENT_MODELS_KEY, []));
  const [usoModelos, setUsoModelos] = useState(() => lerJsonLocal(DOCUMENT_USAGE_KEY, {}));
  const [tocados, setTocados] = useState(() => new Set());
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [dirty, setDirty] = useState(false);
  const [salvoEm, setSalvoEm] = useState(dataDoRascunhoAtual);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [previewAtualizadaEm, setPreviewAtualizadaEm] = useState(() => new Date());
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [previewPdfErro, setPreviewPdfErro] = useState("");
  const [previewPdfGerando, setPreviewPdfGerando] = useState(true);
  const [previewVersao, setPreviewVersao] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState(carregarHistoricoTemporario);
  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [sufixoDocumento] = useState(() => String(Date.now()).slice(-5));
  const primeiraSecaoRef = useRef(null);
  const previewPdfUrlRef = useRef("");
  const dadosRef = useRef(dados);
  const dirtyRef = useRef(false);

  const gestor = usuario?.tipo === "admin";
  const modelos = useMemo(() => MODELOS.map((modelo) => ({ ...modelo, nome: nomesModelos[modelo.id] || modelo.nome, totalGeracoes: Number(usoModelos[modelo.id] || 0) })), [nomesModelos, usoModelos]);
  const modeloSelecionado = modelos.find((modelo) => modelo.id === dados.modeloId) || modelos[0];
  const numeroDocumento = useMemo(() => `${dados.dataEmissao?.replaceAll("-", "") || "sem-data"}-${sufixoDocumento}`, [dados.dataEmissao, sufixoDocumento]);
  const grupos = useMemo(() => agruparCampos(modeloSelecionado.campos), [modeloSelecionado]);
  const obrigatorios = modeloSelecionado.campos.filter((campo) => campo.obrigatorio);
  const pendentes = obrigatorios.filter((campo) => erroCampo(campo, dados[campo.nome]));
  const preenchidos = obrigatorios.length - pendentes.length;
  const errosVisiveis = modeloSelecionado.campos.map((campo) => ({ campo, erro: erroCampo(campo, dados[campo.nome]) })).filter((item) => item.erro && tocados.has(item.campo.nome));
  const nomesDoConjunto = useMemo(() => montarNomesDoConjunto(modeloSelecionado, dados, numeroDocumento, dados.versao), [modeloSelecionado, dados, numeroDocumento]);
  const nomeSugerido = nomesDoConjunto[modeloSelecionado.modo];
  const nomeArquivoPdf = normalizarNomeArquivo(nomeSugerido || modeloSelecionado.nome);
  const nomeArquivo = nomeArquivoPdf;
  const versaoSugerida = proximaVersao(nomeSugerido, historico);
  const duplicado = Boolean(nomeSugerido && versaoSugerida > Number(dados.versao || 1));
  const identificacaoCompleta = Boolean(dados.dataEmissao);
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
  const podeGerar = !pendenciaOriginal && identificacaoCompleta && pendentes.length === 0 && !declaracaoIrpfInvalida && conflitosFixos.length === 0 && !gerando;
  const etapaAtual = !identificacaoCompleta ? 2 : pendentes.length || declaracaoIrpfInvalida || conflitosFixos.length ? 3 : 4;
  const documentosProcuracao = modeloSelecionado.modo === "procuracao" ? listarDocumentosProcuracao(dados) : [];

  const focarCampo = useCallback((nome) => {
    setTocados((atuais) => new Set([...atuais, nome]));
    window.setTimeout(() => { const campo = document.getElementById(`doc-field-${nome}`); campo?.scrollIntoView({ behavior: "smooth", block: "center" }); campo?.focus(); }, 80);
  }, []);

  useEffect(() => {
    let ativo = true;
    const limiteHistorico = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    Promise.allSettled([supabase.from("documentos_juridicos").select("*").gte("created_at", limiteHistorico).order("created_at", { ascending: false }).limit(12), supabase.from("modelos_juridicos_config").select("modelo_id, nome_exibicao")]).then(([historicoResultado, nomesResultado]) => {
      if (!ativo) return;
      if (historicoResultado.status === "fulfilled" && !historicoResultado.value.error) {
        const remotos = (historicoResultado.value.data || []).map((item) => ({ id: item.id, nomeDocumento: item.nome_documento, modeloId: item.modelo_id, modeloNome: item.modelo_nome, cliente: item.cliente_nome, responsavel: item.responsavel_nome, criadoEm: item.created_at, versao: item.versao, status: item.status, destino: item.destino, storagePath: item.arquivo_principal_path, metadata: item.metadata }));
        setHistorico((locais) => [...remotos, ...locais.filter((local) => !remotos.some((remoto) => remoto.id === local.id))].slice(0, 20));
      }
      if (nomesResultado.status === "fulfilled" && !nomesResultado.value.error) {
        const nomesRemotos = Object.fromEntries((nomesResultado.value.data || []).map((item) => [item.modelo_id, item.nome_exibicao]));
        setNomesModelos(nomesRemotos);
        localStorage.setItem(DOCUMENT_MODEL_NAMES_KEY, JSON.stringify(nomesRemotos));
      }
    });
    return () => { ativo = false; };
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
  useEffect(() => () => { if (previewPdfUrlRef.current) URL.revokeObjectURL(previewPdfUrlRef.current); }, []);

  useEffect(() => {
    let ativo = true;
    const temporizador = window.setTimeout(async () => {
      setPreviewPdfGerando(true);
      setPreviewPdfErro("");
      try {
        const arquivos = await gerarArquivos(dados, modeloSelecionado, nomeSugerido, false, nomesDoConjunto);
        const primeiroArquivo = arquivos[0];
        if (!primeiroArquivo) throw new Error("Nenhum PDF disponível para a prévia.");
        const url = URL.createObjectURL(new Blob([primeiroArquivo.bytes], { type: "application/pdf" }));
        if (!ativo) { URL.revokeObjectURL(url); return; }
        if (previewPdfUrlRef.current) URL.revokeObjectURL(previewPdfUrlRef.current);
        previewPdfUrlRef.current = url;
        setPreviewPdfUrl(url);
        setPreviewAtualizadaEm(new Date());
      } catch (previewError) {
        console.warn("Não foi possível atualizar a prévia do documento:", previewError);
        if (ativo) setPreviewPdfErro(previewError instanceof Error ? `Não foi possível atualizar a prévia: ${previewError.message}` : "Não foi possível atualizar a prévia do PDF.");
      } finally {
        if (ativo) setPreviewPdfGerando(false);
      }
    }, 450);
    return () => { ativo = false; window.clearTimeout(temporizador); };
  }, [dados, modeloSelecionado, nomeSugerido, nomesDoConjunto, previewVersao]);

  function atualizarDados(parcial) { setDados((atual) => ({ ...atual, ...parcial })); setDirty(true); setErro(""); setPreviewAtualizadaEm(new Date()); }
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
    if (modelo.id !== modeloSelecionado.id && dirty && !window.confirm("Trocar o modelo? Os campos específicos do documento atual serão substituídos, mas os dados comuns serão preservados.")) return;
    const inicial = criarFormularioInicial(responsavel, modelo, departamentoUsuario);
    modelo.campos.forEach((campo) => { if (dados[campo.nome]) inicial[campo.nome] = dados[campo.nome]; });
    Object.assign(inicial, { observacaoInterna: dados.observacaoInterna || "", nacionalidadePreenchidaManualmente: Boolean(dados.nacionalidadePreenchidaManualmente) });
    atualizarDados(inicial); setTocados(new Set());
    const novosRecentes = [modelo.id, ...modelosRecentes.filter((id) => id !== modelo.id)].slice(0, 6); setModelosRecentes(novosRecentes); localStorage.setItem(DOCUMENT_RECENT_MODELS_KEY, JSON.stringify(novosRecentes));
    setBibliotecaAberta(false); primeiraSecaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function alternarFavorito(modeloId) { const novos = favoritos.includes(modeloId) ? favoritos.filter((id) => id !== modeloId) : [...favoritos, modeloId]; setFavoritos(novos); localStorage.setItem(DOCUMENT_FAVORITES_KEY, JSON.stringify(novos)); }

  async function salvarNomeDoModelo() {
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


  function salvarRascunho() {
    const dataSalvamento = persistirRascunho(dados);
    setSalvoEm(dataSalvamento);
    setDirty(false);
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
    evento?.preventDefault(); setTocados(new Set(modeloSelecionado.campos.map((campo) => campo.nome)));
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
      const novoHistorico = [registro, ...historico.filter((item) => item.id !== registro.id)].slice(0, 20); setHistorico(novoHistorico); localStorage.setItem(DOCUMENT_HISTORY_KEY, JSON.stringify(novoHistorico)); localStorage.removeItem(DOCUMENT_DRAFT_KEY); dirtyRef.current = false; setDirty(false);
      setUsoModelos((atuais) => { const proximo = { ...atuais, [modeloSelecionado.id]: Number(atuais[modeloSelecionado.id] || 0) + 1 }; localStorage.setItem(DOCUMENT_USAGE_KEY, JSON.stringify(proximo)); return proximo; });
      setResultado({ ...registro, arquivos, aviso: arquivamento.aviso || "PDF gerado para download. Arquive o arquivo final na pasta do cliente no Drive.", numeroDocumento }); setPreviewAtualizadaEm(new Date());
      onDocumentoGerado?.({ ...registro, arquivos, aviso: arquivamento.aviso, numeroDocumento, documentoRemoto: registro.documentoRemoto || null, modelo: modeloSelecionado, dados: dadosGeracao });
      onSuccess?.(modeloSelecionado.modo === "procuracao" ? mensagemConjuntoGerado(listarDocumentosProcuracao(dados)) : "Documento PDF gerado com sucesso!");
    } catch (generationError) { console.error(generationError); setErro(generationError instanceof Error ? generationError.message : "Não foi possível gerar o PDF. Revise os dados e tente novamente."); } finally { setGerando(false); }
  }

  async function abrirHistorico(item) { let link = item.link; if (!link && item.storagePath) { const { data } = await supabase.storage.from("documentos-juridicos").createSignedUrl(item.storagePath, 60 * 60); link = data?.signedUrl; } if (link) window.open(link, "_blank", "noopener,noreferrer"); }
  function carregarRegistro(item, novaVersao = false) { const modelo = modelos.find((modeloItem) => modeloItem.id === item.modeloId); if (!modelo) { setErro("Este modelo foi removido da biblioteca e não pode ser reutilizado."); return; } const dadosSalvos = { ...(item.metadata?.dados || {}) }; delete dadosSalvos.nomeDocumento; const versao = novaVersao ? (Number(item.versao) || 1) + 1 : 1; setDados({ ...criarFormularioInicial(responsavel, modelo, departamentoUsuario), ...dadosSalvos, modeloId: modelo.id, versao }); setDirty(true); setBibliotecaAberta(false); primeiraSecaoRef.current?.scrollIntoView({ behavior: "smooth" }); }
  async function copiarLink() { if (!resultado?.link) return; await navigator.clipboard.writeText(resultado.link); onSuccess?.("Link interno copiado."); }
  async function prepararAssinatura() { if (resultado?.id && !String(resultado.id).startsWith("local-")) await supabase.from("documentos_juridicos").update({ status: "Aguardando assinatura" }).eq("id", resultado.id); setResultado((atual) => ({ ...atual, status: "Aguardando assinatura" })); onStatusDocumento?.({ ...resultado, status: "Aguardando assinatura" }); onSuccess?.("Documento marcado como pronto para assinatura."); }

  const razaoBloqueio = pendenciaOriginal || (pendentes.length ? `Preencha os ${pendentes.length} campos obrigatórios pendentes para gerar o PDF.` : declaracaoIrpfInvalida ? "Informe os exercícios e a data da declaração de IRPF." : conflitosFixos.length ? "Resolva as inconsistências fixas do Word original antes de gerar." : "");

  return <section className="legal-doc-workspace" ref={primeiraSecaoRef}>
    {!online ? <div className="legal-doc-offline" role="alert">Sem conexão. O rascunho temporário permanece neste dispositivo por até 24 horas.</div> : null}
    <header className="legal-doc-hero"><div><span className="eyebrow">Platino Workspace Administrativo</span><h1>Gerador de Documentos Jurídicos</h1><p>Selecione um modelo, preencha as informações necessárias e revise o documento antes de gerar o arquivo final.</p></div><div className="legal-doc-hero-badge"><DocumentCategoryIcon name="shield" size={22} /><span><small>Ambiente controlado</small><strong>Documentos rastreáveis</strong></span></div></header>
    <EtapasDocumento etapaAtual={etapaAtual} />
    <div className="legal-doc-layout"><main className="legal-doc-main">
      <FormSection className="legal-doc-section legal-doc-model-selected"><div className="legal-doc-section-heading"><div><span className="eyebrow">Etapa 1</span><h2>Modelo selecionado</h2></div><button type="button" className="legal-doc-change-model" onClick={() => setBibliotecaAberta(true)}><DocumentModelIcon size={20} /><span><strong>Escolher outro modelo</strong><small>Ver todos os modelos disponíveis</small></span><b aria-hidden="true">→</b></button></div><div className="legal-doc-selected-card"><span className="model-card-icon large"><DocumentModelIcon size={46} /></span><div><span>{modeloSelecionado.categoriaNome}</span><h3>{modeloSelecionado.nome}</h3><p>{modeloSelecionado.descricao}</p></div><div className="legal-doc-selected-meta"><span>{modeloSelecionado.campos.filter((campo) => campo.obrigatorio).length} campos obrigatórios</span><span>≈ {modeloSelecionado.minutos} minutos</span></div></div>{modeloSelecionado.revisaoWordPendente ? <div className="legal-doc-template-pending" role="status"><strong>Revisão do Word original pendente</strong><span>{modeloSelecionado.revisaoWordPendente}</span></div> : null}</FormSection>
      <FormSection as="form" onSubmit={(evento) => evento.preventDefault()} noValidate>
        <FormSection className="legal-doc-section"><div className="legal-doc-section-heading"><div><span className="eyebrow">Etapa 2</span><h2>Identificação do arquivo</h2><p>O arquivo é nomeado automaticamente com o modelo escolhido e os dados do cliente.</p></div><span className="legal-doc-required-note">* Campos obrigatórios</span></div>
          <div className="legal-doc-name-suggestion legal-doc-model-name"><div><span>Nome do modelo na biblioteca</span><strong>{modeloSelecionado.nome}</strong><small>Este é o nome que a equipe utiliza para localizar e selecionar este documento.</small></div>{gestor ? <button type="button" className="btn-secondary compact" onClick={() => { setNomeModeloEmEdicao(modeloSelecionado.nome); setEditandoNomeModelo((aberto) => !aberto); }}>{editandoNomeModelo ? "Cancelar" : "Renomear modelo"}</button> : null}</div>
          {gestor && editandoNomeModelo ? <div className="legal-doc-model-name-editor"><FormField className="legal-doc-field wide" htmlFor="nomeModelo"><span>Nome exibido para toda a equipe</span><Input id="nomeModelo" value={nomeModeloEmEdicao} onChange={(evento) => setNomeModeloEmEdicao(evento.target.value)} maxLength="100" placeholder="Ex.: Procuração" /></FormField><button type="button" className="btn-primary compact" disabled={salvandoNomeModelo} onClick={salvarNomeDoModelo}>{salvandoNomeModelo ? "Salvando…" : "Salvar nome"}</button></div> : null}
          <div className="legal-doc-name-suggestion"><div><span>Nome do arquivo gerado automaticamente</span><strong>{nomeSugerido || modeloSelecionado.nome}</strong><small>O nome usa somente o modelo e o cliente.</small></div></div>
          {duplicado ? <div className="legal-doc-duplicate-warning"><span>!</span><div><strong>Já existe um documento com nome semelhante.</strong><p>Ao gerar, será criada automaticamente a Versão {String(versaoSugerida).padStart(2, "0")}.</p></div></div> : null}
          <div className="legal-doc-file-preview"><span>Nome do arquivo</span><code>{nomeArquivo}</code></div>
          <FormGrid className="legal-doc-identification-grid"><section><FormSection as="div" className="legal-doc-subsection-heading"><span>1</span><div><h3>{"Referências principais"}</h3><p>{"A data vem preenchida com hoje e pode ser ajustada quando necessário."}</p></div></FormSection><FormGrid className="legal-doc-control-grid compact"><FormField className="legal-doc-field"><span>{"Data de emissão *"}</span><Input type="date" name="dataEmissao" value={dados.dataEmissao || ""} onChange={atualizarCampo} required /></FormField></FormGrid></section></FormGrid>
          <details className="legal-doc-control-details"><summary><span>Informações de controle e arquivamento</span><small>Opcional — abrir somente quando precisar</small></summary><FormGrid className="legal-doc-control-grid"><FormField className="legal-doc-field"><span>Número do processo</span><Input name="numeroProcesso" value={dados.numeroProcesso || ""} onChange={atualizarCampo} /></FormField><FormField className="legal-doc-field"><span>Responsável pela geração</span><Input value={responsavel || ""} readOnly /></FormField><FormField className="legal-doc-field"><span>Departamento</span><Select name="departamento" value={dados.departamento || ""} onChange={atualizarCampo}><option>Administrativo</option><option>Jurídico</option><option>Processual</option><option>Supervisão</option></Select></FormField><FormField className="legal-doc-field wide"><span>Observação interna</span><Textarea name="observacaoInterna" value={dados.observacaoInterna || ""} onChange={atualizarCampo} rows="3" placeholder="Contexto interno opcional. Este texto não será incluído no documento." /></FormField></FormGrid><div className="legal-doc-destination"><FormField><Input type="checkbox" name="salvarNaPasta" checked={Boolean(dados.salvarNaPasta)} onChange={atualizarCampo} /><span><strong>Vincular esta geração ao cadastro do cliente</strong><small>Opcional. O arquivo final continuará disponível para download e deverá ser salvo na pasta indicada.</small></span></FormField><div><span>Destino</span><Input name="destino" value={dados.destino || ""} onChange={atualizarCampo} aria-label="Destino de arquivamento" /></div></div></details>
        </FormSection>
        <FormSection className="legal-doc-section"><div className="legal-doc-section-heading"><div><span className="eyebrow">Etapa 3</span><h2>Dados necessários para este modelo</h2><p>Os campos estão agrupados. Abra uma seção de cada vez e preencha somente o que for necessário.</p></div></div>{grupos.map((grupo, indice) => <GrupoCampos key={`${modeloSelecionado.id}-${grupo.id}`} grupo={grupo} dados={dados} tocados={tocados} onChange={atualizarCampo} onBlur={marcarTocado} modeloId={modeloSelecionado.id} abertoInicial={indice === 0} />)}
          {modeloSelecionado.modo === "procuracao" ? <section className="legal-doc-bundle"><div><span className="eyebrow">Conjunto documental</span><h3>Gerar declarações com a Procuração</h3><p>Os mesmos dados serão reutilizados nos arquivos selecionados.</p></div><FormField><Input type="checkbox" name="gerarHipossuficiencia" checked={Boolean(dados.gerarHipossuficiencia)} onChange={atualizarCampo} /><span><strong>Declaração de Hipossuficiência</strong><small>Justiça gratuita</small></span></FormField><FormField><Input type="checkbox" name="gerarIsencaoIrpf" checked={Boolean(dados.gerarIsencaoIrpf)} onChange={atualizarCampo} /><span><strong>Declaração de Isenção de IRPF</strong><small>Isenção de imposto de renda</small></span></FormField>{dados.gerarIsencaoIrpf ? <><FormField className="legal-doc-field"><span>Exercícios da isenção *</span><Input id="exercicios-conjunto" name="exercicios" value={dados.exercicios || ""} onChange={atualizarCampo} placeholder="2023, 2024 e 2025" /></FormField><FormField className="legal-doc-field"><span>Data da declaração de IRPF *</span><Input type="date" name="dataDocumentoIrpf" value={dados.dataDocumentoIrpf || ""} onChange={atualizarCampo} /></FormField></> : null}<p>{documentosProcuracao.length} {documentosProcuracao.length === 1 ? "arquivo PDF será gerado" : "arquivos PDF serão gerados"}.</p></section> : null}
          {conflitosFixos.length ? <section className="legal-doc-conflicts" role="alert"><strong>Geração bloqueada por inconsistência no Word original</strong><p>O sistema não alterou os trechos fixos e não emitirá um documento contraditório.</p><ul>{conflitosFixos.map((conflito, indice) => <li key={`${conflito.modeloId}-${conflito.campo}-${indice}`}>{conflito.modeloNome}: {conflito.mensagem}</li>)}</ul></section> : null}
        </FormSection>
        <div className="legal-doc-support-grid"><PainelProgresso total={obrigatorios.length} preenchidos={preenchidos} pendentes={pendentes} onVerPendentes={() => pendentes[0] && focarCampo(pendentes[0].nome)} /><AssistentePreenchimento dados={dados} pendentes={pendentes} errosVisiveis={errosVisiveis} onCorrigir={focarCampo} /></div>{erro ? <p className="legal-doc-form-error" role="alert">{erro}</p> : null}
        <div className="legal-doc-action-bar"><div><button type="button" className="btn-secondary" onClick={salvarRascunho}>Salvar rascunho por 24h</button><button type="button" className="legal-doc-cancel" onClick={cancelarEdicao}>Cancelar</button>{salvoEm ? <span className={online ? "saved" : "offline"}>Rascunho temporário salvo às {salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span> : null}</div><div><button type="button" className="btn-secondary" onClick={() => setPreviewFullscreen(true)}>Revisar documento</button><span className="legal-doc-generate-wrap"><button type="button" className="btn-primary" disabled={!podeGerar} onClick={() => handleGerarPdf()}>{gerando ? "Gerando PDFs…" : `Gerar ${modeloSelecionado.modo === "procuracao" ? `${documentosProcuracao.length} ` : ""}PDF${modeloSelecionado.modo === "procuracao" && documentosProcuracao.length > 1 ? "s" : ""}`}</button>{razaoBloqueio ? <small>{razaoBloqueio}</small> : null}</span></div></div>
      </FormSection>
    </main><aside className="legal-doc-preview-column"><PainelPrevia modelo={modeloSelecionado} nomeDocumento={nomeSugerido} numeroDocumento={numeroDocumento} atualizadoEm={previewAtualizadaEm} gerando={gerando || previewPdfGerando} pdfUrl={previewPdfUrl} erroPrevia={previewPdfErro} onFullscreen={() => setPreviewFullscreen(true)} onRefresh={() => setPreviewVersao((versao) => versao + 1)} /></aside></div>
    <DocumentosRecentes documentos={historico} busca={buscaHistorico} onBusca={setBuscaHistorico} onOpen={abrirHistorico} onDuplicate={(item) => carregarRegistro(item, false)} onVersion={(item) => carregarRegistro(item, true)} />
    <ModelLibraryModal aberto={bibliotecaAberta} modelos={modelos} selecionadoId={modeloSelecionado.id} favoritos={favoritos} recentes={modelosRecentes} onClose={() => setBibliotecaAberta(false)} onSelect={selecionarModelo} onToggleFavorite={alternarFavorito} />
    {previewFullscreen ? <div className="legal-doc-fullscreen-backdrop"><PainelPrevia fullscreen modelo={modeloSelecionado} nomeDocumento={nomeSugerido} numeroDocumento={numeroDocumento} atualizadoEm={previewAtualizadaEm} gerando={gerando || previewPdfGerando} pdfUrl={previewPdfUrl} erroPrevia={previewPdfErro} onFullscreen={() => setPreviewFullscreen(false)} onRefresh={() => setPreviewVersao((versao) => versao + 1)} /></div> : null}
    <ModalSucesso resultado={resultado} onClose={() => setResultado(null)} onDownload={baixarResultadoELimpar} onOpen={() => window.open(resultado.arquivos[0].url, "_blank", "noopener,noreferrer")} onCopy={copiarLink} onSignature={prepararAssinatura} onLibrary={() => { setResultado(null); setBibliotecaAberta(true); }} onAnother={() => { setResultado(null); setDados((atual) => ({ ...atual, versao: 1 })); setDirty(true); }} />
  </section>;
}


