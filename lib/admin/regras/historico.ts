import type { Pedido } from "../dados/tipos"

/** Anota a etapa atual do pedido no histórico, se ela ainda não for a última anotada. */
export function comEtapa(pedido: Pedido, em: string): Pedido {
  if (pedido.historico.at(-1)?.status === pedido.status) return pedido
  return { ...pedido, historico: [...pedido.historico, { status: pedido.status, em }] }
}
