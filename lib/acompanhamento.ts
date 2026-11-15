import { horario, previsaoDoPedido, type SituacaoPedido } from "./pedido"
import type { Pedido } from "./sacola"

export type Prazo = { rotulo: string; valor: string }

/**
 * O primeiro fato da régua do acompanhamento: a faixa de horário prevista enquanto o
 * pedido anda; concluído, a hora em que foi entregue ou retirado.
 */
export function prazoDoAcompanhamento(pedido: Pedido, situacao: SituacaoPedido): Prazo {
  const { concluido, momentos } = situacao
  if (concluido) {
    return {
      rotulo: pedido.tipo === "retirada" ? "Retirado às" : "Entregue às",
      valor: horario(momentos[momentos.length - 1]),
    }
  }
  return { rotulo: "Previsão", valor: previsaoDoPedido(pedido.tipo, momentos[0]) }
}
