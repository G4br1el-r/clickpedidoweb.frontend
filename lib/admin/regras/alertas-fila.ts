import type { Pedido } from "../dados/tipos"
import { prazoDoPedido, type TemposDaLoja } from "./prazo"

/** Os alertas secundários da fila; cada um tem chave e som próprios no Este aparelho. */
export const CHAVES_DOS_ALERTAS = ["parado", "atraso", "pago", "cancelou"] as const
export type ChaveDoAlerta = (typeof CHAVES_DOS_ALERTAS)[number]

export type AlertaDaFila = {
  /** Um por pedido e alerta: o mesmo id não toca duas vezes. */
  id: string
  chave: ChaveDoAlerta
  pedido: Pedido
  texto: string
}

/** Prestes a atrasar: faltam esses minutos (ou menos) para o prazo. */
const AVISO_DE_ATRASO_MIN = 5
const EM_ANDAMENTO: readonly Pedido["status"][] = [
  "recebido",
  "em-preparo",
  "pronto",
  "saiu-para-entrega",
]

const minutosEntre = (de: number, ate: number) => Math.floor((ate - de) / 60_000)

/** Quando o pedido ficou pronto, pela linha do tempo (ou pela última mudança). */
function ficouPronto(pedido: Pedido): number {
  const evento = pedido.historico
    ?.filter((item) => item.tipo === "etapa" && item.status === "pronto")
    .at(-1)
  return Date.parse(evento?.em ?? pedido.atualizadoEm)
}

/**
 * Os alertas que valem agora: pronto parado há mais do limite, prestes a atrasar, pagamento
 * online confirmado (estava aguardando na leitura anterior) e cancelamento feito pelo cliente
 * depois que a fila abriu. Quem chama guarda os ids já avisados.
 */
export function alertasDaFila({
  todos,
  anteriores,
  agora,
  tempos,
  paradoMin,
  desde,
}: {
  /** Os pedidos de agora: a fila e os de hoje (para achar os cancelados). */
  todos: Pedido[]
  /** A leitura anterior, para ver o que mudou. */
  anteriores: Pedido[]
  agora: Date
  tempos: TemposDaLoja
  paradoMin: number
  /** Quando a fila abriu: cancelamento de antes disso não toca. */
  desde: string
}): AlertaDaFila[] {
  const alertas: AlertaDaFila[] = []
  const agoraMs = agora.getTime()
  const antes = new Map(anteriores.map((pedido) => [pedido.id, pedido]))

  for (const pedido of todos) {
    const numero = `#${pedido.numero}`
    if (pedido.status === "pronto") {
      const parado = minutosEntre(ficouPronto(pedido), agoraMs)
      if (parado >= paradoMin) {
        alertas.push({
          id: `parado-${pedido.id}`,
          chave: "parado",
          pedido,
          texto: `${numero} pronto há ${parado} min`,
        })
      }
    }
    if (EM_ANDAMENTO.includes(pedido.status)) {
      const prazo = prazoDoPedido(pedido, tempos)
      const faltam = prazo ? Math.ceil((prazo.getTime() - agoraMs) / 60_000) : null
      if (faltam !== null && faltam > 0 && faltam <= AVISO_DE_ATRASO_MIN) {
        alertas.push({
          id: `atraso-${pedido.id}`,
          chave: "atraso",
          pedido,
          texto: `${numero} atrasa em ${faltam} min`,
        })
      }
    }
    const anterior = antes.get(pedido.id)
    if (
      anterior?.status === "aguardando-pagamento" &&
      pedido.status !== "aguardando-pagamento" &&
      pedido.situacaoPagamento === "pago"
    ) {
      alertas.push({
        id: `pago-${pedido.id}`,
        chave: "pago",
        pedido,
        texto: `${numero}: pagamento online confirmado`,
      })
    }
    const cancelamento = pedido.cancelamento
    if (pedido.status === "cancelado" && cancelamento?.porCliente && cancelamento.em >= desde) {
      alertas.push({
        id: `cancelou-${pedido.id}`,
        chave: "cancelou",
        pedido,
        texto: `${numero}: o cliente cancelou`,
      })
    }
  }
  return alertas
}
