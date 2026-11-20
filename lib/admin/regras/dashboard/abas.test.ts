import { describe, expect, test } from "vitest"
import { abaEscolhida, abasDo } from "./abas"

describe("abasDo", () => {
  test("todo segmento começa no Resumo, com Vendas, Produtos e Financeiro", () => {
    expect(abasDo("pizzaria").map((aba) => aba.titulo)).toEqual([
      "Resumo",
      "Vendas",
      "Produtos",
      "Financeiro",
    ])
    expect(abasDo("salao").map((aba) => aba.id)).toEqual([
      "resumo",
      "vendas",
      "produtos",
      "financeiro",
    ])
  })
})

describe("abaEscolhida", () => {
  test("a aba da URL vale quando o segmento tem ela", () => {
    expect(abaEscolhida("vendas", "farmacia")).toBe("vendas")
  })

  test("sem aba, ou com uma aba que não existe, abre o Resumo", () => {
    expect(abaEscolhida(null, "adega")).toBe("resumo")
    expect(abaEscolhida("clientes-vip", "adega")).toBe("resumo")
  })
})
