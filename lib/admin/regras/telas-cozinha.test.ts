import { describe, expect, test } from "vitest"
import type { Pedido, StatusPedido } from "../dados/tipos"
import type { ColunaCozinha, TicketCozinha } from "./cozinha"
import { numerosDaChamada, paginaDaTv } from "./telas-cozinha"

const tickets = (prefixo: string, quantos: number) =>
  Array.from(
    { length: quantos },
    (_, indice) => ({ id: `${prefixo}${indice + 1}` }) as TicketCozinha,
  )

const COLUNAS = [
  { id: "afazer", titulo: "A fazer", status: "recebido", tickets: tickets("a", 5) },
  { id: "preparando", titulo: "Preparando", status: "em-preparo", tickets: tickets("p", 2) },
  { id: "prontos", titulo: "Prontos", status: "pronto", tickets: [] },
] as ColunaCozinha[]

const ids = (colunas: ColunaCozinha[]) => colunas.map((coluna) => coluna.tickets.map((t) => t.id))

describe("paginaDaTv", () => {
  test("cada coluna mostra a sua fatia da página; o total vem da coluna mais cheia", () => {
    const primeira = paginaDaTv(COLUNAS, 0, 3)
    expect(primeira.total).toBe(2)
    expect(ids(primeira.colunas)).toEqual([["a1", "a2", "a3"], ["p1", "p2"], []])
    expect(ids(paginaDaTv(COLUNAS, 1, 3).colunas)).toEqual([["a4", "a5"], [], []])
  })

  test("a página que passou do fim volta para a primeira; sem tickets, uma página só", () => {
    expect(ids(paginaDaTv(COLUNAS, 2, 3).colunas)[0]).toEqual(["a1", "a2", "a3"])
    expect(
      paginaDaTv(
        COLUNAS.map((coluna) => ({ ...coluna, tickets: [] })),
        0,
        3,
      ).total,
    ).toBe(1)
  })
})

describe("numerosDaChamada", () => {
  const as = (hora: string) => {
    const [h, m] = hora.split(":").map(Number)
    return new Date(2026, 10, 13, h, m).toISOString()
  }
  const pedido = (numero: number, status: StatusPedido, extra: Partial<Pedido> = {}): Pedido =>
    ({
      id: numero,
      numero,
      tipo: "retirada",
      status,
      criadoEm: as("20:00"),
      itens: [],
      etapas: {},
      ...extra,
    }) as unknown as Pedido

  test("retirada em preparo pela chegada; pronta, a mais nova primeiro; entrega, mesa e concluída ficam de fora", () => {
    const pedidos = [
      pedido(12, "em-preparo", { criadoEm: as("20:10") }),
      pedido(11, "recebido", { criadoEm: as("20:05") }),
      pedido(9, "pronto", { etapas: { pronto: as("20:15") } }),
      pedido(10, "pronto", { etapas: { pronto: as("20:20") } }),
      pedido(8, "concluido"),
      pedido(7, "cancelado"),
      pedido(20, "em-preparo", { tipo: "entrega" }),
      pedido(21, "pronto", { tipo: "mesa" }),
    ]
    expect(numerosDaChamada(pedidos)).toEqual({ preparando: [11, 12], prontos: [10, 9] })
  })

  test("pronta sem a hora do pronto entra pela hora do pedido", () => {
    const pedidos = [
      pedido(6, "pronto", { etapas: { pronto: as("20:20") } }),
      pedido(5, "pronto", { criadoEm: as("20:25") }),
    ]
    expect(numerosDaChamada(pedidos).prontos).toEqual([5, 6])
  })
})
