import { describe, expect, test } from "vitest"
import { distanciaDaSeta, mascaraDaRolagem, setasDaRolagem } from "./rolagem"

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

describe("mascaraDaRolagem: a lista esmaece onde ainda tem conteúdo", () => {
  test("quando tudo cabe, nada esmaece", () => {
    expect(mascaraDaRolagem({ posicao: 0, total: 300, visivel: 300 })).toBeUndefined()
  })

  test("no topo de uma lista maior, só o pé esmaece", () => {
    expect(mascaraDaRolagem({ posicao: 0, total: 900, visivel: 300 })).toBe(
      "linear-gradient(to bottom, #000 0, #000 calc(100% - 32px), transparent 100%)",
    )
  })

  test("no meio, o topo e o pé esmaecem", () => {
    expect(mascaraDaRolagem({ posicao: 200, total: 900, visivel: 300 })).toBe(
      "linear-gradient(to bottom, transparent 0, #000 24px, #000 calc(100% - 32px), transparent 100%)",
    )
  })

  test("no fim, só o topo esmaece", () => {
    expect(mascaraDaRolagem({ posicao: 600, total: 900, visivel: 300 })).toBe(
      "linear-gradient(to bottom, transparent 0, #000 24px, #000 100%)",
    )
  })
})
