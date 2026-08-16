import test from "node:test";
import assert from "node:assert/strict";
import {
  linkPastaGoogleDrive,
  normalizarNomeClienteDrive,
} from "./googleDriveClients.js";

test("normaliza o padrão atual das pastas de clientes ativos", () => {
  assert.equal(
    normalizarNomeClienteDrive("2026 - .EDSON DA SILVA OLIVEIRA - ATIVO"),
    "EDSON DA SILVA OLIVEIRA",
  );
  assert.equal(
    normalizarNomeClienteDrive("2026 - MARIA DE SOUZA - ATIVA"),
    "MARIA DE SOUZA",
  );
});

test("preserva nomes que não usam o padrão de status", () => {
  assert.equal(normalizarNomeClienteDrive("João da Silva"), "João da Silva");
});

test("monta o link estável usando o id da pasta", () => {
  assert.equal(
    linkPastaGoogleDrive("folder_123"),
    "https://drive.google.com/drive/folders/folder_123",
  );
});
