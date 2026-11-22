import { describe, expect, test } from "vitest"
import {
  MOTIVOS_CANCELAMENTO,
  rotuloCanal,
  rotuloMotivo,
  rotuloOrigem,
  rotuloPagamento,
  rotuloTaxa,
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
      "Cliente pediu para cancelar",
      "Sem estoque",
      "Fora da área de entrega",
      "Loja cheia",
      "Endereço inválido",
      "Cliente não veio",
      "Receita inválida",
      "Suspeita de fraude",
      "Pagamento não aprovado",
      "Demora",
      "Loja fechou",
      "Outro",
    ])
    expect(rotuloMotivo(undefined)).toBe("Não informado")
  })

  test("formas que têm taxa de pagamento", () => {
    expect(rotuloTaxa("pixOnline")).toBe("Pix online")
    expect(rotuloTaxa("cartaoOnline")).toBe("Cartão online")
    expect(rotuloTaxa("maquininha")).toBe("Cartão na maquininha")
  })

  test("origens dos pedidos", () => {
    expect(rotuloOrigem("site")).toBe("Site")
    expect(rotuloOrigem("pdv")).toBe("PDV do balcão")
    expect(rotuloOrigem("garcom")).toBe("Garçom")
    expect(rotuloOrigem("painel")).toBe("Painel da loja")
  })
})
