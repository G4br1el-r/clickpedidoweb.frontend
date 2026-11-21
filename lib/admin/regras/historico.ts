import type { EventoComanda, ItemPedido, Pedido } from "../dados/tipos"

/** Anota a etapa atual do pedido no histórico, se ela ainda não for a última anotada. */
export function comEtapa(pedido: Pedido, em: string): Pedido {
  if (pedido.historico.at(-1)?.status === pedido.status) return pedido
  return { ...pedido, historico: [...pedido.historico, { status: pedido.status, em }] }
}

/** Acrescenta um evento no fim do histórico da comanda. */
export function comEvento(pedido: Pedido, evento: EventoComanda): Pedido {
  return { ...pedido, eventos: [...(pedido.eventos ?? []), evento] }
}

/** "2× Calabresa, 1× Coca": os itens de uma rodada ou de uma remoção, em texto. */
export const itensEmTexto = (itens: Pick<ItemPedido, "quantidade" | "nome">[]) =>
  itens.map((item) => `${item.quantidade}× ${item.nome}`).join(", ")
