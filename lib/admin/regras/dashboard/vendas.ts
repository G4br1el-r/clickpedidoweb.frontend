import { addDays, startOfDay } from "date-fns"
import type { OrigemPedido, Pedido } from "../../dados/tipos"
import { diasNoPeriodo, type Periodo, periodoAnterior } from "../periodo"
import { ehValido, fatias, noPeriodo, reais, soma, ticket } from "./comum"

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

export type CelulaDoMapa = { hora: number; pedidos: number; faturamento: number; nivel: number }
export type MapaDeCalor = { horas: number[]; dias: { dia: number; celulas: CelulaDoMapa[] }[] }

/** Tons do mapa além do vazio: o mais forte é a célula mais cheia. */
const TONS = 4

const nivelDoTom = (pedidos: number, maisCheia: number) =>
  pedidos ? Math.ceil((pedidos / maisCheia) * TONS) : 0

/** Segunda a domingo, como a semana do comércio (`getDay`: 0 é domingo). */
const ORDEM_DOS_DIAS = [1, 2, 3, 4, 5, 6, 0] as const

/** Pedidos válidos do período por dia da semana e hora, entre a primeira e a última hora com venda. */
export function mapaDeCalor(pedidos: Pedido[], periodo: Periodo): MapaDeCalor {
  const validos = noPeriodo(pedidos, periodo).filter(ehValido)
  const grupos = new Map<string, Pedido[]>()
  for (const pedido of validos) {
    const criado = new Date(pedido.criadoEm)
    const chave = `${criado.getDay()}-${criado.getHours()}`
    grupos.set(chave, [...(grupos.get(chave) ?? []), pedido])
  }
  const horasComVenda = validos.map((pedido) => new Date(pedido.criadoEm).getHours())
  const horas = horasComVenda.length
    ? Array.from(
        { length: Math.max(...horasComVenda) - Math.min(...horasComVenda) + 1 },
        (_, indice) => Math.min(...horasComVenda) + indice,
      )
    : []
  const maisCheia = Math.max(0, ...[...grupos.values()].map((lista) => lista.length))
  return {
    horas,
    dias: ORDEM_DOS_DIAS.map((dia) => ({
      dia,
      celulas: horas.map((hora) => {
        const lista = grupos.get(`${dia}-${hora}`) ?? []
        return {
          hora,
          pedidos: lista.length,
          faturamento: soma(lista),
          nivel: nivelDoTom(lista.length, maisCheia),
        }
      }),
    })),
  }
}

/** Quanto a loja vende em média, por dia do período, em cada hora com venda. */
export function mediaPorHora(pedidos: Pedido[], periodo: Periodo) {
  const mapa = mapaDeCalor(pedidos, periodo)
  const dias = diasNoPeriodo(periodo)
  return mapa.horas.map((hora, indice) => {
    const celulas = mapa.dias.map((linha) => linha.celulas[indice])
    return {
      hora,
      pedidos: reais(celulas.reduce((total, celula) => total + celula.pedidos, 0) / dias),
      faturamento: reais(celulas.reduce((total, celula) => total + celula.faturamento, 0) / dias),
    }
  })
}

/** Por onde as vendas válidas do período entraram (site, PDV, garçom ou painel). */
export function origensDasVendas(pedidos: Pedido[], periodo: Periodo) {
  return fatias(noPeriodo(pedidos, periodo).filter(ehValido), (pedido) => pedido.origem).map(
    ({ valor, ...resto }): { origem: OrigemPedido } & typeof resto => ({ origem: valor, ...resto }),
  )
}
