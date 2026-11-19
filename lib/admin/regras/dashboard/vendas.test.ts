import { describe, expect, test } from "vitest"
import {
  PEDIDOS_DE_TESTE as PEDIDOS,
  PERIODO_DE_TESTE as PERIODO,
  pedidoDeTeste,
} from "../pedidos-de-teste"
import {
  canaisDasVendas,
  mapaDeCalor,
  mediaPorHora,
  origensDasVendas,
  podeAgruparPorSemana,
  porSemana,
  reguaDeVendas,
  serieComAnterior,
} from "./vendas"

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

describe("mapaDeCalor", () => {
  test("pedidos válidos por dia da semana e hora, de segunda a domingo, nas horas com venda", () => {
    const mapa = mapaDeCalor(PEDIDOS, PERIODO)
    expect(mapa.horas).toEqual([19, 20])
    expect(mapa.dias.map((linha) => linha.dia)).toEqual([1, 2, 3, 4, 5, 6, 0])
    // 12/11/2026 é quinta; 13/11, sexta.
    expect(mapa.dias[3]).toEqual({
      dia: 4,
      celulas: [
        { hora: 19, pedidos: 1, faturamento: 50, nivel: 4 },
        { hora: 20, pedidos: 1, faturamento: 30, nivel: 4 },
      ],
    })
    expect(mapa.dias[0].celulas.map((celula) => celula.nivel)).toEqual([0, 0])
  })
})

describe("mapaDeCalor: tons", () => {
  test("cinco tons: 0 sem venda e de 1 a 4 em relação à célula mais cheia", () => {
    // Segunda, 9/11/2026: 4 pedidos às 10h, 2 às 11h, 3 às 12h e 1 às 13h.
    const em = (hora: number, quantos: number, primeiroId: number) =>
      Array.from({ length: quantos }, (_, indice) =>
        pedidoDeTeste(primeiroId + indice, new Date(2026, 10, 9, hora), 10),
      )
    const pedidos = [...em(10, 4, 1), ...em(11, 2, 10), ...em(12, 3, 20), ...em(13, 1, 30)]
    const mapa = mapaDeCalor(pedidos, { de: new Date(2026, 10, 9), ate: new Date(2026, 10, 9) })
    expect(mapa.dias[0].celulas.map((celula) => celula.nivel)).toEqual([4, 2, 3, 1])
    expect(mapa.dias[1].celulas.map((celula) => celula.nivel)).toEqual([0, 0, 0, 0])
  })
})

describe("mediaPorHora", () => {
  test("média de pedidos e faturamento por dia do período, em cada hora com venda", () => {
    expect(mediaPorHora(PEDIDOS, PERIODO)).toEqual([
      { hora: 19, pedidos: 1, faturamento: 60 },
      { hora: 20, pedidos: 1, faturamento: 25 },
    ])
  })
})

describe("origensDasVendas", () => {
  test("vendas válidas por origem, da maior para a menor", () => {
    const dia = new Date(2026, 10, 9, 12)
    const pedidos = [
      pedidoDeTeste(1, dia, 10),
      pedidoDeTeste(2, dia, 10),
      pedidoDeTeste(3, dia, 30, { origem: "pdv" }),
      pedidoDeTeste(4, dia, 99, { origem: "garcom", status: "cancelado" }),
    ]
    expect(
      origensDasVendas(pedidos, { de: new Date(2026, 10, 9), ate: new Date(2026, 10, 9) }),
    ).toEqual([
      { origem: "pdv", pedidos: 1, total: 30, percentual: 60 },
      { origem: "site", pedidos: 2, total: 20, percentual: 40 },
    ])
  })
})

describe("canaisDasVendas", () => {
  test("vendas válidas do período por canal, da maior para a menor", () => {
    expect(
      canaisDasVendas(PEDIDOS, PERIODO).map(({ tipo, pedidos, total }) => [tipo, pedidos, total]),
    ).toEqual([
      ["entrega", 2, 70],
      ["mesa", 1, 70],
      ["retirada", 1, 30],
    ])
  })
})
