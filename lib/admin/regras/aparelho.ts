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
