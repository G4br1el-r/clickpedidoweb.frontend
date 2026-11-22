import type { Pedido, Produto } from "../dados/tipos"

/** Aviso que vai no cartão, no cupom e na mensagem do motoboy. */
export const AVISO_DE_MAIORIDADE = "+18: conferir documento"

/**
 * Adega: o pedido leva bebida alcoólica (num item ou num produto do combo) e só sai para
 * maior de 18, com documento.
 */
export function pedidoComAlcool(pedido: Pedido, produtos: Produto[]): boolean {
  const alcoolicos = new Set(
    produtos.filter((produto) => produto.alcoolico).map((produto) => produto.id),
  )
  return pedido.itens.some(
    (item) =>
      (item.produtoId !== null && alcoolicos.has(item.produtoId)) ||
      (item.produtosDasOpcoes ?? []).some((id) => alcoolicos.has(id)),
  )
}
