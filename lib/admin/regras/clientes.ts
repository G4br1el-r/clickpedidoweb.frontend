import type { Pedido } from "../dados/tipos"

export type HistoricoCliente = {
  /** Pedidos do mesmo telefone feitos antes deste, sem os cancelados. */
  anteriores: number
  /** Desses, quantos nos 30 dias antes deste pedido. */
  nosUltimos30: number
}

const TRINTA_DIAS = 30 * 24 * 60 * 60_000
/** A partir de quantos pedidos em 30 dias o cliente é da casa. */
const FREQUENTE = 10

/** O que o cliente já pediu antes deste pedido, pelo telefone. */
export function historicoDoCliente(pedido: Pedido, todos: Pedido[]): HistoricoCliente {
  const criado = Date.parse(pedido.criadoEm)
  const antes = todos.filter(
    (outro) =>
      outro.id !== pedido.id &&
      outro.status !== "cancelado" &&
      outro.cliente.telefone === pedido.cliente.telefone &&
      Date.parse(outro.criadoEm) < criado,
  )
  return {
    anteriores: antes.length,
    nosUltimos30: antes.filter((outro) => criado - Date.parse(outro.criadoEm) <= TRINTA_DIAS)
      .length,
  }
}

/** O selo do cartão: cliente novo pede atenção; freguês da casa, um cuidado a mais. */
export function seloDoCliente({ anteriores, nosUltimos30 }: HistoricoCliente) {
  if (anteriores === 0) return "1º pedido"
  if (nosUltimos30 >= FREQUENTE) return "Cliente frequente"
  return null
}
