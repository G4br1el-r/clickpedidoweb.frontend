import { describe, expect, test } from "vitest"
import type { HorarioFuncionamento } from "../../dados/tipos"
import { pedidoDeTeste as pedido } from "../pedidos-de-teste"
import { situacaoDaMeta } from "./metas"

/** Fecha na segunda; nos outros dias, das 18h às 23h. Novembro/2026 tem 25 dias abertos. */
const HORARIOS: HorarioFuncionamento[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
  dia,
  aberto: dia !== 1,
  abre: "18:00",
  fecha: "23:00",
}))

/** Sexta, 13/11, 20:30: 11º dia aberto do mês, metade do expediente. */
const AGORA = new Date(2026, 10, 13, 20, 30)

const PEDIDOS = [
  pedido(1, new Date(2026, 10, 5, 20), 4000),
  pedido(2, new Date(2026, 10, 10, 21), 6000),
  pedido(3, new Date(2026, 10, 10, 22), 900, { status: "cancelado" }),
  pedido(4, new Date(2026, 10, 13, 19), 300),
  // Outubro não conta.
  pedido(5, new Date(2026, 9, 30, 20), 7000),
]

describe("situacaoDaMeta", () => {
  const situacao = situacaoDaMeta({ faturamento: 30_000, pedidos: null }, PEDIDOS, HORARIOS, AGORA)

  test("o mês soma só as vendas válidas de novembro", () => {
    expect(situacao.mes.realizado).toBe(10_300)
    expect(situacao.mes.percentual).toBeCloseTo(34.33, 2)
  })

  test("a meta de hoje divide o que falta pelos dias abertos que restam, contando hoje", () => {
    // Faltam R$ 20.000 até ontem para 15 dias abertos (hoje e os outros 14).
    expect(situacao.hoje).toEqual({ meta: 1333.33, realizado: 300 })
  })

  test("a projeção segue a média dos dias abertos que já fecharam", () => {
    // R$ 10.000 em 10 dias: R$ 1.000 por dia nos 15 que restam.
    expect(situacao.projecao).toBe(25_000)
  })

  test("depois das 18h, abaixo do ritmo do expediente, a meta de hoje fica em risco", () => {
    // Metade do expediente pede R$ 666,67; vendeu R$ 300.
    expect(situacao.emRisco).toBe(true)
  })

  test("antes das 18h, nunca está em risco", () => {
    const tarde = new Date(2026, 10, 13, 17, 59)
    expect(
      situacaoDaMeta({ faturamento: 30_000, pedidos: null }, PEDIDOS, HORARIOS, tarde).emRisco,
    ).toBe(false)
  })

  test("no ritmo, não está em risco", () => {
    const comMais = [...PEDIDOS, pedido(6, new Date(2026, 10, 13, 20), 400)]
    expect(
      situacaoDaMeta({ faturamento: 30_000, pedidos: null }, comMais, HORARIOS, AGORA).emRisco,
    ).toBe(false)
  })

  test("antes do 3º dia aberto não há projeção", () => {
    // Terça, 03/11: 2º dia aberto (o domingo, 01/11, foi o 1º).
    const inicio = new Date(2026, 10, 3, 20)
    expect(
      situacaoDaMeta({ faturamento: 30_000, pedidos: null }, [], HORARIOS, inicio).projecao,
    ).toBeNull()
  })

  test("meta já batida: a de hoje é zero e não há risco", () => {
    const batida = situacaoDaMeta({ faturamento: 8_000, pedidos: null }, PEDIDOS, HORARIOS, AGORA)
    expect(batida.hoje.meta).toBe(0)
    expect(batida.emRisco).toBe(false)
  })

  test("com meta de pedidos, conta os pedidos válidos do mês", () => {
    const comPedidos = situacaoDaMeta(
      { faturamento: 30_000, pedidos: 100 },
      PEDIDOS,
      HORARIOS,
      AGORA,
    )
    expect(comPedidos.pedidos).toEqual({ meta: 100, realizado: 3 })
    expect(situacao.pedidos).toBeNull()
  })
})
