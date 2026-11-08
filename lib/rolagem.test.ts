import { describe, expect, test } from "vitest"
import { distanciaDaSeta, setasDaRolagem } from "./rolagem"

describe("setasDaRolagem", () => {
  test("quando tudo cabe, nenhuma seta aparece", () => {
    expect(setasDaRolagem({ posicao: 0, total: 600, visivel: 640 })).toEqual({
      anterior: false,
      proxima: false,
    })
  })

  test("no começo de uma lista maior, só a seta da frente aparece", () => {
    expect(setasDaRolagem({ posicao: 0, total: 1200, visivel: 640 })).toEqual({
      anterior: false,
      proxima: true,
    })
  })

  test("no meio, as duas aparecem", () => {
    expect(setasDaRolagem({ posicao: 300, total: 1200, visivel: 640 })).toEqual({
      anterior: true,
      proxima: true,
    })
  })

  test("no fim, só a seta de voltar aparece", () => {
    expect(setasDaRolagem({ posicao: 560, total: 1200, visivel: 640 })).toEqual({
      anterior: true,
      proxima: false,
    })
  })

  test("sobra de 1 px por arredondamento não conta como rolagem", () => {
    expect(setasDaRolagem({ posicao: 0.6, total: 1200, visivel: 640 }).anterior).toBe(false)
    expect(setasDaRolagem({ posicao: 559.4, total: 1200, visivel: 640 }).proxima).toBe(false)
  })
})

describe("distanciaDaSeta", () => {
  test("cada toque na seta anda 80% do que está à vista, para não perder a referência", () => {
    expect(distanciaDaSeta(640)).toBe(512)
    expect(distanciaDaSeta(333)).toBe(266)
  })
})
