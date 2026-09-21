type SupabaseLike = {
  from: (table: string) => any;
};

type UsuarioSync = {
  email?: string | null;
  nome?: string | null;
};

type ClienteSync = {
  id?: string | number | null;
  nome_completo?: string | null;
  nome?: string | null;
  cpf?: string | null;
  id_crm?: string | null;
  link_pasta_cliente?: string | null;
  responsavel?: string | null;
};

type ProcessoSync = {
  id?: string | number | null;
  cliente_id?: string | number | null;
  cliente?: string | null;
  nome_cliente?: string | null;
  cpf_cliente?: string | null;
  id_crm?: string | null;
  pasta_cliente_id?: string | null;
  link_pasta_cliente?: string | null;
  responsavel?: string | null;
};

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function valorOuNull(valor: unknown) {
  const limpo = texto(valor);
  return limpo || null;
}

function usuarioSync(usuario?: UsuarioSync | null) {
  return usuario?.email || usuario?.nome || null;
}

function atribuirSePreenchido(destino: Record<string, unknown>, campo: string, valor: unknown) {
  const limpo = valorOuNull(valor);
  if (limpo) destino[campo] = limpo;
}

async function buscarClienteUnico(supabase: SupabaseLike, processo: ProcessoSync) {
  if (processo.cliente_id) {
    const resultado = await supabase.from("clientes").select("*").eq("id", processo.cliente_id).maybeSingle();
    if (!resultado.error && resultado.data) return resultado.data;
  }

  const tentativas: Array<[string, string | null]> = [
    ["id_crm", valorOuNull(processo.id_crm || processo.pasta_cliente_id)],
    ["cpf", valorOuNull(processo.cpf_cliente)],
    ["nome_completo", valorOuNull(processo.nome_cliente || processo.cliente)],
  ];

  for (const [campo, valor] of tentativas) {
    if (!valor) continue;
    const consulta = campo === "nome_completo"
      ? supabase.from("clientes").select("*").ilike(campo, valor).limit(2)
      : supabase.from("clientes").select("*").eq(campo, valor).limit(2);
    const resultado = await consulta;
    if (!resultado.error && resultado.data?.length === 1) return resultado.data[0];
  }

  return null;
}

export async function sincronizarProcessosDoCliente(supabase: SupabaseLike, cliente: ClienteSync, usuario?: UsuarioSync | null) {
  if (!cliente?.id) return;

  const payload: Record<string, unknown> = {
    cliente_id: cliente.id,
    updated_by: usuarioSync(usuario),
  };
  atribuirSePreenchido(payload, "cliente", cliente.nome_completo || cliente.nome);
  atribuirSePreenchido(payload, "nome_cliente", cliente.nome_completo || cliente.nome);
  atribuirSePreenchido(payload, "autor", cliente.nome_completo || cliente.nome);
  atribuirSePreenchido(payload, "cpf_cliente", cliente.cpf);
  atribuirSePreenchido(payload, "id_crm", cliente.id_crm);
  atribuirSePreenchido(payload, "pasta_cliente_id", cliente.id_crm);
  atribuirSePreenchido(payload, "link_pasta_cliente", cliente.link_pasta_cliente);
  atribuirSePreenchido(payload, "responsavel", cliente.responsavel);

  const operacoes = [supabase.from("processos").update(payload).eq("cliente_id", cliente.id)];
  const cpf = valorOuNull(cliente.cpf);
  const idCrm = valorOuNull(cliente.id_crm);
  if (cpf) operacoes.push(supabase.from("processos").update(payload).eq("cpf_cliente", cpf));
  if (idCrm) operacoes.push(supabase.from("processos").update(payload).eq("id_crm", idCrm));
  await Promise.allSettled(operacoes);
}

export async function sincronizarClienteDoProcesso(supabase: SupabaseLike, processo: ProcessoSync, usuario?: UsuarioSync | null) {
  const nome = valorOuNull(processo.nome_cliente || processo.cliente);
  if (!nome) return null;

  const clienteAtual = await buscarClienteUnico(supabase, processo);
  const payloadCliente: Record<string, unknown> = {
    nome,
    nome_completo: nome,
    updated_by: usuarioSync(usuario),
  };
  atribuirSePreenchido(payloadCliente, "cpf", processo.cpf_cliente);
  atribuirSePreenchido(payloadCliente, "id_crm", processo.id_crm || processo.pasta_cliente_id);
  atribuirSePreenchido(payloadCliente, "link_pasta_cliente", processo.link_pasta_cliente);
  atribuirSePreenchido(payloadCliente, "responsavel", processo.responsavel);

  const operacao = clienteAtual
    ? supabase.from("clientes").update(payloadCliente).eq("id", clienteAtual.id)
    : supabase.from("clientes").insert({ ...payloadCliente, origem: "Processual", created_by: usuarioSync(usuario) });

  const resultado = await operacao.select("*").single();
  if (resultado.error || !resultado.data) return clienteAtual;

  const cliente = resultado.data as ClienteSync;
  await sincronizarProcessosDoCliente(supabase, cliente, usuario);

  if (processo.id && cliente.id && String(processo.cliente_id || "") !== String(cliente.id)) {
    await supabase.from("processos").update({ cliente_id: cliente.id, updated_by: usuarioSync(usuario) }).eq("id", processo.id);
  }

  return cliente;
}
