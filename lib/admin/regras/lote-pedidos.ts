import type { Pedido } from "../dados/tipos"
import { proximoStatus } from "./status"

/**
 * Separa os pedidos marcados entre os que podem avançar uma etapa e os que não podem
 * (concluído, cancelado, aguardando pagamento, mesa pronta). Quem não avança fica como está.
 */
export function divisaoDoLote(pedidos: Pedido[]) {
  const avancaveis: Pedido[] = []
  const parados: Pedido[] = []
  for (const pedido of pedidos) {
    ;(proximoStatus(pedido.tipo, pedido.status) ? avancaveis : parados).push(pedido)
  }
  return { avancaveis, parados }
}

export function textoDoLote(quantidade: number) {
  return quantidade === 1 ? "1 pedido selecionado" : `${quantidade} pedidos selecionados`
}

/** Marca ou desmarca um pedido, sem mexer no conjunto de origem. */
export function alternarSelecao(selecionados: ReadonlySet<number>, id: number) {
  const novo = new Set(selecionados)
  if (novo.has(id)) novo.delete(id)
  else novo.add(id)
  return novo
}
