export function formatarParteContraria(valor) {
  return (valor || "").toLocaleLowerCase("pt-BR").replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, separador, letra) => separador + letra.toLocaleUpperCase("pt-BR"));
}
