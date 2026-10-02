import { FormActions, FormField, FormGrid, Input, Select, Textarea } from "../common/FormControls";
import { ChangeEvent, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { criarContextoAssistente } from "../../lib/emailWorkspace";
import { mensagemErroFuncao } from "../../lib/functionError";

type Cliente = { id: string | number; nome_completo: string; email?: string | null };
type Processo = {
  id: string;
  numero_processo?: string | null;
  reu?: string | null;
  banco_reu?: string | null;
  fase_atual?: string | null;
  situacao?: string | null;
  resultado?: string | null;
  status_judicial?: string | null;
};
type Analise = {
  resumo: string;
  pedido?: string | null;
  dados_extraidos?: string[];
  pendencias?: string[];
  prazo_mencionado?: string | null;
  alertas?: string[];
};
type Atendimento = {
  id: string;
  cliente_id?: string | null;
  processo_id?: string | null;
  cliente_nome: string;
  processo_numero?: string | null;
  data: string;
  hora?: string | null;
  canal: string;
  tipo?: string | null;
  descricao: string;
  responsavel?: string | null;
  created_at?: string | null;
};
type ArquivoPreparado = { nome: string; mimeType: string; base64: string };
type Props = {
  cliente: Cliente;
  processos: Processo[];
  usuario: { nome?: string; email?: string };
  onClose: () => void;
  onRegistrado?: (atendimento: Atendimento) => void;
  showToast?: (mensagem: string) => void;
};

function formatarAnalise(analise: Analise) {
  const secoes = [
    `Resumo: ${analise.resumo}`,
    analise.pedido ? `Pedido: ${analise.pedido}` : "",
    analise.prazo_mencionado ? `Prazo mencionado: ${analise.prazo_mencionado}` : "",
    analise.dados_extraidos?.length ? `Dados extraídos:\n${analise.dados_extraidos.map((item) => `• ${item}`).join("\n")}` : "",
    analise.pendencias?.length ? `Pendências:\n${analise.pendencias.map((item) => `• ${item}`).join("\n")}` : "",
    analise.alertas?.length ? `Pontos para conferência:\n${analise.alertas.map((item) => `• ${item}`).join("\n")}` : "",
  ];
  return secoes.filter(Boolean).join("\n\n");
}

function arquivoParaBase64(arquivo: File) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result || "").split(",")[1] || "");
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

export default function ContentAnalyzer({ cliente, processos, usuario, onClose, onRegistrado, showToast }: Props) {
  const [processoId, setProcessoId] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [arquivo, setArquivo] = useState<ArquivoPreparado | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const processo = useMemo(() => processos.find((item) => String(item.id) === processoId) || null, [processoId, processos]);

  function avisar(mensagem: string) {
    if (showToast) showToast(mensagem);
    else window.alert(mensagem);
  }

  async function selecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const selecionado = evento.target.files?.[0];
    setAnalise(null);
    if (!selecionado) {
      setArquivo(null);
      return;
    }
    if (selecionado.type !== "application/pdf") {
      evento.target.value = "";
      avisar("Selecione um arquivo PDF.");
      return;
    }
    if (selecionado.size > 8 * 1024 * 1024) {
      evento.target.value = "";
      avisar("O PDF deve ter no máximo 8 MB.");
      return;
    }
    try {
      setArquivo({ nome: selecionado.name, mimeType: selecionado.type, base64: await arquivoParaBase64(selecionado) });
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Não foi possível ler o PDF.");
    }
  }

  async function analisar() {
    if (!conteudo.trim() && !arquivo) {
      avisar("Cole o conteúdo do e-mail ou selecione um PDF.");
      return;
    }
    setAnalisando(true);
    setAnalise(null);
    const { data, error } = await supabase.functions.invoke("assistente-juridico", {
      body: {
        acao: "analisar_conteudo",
        conteudo,
        arquivo,
        contexto: criarContextoAssistente({ cliente, processo }),
      },
    });
    setAnalisando(false);
    if (error || !data?.resumo) {
      const detalhe = error ? await mensagemErroFuncao(error) : data?.erro || "O Gemini não retornou uma análise válida.";
      avisar(`Não foi possível analisar o conteúdo: ${detalhe}`);
      return;
    }
    setAnalise(data as Analise);
    avisar("Análise concluída. Confira o conteúdo antes de registrá-lo.");
  }

  async function copiar() {
    if (!analise) return;
    try {
      await navigator.clipboard.writeText(formatarAnalise(analise));
      avisar("Análise copiada.");
    } catch {
      avisar("Não foi possível copiar automaticamente.");
    }
  }

  async function registrar() {
    if (!analise) return;
    setSalvando(true);
    const { data, error } = await supabase.from("processual_atendimentos").insert({
      cliente_id: cliente.id,
      processo_id: processo?.id || null,
      cliente_nome: cliente.nome_completo,
      processo_numero: processo?.numero_processo || null,
      data: new Date().toISOString().slice(0, 10),
      hora: new Date().toTimeString().slice(0, 5),
      canal: "E-mail",
      tipo: "Resumo assistido",
      descricao: formatarAnalise(analise).slice(0, 12000),
      responsavel: usuario.nome || usuario.email || null,
      created_by_nome: usuario.nome || null,
      anexo_url: null,
    }).select("*").single();
    setSalvando(false);
    if (error) {
      avisar(`Não foi possível registrar a análise: ${error.message}`);
      return;
    }
    if (data && onRegistrado) onRegistrado(data as Atendimento);
    avisar("Resumo registrado no histórico de atendimentos.");
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="cliente-modal content-analyzer" role="dialog" aria-modal="true" aria-labelledby="content-analyzer-title">
        <header>
          <div><span className="eyebrow">Assistente Gemini</span><h3 id="content-analyzer-title">Analisar e-mail ou PDF</h3></div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="email-composer-body">
          <div className="email-safety-note">A análise é uma sugestão. Ela não altera o processo nem cria prazos automaticamente.</div>
          <FormGrid className="cliente-form-grid email-fields">
            <FormField className="wide">
              <span>Processo relacionado</span>
              <Select value={processoId} onChange={(evento) => setProcessoId(evento.target.value)}>
                <option value="">Sem processo específico</option>
                {processos.map((item) => <option key={item.id} value={String(item.id)}>{item.numero_processo || "Processo sem número"}</option>)}
              </Select>
            </FormField>
            <FormField className="wide">
              <span>Conteúdo do e-mail</span>
              <Textarea rows={9} value={conteudo} onChange={(evento) => { setConteudo(evento.target.value); setAnalise(null); }} placeholder="Cole aqui a conversa ou a mensagem recebida..." />
            </FormField>
            <FormField className="wide">
              <span>PDF opcional — máximo 8 MB</span>
              <Input type="file" accept="application/pdf,.pdf" onChange={selecionarArquivo} />
              {arquivo ? <small className="selected-file">Selecionado: {arquivo.nome}</small> : null}
            </FormField>
          </FormGrid>
          {analise ? (
            <section className="analysis-result" aria-live="polite">
              <h4>Resultado para conferência</h4>
              <pre>{formatarAnalise(analise)}</pre>
            </section>
          ) : null}
        </div>
        <FormActions className="email-composer-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          {analise ? <button type="button" className="btn-secondary" onClick={copiar}>Copiar análise</button> : null}
          {analise ? <button type="button" className="btn-primary" disabled={salvando} onClick={registrar}>{salvando ? "Registrando..." : "Registrar no histórico"}</button> : (
            <button type="button" className="btn-primary" disabled={analisando} onClick={analisar}>{analisando ? "Analisando..." : "Analisar com Gemini"}</button>
          )}
        </FormActions>
      </section>
    </div>
  );
}
