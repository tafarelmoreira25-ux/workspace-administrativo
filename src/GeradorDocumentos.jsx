import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ModelLibraryModal, { DocumentCategoryIcon } from "./components/documentos/ModelLibraryModal";
import {
  DOCUMENT_DRAFT_KEY, DOCUMENT_FAVORITES_KEY, DOCUMENT_HISTORY_KEY,
  DOCUMENT_RECENT_MODELS_KEY, DOCUMENT_WORKSPACE_SCHEMA, agruparCampos,
  enriquecerModelos, erroCampo, formatarValorCampo, normalizarBusca,
  normalizarNomeArquivo, proximaVersao, sugerirNomeDocumento,
} from "./lib/documentWorkspace";
import { criarOpcoesIniciaisProcuracao, listarDocumentosProcuracao, mensagemConjuntoGerado } from "./lib/procuracaoConjunto";
import { supabase } from "./lib/supabase";
import { DOCUMENT_TEMPLATES, valorInicialCampo } from "./config/documentTemplates";
import "./documentWorkspace.css";

const MODELOS = enriquecerModelos(DOCUMENT_TEMPLATES);
const PADRAO_NOME_INICIAL = { tipo: true, cliente: true, contrato: true, processo: false, cpf: false, data: true, numero: false, versao: true };

function dataLocalIso() {
  const hoje = new Date();
  return new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function destinoPadrao(modelo) {
  const pastas = { procuracoes: "PROCURAÇÕES", declaracoes: "DECLARAÇÕES", notificacoes: "NOTIFICAÇÕES_E_INTIMAÇÕES", contestacoes: "CONTESTAÇÕES", termos: "TERMOS", relatorios: "RELATÓRIOS", "recibos-certidoes": "RECIBOS_E_CERTIDÕES" };
  return `07_JURIDICO_PROCESSUAL / ${pastas[modelo.categoria] || "DOCUMENTOS"}`;
}

function criarFormularioInicial(responsavel, modelo = MODELOS[0], departamento = "Jurídico") {
  const hoje = dataLocalIso();
  const camposDoModelo = Object.fromEntries(modelo.campos.map((campo) => [campo.nome, campo.valorInicial === "responsavel" ? responsavel || "" : valorInicialCampo(campo, hoje)]));
  return {
    modeloId: modelo.id, tipo: modelo.nome, titulo: modelo.titulo || modelo.nome,
    nomeDocumento: "", dataEmissao: hoje, clienteVinculadoId: "", clienteVinculado: "",
    responsavel: responsavel || "", departamento: departamento || "Jurídico",
    destino: destinoPadrao(modelo), observacaoInterna: "", salvarNaPasta: true, versao: 1,
    ...camposDoModelo,
    ...(modelo.modo === "procuracao" ? criarOpcoesIniciaisProcuracao(hoje) : {}),
  };
}

function lerJsonLocal(chave, fallback) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? fallback; } catch { return fallback; }
}

function carregarRascunho(responsavel, departamento) {
  const salvo = lerJsonLocal(DOCUMENT_DRAFT_KEY, null);
  return salvo?.schema === DOCUMENT_WORKSPACE_SCHEMA && salvo.dados?.modeloId ? salvo.dados : criarFormularioInicial(responsavel, MODELOS[0], departamento);
}

function formatarDataHora(data) {
  if (!data) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data));
}

function criarArquivo(tipo, nome, bytes) {
  return { tipo, nome, bytes, url: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })) };
}

async function gerarArquivos(dados, modelo) {
  const base = normalizarNomeArquivo(dados.nomeDocumento || modelo.nome).replace(/\.pdf$/i, "");
  if (modelo.modo === "procuracao") {
    const { gerarProcuracaoPdf } = await import("./lib/procuracaoPdf");
    const { gerarDeclaracaoHipossuficienciaPdf, gerarDeclaracaoIsencaoIrpfPdf } = await import("./lib/declaracoesPdf");
    const documentos = listarDocumentosProcuracao(dados);
    const geradores = { procuracao: () => gerarProcuracaoPdf(dados), hipossuficiencia: () => gerarDeclaracaoHipossuficienciaPdf(dados), "isencao-irpf": () => gerarDeclaracaoIsencaoIrpfPdf(dados) };
    const nomes = { procuracao: `${base}.pdf`, hipossuficiencia: `${base}_Declaracao_Hipossuficiencia.pdf`, "isencao-irpf": `${base}_Declaracao_Isencao_IRPF.pdf` };
    return Promise.all(documentos.map(async (tipo) => criarArquivo(tipo, nomes[tipo], await geradores[tipo]())));
  }
  let bytes;
  if (modelo.modo === "notificacao-extrajudicial") {
    const { gerarNotificacaoExtrajudicialPdf } = await import("./lib/notificacaoExtrajudicialPdf"); bytes = await gerarNotificacaoExtrajudicialPdf(dados);
  } else if (modelo.modo === "contestacao-taxas-email") {
    const { gerarContestacaoTaxasEmailPdf } = await import("./lib/contestacaoTaxasEmailPdf"); bytes = await gerarContestacaoTaxasEmailPdf(dados);
  } else if (modelo.modo === "citacao-judicial") {
    const { gerarCitacaoJudicialPdf } = await import("./lib/citacaoJudicialPdf"); bytes = await gerarCitacaoJudicialPdf(dados);
  } else if (modelo.modo === "intimacao-extrajudicial") {
    const { gerarIntimacaoExtrajudicialPdf } = await import("./lib/intimacaoExtrajudicialPdf"); bytes = await gerarIntimacaoExtrajudicialPdf(dados);
  } else if (modelo.modo === "chargeback") {
    const { gerarChargebackPdf } = await import("./lib/chargebackPdf"); bytes = await gerarChargebackPdf(dados);
  } else if (modelo.modo === "termo-compromisso-pagamento") {
    const { gerarTermoCompromissoPagamentoPdf } = await import("./lib/termoCompromissoPagamentoPdf"); bytes = await gerarTermoCompromissoPagamentoPdf(dados);
  } else if (modelo.modo === "termo-ciencia-pagamento") {
    const { gerarTermoCienciaPagamentoPdf } = await import("./lib/termoCienciaPagamentoPdf"); bytes = await gerarTermoCienciaPagamentoPdf(dados);
  } else if (modelo.modo === "termo-ciencia-seguranca") {
    const { gerarTermoCienciaSegurancaPdf } = await import("./lib/termoCienciaSegurancaPdf"); bytes = await gerarTermoCienciaSegurancaPdf(dados);
  } else if (modelo.modo === "declaracao-ausencia-carteira-trabalho") {
    const { gerarDeclaracaoAusenciaCarteiraTrabalhoPdf } = await import("./lib/declaracaoAusenciaCarteiraTrabalhoPdf"); bytes = await gerarDeclaracaoAusenciaCarteiraTrabalhoPdf(dados);
  } else if (["certidao-diligencia", "recibo-prestacao-servicos", "relatorio-negociacao-homologacao", "termo-recompra"].includes(modelo.modo)) {
    const { gerarModeloComplementarPdf } = await import("./lib/modelosComplementaresPdf"); bytes = await gerarModeloComplementarPdf(dados, modelo);
  } else {
    const { gerarDeclaracaoHipossuficienciaPdf, gerarDeclaracaoIsencaoIrpfPdf } = await import("./lib/declaracoesPdf");
    bytes = modelo.modo === "declaracao-hipossuficiencia" ? await gerarDeclaracaoHipossuficienciaPdf(dados) : await gerarDeclaracaoIsencaoIrpfPdf(dados);
  }
  return [criarArquivo(modelo.modo, `${base}.pdf`, bytes)];
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

function CampoDocumento({ campo, valor, erro, importado, onChange, onBlur }) {
  const inputId = `doc-field-${campo.nome}`;
  const props = { id: inputId, name: campo.nome, value: valor || "", onChange, onBlur, required: campo.obrigatorio, "aria-invalid": Boolean(erro), "aria-describedby": erro ? `${inputId}-error` : undefined };
  return <label className={`legal-doc-field ${campo.largura === "total" ? "wide" : ""} ${erro ? "invalid" : ""} ${importado ? "imported" : ""}`} htmlFor={inputId}><span className="legal-doc-label-row"><span>{campo.rotulo}{campo.obrigatorio ? " *" : ""}</span>{importado ? <small>✓ Importado do cliente</small> : null}</span>{campo.tipo === "textarea" ? <textarea {...props} rows="4" placeholder={campo.placeholder} /> : campo.tipo === "select" ? <select {...props}>{campo.opcoes.map((opcao) => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}</select> : <input {...props} type={campo.tipo || "text"} placeholder={campo.placeholder} min={campo.min} />}{erro ? <small className="legal-doc-field-error" id={`${inputId}-error`}>{erro}</small> : null}</label>;
}

function GrupoCampos({ grupo, dados, tocados, importados, onChange, onBlur, modeloId }) {
  const [aberto, setAberto] = useState(true);
  const obrigatorios = grupo.campos.filter((campo) => campo.obrigatorio);
  const preenchidos = obrigatorios.filter((campo) => !erroCampo(campo, dados[campo.nome])).length;
  return <section className={`legal-doc-field-group ${aberto ? "open" : ""}`}><button type="button" className="legal-doc-field-group-toggle" onClick={() => setAberto((valor) => !valor)} aria-expanded={aberto}><span><strong>{grupo.titulo}</strong><small>{preenchidos} de {obrigatorios.length} obrigatórios preenchidos</small></span><span className="legal-doc-group-progress"><i style={{ width: `${obrigatorios.length ? (preenchidos / obrigatorios.length) * 100 : 100}%` }} /></span><b aria-hidden="true">⌄</b></button>{aberto ? <div className="legal-doc-fields-grid" key={modeloId}>{grupo.campos.map((campo) => <CampoDocumento key={campo.nome} campo={campo} valor={dados[campo.nome]} erro={tocados.has(campo.nome) ? erroCampo(campo, dados[campo.nome]) : ""} importado={importados.has(campo.nome)} onChange={onChange} onBlur={onBlur} />)}</div> : null}</section>;
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
  const orientacoes = [aviso, !dados.clienteVinculadoId ? { tom: "info", titulo: "Vincule um cliente", texto: "Pesquise o cadastro para importar informações e melhorar a rastreabilidade." } : { tom: "success", titulo: "Cliente vinculado", texto: `${dados.clienteVinculado} está associado a este documento.` }, { tom: "info", titulo: "Conferência recomendada", texto: dados.numeroContrato ? "Revise o número do contrato antes de gerar o arquivo final." : "Inclua contrato ou processo no nome quando essa referência estiver disponível." }];
  return <section className="legal-doc-assistant"><div className="legal-doc-section-title"><span><DocumentCategoryIcon name="shield" size={20} /></span><div><span className="eyebrow">Apoio contextual</span><h3>Assistente de preenchimento</h3></div></div><div className="legal-doc-advice-list">{orientacoes.map((item) => <article className={`legal-doc-advice ${item.tom}`} key={item.titulo}><span aria-hidden="true">{item.tom === "success" ? "✓" : item.tom === "info" ? "i" : "!"}</span><div><strong>{item.titulo}</strong><p>{item.texto}</p>{item.campo ? <button type="button" onClick={() => onCorrigir(item.campo)}>Corrigir agora</button> : null}</div></article>)}</div></section>;
}

function PaginaPrevia({ modelo, dados, numeroDocumento, zoom }) {
  const essenciais = modelo.campos.filter((campo) => dados[campo.nome]).slice(0, 7);
  return <div className="legal-doc-preview-viewport"><div className="legal-doc-paper" style={{ "--preview-zoom": zoom }}><div className="legal-doc-paper-accent" /><div className="legal-doc-paper-header"><span>PLATINO</span><small>DOCUMENTO JURÍDICO</small></div><h3>{modelo.titulo || modelo.nome}</h3><div className="legal-doc-paper-rule" />{essenciais.length < 2 ? <p className="legal-doc-preview-placeholder">Complete os campos essenciais para liberar uma prévia mais fiel.</p> : <div className="legal-doc-paper-content"><p><strong>{dados.nomeCliente || dados.banco || modelo.nome}</strong></p>{essenciais.map((campo) => <p key={campo.nome}><b>{campo.rotulo}:</b> {dados[campo.nome]}</p>)}<p>O presente documento é emitido com base nas informações registradas no Platino Workspace Administrativo.</p></div>}<div className="legal-doc-paper-signature"><i /><strong>{dados.nomeCliente || "Assinatura do cliente"}</strong></div><small className="legal-doc-paper-number">Documento {numeroDocumento}</small></div></div>;
}

function PainelPrevia({ modelo, dados, numeroDocumento, atualizadoEm, gerando, fullscreen, onFullscreen, onRefresh }) {
  const [zoom, setZoom] = useState(0.78);
  return <section className={`legal-doc-preview-panel ${fullscreen ? "fullscreen" : ""}`}><header><div><span className="eyebrow">Prévia — sem validade jurídica</span><h3>{dados.nomeDocumento || modelo.nome}</h3><p>{modelo.nome} · {numeroDocumento}</p></div>{fullscreen ? <button type="button" className="legal-doc-preview-close" onClick={onFullscreen} aria-label="Fechar prévia">×</button> : null}</header><div className="legal-doc-preview-status"><span className={gerando ? "loading" : "ready"}>{gerando ? "Atualizando" : "Rascunho"}</span><small>Atualizada {formatarDataHora(atualizadoEm)}</small></div><div className="legal-doc-preview-tools"><button type="button" onClick={() => setZoom((valor) => Math.max(.58, valor - .1))} aria-label="Diminuir zoom">−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((valor) => Math.min(1.08, valor + .1))} aria-label="Aumentar zoom">+</button><i /><button type="button" onClick={onRefresh}>↻ <span>Atualizar</span></button><button type="button" onClick={onFullscreen}>⛶ <span>Tela cheia</span></button></div><div className="legal-doc-preview-render">{gerando ? <div className="legal-doc-preview-skeleton" aria-label="Atualizando prévia"><span /><span /><span /><span /><span /></div> : null}<PaginaPrevia modelo={modelo} dados={dados} numeroDocumento={numeroDocumento} zoom={zoom} /></div><footer><button type="button" disabled aria-label="Página anterior">‹</button><span>Página 1 de 1</span><button type="button" disabled aria-label="Próxima página">›</button></footer></section>;
}

function ModalSucesso({ resultado, onClose, onDownload, onOpen, onCopy, onSignature, onLibrary, onAnother }) {
  if (!resultado) return null;
  return <div className="legal-doc-success-backdrop"><section className="legal-doc-success-modal" role="dialog" aria-modal="true" aria-labelledby="success-title"><button type="button" className="model-library-close" onClick={onClose} aria-label="Fechar confirmação">×</button><span className="legal-doc-success-icon">✓</span><span className="eyebrow">Geração concluída</span><h2 id="success-title">Documento gerado com sucesso</h2><p>{resultado.arquivos.length} {resultado.arquivos.length === 1 ? "arquivo foi preparado" : "arquivos foram preparados"} para conferência e download.</p>{resultado.aviso ? <div className="legal-doc-archive-warning">{resultado.aviso}</div> : null}<dl className="legal-doc-success-details"><div><dt>Documento</dt><dd>{resultado.nomeDocumento}</dd></div><div><dt>Cliente</dt><dd>{resultado.cliente || "Não vinculado"}</dd></div><div><dt>Data e horário</dt><dd>{formatarDataHora(resultado.criadoEm)}</dd></div><div><dt>Responsável</dt><dd>{resultado.responsavel}</dd></div><div><dt>Número</dt><dd>{resultado.numeroDocumento}</dd></div><div><dt>Versão</dt><dd>{String(resultado.versao).padStart(2, "0")}</dd></div><div className="wide"><dt>Destino</dt><dd>{resultado.destino}</dd></div><div><dt>Status</dt><dd><span className="legal-doc-status-pill">{resultado.status}</span></dd></div></dl><div className="legal-doc-success-actions primary"><button type="button" className="btn-primary" onClick={onOpen}>Abrir documento</button><button type="button" className="btn-secondary" onClick={onDownload}>Baixar PDF{resultado.arquivos.length > 1 ? "s" : ""}</button><button type="button" className="btn-secondary" onClick={onCopy} disabled={!resultado.link}>Copiar link</button><button type="button" className="btn-secondary" onClick={onSignature}>Enviar para assinatura</button></div><div className="legal-doc-success-actions secondary"><button type="button" onClick={onLibrary}>Voltar à biblioteca</button><button type="button" onClick={onAnother}>Gerar outro documento com estes dados</button></div></section></div>;
}

function DocumentosRecentes({ documentos, busca, onBusca, onOpen, onDuplicate, onVersion }) {
  const termo = normalizarBusca(busca);
  const filtrados = documentos.filter((item) => !termo || normalizarBusca(`${item.nomeDocumento} ${item.modeloNome} ${item.cliente} ${item.responsavel}`).includes(termo));
  return <section className="legal-doc-recent-section"><div className="legal-doc-recent-heading"><div><span className="eyebrow">Rastreabilidade</span><h2>Documentos recentes</h2><p>Últimas gerações registradas neste workspace.</p></div><label><span>⌕</span><input type="search" value={busca} onChange={(evento) => onBusca(evento.target.value)} placeholder="Pesquisar no histórico…" /></label></div>{filtrados.length === 0 ? <div className="legal-doc-recent-empty"><DocumentCategoryIcon name="clock" size={25} /><strong>Nenhum documento recente</strong><p>Os arquivos gerados aparecerão aqui com versão, responsável e destino.</p></div> : <div className="legal-doc-recent-list">{filtrados.slice(0, 8).map((item) => <article key={item.id}><span className="model-card-icon"><DocumentCategoryIcon name={item.icone || "file"} size={20} /></span><div><strong>{item.nomeDocumento}</strong><p>{item.modeloNome} · {item.cliente || "Cliente não vinculado"}</p><small>{formatarDataHora(item.criadoEm)} · {item.responsavel} · Versão {String(item.versao || 1).padStart(2, "0")}</small></div><span className="legal-doc-history-status">{item.status || "Gerado"}</span><div className="legal-doc-history-actions"><button type="button" onClick={() => onOpen(item)} disabled={!item.link && !item.storagePath}>Abrir</button><button type="button" onClick={() => onDuplicate(item)}>Duplicar</button><button type="button" onClick={() => onVersion(item)}>Nova versão</button></div></article>)}</div>}</section>;
}

export default function GeradorDocumentos({ responsavel, usuario, onSuccess }) {
  const departamentoUsuario = usuario?.setor || usuario?.departamento || "Jurídico";
  const [dados, setDados] = useState(() => carregarRascunho(responsavel, departamentoUsuario));
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false);
  const [configNomeAberta, setConfigNomeAberta] = useState(false);
  const [padraoNome, setPadraoNome] = useState(PADRAO_NOME_INICIAL);
  const [favoritos, setFavoritos] = useState(() => lerJsonLocal(DOCUMENT_FAVORITES_KEY, []));
  const [modelosRecentes, setModelosRecentes] = useState(() => lerJsonLocal(DOCUMENT_RECENT_MODELS_KEY, []));
  const [clientes, setClientes] = useState([]);
  const [clientesCarregando, setClientesCarregando] = useState(true);
  const [clientesErro, setClientesErro] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clienteBuscaAberta, setClienteBuscaAberta] = useState(false);
  const [camposImportados, setCamposImportados] = useState(() => new Set());
  const [tocados, setTocados] = useState(() => new Set());
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [dirty, setDirty] = useState(false);
  const [salvoEm, setSalvoEm] = useState(() => new Date());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [previewAtualizadaEm, setPreviewAtualizadaEm] = useState(() => new Date());
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState(() => lerJsonLocal(DOCUMENT_HISTORY_KEY, []));
  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [sufixoDocumento] = useState(() => String(Date.now()).slice(-5));
  const primeiraSecaoRef = useRef(null);

  const modeloSelecionado = MODELOS.find((modelo) => modelo.id === dados.modeloId) || MODELOS[0];
  const numeroDocumento = useMemo(() => `${dados.dataEmissao?.replaceAll("-", "") || "sem-data"}-${sufixoDocumento}`, [dados.dataEmissao, sufixoDocumento]);
  const grupos = useMemo(() => agruparCampos(modeloSelecionado.campos), [modeloSelecionado]);
  const obrigatorios = modeloSelecionado.campos.filter((campo) => campo.obrigatorio);
  const pendentes = obrigatorios.filter((campo) => erroCampo(campo, dados[campo.nome]));
  const preenchidos = obrigatorios.length - pendentes.length;
  const errosVisiveis = modeloSelecionado.campos.map((campo) => ({ campo, erro: erroCampo(campo, dados[campo.nome]) })).filter((item) => item.erro && tocados.has(item.campo.nome));
  const nomeSugerido = sugerirNomeDocumento(modeloSelecionado, dados, padraoNome, numeroDocumento, dados.versao);
  const nomeArquivo = normalizarNomeArquivo(dados.nomeDocumento || nomeSugerido || modeloSelecionado.nome);
  const versaoSugerida = proximaVersao(dados.nomeDocumento, historico);
  const duplicado = Boolean(dados.nomeDocumento && versaoSugerida > Number(dados.versao || 1));
  const identificacaoCompleta = Boolean(dados.nomeDocumento?.trim() && dados.dataEmissao);
  const declaracaoIrpfInvalida = modeloSelecionado.modo === "procuracao" && dados.gerarIsencaoIrpf && !String(dados.exercicios || "").trim();
  const podeGerar = identificacaoCompleta && pendentes.length === 0 && !declaracaoIrpfInvalida && !gerando;
  const etapaAtual = !identificacaoCompleta ? 2 : pendentes.length || declaracaoIrpfInvalida ? 3 : 4;
  const documentosProcuracao = modeloSelecionado.modo === "procuracao" ? listarDocumentosProcuracao(dados) : [];
  const clientesFiltrados = clientes.filter((cliente) => !normalizarBusca(buscaCliente) || normalizarBusca(`${cliente.nome} ${cliente.cpf || ""} ${cliente.codigo_interno || ""}`).includes(normalizarBusca(buscaCliente))).slice(0, 6);

  const focarCampo = useCallback((nome) => {
    setTocados((atuais) => new Set([...atuais, nome]));
    window.setTimeout(() => { const campo = document.getElementById(`doc-field-${nome}`); campo?.scrollIntoView({ behavior: "smooth", block: "center" }); campo?.focus(); }, 80);
  }, []);

  useEffect(() => {
    let ativo = true;
    Promise.allSettled([supabase.rpc("listar_clientes_central"), supabase.from("documentos_juridicos").select("*").order("created_at", { ascending: false }).limit(12)]).then(([clientesResultado, historicoResultado]) => {
      if (!ativo) return;
      if (clientesResultado.status === "fulfilled" && !clientesResultado.value.error) setClientes(clientesResultado.value.data || []); else setClientesErro("Não foi possível consultar os clientes agora. Você ainda pode preencher os dados manualmente.");
      if (historicoResultado.status === "fulfilled" && !historicoResultado.value.error) {
        const remotos = (historicoResultado.value.data || []).map((item) => ({ id: item.id, nomeDocumento: item.nome_documento, modeloId: item.modelo_id, modeloNome: item.modelo_nome, cliente: item.cliente_nome, responsavel: item.responsavel_nome, criadoEm: item.created_at, versao: item.versao, status: item.status, destino: item.destino, storagePath: item.arquivo_principal_path, metadata: item.metadata }));
        setHistorico((locais) => [...remotos, ...locais.filter((local) => !remotos.some((remoto) => remoto.id === local.id))].slice(0, 20));
      }
      setClientesCarregando(false);
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
    const temporizador = window.setTimeout(() => { localStorage.setItem(DOCUMENT_DRAFT_KEY, JSON.stringify({ schema: DOCUMENT_WORKSPACE_SCHEMA, dados, salvoEm: new Date().toISOString() })); setSalvoEm(new Date()); setDirty(false); }, 700);
    return () => window.clearTimeout(temporizador);
  }, [dados, dirty]);

  useEffect(() => () => { resultado?.arquivos?.forEach((arquivo) => URL.revokeObjectURL(arquivo.url)); }, [resultado]);

  function atualizarDados(parcial, importados = []) { setDados((atual) => ({ ...atual, ...parcial })); if (importados.length) setCamposImportados(new Set(importados)); setDirty(true); setErro(""); setPreviewAtualizadaEm(new Date()); }
  function atualizarCampo(evento) { const { name, type, value, checked } = evento.target; atualizarDados({ [name]: type === "checkbox" ? checked : formatarValorCampo(name, value) }); setTocados((atuais) => new Set([...atuais, name])); }
  function marcarTocado(evento) { setTocados((atuais) => new Set([...atuais, evento.target.name])); }

  function selecionarModelo(modelo) {
    if (modelo.id !== modeloSelecionado.id && dirty && !window.confirm("Trocar o modelo? Os campos específicos do documento atual serão substituídos, mas os dados comuns serão preservados.")) return;
    const inicial = criarFormularioInicial(responsavel, modelo, departamentoUsuario);
    modelo.campos.forEach((campo) => { if (dados[campo.nome]) inicial[campo.nome] = dados[campo.nome]; });
    Object.assign(inicial, { nomeDocumento: "", clienteVinculadoId: dados.clienteVinculadoId || "", clienteVinculado: dados.clienteVinculado || "", observacaoInterna: dados.observacaoInterna || "" });
    atualizarDados(inicial); setTocados(new Set()); setCamposImportados(new Set());
    const novosRecentes = [modelo.id, ...modelosRecentes.filter((id) => id !== modelo.id)].slice(0, 6); setModelosRecentes(novosRecentes); localStorage.setItem(DOCUMENT_RECENT_MODELS_KEY, JSON.stringify(novosRecentes));
    setBibliotecaAberta(false); primeiraSecaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function alternarFavorito(modeloId) { const novos = favoritos.includes(modeloId) ? favoritos.filter((id) => id !== modeloId) : [...favoritos, modeloId]; setFavoritos(novos); localStorage.setItem(DOCUMENT_FAVORITES_KEY, JSON.stringify(novos)); }

  function selecionarCliente(cliente) {
    const parcial = { clienteVinculadoId: cliente.id, clienteVinculado: cliente.nome, nomeCliente: cliente.nome || dados.nomeCliente, cpfCnpj: cliente.cpf || dados.cpfCnpj, numeroContrato: cliente.numero_contrato || dados.numeroContrato, numeroProcesso: cliente.numero_processo || dados.numeroProcesso, departamento: cliente.departamento_atual || dados.departamento, destino: cliente.pasta_drive_nome || dados.destino };
    const importados = ["nomeCliente", cliente.cpf && "cpfCnpj", cliente.numero_contrato && "numeroContrato", cliente.numero_processo && "numeroProcesso"].filter(Boolean);
    atualizarDados(parcial, importados); setBuscaCliente(cliente.nome); setClienteBuscaAberta(false);
  }

  function salvarRascunho() { localStorage.setItem(DOCUMENT_DRAFT_KEY, JSON.stringify({ schema: DOCUMENT_WORKSPACE_SCHEMA, dados, salvoEm: new Date().toISOString() })); setSalvoEm(new Date()); setDirty(false); onSuccess?.("Rascunho salvo neste dispositivo."); }
  function cancelarEdicao() { if (!window.confirm("Descartar as alterações deste documento?")) return; localStorage.removeItem(DOCUMENT_DRAFT_KEY); setDados(criarFormularioInicial(responsavel, modeloSelecionado, departamentoUsuario)); setTocados(new Set()); setCamposImportados(new Set()); setDirty(false); }

  async function arquivarNoSupabase(arquivos, registro) {
    if (!dados.salvarNaPasta) return { registro, aviso: "O salvamento automático foi desativado; os arquivos estão disponíveis apenas para download nesta sessão." };
    const clientePasta = String(dados.clienteVinculadoId || "sem-cliente"); const ano = dados.dataEmissao?.slice(0, 4) || String(new Date().getFullYear()); const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; const paths = [];
    for (const arquivo of arquivos) { const path = `${clientePasta}/${ano}/${nonce}-${arquivo.nome}`; const { error: uploadError } = await supabase.storage.from("documentos-juridicos").upload(path, arquivo.bytes, { contentType: "application/pdf", upsert: false }); if (uploadError) throw uploadError; paths.push(path); }
    const { data: salvo, error: salvarError } = await supabase.from("documentos_juridicos").insert({ nome_documento: registro.nomeDocumento, nome_arquivo: arquivos[0].nome, modelo_id: registro.modeloId, modelo_nome: registro.modeloNome, categoria: modeloSelecionado.categoriaNome, cliente_id: dados.clienteVinculadoId || null, cliente_nome: registro.cliente || null, cpf_cnpj: dados.cpfCnpj || null, numero_contrato: dados.numeroContrato || null, numero_processo: dados.numeroProcesso || null, responsavel_nome: registro.responsavel, departamento: dados.departamento || null, destino: dados.destino || null, versao: registro.versao, status: "gerado", arquivo_principal_path: paths[0], arquivos_paths: paths, metadata: { dados, arquivos: arquivos.map((arquivo) => arquivo.nome) } }).select("id").single();
    if (salvarError) throw salvarError;
    const { data: assinatura } = await supabase.storage.from("documentos-juridicos").createSignedUrl(paths[0], 60 * 60);
    return { registro: { ...registro, id: salvo.id, storagePath: paths[0], link: assinatura?.signedUrl || "" }, aviso: "" };
  }

  async function handleGerarPdf(evento) {
    evento?.preventDefault(); setTocados(new Set(modeloSelecionado.campos.map((campo) => campo.nome)));
    if (!dados.nomeDocumento?.trim()) { setErro("Informe um nome claro para identificar o documento."); document.getElementById("nomeDocumento")?.focus(); return; }
    if (pendentes.length) { setErro(`Preencha ${pendentes.length} ${pendentes.length === 1 ? "campo obrigatório pendente" : "campos obrigatórios pendentes"}.`); focarCampo(pendentes[0].nome); return; }
    if (declaracaoIrpfInvalida) { setErro("Informe os exercícios da declaração de isenção de Imposto de Renda."); document.getElementById("exercicios-conjunto")?.focus(); return; }
    setGerando(true); setErro("");
    try {
      const arquivos = await gerarArquivos(dados, modeloSelecionado); const criadoEm = new Date().toISOString();
      const registroBase = { id: `local-${Date.now()}`, nomeDocumento: dados.nomeDocumento, modeloId: modeloSelecionado.id, modeloNome: modeloSelecionado.nome, icone: modeloSelecionado.icone, cliente: dados.clienteVinculado || dados.nomeCliente, responsavel: responsavel || "Não informado", criadoEm, versao: Number(dados.versao) || 1, status: "Gerado", destino: dados.destino, metadata: { dados } };
      let arquivamento = { registro: registroBase, aviso: "" };
      try { arquivamento = await arquivarNoSupabase(arquivos, registroBase); } catch (archiveError) { console.warn("Documento gerado sem arquivamento remoto:", archiveError); arquivamento.aviso = "PDF gerado normalmente, mas não foi possível salvá-lo na pasta interna. Execute a configuração do Supabase ou faça o download agora."; }
      const registro = { ...arquivamento.registro, arquivos: arquivos.map((arquivo) => ({ nome: arquivo.nome })) };
      const novoHistorico = [registro, ...historico.filter((item) => item.id !== registro.id)].slice(0, 20); setHistorico(novoHistorico); localStorage.setItem(DOCUMENT_HISTORY_KEY, JSON.stringify(novoHistorico)); localStorage.removeItem(DOCUMENT_DRAFT_KEY); setDirty(false);
      setResultado({ ...registro, arquivos, aviso: arquivamento.aviso, numeroDocumento }); setPreviewAtualizadaEm(new Date());
      onSuccess?.(modeloSelecionado.modo === "procuracao" ? mensagemConjuntoGerado(listarDocumentosProcuracao(dados)) : "Documento PDF gerado com sucesso!");
    } catch (generationError) { console.error(generationError); setErro(generationError instanceof Error ? generationError.message : "Não foi possível gerar o PDF. Revise os dados e tente novamente."); } finally { setGerando(false); }
  }

  async function abrirHistorico(item) { let link = item.link; if (!link && item.storagePath) { const { data } = await supabase.storage.from("documentos-juridicos").createSignedUrl(item.storagePath, 60 * 60); link = data?.signedUrl; } if (link) window.open(link, "_blank", "noopener,noreferrer"); }
  function carregarRegistro(item, novaVersao = false) { const modelo = MODELOS.find((modeloItem) => modeloItem.id === item.modeloId) || modeloSelecionado; const dadosSalvos = item.metadata?.dados || {}; const versao = novaVersao ? (Number(item.versao) || 1) + 1 : 1; setDados({ ...criarFormularioInicial(responsavel, modelo, departamentoUsuario), ...dadosSalvos, modeloId: modelo.id, nomeDocumento: novaVersao ? item.nomeDocumento : `${item.nomeDocumento} – Cópia`, versao }); setDirty(true); setBibliotecaAberta(false); primeiraSecaoRef.current?.scrollIntoView({ behavior: "smooth" }); }
  async function copiarLink() { if (!resultado?.link) return; await navigator.clipboard.writeText(resultado.link); onSuccess?.("Link interno copiado."); }
  async function prepararAssinatura() { if (resultado?.id && !String(resultado.id).startsWith("local-")) await supabase.from("documentos_juridicos").update({ status: "aguardando_assinatura" }).eq("id", resultado.id); setResultado((atual) => ({ ...atual, status: "Aguardando assinatura" })); onSuccess?.("Documento marcado como pronto para assinatura."); }

  const razaoBloqueio = !dados.nomeDocumento?.trim() ? "Informe o nome do documento para continuar." : pendentes.length ? `Preencha os ${pendentes.length} campos obrigatórios pendentes para gerar o PDF.` : declaracaoIrpfInvalida ? "Informe os exercícios da declaração de IRPF." : "";

  return <section className="legal-doc-workspace" ref={primeiraSecaoRef}>
    {!online ? <div className="legal-doc-offline" role="alert">Sem conexão. Seu rascunho continua salvo neste dispositivo e será preservado até a conexão voltar.</div> : null}
    <header className="legal-doc-hero"><div><span className="eyebrow">Platino Workspace Administrativo</span><h1>Gerador de Documentos Jurídicos</h1><p>Selecione um modelo, preencha as informações necessárias e revise o documento antes de gerar o arquivo final.</p></div><div className="legal-doc-hero-badge"><DocumentCategoryIcon name="shield" size={22} /><span><small>Ambiente controlado</small><strong>Documentos rastreáveis</strong></span></div></header>
    <EtapasDocumento etapaAtual={etapaAtual} />
    <div className="legal-doc-layout"><main className="legal-doc-main">
      <section className="legal-doc-section legal-doc-model-selected"><div className="legal-doc-section-heading"><div><span className="eyebrow">Etapa 1</span><h2>Modelo selecionado</h2></div><button type="button" className="btn-secondary" onClick={() => setBibliotecaAberta(true)}>Trocar modelo</button></div><div className="legal-doc-selected-card"><span className="model-card-icon large"><DocumentCategoryIcon name={modeloSelecionado.icone} size={28} /></span><div><span>{modeloSelecionado.categoriaNome}</span><h3>{modeloSelecionado.nome}</h3><p>{modeloSelecionado.descricao}</p></div><div className="legal-doc-selected-meta"><span>{modeloSelecionado.campos.filter((campo) => campo.obrigatorio).length} campos obrigatórios</span><span>≈ {modeloSelecionado.minutos} minutos</span></div></div></section>
      <form onSubmit={handleGerarPdf} noValidate>
        <section className="legal-doc-section"><div className="legal-doc-section-heading"><div><span className="eyebrow">Etapa 2</span><h2>Identificação do documento</h2><p>Defina como o arquivo será localizado no sistema, CRM e pasta do cliente.</p></div><span className="legal-doc-required-note">* Campos obrigatórios</span></div>
          <label className="legal-doc-field wide legal-doc-name-field" htmlFor="nomeDocumento"><span className="legal-doc-label-row"><span>Nome do documento *</span><small>Título interno editável</small></span><input id="nomeDocumento" name="nomeDocumento" value={dados.nomeDocumento || ""} onChange={atualizarCampo} placeholder="Ex.: Procuração Revisional – João da Silva – Contrato 45872" required /><small>Utilize um nome claro para facilitar a localização deste arquivo.</small></label>
          <div className="legal-doc-name-suggestion"><div><span>Sugestão automática</span><strong>{nomeSugerido || "Preencha o nome do cliente para criar uma sugestão."}</strong></div><button type="button" className="btn-secondary compact" disabled={!nomeSugerido} onClick={() => atualizarDados({ nomeDocumento: nomeSugerido })}>Usar nome sugerido</button></div>
          {duplicado ? <div className="legal-doc-duplicate-warning"><span>!</span><div><strong>Já existe um documento com nome semelhante.</strong><p>Para preservar a rastreabilidade, sugerimos criar a Versão {String(versaoSugerida).padStart(2, "0")}.</p></div><button type="button" onClick={() => atualizarDados({ versao: versaoSugerida, nomeDocumento: `${dados.nomeDocumento.replace(/\s+–\s+Versão\s+\d+$/i, "")} – Versão ${String(versaoSugerida).padStart(2, "0")}` })}>Aplicar versão</button></div> : null}
          <div className="legal-doc-file-preview"><span>Nome do arquivo</span><code>{nomeArquivo}</code></div>
          <button type="button" className="legal-doc-name-config-toggle" onClick={() => setConfigNomeAberta((valor) => !valor)} aria-expanded={configNomeAberta}>⚙ Configurar padrão de nome <span>{configNomeAberta ? "⌃" : "⌄"}</span></button>
          {configNomeAberta ? <div className="legal-doc-name-config">{[["tipo","Tipo do documento"],["cliente","Nome do cliente"],["contrato","Número do contrato"],["processo","Número do processo"],["cpf","CPF parcial"],["data","Data de emissão"],["numero","Número do documento"],["versao","Versão"]].map(([chave, rotulo]) => <label key={chave}><input type="checkbox" checked={padraoNome[chave]} onChange={(evento) => setPadraoNome((atual) => ({ ...atual, [chave]: evento.target.checked }))} />{rotulo}</label>)}</div> : null}
          <div className="legal-doc-control-grid"><label className="legal-doc-field"><span>Data de emissão *</span><input type="date" name="dataEmissao" value={dados.dataEmissao || ""} onChange={atualizarCampo} required /></label>
            <div className="legal-doc-client-picker"><label className="legal-doc-field"><span>Cliente vinculado</span><input type="search" value={buscaCliente} onFocus={() => setClienteBuscaAberta(true)} onBlur={() => window.setTimeout(() => setClienteBuscaAberta(false), 120)} onChange={(evento) => { setBuscaCliente(evento.target.value); setClienteBuscaAberta(true); }} placeholder={clientesCarregando ? "Carregando clientes…" : "Pesquisar por nome, CPF ou código…"} /></label>{clienteBuscaAberta ? <div className="legal-doc-client-results">{clientesFiltrados.length ? clientesFiltrados.map((cliente) => <button type="button" key={cliente.id} onMouseDown={() => selecionarCliente(cliente)}><strong>{cliente.nome}</strong><span>{cliente.cpf || "CPF não informado"} · {cliente.codigo_interno || "Sem código"}</span></button>) : <p>Nenhum cliente encontrado.</p>}</div> : null}</div>
            <label className="legal-doc-field"><span>CPF ou CNPJ</span><input name="cpfCnpj" value={dados.cpfCnpj || ""} onChange={atualizarCampo} onBlur={marcarTocado} placeholder="000.000.000-00" /></label><label className="legal-doc-field"><span>Número do contrato</span><input name="numeroContrato" value={dados.numeroContrato || ""} onChange={atualizarCampo} /></label><label className="legal-doc-field"><span>Número do processo</span><input name="numeroProcesso" value={dados.numeroProcesso || ""} onChange={atualizarCampo} /></label><label className="legal-doc-field"><span>Responsável pela geração</span><input value={responsavel || ""} readOnly /></label><label className="legal-doc-field"><span>Departamento</span><select name="departamento" value={dados.departamento || ""} onChange={atualizarCampo}><option>Administrativo</option><option>Jurídico</option><option>Processual</option><option>Supervisão</option></select></label><label className="legal-doc-field wide"><span>Observação interna</span><textarea name="observacaoInterna" value={dados.observacaoInterna || ""} onChange={atualizarCampo} rows="3" placeholder="Contexto interno opcional. Este texto não será incluído no documento." /></label>
          </div>{clientesErro ? <p className="legal-doc-inline-warning">{clientesErro}</p> : null}{camposImportados.size ? <p className="legal-doc-import-summary">✓ {camposImportados.size} informações importadas do cadastro. Revise e edite se necessário.</p> : null}
          <div className="legal-doc-destination"><label><input type="checkbox" name="salvarNaPasta" checked={Boolean(dados.salvarNaPasta)} onChange={atualizarCampo} /><span><strong>Salvar automaticamente na pasta do cliente</strong><small>O registro ficará disponível no histórico do workspace.</small></span></label><div><span>Destino</span><input name="destino" value={dados.destino || ""} onChange={atualizarCampo} aria-label="Destino de arquivamento" /></div></div>
        </section>
        <section className="legal-doc-section"><div className="legal-doc-section-heading"><div><span className="eyebrow">Etapa 3</span><h2>Dados necessários para este modelo</h2><p>Preencha somente os dados exigidos para {modeloSelecionado.nome}. As informações obrigatórias estão sinalizadas com asterisco.</p></div></div>{grupos.map((grupo) => <GrupoCampos key={`${modeloSelecionado.id}-${grupo.id}`} grupo={grupo} dados={dados} tocados={tocados} importados={camposImportados} onChange={atualizarCampo} onBlur={marcarTocado} modeloId={modeloSelecionado.id} />)}
          {modeloSelecionado.modo === "procuracao" ? <section className="legal-doc-bundle"><div><span className="eyebrow">Conjunto documental</span><h3>Gerar declarações com a Procuração</h3><p>Os mesmos dados serão reutilizados nos arquivos selecionados.</p></div><label><input type="checkbox" name="gerarHipossuficiencia" checked={Boolean(dados.gerarHipossuficiencia)} onChange={atualizarCampo} /><span><strong>Declaração de Hipossuficiência</strong><small>Justiça gratuita</small></span></label><label><input type="checkbox" name="gerarIsencaoIrpf" checked={Boolean(dados.gerarIsencaoIrpf)} onChange={atualizarCampo} /><span><strong>Declaração de Isenção de IRPF</strong><small>Isenção de imposto de renda</small></span></label>{dados.gerarIsencaoIrpf ? <label className="legal-doc-field"><span>Exercícios da isenção *</span><input id="exercicios-conjunto" name="exercicios" value={dados.exercicios || ""} onChange={atualizarCampo} placeholder="2024, 2025 e 2026" /></label> : null}<p>{documentosProcuracao.length} {documentosProcuracao.length === 1 ? "PDF será gerado" : "PDFs serão gerados"}.</p></section> : null}
        </section>
        <div className="legal-doc-support-grid"><PainelProgresso total={obrigatorios.length} preenchidos={preenchidos} pendentes={pendentes} onVerPendentes={() => pendentes[0] && focarCampo(pendentes[0].nome)} /><AssistentePreenchimento dados={dados} pendentes={pendentes} errosVisiveis={errosVisiveis} onCorrigir={focarCampo} /></div>{erro ? <p className="legal-doc-form-error" role="alert">{erro}</p> : null}
        <div className="legal-doc-action-bar"><div><button type="button" className="btn-secondary" onClick={salvarRascunho}>Salvar como rascunho</button><button type="button" className="legal-doc-cancel" onClick={cancelarEdicao}>Cancelar</button><span className={online ? "saved" : "offline"}>{online ? `✓ Salvo automaticamente às ${salvoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Rascunho local — sem conexão"}</span></div><div><button type="button" className="btn-secondary" onClick={() => setPreviewFullscreen(true)}>Revisar documento</button><span className="legal-doc-generate-wrap"><button type="submit" className="btn-primary" disabled={!podeGerar}>{gerando ? "Gerando arquivos…" : `Gerar ${modeloSelecionado.modo === "procuracao" ? `${documentosProcuracao.length} ` : ""}PDF${modeloSelecionado.modo === "procuracao" && documentosProcuracao.length > 1 ? "s" : ""}`}</button>{razaoBloqueio ? <small>{razaoBloqueio}</small> : null}</span></div></div>
      </form>
    </main><aside className="legal-doc-preview-column"><PainelPrevia modelo={modeloSelecionado} dados={dados} numeroDocumento={numeroDocumento} atualizadoEm={previewAtualizadaEm} gerando={gerando} onFullscreen={() => setPreviewFullscreen(true)} onRefresh={() => setPreviewAtualizadaEm(new Date())} /></aside></div>
    <DocumentosRecentes documentos={historico} busca={buscaHistorico} onBusca={setBuscaHistorico} onOpen={abrirHistorico} onDuplicate={(item) => carregarRegistro(item, false)} onVersion={(item) => carregarRegistro(item, true)} />
    <ModelLibraryModal aberto={bibliotecaAberta} modelos={MODELOS} selecionadoId={modeloSelecionado.id} favoritos={favoritos} recentes={modelosRecentes} onClose={() => setBibliotecaAberta(false)} onSelect={selecionarModelo} onToggleFavorite={alternarFavorito} />
    {previewFullscreen ? <div className="legal-doc-fullscreen-backdrop"><PainelPrevia fullscreen modelo={modeloSelecionado} dados={dados} numeroDocumento={numeroDocumento} atualizadoEm={previewAtualizadaEm} gerando={gerando} onFullscreen={() => setPreviewFullscreen(false)} onRefresh={() => setPreviewAtualizadaEm(new Date())} /></div> : null}
    <ModalSucesso resultado={resultado} onClose={() => setResultado(null)} onDownload={() => baixarArquivos(resultado.arquivos)} onOpen={() => window.open(resultado.arquivos[0].url, "_blank", "noopener,noreferrer")} onCopy={copiarLink} onSignature={prepararAssinatura} onLibrary={() => { setResultado(null); setBibliotecaAberta(true); }} onAnother={() => { setResultado(null); setDados((atual) => ({ ...atual, nomeDocumento: "", versao: 1 })); setDirty(true); }} />
  </section>;
}
