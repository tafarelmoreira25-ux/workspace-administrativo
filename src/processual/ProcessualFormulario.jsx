const GRUPOS = [
  ["Dados do processo", [["tribunal","Tribunal"],["forum_comarca","Fórum ou comarca"],["vara","Vara"],["cidade_estado","Cidade/estado"],["cliente_autor","Cliente/autor"],["instituicao_reu","Instituição financeira/réu"],["numero_processo","Número do processo"],["data_distribuicao","Data da distribuição"],["juiz_responsavel","Juiz responsável"],["data_consulta","Data da consulta"],["responsavel","Responsável pela atualização"]]],
  ["Andamento processual", [["status_atual","Status atual"],["ultima_movimentacao","Última movimentação"],["proximos_passos","Próximos passos"],["observacao_cliente","Observação complementar para o cliente"],["observacao_interna","Observação interna (não aparece no PDF)"]]],
];

export default function ProcessualFormulario({ dados, onChange, naoIdentificados }) {
  return <div className="processual-form-sections">{GRUPOS.map(([titulo, campos]) => <fieldset key={titulo}><legend>{titulo}</legend><div className="employee-profile-grid">{campos.map(([nome, rotulo]) => {
    const longo = ["status_atual","ultima_movimentacao","proximos_passos","observacao_cliente","observacao_interna"].includes(nome);
    return <label className={`${longo ? "span-2" : ""} ${naoIdentificados.includes(nome) ? "field-review" : ""}`} key={nome}>{rotulo}{longo ? <textarea rows="4" value={dados[nome]} onChange={(e) => onChange(nome,e.target.value)} /> : <input value={dados[nome]} onChange={(e) => onChange(nome,e.target.value)} />}{naoIdentificados.includes(nome) && <small>Não identificado — revise este campo.</small>}</label>;
  })}</div></fieldset>)}</div>;
}
