import { normalizar } from "../regras/filtro-pedidos"
import { primeiraPosicaoLivre } from "../regras/salao"
import type { AreaSalao, BaseLoja, ConfigSalao, Garcom, Mesa, PosicaoMesa } from "./tipos"

/** Base como era na versão 4 do main (com custos, histórico e clientes novos): mesas sem área, lugares e posição, e sem configuração do salão. */
export type BaseLojaV4 = Omit<BaseLoja, "salao" | "reservas" | "espera" | "chamados" | "mesas"> & {
  mesas: Pick<
    Mesa,
    "id" | "numero" | "nome" | "status" | "pedidoAtivoId" | "clienteNome" | "ocupadaEm"
  >[]
}

/** Configuração inicial do salão, sem áreas e sem garçons. */
export const CONFIG_SALAO_PADRAO: ConfigSalao = {
  areas: [],
  garcons: [],
  taxaServico: { ativa: false, percentual: 10 },
  couvert: { ativo: false, porPessoa: 0 },
  limpeza: false,
  alertas: { semPedidoMin: 15, contaPedidaMin: 10, servirMin: 10, abertaMin: 150 },
  reservas: { antecedenciaMin: 30, toleranciaMin: 15 },
  qr: { aceite: "garcom", abrirMesaPeloQr: true },
  funcoes: { mapa: false, reservas: false, qr: false },
}

const MESAS_POR_FILEIRA = 6
const CELULAS_POR_MESA = 4
/** Mesas que mantêm a posição em fileiras; as seguintes procuram lugar livre no mapa. */
const MESAS_NA_GRADE_ANTIGA = 24

const idDe = (nome: string) => `garcom-${normalizar(nome).trim().replace(/\s+/g, "-")}`

/** Um garçom por nome normalizado, com a primeira grafia que aparece nas comandas. */
function garconsDasComandas(pedidos: BaseLojaV4["pedidos"]): Garcom[] {
  const nomes = new Map<string, string>()
  for (const pedido of pedidos) {
    const nome = pedido.mesa?.garcom?.trim()
    if (nome && !nomes.has(idDe(nome))) nomes.set(idDe(nome), nome)
  }
  return [...nomes]
    .map(([id, nome]) => ({ id, nome, ativo: true }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

/** Área do Salão de número `n`: a primeira é "Salão"; as outras, "Salão 2", "Salão 3"… */
const areaDoSalao = (n: number): AreaSalao =>
  n === 1
    ? { id: "area-salao", nome: "Salão", ordem: 1 }
    : { id: `area-salao-${n}`, nome: `Salão ${n}`, ordem: n }

/** Versão 4 → 5: toda mesa vai para a área Salão e o salão ganha a configuração padrão. */
export function migrarDaVersao4(base: BaseLojaV4): BaseLoja {
  const areas: AreaSalao[] = [areaDoSalao(1)]
  const mesas: Mesa[] = []
  for (const [indice, antiga] of base.mesas.entries()) {
    const nova = { forma: "quadrada", lugares: 4 } as const
    let areaId = (areas.at(-1) as AreaSalao).id
    let posicao: PosicaoMesa | null
    if (indice < MESAS_NA_GRADE_ANTIGA) {
      posicao = {
        x: (indice % MESAS_POR_FILEIRA) * CELULAS_POR_MESA,
        y: Math.floor(indice / MESAS_POR_FILEIRA) * CELULAS_POR_MESA,
      }
    } else {
      posicao = primeiraPosicaoLivre(mesas, areaId, nova)
      if (!posicao) {
        const proxima = areaDoSalao(areas.length + 1)
        areas.push(proxima)
        areaId = proxima.id
        posicao = { x: 0, y: 0 }
      }
    }
    mesas.push({ ...antiga, areaId, ...nova, posicao })
  }
  return {
    ...base,
    mesas,
    salao: {
      ...CONFIG_SALAO_PADRAO,
      areas,
      garcons: garconsDasComandas(base.pedidos),
    },
    reservas: [],
    espera: [],
    chamados: [],
  }
}
