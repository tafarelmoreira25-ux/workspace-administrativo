function normalizar(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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

