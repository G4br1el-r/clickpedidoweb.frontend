import { describe, expect, test } from "vitest"
import { comEtapa } from "./historico"
import { pedidoDeTeste } from "./pedidos-de-teste"

const CRIADO = new Date(2026, 10, 13, 19, 0)

describe("comEtapa", () => {
  test("pedido sem histórico ganha a etapa em que está, na hora dada", () => {
    const pedido = pedidoDeTeste(1, CRIADO, 30, { status: "recebido", historico: [] })

    expect(comEtapa(pedido, "2026-11-13T22:00:00.000Z").historico).toEqual([
      { status: "recebido", em: "2026-11-13T22:00:00.000Z" },
    ])
  })

  test("a etapa nova entra no fim; a mesma etapa de novo não se repete", () => {
    const pedido = pedidoDeTeste(1, CRIADO, 30, {
      status: "em-preparo",
      historico: [{ status: "recebido", em: "2026-11-13T22:00:00.000Z" }],
    })

    const avancado = comEtapa(pedido, "2026-11-13T22:05:00.000Z")
    expect(avancado.historico).toEqual([
      { status: "recebido", em: "2026-11-13T22:00:00.000Z" },
      { status: "em-preparo", em: "2026-11-13T22:05:00.000Z" },
    ])
    expect(comEtapa(avancado, "2026-11-13T22:09:00.000Z")).toBe(avancado)
  })
})
