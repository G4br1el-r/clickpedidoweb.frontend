import { describe, expect, test } from "vitest"
import { nomesDo } from "./nomes"

describe("nomesDo", () => {
  test("no salão, o pedido é um atendimento", () => {
    expect(nomesDo("salao")).toEqual({
      Pedidos: "Atendimentos",
      pedido: "atendimento",
      pedidos: "atendimentos",
    })
  })

  test("nos outros segmentos, inclusive a farmácia, continua pedido", () => {
    expect(nomesDo("farmacia")).toEqual({
      Pedidos: "Pedidos",
      pedido: "pedido",
      pedidos: "pedidos",
    })
    expect(nomesDo("adega").pedido).toBe("pedido")
  })
})
