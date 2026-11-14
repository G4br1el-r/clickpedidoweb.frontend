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
