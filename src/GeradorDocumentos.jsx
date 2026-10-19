import { useRef, useState } from "react";
import { DOCUMENT_GENERATORS, generateDocumentPdf } from "./lib/documentGeneratorRegistry";
import "./documentGeneratorEmpty.css";

export default function GeradorDocumentos() {
  const inputRef = useRef(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [mensagemGeracao, setMensagemGeracao] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [dados, setDados] = useState({});
  const [gerando, setGerando] = useState(false);
  const modeloSelecionado = DOCUMENT_GENERATORS.find((modelo) => modelo.id === modeloId);

  async function gerar(event) {
    event.preventDefault();
    if (!modeloSelecionado) return;
    setGerando(true);
    setMensagemGeracao("");
    try {
      const bytes = await generateDocumentPdf(modeloSelecionado.id, dados);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${modeloSelecionado.id}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMensagemGeracao("PDF gerado localmente e baixado.");
    } catch (error) {
      setMensagemGeracao(error instanceof Error ? error.message : "Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  function selecionar(event) {
    const arquivo = event.target.files?.[0];
    setNomeArquivo(arquivo?.name || "");
    setMensagem(arquivo
      ? "Arquivo selecionado nesta sessão. Ainda não foi cadastrado e não pode gerar PDF: falta definir seus campos, criar o renderizador próprio e validar o resultado."
      : "");
  }

  return (
    <section className="legal-doc-workspace legal-doc-empty">
      <span className="eyebrow">Geração local</span>
      <h2>Biblioteca de documentos</h2>
      <p>
        Não há modelos ativos. Os modelos antigos estão em backup e não aparecem na
        biblioteca. Cada novo Word precisará de um formulário e de um renderizador
        PDF próprio, comparado visualmente com o arquivo original antes de ser ativado.
      </p>
      {DOCUMENT_GENERATORS.length > 0 && (
        <form className="legal-doc-empty-card" onSubmit={gerar}>
          <label htmlFor="legal-document-template">Modelo</label>
          <select
            id="legal-document-template"
            value={modeloId}
            onChange={(event) => {
              setModeloId(event.target.value);
              setDados({});
            }}
            required
          >
            <option value="">Selecione um documento</option>
            {DOCUMENT_GENERATORS.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.category} · {modelo.name}
              </option>
            ))}
          </select>
          {modeloSelecionado?.fields?.map((campo) => (
            <label key={campo.id}>
              {campo.label}
              {campo.type === "select" ? (
                <select required={Boolean(campo.required)} value={dados[campo.id] || ""} onChange={(event) => setDados((atual) => ({ ...atual, [campo.id]: event.target.value }))}>
                  <option value="">Selecione</option>
                  {(campo.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input
                  type={campo.type || "text"}
                  required={Boolean(campo.required)}
                  value={dados[campo.id] || ""}
                  onChange={(event) => setDados((atual) => ({ ...atual, [campo.id]: event.target.value }))}
                />
              )}
            </label>
          ))}
          {modeloSelecionado && <button type="submit" disabled={gerando}>{gerando ? "Gerando…" : "Gerar e baixar PDF"}</button>}
          {mensagemGeracao && <p role="status">{mensagemGeracao}</p>}
        </form>
      )}
      <div className="legal-doc-empty-card">
        <strong>Preparar novo modelo</strong>
        <p>
          Selecione o DOCX original como referência. O arquivo permanece somente nesta
          sessão; selecioná-lo ainda não o cadastra nem ativa a geração. Documentos
          gerados, rascunhos e históricos não são enviados ao Supabase.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={selecionar}
        />
        {nomeArquivo && <p><strong>{nomeArquivo}</strong></p>}
        {mensagem && <p role="status">{mensagem}</p>}
      </div>
    </section>
  );
}
