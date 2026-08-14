import { AVISO_PROCESSUAL, FINALIDADE_PROCESSUAL } from "./processualConstants";

const CAMPOS_RESUMO = [
  ["Cliente (Autor)", "cliente_autor"],
  ["Instituição Financeira (Réu)", "instituicao_reu"],
  ["Número do Processo", "numero_processo"],
  ["Data de distribuição", "data_distribuicao"],
  ["Juiz responsável", "juiz_responsavel"],
  ["Advogado", "advogado"],
];

export default function ProcessualPreview({ dados, codigo = "RLPROC-AAAA-PENDENTE" }) {
  const local = [dados.tribunal, dados.vara, dados.forum_comarca, dados.cidade_estado]
    .filter(Boolean)
    .join(" – ");

  return (
    <article className="processual-preview-page">
      <header>
        <span>PLATINO EQUIPE</span>
        <h2>Relatório de Atualização Processual</h2>
        <div>
          <strong>Código: {codigo}</strong>
          <strong>Data da consulta: {dados.data_consulta || "Não informada"}</strong>
        </div>
      </header>
      <section>
        <h3>{local || "Tribunal não identificado"}</h3>
        <div className="processual-summary-grid">
          {CAMPOS_RESUMO.map(([rotulo, campo]) => (
            <p key={campo}>
              <strong>{rotulo}:</strong> {dados[campo] || "Não informado"}
            </p>
          ))}
        </div>
      </section>
      <section>
        <h3>Andamento Processual</h3>
        {[
          ["Status atual", dados.status_atual],
          ["Última movimentação", dados.ultima_movimentacao],
          ["Próximos passos", dados.proximos_passos],
        ].map(([rotulo, valor]) => (
          <div className="preview-process-block" key={rotulo}>
            <strong>{rotulo}</strong>
            <p>{valor || "Não informado"}</p>
          </div>
        ))}
        {dados.observacao_cliente && (
          <div className="preview-process-block">
            <strong>Observação ao cliente</strong>
            <p>{dados.observacao_cliente}</p>
          </div>
        )}
      </section>
      <footer>
        <p><strong>Responsável pela atualização:</strong> {dados.responsavel || "Não informado"}</p>
        <p>{AVISO_PROCESSUAL}</p>
        <p>{FINALIDADE_PROCESSUAL}</p>
      </footer>
    </article>
  );
}
