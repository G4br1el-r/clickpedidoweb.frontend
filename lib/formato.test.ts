import { describe, expect, test } from "vitest"
import { emReais, emReaisCurto, plural } from "./formato"

// O Intl separa "R$" do valor com espaço não separável (U+00A0), não com espaço comum.
const NBSP = " "

describe("emReais", () => {
  test("mostra o valor em reais com centavos", () => {
    expect(emReais(30)).toBe(`R$${NBSP}30,00`)
  })

  test("separa milhar com ponto e centavos com vírgula", () => {
    expect(emReais(1234.5)).toBe(`R$${NBSP}1.234,50`)
    expect(emReais(1_000_000)).toBe(`R$${NBSP}1.000.000,00`)
  })

  test("mostra zero com centavos", () => {
    expect(emReais(0)).toBe(`R$${NBSP}0,00`)
  })

  test("arredonda para o centavo", () => {
    expect(emReais(0.005)).toBe(`R$${NBSP}0,01`)
  })

  test("valor negativo leva o sinal antes do símbolo", () => {
    expect(emReais(-5)).toBe(`-R$${NBSP}5,00`)
  })
})

describe("emReaisCurto", () => {
  test("esconde os centavos quando são zero", () => {
    expect(emReaisCurto(6)).toBe(`R$${NBSP}6`)
    expect(emReaisCurto(1000)).toBe(`R$${NBSP}1.000`)
  })

  test("mantém os centavos quando existem", () => {
    expect(emReaisCurto(6.5)).toBe(`R$${NBSP}6,50`)
    expect(emReaisCurto(39.9)).toBe(`R$${NBSP}39,90`)
  })
})

describe("plural", () => {
  test("usa o singular só para exatamente 1", () => {
    expect(plural(1, "item", "itens")).toBe("1 item")
  })

  test("usa o plural para zero e para mais de 1", () => {
    expect(plural(0, "item", "itens")).toBe("0 itens")
    expect(plural(2, "item", "itens")).toBe("2 itens")
  })
})
