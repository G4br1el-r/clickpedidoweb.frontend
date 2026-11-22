import { describe, expect, test } from "vitest"
import { pedidoDeTeste } from "./pedidos-de-teste"
import {
  MOTIVOS_CANCELAMENTO,
  rotuloCanal,
  rotuloDoPagamento,
  rotuloMotivo,
  rotuloOrigem,
  rotuloPagamento,
  rotuloPagamentoDoPedido,
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

  test("um pagamento da conta: o cartão diz se é crédito ou débito", () => {
    expect(rotuloDoPagamento({ forma: "pix" })).toBe("Pix")
    expect(rotuloDoPagamento({ forma: "dinheiro" })).toBe("Dinheiro")
    expect(rotuloDoPagamento({ forma: "cartao-na-entrega", cartao: "credito" })).toBe(
      "Cartão de crédito",
    )
    expect(rotuloDoPagamento({ forma: "cartao-na-entrega", cartao: "debito" })).toBe(
      "Cartão de débito",
    )
    expect(rotuloDoPagamento({ forma: "cartao-na-entrega" })).toBe("Cartão na maquininha")
  })

  test("a forma do pedido: Misto quando a conta foi paga em mais de uma forma", () => {
    const pedido = pedidoDeTeste(1, new Date(2026, 10, 13, 20), 100, { pagamento: "dinheiro" })
    const pagamento = (forma: "pix" | "dinheiro", valor: number) => ({
      id: forma + valor,
      forma,
      valor,
      em: "",
    })
    expect(
      rotuloPagamentoDoPedido({
        ...pedido,
        pagamentos: [pagamento("pix", 40), pagamento("dinheiro", 60)],
      }),
    ).toBe("Misto")
    expect(
      rotuloPagamentoDoPedido({
        ...pedido,
        pagamento: "pix",
        pagamentos: [pagamento("pix", 40), pagamento("pix", 60)],
      }),
    ).toBe("Pix")
    expect(rotuloPagamentoDoPedido(pedido)).toBe("Dinheiro")
    // A comanda aberta (forma "dinheiro" até fechar) que pagou uma parte em Pix diz Pix.
    expect(rotuloPagamentoDoPedido({ ...pedido, pagamentos: [pagamento("pix", 40)] })).toBe("Pix")
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
