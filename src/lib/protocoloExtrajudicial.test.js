import assert from "node:assert/strict";
import test from "node:test";
import { numeroProtocoloExtrajudicial } from "./protocoloExtrajudicial.js";

test("monta o protocolo extrajudicial com ID CRM e ano de início", () => {
  assert.equal(numeroProtocoloExtrajudicial({ id_crm: "72528", data_inicio_extrajudicial: "2026-09-28" }), "72528/2026");
});

test("prioriza o protocolo persistido e não duplica o ano", () => {
  assert.equal(numeroProtocoloExtrajudicial({ id_crm: "72528", protocolo_extrajudicial: "72528/2025" }), "72528/2025");
  assert.equal(numeroProtocoloExtrajudicial({ id_crm: "72528/2026" }), "72528/2026");
});

test("usa o identificador da pasta nos registros históricos sem id_crm preenchido", () => {
  assert.equal(numeroProtocoloExtrajudicial({ pasta_cliente_id: "4812", created_at: "2024-03-10T10:00:00Z" }), "4812/2024");
});
