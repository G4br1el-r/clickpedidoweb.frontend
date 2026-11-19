import { addDays, startOfDay } from "date-fns"
import type { Pedido } from "../../dados/tipos"
import { diasNoPeriodo, type Periodo, periodoAnterior } from "../periodo"
import { ehValido, noPeriodo, reais, soma, ticket } from "./comum"

export type NumerosDeVendas = {
  faturamento: number
  pedidos: number
  ticket: number
  itensPorPedido: number
}

function numeros(validos: Pedido[]): NumerosDeVendas {
  const itens = validos.reduce(
    (total, pedido) => total + pedido.itens.reduce((parcial, item) => parcial + item.quantidade, 0),
    0,
  )
  return {
    faturamento: soma(validos),
    pedidos: validos.length,
    ticket: ticket(validos),
    itensPorPedido: validos.length ? reais(itens / validos.length) : 0,
  }
}

/** Um ponto do gráfico: um dia (ou uma semana) e o mesmo trecho do período anterior. */
export type PontoDeVendas = {
  inicio: Date
  fim: Date
  faturamento: number
  pedidos: number
  anterior: { inicio: Date; faturamento: number; pedidos: number }
}

const doDia = (validos: Pedido[], dia: Date) => noPeriodo(validos, { de: dia, ate: dia })

/** Cada dia do período, com o dia na mesma posição do período anterior. */
export function serieComAnterior(pedidos: Pedido[], periodo: Periodo): PontoDeVendas[] {
  const validos = pedidos.filter(ehValido)
  const anterior = periodoAnterior(periodo)
  return Array.from({ length: diasNoPeriodo(periodo) }, (_, indice) => {
    const dia = addDays(startOfDay(periodo.de), indice)
    const diaAnterior = addDays(startOfDay(anterior.de), indice)
    const doDiaAtual = doDia(validos, dia)
    const doDiaAnterior = doDia(validos, diaAnterior)
    return {
      inicio: dia,
      fim: dia,
      faturamento: soma(doDiaAtual),
      pedidos: doDiaAtual.length,
      anterior: {
        inicio: diaAnterior,
        faturamento: soma(doDiaAnterior),
        pedidos: doDiaAnterior.length,
      },
    }
  })
}

/** A régua da aba Vendas: o período e o anterior, de mesmo tamanho, para comparar. */
export function reguaDeVendas(pedidos: Pedido[], periodo: Periodo) {
  return {
    atual: numeros(noPeriodo(pedidos, periodo).filter(ehValido)),
    anterior: numeros(noPeriodo(pedidos, periodoAnterior(periodo)).filter(ehValido)),
  }
}

/** A partir de quantos dias no período os gráficos podem agrupar por semana. */
export const DIAS_PARA_AGRUPAR_POR_SEMANA = 14

export const podeAgruparPorSemana = (periodo: Periodo) =>
  diasNoPeriodo(periodo) >= DIAS_PARA_AGRUPAR_POR_SEMANA

/** Junta os dias de 7 em 7 a partir do início do período; a última semana pode ser menor. */
export function porSemana(serie: PontoDeVendas[]): PontoDeVendas[] {
  const semanas: PontoDeVendas[] = []
  for (let indice = 0; indice < serie.length; indice += 7) {
    const dias = serie.slice(indice, indice + 7)
    semanas.push({
      inicio: dias[0].inicio,
      fim: dias[dias.length - 1].fim,
      faturamento: reais(dias.reduce((total, dia) => total + dia.faturamento, 0)),
      pedidos: dias.reduce((total, dia) => total + dia.pedidos, 0),
      anterior: {
        inicio: dias[0].anterior.inicio,
        faturamento: reais(dias.reduce((total, dia) => total + dia.anterior.faturamento, 0)),
        pedidos: dias.reduce((total, dia) => total + dia.anterior.pedidos, 0),
      },
    })
  }
  return semanas
}
