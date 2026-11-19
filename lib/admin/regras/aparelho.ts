import { emReais } from "@/lib/formato"
import type { Pedido } from "../dados/tipos"
import { rotuloCanal } from "./rotulos"

/** A notificação do sistema do pedido que chegou com a aba escondida. */
export function textoDaNotificacao(pedido: Pedido): { titulo: string; corpo: string } {
  return {
    titulo: `Pedido novo #${pedido.numero}`,
    corpo: `${rotuloCanal(pedido.tipo)} · ${pedido.cliente.nome} · ${emReais(pedido.total)}`,
  }
}

/**
 * O título da aba enquanto há pedido esperando: alterna entre a contagem ("🔔 2 novos") e o
 * título de sempre, para chamar o olho de quem está em outra aba.
 */
export function textoDaAba(titulo: string, quantos: number, aceso: boolean): string {
  if (quantos === 0 || !aceso) return titulo
  return `🔔 ${quantos} ${quantos === 1 ? "novo" : "novos"}`
}
