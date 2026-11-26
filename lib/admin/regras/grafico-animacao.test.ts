import { describe, expect, test } from "vitest"
import { animacaoDoGrafico } from "./grafico-animacao"

describe("animacaoDoGrafico", () => {
  test("com movimento, as barras crescem em menos de 300 ms e assentam devagar", () => {
    expect(animacaoDoGrafico(false)).toEqual({
      isAnimationActive: true,
      animationDuration: 280,
      animationEasing: "ease-out",
    })
  })

  test("com movimento reduzido, o gráfico aparece pronto", () => {
    expect(animacaoDoGrafico(true)).toEqual({ isAnimationActive: false })
  })
})
