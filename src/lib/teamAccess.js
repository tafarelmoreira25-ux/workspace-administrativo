export const EQUIPES_OPERACIONAIS = ["Administrativo", "Jurídico"];

export const PERMISSOES_PADRAO = Object.freeze({
  tarefas: true,
  delegar: true,
  acompanhar_equipe: true,
  clientes: true,
  planner: true,
  documentos: true,
});

function normalizar(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizarSetorEquipe(valor) {
  const setor = normalizar(valor);
  if (setor.includes("jurid") || setor.includes("processual")) return "Jurídico";
  if (setor.includes("administr") || setor === "adm") return "Administrativo";
  return "";
}

export function resolverTipoAcesso(funcionario, adminEmail = "") {
  const perfil = normalizar(funcionario?.perfil || funcionario?.tipo);
  const cargo = normalizar(funcionario?.cargo);
  const email = normalizar(funcionario?.email);
  const emailAdministrador = normalizar(adminEmail);
  const permissoes = funcionario?.permissoes || {};

  if (
    ["admin", "administrador", "gestor", "supervisor"].includes(perfil) ||
    cargo.includes("supervisor") ||
    permissoes.gestao_equipe === true ||
    (emailAdministrador && email === emailAdministrador)
  ) {
    return "admin";
  }

  return "funcionaria";
}

export function permissoesDoUsuario(usuario) {
  if (usuario?.tipo === "admin") {
    return Object.fromEntries(
      Object.keys(PERMISSOES_PADRAO).map((chave) => [chave, true]),
    );
  }

  return {
    ...PERMISSOES_PADRAO,
    ...(usuario?.permissoes || {}),
  };
}

export function criarMapaResponsaveis(registros = []) {
  return Object.fromEntries(
    registros.map((registro) => [
      registro.categoria_tarefa,
      registro.funcionaria_id == null ? "" : String(registro.funcionaria_id),
    ]),
  );
}

export function obterResponsavelSugerido(
  categoria,
  responsaveisPorFuncao = {},
  funcionarios = [],
) {
  const id = responsaveisPorFuncao[categoria];
  if (!id) return null;

  const funcionario = funcionarios.find(
    (item) => String(item.id) === String(id) && item.ativo !== false,
  );
  if (!funcionario) return null;

  return {
    ...funcionario,
    id: String(funcionario.id),
    equipe: normalizarSetorEquipe(funcionario.setor || funcionario.cargo),
  };
}

export function filtrarFuncionariosPorEquipe(funcionarios = [], equipe = "") {
  const equipeNormalizada = normalizarSetorEquipe(equipe);
  const ativos = funcionarios.filter((funcionario) => funcionario.ativo !== false);
  if (!equipeNormalizada) return ativos;

  return ativos.filter(
    (funcionario) =>
      normalizarSetorEquipe(funcionario.setor || funcionario.cargo) ===
      equipeNormalizada,
  );
}

export function aplicarSugestaoAoFormulario(
  formulario,
  categoria,
  responsaveisPorFuncao,
  funcionarios,
) {
  const sugestao = obterResponsavelSugerido(
    categoria,
    responsaveisPorFuncao,
    funcionarios,
  );

  return {
    ...formulario,
    tipo: categoria,
    responsavelId: sugestao?.id || "",
    setorExecutor: sugestao?.equipe || formulario.setorExecutor,
  };
}
