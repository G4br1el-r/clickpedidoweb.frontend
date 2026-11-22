import type { ConfigSalao, Mesa, Pedido } from "../dados/tipos"

export type TipoAlertaMesa = "conta-pedida" | "servir" | "sem-pedido" | "aberta"
export type AlertaMesa = { tipo: TipoAlertaMesa; texto: string }

const minutosDesde = (inicio: string, agora: Date) =>
  Math.floor((agora.getTime() - Date.parse(inicio)) / 60_000)

/** "25 min" ou "2 h 05" (sai do cartão da página). */
export function tempoDesde(inicio: string, agora: Date): string {
  const minutos = Math.max(0, minutosDesde(inicio, agora))
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")}`
}

/** Alertas da mesa ocupada, da mais urgente: conta pedida, servir, sem pedido, aberta. */
export function alertasDaMesa(
  mesa: Pick<Mesa, "status" | "ocupadaEm" | "bloqueio" | "juntadaCom">,
  comanda: Pick<Pedido, "itens" | "contaPedidaEm" | "servirDesde"> | undefined,
  limites: ConfigSalao["alertas"],
  agora: Date,
): AlertaMesa[] {
  if (mesa.status !== "ocupada" || mesa.bloqueio || mesa.juntadaCom) return []
  const alertas: AlertaMesa[] = []
  if (
    comanda?.contaPedidaEm &&
    minutosDesde(comanda.contaPedidaEm, agora) >= limites.contaPedidaMin
  ) {
    alertas.push({
      tipo: "conta-pedida",
      texto: `Pediu a conta há ${tempoDesde(comanda.contaPedidaEm, agora)}`,
    })
  }
  if (comanda?.servirDesde && minutosDesde(comanda.servirDesde, agora) >= limites.servirMin) {
    alertas.push({ tipo: "servir", texto: `Pronta há ${tempoDesde(comanda.servirDesde, agora)}` })
  }
  if (
    mesa.ocupadaEm &&
    comanda?.itens.length === 0 &&
    minutosDesde(mesa.ocupadaEm, agora) >= limites.semPedidoMin
  ) {
    alertas.push({
      tipo: "sem-pedido",
      texto: `Sem pedido há ${tempoDesde(mesa.ocupadaEm, agora)}`,
    })
  }
  if (mesa.ocupadaEm && minutosDesde(mesa.ocupadaEm, agora) >= limites.abertaMin) {
    alertas.push({ tipo: "aberta", texto: `Aberta há ${tempoDesde(mesa.ocupadaEm, agora)}` })
  }
  return alertas
}
