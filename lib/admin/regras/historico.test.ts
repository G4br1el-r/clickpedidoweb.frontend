import { describe, expect, test } from "vitest"
import { comEtapa, comEvento, itensEmTexto } from "./historico"
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

describe("comEvento", () => {
  const aberta = {
    tipo: "aberta",
    em: "2026-11-13T22:00:00.000Z",
    texto: "Mesa aberta para 2 pessoas",
  } as const

  test("a comanda sem eventos ganha a lista com o primeiro", () => {
    const pedido = pedidoDeTeste(1, CRIADO, 30)
    expect(pedido.eventos).toBeUndefined()
    expect(comEvento(pedido, aberta)).toEqual({ ...pedido, eventos: [aberta] })
  })

  test("o evento novo entra no fim, sem mudar o resto", () => {
    const pedido = pedidoDeTeste(1, CRIADO, 30, { eventos: [aberta] })
    const servida = {
      tipo: "servida",
      em: "2026-11-13T22:30:00.000Z",
      por: "Bia",
      texto: "Rodada servida",
    } as const
    expect(comEvento(pedido, servida).eventos).toEqual([aberta, servida])
    expect(pedido.eventos).toEqual([aberta])
  })
})

describe("itensEmTexto", () => {
  test("quantidade e nome, separados por vírgula", () => {
    expect(
      itensEmTexto([
        { quantidade: 2, nome: "Calabresa" },
        { quantidade: 1, nome: "Coca" },
      ]),
    ).toBe("2× Calabresa, 1× Coca")
  })

  test("lista vazia dá texto vazio", () => {
    expect(itensEmTexto([])).toBe("")
  })
})
