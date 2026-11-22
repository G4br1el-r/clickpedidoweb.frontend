import { describe, expect, test } from "vitest"
import type { ItemPedido } from "../dados/tipos"
import { leituraDoItem } from "./leitura-do-item"

const item = (opcoes: string[], extra: Partial<ItemPedido> = {}) =>
  ({ id: "i", produtoId: "p", nome: "Pizza", quantidade: 1, opcoes, ...extra }) as ItemPedido

describe("leituraDoItem", () => {
  test("pizzaria: os sabores em frações, a borda em destaque e o tamanho no topo", () => {
    expect(
      leituraDoItem(
        item([
          "Tamanho: Grande",
          "1º sabor: Calabresa",
          "2º sabor: Portuguesa",
          "Borda: Catupiry",
          "Sem cebola",
        ]),
        "pizzaria",
      ),
    ).toEqual({
      tamanho: "Grande",
      fracoes: ["½ Calabresa", "½ Portuguesa"],
      destaque: "Borda: Catupiry",
      linhas: ["Sem cebola"],
      peso: null,
    })
  })

  test("pizzaria: um sabor só não vira fração; borda tradicional não ganha destaque", () => {
    expect(leituraDoItem(item(["1º sabor: Calabresa", "Borda: Tradicional"]), "pizzaria")).toEqual({
      tamanho: null,
      fracoes: [],
      destaque: null,
      linhas: ["1º sabor: Calabresa", "Borda: Tradicional"],
      peso: null,
    })
  })

  test("adega: o combo abre em itens, um de cada escolha por unidade", () => {
    expect(
      leituraDoItem(
        item(["Energético: Red Bull", "Gelos: Coco, Melancia"], {
          nome: "Combo Gin",
          quantidade: 2,
        }),
        "adega",
      ).linhas,
    ).toEqual(["2× Red Bull", "2× Coco", "2× Melancia"])
  })

  test("açougue: o peso pedido, em gramas ou quilos, e as opções do corte", () => {
    expect(
      leituraDoItem(
        item(["Corte: Bife", "Preparo: Temperado"], { pesoGramas: 750, quantidade: 2 }),
        "acougue",
      ),
    ).toEqual({
      tamanho: null,
      fracoes: [],
      destaque: null,
      linhas: ["Corte: Bife", "Preparo: Temperado"],
      peso: "1,5 kg",
    })
    expect(leituraDoItem(item([], { pesoGramas: 500 }), "acougue").peso).toBe("500 g")
  })

  test("os outros segmentos mostram as opções como vieram", () => {
    expect(leituraDoItem(item(["Ponto: Mal passado"]), "lanchonete").linhas).toEqual([
      "Ponto: Mal passado",
    ])
  })
})
