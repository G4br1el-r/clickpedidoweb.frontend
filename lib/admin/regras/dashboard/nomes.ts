import type { SegmentoPainelId } from "../../segmentos-painel"

export type Nomes = { Pedidos: string; pedido: string; pedidos: string }

/** Como o dashboard chama o pedido: no salão, é um atendimento. */
export function nomesDo(segmento: SegmentoPainelId): Nomes {
  return segmento === "salao"
    ? { Pedidos: "Atendimentos", pedido: "atendimento", pedidos: "atendimentos" }
    : { Pedidos: "Pedidos", pedido: "pedido", pedidos: "pedidos" }
}
