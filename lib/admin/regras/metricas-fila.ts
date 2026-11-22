import type { Pedido, StatusPedido } from "../dados/tipos"
import type { SegmentoPainelId } from "../segmentos-painel"
import { colunasDaFila, urgencia } from "./fila"
import type { TemposDaLoja } from "./prazo"

export type MetricasDaFila = {
  emAndamento: number
  atrasados: number
  esperandoAceite: number
  /** De começar o preparo a ficar pronto, em minutos. */
  preparoMedioMin: number | null
  /** Da chegada à entrega concluída, em minutos. */
  entregaMedioMin: number | null
  ultimaHora: number
  concluidos: number
  cancelados: number
}

const UMA_HORA = 60 * 60_000

/** Quando o pedido chegou a uma etapa, pela linha do tempo. */
const quandoChegou = (pedido: Pedido, status: StatusPedido) =>
  pedido.historico?.find((evento) => evento.tipo === "etapa" && evento.status === status)?.em

function mediaEmMinutos(duracoes: number[]): number | null {
  if (duracoes.length === 0) return null
  return Math.round(duracoes.reduce((soma, ms) => soma + ms, 0) / duracoes.length / 60_000)
}

/**
 * Números ao vivo da barra da fila. `ativos` é a fila, `concluidosHoje` o que foi concluído
 * hoje e `criadosHoje` tudo o que chegou hoje (inclusive cancelados). Sem faturamento.
 */
export function metricasDaFila({
  ativos,
  concluidosHoje,
  criadosHoje,
  segmento,
  agora,
  tempos,
}: {
  ativos: Pedido[]
  concluidosHoje: Pedido[]
  criadosHoje: Pedido[]
  segmento: SegmentoPainelId
  agora: Date
  tempos: TemposDaLoja
}): MetricasDaFila {
  const naFila = colunasDaFila(ativos, segmento, agora).flatMap((coluna) => coluna.pedidos)

  const preparos = [...ativos, ...concluidosHoje].flatMap((pedido) => {
    const comecou = quandoChegou(pedido, "em-preparo")
    const ficou = quandoChegou(pedido, "pronto")
    return comecou && ficou ? [Date.parse(ficou) - Date.parse(comecou)] : []
  })
  const entregas = concluidosHoje
    .filter((pedido) => pedido.tipo === "entrega")
    .map(
      (pedido) =>
        Date.parse(quandoChegou(pedido, "concluido") ?? pedido.atualizadoEm) -
        Date.parse(pedido.criadoEm),
    )

  return {
    emAndamento: naFila.length,
    atrasados: naFila.filter((pedido) => urgencia(pedido, agora, tempos) === "atrasado").length,
    esperandoAceite: naFila.filter((pedido) => pedido.esperaAceite).length,
    preparoMedioMin: mediaEmMinutos(preparos),
    entregaMedioMin: mediaEmMinutos(entregas),
    ultimaHora: criadosHoje.filter(
      (pedido) => agora.getTime() - Date.parse(pedido.criadoEm) < UMA_HORA,
    ).length,
    concluidos: concluidosHoje.length,
    cancelados: criadosHoje.filter((pedido) => pedido.status === "cancelado").length,
  }
}

/** As métricas que filtram a fila ao tocar. */
export const FILTROS_DA_FILA = ["atrasados", "aceite", "ultima-hora"] as const
export type FiltroDaFila = (typeof FILTROS_DA_FILA)[number]

/** Só os pedidos da métrica escolhida, valendo para todas as colunas. */
export function filtrarFila(
  pedidos: Pedido[],
  filtro: FiltroDaFila | null,
  agora: Date,
  tempos: TemposDaLoja,
): Pedido[] {
  switch (filtro) {
    case "atrasados":
      return pedidos.filter((pedido) => urgencia(pedido, agora, tempos) === "atrasado")
    case "aceite":
      return pedidos.filter((pedido) => pedido.esperaAceite)
    case "ultima-hora":
      return pedidos.filter((pedido) => agora.getTime() - Date.parse(pedido.criadoEm) < UMA_HORA)
    default:
      return pedidos
  }
}
