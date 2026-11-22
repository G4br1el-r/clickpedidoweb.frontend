import { describe, expect, test } from "vitest"
import { contarPor, filtrarPedidos, totaisDaLista } from "./filtro-pedidos"
import { PEDIDOS_DE_TESTE } from "./pedidos-de-teste"

const JOAO = {
  ...PEDIDOS_DE_TESTE[2],
  id: 42,
  numero: 42,
  cliente: { nome: "João Vitória", telefone: "12988887777" },
}
const PEDIDOS = [...PEDIDOS_DE_TESTE, JOAO]
const ids = (lista: { id: number }[]) => lista.map((pedido) => pedido.id).sort((a, b) => a - b)

describe("filtrarPedidos", () => {
  test("sem filtro, vêm todos", () => {
    expect(filtrarPedidos(PEDIDOS, {})).toHaveLength(9)
  })

  test("busca pelo nome do cliente sem precisar do acento", () => {
    expect(ids(filtrarPedidos(PEDIDOS, { busca: "joao vito" }))).toEqual([42])
  })

  test("busca pelo número, com ou sem #", () => {
    expect(ids(filtrarPedidos(PEDIDOS, { busca: "#42" }))).toEqual([42])
    expect(ids(filtrarPedidos(PEDIDOS, { busca: "42" }))).toEqual([42])
  })

  test("busca pelo telefone, só com os dígitos", () => {
    expect(ids(filtrarPedidos(PEDIDOS, { busca: "(12) 98888-7777" }))).toEqual([42])
    expect(ids(filtrarPedidos(PEDIDOS, { busca: "8888" }))).toEqual([42])
  })

  test("busca pelo item do pedido", () => {
    expect(ids(filtrarPedidos(PEDIDOS, { busca: "guarana" }))).toEqual([5])
  })

  test("combina status, canal e forma de pagamento", () => {
    expect(ids(filtrarPedidos(PEDIDOS, { status: ["concluido"], tipos: ["retirada"] }))).toEqual([
      2, 7, 8,
    ])
    expect(ids(filtrarPedidos(PEDIDOS, { status: ["concluido"], pagamentos: ["pix"] }))).toEqual([
      1, 7, 42,
    ])
    expect(ids(filtrarPedidos(PEDIDOS, { busca: "calabresa", status: ["cancelado"] }))).toEqual([3])
  })

  test("a conta paga em Pix e dinheiro (Misto) aparece no filtro de cada uma das formas", () => {
    const misto = {
      ...PEDIDOS_DE_TESTE[5],
      id: 60,
      pagamento: "dinheiro" as const,
      pagamentos: [
        { id: "p1", forma: "pix" as const, valor: 30, em: "" },
        { id: "p2", forma: "dinheiro" as const, valor: 40, em: "" },
      ],
    }
    expect(ids(filtrarPedidos([misto], { pagamentos: ["pix"] }))).toEqual([60])
    expect(ids(filtrarPedidos([misto], { pagamentos: ["dinheiro"] }))).toEqual([60])
    expect(ids(filtrarPedidos([misto], { pagamentos: ["cartao-na-entrega"] }))).toEqual([])
    expect(contarPor([misto], "pagamento")).toEqual(
      new Map([
        ["pix", 1],
        ["dinheiro", 1],
      ]),
    )
  })

  test("filtra pela origem do pedido", () => {
    const doPdv = { ...PEDIDOS_DE_TESTE[0], id: 50, origem: "pdv" as const }
    expect(ids(filtrarPedidos([...PEDIDOS, doPdv], { origens: ["pdv"] }))).toEqual([50])
  })
})

describe("totaisDaLista", () => {
  test("conta todos e soma só as vendas válidas", () => {
    expect(totaisDaLista(PEDIDOS)).toEqual({ pedidos: 9, validos: 7, faturamento: 380 })
  })
})

describe("contarPor", () => {
  test("quantos pedidos há em cada valor, para os filtros", () => {
    expect(contarPor(PEDIDOS, "tipo")).toEqual(
      new Map([
        ["retirada", 3],
        ["entrega", 5],
        ["mesa", 1],
      ]),
    )
  })
})
