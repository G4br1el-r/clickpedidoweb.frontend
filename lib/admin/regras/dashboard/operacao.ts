import type { Pedido, StatusPedido, TipoPedido } from "../../dados/tipos"
import { MINUTOS_DE_ATRASO } from "../fila"
import { type MotivoDoFiltro, motivoDoPedido } from "../filtro-pedidos"
import { etapasDe } from "../historico"
import type { Periodo } from "../periodo"
import { noPeriodo, reais } from "./comum"

/** Quando o pedido entrou numa etapa, pelo histórico (a primeira vez). */
const quando = (pedido: Pedido, status: StatusPedido) => {
  const etapa = etapasDe(pedido).find((item) => item.status === status)
  return etapa ? Date.parse(etapa.em) : undefined
}

export const minutosEntre = (pedido: Pedido, de: StatusPedido, ate: StatusPedido) => {
  const inicio = quando(pedido, de)
  const fim = quando(pedido, ate)
  return inicio === undefined || fim === undefined ? undefined : (fim - inicio) / 60_000
}

/**
 * Até onde vai o que depende da loja: a entrega, até entregar; a retirada e a mesa, até
 * ficar pronto (a demora do cliente para buscar ou fechar a conta não conta).
 */
export const fimDaLoja = (pedido: Pedido): StatusPedido =>
  pedido.tipo === "entrega" ? "concluido" : "pronto"

/** Minutos do pedido na loja: do recebido (pago online, do pagamento) até o fim da loja. */
export const minutosNaLoja = (pedido: Pedido) => minutosEntre(pedido, "recebido", fimDaLoja(pedido))

export type Tempo = { pedidos: number; media: number; noveEmDez: number }

/** Média e o tempo em que 9 de cada 10 ficam (o percentil 90), em minutos inteiros. */
export function tempo(minutos: number[]): Tempo {
  if (minutos.length === 0) return { pedidos: 0, media: 0, noveEmDez: 0 }
  const ordenados = minutos.toSorted((a, b) => a - b)
  return {
    pedidos: minutos.length,
    media: Math.round(minutos.reduce((soma, valor) => soma + valor, 0) / minutos.length),
    noveEmDez: Math.round(ordenados[Math.ceil(ordenados.length * 0.9) - 1]),
  }
}

/** Pedidos concluídos do período que passam pela fila (o atendimento do salão não). */
export const concluidosDaFila = (pedidos: Pedido[], periodo: Periodo) =>
  noPeriodo(pedidos, periodo).filter(
    (pedido) => pedido.status === "concluido" && pedido.tipo !== "atendimento",
  )

/**
 * Tempo de cada etapa dos pedidos concluídos: aceite, preparo, espera do motoboy, entrega
 * e o total que depende da loja.
 */
export function temposPorEtapa(pedidos: Pedido[], periodo: Periodo) {
  const concluidos = concluidosDaFila(pedidos, periodo)
  const medir = (calcular: (pedido: Pedido) => number | undefined) =>
    tempo(concluidos.flatMap((pedido) => calcular(pedido) ?? []))
  return {
    aceite: medir((pedido) => minutosEntre(pedido, "recebido", "em-preparo")),
    preparo: medir((pedido) => minutosEntre(pedido, "em-preparo", "pronto")),
    espera: medir((pedido) => minutosEntre(pedido, "pronto", "saiu-para-entrega")),
    entrega: medir((pedido) => minutosEntre(pedido, "saiu-para-entrega", "concluido")),
    total: medir(minutosNaLoja),
  }
}

/** Concluídos medidos (com o histórico até o fim da loja), cada um com os minutos. */
const medidos = (pedidos: Pedido[], periodo: Periodo) =>
  concluidosDaFila(pedidos, periodo).flatMap((pedido) => {
    const minutos = minutosNaLoja(pedido)
    return minutos === undefined ? [] : [{ pedido, minutos }]
  })

/** Quantos concluídos ficaram abaixo dos 40 minutos da fila, e a %. */
export function noPrazo(pedidos: Pedido[], periodo: Periodo) {
  const lista = medidos(pedidos, periodo)
  const dentro = lista.filter(({ minutos }) => minutos < MINUTOS_DE_ATRASO).length
  return {
    pedidos: lista.length,
    noPrazo: dentro,
    percentual: lista.length ? (dentro / lista.length) * 100 : 0,
  }
}

/** Atrasados em cada hora do dia (pela hora do pedido), só nas horas em que houve pedido. */
export function atrasosPorHora(pedidos: Pedido[], periodo: Periodo) {
  const horas = new Map<number, { hora: number; pedidos: number; atrasados: number }>()
  for (const { pedido, minutos } of medidos(pedidos, periodo)) {
    const hora = new Date(pedido.criadoEm).getHours()
    const atual = horas.get(hora) ?? { hora, pedidos: 0, atrasados: 0 }
    horas.set(hora, {
      hora,
      pedidos: atual.pedidos + 1,
      atrasados: atual.atrasados + (minutos >= MINUTOS_DE_ATRASO ? 1 : 0),
    })
  }
  return [...horas.values()].sort((a, b) => a.hora - b.hora)
}

/**
 * Cancelamentos do período: a taxa sobre os pedidos (o que ainda espera o pagamento online
 * fica fora), por motivo (sem motivo é "nao-informado") e por canal, e o pagamento online
 * que nunca entrou.
 */
export function cancelamentos(pedidos: Pedido[], periodo: Periodo) {
  const considerados = noPeriodo(pedidos, periodo).filter(
    (pedido) => pedido.status !== "aguardando-pagamento",
  )
  const cancelados = considerados.filter((pedido) => pedido.status === "cancelado")

  const motivos = new Map<
    MotivoDoFiltro,
    { motivo: MotivoDoFiltro; pedidos: number; total: number }
  >()
  for (const pedido of cancelados) {
    const motivo = motivoDoPedido(pedido) as MotivoDoFiltro
    const atual = motivos.get(motivo) ?? { motivo, pedidos: 0, total: 0 }
    motivos.set(motivo, {
      motivo,
      pedidos: atual.pedidos + 1,
      total: reais(atual.total + pedido.total),
    })
  }

  const canais = new Map<TipoPedido, { tipo: TipoPedido; pedidos: number; cancelados: number }>()
  for (const pedido of considerados) {
    const atual = canais.get(pedido.tipo) ?? { tipo: pedido.tipo, pedidos: 0, cancelados: 0 }
    canais.set(pedido.tipo, {
      ...atual,
      pedidos: atual.pedidos + 1,
      cancelados: atual.cancelados + (pedido.status === "cancelado" ? 1 : 0),
    })
  }

  // Cancelado sem nunca ter sido recebido: o pagamento online não entrou.
  const naoPagos = cancelados.filter(
    (pedido) =>
      etapasDe(pedido).some((etapa) => etapa.status === "aguardando-pagamento") &&
      !etapasDe(pedido).some((etapa) => etapa.status === "recebido"),
  )

  return {
    cancelados: cancelados.length,
    taxa: considerados.length ? (cancelados.length / considerados.length) * 100 : 0,
    porMotivo: [...motivos.values()].sort((a, b) => b.pedidos - a.pedidos || b.total - a.total),
    porCanal: [...canais.values()]
      .map((canal) => ({ ...canal, taxa: (canal.cancelados / canal.pedidos) * 100 }))
      .sort((a, b) => b.taxa - a.taxa),
    onlineNaoPago: {
      pedidos: naoPagos.length,
      total: reais(naoPagos.reduce((soma, pedido) => soma + pedido.total, 0)),
    },
  }
}

/**
 * Mesas do período: comandas fechadas, quanto tempo a mesa ficou aberta (da abertura ao
 * fechamento da conta), o ticket e as vendas de cada garçom.
 */
export function mesasDoPeriodo(pedidos: Pedido[], periodo: Periodo) {
  const comandas = concluidosDaFila(pedidos, periodo).filter((pedido) => pedido.tipo === "mesa")
  const minutos = comandas.flatMap((pedido) => minutosEntre(pedido, "recebido", "concluido") ?? [])
  const total = comandas.reduce((soma, pedido) => soma + pedido.total, 0)
  const garcons = new Map<string, { garcom: string; comandas: number; total: number }>()
  for (const pedido of comandas) {
    const garcom = pedido.mesa?.garcom ?? "Sem garçom"
    const atual = garcons.get(garcom) ?? { garcom, comandas: 0, total: 0 }
    garcons.set(garcom, {
      garcom,
      comandas: atual.comandas + 1,
      total: reais(atual.total + pedido.total),
    })
  }
  return {
    comandas: comandas.length,
    minutosPorMesa: tempo(minutos).media,
    ticket: comandas.length ? reais(total / comandas.length) : 0,
    porGarcom: [...garcons.values()].sort((a, b) => b.total - a.total),
  }
}

/** Até quantos minutos depois da hora marcada o atendimento ainda começou na hora. */
export const TOLERANCIA_DO_SALAO = 10

/**
 * Pontualidade do salão, nos atendimentos concluídos: atraso médio para começar (adiantado
 * conta como zero), % que começou na hora e a duração real contra a marcada, em minutos.
 */
export function pontualidade(pedidos: Pedido[], periodo: Periodo) {
  const atendimentos = noPeriodo(pedidos, periodo).flatMap((pedido) => {
    const comecou = quando(pedido, "em-preparo")
    const terminou = quando(pedido, "concluido")
    if (pedido.status !== "concluido" || !pedido.agendamento || comecou === undefined) return []
    if (terminou === undefined) return []
    return [
      {
        atraso: Math.max(0, (comecou - Date.parse(pedido.agendamento.inicio)) / 60_000),
        real: (terminou - comecou) / 60_000,
        marcada: pedido.agendamento.duracaoMin,
      },
    ]
  })
  const media = (valores: number[]) => tempo(valores).media
  return {
    atendimentos: atendimentos.length,
    atrasoMedio: media(atendimentos.map((item) => item.atraso)),
    naHora: atendimentos.length
      ? reais(
          (atendimentos.filter((item) => item.atraso <= TOLERANCIA_DO_SALAO).length /
            atendimentos.length) *
            100,
        )
      : 0,
    duracaoReal: media(atendimentos.map((item) => item.real)),
    duracaoMarcada: media(atendimentos.map((item) => item.marcada)),
  }
}
