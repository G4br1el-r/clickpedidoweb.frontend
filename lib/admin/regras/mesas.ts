import type { Mesa, Pedido } from "../dados/tipos"
import type { TomStatus } from "./status"

/**
 * Como a mesa se lê de relance no salão: livre (apagada), esperando a cozinha (a rodada
 * está nova ou em preparo) ou só ocupada. O tom é o mesmo do traço de status do painel.
 */
export function estadoDaMesa(
  mesa: Pick<Mesa, "status">,
  comanda: Pick<Pedido, "status"> | undefined,
): { rotulo: string; tom: TomStatus } {
  if (mesa.status !== "ocupada") return { rotulo: "Livre", tom: "fim" }
  if (comanda?.status === "recebido" || comanda?.status === "em-preparo") {
    return { rotulo: "Na cozinha", tom: "preparo" }
  }
  return { rotulo: "Ocupada", tom: "caminho" }
}
