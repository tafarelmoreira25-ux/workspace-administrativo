export type ProcessoDataJud = { numero_processo: string | null; tribunal: string | null };

export const DATAJUD_PUBLIC_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

const estaduais: Record<string, string> = {
  "01": "tjac", "02": "tjal", "03": "tjap", "04": "tjam", "05": "tjba", "06": "tjce",
  "07": "tjdft", "08": "tjes", "09": "tjgo", "10": "tjma", "11": "tjmt", "12": "tjms",
  "13": "tjmg", "14": "tjpa", "15": "tjpb", "16": "tjpe", "17": "tjpi", "18": "tjpr",
  "19": "tjrj", "20": "tjrn", "21": "tjrs", "22": "tjro", "23": "tjrr", "24": "tjsc",
  "25": "tjse", "26": "tjsp", "27": "tjto",
};

export function apenasDigitos(valor: string | null) {
  return (valor || "").replace(/\D/g, "");
}

export function aliasTribunal(processo: ProcessoDataJud) {
  // A numeracao CNJ identifica o tribunal; o cadastro pode conter uma descricao livre.
  const cnj = apenasDigitos(processo.numero_processo);
  if (cnj.length === 20) {
    const ramo = cnj.slice(13, 14);
    const codigo = cnj.slice(14, 16);
    const regiao = Number(codigo);
    if (ramo === "8") return estaduais[codigo] || "";
    if (ramo === "4") return regiao >= 1 && regiao <= 6 ? `trf${regiao}` : "";
    if (ramo === "5") return regiao === 0 ? "tst" : regiao <= 24 ? `trt${regiao}` : "";
    if (ramo === "3" && codigo === "00") return "stj";
    if (ramo === "6") {
      if (codigo === "00") return "tse";
      const estadual = estaduais[codigo];
      return estadual ? `tre-${estadual === "tjdft" ? "df" : estadual.slice(2)}` : "";
    }
  }

  const tribunal = (processo.tribunal || "").trim().toLowerCase()
    .replace(/^api_publica_/, "").replace(/[\s_-]/g, "");
  if (Object.values(estaduais).includes(tribunal)) return tribunal;
  const regional = tribunal.match(/^(trf|trt)0?(\d{1,2})$/);
  if (regional) {
    const numero = Number(regional[2]);
    if (numero >= 1 && numero <= (regional[1] === "trf" ? 6 : 24)) return `${regional[1]}${numero}`;
  }
  if (["tst", "tse", "stj", "stm"].includes(tribunal)) return tribunal;
  if (/^tre(ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)$/.test(tribunal)) {
    return `tre-${tribunal.slice(3)}`;
  }
  return "";
}

export class DataJudError extends Error {
  status: number;
  upstreamStatus?: number;

  constructor(message: string, status: number, upstreamStatus?: number) {
    super(message);
    this.name = "DataJudError";
    this.status = status;
    this.upstreamStatus = upstreamStatus;
  }
}

export async function consultarDataJud(alias: string, numero: string, chave = DATAJUD_PUBLIC_KEY, fetcher: typeof fetch = fetch) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    let resposta: Response;
    try {
      resposta = await fetcher(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, {
        method: "POST",
        headers: { Authorization: `APIKey ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ size: 1, query: { match: { numeroProcesso: numero } } }),
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      if (tentativa === 0) continue;
      if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) {
        throw new DataJudError("O DataJud/CNJ excedeu o tempo de resposta. Tente novamente em alguns instantes.", 504);
      }
      throw new DataJudError("Nao foi possivel conectar ao DataJud/CNJ. Tente novamente em alguns instantes.", 503);
    }

    if (!resposta.ok) {
      const status = resposta.status;
      await resposta.body?.cancel();
      if ((status === 429 || status >= 500) && tentativa === 0) continue;
      if (status === 401 || status === 403) {
        throw new DataJudError("O DataJud/CNJ recusou a chave de acesso. Verifique DATAJUD_API_KEY na Edge Function.", 502, status);
      }
      if (status === 404) throw new DataJudError(`Endpoint do tribunal ${alias.toUpperCase()} nao encontrado no DataJud/CNJ.`, 502, status);
      if (status === 429) throw new DataJudError("O DataJud/CNJ atingiu o limite de consultas. Aguarde antes de tentar novamente.", 503, status);
      throw new DataJudError(`Falha na consulta ao DataJud/CNJ (HTTP ${status}). Tente novamente em alguns instantes.`, 502, status);
    }

    try {
      const data = await resposta.json();
      if (!Array.isArray(data?.hits?.hits)) throw new Error("Resposta invalida");
      return data.hits.hits[0]?._source;
    } catch {
      throw new DataJudError("O DataJud/CNJ retornou uma resposta invalida. Tente novamente em alguns instantes.", 502);
    }
  }
}
