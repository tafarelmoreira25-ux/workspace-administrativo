import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  calcularMetricasHunter,
  RESULTADOS_PROSPECCAO_HUNTER,
  STATUS_PROSPECCAO_HUNTER,
  validarConclusaoProspecao,
  validarProspecaoHunter,
} from "./lib/hunterLeads";
import "./hunterClientes.css";

const EMAIL_HUNTER = "giullian@platino.com";
const FORMULARIO_VAZIO = {
  id: null,
  nomeCliente: "",
  whatsapp: "",
  documentoSugerido: "",
  clienteComProcesso: false,
  numeroProcesso: "",
  situacaoProcesso: "",
  analiseBreve: "",
  consultorId: "",
};

function normalizar(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mensagemErroHunter(error) {
  const mensagem = error?.message || "Erro desconhecido.";
  if (
    error?.code === "PGRST202" ||
    mensagem.includes("listar_prospeccoes_hunter") ||
    mensagem.includes("schema cache")
  ) {
    return "A Carteira Hunter ainda não foi instalada neste Supabase. Execute o arquivo supabase/carteira_hunter_clientes_2026.sql no SQL Editor e atualize a página.";
  }
  return `Não foi possível carregar a Carteira Hunter: ${mensagem}`;
}

function formatarDataHora(valor) {
  if (!valor) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor));
}

function CartaoMetrica({ rotulo, valor, tom = "normal" }) {
  return <article className={`hunter-metric hunter-metric-${tom}`}>
    <span>{rotulo}</span>
    <strong>{valor}</strong>
  </article>;
}

function PerfilCliente({ registro }) {
  return <div className="hunter-profile-preview">
    <div><span>Cliente</span><strong>{registro.nome_cliente}</strong></div>
    <div><span>WhatsApp</span><strong>{registro.whatsapp}</strong></div>
    <div><span>Documento sugerido</span><strong>{registro.documento_sugerido}</strong></div>
    <div><span>Processo judicial</span><strong>{registro.cliente_com_processo ? "Sim" : "Não"}</strong></div>
    {registro.cliente_com_processo && <>
      <div><span>Número do processo</span><strong>{registro.numero_processo}</strong></div>
      <div><span>Situação do processo</span><strong>{registro.situacao_processo}</strong></div>
    </>}
    <div className="hunter-profile-analysis"><span>Análise breve</span><p>{registro.analise_breve}</p></div>
  </div>;
}

export default function HunterClientes({ usuario, funcionarios = [], showToast }) {
  const email = usuario?.email?.trim().toLowerCase() || "";
  const ehHunter = email === EMAIL_HUNTER;
  const [registros, setRegistros] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [respostas, setRespostas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc("listar_prospeccoes_hunter");
    setCarregando(false);
    if (error) {
      setErro(mensagemErroHunter(error));
      return;
    }
    setRegistros(data || []);
    setErro("");
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.rpc("listar_prospeccoes_hunter").then(({ data, error }) => {
      if (!ativo) return;
      setCarregando(false);
      if (error) {
        setErro(mensagemErroHunter(error));
        return;
      }
      setRegistros(data || []);
      setErro("");
    });
    return () => { ativo = false; };
  }, []);

  const consultores = useMemo(() => funcionarios.filter((funcionario) => {
    const setor = normalizar(funcionario.setor || "");
    const cargo = normalizar(funcionario.cargo || "");
    return funcionario.ativo !== false && setor.includes("jurid") &&
      cargo.includes("consultor") &&
      funcionario.email?.trim().toLowerCase() !== EMAIL_HUNTER;
  }), [funcionarios]);

  const metricas = calcularMetricasHunter(registros);
  const alterar = (campo, valor) => setFormulario((atual) => ({ ...atual, [campo]: valor }));

  function editar(registro) {
    setFormulario({
      id: registro.id,
      nomeCliente: registro.nome_cliente || "",
      whatsapp: registro.whatsapp || "",
      documentoSugerido: registro.documento_sugerido || "",
      clienteComProcesso: registro.cliente_com_processo === true,
      numeroProcesso: registro.numero_processo || "",
      situacaoProcesso: registro.situacao_processo || "",
      analiseBreve: registro.analise_breve || "",
      consultorId: registro.consultor_id ? String(registro.consultor_id) : "",
    });
    document.querySelector(".hunter-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  async function salvarPerfil(delegar) {
    const falha = validarProspecaoHunter(formulario, delegar);
    if (falha) return alert(falha);
    setSalvando(true);
    const { error } = await supabase.rpc("salvar_prospeccao_hunter", {
      p_prospeccao_id: formulario.id ? Number(formulario.id) : null,
      p_nome_cliente: formulario.nomeCliente.trim(),
      p_whatsapp: formulario.whatsapp.trim(),
      p_documento_sugerido: formulario.documentoSugerido.trim(),
      p_cliente_com_processo: formulario.clienteComProcesso,
      p_numero_processo: formulario.clienteComProcesso ? formulario.numeroProcesso.trim() : null,
      p_situacao_processo: formulario.clienteComProcesso ? formulario.situacaoProcesso.trim() : null,
      p_analise_breve: formulario.analiseBreve.trim(),
      p_consultor_id: formulario.consultorId ? Number(formulario.consultorId) : null,
      p_delegar: delegar,
    });
    setSalvando(false);
    if (error) return alert(`Não foi possível salvar o perfil: ${error.message}`);
    await carregar();
    setFormulario(FORMULARIO_VAZIO);
    showToast(delegar ? "Perfil enviado ao consultor." : "Cliente salvo na carteira Hunter.");
  }

  function alterarResposta(id, campo, valor) {
    setRespostas((atuais) => ({
      ...atuais,
      [id]: { ...(atuais[id] || {}), [campo]: valor },
    }));
  }

  async function movimentar(registro, acao) {
    const resposta = respostas[registro.id] || {};
    if (acao === "concluir") {
      const falha = validarConclusaoProspecao(resposta.resultado, resposta.motivo);
      if (falha) return alert(falha);
    }
    const { error } = await supabase.rpc("movimentar_prospeccao_hunter", {
      p_prospeccao_id: Number(registro.id),
      p_acao: acao,
      p_resultado: acao === "concluir" ? resposta.resultado : null,
      p_motivo: acao === "concluir" ? resposta.motivo?.trim() || null : null,
      p_observacao: resposta.observacao?.trim() || null,
    });
    if (error) return alert(`Não foi possível atualizar a tratativa: ${error.message}`);
    await carregar();
    setRespostas((atuais) => ({ ...atuais, [registro.id]: {} }));
    showToast(acao === "iniciar" ? "Tratativa iniciada." : "Resultado devolvido para a Giullian.");
  }

  return <section className="hunter-workspace">
    <header className="hunter-hero">
      <div>
        <span className="hunter-eyebrow">{ehHunter ? "Carteira de prospecção" : "Perfis enviados pela Hunter"}</span>
        <h2>{ehHunter ? "Central Hunter · Giullian" : "Clientes indicados"}</h2>
        <p>{ehHunter
          ? "Organize clientes potenciais, encaminhe o perfil aos consultores e acompanhe os resultados comerciais."
          : "Analise o perfil, entre em contato com o cliente e devolva o resultado da tratativa."}</p>
      </div>
      <button className="hunter-refresh" type="button" onClick={carregar} disabled={carregando}>
        {carregando ? "Atualizando..." : "Atualizar carteira"}
      </button>
    </header>

    {erro && <div className="hunter-error">{erro}</div>}

    <div className="hunter-metrics">
      <CartaoMetrica rotulo="Perfis localizados" valor={metricas.total} />
      <CartaoMetrica rotulo="Pendentes" valor={metricas.pendentes} tom="warning" />
      <CartaoMetrica rotulo="Pagamentos" valor={metricas.positivos} tom="success" />
      <CartaoMetrica rotulo="Sem pagamento" valor={metricas.negativos} tom="danger" />
      <CartaoMetrica rotulo="Conversão" valor={`${metricas.conversao}%`} tom="accent" />
    </div>

    {ehHunter && <section className="hunter-editor">
      <div className="hunter-section-heading">
        <div><span>Perfil do cliente</span><h3>{formulario.id ? "Editar cliente em organização" : "Adicionar cliente visado"}</h3></div>
        {formulario.id && <button type="button" onClick={() => setFormulario(FORMULARIO_VAZIO)}>Cancelar edição</button>}
      </div>
      <div className="hunter-form-grid">
        <label>Nome do cliente<input value={formulario.nomeCliente} onChange={(e) => alterar("nomeCliente", e.target.value)} placeholder="Nome completo" /></label>
        <label>Número de WhatsApp<input type="tel" inputMode="tel" value={formulario.whatsapp} onChange={(e) => alterar("whatsapp", e.target.value)} placeholder="(00) 00000-0000" /></label>
        <label>Documento ou serviço sugerido<input value={formulario.documentoSugerido} onChange={(e) => alterar("documentoSugerido", e.target.value)} placeholder="Ex.: Certidão, contrato ou consulta" /></label>
        <label>Consultor responsável<select value={formulario.consultorId} onChange={(e) => alterar("consultorId", e.target.value)}><option value="">Selecionar ao delegar...</option>{consultores.map((consultor) => <option key={consultor.id} value={consultor.id}>{consultor.nome}</option>)}</select></label>
      </div>
      <fieldset className="hunter-process-fieldset">
        <legend>Cliente com processo judicial?</legend>
        <label><input type="radio" name="cliente-com-processo" checked={formulario.clienteComProcesso === true} onChange={() => alterar("clienteComProcesso", true)} /> Sim</label>
        <label><input type="radio" name="cliente-com-processo" checked={formulario.clienteComProcesso === false} onChange={() => alterar("clienteComProcesso", false)} /> Não</label>
      </fieldset>
      {formulario.clienteComProcesso && <div className="hunter-form-grid">
        <label>Número do processo<input value={formulario.numeroProcesso} onChange={(e) => alterar("numeroProcesso", e.target.value)} /></label>
        <label>Situação do processo<input value={formulario.situacaoProcesso} onChange={(e) => alterar("situacaoProcesso", e.target.value)} placeholder="Resumo da situação atual" /></label>
      </div>}
      <label className="hunter-analysis-field">Análise breve do perfil<textarea rows="4" value={formulario.analiseBreve} onChange={(e) => alterar("analiseBreve", e.target.value)} placeholder="Descreva o potencial, a necessidade identificada e por que este cliente deve ser contatado." /></label>
      <div className="hunter-editor-actions">
        <button className="hunter-secondary" type="button" disabled={salvando} onClick={() => salvarPerfil(false)}>Salvar na carteira</button>
        <button className="hunter-primary" type="button" disabled={salvando} onClick={() => salvarPerfil(true)}>{salvando ? "Salvando..." : "Delegar perfil ao consultor"}</button>
      </div>
    </section>}

    <section className="hunter-list-section">
      <div className="hunter-section-heading"><div><span>Acompanhamento</span><h3>{ehHunter ? "Clientes localizados" : "Perfis sob sua responsabilidade"}</h3></div><strong>{registros.length}</strong></div>
      {carregando ? <p className="hunter-empty">Carregando perfis...</p> : registros.length === 0 ? <p className="hunter-empty">Nenhum perfil registrado nesta carteira.</p> : <div className="hunter-list">
        {registros.map((registro) => {
          const resposta = respostas[registro.id] || {};
          return <article className={`hunter-lead-card hunter-status-${registro.status}`} data-hunter-id={registro.id} key={registro.id}>
            <div className="hunter-lead-heading">
              <div><span className="hunter-code">HNT-{String(registro.id).padStart(4, "0")}</span><h3>{registro.nome_cliente}</h3><small>Criado em {formatarDataHora(registro.created_at)}</small></div>
              <span className="hunter-status-badge">{STATUS_PROSPECCAO_HUNTER[registro.status] || registro.status}</span>
            </div>
            <PerfilCliente registro={registro} />
            <div className="hunter-assignment"><span>Consultor responsável</span><strong>{registro.consultor_nome || "Ainda não delegado"}</strong></div>

            {registro.status === "concluida" && <div className={`hunter-result hunter-result-${registro.resultado}`}>
              <strong>{RESULTADOS_PROSPECCAO_HUNTER[registro.resultado] || "Resultado registrado"}</strong>
              {registro.motivo_nao_pagamento && <p>Motivo: {registro.motivo_nao_pagamento}</p>}
              {registro.observacao_consultor && <p>Observação: {registro.observacao_consultor}</p>}
              <small>Concluído em {formatarDataHora(registro.concluida_em)}</small>
            </div>}

            {ehHunter && registro.status === "em_organizacao" && <div className="hunter-card-actions"><button className="hunter-secondary" type="button" onClick={() => editar(registro)}>Editar e delegar</button></div>}

            {!ehHunter && registro.status !== "concluida" && <section className="hunter-consultant-action">
              {registro.status === "delegada" && <button className="hunter-primary" type="button" onClick={() => movimentar(registro, "iniciar")}>Iniciar contato com o cliente</button>}
              {registro.status === "em_tratativa" && <>
                <fieldset><legend>Resultado da tratativa</legend>{Object.entries(RESULTADOS_PROSPECCAO_HUNTER).map(([valor, rotulo]) => <label key={valor}><input type="radio" name={`resultado-${registro.id}`} checked={resposta.resultado === valor} onChange={() => alterarResposta(registro.id, "resultado", valor)} /> {rotulo}</label>)}</fieldset>
                {resposta.resultado === "nao_realizou_pagamento" && <label>Motivo obrigatório<textarea rows="3" value={resposta.motivo || ""} onChange={(e) => alterarResposta(registro.id, "motivo", e.target.value)} placeholder="Explique por que o cliente não realizou o pagamento." /></label>}
                <label>Observação da tratativa<textarea rows="3" value={resposta.observacao || ""} onChange={(e) => alterarResposta(registro.id, "observacao", e.target.value)} placeholder="Registre contatos, objeções ou próximos passos." /></label>
                <button className="hunter-primary" type="button" onClick={() => movimentar(registro, "concluir")}>Concluir análise e devolver à Giullian</button>
              </>}
            </section>}
          </article>;
        })}
      </div>}
    </section>
  </section>;
}
