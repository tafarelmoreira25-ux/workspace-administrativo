const GRUPOS = [
  ["Identificação do processo", [
    ["numero_processo", "Número do processo / protocolo"],
    ["origem", "Origem / Tribunal / Vara", "longo"],
    ["segredo_sigilo", "Segredo ou sigilo", "sim-nao"],
    ["justica_gratuita", "Justiça gratuita", "sim-nao"],
    ["data_distribuicao", "Data da distribuição", "data"],
    ["nome_cliente", "Nome do cliente"],
    ["reu", "Réu / Instituição financeira"],
    ["advogado_cliente", "Advogado(a) do cliente"],
    ["advogado_reu", "Advogado(a) do réu / Instituição financeira"],
    ["assunto", "Assunto / Natureza da ação", "longo"],
  ]],
  ["Andamento processual", [
    ["status_atual", "Status atual", "longo"],
    ["data_ultima_movimentacao", "Data da última movimentação", "data"],
    ["descricao_ultima_movimentacao", "Descrição da última movimentação", "longo"],
    ["proximos_passos", "Próximos passos", "longo"],
  ]],
  ["Consulta e acompanhamento", [
    ["data_consulta", "Data da última consulta", "data"],
    ["hora_consulta", "Hora da consulta", "hora"],
    ["link_anexos_documentos", "Link dos anexos/documentos do processo", "url"],
    ["representante_responsavel", "Representante responsável pelo acompanhamento"],
    ["link_movimentacoes", "Link para consulta das movimentações", "url"],
  ]],
];

function Campo({ nome, rotulo, tipo, valor, pendente, onChange }) {
  const classeLonga = tipo === "longo" || tipo === "url";
  const propriedades = {
    value: valor || "",
    onChange: (event) => onChange(nome, event.target.value),
  };

  let controle;
  if (tipo === "longo") {
    controle = <textarea rows="4" {...propriedades} />;
  } else if (tipo === "sim-nao") {
    controle = <select {...propriedades}>
      <option value="">Selecione...</option>
      <option value="Sim">Sim</option>
      <option value="Não">Não</option>
      <option value="Não informado">Não informado</option>
    </select>;
  } else {
    const inputType = tipo === "data" ? "date" : tipo === "hora" ? "time" : tipo === "url" ? "url" : "text";
    controle = <input type={inputType} placeholder={tipo === "url" ? "https://..." : ""} {...propriedades} />;
  }

  return (
    <label className={`${classeLonga ? "span-2" : ""} ${pendente ? "field-review" : ""}`}>
      {rotulo}
      {controle}
      {pendente && <small>Não identificado pelo interpretador — complete ou revise.</small>}
    </label>
  );
}

export default function ProcessualFormulario({ dados, onChange, naoIdentificados }) {
  return (
    <div className="processual-form-sections">
      {GRUPOS.map(([titulo, campos]) => (
        <fieldset key={titulo}>
          <legend>{titulo}</legend>
          <div className="employee-profile-grid">
            {campos.map(([nome, rotulo, tipo]) => (
              <Campo
                dados={dados}
                key={nome}
                nome={nome}
                onChange={onChange}
                pendente={naoIdentificados.includes(nome)}
                rotulo={rotulo}
                tipo={tipo}
                valor={dados[nome]}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
