import { describe, expect, test } from "vitest"
import type { Pedido, StatusPedido } from "../dados/tipos"
import { alertasDaFila } from "./alertas-fila"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const TEMPOS = { tempoEntrega: "40–60 min", tempoRetirada: "20 min" }
const antes = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000).toISOString()

function pedido(id: number, status: StatusPedido, extra: Partial<Pedido> = {}): Pedido {
  return {
    ...PEDIDOS_DE_TESTE[2],
    id,
    numero: id,
    tipo: "entrega",
    status,
    criadoEm: antes(10),
    atualizadoEm: antes(10),
    historico: [],
    ...extra,
  }
}

const opcoes = { agora: AGORA, tempos: TEMPOS, paradoMin: 10, desde: antes(30) }
const chaves = (alertas: { id: string }[]) => alertas.map((alerta) => alerta.id)

describe("alertasDaFila", () => {
  test("pronto parado há mais do limite, pela hora em que ficou pronto", () => {
    const parado = pedido(1, "pronto", {
      historico: [{ tipo: "etapa", status: "pronto", em: antes(12) }],
    })
    const recente = pedido(2, "pronto", {
      historico: [{ tipo: "etapa", status: "pronto", em: antes(4) }],
    })
    const alertas = alertasDaFila({ ...opcoes, todos: [parado, recente], anteriores: [] })
    expect(chaves(alertas)).toEqual(["parado-1"])
    expect(alertas[0].texto).toBe("#1 pronto há 12 min")
  })

  test("prestes a atrasar: faltam 5 minutos ou menos do prazo", () => {
    // Entrega em até 60 min: chegou há 56, faltam 4.
    const quase = pedido(3, "em-preparo", { criadoEm: antes(56) })
    const folga = pedido(4, "em-preparo", { criadoEm: antes(30) })
    const passou = pedido(5, "em-preparo", { criadoEm: antes(70) })
    const alertas = alertasDaFila({ ...opcoes, todos: [quase, folga, passou], anteriores: [] })
    expect(chaves(alertas)).toEqual(["atraso-3"])
    expect(alertas[0].texto).toBe("#3 atrasa em 4 min")
  })

  test("pagamento online confirmado: estava aguardando e agora está pago", () => {
    const pago = pedido(6, "recebido", { situacaoPagamento: "pago" })
    const anteriores = [pedido(6, "aguardando-pagamento", { situacaoPagamento: "pendente" })]
    const alertas = alertasDaFila({ ...opcoes, todos: [pago], anteriores })
    expect(alertas.map((alerta) => [alerta.id, alerta.texto])).toEqual([
      ["pago-6", "#6: pagamento online confirmado"],
    ])
  })

  test("o cliente cancelou depois que a fila abriu", () => {
    const cancelou = (id: number, minutos: number) =>
      pedido(id, "cancelado", {
        cancelamento: {
          tipo: "cancelamento",
          motivo: "cliente-pediu",
          em: antes(minutos),
          porCliente: true,
        },
      })
    const alertas = alertasDaFila({
      ...opcoes,
      todos: [cancelou(7, 2), cancelou(8, 40)],
      anteriores: [],
    })
    expect(alertas.map((alerta) => [alerta.id, alerta.texto])).toEqual([
      ["cancelou-7", "#7: o cliente cancelou"],
    ])
  })

  test("a Cozinha marcou pronto depois que a fila abriu", () => {
    const pelaCozinha = (id: number, minutos: number) =>
      pedido(id, "pronto", {
        historico: [{ tipo: "etapa", status: "pronto", em: antes(minutos), por: "cozinha" }],
      })
    const pelaFila = pedido(11, "pronto", {
      historico: [{ tipo: "etapa", status: "pronto", em: antes(2) }],
    })
    const alertas = alertasDaFila({
      ...opcoes,
      todos: [pelaCozinha(9, 2), pelaCozinha(10, 40), pelaFila],
      anteriores: [],
    }).filter((alerta) => alerta.chave === "cozinha")
    expect(alertas.map((alerta) => [alerta.id, alerta.texto])).toEqual([
      ["cozinha-9", "#9 ficou pronto na Cozinha"],
    ])
  })
})
