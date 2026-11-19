import { normalizar } from "../regras/filtro-pedidos"
import type { BaseLoja, ConfigSalao, Garcom, Mesa } from "./tipos"

/** Base como era na versão 2: mesas sem área, lugares e posição, e sem configuração do salão. */
export type BaseLojaV2 = Omit<BaseLoja, "salao" | "reservas" | "espera" | "chamados" | "mesas"> & {
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

function garconsDasComandas(pedidos: BaseLojaV2["pedidos"]): Garcom[] {
  const nomes = new Set<string>()
  for (const pedido of pedidos) {
    const nome = pedido.mesa?.garcom?.trim()
    if (nome) nomes.add(nome)
  }
  return [...nomes]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((nome) => ({
      id: `garcom-${normalizar(nome).trim().replace(/\s+/g, "-")}`,
      nome,
      ativo: true,
    }))
}

/** Versão 2 → 3: toda mesa vai para a área Salão e o salão ganha a configuração padrão. */
export function migrarDaVersao2(base: BaseLojaV2): BaseLoja {
  const mesas: Mesa[] = base.mesas.map((mesa, indice) => ({
    ...mesa,
    areaId: "area-salao",
    lugares: 4,
    forma: "quadrada",
    posicao: {
      x: (indice % MESAS_POR_FILEIRA) * CELULAS_POR_MESA,
      y: Math.floor(indice / MESAS_POR_FILEIRA) * CELULAS_POR_MESA,
    },
  }))
  return {
    ...base,
    mesas,
    salao: {
      ...CONFIG_SALAO_PADRAO,
      areas: [{ id: "area-salao", nome: "Salão", ordem: 1 }],
      garcons: garconsDasComandas(base.pedidos),
    },
    reservas: [],
    espera: [],
    chamados: [],
  }
}
