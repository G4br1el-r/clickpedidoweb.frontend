import { describe, expect, test } from "vitest"
import {
  MOTIVOS_CANCELAMENTO,
  rotuloCanal,
  rotuloMotivo,
  rotuloOrigem,
  rotuloPagamento,
} from "./rotulos"

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

  test("motivos do cancelamento, na ordem da lista; sem motivo, Não informado", () => {
    expect(MOTIVOS_CANCELAMENTO.map(rotuloMotivo)).toEqual([
      "Cliente desistiu",
      "Sem estoque",
      "Fora da área de entrega",
      "Pagamento não aprovado",
      "Demora",
      "Loja fechou",
      "Outro",
    ])
    expect(rotuloMotivo(undefined)).toBe("Não informado")
  })

  test("origens dos pedidos", () => {
    expect(rotuloOrigem("site")).toBe("Site")
    expect(rotuloOrigem("pdv")).toBe("PDV do balcão")
    expect(rotuloOrigem("garcom")).toBe("Garçom")
    expect(rotuloOrigem("painel")).toBe("Painel da loja")
  })
})
