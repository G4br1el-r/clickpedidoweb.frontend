import { describe, expect, test } from "vitest"
import { PEDIDOS_DE_TESTE as PEDIDOS, PERIODO_DE_TESTE as PERIODO } from "../pedidos-de-teste"
import { podeAgruparPorSemana, porSemana, reguaDeVendas, serieComAnterior } from "./vendas"

describe("reguaDeVendas", () => {
  test("faturamento, pedidos, ticket e itens por pedido das vendas válidas, com o período anterior", () => {
    expect(reguaDeVendas(PEDIDOS, PERIODO)).toEqual({
      atual: { faturamento: 170, pedidos: 4, ticket: 42.5, itensPorPedido: 1.75 },
      anterior: { faturamento: 160, pedidos: 2, ticket: 80, itensPorPedido: 3 },
    })
  })
})

describe("serieComAnterior", () => {
  test("cada dia do período ao lado do dia na mesma posição do período anterior", () => {
    expect(serieComAnterior(PEDIDOS, PERIODO)).toEqual([
      {
        inicio: new Date(2026, 10, 12),
        fim: new Date(2026, 10, 12),
        faturamento: 80,
        pedidos: 2,
        anterior: { inicio: new Date(2026, 10, 10), faturamento: 60, pedidos: 1 },
      },
      {
        inicio: new Date(2026, 10, 13),
        fim: new Date(2026, 10, 13),
        faturamento: 90,
        pedidos: 2,
        anterior: { inicio: new Date(2026, 10, 11), faturamento: 100, pedidos: 1 },
      },
    ])
  })
})

describe("agrupar por semana", () => {
  test("só com 14 dias ou mais no período", () => {
    expect(podeAgruparPorSemana({ de: new Date(2026, 10, 1), ate: new Date(2026, 10, 13) })).toBe(
      false,
    )
    expect(podeAgruparPorSemana({ de: new Date(2026, 10, 1), ate: new Date(2026, 10, 14) })).toBe(
      true,
    )
  })

  test("soma os dias de 7 em 7 a partir do início; a última semana pode ser menor", () => {
    const dia = (n: number) => ({
      inicio: new Date(2026, 10, n),
      fim: new Date(2026, 10, n),
      faturamento: 10,
      pedidos: 1,
      anterior: { inicio: new Date(2026, 9, n), faturamento: 5, pedidos: 2 },
    })
    const oitoDias = [1, 2, 3, 4, 5, 6, 7, 8].map(dia)
    expect(porSemana(oitoDias)).toEqual([
      {
        inicio: new Date(2026, 10, 1),
        fim: new Date(2026, 10, 7),
        faturamento: 70,
        pedidos: 7,
        anterior: { inicio: new Date(2026, 9, 1), faturamento: 35, pedidos: 14 },
      },
      {
        inicio: new Date(2026, 10, 8),
        fim: new Date(2026, 10, 8),
        faturamento: 10,
        pedidos: 1,
        anterior: { inicio: new Date(2026, 9, 8), faturamento: 5, pedidos: 2 },
      },
    ])
  })
})
