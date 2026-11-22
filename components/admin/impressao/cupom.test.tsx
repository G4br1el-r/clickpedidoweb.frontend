import { render } from "@testing-library/react"
import { createRef } from "react"
import { describe, expect, test } from "vitest"
import { pedidoDeTeste as pedidoDeExemplo } from "@/lib/admin/regras/pedidos-de-teste"
import { Cupom, pedidoDeTeste } from "./cupom"

const agora = new Date(2026, 10, 13, 20, 30)
const texto = () => document.body.textContent?.replace(/\u00a0/g, " ") ?? ""

const item = (id: string, nome: string, total: number, extra = {}) => ({
  id,
  produtoId: null,
  nome,
  quantidade: 1,
  precoUnitario: total,
  opcoes: [],
  total,
  ...extra,
})

describe("Cupom", () => {
  test("o pedido de entrega tem subtotal, entrega, total e o troco", () => {
    render(<Cupom pedido={pedidoDeTeste(agora)} loja="Loja Teste" area={createRef()} />)
    for (const trecho of [
      "SubtotalR$ 20,00",
      "EntregaR$ 5,00",
      "TOTALR$ 25,00",
      "Dinheiro · COBRAR R$ 25,00 · troco para R$ 50,00 (R$ 25,00)",
    ]) {
      expect(texto()).toContain(trecho)
    }
  })

  test("a conta de mesa tem cortesia, desconto, taxa, couvert, Misto e cada pagamento", () => {
    // Pizza R$ 40 e Água R$ 4 (cortesia), desconto R$ 4, 10% e couvert de R$ 8 para 2:
    // 40 − 4 = 36, + 3,60 + 16 = R$ 55,60. Pago R$ 20 em Pix e R$ 35,60 em dinheiro (de 40).
    const conta = pedidoDeExemplo(9, agora, 55.6, {
      tipo: "mesa",
      mesa: { id: "mesa-70", numero: 70, pessoas: 2 },
      itens: [item("i1", "Pizza", 40), item("i2", "Água", 4, { cortesia: { motivo: "Brinde" } })],
      subtotal: 44,
      desconto: 4,
      descontoConta: { modo: "reais", valor: 4, motivo: "Demora" },
      taxaServico: { percentual: 10 },
      couvert: { porPessoa: 8 },
      pagamento: "dinheiro",
      pagoEm: agora.toISOString(),
      pagamentos: [
        { id: "p1", forma: "pix", valor: 20, em: agora.toISOString() },
        {
          id: "p2",
          forma: "dinheiro",
          valor: 35.6,
          recebido: 40,
          troco: 4.4,
          em: agora.toISOString(),
        },
      ],
    })
    render(<Cupom pedido={conta} loja="Pizzaria Teste" area={createRef()} />)
    for (const trecho of [
      "1x Água (cortesia)R$ 4,00",
      "SubtotalR$ 44,00",
      "Cortesias- R$ 4,00",
      "Desconto- R$ 4,00",
      "Taxa de serviço (10%)R$ 3,60",
      "Couvert (2 × R$ 8,00)R$ 16,00",
      "TOTALR$ 55,60",
      "Misto · PAGO",
      "Pix R$ 20,00",
      "Dinheiro R$ 35,60 · troco R$ 4,40",
    ]) {
      expect(texto()).toContain(trecho)
    }
  })

  test("a conta aberta paga em parte cobra o saldo", () => {
    const aberta = pedidoDeExemplo(10, agora, 100, {
      tipo: "mesa",
      status: "pronto",
      situacaoPagamento: "na-entrega",
      mesa: { id: "mesa-70", numero: 70, pessoas: 1 },
      itens: [item("i1", "Rodízio", 100)],
      pagamento: "dinheiro",
      pagamentos: [{ id: "p1", forma: "pix", valor: 30, em: agora.toISOString() }],
    })
    render(<Cupom pedido={aberta} loja="Pizzaria Teste" area={createRef()} />)
    expect(texto()).toContain("Pix · COBRAR R$ 70,00")
    expect(texto()).toContain("Pix R$ 30,00")
  })
})
