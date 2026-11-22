import { describe, expect, test } from "vitest"
import { abaEscolhida, abasDo } from "./abas"

const titulos = (segmento: Parameters<typeof abasDo>[0]) =>
  abasDo(segmento).map((aba) => aba.titulo)

describe("abasDo", () => {
  test("com entrega, a aba Entrega vem antes do Financeiro; sem aba do segmento na pizzaria", () => {
    expect(titulos("pizzaria")).toEqual([
      "Resumo",
      "Vendas",
      "Produtos",
      "Clientes",
      "Operação",
      "Entrega",
      "Financeiro",
    ])
    expect(titulos("adega")).toEqual(titulos("pizzaria"))
    expect(titulos("lanchonete")).toEqual(titulos("pizzaria"))
  })

  test("a aba do segmento fica no fim: Agenda no salão (sem Entrega), Pesagem e Farmácia", () => {
    expect(abasDo("salao").map((aba) => aba.id)).toEqual([
      "resumo",
      "vendas",
      "produtos",
      "clientes",
      "operacao",
      "financeiro",
      "agenda",
    ])
    expect(titulos("acougue").slice(-3)).toEqual(["Entrega", "Financeiro", "Pesagem"])
    expect(titulos("farmacia").slice(-3)).toEqual(["Entrega", "Financeiro", "Farmácia"])
  })
})

describe("abaEscolhida", () => {
  test("a aba da URL vale quando o segmento tem ela", () => {
    expect(abaEscolhida("vendas", "farmacia")).toBe("vendas")
    expect(abaEscolhida("pesagem", "acougue")).toBe("pesagem")
  })

  test("sem aba, ou com uma aba que não existe no segmento, abre o Resumo", () => {
    expect(abaEscolhida(null, "adega")).toBe("resumo")
    expect(abaEscolhida("clientes-vip", "adega")).toBe("resumo")
    expect(abaEscolhida("entrega", "salao")).toBe("resumo")
    expect(abaEscolhida("agenda", "pizzaria")).toBe("resumo")
  })
})
