const TAMANHO_MAXIMO = 15 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "application/pdf"];

export default function ProcessualAnexos({ anexos, onChange }) {
  const captura = anexos[0];

  function selecionar(event) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;
    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      alert("Selecione uma imagem PNG/JPG ou um arquivo PDF.");
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      alert("A captura deve ter no máximo 15 MB.");
      return;
    }
    onChange([{
      id: `${Date.now()}-captura`,
      arquivo,
      nome: arquivo.name.replace(/\.[^.]+$/, ""),
      incluir: true,
      ordem: 1,
    }]);
  }

  function visualizar() {
    if (!captura?.arquivo) return;
    const url = URL.createObjectURL(captura.arquivo);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <section className="panel processual-attachments">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">Campo opcional do modelo</span>
          <h2>Captura de tela do processo</h2>
        </div>
        <label className="btn-secondary compact attachment-picker">
          {captura ? "Substituir captura" : "Escolher arquivo"}
          <input accept=".png,.jpg,.jpeg,.pdf" type="file" onChange={selecionar} />
        </label>
      </div>
      <small>PNG, JPG ou PDF, até 15 MB. A captura será adicionada depois do relatório.</small>
      {captura && (
        <article className="processual-capture-selected">
          <div><strong>{captura.arquivo.name}</strong><small>{Math.ceil(captura.arquivo.size / 1024)} KB</small></div>
          <button className="btn-secondary compact" type="button" onClick={visualizar}>Visualizar</button>
          <button className="btn-danger compact" type="button" onClick={() => onChange([])}>Remover</button>
        </article>
      )}
    </section>
  );
}
