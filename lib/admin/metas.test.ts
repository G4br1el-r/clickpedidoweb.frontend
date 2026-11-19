import { beforeEach, describe, expect, test } from "vitest"
import { useMetas } from "./metas"

beforeEach(() => {
  localStorage.clear()
  useMetas.setState(useMetas.getInitialState(), true)
})

describe("useMetas", () => {
  test("a meta de cada segmento fica guardada neste navegador", async () => {
    useMetas.getState().definir("pizzaria", { faturamento: 30_000, pedidos: null })
    const salvo = localStorage.getItem("clickpedido-admin-metas") ?? ""
    // Zerar o estado também grava: devolve o que estava salvo antes de recarregar.
    useMetas.setState(useMetas.getInitialState(), true)
    localStorage.setItem("clickpedido-admin-metas", salvo)

    await useMetas.persist.rehydrate()

    expect(useMetas.getState().metas).toEqual({ pizzaria: { faturamento: 30_000, pedidos: null } })
  })

  test("apagar a meta de um segmento não mexe nas dos outros", () => {
    const { definir } = useMetas.getState()
    definir("pizzaria", { faturamento: 30_000, pedidos: null })
    definir("salao", { faturamento: 12_000, pedidos: 150 })

    useMetas.getState().apagar("pizzaria")

    expect(useMetas.getState().metas).toEqual({ salao: { faturamento: 12_000, pedidos: 150 } })
  })
})
