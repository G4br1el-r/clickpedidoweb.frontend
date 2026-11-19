import { describe, expect, test } from "vitest"
import { textoDaNotificacao } from "./aparelho"
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
