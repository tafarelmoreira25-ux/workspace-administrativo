import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  EMAIL_TEMPLATES,
  criarContextoAssistente,
  criarDescricaoHistoricoEmail,
  criarRascunhoEmail,
  criarUrlComposicaoGmail,
} from "../../lib/emailWorkspace";

type Cliente = {
  id: string | number;
  nome_completo: string;
  email?: string | null;
};

type Processo = {
  id: string;
  cliente_id?: string | null;
  numero_processo?: string | null;
  reu?: string | null;
  banco_reu?: string | null;
  fase_atual?: string | null;
  situacao?: string | null;
  resultado?: string | null;
  status_judicial?: string | null;
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

type Props = {
  cliente: Cliente;
  processos: Processo[];
  processoInicial?: Processo | null;
  usuario: { nome?: string; email?: string };
  onClose: () => void;
  onRegistrado?: (atendimento: Atendimento) => void;
  showToast?: (mensagem: string) => void;
};

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function agora() {
  return new Date().toTimeString().slice(0, 5);
}

export default function EmailComposer({ cliente, processos, processoInicial, usuario, onClose, onRegistrado, showToast }: Props) {
  const processoInicialId = processoInicial ? String(processoInicial.id) : "";
  const [processoId, setProcessoId] = useState(processoInicialId);
  const [modeloId, setModeloId] = useState("atualizacao");
  const processo = useMemo(() => processos.find((item) => String(item.id) === processoId) || null, [processoId, processos]);
  const rascunhoInicial = useMemo(() => criarRascunhoEmail({ modeloId: "atualizacao", cliente, processo: processoInicial || null }), [cliente, processoInicial]);
  const [destinatario, setDestinatario] = useState(cliente.email || "");
  const [assunto, setAssunto] = useState(rascunhoInicial.assunto);
  const [corpo, setCorpo] = useState(rascunhoInicial.corpo);
  const [registrarHistorico, setRegistrarHistorico] = useState(true);
  const [revisando, setRevisando] = useState(false);
  const [abrindo, setAbrindo] = useState(false);

  function avisar(mensagem: string) {
    if (showToast) showToast(mensagem);
    else window.alert(mensagem);
  }

  function aplicarModelo(novoModeloId: string, processoAtual = processo) {
    setModeloId(novoModeloId);
    const rascunho = criarRascunhoEmail({ modeloId: novoModeloId, cliente, processo: processoAtual });
    setAssunto(rascunho.assunto);
    setCorpo(rascunho.corpo);
  }

  function alterarProcesso(novoId: string) {
    const novoProcesso = processos.find((item) => String(item.id) === novoId) || null;
    setProcessoId(novoId);
    aplicarModelo(modeloId, novoProcesso);
  }

  async function revisarComGemini() {
    if (!corpo.trim()) {
      avisar("Escreva o conteúdo antes de solicitar a revisão.");
      return;
    }
    setRevisando(true);
    const { data, error } = await supabase.functions.invoke("assistente-juridico", {
      body: {
        acao: "revisar_email",
        assunto,
        conteudo: corpo,
        contexto: criarContextoAssistente({ cliente, processo }),
      },
    });
    setRevisando(false);
    if (error || !data?.conteudo) {
      avisar(error?.message
        ? `Gemini indisponível: ${error.message}`
        : "Gemini ainda não está configurado no backend.");
      return;
    }
    setAssunto(data.assunto || assunto);
    setCorpo(data.conteudo);
    avisar("Texto revisado. Confira todo o conteúdo antes de enviar.");
  }

  async function copiarTexto() {
    const texto = `Assunto: ${assunto}\n\n${corpo}`;
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Assunto e mensagem copiados.");
    } catch {
      avisar("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
    }
  }

  async function registrarRascunho() {
    const payload = {
      cliente_id: cliente.id,
      processo_id: processo?.id || null,
      cliente_nome: cliente.nome_completo,
      processo_numero: processo?.numero_processo || null,
      data: hoje(),
      hora: agora(),
      canal: "E-mail",
      tipo: "Rascunho preparado",
      descricao: criarDescricaoHistoricoEmail({ assunto, corpo }),
      responsavel: usuario.nome || usuario.email || null,
      created_by_nome: usuario.nome || null,
    };
    const { data, error } = await supabase.from("processual_atendimentos").insert(payload).select("*").single();
    if (error) throw error;
    if (data && onRegistrado) onRegistrado(data as Atendimento);
  }

  async function abrirGmail() {
    if (!assunto.trim() || !corpo.trim()) {
      avisar("Preencha o assunto e a mensagem.");
      return;
    }
    const janela = window.open("", "_blank");
    if (!janela) {
      avisar("O navegador bloqueou a nova janela. Libere pop-ups para abrir o Gmail.");
      return;
    }
    janela.opener = null;
    janela.location.href = criarUrlComposicaoGmail({ destinatario, assunto, corpo });
    if (!registrarHistorico) return;
    setAbrindo(true);
    try {
      await registrarRascunho();
      avisar("Gmail aberto e preparação registrada no histórico.");
    } catch (erro) {
      avisar(`O Gmail foi aberto, mas o histórico não pôde ser registrado: ${erro instanceof Error ? erro.message : "erro desconhecido"}`);
    } finally {
      setAbrindo(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="cliente-modal email-composer" role="dialog" aria-modal="true" aria-labelledby="email-composer-title">
        <header>
          <div>
            <span className="eyebrow">Comunicação com o cliente</span>
            <h3 id="email-composer-title">Preparar e-mail</h3>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="email-composer-body">
          <div className="email-safety-note">
            O sistema prepara o texto e abre o Gmail. Revise as informações antes de enviar; nenhum e-mail é disparado automaticamente.
          </div>

          <div className="cliente-form-grid email-fields">
            <label>
              <span>Modelo</span>
              <select value={modeloId} onChange={(evento) => aplicarModelo(evento.target.value)}>
                {EMAIL_TEMPLATES.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>)}
              </select>
            </label>
            <label>
              <span>Processo relacionado</span>
              <select value={processoId} onChange={(evento) => alterarProcesso(evento.target.value)}>
                <option value="">Sem processo específico</option>
                {processos.map((item) => <option key={item.id} value={String(item.id)}>{item.numero_processo || "Processo sem número"}</option>)}
              </select>
            </label>
            <label className="wide">
              <span>Destinatário</span>
              <input type="email" value={destinatario} onChange={(evento) => setDestinatario(evento.target.value)} placeholder="cliente@exemplo.com" />
            </label>
            <label className="wide">
              <span>Assunto</span>
              <input value={assunto} onChange={(evento) => setAssunto(evento.target.value)} />
            </label>
            <label className="wide">
              <span>Mensagem</span>
              <textarea rows={14} value={corpo} onChange={(evento) => setCorpo(evento.target.value)} />
            </label>
          </div>

          <label className="email-history-option">
            <input type="checkbox" checked={registrarHistorico} onChange={(evento) => setRegistrarHistorico(evento.target.checked)} />
            Registrar como “Rascunho preparado” no histórico de atendimentos
          </label>
        </div>

        <footer className="email-composer-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn-secondary" onClick={copiarTexto}>Copiar texto</button>
          <button type="button" className="btn-secondary" disabled={revisando} onClick={revisarComGemini}>{revisando ? "Revisando..." : "Revisar com Gemini"}</button>
          <button type="button" className="btn-primary" disabled={abrindo} onClick={abrirGmail}>{abrindo ? "Registrando..." : "Abrir no Gmail"}</button>
        </footer>
      </section>
    </div>
  );
}
