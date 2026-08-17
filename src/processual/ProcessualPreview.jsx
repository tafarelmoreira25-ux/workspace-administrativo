function valor(dados, campo) {
  return dados[campo] || "Não informado";
}

function dataBrasileira(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "")) return data || "Não informada";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function ProcessualPreview({ dados }) {
  return (
    <article className="processual-preview-page processual-preview-modelo">
      <header>
        <span><b>PLATINO</b> SOLUÇÕES FINANCEIRAS</span>
        <h2>Relatório de Atualização do Processo Judicial</h2>
      </header>

      <section className="processual-preview-identification">
        <p><strong>Número do Processo:</strong> {valor(dados, "numero_processo")}</p>
        <p><strong>Origem:</strong> {valor(dados, "origem")}</p>
        <p><strong>Segredo ou sigilo:</strong> {valor(dados, "segredo_sigilo")}</p>
        <p><strong>Justiça Gratuita:</strong> {valor(dados, "justica_gratuita")}</p>
        <p><strong>Data da distribuição:</strong> {dataBrasileira(dados.data_distribuicao)}</p>
      </section>

      <section className="processual-parties-preview">
        <div><strong>Polo ativo</strong><b>{valor(dados, "nome_cliente")}</b><span>ADV.: {valor(dados, "advogado_cliente")}</span></div>
        <div><strong>Polo passivo</strong><b>{valor(dados, "reu")}</b><span>ADV.: {valor(dados, "advogado_reu")}</span></div>
      </section>
      <p className="processual-preview-subject"><strong>Assunto:</strong> {valor(dados, "assunto")}</p>

      {[
        ["Status atual", valor(dados, "status_atual")],
        ["Última movimentação", `${dataBrasileira(dados.data_ultima_movimentacao)} — ${valor(dados, "descricao_ultima_movimentacao")}`],
        ["Consulta do processo", `${dataBrasileira(dados.data_consulta)} às ${dados.hora_consulta || "horário não informado"}`],
        ["Próximos passos", valor(dados, "proximos_passos")],
        ["Anexos e documentos do processo", valor(dados, "link_anexos_documentos")],
      ].map(([rotulo, conteudo]) => (
        <section className="processual-preview-section" key={rotulo}>
          <h3>{rotulo}</h3>
          <p>{conteudo}</p>
        </section>
      ))}

      <footer>
        <p>Nossa equipe jurídica, juntamente com <strong>{valor(dados, "representante_responsavel")}</strong>, acompanha as movimentações processuais e adotará as medidas cabíveis dentro dos prazos estabelecidos pelo Juízo.</p>
        <strong>RAFAEL MOREIRA</strong>
        <span>Departamento Processual • PLATINO SOLUÇÕES FINANCEIRAS</span>
      </footer>
    </article>
  );
}
