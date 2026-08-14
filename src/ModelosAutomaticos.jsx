import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const vazio = () => ({ id: null, nome: "", titulo: "", descricao: "", categoria: "GOV", prioridade: "normal", pontos_tarefa: 10, prazo_dias: 1, exibir_tv: true, ativo: true });

export default function ModelosAutomaticos({ funcionarios, categorias, onAplicado, onSuccess }) {
  const [modelos, setModelos] = useState([]);
  const [form, setForm] = useState(vazio);
  const [responsaveis, setResponsaveis] = useState({});
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("modelos_tarefa").select("*").order("nome");
    if (error) throw error;
    setModelos(data || []);
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.from("modelos_tarefa").select("*").order("nome").then(({ data, error }) => {
      if (error) return console.error("Erro ao carregar modelos:", error);
      if (ativo) setModelos(data || []);
    });
    return () => { ativo = false; };
  }, []);

  async function salvar(e) {
    e.preventDefault(); setSalvando(true);
    const { error } = await supabase.rpc("salvar_modelo_tarefa_supervisor", {
      p_id: form.id, p_nome: form.nome, p_titulo: form.titulo, p_descricao: form.descricao || null,
      p_categoria: form.categoria, p_prioridade: form.prioridade, p_pontos: Number(form.pontos_tarefa),
      p_prazo_dias: Number(form.prazo_dias), p_exibir_tv: form.exibir_tv, p_ativo: form.ativo,
    });
    setSalvando(false);
    if (error) return alert(`Não foi possível salvar o modelo: ${error.message}`);
    setForm(vazio()); await carregar(); onSuccess("Modelo automático salvo.");
  }

  async function aplicar(modelo) {
    const funcionarioId = responsaveis[modelo.id];
    if (!funcionarioId) return alert("Selecione a responsável pela tarefa.");
    const { error } = await supabase.rpc("aplicar_modelo_tarefa_supervisor", { p_modelo_id: modelo.id, p_funcionaria_id: Number(funcionarioId) });
    if (error) return alert(`Não foi possível aplicar o modelo: ${error.message}`);
    await onAplicado(); onSuccess("Tarefa criada a partir do modelo.");
  }

  return <div className="automation-workspace">
    <section className="panel automation-heading"><div><span className="eyebrow">Biblioteca operacional</span><h2>Modelos automáticos</h2><p>Use esta área para salvar tarefas que se repetem. Cadastre uma vez o título, a descrição, o prazo e os pontos; depois escolha a responsável e clique em Gerar tarefa.</p><div className="automation-help"><strong>Exemplo:</strong> crie o modelo “Solicitar documentos ao cliente”. Sempre que precisar, selecione a colaboradora e o Platino abrirá a tarefa completa automaticamente.</div></div><strong>{modelos.filter((m) => m.ativo).length} ativos</strong></section>
    <section className="automation-grid">
      <div className="panel"><h2>{form.id ? "Editar modelo" : "Novo modelo"}</h2><form className="stack-form" onSubmit={salvar}>
        <label>Nome do modelo<input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
        <label>Título gerado<input required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></label>
        <label>Descrição<textarea rows="4" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label>
        <div className="task-form-row"><label>Categoria<select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label><label>Prioridade<select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label></div>
        <div className="task-form-row"><label>Pontos<input min="0" type="number" value={form.pontos_tarefa} onChange={(e) => setForm({ ...form, pontos_tarefa: e.target.value })} /></label><label>Prazo em dias<input min="0" type="number" value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })} /></label></div>
        <div className="permission-grid"><label><input type="checkbox" checked={form.exibir_tv} onChange={(e) => setForm({ ...form, exibir_tv: e.target.checked })} />Exibir na TV</label><label><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />Modelo ativo</label></div>
        <button className="btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar modelo"}</button>{form.id && <button type="button" className="btn-secondary" onClick={() => setForm(vazio())}>Cancelar edição</button>}
      </form></div>
      <div className="panel"><div className="panel-title-row"><h2>Modelos cadastrados</h2><button className="btn-secondary compact" onClick={carregar}>Atualizar</button></div><div className="template-list">
        {modelos.length === 0 && <div className="monthly-empty">Nenhum modelo cadastrado.</div>}
        {modelos.map((m) => <article className={`template-card ${!m.ativo ? "inactive" : ""}`} key={m.id}><div><span className="category-badge">{m.categoria}</span><h3>{m.nome}</h3><strong>{m.titulo}</strong><p>{m.descricao || "Sem descrição."}</p><small>{m.prazo_dias ? `Prazo: ${m.prazo_dias} dia(s)` : "Sem prazo automático"} · {m.pontos_tarefa} pontos · {m.prioridade}</small></div><div className="template-actions"><select value={responsaveis[m.id] || ""} onChange={(e) => setResponsaveis({ ...responsaveis, [m.id]: e.target.value })}><option value="">Responsável...</option>{funcionarios.map((f) => <option value={f.id} key={f.id}>{f.nome}</option>)}</select><button className="btn-primary compact" disabled={!m.ativo} onClick={() => aplicar(m)}>Gerar tarefa</button><button className="btn-secondary compact" onClick={() => setForm({ ...m })}>Editar</button></div></article>)}
      </div></div>
    </section>
  </div>;
}
