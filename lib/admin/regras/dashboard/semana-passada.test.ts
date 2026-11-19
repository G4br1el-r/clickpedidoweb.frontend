import { describe, expect, test } from "vitest"
import { pedidoDeTeste as pedido } from "../pedidos-de-teste"
import { hojeVsSemanaPassada, textosDaSemanaPassada } from "./semana-passada"

describe("textosDaSemanaPassada", () => {
  test("dia de semana é feminino; sábado e domingo, masculinos", () => {
    expect(textosDaSemanaPassada(new Date(2026, 10, 6))).toEqual({
      comparacao: "vs sexta passada",
      semBase: "Sem base na sexta passada",
    })
    expect(textosDaSemanaPassada(new Date(2026, 10, 7))).toEqual({
      comparacao: "vs sábado passado",
      semBase: "Sem base no sábado passado",
    })
  })
})

/** Sexta, 13/11/2026, 20:30. A sexta passada é 06/11. */
const AGORA = new Date(2026, 10, 13, 20, 30)

describe("hojeVsSemanaPassada", () => {
  test("compara hoje com a sexta passada até a mesma hora", () => {
    const pedidos = [
      pedido(1, new Date(2026, 10, 13, 19), 60),
      pedido(2, new Date(2026, 10, 13, 20), 90),
      pedido(3, new Date(2026, 10, 6, 19), 100),
      // Depois das 20:30 da sexta passada: fica fora, hoje ainda não chegou lá.
      pedido(4, new Date(2026, 10, 6, 21), 500),
    ]

    expect(hojeVsSemanaPassada(pedidos, AGORA)).toEqual({
      dia: new Date(2026, 10, 6),
      variacao: { pedidos: 100, faturamento: 50, ticket: -25 },
    })
  })

  test("conta só as vendas válidas dos dois dias", () => {
    const pedidos = [
      pedido(1, new Date(2026, 10, 13, 19), 50),
      pedido(2, new Date(2026, 10, 13, 19, 30), 80, { status: "cancelado" }),
      pedido(3, new Date(2026, 10, 6, 18), 100),
      pedido(4, new Date(2026, 10, 6, 18, 30), 70, { status: "aguardando-pagamento" }),
    ]

    expect(hojeVsSemanaPassada(pedidos, AGORA).variacao).toEqual({
      pedidos: 0,
      faturamento: -50,
      ticket: -50,
    })
  })

  test("sem venda na sexta passada até esta hora, fica sem base", () => {
    const pedidos = [
      pedido(1, new Date(2026, 10, 13, 19), 60),
      pedido(2, new Date(2026, 10, 6, 22), 100),
    ]

    expect(hojeVsSemanaPassada(pedidos, AGORA)).toEqual({
      dia: new Date(2026, 10, 6),
      variacao: null,
    })
  })
})
