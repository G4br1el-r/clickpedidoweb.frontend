import { endOfDay, startOfDay } from "date-fns"
import type { Pedido } from "../../dados/tipos"
import type { Periodo } from "../periodo"

/** Venda que conta no faturamento: nem cancelada, nem esperando o pagamento online. */
export const ehValido = (pedido: Pedido) =>
  pedido.status !== "cancelado" && pedido.status !== "aguardando-pagamento"

export const reais = (valor: number) => Math.round(valor * 100) / 100

export const soma = (pedidos: Pedido[]) =>
  reais(pedidos.reduce((total, pedido) => total + pedido.total, 0))

export const ticket = (pedidos: Pedido[]) =>
  pedidos.length ? reais(soma(pedidos) / pedidos.length) : 0

/** Pedidos criados entre o início do primeiro dia e o fim do último. */
export function noPeriodo(pedidos: Pedido[], { de, ate }: Periodo) {
  const inicio = startOfDay(de).getTime()
  const fim = endOfDay(ate).getTime()
  return pedidos.filter((pedido) => {
    const criado = Date.parse(pedido.criadoEm)
    return criado >= inicio && criado <= fim
  })
}
