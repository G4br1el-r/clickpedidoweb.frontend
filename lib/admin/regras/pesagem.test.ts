import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido } from "../dados/tipos"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"
import { calcularPesagem, faltaPesar, itensParaPesar, mensagemLinkPagamento } from "./pesagem"

/** Picanha a R$ 80/kg: 2 peças de 500 g pedidas, com R$ 5 de tempero cada. */
const PICANHA: ItemPedido = {
  id: "i1",
  produtoId: "picanha",
  nome: "Picanha",
  quantidade: 2,
  precoUnitario: 45,
  opcoes: ["Tempero: Alho"],
  total: 90,
  pesoGramas: 500,
  precoKg: 80,
}
const CARVAO: ItemPedido = {
  id: "i2",
  produtoId: "carvao",
  nome: "Carvão",
  quantidade: 1,
  precoUnitario: 20,
  opcoes: [],
  total: 20,
}

const PEDIDO: Pedido = {
  ...PEDIDOS_DE_TESTE[2],
  numero: 31,
  token: "tok-abc",
  cliente: { nome: "Ana Souza", telefone: "12991230001" },
  itens: [PICANHA, CARVAO],
  subtotal: 110,
  desconto: 0,
  taxaEntrega: 8,
  total: 118,
  situacaoPagamento: "pendente",
  pagamento: "pagar-apos-pesagem",
}

describe("itensParaPesar", () => {
  test("só os itens vendidos por quilo", () => {
    expect(itensParaPesar(PEDIDO).map((item) => item.nome)).toEqual(["Picanha"])
  })
})

describe("faltaPesar", () => {
  test("pagar após a pesagem e ainda sem pesagem: falta pesar", () => {
    expect(faltaPesar(PEDIDO)).toBe(true)
  })

  test("já pesado, outra forma de pagamento ou sem item por quilo: não falta", () => {
    const pesagem = { totalEstimado: 118, diferenca: 8, pesadoEm: "x" }
    expect(faltaPesar({ ...PEDIDO, pesagem })).toBe(false)
    expect(faltaPesar({ ...PEDIDO, pagamento: "pix" })).toBe(false)
    expect(faltaPesar({ ...PEDIDO, itens: [CARVAO] })).toBe(false)
  })
})

describe("calcularPesagem", () => {
  test("a diferença vem só do peso; o tempero e o resto do pedido não mudam", () => {
    // 1.100 g em vez de 1.000 g: 100 g a mais, R$ 8,00 a mais.
    const pesagem = calcularPesagem(PEDIDO, { i1: 1100 })
    expect(pesagem.itens[0]).toMatchObject({ pesoReal: 1100, total: 98, precoUnitario: 49 })
    expect(pesagem.itens[1]).toEqual(CARVAO)
    expect(pesagem).toMatchObject({ totalEstimado: 118, novoTotal: 126, diferenca: 8 })
  })

  test("pesar de novo parte da estimativa original", () => {
    const primeira = calcularPesagem(PEDIDO, { i1: 1100 })
    const pesado: Pedido = {
      ...PEDIDO,
      itens: primeira.itens,
      total: primeira.novoTotal,
      pesagem: { totalEstimado: 118, diferenca: 8, pesadoEm: "x" },
    }
    const segunda = calcularPesagem(pesado, { i1: 950 })
    expect(segunda.itens[0]).toMatchObject({ pesoReal: 950, total: 86 })
    expect(segunda).toMatchObject({ totalEstimado: 118, novoTotal: 114, diferenca: -4 })
  })

  test("recusa pedido pago e peso fora do razoável", () => {
    expect(() => calcularPesagem({ ...PEDIDO, situacaoPagamento: "pago" }, { i1: 1000 })).toThrow(
      "Pedido já pago: a pesagem não muda o valor.",
    )
    expect(() => calcularPesagem(PEDIDO, { i1: 0 })).toThrow("Informe o peso de Picanha.")
    expect(() => calcularPesagem(PEDIDO, {})).toThrow("Informe o peso de Picanha.")
  })
})

describe("mensagemLinkPagamento", () => {
  test("valor final e o link com o token, não com o número", () => {
    expect(
      mensagemLinkPagamento(
        { ...PEDIDO, total: 126 },
        { loja: "Açougue Sabor da Carne", endereco: "https://loja.exemplo" },
      ),
    ).toBe(
      "Olá, Ana! Seu pedido #31 na Açougue Sabor da Carne foi pesado: R$ 126,00.\n" +
        "Pague por aqui: https://loja.exemplo/checkout/tok-abc",
    )
  })
})
