import type { EtapaDoPedido, EventoPedido, Pedido } from "../dados/tipos"
import { textoDoMotivo } from "./aceite"
import { rotuloStatus } from "./status"

/** Só as etapas do histórico, na ordem, sem os outros eventos. */
export const etapasDe = (pedido: Pedido): EtapaDoPedido[] =>
  pedido.historico.filter((evento) => evento.tipo === "etapa")

/** Anota a etapa atual do pedido no histórico, se ela ainda não for a última anotada. */
export function comEtapa(pedido: Pedido, em: string): Pedido {
  const ultima = pedido.historico.findLast((evento) => evento.tipo === "etapa")
  if (ultima?.tipo === "etapa" && ultima.status === pedido.status) return pedido
  return {
    ...pedido,
    historico: [...pedido.historico, { tipo: "etapa", status: pedido.status, em }],
  }
}

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
  }
}

/** A etapa anotada na chegada já é a linha "Pedido recebido". */
const ehAChegada = (evento: EventoPedido, pedido: Pedido) =>
  evento.tipo === "etapa" && evento.status === "recebido" && evento.em === pedido.criadoEm

/** O caminho do pedido para a tela: a chegada e depois cada evento, em ordem. */
export function linhaDoTempo(pedido: Pedido): LinhaDoTempo[] {
  return [
    { texto: "Pedido recebido", em: pedido.criadoEm },
    ...pedido.historico
      .filter((evento) => !ehAChegada(evento, pedido))
      .map((evento) => ({
        texto: textoDoEvento(evento, pedido),
        em: evento.em,
      })),
  ]
}
