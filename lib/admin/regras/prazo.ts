import { format } from "date-fns"
import type { ConfigLoja, Pedido, TipoPedido } from "../dados/tipos"

/**
 * Minutos que a loja promete, lidos do texto que ela já mostra ao cliente
 * ("40–60 min" promete 60; "1h30", 90). Sem tempo no texto, não há prazo.
 */
export function minutosDoTexto(texto: string): number | undefined {
  const tempos = [...texto.matchAll(/(\d+)(?:\s*(h)\s*(\d+)?)?/gi)].map(
    ([, numero, hora, resto]) => (hora ? Number(numero) * 60 + Number(resto ?? 0) : Number(numero)),
  )
  return tempos.length > 0 ? Math.max(...tempos) : undefined
}

/** Sem tempo no texto da loja, a fila usa estes. */
const PADRAO = { entrega: 50, retirada: 20 }

export type TemposDaLoja = Pick<ConfigLoja, "tempoEntrega" | "tempoRetirada">

/**
 * Até quando a loja prometeu o pedido: a chegada mais os minutos do canal (a mesa segue a
 * retirada). Salão e retirada marcada para um dia seguem a hora marcada, não um prazo.
 */
export function prazoDoPedido(pedido: Pedido, loja: TemposDaLoja): Date | undefined {
  if (pedido.agendamento || pedido.dataRetirada) return undefined
  const minutos = pedido.prazoMin ?? minutosDoCanal(loja, pedido.tipo)
  if (minutos === undefined) return undefined
  return new Date(Date.parse(pedido.criadoEm) + minutos * 60_000)
}

/** Minutos que o canal promete hoje, sem acréscimo. O salão segue a hora marcada. */
function minutosDoCanal(loja: TemposDaLoja, tipo: TipoPedido): number | undefined {
  if (tipo === "atendimento") return undefined
  return tipo === "entrega"
    ? (minutosDoTexto(loja.tempoEntrega) ?? PADRAO.entrega)
    : (minutosDoTexto(loja.tempoRetirada) ?? PADRAO.retirada)
}

/** O prazo que o pedido novo grava ao chegar: o do canal mais o acréscimo da hora. */
export function prazoNaChegada(
  loja: TemposDaLoja & Pick<ConfigLoja, "acrescimoPrazoMin">,
  tipo: TipoPedido,
): number | undefined {
  const minutos = minutosDoCanal(loja, tipo)
  return minutos === undefined ? undefined : minutos + (loja.acrescimoPrazoMin ?? 0)
}

const VERBO: Record<Pedido["tipo"], string> = {
  entrega: "Entregar",
  retirada: "Pronto",
  mesa: "Servir",
  atendimento: "Atender",
}

const minutos = (quantos: number) => (quantos === 1 ? "1 min" : `${quantos} min`)

/** O prazo no cartão: a hora, quanto falta (ou quanto atrasou) e a frase inteira. */
export function textoDoPrazo(pedido: Pedido, loja: TemposDaLoja, agora: Date) {
  const prazo = prazoDoPedido(pedido, loja)
  if (!prazo) return undefined
  const ate = format(prazo, "HH:mm")
  const diferenca = prazo.getTime() - agora.getTime()
  if (diferenca > 0) {
    const faltam = Math.ceil(diferenca / 60_000)
    return {
      ate,
      resta: minutos(faltam),
      completo: `${VERBO[pedido.tipo]} até ${ate}, ${faltam === 1 ? "falta" : "faltam"} ${minutos(faltam)}`,
    }
  }
  const atrasou = Math.max(1, Math.floor(-diferenca / 60_000))
  return {
    ate,
    resta: `+${minutos(atrasou)}`,
    completo: `${VERBO[pedido.tipo]} até ${ate}, atrasado ${minutos(atrasou)}`,
  }
}
