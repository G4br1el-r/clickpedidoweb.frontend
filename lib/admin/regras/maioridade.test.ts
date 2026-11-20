import { describe, expect, test } from "vitest"
import type { Pedido, Produto } from "../dados/tipos"
import { pedidoComAlcool } from "./maioridade"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const produto = (id: string, alcoolico?: boolean) => ({ id, alcoolico }) as Produto
const PRODUTOS = [produto("cerveja", true), produto("agua"), produto("gelo", false)]

const comItens = (itens: { produtoId: string | null; produtosDasOpcoes?: string[] }[]): Pedido => ({
  ...PEDIDOS_DE_TESTE[2],
  itens: itens.map((item, indice) => ({
    ...PEDIDOS_DE_TESTE[2].itens[0],
    id: String(indice),
    ...item,
  })),
})

describe("pedidoComAlcool", () => {
  test("algum item (ou produto do combo) alcoólico pede documento", () => {
    expect(
      pedidoComAlcool(comItens([{ produtoId: "agua" }, { produtoId: "cerveja" }]), PRODUTOS),
    ).toBe(true)
    expect(
      pedidoComAlcool(
        comItens([{ produtoId: "combo", produtosDasOpcoes: ["gelo", "cerveja"] }]),
        PRODUTOS,
      ),
    ).toBe(true)
  })

  test("sem álcool, item avulso ou produto que não está no cardápio: não pede", () => {
    expect(pedidoComAlcool(comItens([{ produtoId: "agua" }, { produtoId: null }]), PRODUTOS)).toBe(
      false,
    )
    expect(pedidoComAlcool(comItens([{ produtoId: "sumiu" }]), PRODUTOS)).toBe(false)
  })
})
