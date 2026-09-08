import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import "../operacional/operacionalProcessual.css";

type Usuario = { nome?: string; email?: string };
type DocumentoAcervo = {
  id: string;
  cliente_id?: string | null;
  processo_id?: string | null;
  nome_documento: string;
  modelo_nome: string;
  tipo_documento?: string | null;
  cliente_nome?: string | null;
  cpf_cnpj?: string | null;
  numero_processo?: string | null;
  versao?: number | null;
  status?: string | null;
  assinado?: boolean | null;
  responsavel_nome?: string | null;
  created_at?: string | null;
  comunicado_em?: string | null;
  comunicado_canal?: string | null;
  comunicado_observacao?: string | null;
};

type Props = { usuario: Usuario; showToast?: (mensagem: string) => void };
const STATUS_DOCUMENTO = ["Gerado", "Aguardando assinatura", "Assinado", "Anexado", "Enviado", "Substituído", "Cancelado"];
const CANAIS = ["WhatsApp", "Telefone", "E-mail", "Reunião", "Presencial", "Outro"];

function normalizar(valor = "") { return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function formatarData(data?: string | null) { if (!data) return "—"; return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data)); }

export default function DocumentosAcervo({ usuario, showToast }: Props) {
  const [documentos, setDocumentos] = useState<DocumentoAcervo[]>([]);
  const [busca, setBusca] = useState("");
  const [comunicando, setComunicando] = useState<DocumentoAcervo | null>(null);
  const [canal, setCanal] = useState("WhatsApp");
  const [observacao, setObservacao] = useState("");
  const [carregando, setCarregando] = useState(true);

  const avisar = useCallback((mensagem: string) => { showToast?.(mensagem); }, [showToast]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.from("documentos_juridicos").select("*").order("created_at", { ascending: false }).limit(700);
    if (error) avisar("Não foi possível carregar o acervo de documentos.");
    else setDocumentos((data || []) as DocumentoAcervo[]);
    setCarregando(false);
  }, [avisar]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    return documentos.filter((doc) => !termo || normalizar(`${doc.cliente_nome || ""} ${doc.cpf_cnpj || ""} ${doc.numero_processo || ""} ${doc.tipo_documento || ""} ${doc.nome_documento} ${doc.modelo_nome}`).includes(termo));
  }, [busca, documentos]);

  async function atualizarDocumento(documento: DocumentoAcervo, parcial: Partial<DocumentoAcervo>) {
    const { data, error } = await supabase.from("documentos_juridicos").update(parcial).eq("id", documento.id).select("*").single();
    if (error) { avisar("Não foi possível atualizar o documento."); return; }
    setDocumentos((atuais) => atuais.map((item) => item.id === documento.id ? data as DocumentoAcervo : item));
    avisar("Documento atualizado.");
  }

  async function marcarComunicado() {
    if (!comunicando) return;
    const agora = new Date().toISOString();
    const parcial = { comunicado_em: agora, comunicado_canal: canal, comunicado_observacao: observacao.trim() || null };
    const { data, error } = await supabase.from("documentos_juridicos").update(parcial).eq("id", comunicando.id).select("*").single();
    if (!error) {
      await supabase.from("processual_atendimentos").insert({
        cliente_id: comunicando.cliente_id || null,
        processo_id: comunicando.processo_id || null,
        cliente_nome: comunicando.cliente_nome || "Cliente não informado",
        processo_numero: comunicando.numero_processo || null,
        data: agora.slice(0, 10),
        hora: new Date().toTimeString().slice(0, 5),
        canal,
        tipo: "Comunicação de documento",
        descricao: observacao.trim() || `Documento comunicado: ${comunicando.nome_documento}`,
        responsavel: usuario.nome || null,
        created_by_nome: usuario.nome || usuario.email || null,
      });
    }
    if (error) { avisar("Não foi possível marcar comunicação."); return; }
    setDocumentos((atuais) => atuais.map((item) => item.id === comunicando.id ? data as DocumentoAcervo : item));
    setComunicando(null); setObservacao(""); setCanal("WhatsApp");
    avisar("Comunicação registrada e atendimento criado.");
  }

  return <section className="operacional-module">
    <header className="module-page-header"><div><span className="eyebrow">Acervo</span><h2>Documentos</h2><p>Documentos gerados e vinculados a clientes, processos e responsáveis.</p></div></header>
    <div className="operacional-toolbar"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar cliente, CPF, processo, tipo ou documento..." /><button className="btn-secondary" onClick={carregar} type="button">Atualizar</button></div>
    <section className="operacional-card"><div className="operacional-table"><table><thead><tr><th>Cliente</th><th>Processo</th><th>Tipo</th><th>Documento</th><th>Data</th><th>Versão</th><th>Status</th><th>Assinado</th><th>Responsável</th><th>Ações</th></tr></thead><tbody>{carregando ? <tr><td colSpan={10}>Carregando...</td></tr> : filtrados.length === 0 ? <tr><td colSpan={10}>Nenhum documento encontrado.</td></tr> : filtrados.map((doc) => <tr key={doc.id}><td><strong>{doc.cliente_nome || "—"}</strong><small>{doc.cpf_cnpj || ""}</small></td><td>{doc.numero_processo || "—"}</td><td>{doc.tipo_documento || doc.modelo_nome}</td><td>{doc.nome_documento}</td><td>{formatarData(doc.created_at)}</td><td>{String(doc.versao || 1).padStart(2, "0")}</td><td><select value={doc.status || "Gerado"} onChange={(e) => atualizarDocumento(doc, { status: e.target.value })}>{STATUS_DOCUMENTO.map((item) => <option key={item}>{item}</option>)}</select></td><td><input type="checkbox" checked={Boolean(doc.assinado)} onChange={(e) => atualizarDocumento(doc, { assinado: e.target.checked, status: e.target.checked ? "Assinado" : doc.status || "Gerado" })} /></td><td>{doc.responsavel_nome || "—"}</td><td><button className="btn-secondary compact" type="button" onClick={() => setComunicando(doc)}>Marcar comunicado</button></td></tr>)}</tbody></table></div></section>
    {comunicando ? <div className="modal-backdrop"><section className="cliente-modal"><header><div><span className="eyebrow">Comunicação</span><h3>Marcar como comunicado</h3></div><button className="drawer-close" onClick={() => setComunicando(null)} type="button">×</button></header><div className="cliente-form-grid"><label><span>Data</span><input value={new Date().toLocaleString("pt-BR")} readOnly /></label><label><span>Canal</span><select value={canal} onChange={(e) => setCanal(e.target.value)}>{CANAIS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>Observação</span><textarea rows={4} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></label></div><footer><button className="btn-secondary" onClick={() => setComunicando(null)} type="button">Cancelar</button><button className="btn-primary" onClick={marcarComunicado} type="button">Salvar comunicação</button></footer></section></div> : null}
  </section>;
}
