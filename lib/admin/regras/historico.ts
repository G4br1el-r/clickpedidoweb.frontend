import type { EventoPedido, Pedido } from "../dados/tipos"
import { textoDoMotivo } from "./aceite"
import { rotuloStatus } from "./status"

/** O que mudou de um jeito para o outro do pedido, como linhas da linha do tempo. */
export function eventosDaMudanca(antes: Pedido, depois: Pedido, em: string): EventoPedido[] {
  const eventos: EventoPedido[] = []
  const aceito =
    antes.esperaAceite && depois.esperaAceite === false && depois.status !== "cancelado"
  if (aceito) eventos.push({ tipo: "aceito", em })
  if (depois.status !== antes.status) eventos.push({ tipo: "etapa", status: depois.status, em })
  if (depois.situacaoPagamento === "pago" && antes.situacaoPagamento !== "pago") {
    eventos.push({ tipo: "pago", em })
  }
  if (depois.impressoEm && depois.impressoEm !== antes.impressoEm) {
    eventos.push({ tipo: "impresso", em })
  }
  return eventos
}

export type LinhaDoTempo = { texto: string; em: string }

function textoDoEvento(evento: EventoPedido, pedido: Pedido): string {
  switch (evento.tipo) {
    case "etapa":
      if (evento.status === "cancelado" && pedido.cancelamento) {
        const como = pedido.cancelamento.tipo === "recusa" ? "Recusado" : "Cancelado"
        return `${como}: ${textoDoMotivo(pedido.cancelamento, pedido.tipo)}`
      }
      return rotuloStatus(pedido.tipo, evento.status)
    case "pago":
      return "Pagamento recebido"
    case "impresso":
      return "Cupom impresso"
    case "aceito":
      return "Pedido aceito"
    case "aviso":
      return `Cliente avisado no WhatsApp: “${evento.texto}”`
  }
}

/** O caminho do pedido para a tela: a chegada e depois cada evento, em ordem. */
export function linhaDoTempo(pedido: Pedido): LinhaDoTempo[] {
  return [
    { texto: "Pedido recebido", em: pedido.criadoEm },
    ...(pedido.historico ?? []).map((evento) => ({
      texto: textoDoEvento(evento, pedido),
      em: evento.em,
    })),
  ]
}
