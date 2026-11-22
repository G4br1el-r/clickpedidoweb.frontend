import { describe, expect, test } from "vitest"
import type { EventoPedido, Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import { filtrarFila, metricasDaFila } from "./metricas-fila"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const TEMPOS = { tempoEntrega: "40–60 min", tempoRetirada: "20 min" }
/** Minutos antes de AGORA (20:30), em ISO. */
const antes = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000).toISOString()

function pedido(
  id: number,
  status: StatusPedido,
  chegouHa: number,
  extra: Partial<Pedido> & { tipo?: TipoPedido } = {},
): Pedido {
  return {
    ...PEDIDOS_DE_TESTE[2],
    id,
    numero: id,
    status,
    tipo: "entrega",
    criadoEm: antes(chegouHa),
    atualizadoEm: antes(0),
    historico: [],
    esperaAceite: false,
    ...extra,
  }
}

const etapa = (status: StatusPedido, ha: number): EventoPedido => ({
  tipo: "etapa",
  status,
  em: antes(ha),
})

describe("metricasDaFila", () => {
  test("conta o que está em andamento, atrasado e esperando aceite", () => {
    const ativos = [
      pedido(1, "recebido", 5, { esperaAceite: true }),
      pedido(2, "em-preparo", 30),
      // Entrega em até 60 min: chegou há 70, atrasou.
      pedido(3, "saiu-para-entrega", 70),
      // Retirada em até 20 min: chegou há 25, atrasou.
      pedido(4, "pronto", 25, { tipo: "retirada" }),
    ]
    const metricas = metricasDaFila({
      ativos,
      concluidosHoje: [],
      criadosHoje: ativos,
      segmento: "pizzaria",
      agora: AGORA,
      tempos: TEMPOS,
    })
    expect(metricas).toMatchObject({ emAndamento: 4, atrasados: 2, esperandoAceite: 1 })
  })

  test("na última hora, concluídos e cancelados de hoje", () => {
    const criadosHoje = [
      pedido(1, "recebido", 10),
      pedido(2, "cancelado", 50),
      pedido(3, "concluido", 59),
      pedido(4, "concluido", 61),
      pedido(5, "cancelado", 120),
    ]
    const metricas = metricasDaFila({
      ativos: [criadosHoje[0]],
      concluidosHoje: [criadosHoje[2], criadosHoje[3]],
      criadosHoje,
      segmento: "pizzaria",
      agora: AGORA,
      tempos: TEMPOS,
    })
    expect(metricas).toMatchObject({ ultimaHora: 3, concluidos: 2, cancelados: 2 })
  })

  test("tempo médio de preparo (de começar a ficar pronto) e até a entrega, em minutos", () => {
    // Preparo de 12 e de 18 min: média 15.
    const preparou12 = pedido(1, "pronto", 40, {
      historico: [etapa("em-preparo", 30), etapa("pronto", 18)],
    })
    const preparou18 = pedido(2, "concluido", 90, {
      historico: [etapa("em-preparo", 80), etapa("pronto", 62), etapa("concluido", 40)],
    })
    // Entregas concluídas: 50 min (pelo evento) e 40 min (sem evento, pela atualização).
    const semEvento = pedido(3, "concluido", 100, { atualizadoEm: antes(60) })
    const metricas = metricasDaFila({
      ativos: [preparou12],
      concluidosHoje: [preparou18, semEvento],
      criadosHoje: [preparou12, preparou18, semEvento],
      segmento: "pizzaria",
      agora: AGORA,
      tempos: TEMPOS,
    })
    expect(metricas.preparoMedioMin).toBe(15)
    expect(metricas.entregaMedioMin).toBe(45)
  })

  test("sem pedido para medir, sem tempo médio", () => {
    const metricas = metricasDaFila({
      ativos: [],
      concluidosHoje: [pedido(1, "concluido", 30, { tipo: "retirada" })],
      criadosHoje: [],
      segmento: "pizzaria",
      agora: AGORA,
      tempos: TEMPOS,
    })
    expect(metricas.preparoMedioMin).toBeNull()
    expect(metricas.entregaMedioMin).toBeNull()
  })
})

describe("filtrarFila", () => {
  const ativos = [
    pedido(1, "recebido", 5, { esperaAceite: true }),
    pedido(2, "em-preparo", 30),
    pedido(3, "saiu-para-entrega", 70),
    pedido(4, "pronto", 61, { tipo: "retirada" }),
  ]
  const ids = (filtro: Parameters<typeof filtrarFila>[1]) =>
    filtrarFila(ativos, filtro, AGORA, TEMPOS).map((item) => item.id)

  test("cada métrica mostra só os seus pedidos; sem filtro, todos", () => {
    expect(ids("atrasados")).toEqual([3, 4])
    expect(ids("aceite")).toEqual([1])
    expect(ids("ultima-hora")).toEqual([1, 2])
    expect(ids(null)).toEqual([1, 2, 3, 4])
  })
})
