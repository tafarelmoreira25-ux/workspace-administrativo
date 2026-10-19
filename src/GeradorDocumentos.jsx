import { useRef, useState } from "react";
import "./documentGeneratorEmpty.css";

export default function GeradorDocumentos() {
  const inputRef = useRef(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [mensagem, setMensagem] = useState("");
  function selecionar(event) {
    const arquivo = event.target.files?.[0];
    setNomeArquivo(arquivo?.name || "");
    setMensagem(arquivo ? "Modelo importado para análise nesta sessão. Antes de ativar, é necessário mapear os campos destacados e validar a conversão para PDF." : "");
  }
  return <section className="legal-doc-workspace legal-doc-empty">
    <span className="eyebrow">Geração local</span>
    <h2>Biblioteca de modelos em revisão</h2>
    <p>Os modelos antigos foram retirados da seleção. Os arquivos DOCX originais permanecem preservados. A geração PDF continua disponível no mecanismo local após cadastrar e validar um novo mapeamento.</p>
    <div className="legal-doc-empty-card">
      <strong>Importar modelo oficial</strong>
      <p>Selecione um arquivo DOCX para iniciar a configuração. O arquivo fica somente nesta sessão e não é enviado ao Supabase ou ao Storage.</p>
      <input ref={inputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={selecionar}/>
      {nomeArquivo && <p><strong>{nomeArquivo}</strong></p>}
      {mensagem && <p role="status">{mensagem}</p>}
    </div>
  </section>;
}
