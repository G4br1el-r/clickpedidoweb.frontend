import { endOfDay, startOfDay } from "date-fns"
import type { Pedido } from "../../dados/tipos"
import { valorSemTaxa } from "../conta"
import type { Periodo } from "../periodo"

/** Venda que conta no faturamento: nem cancelada, nem esperando o pagamento online. */
export const ehValido = (pedido: Pedido) =>
  pedido.status !== "cancelado" && pedido.status !== "aguardando-pagamento"

export const reais = (valor: number) => Math.round(valor * 100) / 100

/** O faturamento da casa: sem a taxa de serviço das contas de mesa (é do garçom, Q34). */
export const soma = (pedidos: Pedido[]) =>
  reais(pedidos.reduce((total, pedido) => total + valorSemTaxa(pedido), 0))

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

/** Agrupa e ordena do maior total para o menor (empate: mais pedidos). */
export function fatias<K extends string>(pedidos: Pedido[], chave: (pedido: Pedido) => K) {
  const total = soma(pedidos)
  const grupos = new Map<K, Pedido[]>()
  for (const pedido of pedidos)
    grupos.set(chave(pedido), [...(grupos.get(chave(pedido)) ?? []), pedido])
  return [...grupos.entries()]
    .map(([valor, lista]) => ({
      valor,
      pedidos: lista.length,
      total: soma(lista),
      percentual: total ? (soma(lista) / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total || b.pedidos - a.pedidos)
}
