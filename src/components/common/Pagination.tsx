type Props = {
  pagina: number;
  total: number;
  tamanho?: number;
  onChange: (pagina: number) => void;
  rotulo?: string;
};

function paginasVisiveis(atual: number, totalPaginas: number) {
  const inicio = Math.max(1, Math.min(atual - 2, totalPaginas - 4));
  const fim = Math.min(totalPaginas, inicio + 4);
  return Array.from({ length: Math.max(0, fim - inicio + 1) }, (_, indice) => inicio + indice);
}

export default function Pagination({ pagina, total, tamanho = 30, onChange, rotulo = "registros" }: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = total === 0 ? 0 : (paginaAtual - 1) * tamanho + 1;
  const fim = Math.min(total, paginaAtual * tamanho);

  return (
    <footer className="table-pagination" aria-label={`Paginação de ${rotulo}`}>
      <span>Exibindo {inicio}–{fim} de {total} {rotulo}</span>
      <nav>
        <button type="button" disabled={paginaAtual === 1} onClick={() => onChange(paginaAtual - 1)}>‹ Anterior</button>
        {paginasVisiveis(paginaAtual, totalPaginas).map((numero) => (
          <button type="button" key={numero} className={numero === paginaAtual ? "active" : ""} aria-current={numero === paginaAtual ? "page" : undefined} onClick={() => onChange(numero)}>{numero}</button>
        ))}
        <button type="button" disabled={paginaAtual === totalPaginas} onClick={() => onChange(paginaAtual + 1)}>Próxima ›</button>
      </nav>
    </footer>
  );
}
