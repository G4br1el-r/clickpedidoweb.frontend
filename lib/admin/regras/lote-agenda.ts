import { plural } from "../../formato"
import type { Pedido } from "../dados/tipos"
import { proximoStatus } from "./status"

/**
 * Separa os atendimentos marcados: os que têm próxima etapa (agendado → em atendimento →
 * concluído), os que ainda podem ser cancelados e os que já terminaram (concluído ou
 * cancelado), que ficam como estão.
 */
export function divisaoDoLoteAgenda(pedidos: Pedido[]) {
  const avancaveis: Pedido[] = []
  const cancelaveis: Pedido[] = []
  const parados: Pedido[] = []
  for (const pedido of pedidos) {
    const terminou = pedido.status === "concluido" || pedido.status === "cancelado"
    if (terminou) parados.push(pedido)
    else cancelaveis.push(pedido)
    if (proximoStatus(pedido.tipo, pedido.status)) avancaveis.push(pedido)
  }
  return { avancaveis, cancelaveis, parados }
}

/** Texto do botão que avança o lote: "Iniciar", "Concluir" ou, se misturar etapas, "Avançar". */
export function rotuloDoAvancoAgenda(avancaveis: Pedido[]) {
  const quantos = plural(avancaveis.length, "atendimento", "atendimentos")
  if (avancaveis.length > 0 && avancaveis.every((item) => item.status === "recebido")) {
    return `Iniciar ${quantos}`
  }
  if (avancaveis.length > 0 && avancaveis.every((item) => item.status === "em-preparo")) {
    return `Concluir ${quantos}`
  }
  return `Avançar ${quantos}`
}

export const textoDoLoteAgenda = (quantidade: number) =>
  plural(quantidade, "atendimento selecionado", "atendimentos selecionados")

/** Quem já terminou (concluído ou cancelado) e fica fora do lote. */
export const textoDosParadosAgenda = (quantidade: number) =>
  plural(quantidade, "já terminou", "já terminaram")
