import { describe, expect, test } from "vitest"
import { textoDaAba, textoDaNotificacao } from "./aparelho"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

describe("textoDaNotificacao", () => {
  test("número no título; canal, cliente e total no corpo", () => {
    const pedido = {
      ...PEDIDOS_DE_TESTE[2],
      numero: 1412,
      tipo: "entrega" as const,
      total: 72,
      cliente: { nome: "Ana Lima", telefone: "12991230000" },
    }
    expect(textoDaNotificacao(pedido)).toEqual({
      titulo: "Pedido novo #1412",
      // O Intl separa "R$" do valor com espaço não separável.
      corpo: "Entrega · Ana Lima · R$ 72,00",
    })
  })
})

describe("textoDaAba", () => {
  test("pisca entre a contagem e o título; sem pedido esperando, só o título", () => {
    expect(textoDaAba("Fila de pedidos", 2, true)).toBe("🔔 2 novos")
    expect(textoDaAba("Fila de pedidos", 1, true)).toBe("🔔 1 novo")
    expect(textoDaAba("Fila de pedidos", 2, false)).toBe("Fila de pedidos")
    expect(textoDaAba("Fila de pedidos", 0, true)).toBe("Fila de pedidos")
  })
})
