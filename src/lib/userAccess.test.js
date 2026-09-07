import test from "node:test";
import assert from "node:assert/strict";
import { resolverTipoAcesso } from "./userAccess.js";

test("preserva o acesso administrativo dos perfis existentes", () => {
  assert.equal(resolverTipoAcesso({ perfil: "supervisor" }), "admin");
  assert.equal(resolverTipoAcesso({ permissoes: { gestao_equipe: true } }), "admin");
  assert.equal(resolverTipoAcesso({ email: "ADMIN@EXAMPLE.COM" }, "admin@example.com"), "admin");
  assert.equal(resolverTipoAcesso({ nome: "Nicolas", cargo: "Analista" }), "funcionaria");
});
