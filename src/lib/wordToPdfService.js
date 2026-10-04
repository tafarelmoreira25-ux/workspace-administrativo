import { supabase } from "./supabase";

function mensagemDaFalha(error) {
  if (!error) return "Falha desconhecida na conversão.";
  return error.message || String(error);
}

async function detalheDaResposta(error) {
  const resposta = error?.context;
  if (!(resposta instanceof Response)) return "";
  try {
    const dados = await resposta.clone().json();
    return dados?.erro || dados?.detalhe || "";
  } catch {
    try { return await resposta.clone().text(); } catch { return ""; }
  }
}

export async function converterDocxParaPdfOficial(bytes, nome = "documento.docx") {
  const origem = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const corpo = origem.buffer.slice(origem.byteOffset, origem.byteOffset + origem.byteLength);
  const nomeSeguro = String(nome || "documento.docx").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const { data, error } = await supabase.functions.invoke("converter-docx-pdf", {
    body: corpo,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "x-document-name": nomeSeguro,
    },
  });

  if (error) {
    const detalhe = await detalheDaResposta(error);
    throw new Error(detalhe || `A conversão oficial do Word para PDF falhou: ${mensagemDaFalha(error)}`);
  }
  if (!(data instanceof Blob)) throw new Error("O conversor oficial não retornou um arquivo PDF válido.");
  const pdf = new Uint8Array(await data.arrayBuffer());
  if (pdf.length < 5 || String.fromCharCode(...pdf.slice(0, 5)) !== "%PDF-") {
    throw new Error("O conversor oficial retornou um conteúdo que não é PDF.");
  }
  return pdf;
}
