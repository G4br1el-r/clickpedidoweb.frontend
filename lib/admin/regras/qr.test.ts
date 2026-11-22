import { describe, expect, test } from "vitest"
import type { ItemPedido } from "../dados/tipos"
import { pedidoDeTeste } from "./pedidos-de-teste"
import { contaQr, urlDaMesa } from "./qr"

const item = (id: string, total: number, extra: Partial<ItemPedido> = {}): ItemPedido => ({
  id,
  produtoId: `prod-${id}`,
  nome: id,
  quantidade: 1,
  precoUnitario: total,
  opcoes: [],
  total,
  ...extra,
})

test("urlDaMesa leva a loja e o id da mesa para a vitrine em modo mesa", () => {
  expect(urlDaMesa("https://loja.app", "pizzaria", "mesa-7")).toBe(
    "https://loja.app/mesa?loja=pizzaria&mesa=mesa-7",
  )
})

describe("contaQr", () => {
  test("a conta como o cliente vê: itens, cortesia, desconto, taxa, couvert, pago e saldo", () => {
    const comanda = pedidoDeTeste(42, new Date(2026, 10, 13, 20, 0), 0, {
      tipo: "mesa",
      mesa: { id: "mesa-7", numero: 7, pessoas: 2, garcom: "Paula" },
      itens: [
        item("Pizza Calabresa", 60, {
          quantidade: 1,
          opcoes: ["Borda: Catupiry"],
          custoUnitario: 21,
          observacao: "bem passada",
        }),
        item("Coca-Cola", 12, { quantidade: 2, precoUnitario: 6 }),
        item("Pudim", 10, { cortesia: { motivo: "Aniversário" } }),
      ],
      descontoConta: { modo: "reais", valor: 2, motivo: "Cliente antigo" },
      taxaServico: { percentual: 10 },
      couvert: { porPessoa: 5 },
      pagamentos: [{ id: "p1", forma: "pix", valor: 30, em: "2026-11-13T23:10:00.000Z" }],
      eventos: [{ tipo: "rodada", em: "2026-11-13T23:00:00.000Z", texto: "Rodada 1" }],
    })

    expect(contaQr(comanda)).toEqual({
      itens: [
        { nome: "Pizza Calabresa", quantidade: 1, opcoes: ["Borda: Catupiry"], total: 60 },
        { nome: "Coca-Cola", quantidade: 2, opcoes: [], total: 12 },
        { nome: "Pudim", quantidade: 1, opcoes: [], total: 10, cortesia: true },
      ],
      subtotal: 82,
      cortesias: 10,
      descontos: 2,
      taxa: 7,
      couvert: 10,
      total: 87,
      pago: 30,
      saldo: 57,
    })
  })

  test("a comanda sem taxa, couvert nem pagamento", () => {
    const comanda = pedidoDeTeste(43, new Date(2026, 10, 13, 20, 0), 0, {
      tipo: "mesa",
      mesa: { id: "mesa-1", numero: 1, pessoas: 1 },
      itens: [item("Água", 5)],
    })

    expect(contaQr(comanda)).toEqual({
      itens: [{ nome: "Água", quantidade: 1, opcoes: [], total: 5 }],
      subtotal: 5,
      cortesias: 0,
      descontos: 0,
      taxa: 0,
      couvert: 0,
      total: 5,
      pago: 0,
      saldo: 5,
    })
  })
})
