import { beforeEach, describe, expect, test } from "vitest"
import { usePreferenciasFila } from "./preferencias-fila"

beforeEach(() => {
  localStorage.clear()
  usePreferenciasFila.setState(usePreferenciasFila.getInitialState(), true)
})

describe("usePreferenciasFila", () => {
  test("começa com o som desligado, seguindo o som da loja, e a simulação ligada", () => {
    const { somLigado, tipoSom, simular } = usePreferenciasFila.getState()
    expect({ somLigado, tipoSom, simular }).toEqual({
      somLigado: false,
      // Sem escolha no aparelho, vale o som das configurações da loja.
      tipoSom: null,
      simular: true,
    })
  })

  test("guarda as escolhas neste navegador", async () => {
    const estado = usePreferenciasFila.getState()
    estado.ligarSom(true)
    estado.escolherSom("suave")
    estado.ligarSimulacao(false)

    usePreferenciasFila.setState(usePreferenciasFila.getInitialState(), true)
    localStorage.setItem(
      "clickpedido-admin-fila",
      JSON.stringify({ state: { somLigado: true, tipoSom: "suave", simular: false }, version: 1 }),
    )
    await usePreferenciasFila.persist.rehydrate()
    const { somLigado, tipoSom, simular } = usePreferenciasFila.getState()
    expect({ somLigado, tipoSom, simular }).toEqual({
      somLigado: true,
      tipoSom: "suave",
      simular: false,
    })
  })
})

describe("sons de cada evento da cozinha", () => {
  test("começam com novo, cancelado e atrasado ligados e o repetir desligado", () => {
    expect(usePreferenciasFila.getState().sons).toEqual({
      novo: true,
      cancelado: true,
      atrasado: true,
      repetirNovo: false,
    })
  })

  test("cada chave muda só o seu evento, e fica guardada neste navegador", async () => {
    usePreferenciasFila.getState().ligarSomDoEvento("atrasado", false)
    usePreferenciasFila.getState().ligarSomDoEvento("repetirNovo", true)
    const guardado = JSON.parse(localStorage.getItem("clickpedido-admin-fila") ?? "{}")

    usePreferenciasFila.setState(usePreferenciasFila.getInitialState(), true)
    localStorage.setItem("clickpedido-admin-fila", JSON.stringify(guardado))
    await usePreferenciasFila.persist.rehydrate()
    expect(usePreferenciasFila.getState().sons).toEqual({
      novo: true,
      cancelado: true,
      atrasado: false,
      repetirNovo: true,
    })
  })
})
