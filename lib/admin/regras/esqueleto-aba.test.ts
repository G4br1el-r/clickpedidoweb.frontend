import { describe, expect, test } from "vitest"
import type { AbaId } from "./dashboard/abas"
import { formaDoEsqueleto } from "./esqueleto-aba"

describe("formaDoEsqueleto", () => {
  test("o Resumo tem as réguas de hoje e do período, o gráfico e duas listas", () => {
    expect(formaDoEsqueleto("resumo")).toEqual({ reguas: 2, grafico: true, listas: 2 })
  })

  test("Vendas abre com uma régua e o gráfico dia a dia", () => {
    expect(formaDoEsqueleto("vendas")).toEqual({ reguas: 1, grafico: true, listas: 2 })
  })

  test.each<AbaId>(["produtos", "clientes", "entrega", "agenda", "farmacia", "pesagem"])(
    "%s não tem gráfico: régua e listas",
    (aba) => {
      const forma = formaDoEsqueleto(aba)
      expect(forma.grafico).toBe(false)
      expect(forma.reguas).toBe(1)
      expect(forma.listas).toBeGreaterThanOrEqual(1)
    },
  )

  test("Financeiro e Operação têm duas réguas", () => {
    expect(formaDoEsqueleto("financeiro").reguas).toBe(2)
    expect(formaDoEsqueleto("operacao").reguas).toBe(2)
  })
})
