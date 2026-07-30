export default function ProcessualGerador({ onSuccess }) {
  function informarDownload() {
    onSuccess?.("Modelo original de atualização processual baixado.");
  }

  return (
    <div className="processual-generator">
      <section className="panel processual-generator-heading">
        <div>
          <span className="eyebrow">Modelo oficial</span>
          <h2>Relatório de Atualização do Processo Judicial</h2>
          <p>
            Este é o arquivo original disponibilizado para preenchimento e
            utilização pela equipe Jurídica.
          </p>
        </div>
        <span className="processual-code">MODELO ORIGINAL</span>
      </section>

      <section className="panel processual-original-card">
        <div className="processual-original-icon" aria-hidden="true">DOCX</div>
        <div>
          <span className="eyebrow">Documento oficial</span>
          <h3>Relatório de Atualização do Processo Judicial - Modelo</h3>
          <p>
            Baixe uma cópia do modelo original para preencher, revisar e
            encaminhar conforme o procedimento do Jurídico.
          </p>
          <a
            className="btn-primary processual-download"
            href="/modelos/relatorio-atualizacao-processo-judicial-modelo.docx"
            download="relatorio-atualizacao-processo-judicial-modelo.docx"
            onClick={informarDownload}
          >
            Baixar modelo original
          </a>
        </div>
      </section>
    </div>
  );
}
