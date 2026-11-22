import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido } from "../dados/tipos"
import {
  comTotais,
  dividirIgualmente,
  erroDoDesconto,
  itensPagos,
  pagamentosDoPedido,
  pagoNoDiaSemTaxa,
  resumoDaConta,
  taxaSobre,
  trocoDoPagamento,
  valorDosItens,
} from "./conta"
import { pedidoDeTeste } from "./pedidos-de-teste"

const item = (id: string, total: number, extra: Partial<ItemPedido> = {}): ItemPedido => ({
  id,
  produtoId: id,
  nome: id,
  quantidade: 1,
  precoUnitario: total,
  opcoes: [],
  total,
  ...extra,
})

type Conta = Parameters<typeof resumoDaConta>[0]

/** R$ 87,45 em itens (uma Coca de R$ 5,00 em cortesia), para 2 pessoas. */
const conta = (mudancas: Partial<Pedido> = {}): Conta => ({
  itens: [item("Pizza", 82.45), item("Coca", 5, { cortesia: { motivo: "Aniversário" } })],
  mesa: { id: "mesa-1", numero: 1, pessoas: 2 },
  ...mudancas,
})

describe("taxaSobre", () => {
  test("10% de R$ 87,45 dá R$ 8,75, e não 8,74 pelo centavo flutuante", () => {
    expect(taxaSobre(87.45, 10)).toBe(8.75)
  })

  test("percentual com casa decimal e centavo que arredonda para cima", () => {
    expect(taxaSobre(100, 12.5)).toBe(12.5)
    expect(taxaSobre(0.05, 10)).toBe(0.01)
    expect(taxaSobre(0.04, 10)).toBe(0)
  })
})

describe("resumoDaConta", () => {
  test("itens, cortesias, desconto, taxa, couvert, total, pago e saldo", () => {
    const resumo = resumoDaConta(
      conta({
        descontoConta: { modo: "reais", valor: 10, motivo: "Cliente antigo" },
        taxaServico: { percentual: 10 },
        couvert: { porPessoa: 8 },
        pagamentos: [{ id: "p1", forma: "pix", valor: 30, em: "2026-11-13T23:00:00.000Z" }],
      }),
    )
    expect(resumo).toEqual({
      itens: 87.45,
      cortesias: 5,
      descontos: 10,
      baseDaTaxa: 72.45,
      taxa: 7.25,
      couvert: 16,
      total: 95.7,
      pago: 30,
      saldo: 65.7,
    })
  })

  test("taxa e couvert tirados não somam; a comanda antiga não tem taxa, couvert nem pagamento", () => {
    const tirados = resumoDaConta(
      conta({
        taxaServico: { percentual: 10, removida: { motivo: "Cliente pediu" } },
        couvert: { porPessoa: 8, removido: { motivo: "Sem música hoje" } },
      }),
    )
    expect(tirados).toMatchObject({ taxa: 0, couvert: 0, total: 82.45 })
    expect(resumoDaConta({ itens: [item("Pizza", 40)] })).toEqual({
      itens: 40,
      cortesias: 0,
      descontos: 0,
      baseDaTaxa: 40,
      taxa: 0,
      couvert: 0,
      total: 40,
      pago: 0,
      saldo: 40,
    })
  })

  test("desconto de 10% sobre R$ 72,45 dá R$ 7,25, meio para cima", () => {
    const resumo = resumoDaConta(
      conta({
        itens: [item("Pizza", 72.45)],
        descontoConta: { modo: "percentual", valor: 10, motivo: "Aniversário" },
      }),
    )
    expect(resumo).toMatchObject({ descontos: 7.25, total: 65.2 })
  })
})

describe("erroDoDesconto", () => {
  const motivo = "Cliente antigo"

  test("aceita até o valor dos itens, em reais ou em %", () => {
    expect(erroDoDesconto({ modo: "reais", valor: 40, motivo }, 40)).toBeNull()
    expect(erroDoDesconto({ modo: "percentual", valor: 100, motivo }, 40)).toBeNull()
  })

  test("recusa passar dos itens, sem motivo, % acima de 100 e valor inválido", () => {
    expect(erroDoDesconto({ modo: "reais", valor: 40.01, motivo }, 40)).toBe(
      "O desconto passa do valor dos itens.",
    )
    expect(erroDoDesconto({ modo: "reais", valor: 5, motivo: "  " }, 40)).toBe(
      "Diga o motivo do desconto.",
    )
    expect(erroDoDesconto({ modo: "percentual", valor: 100.5, motivo }, 40)).toBe(
      "O desconto vai de 0,01% a 100%.",
    )
    for (const valor of [-1, 0, 1.234, Number.NaN]) {
      expect(erroDoDesconto({ modo: "reais", valor, motivo }, 40)).toBe(
        "Informe um desconto válido.",
      )
    }
  })
})

describe("dividirIgualmente", () => {
  test("R$ 100,00 em 3: o centavo que sobra vai para a última parte", () => {
    expect(dividirIgualmente(100, 3)).toEqual([33.33, 33.33, 33.34])
  })

  test("divisão exata e valor menor que as partes", () => {
    expect(dividirIgualmente(10, 4)).toEqual([2.5, 2.5, 2.5, 2.5])
    expect(dividirIgualmente(0.02, 3)).toEqual([0, 0, 0.02])
    expect(dividirIgualmente(95.7, 1)).toEqual([95.7])
  })
})
describe("pagamento por item", () => {
  const comTaxa = conta({
    itens: [
      item("Pizza", 40),
      item("Suco", 9.5),
      item("Coca", 5, { cortesia: { motivo: "Brinde" } }),
    ],
    taxaServico: { percentual: 10 },
  })

  test("valorDosItens soma os itens marcados com a taxa deles, sem a cortesia", () => {
    expect(valorDosItens(comTaxa, ["Pizza"])).toBe(44)
    expect(valorDosItens(comTaxa, ["Pizza", "Suco", "Coca"])).toBe(54.45)
    expect(valorDosItens({ itens: comTaxa.itens }, ["Suco"])).toBe(9.5)
  })

  test("itensPagos junta os itens dos pagamentos por item", () => {
    expect(
      itensPagos({
        pagamentos: [
          { id: "p1", forma: "pix", valor: 44, em: "", itens: ["Pizza"] },
          { id: "p2", forma: "dinheiro", valor: 10, em: "" },
        ],
      }),
    ).toEqual(new Set(["Pizza"]))
    expect(itensPagos({})).toEqual(new Set())
  })
})
describe("pagamentos e faturamento", () => {
  const ontem = new Date(2026, 10, 12, 22, 0)
  const hoje = new Date(2026, 10, 13, 20, 30)

  test("a comanda paga sem `pagamentos` vale como um pagamento único do total no pagoEm", () => {
    const antiga = pedidoDeTeste(1, ontem, 70, {
      tipo: "mesa",
      pagamento: "dinheiro",
      pagoEm: ontem.toISOString(),
    })
    expect(pagamentosDoPedido(antiga)).toEqual([
      { forma: "dinheiro", valor: 70, em: ontem.toISOString() },
    ])
    expect(pagamentosDoPedido({ ...antiga, situacaoPagamento: "na-entrega" })).toEqual([])
  })

  test("pagoNoDiaSemTaxa: só o que entrou no dia, sem a parte da taxa", () => {
    // R$ 100,00 de itens com 10%: total 110, pago metade ontem e metade hoje.
    const comanda = pedidoDeTeste(2, ontem, 110, {
      tipo: "mesa",
      itens: [item("Pizza", 100)],
      taxaServico: { percentual: 10 },
      pagamentos: [
        { id: "p1", forma: "pix", valor: 55, em: ontem.toISOString() },
        { id: "p2", forma: "dinheiro", valor: 55, em: hoje.toISOString() },
      ],
    })
    expect(pagoNoDiaSemTaxa(comanda, hoje)).toBe(50)
    expect(pagoNoDiaSemTaxa(comanda, new Date(2026, 10, 11))).toBe(0)
  })

  test("aberta às 23:40 e paga às 00:10: entra no dia do pagamento", () => {
    const comanda = pedidoDeTeste(3, new Date(2026, 10, 13, 23, 40), 80, {
      tipo: "mesa",
      itens: [item("Pizza", 80)],
      pagamentos: [
        { id: "p1", forma: "pix", valor: 80, em: new Date(2026, 10, 14, 0, 10).toISOString() },
      ],
    })
    expect(pagoNoDiaSemTaxa(comanda, new Date(2026, 10, 13, 23, 59))).toBe(0)
    expect(pagoNoDiaSemTaxa(comanda, new Date(2026, 10, 14, 1, 0))).toBe(80)
  })
})
describe("comTotais", () => {
  test("refaz subtotal (itens), desconto (o da conta) e total (com taxa e couvert)", () => {
    const comanda = pedidoDeTeste(4, new Date(2026, 10, 13, 20), 0, {
      tipo: "mesa",
      ...conta({
        descontoConta: { modo: "reais", valor: 10, motivo: "Cliente antigo" },
        taxaServico: { percentual: 10 },
        couvert: { porPessoa: 8 },
      }),
    })
    expect(comTotais(comanda)).toMatchObject({ subtotal: 87.45, desconto: 10, total: 95.7 })
  })
})

describe("trocoDoPagamento", () => {
  test("o troco é o recebido menos o que abate do saldo (no máximo o saldo)", () => {
    expect(trocoDoPagamento({ valor: 66.67, saldo: 100, recebido: 80 })).toBe(13.33)
    // A parte de R$ 60,00 numa conta com R$ 50,00 de saldo abate só 50.
    expect(trocoDoPagamento({ valor: 60, saldo: 50, recebido: 100 })).toBe(50)
    expect(trocoDoPagamento({ valor: 50, saldo: 50, recebido: 50 })).toBe(0)
    expect(trocoDoPagamento({ valor: 50, saldo: 50, recebido: 40 })).toBe(0)
  })
})
