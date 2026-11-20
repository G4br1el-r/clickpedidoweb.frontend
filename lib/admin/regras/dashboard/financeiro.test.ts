import { describe, expect, test } from "vitest"
import { PEDIDOS_DE_TESTE, PERIODO_DE_TESTE as PERIODO, pedidoDeTeste } from "../pedidos-de-teste"
import {
  aReceber,
  descontosDoPdv,
  formasDePagamento,
  reguaFinanceira,
  taxasEstimadas,
} from "./financeiro"

const NO_PERIODO = new Date(2026, 10, 13, 19)

describe("reguaFinanceira", () => {
  test("bruto (subtotal), descontos, taxas de entrega e líquido das vendas válidas", () => {
    const pedidos = [
      pedidoDeTeste(1, NO_PERIODO, 95, { subtotal: 100, desconto: 10, taxaEntrega: 5 }),
      pedidoDeTeste(2, NO_PERIODO, 50, { subtotal: 50 }),
      pedidoDeTeste(3, NO_PERIODO, 80, { subtotal: 80, status: "cancelado" }),
      pedidoDeTeste(4, new Date(2026, 10, 1, 20), 70, { subtotal: 70 }),
    ]
    expect(reguaFinanceira(pedidos, PERIODO)).toEqual({
      bruto: 150,
      descontos: 10,
      taxasEntrega: 5,
      liquido: 145,
    })
  })
})

describe("aReceber", () => {
  test("pagamento na entrega ainda aberto e pagamentos pendentes do período; cancelado não conta", () => {
    const pedidos = [
      pedidoDeTeste(1, NO_PERIODO, 40, {
        status: "saiu-para-entrega",
        situacaoPagamento: "na-entrega",
      }),
      pedidoDeTeste(2, NO_PERIODO, 25, { status: "pronto", situacaoPagamento: "na-entrega" }),
      // O Pix que ainda não caiu e o açougue que paga depois de pesar.
      pedidoDeTeste(3, NO_PERIODO, 60, {
        status: "aguardando-pagamento",
        situacaoPagamento: "pendente",
      }),
      pedidoDeTeste(4, NO_PERIODO, 90, { status: "em-preparo", situacaoPagamento: "pendente" }),
      pedidoDeTeste(5, NO_PERIODO, 70, { status: "cancelado", situacaoPagamento: "pendente" }),
      pedidoDeTeste(6, NO_PERIODO, 30),
    ]
    expect(aReceber(pedidos, PERIODO)).toEqual({
      naEntrega: { pedidos: 2, total: 65 },
      pendentes: { pedidos: 2, total: 150 },
    })
  })
})

describe("descontosDoPdv", () => {
  test("quantas vendas do balcão tiveram desconto e quanto somam", () => {
    const pedidos = [
      pedidoDeTeste(1, NO_PERIODO, 45, { origem: "pdv", subtotal: 50, desconto: 5 }),
      pedidoDeTeste(2, NO_PERIODO, 18, { origem: "pdv", subtotal: 20, desconto: 2 }),
      pedidoDeTeste(3, NO_PERIODO, 30, { origem: "pdv", subtotal: 30 }),
      // Desconto do site e venda cancelada ficam de fora.
      pedidoDeTeste(4, NO_PERIODO, 90, { origem: "site", subtotal: 100, desconto: 10 }),
      pedidoDeTeste(5, NO_PERIODO, 9, {
        origem: "pdv",
        subtotal: 10,
        desconto: 1,
        status: "cancelado",
      }),
    ]
    expect(descontosDoPdv(pedidos, PERIODO)).toEqual({ pedidos: 2, total: 7 })
  })
})

describe("taxasEstimadas", () => {
  const pedidos = [
    pedidoDeTeste(1, NO_PERIODO, 100, { pagamento: "pix", origem: "site" }),
    // Pix no balcão vai direto para a conta: sem taxa.
    pedidoDeTeste(2, NO_PERIODO, 50, { pagamento: "pix", origem: "pdv" }),
    pedidoDeTeste(3, NO_PERIODO, 200, { pagamento: "cartao-online" }),
    pedidoDeTeste(4, NO_PERIODO, 80, { pagamento: "cartao-na-entrega" }),
    pedidoDeTeste(5, NO_PERIODO, 30, { pagamento: "dinheiro" }),
    pedidoDeTeste(6, NO_PERIODO, 100, { pagamento: "cartao-online", status: "cancelado" }),
  ]

  test("cada forma com taxa leva a % do que vendeu; o líquido desconta o total das taxas", () => {
    const estimadas = taxasEstimadas(pedidos, PERIODO, { pixOnline: 1, cartaoOnline: 5 })
    expect(estimadas.formas).toEqual([
      { forma: "pixOnline", pedidos: 1, vendido: 100, taxa: 1, valor: 1 },
      { forma: "cartaoOnline", pedidos: 1, vendido: 200, taxa: 5, valor: 10 },
      { forma: "maquininha", pedidos: 1, vendido: 80, taxa: undefined, valor: 0 },
    ])
    // Líquido: 100 + 50 + 200 + 80 + 30 = R$ 460; menos R$ 11 de taxas.
    expect(estimadas.total).toBe(11)
    expect(estimadas.liquidoDepois).toBe(449)
  })

  test("forma usada sem taxa informada conta como 0% e vai para o aviso", () => {
    expect(taxasEstimadas(pedidos, PERIODO, { pixOnline: 1, cartaoOnline: 5 }).semTaxa).toEqual([
      "maquininha",
    ])
    expect(taxasEstimadas(pedidos, PERIODO, undefined).semTaxa).toEqual([
      "pixOnline",
      "cartaoOnline",
      "maquininha",
    ])
  })
})

describe("formasDePagamento", () => {
  test("cada forma com os pedidos válidos, o total e a parte, da que mais vendeu à que menos vendeu", () => {
    // Do total de R$ 170: dinheiro R$ 100, Pix R$ 50 e maquininha R$ 20.
    expect(
      formasDePagamento(PEDIDOS_DE_TESTE, PERIODO).map((fatia) => [
        fatia.forma,
        fatia.pedidos,
        fatia.total,
        Math.round(fatia.percentual * 100) / 100,
      ]),
    ).toEqual([
      ["dinheiro", 2, 100, 58.82],
      ["pix", 1, 50, 29.41],
      ["cartao-na-entrega", 1, 20, 11.76],
    ])
  })
})
