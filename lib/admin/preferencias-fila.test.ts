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

describe("praça e vias deste aparelho", () => {
  test("começa em Todas, sem imprimir as vias, e guarda a escolha", async () => {
    expect(usePreferenciasFila.getState()).toMatchObject({ praca: "todas", imprimirVias: false })
    usePreferenciasFila.getState().escolherPraca("praca-forno")
    usePreferenciasFila.getState().ligarVias(true)
    const guardado = JSON.parse(localStorage.getItem("clickpedido-admin-fila") ?? "{}")

    usePreferenciasFila.setState(usePreferenciasFila.getInitialState(), true)
    localStorage.setItem("clickpedido-admin-fila", JSON.stringify(guardado))
    await usePreferenciasFila.persist.rehydrate()
    expect(usePreferenciasFila.getState()).toMatchObject({
      praca: "praca-forno",
      imprimirVias: true,
    })
  })
})

describe("exibição da cozinha neste aparelho", () => {
  test("começa no tamanho 1 de 0 a 3, sem compacto; A− e A+ param nas pontas", () => {
    expect(usePreferenciasFila.getState()).toMatchObject({ tamanho: 1, compacto: false })
    const { mudarTamanho } = usePreferenciasFila.getState()
    mudarTamanho(-1)
    mudarTamanho(-1)
    expect(usePreferenciasFila.getState().tamanho).toBe(0)
    mudarTamanho(1)
    mudarTamanho(1)
    mudarTamanho(1)
    mudarTamanho(1)
    expect(usePreferenciasFila.getState().tamanho).toBe(3)
  })

  test("o tamanho e o compacto ficam guardados", async () => {
    usePreferenciasFila.getState().mudarTamanho(1)
    usePreferenciasFila.getState().ligarCompacto(true)
    const guardado = JSON.parse(localStorage.getItem("clickpedido-admin-fila") ?? "{}")

    usePreferenciasFila.setState(usePreferenciasFila.getInitialState(), true)
    localStorage.setItem("clickpedido-admin-fila", JSON.stringify(guardado))
    await usePreferenciasFila.persist.rehydrate()
    expect(usePreferenciasFila.getState()).toMatchObject({ tamanho: 2, compacto: true })
  })
})
