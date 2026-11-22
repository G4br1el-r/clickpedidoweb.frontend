import type { Pedido } from "../../dados/tipos"
import { SEM_MOTOBOY } from "../filtro-pedidos"
import type { Periodo } from "../periodo"
import { ehValido, noPeriodo, reais, soma, ticket } from "./comum"
import { minutosEntre, minutosNaLoja, tempo } from "./operacao"

/** Entregas do período que valem: nem canceladas, nem esperando o pagamento online. */
const entregasValidas = (pedidos: Pedido[], periodo: Periodo) =>
  noPeriodo(pedidos, periodo).filter((pedido) => pedido.tipo === "entrega" && ehValido(pedido))

const somaDasTaxas = (pedidos: Pedido[]) =>
  reais(pedidos.reduce((total, pedido) => total + pedido.taxaEntrega, 0))

/** Minutos de cada entrega concluída na rua: de sair até entregar. */
const minutosNaRua = (pedidos: Pedido[]) =>
  pedidos.flatMap((pedido) =>
    pedido.status === "concluido"
      ? (minutosEntre(pedido, "saiu-para-entrega", "concluido") ?? [])
      : [],
  )

/** A régua da aba Entrega: quantas, quanto de taxa, o ticket e o tempo na rua. */
export function reguaDeEntregas(pedidos: Pedido[], periodo: Periodo) {
  const entregas = entregasValidas(pedidos, periodo)
  return {
    entregas: entregas.length,
    taxas: somaDasTaxas(entregas),
    ticket: ticket(entregas),
    naRua: tempo(minutosNaRua(entregas)),
  }
}

/** Agrupa pela chave, na ordem em que aparecem. */
function agrupar(pedidos: Pedido[], chave: (pedido: Pedido) => string) {
  const grupos = new Map<string, Pedido[]>()
  for (const pedido of pedidos)
    grupos.set(chave(pedido), [...(grupos.get(chave(pedido)) ?? []), pedido])
  return [...grupos.entries()]
}

/**
 * Entregas concluídas de cada motoboy, com o tempo médio na rua e as taxas delas. As entregas
 * sem motoboy anotado ficam juntas em `SEM_MOTOBOY`, sempre por último.
 */
export function porMotoboy(pedidos: Pedido[], periodo: Periodo) {
  const concluidas = entregasValidas(pedidos, periodo).filter(
    (pedido) => pedido.status === "concluido",
  )
  return agrupar(concluidas, (pedido) => pedido.motoboyId ?? SEM_MOTOBOY)
    .map(([motoboyId, lista]) => ({
      motoboyId,
      entregas: lista.length,
      minutosNaRua: tempo(minutosNaRua(lista)).media,
      taxas: somaDasTaxas(lista),
    }))
    .sort(
      (a, b) =>
        Number(a.motoboyId === SEM_MOTOBOY) - Number(b.motoboyId === SEM_MOTOBOY) ||
        b.entregas - a.entregas ||
        b.taxas - a.taxas,
    )
}

/** O bairro da entrega sem endereço anotado. */
export const SEM_BAIRRO = "Sem bairro"

/**
 * Entregas de cada bairro: pedidos, faturamento, taxa cobrada, ticket e o tempo médio do
 * pedido até ser entregue (só as concluídas). Do bairro que mais fatura ao que menos.
 */
export function porBairro(pedidos: Pedido[], periodo: Periodo) {
  return agrupar(
    entregasValidas(pedidos, periodo),
    (pedido) => pedido.endereco?.bairro ?? SEM_BAIRRO,
  )
    .map(([bairro, lista]) => ({
      bairro,
      pedidos: lista.length,
      total: soma(lista),
      taxas: somaDasTaxas(lista),
      ticket: ticket(lista),
      minutos: tempo(
        lista.flatMap((pedido) =>
          pedido.status === "concluido" ? (minutosNaLoja(pedido) ?? []) : [],
        ),
      ).media,
    }))
    .sort((a, b) => b.total - a.total || b.pedidos - a.pedidos)
}
