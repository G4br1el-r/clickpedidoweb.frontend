import { describe, expect, test } from "vitest"
import { rotuloCanal, rotuloOrigem, rotuloPagamento } from "./rotulos"

describe("rótulos", () => {
  test("canais de venda", () => {
    expect(rotuloCanal("entrega")).toBe("Entrega")
    expect(rotuloCanal("retirada")).toBe("Retirada no balcão")
    expect(rotuloCanal("mesa")).toBe("Mesa no salão")
    expect(rotuloCanal("atendimento")).toBe("Atendimento no salão")
  })

  test("formas de pagamento", () => {
    expect(rotuloPagamento("pix")).toBe("Pix")
    expect(rotuloPagamento("cartao-online")).toBe("Cartão online")
    expect(rotuloPagamento("dinheiro")).toBe("Dinheiro")
    expect(rotuloPagamento("cartao-na-entrega")).toBe("Cartão na maquininha")
    expect(rotuloPagamento("pagar-apos-pesagem")).toBe("Após a pesagem")
  })
})

describe("rotuloOrigem", () => {
  test("de onde o pedido veio, como o selo do cartão mostra", () => {
    expect(rotuloOrigem("site")).toBe("Site")
    expect(rotuloOrigem("pdv")).toBe("PDV")
    expect(rotuloOrigem("garcom")).toBe("Garçom")
    expect(rotuloOrigem("painel")).toBe("Painel")
  })
})
