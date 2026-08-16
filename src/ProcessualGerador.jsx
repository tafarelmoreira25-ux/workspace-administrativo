import { useState } from "react";
import ProcessualFormulario from "./processual/ProcessualFormulario";
import ProcessualAnexos from "./processual/ProcessualAnexos";
import ProcessualPreview from "./processual/ProcessualPreview";
import {
  criarDadosProcessuaisVazios,
  organizarResumoProcessual,
} from "./processual/processualParser";

export default function ProcessualGerador({ responsavel, onSuccess }) {
  const [resumo, setResumo] = useState("");
  const [dados, setDados] = useState(() => criarDadosProcessuaisVazios(responsavel));
  const [faltantes, setFaltantes] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [gerando, setGerando] = useState(false);

  function organizar() {
    const resultado = organizarResumoProcessual(resumo, responsavel);
    setDados(resultado.dados);
    setFaltantes(resultado.naoIdentificados);
    onSuccess?.("Texto separado nos campos. Revise os dados destacados.");
  }

  function limpar() {
    setResumo("");
    setDados(criarDadosProcessuaisVazios(responsavel));
    setFaltantes([]);
    setAnexos([]);
  }

  async function gerar() {
    if (!dados.cliente_autor || !dados.numero_processo) {
      alert("Preencha cliente e número do processo antes de gerar.");
      return;
    }
    setGerando(true);
    try {
      const { baixarPDF, gerarRelatorioProcessualPDF } = await import(
        "./processual/ProcessualRelatorioPDF"
      );
      const arquivo = await gerarRelatorioProcessualPDF({
        dados,
        codigo: `RLPROC-${Date.now().toString().slice(-6)}`,
        anexos,
      });
      baixarPDF(arquivo);
      onSuccess?.("Relatório processual gerado com os dados e anexos.");
    } catch (error) {
      alert(`Não foi possível gerar o relatório: ${error.message}`);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="processual-generator">
      <section className="panel processual-generator-heading">
        <div>
          <span className="eyebrow">Gerador baseado no modelo original</span>
          <h2>Relatório de Atualização do Processo Judicial</h2>
          <p>Preencha os campos destacados no modelo, anexe imagens do processo e gere o PDF.</p>
        </div>
        <a className="btn-secondary processual-download" href="/modelos/relatorio-atualizacao-processo-judicial-modelo.docx" download>
          Baixar modelo DOCX
        </a>
      </section>

      <section className="processual-input-grid">
        <div className="panel">
          <label className="processual-source">
            Cole aqui o texto do processo para separar automaticamente
            <textarea rows="14" value={resumo} onChange={(event) => setResumo(event.target.value)} placeholder="Cole o andamento, número do processo, cliente, tribunal, movimentações e próximos passos..." />
          </label>
          <div className="document-actions">
            <button className="btn-secondary" type="button" onClick={limpar}>Limpar</button>
            <button className="btn-primary" type="button" onClick={organizar}>Organizar informações</button>
          </div>
        </div>
        <ProcessualPreview dados={dados} codigo="Prévia do modelo original" />
      </section>

      <section className="panel">
        <ProcessualFormulario dados={dados} naoIdentificados={faltantes} onChange={(campo, valor) => { setDados((atual) => ({ ...atual, [campo]: valor })); setFaltantes((atuais) => atuais.filter((campoAtual) => campoAtual !== campo)); }} />
        <label className="processual-link-field">
          Link oficial do processo
          <input type="url" value={dados.link_processo || ""} onChange={(event) => setDados((atual) => ({ ...atual, link_processo: event.target.value }))} placeholder="https://..." />
        </label>
      </section>

      <ProcessualAnexos anexos={anexos} onChange={setAnexos} />

      <section className="panel processual-final-actions">
        <button className="btn-primary" type="button" disabled={gerando} onClick={gerar}>{gerando ? "Gerando PDF..." : "Gerar PDF do relatório"}</button>
      </section>
    </div>
  );
}
