import { format } from "date-fns"
import type { Mesa, Pedido } from "../dados/tipos"
import type { TomStatus } from "./status"

export type EstadoMesa =
  | "livre"
  | "reservada"
  | "bloqueada"
  | "limpeza"
  | "juntada"
  | "ocupada"
  | "na-cozinha"
  | "servir"
  | "conta-pedida"

/** Quanto antes do horário a mesa já aparece como reservada, se a loja não configurou. */
const ANTECEDENCIA_PADRAO_MIN = 30

type Contexto = {
  principal?: { numero: number }
  reserva?: { inicio: string }
  agora?: Date
  antecedenciaMin?: number
}

/**
 * Como a mesa se lê de relance no salão. Vale o primeiro que bater, nesta ordem: bloqueada,
 * juntada, pediu a conta, servir, na cozinha, ocupada, limpeza, reservada e livre. O tom é o
 * mesmo do traço de status do painel.
 */
export function estadoDaMesa(
  mesa: Pick<Mesa, "status" | "bloqueio" | "limpezaDesde" | "juntadaCom">,
  comanda: Pick<Pedido, "status" | "contaPedidaEm" | "servirDesde"> | undefined,
  contexto?: Contexto,
): { estado: EstadoMesa; rotulo: string; tom: TomStatus } {
  if (mesa.bloqueio) return { estado: "bloqueada", rotulo: "Bloqueada", tom: "cancelado" }
  if (mesa.juntadaCom) {
    const principal = contexto?.principal
    return {
      estado: "juntada",
      rotulo: principal ? `Com a mesa ${principal.numero}` : "Com outra mesa",
      tom: "caminho",
    }
  }
  if (comanda?.contaPedidaEm)
    return { estado: "conta-pedida", rotulo: "Pediu a conta", tom: "novo" }
  if (comanda?.servirDesde) return { estado: "servir", rotulo: "Servir", tom: "pronto" }
  if (comanda?.status === "recebido" || comanda?.status === "em-preparo") {
    return { estado: "na-cozinha", rotulo: "Na cozinha", tom: "preparo" }
  }
  if (mesa.status === "ocupada") return { estado: "ocupada", rotulo: "Ocupada", tom: "caminho" }
  if (mesa.limpezaDesde) return { estado: "limpeza", rotulo: "Limpeza", tom: "espera" }
  const reserva = contexto?.reserva
  const agora = contexto?.agora
  if (reserva && agora) {
    const inicio = new Date(reserva.inicio)
    const antecedenciaMs = (contexto.antecedenciaMin ?? ANTECEDENCIA_PADRAO_MIN) * 60_000
    if (agora.getTime() >= inicio.getTime() - antecedenciaMs) {
      return { estado: "reservada", rotulo: `Reservada ${format(inicio, "HH:mm")}`, tom: "espera" }
    }
  }
  return { estado: "livre", rotulo: "Livre", tom: "fim" }
}
