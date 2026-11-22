import type { Pedido } from "../../dados/tipos"
import type { Periodo } from "../periodo"
import { ehValido, noPeriodo, reais, soma } from "./comum"
import { kgDoItem } from "./produtos"

const validosDoPeriodo = (pedidos: Pedido[], periodo: Periodo) =>
  noPeriodo(pedidos, periodo).filter(ehValido)

/**
 * Pedidos pesados no período: quantos, a diferença média em reais entre o estimado e o
 * pesado, e a diferença somada sobre o total estimado, em %.
 */
export function pesagensDoPeriodo(pedidos: Pedido[], periodo: Periodo) {
  const pesagens = validosDoPeriodo(pedidos, periodo).flatMap((pedido) =>
    pedido.pesagem ? [pedido.pesagem] : [],
  )
  const diferenca = pesagens.reduce((total, pesagem) => total + pesagem.diferenca, 0)
  const estimado = pesagens.reduce((total, pesagem) => total + pesagem.totalEstimado, 0)
  return {
    pesados: pesagens.length,
    diferencaMedia: pesagens.length ? reais(diferenca / pesagens.length) : 0,
    percentual: estimado ? (diferenca / estimado) * 100 : 0,
  }
}

/** Quilos vendidos no período: o peso da balança, ou o pedido quando ainda não pesou. */
export function kgVendidos(pedidos: Pedido[], periodo: Periodo) {
  const kg = validosDoPeriodo(pedidos, periodo)
    .flatMap((pedido) => pedido.itens)
    .reduce((total, item) => total + (kgDoItem(item) ?? 0), 0)
  return Math.round(kg * 1000) / 1000
}

/** Pedidos do período marcados para buscar, por dia de retirada, do mais cedo ao mais tarde. */
export function retiradasPorDia(pedidos: Pedido[], periodo: Periodo) {
  const dias = new Map<string, Pedido[]>()
  for (const pedido of validosDoPeriodo(pedidos, periodo)) {
    if (!pedido.dataRetirada) continue
    dias.set(pedido.dataRetirada, [...(dias.get(pedido.dataRetirada) ?? []), pedido])
  }
  return [...dias.entries()]
    .map(([dia, lista]) => ({ dia, pedidos: lista.length, total: soma(lista) }))
    .sort((a, b) => a.dia.localeCompare(b.dia))
}
