import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const STATUS = [
  ["tramitando", "Tramitando"],
  ["arquivado", "Arquivado"],
  ["improcedente", "Improcedente"],
  ["procedente", "Procedente"],
  ["parcialmente_procedente", "Parcialmente procedente"],
  ["nao_confirmado", "Não confirmado"],
  ["outro", "Outro"],
];

const EMPTY_FORM = {
  id: null, nome_cliente: "", numero_processo: "", reu: "", data_distribuicao: "",
  tribunal: "", comarca: "", vara: "", status_categoria: "", status_original: "",
  justica_gratuita: "", emenda_inicial: "", link_processo: "", movimentacoes: "",
  observacoes: "", tratativas: "",
};

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function statusLabel(value) {
  return STATUS.find(([key]) => key === value)?.[1] || "Não informado";
}

function withTimeout(promise, milliseconds = 20_000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("A consulta excedeu 20 segundos. Tente atualizar novamente.")), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function dateBR(value) {
  if (!value) return "Não identificada";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

export default function CarteiraProcessual({ podeEditar = false, showToast }) {
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await withTimeout(supabase.rpc("listar_processos_clientes"));
      if (queryError) throw queryError;
      setRecords(data || []);
    } catch (loadError) {
      setError(loadError?.message || "Não foi possível carregar a carteira processual.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    withTimeout(supabase.rpc("listar_processos_clientes"))
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) throw queryError;
        setRecords(data || []);
      })
      .catch((loadError) => {
        if (active) setError(loadError?.message || "Não foi possível carregar a carteira processual.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return records.filter((record) => {
      if (statusFilter !== "todos" && record.status_categoria !== statusFilter) return false;
      if (!needle) return true;
      return normalize([
        record.nome_cliente, record.numero_processo, record.reu, record.status_original,
        record.tribunal, record.comarca, record.vara, record.observacoes,
      ].join(" ")).includes(needle);
    });
  }, [query, records, statusFilter]);

  const metrics = useMemo(() => ({
    total: records.length,
    tramitando: records.filter((record) => record.status_categoria === "tramitando").length,
    arquivados: records.filter((record) => record.status_categoria === "arquivado").length,
    sentenciados: records.filter((record) => ["improcedente", "procedente", "parcialmente_procedente"].includes(record.status_categoria)).length,
    incompletos: records.filter((record) => record.incompleto).length,
  }), [records]);

  function edit(record) {
    setForm(Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, record[key] ?? ""])));
    window.setTimeout(() => document.querySelector(".portfolio-process-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function change(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const { error: saveError } = await withTimeout(supabase.rpc("salvar_processo_cliente", {
        p_id: Number(form.id), p_numero_processo: form.numero_processo.trim() || null,
        p_reu: form.reu.trim() || null, p_data_distribuicao: form.data_distribuicao || null,
        p_tribunal: form.tribunal.trim() || null, p_comarca: form.comarca.trim() || null,
        p_vara: form.vara.trim() || null, p_status_categoria: form.status_categoria || null,
        p_status_original: form.status_original.trim() || null,
        p_justica_gratuita: form.justica_gratuita.trim() || null,
        p_emenda_inicial: form.emenda_inicial.trim() || null,
        p_link_processo: form.link_processo.trim() || null,
        p_movimentacoes: form.movimentacoes || null, p_observacoes: form.observacoes || null,
        p_tratativas: form.tratativas || null,
      }));
      if (saveError) throw saveError;
      setForm(EMPTY_FORM);
      await load();
      showToast?.("Processo atualizado na carteira histórica.");
    } catch (saveError) {
      window.alert(`Não foi possível salvar o processo: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="portfolio-process-section">
      <div className="process-status-section-heading">
        <div><span>Base histórica completa</span><h3>Carteira de processos protocolados</h3></div>
        <button type="button" onClick={load} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</button>
      </div>

      <div className="portfolio-process-metrics">
        <div><span>Total</span><strong>{metrics.total}</strong></div>
        <div><span>Tramitando</span><strong>{metrics.tramitando}</strong></div>
        <div><span>Arquivados</span><strong>{metrics.arquivados}</strong></div>
        <div><span>Sentenciados</span><strong>{metrics.sentenciados}</strong></div>
        <div><span>Incompletos</span><strong>{metrics.incompletos}</strong></div>
      </div>

      {error && <div className="process-status-error" role="alert">{error}</div>}

      {form.id && podeEditar && (
        <form className="portfolio-process-editor" onSubmit={save}>
          <div className="process-status-section-heading">
            <div><span>Complementação posterior</span><h3>{form.nome_cliente}</h3></div>
            <button type="button" onClick={() => setForm(EMPTY_FORM)}>Cancelar edição</button>
          </div>
          <div className="process-status-form-grid">
            <label>Número do processo<input value={form.numero_processo} onChange={(event) => change("numero_processo", event.target.value)} /></label>
            <label>Instituição financeira / réu<input value={form.reu} onChange={(event) => change("reu", event.target.value)} /></label>
            <label>Data de distribuição<input type="date" value={form.data_distribuicao} onChange={(event) => change("data_distribuicao", event.target.value)} /></label>
            <label>Categoria do status<select value={form.status_categoria} onChange={(event) => change("status_categoria", event.target.value)}><option value="">Não informado</option>{STATUS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Status original<input value={form.status_original} onChange={(event) => change("status_original", event.target.value)} /></label>
            <label>Justiça gratuita<input value={form.justica_gratuita} onChange={(event) => change("justica_gratuita", event.target.value)} /></label>
            <label>Emenda inicial<input value={form.emenda_inicial} onChange={(event) => change("emenda_inicial", event.target.value)} /></label>
            <label>Tribunal<input value={form.tribunal} onChange={(event) => change("tribunal", event.target.value)} /></label>
            <label>Comarca<input value={form.comarca} onChange={(event) => change("comarca", event.target.value)} /></label>
            <label>Vara<input value={form.vara} onChange={(event) => change("vara", event.target.value)} /></label>
            <label className="portfolio-process-wide">Link processual<input type="url" value={form.link_processo} onChange={(event) => change("link_processo", event.target.value)} /></label>
          </div>
          <label className="process-status-observation">Movimentações<textarea value={form.movimentacoes} onChange={(event) => change("movimentacoes", event.target.value)} /></label>
          <label className="process-status-observation">Observações<textarea value={form.observacoes} onChange={(event) => change("observacoes", event.target.value)} /></label>
          <label className="process-status-observation">Tratativas<textarea value={form.tratativas} onChange={(event) => change("tratativas", event.target.value)} /></label>
          <button className="process-status-save" disabled={saving} type="submit">{saving ? "Salvando..." : "Salvar processo"}</button>
        </form>
      )}

      <div className="process-status-filters">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, processo, réu, comarca ou observação" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="todos">Todos os status</option>
          {STATUS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {loading ? <p className="process-status-empty">Carregando carteira processual...</p> : (
        filtered.length === 0 ? <p className="process-status-empty">Nenhum processo encontrado neste filtro.</p> : (
          <div className="portfolio-process-list">
            {filtered.map((record) => (
              <article className={`portfolio-process-card portfolio-process-${record.status_categoria || "outro"}`} key={record.id}>
                <div className="process-status-card-heading">
                  <div><span>Cliente / autor</span><h3>{record.nome_cliente}</h3></div>
                  <div className="portfolio-process-badges">
                    {record.incompleto && <strong className="portfolio-incomplete">Incompleto</strong>}
                    <strong className="process-status-badge process-status-badge-progress">{record.status_original || statusLabel(record.status_categoria)}</strong>
                  </div>
                </div>
                <div className="portfolio-process-details">
                  <div><span>Processo</span><strong>{record.numero_processo || "Aguardando número"}</strong></div>
                  <div><span>Réu</span><strong>{record.reu || "Não informado"}</strong></div>
                  <div><span>Distribuição</span><strong>{dateBR(record.data_distribuicao)}</strong></div>
                  <div><span>Justiça gratuita</span><strong>{record.justica_gratuita || "Não informado"}</strong></div>
                  <div><span>Emenda inicial</span><strong>{record.emenda_inicial || "Não informado"}</strong></div>
                  <div><span>Tribunal / comarca / vara</span><strong>{[record.tribunal, record.comarca, record.vara].filter(Boolean).join(" · ") || "Não informado"}</strong></div>
                </div>
                {record.observacoes && <p className="process-status-card-note">{record.observacoes}</p>}
                <div className="process-status-card-footer">
                  <small>Registro histórico acessível independentemente da situação atual.</small>
                  <div>
                    {record.link_processo && <a href={record.link_processo} target="_blank" rel="noreferrer">Abrir consulta processual</a>}
                    {podeEditar && <button type="button" onClick={() => edit(record)}>Editar / complementar</button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </section>
  );
}
