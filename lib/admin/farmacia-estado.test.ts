import { beforeEach, describe, expect, test, vi } from "vitest"
import { useFarmacia } from "./farmacia-estado"

beforeEach(() => {
  localStorage.clear()
  useFarmacia.setState(useFarmacia.getInitialState(), true)
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-13T20:30:00-03:00"))
})

describe("useFarmacia", () => {
  test("aprova a receita guardando a hora e se a via ficou retida", () => {
    useFarmacia.getState().aprovar("rec-1001", { retida: true })
    expect(useFarmacia.getState().decisoes["rec-1001"]).toEqual({
      situacao: "aprovada",
      em: "2026-11-13T23:30:00.000Z",
      retida: true,
    })
  })

  test("recusa com o motivo e desfaz a decisão", () => {
    useFarmacia.getState().recusar("rec-1003", "Receita vencida")
    expect(useFarmacia.getState().decisoes["rec-1003"]).toMatchObject({
      situacao: "recusada",
      motivo: "Receita vencida",
    })
    useFarmacia.getState().desfazer("rec-1003")
    expect(useFarmacia.getState().decisoes["rec-1003"]).toBeUndefined()
  })

  test("as decisões ficam salvas neste navegador", async () => {
    useFarmacia.getState().aprovar("rec-1002", { retida: true })
    expect(JSON.parse(localStorage.getItem("clickpedido-admin-farmacia") ?? "{}")).toMatchObject({
      state: { decisoes: { "rec-1002": { situacao: "aprovada" } } },
    })
  })

  test("separa vários lotes de uma vez para descarte ou devolução", () => {
    useFarmacia.getState().separarLotes(["lote-1", "lote-2"], "descarte")
    useFarmacia.getState().separarLotes(["lote-3"], "devolucao")
    expect(useFarmacia.getState().lotes).toEqual({
      "lote-1": "descarte",
      "lote-2": "descarte",
      "lote-3": "devolucao",
    })
  })

  test("desfaz a separação só dos lotes pedidos", () => {
    useFarmacia.getState().separarLotes(["lote-1", "lote-2", "lote-3"], "descarte")
    useFarmacia.getState().desfazerLotes(["lote-1", "lote-3"])
    expect(useFarmacia.getState().lotes).toEqual({ "lote-2": "descarte" })
  })

  test("a separação dos lotes fica salva neste navegador", () => {
    useFarmacia.getState().separarLotes(["lote-9"], "devolucao")
    expect(JSON.parse(localStorage.getItem("clickpedido-admin-farmacia") ?? "{}")).toMatchObject({
      state: { lotes: { "lote-9": "devolucao" } },
    })
  })

  test("um salvo antigo, sem lotes, abre com a lista vazia", async () => {
    localStorage.setItem(
      "clickpedido-admin-farmacia",
      JSON.stringify({ state: { decisoes: {} }, version: 1 }),
    )
    await useFarmacia.persist.rehydrate()
    expect(useFarmacia.getState().lotes).toEqual({})
  })

  test("abre com as decisões guardadas", async () => {
    localStorage.setItem(
      "clickpedido-admin-farmacia",
      JSON.stringify({
        state: { decisoes: { "rec-1005": { situacao: "recusada", em: "x", motivo: "CRM" } } },
        version: 1,
      }),
    )
    await useFarmacia.persist.rehydrate()
    expect(useFarmacia.getState().decisoes["rec-1005"]?.situacao).toBe("recusada")
  })
})
