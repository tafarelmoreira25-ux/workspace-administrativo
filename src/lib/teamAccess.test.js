import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicarSugestaoAoFormulario,
  criarMapaResponsaveis,
  filtrarFuncionariosPorEquipe,
  normalizarSetorEquipe,
  obterResponsavelSugerido,
  resolverTipoAcesso,
} from "./teamAccess.js";

const equipe = [
  { id: 1, nome: "Ana", setor: "Administrativo", ativo: true },
  { id: 2, nome: "Bruno", setor: "Jurídico", ativo: true },
  { id: 3, nome: "Inativa", setor: "Jurídico", ativo: false },
];

test("normaliza os dois setores operacionais", () => {
  assert.equal(normalizarSetorEquipe("ADM"), "Administrativo");
  assert.equal(normalizarSetorEquipe("Jurídico / Processual"), "Jurídico");
});

test("resolve supervisor por perfil ou permissão, sem depender do nome", () => {
  assert.equal(resolverTipoAcesso({ perfil: "supervisor" }), "admin");
  assert.equal(
    resolverTipoAcesso({ permissoes: { gestao_equipe: true } }),
    "admin",
  );
  assert.equal(resolverTipoAcesso({ nome: "Nicolas", cargo: "Analista" }), "funcionaria");
});

test("cria o mapa e localiza a sugestão ativa", () => {
  const mapa = criarMapaResponsaveis([
    { categoria_tarefa: "CONTRATO", funcionaria_id: 2 },
  ]);
  assert.deepEqual(obterResponsavelSugerido("CONTRATO", mapa, equipe), {
    ...equipe[1],
    id: "2",
    equipe: "Jurídico",
  });
});

test("filtra responsáveis para impedir troca acidental de equipe", () => {
  assert.deepEqual(
    filtrarFuncionariosPorEquipe(equipe, "Jurídico").map((item) => item.id),
    [2],
  );
});

test("aplica sugestão e equipe como valores iniciais do formulário", () => {
  const formulario = aplicarSugestaoAoFormulario(
    { tipo: "", responsavelId: "", setorExecutor: "Administrativo" },
    "CONTRATO",
    { CONTRATO: "2" },
    equipe,
  );
  assert.equal(formulario.responsavelId, "2");
  assert.equal(formulario.setorExecutor, "Jurídico");
});
