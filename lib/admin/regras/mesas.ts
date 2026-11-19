import type { Mesa, Pedido } from "../dados/tipos"
import { prontosParaServir } from "./cozinha"
import type { TomStatus } from "./status"

/**
 * Como a mesa se lê de relance no salão: livre (apagada), com rodada pronta para levar,
 * esperando a cozinha (a rodada está nova ou em preparo) ou só ocupada. O pronto para
 * servir vem antes: é o que o garçom tem a fazer. O tom é o mesmo do traço de status.
 */
export function estadoDaMesa(
  mesa: Pick<Mesa, "status">,
  comanda: Pedido | undefined,
): { rotulo: string; tom: TomStatus } {
  if (mesa.status !== "ocupada") return { rotulo: "Livre", tom: "fim" }
  if (comanda && prontosParaServir([comanda]).length > 0) {
    return { rotulo: "Pronto para servir", tom: "pronto" }
  }
  if (comanda?.status === "recebido" || comanda?.status === "em-preparo") {
    return { rotulo: "Na cozinha", tom: "preparo" }
  }
  return { rotulo: "Ocupada", tom: "caminho" }
}
