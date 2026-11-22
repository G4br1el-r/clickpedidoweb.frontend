import { addMinutes } from "date-fns"
import { describe, expect, test } from "vitest"
import type { Pedido, StatusPedido } from "../../dados/tipos"
import { PERIODO_DE_TESTE as PERIODO, pedidoDeTeste } from "../pedidos-de-teste"
import { porBairro, porMotoboy, reguaDeEntregas } from "./entrega"

const CRIADO = new Date(2026, 10, 13, 19)

/** Entrega com o histórico em minutos desde a criação; o status é o da última etapa. */
function entrega(
  id: number,
  total: number,
  etapas: [StatusPedido, number][],
  mudancas: Partial<Pedido> = {},
): Pedido {
  return pedidoDeTeste(id, CRIADO, total, {
    tipo: "entrega",
    status: etapas.at(-1)?.[0] ?? "recebido",
    historico: etapas.map(([status, minutos]) => ({
      tipo: "etapa" as const,
      status,
      em: addMinutes(CRIADO, minutos).toISOString(),
    })),
    ...mudancas,
  })
}

/** Recebido, preparo, pronto, saiu e entregue: `saiu` e `entregou` em minutos. */
const entregue = (id: number, total: number, saiu: number, entregou: number, mudancas = {}) =>
  entrega(
    id,
    total,
    [
      ["recebido", 0],
      ["em-preparo", 2],
      ["pronto", 20],
      ["saiu-para-entrega", saiu],
      ["concluido", entregou],
    ],
    mudancas,
  )

describe("reguaDeEntregas", () => {
  test("entregas do período, taxas cobradas, ticket e o tempo médio na rua", () => {
    const pedidos = [
      entregue(1, 60, 25, 40, { taxaEntrega: 6 }),
      entregue(2, 90, 30, 55, { taxaEntrega: 8 }),
      // A caminho: conta como entrega e na taxa, mas ainda não tem tempo na rua.
      entrega(
        3,
        30,
        [
          ["recebido", 0],
          ["saiu-para-entrega", 22],
        ],
        { taxaEntrega: 5 },
      ),
      // Cancelada e retirada ficam de fora.
      entrega(
        4,
        50,
        [
          ["recebido", 0],
          ["cancelado", 5],
        ],
        { taxaEntrega: 7 },
      ),
      pedidoDeTeste(5, CRIADO, 80),
    ]
    expect(reguaDeEntregas(pedidos, PERIODO)).toEqual({
      entregas: 3,
      taxas: 19,
      ticket: 60,
      naRua: { pedidos: 2, media: 20, noveEmDez: 25 },
    })
  })
})

describe("porMotoboy", () => {
  test("entregas concluídas de cada um, tempo médio na rua e as taxas; sem ninguém fica junto", () => {
    const pedidos = [
      entregue(1, 60, 25, 40, { taxaEntrega: 6, motoboyId: "leo" }),
      entregue(2, 90, 30, 60, { taxaEntrega: 8, motoboyId: "leo" }),
      entregue(3, 40, 22, 32, { taxaEntrega: 5, motoboyId: "bia" }),
      entregue(4, 50, 21, 41, { taxaEntrega: 7 }),
      // Ainda na rua: não entra.
      entrega(
        5,
        30,
        [
          ["recebido", 0],
          ["saiu-para-entrega", 22],
        ],
        { motoboyId: "bia" },
      ),
    ]
    expect(porMotoboy(pedidos, PERIODO)).toEqual([
      { motoboyId: "leo", entregas: 2, minutosNaRua: 23, taxas: 14 },
      { motoboyId: "bia", entregas: 1, minutosNaRua: 10, taxas: 5 },
      { motoboyId: "sem-motoboy", entregas: 1, minutosNaRua: 20, taxas: 7 },
    ])
  })
})

describe("porBairro", () => {
  const no = (bairro: string) => ({
    endereco: { cep: "12000000", logradouro: "Rua A", numero: "1", bairro, cidade: "Taubaté" },
  })

  test("pedidos, faturamento, taxa, ticket e o tempo até entregar, do bairro que mais vende ao que menos", () => {
    const pedidos = [
      entregue(1, 60, 25, 40, { taxaEntrega: 6, ...no("Centro") }),
      entregue(2, 90, 30, 50, { taxaEntrega: 6, ...no("Centro") }),
      entregue(3, 200, 22, 35, { taxaEntrega: 9, ...no("Vila Nova") }),
      // A caminho: entra nas contas de dinheiro, mas não no tempo.
      entrega(
        4,
        30,
        [
          ["recebido", 0],
          ["saiu-para-entrega", 22],
        ],
        { taxaEntrega: 6, ...no("Centro") },
      ),
    ]
    expect(porBairro(pedidos, PERIODO)).toEqual([
      { bairro: "Vila Nova", pedidos: 1, total: 200, taxas: 9, ticket: 200, minutos: 35 },
      { bairro: "Centro", pedidos: 3, total: 180, taxas: 18, ticket: 60, minutos: 45 },
    ])
  })
})
