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

  test("filtra pela origem do pedido", () => {
    const doPdv = { ...PEDIDOS_DE_TESTE[0], id: 50, origem: "pdv" as const }
    expect(ids(filtrarPedidos([...PEDIDOS, doPdv], { origens: ["pdv"] }))).toEqual([50])
  })

  test("filtra pelo cliente: o telefone, com ou sem máscara e o 55", () => {
    const daAna = {
      ...PEDIDOS_DE_TESTE[0],
      id: 60,
      cliente: { nome: "Ana", telefone: "+55 (12) 99123-4567" },
    }
    expect(ids(filtrarPedidos([...PEDIDOS, daAna], { clientes: ["12991234567"] }))).toEqual([60])
  })

  test("filtra pelo motivo do cancelamento; sem motivo, é Não informado", () => {
    const comMotivo = {
      ...PEDIDOS_DE_TESTE[0],
      id: 70,
      status: "cancelado" as const,
      motivoCancelamento: "demora" as const,
    }
    expect(ids(filtrarPedidos([...PEDIDOS, comMotivo], { motivos: ["demora"] }))).toEqual([70])
    // O pedido 3 dos pedidos de teste foi cancelado sem motivo.
    expect(ids(filtrarPedidos([...PEDIDOS, comMotivo], { motivos: ["nao-informado"] }))).toEqual([
      3,
    ])
  })

  test("filtra pelo bairro da entrega, sem ligar para acento e maiúsculas", () => {
    const noJardim = {
      ...PEDIDOS_DE_TESTE[0],
      id: 80,
      tipo: "entrega" as const,
      endereco: {
        cep: "12000000",
        logradouro: "Rua A",
        numero: "1",
        bairro: "Jardim São José",
        cidade: "Taubaté",
      },
    }
    expect(ids(filtrarPedidos([...PEDIDOS, noJardim], { bairros: ["jardim sao jose"] }))).toEqual([
      80,
    ])
  })

  test("filtra pelo motoboy; sem-motoboy acha as entregas sem ninguém anotado", () => {
    const doLeo = { ...PEDIDOS_DE_TESTE[0], id: 90, tipo: "entrega" as const, motoboyId: "leo" }
    const lista = [...PEDIDOS, doLeo]
    expect(ids(filtrarPedidos(lista, { motoboys: ["leo"] }))).toEqual([90])
    // As entregas 1, 3, 5 e 6 dos pedidos de teste, e a 42 do João, não têm motoboy.
    expect(ids(filtrarPedidos(lista, { motoboys: ["sem-motoboy"] }))).toEqual([1, 3, 5, 6, 42])
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
