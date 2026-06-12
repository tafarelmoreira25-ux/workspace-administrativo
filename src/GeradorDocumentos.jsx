import { useMemo, useState } from "react";

const TIPOS_DOCUMENTO = [
  "Declaração",
  "Proposta de serviços",
  "Termo de atendimento",
  "Relatório de tratativa",
  "Documento personalizado",
];

function dataLocalIso() {
  const hoje = new Date();
  const offset = hoje.getTimezoneOffset() * 60_000;
  return new Date(hoje.getTime() - offset).toISOString().slice(0, 10);
}

function criarFormularioInicial(responsavel) {
  return {
    tipo: TIPOS_DOCUMENTO[0],
    titulo: "Declaração de atendimento",
    dataEmissao: dataLocalIso(),
    nomeCliente: "",
    cpfCnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    assunto: "",
    descricao: "",
    valor: "",
    formaPagamento: "",
    validade: "",
    observacoes: "",
    responsavel: responsavel || "",
  };
}

function formatarData(data) {
  if (!data) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${data}T12:00:00`));
}

function formatarValor(valor) {
  if (!valor) return "";
  const numero = Number(String(valor).replace(",", "."));
  if (Number.isNaN(numero)) return valor;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numero);
}

function nomeArquivoSeguro(nome) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function carregarLogo() {
  const resposta = await fetch("/logo.png");
  if (!resposta.ok) throw new Error("Não foi possível carregar o logotipo.");

  const blob = await resposta.blob();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(blob);
  });
}

function adicionarTextoComQuebra(pdf, texto, x, y, largura, opcoes = {}) {
  const {
    tamanho = 10,
    cor = [51, 65, 85],
    estilo = "normal",
    alturaLinha = 5,
  } = opcoes;

  pdf.setFont("helvetica", estilo);
  pdf.setFontSize(tamanho);
  pdf.setTextColor(...cor);

  const linhas = pdf.splitTextToSize(texto || "-", largura);
  pdf.text(linhas, x, y);
  return y + linhas.length * alturaLinha;
}

async function gerarPdf(dados, numeroDocumento) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();
  const margem = 18;
  const larguraConteudo = larguraPagina - margem * 2;

  pdf.setFillColor(30, 58, 138);
  pdf.rect(0, 0, larguraPagina, 42, "F");

  try {
    const logo = await carregarLogo();
    pdf.addImage(logo, "PNG", margem, 8, 26, 26);
  } catch {
    pdf.setFillColor(255, 255, 255);
    pdf.circle(margem + 13, 21, 12, "F");
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("PLATINO", 50, 17);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Workspace Administrativo", 50, 24);
  pdf.text(`Documento nº ${numeroDocumento}`, larguraPagina - margem, 17, {
    align: "right",
  });
  pdf.text(`Emissão: ${formatarData(dados.dataEmissao)}`, larguraPagina - margem, 24, {
    align: "right",
  });

  let y = 56;

  function novaPaginaSeNecessario(alturaNecessaria) {
    if (y + alturaNecessaria <= alturaPagina - 24) return;

    pdf.addPage();
    pdf.setDrawColor(59, 130, 246);
    pdf.setLineWidth(0.7);
    pdf.line(margem, 16, larguraPagina - margem, 16);
    pdf.setTextColor(30, 58, 138);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(dados.titulo.toUpperCase(), margem, 12);
    y = 28;
  }

  function adicionarSecao(titulo, conteudo) {
    const linhas = pdf.splitTextToSize(conteudo || "-", larguraConteudo - 8);
    const desenharCabecalho = (continuacao = false) => {
      novaPaginaSeNecessario(18);
      pdf.setFillColor(239, 246, 255);
      pdf.roundedRect(margem, y, larguraConteudo, 9, 2, 2, "F");
      pdf.setTextColor(30, 58, 138);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(
        `${titulo.toUpperCase()}${continuacao ? " (CONTINUAÇÃO)" : ""}`,
        margem + 4,
        y + 6,
      );
      y += 14;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(51, 65, 85);
    };

    desenharCabecalho();
    linhas.forEach((linha) => {
      if (y + 5 > alturaPagina - 24) {
        novaPaginaSeNecessario(alturaPagina);
        desenharCabecalho(true);
      }
      pdf.text(linha, margem + 4, y);
      y += 5;
    });
    y += 7;
  }

  pdf.setTextColor(30, 58, 138);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  const titulo = pdf.splitTextToSize(dados.titulo.toUpperCase(), larguraConteudo);
  pdf.text(titulo, larguraPagina / 2, y, { align: "center" });
  y += titulo.length * 7 + 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(dados.tipo, larguraPagina / 2, y, { align: "center" });
  y += 12;

  const dadosCliente = [
    `Nome / Razão social: ${dados.nomeCliente}`,
    `CPF / CNPJ: ${dados.cpfCnpj}`,
    dados.email ? `E-mail: ${dados.email}` : null,
    dados.telefone ? `Telefone: ${dados.telefone}` : null,
    dados.endereco ? `Endereço: ${dados.endereco}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  adicionarSecao("Dados do cliente", dadosCliente);
  adicionarSecao("Assunto / Finalidade", dados.assunto);
  adicionarSecao("Descrição", dados.descricao);

  const condicoes = [
    dados.valor ? `Valor: ${formatarValor(dados.valor)}` : null,
    dados.formaPagamento ? `Forma de pagamento: ${dados.formaPagamento}` : null,
    dados.validade ? `Validade da proposta/documento: ${formatarData(dados.validade)}` : null,
  ].filter(Boolean);

  if (condicoes.length) adicionarSecao("Condições", condicoes.join("\n"));
  if (dados.observacoes) adicionarSecao("Observações", dados.observacoes);

  novaPaginaSeNecessario(48);
  y += 8;
  y = adicionarTextoComQuebra(
    pdf,
    "Declaro que as informações acima foram registradas conforme os dados fornecidos pelo cliente e representam o conteúdo deste documento.",
    margem,
    y,
    larguraConteudo,
    { tamanho: 9, cor: [71, 85, 105] },
  );

  y += 25;
  const larguraAssinatura = 70;
  pdf.setDrawColor(148, 163, 184);
  pdf.line(margem, y, margem + larguraAssinatura, y);
  pdf.line(
    larguraPagina - margem - larguraAssinatura,
    y,
    larguraPagina - margem,
    y,
  );
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text(dados.responsavel || "Responsável", margem + larguraAssinatura / 2, y + 5, {
    align: "center",
  });
  pdf.text(
    dados.nomeCliente,
    larguraPagina - margem - larguraAssinatura / 2,
    y + 5,
    { align: "center" },
  );
  pdf.text("Responsável pelo atendimento", margem + larguraAssinatura / 2, y + 10, {
    align: "center",
  });
  pdf.text(
    "Cliente",
    larguraPagina - margem - larguraAssinatura / 2,
    y + 10,
    { align: "center" },
  );

  const totalPaginas = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    pdf.setPage(pagina);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margem, alturaPagina - 16, larguraPagina - margem, alturaPagina - 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      `Documento gerado pelo Workspace Administrativo • Página ${pagina} de ${totalPaginas}`,
      larguraPagina / 2,
      alturaPagina - 10,
      { align: "center" },
    );
  }

  const cliente = nomeArquivoSeguro(dados.nomeCliente) || "cliente";
  pdf.save(`${nomeArquivoSeguro(dados.tipo)}-${cliente}-${numeroDocumento}.pdf`);
}

export default function GeradorDocumentos({ responsavel, onSuccess }) {
  const [dados, setDados] = useState(() => criarFormularioInicial(responsavel));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [sufixoDocumento] = useState(() => String(Date.now()).slice(-5));

  const numeroDocumento = useMemo(() => {
    const data = dados.dataEmissao?.replaceAll("-", "") || "sem-data";
    return `${data}-${sufixoDocumento}`;
  }, [dados.dataEmissao, sufixoDocumento]);

  function atualizarCampo(evento) {
    const { name, value } = evento.target;
    setDados((atual) => ({ ...atual, [name]: value }));
    setErro("");
  }

  function limparFormulario() {
    setDados(criarFormularioInicial(responsavel));
    setErro("");
  }

  async function handleGerarPdf(evento) {
    evento.preventDefault();

    if (!dados.nomeCliente || !dados.cpfCnpj || !dados.titulo || !dados.assunto || !dados.descricao) {
      setErro("Preencha os campos obrigatórios antes de gerar o documento.");
      return;
    }

    setGerando(true);
    setErro("");

    try {
      await gerarPdf(dados, numeroDocumento);
      onSuccess?.("Documento PDF gerado com sucesso!");
    } catch (error) {
      console.error(error);
      setErro("Não foi possível gerar o PDF. Revise os dados e tente novamente.");
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
          <p>Preencha os dados do cliente e gere o documento padronizado para download.</p>
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
              <label>
                Tipo de documento *
                <select name="tipo" value={dados.tipo} onChange={atualizarCampo}>
                  {TIPOS_DOCUMENTO.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </label>
              <label>
                Data de emissão *
                <input type="date" name="dataEmissao" value={dados.dataEmissao} onChange={atualizarCampo} required />
              </label>
              <label className="span-2">
                Título *
                <input name="titulo" value={dados.titulo} onChange={atualizarCampo} placeholder="Título exibido no PDF" required />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Dados do cliente</legend>
            <div className="form-grid">
              <label>
                Nome / Razão social *
                <input name="nomeCliente" value={dados.nomeCliente} onChange={atualizarCampo} required />
              </label>
              <label>
                CPF / CNPJ *
                <input name="cpfCnpj" value={dados.cpfCnpj} onChange={atualizarCampo} required />
              </label>
              <label>
                E-mail
                <input type="email" name="email" value={dados.email} onChange={atualizarCampo} />
              </label>
              <label>
                Telefone
                <input name="telefone" value={dados.telefone} onChange={atualizarCampo} />
              </label>
              <label className="span-2">
                Endereço
                <input name="endereco" value={dados.endereco} onChange={atualizarCampo} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Conteúdo</legend>
            <div className="form-grid">
              <label className="span-2">
                Assunto / Finalidade *
                <input name="assunto" value={dados.assunto} onChange={atualizarCampo} required />
              </label>
              <label className="span-2">
                Descrição *
                <textarea name="descricao" value={dados.descricao} onChange={atualizarCampo} rows="6" required />
              </label>
              <label>
                Valor (R$)
                <input type="number" min="0" step="0.01" name="valor" value={dados.valor} onChange={atualizarCampo} />
              </label>
              <label>
                Forma de pagamento
                <input name="formaPagamento" value={dados.formaPagamento} onChange={atualizarCampo} />
              </label>
              <label>
                Validade
                <input type="date" name="validade" value={dados.validade} onChange={atualizarCampo} />
              </label>
              <label>
                Responsável
                <input name="responsavel" value={dados.responsavel} onChange={atualizarCampo} />
              </label>
              <label className="span-2">
                Observações
                <textarea name="observacoes" value={dados.observacoes} onChange={atualizarCampo} rows="3" />
              </label>
            </div>
          </fieldset>

          {erro && <p className="form-error" role="alert">{erro}</p>}

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
            <div className="preview-header">
              <img src="/logo.png" alt="" />
              <div>
                <strong>PLATINO</strong>
                <span>Workspace Administrativo</span>
              </div>
            </div>
            <div className="preview-meta">
              <span>{dados.tipo}</span>
              <span>{formatarData(dados.dataEmissao)}</span>
            </div>
            <h3>{dados.titulo || "Título do documento"}</h3>

            <div className="preview-section">
              <span>Dados do cliente</span>
              <strong>{dados.nomeCliente || "Nome do cliente"}</strong>
              <p>{dados.cpfCnpj || "CPF / CNPJ"}</p>
            </div>
            <div className="preview-section">
              <span>Assunto / Finalidade</span>
              <p>{dados.assunto || "O assunto aparecerá aqui."}</p>
            </div>
            <div className="preview-section">
              <span>Descrição</span>
              <p>{dados.descricao || "O conteúdo principal do documento aparecerá nesta área."}</p>
            </div>
            {dados.valor && (
              <div className="preview-highlight">
                <span>Valor</span>
                <strong>{formatarValor(dados.valor)}</strong>
              </div>
            )}
            <div className="preview-signatures">
              <span>{dados.responsavel || "Responsável"}</span>
              <span>{dados.nomeCliente || "Cliente"}</span>
            </div>
          </div>
          <p className="preview-note">Prévia simplificada. O arquivo final será formatado em A4.</p>
        </aside>
      </div>
    </section>
  );
}
