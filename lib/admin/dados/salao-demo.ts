import { nomePadraoDaMesa } from "../regras/mesas"
import type { SegmentoPainelId } from "../segmentos-painel"
import { CONFIG_SALAO_PADRAO } from "./migracao"
import type { ConfigSalao, FormaMesa, Garcom, Mesa } from "./tipos"

const AREAS = [
  { id: "area-salao", nome: "Salão", ordem: 1 },
  { id: "area-varanda", nome: "Varanda", ordem: 2 },
  { id: "area-balcao", nome: "Balcão", ordem: 3 },
]

type Desenho = [areaId: string, forma: FormaMesa, lugares: number, x: number, y: number]

/** Mesas 1 a 20, na ordem do número. Posições em células da grade 24 × 16 de cada área. */
const DESENHO: Desenho[] = [
  ["area-salao", "quadrada", 4, 1, 1],
  ["area-salao", "quadrada", 4, 4, 1],
  ["area-salao", "quadrada", 4, 7, 1],
  ["area-salao", "quadrada", 4, 10, 1],
  ["area-salao", "quadrada", 4, 1, 4],
  ["area-salao", "quadrada", 4, 4, 4],
  ["area-salao", "quadrada", 4, 7, 4],
  ["area-salao", "quadrada", 4, 10, 4],
  ["area-salao", "retangular", 8, 14, 1],
  ["area-salao", "retangular", 8, 14, 4],
  ["area-varanda", "redonda", 2, 1, 1],
  ["area-varanda", "redonda", 2, 4, 1],
  ["area-varanda", "redonda", 2, 7, 1],
  ["area-varanda", "redonda", 2, 10, 1],
  ["area-varanda", "retangular", 6, 1, 5],
  ["area-varanda", "retangular", 6, 5, 5],
  ["area-balcao", "redonda", 2, 2, 7],
  ["area-balcao", "redonda", 2, 6, 7],
  ["area-balcao", "redonda", 2, 10, 7],
  ["area-balcao", "redonda", 2, 14, 7],
]

const NUMERO_BLOQUEADA = 20

const NOMES_GARCONS = ["Lucas", "Paula", "Rafa", "Bia"]

/** Taxa de serviço e couvert da demonstração por segmento. */
function cobrancas(segmento: SegmentoPainelId): Pick<ConfigSalao, "taxaServico" | "couvert"> {
  const taxa = segmento !== "lanchonete"
  return {
    taxaServico: { ativa: taxa, percentual: 10 },
    couvert:
      segmento === "pizzaria" ? { ativo: true, porPessoa: 8 } : { ativo: false, porPessoa: 0 },
  }
}

/** Salão de demonstração: 20 mesas em 3 áreas, garçons e configuração por segmento. */
export function salaoDemo(segmento: SegmentoPainelId): { mesas: Mesa[]; salao: ConfigSalao } {
  const mesas: Mesa[] = DESENHO.map(([areaId, forma, lugares, x, y], indice) => {
    const numero = indice + 1
    return {
      id: `mesa-${numero}`,
      numero,
      nome: nomePadraoDaMesa(numero),
      status: "livre",
      areaId,
      lugares,
      forma,
      posicao: { x, y },
      ...(numero === NUMERO_BLOQUEADA ? { bloqueio: { motivo: "Em manutenção" } } : {}),
    }
  })
  const garcons: Garcom[] = NOMES_GARCONS.map((nome) => ({
    id: `garcom-${nome.toLowerCase()}`,
    nome,
    ativo: true,
  }))
  return {
    mesas,
    salao: {
      ...CONFIG_SALAO_PADRAO,
      areas: AREAS.map((area) => ({ ...area })),
      garcons,
      ...cobrancas(segmento),
      limpeza: true,
      funcoes: { mapa: true, reservas: true, qr: true },
    },
  }
}
