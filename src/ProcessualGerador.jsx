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
    onSuccess?.(`${resultado.identificados} campos identificados automaticamente. Revise apenas os destacados.`);
  }

  function limpar() {
    setResumo("");
    setDados(criarDadosProcessuaisVazios(responsavel));
    setFaltantes([]);
    setAnexos([]);
  }

  async function gerar() {
    if (!dados.nome_cliente || !dados.numero_processo) {
      alert("Preencha o nome do cliente e o número do processo antes de gerar.");
      return;
    }
    setGerando(true);
    try {
      const { baixarPDF, gerarRelatorioProcessualPDF } = await import(
        "./processual/ProcessualRelatorioPDF"
      );
      const agora = new Date();
      const codigoData = agora.toLocaleDateString("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).replaceAll("-", "");
      const arquivo = await gerarRelatorioProcessualPDF({
        dados,
        codigo: `${codigoData}-${Date.now().toString().slice(-5)}`,
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
          <span className="eyebrow">Modelo processual oficial</span>
          <h2>Relatório de Atualização do Processo Judicial</h2>
          <p>Cole o texto integral do processo. O interpretador separa os dados encontrados e destaca somente o que ainda precisa ser preenchido.</p>
        </div>
        <a className="btn-secondary processual-download" href="/modelos/relatorio-atualizacao-processo-judicial-modelo.pdf" download>
          Baixar modelo oficial
        </a>
      </section>

      <section className="processual-input-grid">
        <div className="panel">
          <label className="processual-source">
            Texto integral do processo judicial
            <textarea rows="14" value={resumo} onChange={(event) => setResumo(event.target.value)} placeholder="Cole aqui o texto copiado do PJe, e-SAJ, Projudi, eproc ou de outro sistema judicial. O interpretador localizará processo, partes, advogados, datas, status e movimentações." />
          </label>
          <div className="processual-interpreter-note"><strong>Interpretador inteligente</strong><span>As informações não reconhecidas não são inventadas: elas permanecem destacadas para preenchimento manual.</span></div>
          <div className="document-actions">
            <button className="btn-secondary" type="button" onClick={limpar}>Limpar</button>
            <button className="btn-primary" type="button" disabled={!resumo.trim()} onClick={organizar}>Interpretar e preencher campos</button>
          </div>
        </div>
        <ProcessualPreview dados={dados} codigo="Prévia do modelo original" />
      </section>

      <section className="panel">
        <ProcessualFormulario dados={dados} naoIdentificados={faltantes} onChange={(campo, valor) => { setDados((atual) => ({ ...atual, [campo]: valor })); setFaltantes((atuais) => atuais.filter((campoAtual) => campoAtual !== campo)); }} />
      </section>

      <ProcessualAnexos anexos={anexos} onChange={setAnexos} />

      <section className="panel processual-final-actions">
        <button className="btn-primary" type="button" disabled={gerando} onClick={gerar}>{gerando ? "Gerando PDF..." : "Gerar PDF do relatório"}</button>
      </section>
    </div>
  );
}
