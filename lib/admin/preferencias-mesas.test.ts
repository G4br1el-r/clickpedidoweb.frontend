import { beforeEach, describe, expect, test } from "vitest"
import { usePreferenciasMesas } from "./preferencias-mesas"

beforeEach(() => {
  localStorage.clear()
  usePreferenciasMesas.setState(usePreferenciasMesas.getInitialState(), true)
})

describe("usePreferenciasMesas", () => {
  test("os atalhos de uma tecla começam ligados", () => {
    expect(usePreferenciasMesas.getState().atalhosLigados).toBe(true)
  })

  test("desligar fica guardado neste navegador", async () => {
    usePreferenciasMesas.getState().ligarAtalhos(false)
    const guardado = localStorage.getItem("clickpedido-admin-mesas") as string
    expect(JSON.parse(guardado)).toEqual({ state: { atalhosLigados: false }, version: 1 })

    usePreferenciasMesas.setState(usePreferenciasMesas.getInitialState(), true)
    localStorage.setItem("clickpedido-admin-mesas", guardado)
    await usePreferenciasMesas.persist.rehydrate()
    expect(usePreferenciasMesas.getState().atalhosLigados).toBe(false)
  })
})
