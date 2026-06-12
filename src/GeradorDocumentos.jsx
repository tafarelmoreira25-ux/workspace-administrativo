import { useMemo, useState } from "react";
import { DOCUMENT_TEMPLATES } from "./config/documentTemplates";

function dataLocalIso() {
  const hoje = new Date();
  const offset = hoje.getTimezoneOffset() * 60_000;
  return new Date(hoje.getTime() - offset).toISOString().slice(0, 10);
}

function criarFormularioInicial(responsavel, modelo = DOCUMENT_TEMPLATES[0]) {
  return {
    modeloId: modelo.id,
    tipo: modelo.nome,
    titulo: modelo.titulo || modelo.nome,
    dataEmissao: dataLocalIso(),
    genero: "feminino",
    nacionalidade: "brasileira",
    estadoCivil: "",
    profissao: "",
    rg: "",
    orgaoExpedidor: "SSP/SP",
    nomeCliente: "",
    cpfCnpj: "",
    email: "",
    endereco: "",
    banco: "",
    numeroContrato: "",
    cidade: "São Paulo",
    uf: "SP",
    cep: "",
    exercicios: "2023, 2024 e 2025",
    responsavel: responsavel || "",
  };
}

function formatarData(data) {
  if (!data) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${data}T12:00:00`));
}

function nomeArquivoSeguro(nome) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function baixarArquivo(bytes, nomeArquivo) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function gerarDocumento(dados, modelo, numeroDocumento) {
  let bytes;

  if (modelo.modo === "procuracao") {
    const { gerarProcuracaoPdf } = await import("./lib/procuracaoPdf");
    bytes = await gerarProcuracaoPdf(dados);
  } else {
    const {
      gerarDeclaracaoHipossuficienciaPdf,
      gerarDeclaracaoIsencaoIrpfPdf,
    } = await import("./lib/declaracoesPdf");

    bytes =
      modelo.modo === "declaracao-hipossuficiencia"
        ? await gerarDeclaracaoHipossuficienciaPdf(dados)
        : await gerarDeclaracaoIsencaoIrpfPdf(dados);
  }

  const cliente = nomeArquivoSeguro(dados.nomeCliente) || "cliente";
  baixarArquivo(
    bytes,
    `${nomeArquivoSeguro(modelo.nome)}-${cliente}-${numeroDocumento}.pdf`,
  );
}

function ResumoDocumento({ modelo, dados }) {
  if (modelo.modo === "procuracao") {
    return (
      <>
        <span>Procuração</span>
        <h3>{modelo.nome}</h3>
        <p>
          Outorgante: <strong>{dados.nomeCliente || "Nome do cliente"}</strong>
        </p>
        <p>
          Ação de Revisão de Contrato contra o banco{" "}
          <strong>{dados.banco || "não informado"}</strong>.
        </p>
      </>
    );
  }

  if (modelo.modo === "declaracao-hipossuficiencia") {
    return (
      <>
        <span>Justiça gratuita</span>
        <h3>{modelo.nome}</h3>
        <p>
          Declarante: <strong>{dados.nomeCliente || "Nome do cliente"}</strong>
        </p>
        <p>
          Declaração destinada ao pedido dos benefícios da justiça gratuita.
        </p>
      </>
    );
  }

  return (
    <>
      <span>Isenção de IRPF</span>
      <h3>{modelo.nome}</h3>
      <p>
        Declarante: <strong>{dados.nomeCliente || "Nome do cliente"}</strong>
      </p>
      <p>
        Exercícios: <strong>{dados.exercicios || "não informados"}</strong>
      </p>
    </>
  );
}

export default function GeradorDocumentos({ responsavel, onSuccess }) {
  const [dados, setDados] = useState(() => criarFormularioInicial(responsavel));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [sufixoDocumento] = useState(() => String(Date.now()).slice(-5));
  const modeloSelecionado =
    DOCUMENT_TEMPLATES.find((modelo) => modelo.id === dados.modeloId) ||
    DOCUMENT_TEMPLATES[0];

  const numeroDocumento = useMemo(() => {
    const data = dados.dataEmissao?.replaceAll("-", "") || "sem-data";
    return `${data}-${sufixoDocumento}`;
  }, [dados.dataEmissao, sufixoDocumento]);

  function atualizarCampo(evento) {
    const { name, value } = evento.target;
    setDados((atual) => ({ ...atual, [name]: value }));
    setErro("");
  }

  function trocarModelo(evento) {
    const modelo = DOCUMENT_TEMPLATES.find(
      (item) => item.id === evento.target.value,
    );
    setDados(criarFormularioInicial(responsavel, modelo));
    setErro("");
  }

  function limparFormulario() {
    setDados(criarFormularioInicial(responsavel, modeloSelecionado));
    setErro("");
  }

  async function handleGerarPdf(evento) {
    evento.preventDefault();

    const campoFaltando = modeloSelecionado.campos.find(
      (campo) => campo.obrigatorio && !String(dados[campo.nome] || "").trim(),
    );

    if (campoFaltando || !dados.dataEmissao) {
      setErro(
        campoFaltando
          ? `Preencha o campo obrigatório: ${campoFaltando.rotulo}.`
          : "Informe a data de emissão.",
      );
      return;
    }

    setGerando(true);
    setErro("");

    try {
      await gerarDocumento(dados, modeloSelecionado, numeroDocumento);
      onSuccess?.("Documento PDF gerado com sucesso!");
    } catch (error) {
      console.error(error);
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o PDF. Revise os dados e tente novamente.",
      );
    } finally {
      setGerando(false);
    }
  }

  return (
    <section className="document-workspace">
      <div className="document-heading">
        <div>
          <span className="eyebrow">Central de documentos</span>
          <h2>Gerador de PDF</h2>
          <p>Escolha o documento, preencha os dados do cliente e baixe o PDF.</p>
        </div>
        <div className="document-number">
          <span>Número do documento</span>
          <strong>{numeroDocumento}</strong>
        </div>
      </div>

      <div className="document-grid">
        <form className="document-form panel" onSubmit={handleGerarPdf}>
          <fieldset>
            <legend>Documento</legend>
            <div className="form-grid">
              <label className="span-2">
                Qual documento deseja gerar? *
                <select name="modeloId" value={dados.modeloId} onChange={trocarModelo}>
                  {DOCUMENT_TEMPLATES.map((modelo) => (
                    <option key={modelo.id} value={modelo.id}>
                      {modelo.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data de emissão *
                <input
                  type="date"
                  name="dataEmissao"
                  value={dados.dataEmissao}
                  onChange={atualizarCampo}
                  required
                />
              </label>
              <div className="template-summary">
                <span>Modelo oficial sem logotipo</span>
                <p>{modeloSelecionado.descricao}</p>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Dados para preenchimento</legend>
            <div className="form-grid">
              {modeloSelecionado.campos.map((campo) => (
                <label
                  key={campo.nome}
                  className={campo.largura === "total" ? "span-2" : ""}
                >
                  {campo.rotulo}
                  {campo.obrigatorio ? " *" : ""}
                  {campo.tipo === "textarea" ? (
                    <textarea
                      name={campo.nome}
                      value={dados[campo.nome] || ""}
                      onChange={atualizarCampo}
                      rows="4"
                      required={campo.obrigatorio}
                    />
                  ) : campo.tipo === "select" ? (
                    <select
                      name={campo.nome}
                      value={dados[campo.nome] || ""}
                      onChange={atualizarCampo}
                      required={campo.obrigatorio}
                    >
                      {campo.opcoes.map((opcao) => (
                        <option key={opcao.valor} value={opcao.valor}>
                          {opcao.rotulo}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={campo.tipo || "text"}
                      name={campo.nome}
                      value={dados[campo.nome] || ""}
                      onChange={atualizarCampo}
                      required={campo.obrigatorio}
                    />
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          {erro && (
            <p className="form-error" role="alert">
              {erro}
            </p>
          )}

          <div className="document-actions">
            <button type="button" className="btn-secondary" onClick={limparFormulario}>
              Limpar
            </button>
            <button type="submit" className="btn-primary" disabled={gerando}>
              {gerando ? "Gerando PDF..." : "Gerar e baixar PDF"}
            </button>
          </div>
        </form>

        <aside className="pdf-preview">
          <div className="preview-page">
            <div className="preview-meta">
              <span>Documento sem logotipo</span>
              <span>{formatarData(dados.dataEmissao)}</span>
            </div>
            <div className="template-preview-info">
              <ResumoDocumento modelo={modeloSelecionado} dados={dados} />
              <p>
                Assinatura em {dados.cidade || "cidade não informada"}
                {dados.uf ? `-${dados.uf}` : ""}.
              </p>
            </div>
          </div>
          <p className="preview-note">
            Prévia simplificada. O documento final será formatado em A4 e sem logotipo.
          </p>
        </aside>
      </div>
    </section>
  );
}
