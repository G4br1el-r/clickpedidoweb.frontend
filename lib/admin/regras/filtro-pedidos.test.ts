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

  test("busca pelo bairro da entrega, sem precisar do acento", () => {
    const noCentro = {
      ...JOAO,
      id: 43,
      numero: 43,
      endereco: {
        cep: "12630-000",
        logradouro: "Rua A",
        numero: "1",
        bairro: "Jardim Esplanada",
        cidade: "Lorena",
      },
    }
    expect(ids(filtrarPedidos([...PEDIDOS, noCentro], { busca: "esplanada" }))).toEqual([43])
  })

  test("não pagos: a cobrar na entrega ou aguardando pagamento", () => {
    const aCobrar = { ...JOAO, id: 50, situacaoPagamento: "na-entrega" as const }
    const aguardando = { ...JOAO, id: 51, situacaoPagamento: "pendente" as const }
    const estorno = { ...JOAO, id: 52, situacaoPagamento: "estorno-pendente" as const }
    const lista = [...PEDIDOS, aCobrar, aguardando, estorno]
    expect(ids(filtrarPedidos(lista, { naoPagos: true })).filter((id) => id >= 50)).toEqual([
      50, 51,
    ])
    expect(
      filtrarPedidos(lista, { naoPagos: true }).every((pedido) =>
        ["na-entrega", "pendente"].includes(pedido.situacaoPagamento),
      ),
    ).toBe(true)
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
