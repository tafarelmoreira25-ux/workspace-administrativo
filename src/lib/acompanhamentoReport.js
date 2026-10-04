import { numeroProtocoloExtrajudicial } from './protocoloExtrajudicial.js';

const informado = (value) => value === null || value === undefined || value === '' ? 'Não informado' : String(value);
const dateOf = (item) => item.data || item.data_registro || item.data_hora || item.created_at;
const timestamp = (value) => Date.parse(value) || 0;
const money = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? 'Não informado' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value) => timestamp(value) ? new Date(value).toLocaleDateString('pt-BR') : 'Data não informada';

export function montarRelatorioAcompanhamento({ processo = {}, cliente = {}, timeline = [], esfera = 'Processual', agora = new Date() }) {
  const recentes = [...timeline].filter((item) => !item.deleted_at && !item.tarefa).sort((a, b) => timestamp(dateOf(b)) - timestamp(dateOf(a))).slice(0, 3);
  const ultima = Math.max(timestamp(processo.ultima_movimentacao_data), ...recentes.map((item) => timestamp(dateOf(item)))) || timestamp(processo.updated_at || processo.created_at);
  const dias = ultima ? Math.max(0, Math.floor((agora.getTime() - ultima) / 86400000)) : 'Não informado';
  const extra = esfera === 'Extrajudicial';
  return `RELATÓRIO DE ACOMPANHAMENTO ${esfera.toUpperCase()}
Emitido em: ${date(agora.toISOString())}

1. Identificação do Cliente
Nome: ${informado(cliente.nome_completo || processo.nome_cliente)}
CPF: ${informado(cliente.cpf || processo.cpf_cliente)}

2. Dados do ${extra ? 'Protocolo' : 'Processo'}
${extra ? 'Protocolo' : 'Número do processo'}: ${informado(extra ? numeroProtocoloExtrajudicial(processo) : processo.numero_processo)}
Esfera: ${esfera}
Parte contrária / Banco: ${informado(processo.reu || processo.banco_reu || processo.instituicao_financeira)}

3. Situação Atual
Status: ${informado(processo.situacao || processo.status || processo.fase_atual || processo.status_judicial)}
Prioridade: ${informado(processo.prioridade)}
Dias sem atualização: ${dias}

4. Resumo de Valores
Valor da causa: ${money(processo.valor_causa ?? processo.valor_da_causa)}
Proposta: ${money(processo.valor_proposta ?? processo.valor_acordo)}

5. Histórico Recente
${recentes.map((item) => `- ${date(dateOf(item))} | ${item.titulo || item.tipo || 'Movimentação'}\n${item.resumo_cliente || item.movimentacao?.resumo_cliente || item.descricao || item.movimentacao?.descricao || ''}`).join('\n\n') || 'Nenhuma movimentação registrada.'}

6. Próximas Providências
${processo.proxima_providencia || recentes[0]?.proxima_providencia || recentes[0]?.movimentacao?.proxima_providencia || 'Nenhuma providência registrada.'}`;
}

export function textoWhatsApp(texto) {
  return texto.split('\n').map((linha) => /^(RELATÓRIO|\d+\.)/.test(linha) ? `*${linha}*` : linha).join('\n');
}
