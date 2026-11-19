import { startOfDay, subWeeks } from "date-fns"
import type { Pedido } from "../../dados/tipos"
import { ehValido, soma, ticket } from "./comum"

export type ComparacaoHoje = {
  /** O mesmo dia da semana, sete dias atrás. */
  dia: Date
  /** Variação % de hoje sobre aquele dia até a mesma hora; `null` quando ele não vendeu nada. */
  variacao: { pedidos: number; faturamento: number; ticket: number } | null
}

const vendasEntre = (pedidos: Pedido[], inicio: Date, fim: Date) =>
  pedidos.filter((pedido) => {
    const criado = Date.parse(pedido.criadoEm)
    return ehValido(pedido) && criado >= inicio.getTime() && criado <= fim.getTime()
  })

const variacao = (atual: number, anterior: number) => ((atual - anterior) / anterior) * 100

/** Hoje até agora contra o mesmo dia da semana passada até a mesma hora. */
export function hojeVsSemanaPassada(pedidos: Pedido[], agora: Date): ComparacaoHoje {
  const mesmaHora = subWeeks(agora, 1)
  const dia = startOfDay(mesmaHora)
  const hoje = vendasEntre(pedidos, startOfDay(agora), agora)
  const antes = vendasEntre(pedidos, dia, mesmaHora)
  if (antes.length === 0) return { dia, variacao: null }
  return {
    dia,
    variacao: {
      pedidos: variacao(hoje.length, antes.length),
      faturamento: variacao(soma(hoje), soma(antes)),
      ticket: variacao(ticket(hoje), ticket(antes)),
    },
  }
}
