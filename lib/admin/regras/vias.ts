import type { ConfigLoja, TipoPedido } from "../dados/tipos"

/** Produção: o que fazer, sem preço. Cliente e entregador: com preços, cobrança e troco. */
export type ViaDoCupom = "producao" | "cliente"
export type ViasDoCanal = { producao: boolean; cliente: boolean }

/** De fábrica: a mesa só leva a via de produção; o salão, só a do cliente. */
export const VIAS_DE_FABRICA: Record<TipoPedido, ViasDoCanal> = {
  entrega: { producao: true, cliente: true },
  retirada: { producao: true, cliente: true },
  mesa: { producao: true, cliente: false },
  atendimento: { producao: false, cliente: true },
}

/** As vias que o pedido imprime, pela escolha da loja para o canal (ou a de fábrica). */
export function viasDoPedido(
  loja: Pick<ConfigLoja, "viasPorCanal">,
  tipo: TipoPedido,
): ViaDoCupom[] {
  const vias = loja.viasPorCanal?.[tipo] ?? VIAS_DE_FABRICA[tipo]
  return (["producao", "cliente"] as const).filter((via) => vias[via])
}
