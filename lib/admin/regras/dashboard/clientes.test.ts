import { describe, expect, test } from "vitest"
import type { Pedido } from "../../dados/tipos"
import { AGORA_DE_TESTE, pedidoDeTeste } from "../pedidos-de-teste"
import {
  clientesDos90Dias,
  mensagemDeVolta,
  reguaDeClientes,
  sumidos,
  telefoneDoCliente,
} from "./clientes"

/** Sexta, 13/11/2026, 20:30. */
const AGORA = AGORA_DE_TESTE
const LOJA = "1239998888"

const pedido = (
  id: number,
  dia: Date,
  total: number,
  nome: string,
  telefone: string,
  mudancas: Partial<Pedido> = {},
) => pedidoDeTeste(id, dia, total, { cliente: { nome, telefone }, ...mudancas })

describe("telefoneDoCliente", () => {
  test("só os dígitos, com DDD e sem o 55 do país; sem DDD não é cliente", () => {
    expect(telefoneDoCliente("(12) 99123-4567")).toBe("12991234567")
    expect(telefoneDoCliente("+55 12 99123-4567")).toBe("12991234567")
    expect(telefoneDoCliente("1233334444")).toBe("1233334444")
    expect(telefoneDoCliente("99123-4567")).toBeNull()
    expect(telefoneDoCliente("")).toBeNull()
  })
})

describe("clientesDos90Dias", () => {
  test("junta os pedidos válidos dos últimos 90 dias pelo telefone, com o nome mais recente", () => {
    const pedidos = [
      pedido(1, new Date(2026, 8, 1, 20), 50, "Ana", "(12) 99123-4567"),
      pedido(2, new Date(2026, 10, 10, 20), 30, "Ana Souza", "12991234567"),
      pedido(3, new Date(2026, 10, 12, 20), 40, "Bia", "12988887777"),
      // Cancelado, fora dos 90 dias, a própria loja (PDV e mesa) e sem DDD não contam.
      pedido(4, new Date(2026, 10, 12, 21), 99, "Bia", "12988887777", { status: "cancelado" }),
      pedido(5, new Date(2026, 7, 1, 20), 99, "Ana", "12991234567"),
      pedido(6, new Date(2026, 10, 13, 19), 99, "Venda no balcão", LOJA),
      pedido(7, new Date(2026, 10, 13, 19), 99, "Caio", "98887777"),
    ]
    expect(clientesDos90Dias(pedidos, AGORA, LOJA)).toEqual([
      {
        telefone: "12991234567",
        nome: "Ana Souza",
        pedidos: 2,
        gasto: 80,
        primeiro: new Date(2026, 8, 1, 20).toISOString(),
        ultimo: new Date(2026, 10, 10, 20).toISOString(),
      },
      {
        telefone: "12988887777",
        nome: "Bia",
        pedidos: 1,
        gasto: 40,
        primeiro: new Date(2026, 10, 12, 20).toISOString(),
        ultimo: new Date(2026, 10, 12, 20).toISOString(),
      },
    ])
  })
})

const cliente = (telefone: string, pedidos: number, primeiro: Date, ultimo: Date, gasto = 10) => ({
  telefone,
  nome: `Cliente ${telefone}`,
  pedidos,
  gasto,
  primeiro: primeiro.toISOString(),
  ultimo: ultimo.toISOString(),
})

describe("reguaDeClientes", () => {
  test("únicos, novos nos últimos 30 dias, % que voltou e pedidos por cliente", () => {
    const clientes = [
      cliente("1", 3, new Date(2026, 8, 1), new Date(2026, 10, 10)),
      cliente("2", 2, new Date(2026, 9, 20), new Date(2026, 10, 1)),
      // 30 dias: de 15/10 em diante.
      cliente("3", 1, new Date(2026, 9, 15, 10), new Date(2026, 9, 15, 10)),
      cliente("4", 2, new Date(2026, 9, 14, 23), new Date(2026, 10, 2)),
    ]
    expect(reguaDeClientes(clientes, AGORA)).toEqual({
      unicos: 4,
      novos: 2,
      recorrentes: 75,
      pedidosPorCliente: 2,
    })
    expect(reguaDeClientes([], AGORA)).toEqual({
      unicos: 0,
      novos: 0,
      recorrentes: 0,
      pedidosPorCliente: 0,
    })
  })
})

describe("sumidos", () => {
  test("compraram 2 vezes ou mais e não voltam há 30 dias, com os dias desde o último, de quem mais gastou", () => {
    const clientes = [
      cliente("1", 3, new Date(2026, 7, 20), new Date(2026, 9, 1, 20), 90),
      cliente("2", 2, new Date(2026, 7, 20), new Date(2026, 8, 10, 20), 150),
      // Voltou há menos de 30 dias; comprou uma vez só.
      cliente("3", 4, new Date(2026, 7, 20), new Date(2026, 9, 20, 20), 300),
      cliente("4", 1, new Date(2026, 7, 20), new Date(2026, 7, 20, 20), 500),
    ]
    expect(sumidos(clientes, AGORA).map((item) => [item.telefone, item.dias])).toEqual([
      ["2", 64],
      ["1", 43],
    ])
  })
})

describe("mensagemDeVolta", () => {
  test("chama pelo primeiro nome e leva para a vitrine; no salão, quem agenda", () => {
    expect(
      mensagemDeVolta({
        nome: "Ana Souza",
        loja: "Casa da Pizza",
        link: "https://loja.exemplo/",
        segmento: "pizzaria",
      }),
    ).toBe(
      "Oi, Ana! Faz um tempinho que você não pede na Casa da Pizza. Bateu saudade? Dá uma olhada no que tem hoje: https://loja.exemplo/",
    )
    expect(
      mensagemDeVolta({ nome: "Bia", loja: "Empório", link: "https://x/", segmento: "salao" }),
    ).toBe(
      "Oi, Bia! Faz um tempinho que você não agenda na Empório. Bateu saudade? Dá uma olhada no que tem hoje: https://x/",
    )
  })
})
