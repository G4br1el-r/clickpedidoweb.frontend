import { describe, expect, it } from "vitest"
import type { Mesa, Pedido } from "../dados/tipos"
import { indicadoresSalao } from "./indicadores-salao"
import { pedidoDeTeste } from "./pedidos-de-teste"

const AGORA = new Date(2026, 10, 13, 20, 30)

function mesaDe(numero: number, mudancas: Partial<Mesa> = {}): Mesa {
  return {
    id: `m${numero}`,
    numero,
    nome: `Mesa ${numero}`,
    status: "livre",
    areaId: "a1",
    lugares: 4,
    forma: "quadrada",
    posicao: { x: 0, y: 0 },
    ...mudancas,
  } as Mesa
}

function paga(id: number, pagoEm: Date, total: number, pessoas = 1, criadoEm = pagoEm): Pedido {
  return pedidoDeTeste(id, criadoEm, total, {
    tipo: "mesa",
    situacaoPagamento: "pago",
    pagoEm: pagoEm.toISOString(),
    mesa: { id: "m1", numero: 1, pessoas },
  })
}

const entrada = (mudancas: Partial<Parameters<typeof indicadoresSalao>[0]> = {}) => ({
  mesas: [] as Mesa[],
  abertas: [] as Pedido[],
  concluidos: [] as Pedido[],
  agora: AGORA,
  ...mudancas,
})

describe("indicadoresSalao", () => {
  it("ocupação: ocupadas e juntadas sobre as não bloqueadas", () => {
    const mesas = [
      ...Array.from({ length: 11 }, (_, i) => mesaDe(i + 1, { status: "ocupada" })),
      mesaDe(12, { juntadaCom: "m1" }),
      mesaDe(13, { bloqueio: {} }),
      ...Array.from({ length: 7 }, (_, i) => mesaDe(14 + i)),
    ]
    expect(indicadoresSalao(entrada({ mesas })).ocupacao).toEqual({
      ocupadas: 12,
      total: 19,
      percentual: 63,
      texto: "12/19 · 63%",
    })
  })

  it("sem nenhuma mesa não divide por zero", () => {
    expect(indicadoresSalao(entrada()).ocupacao).toEqual({
      ocupadas: 0,
      total: 0,
      percentual: 0,
      texto: "0/0 · 0%",
    })
  })

  it("pessoas: soma as comandas abertas, e a sem pessoas conta 1", () => {
    const aberta = (id: number, pessoas?: number) =>
      pedidoDeTeste(id, AGORA, 10, { tipo: "mesa", mesa: { id: "m1", numero: 1, pessoas } })
    const abertas = [aberta(1, 4), aberta(2, 2), aberta(3)]
    expect(indicadoresSalao(entrada({ abertas })).pessoas).toBe(7)
  })

  it("faturamento: só mesa paga hoje, fora ontem e entrega", () => {
    const concluidos = [
      paga(1, new Date(2026, 10, 13, 12), 120),
      paga(2, new Date(2026, 10, 13, 13), 80.5),
      paga(3, new Date(2026, 10, 13, 14), 99.5),
      paga(4, new Date(2026, 10, 12, 23, 40), 500),
      pedidoDeTeste(5, AGORA, 70, {
        tipo: "entrega",
        situacaoPagamento: "pago",
        pagoEm: AGORA.toISOString(),
      }),
    ]
    expect(indicadoresSalao(entrada({ concluidos })).faturamento).toBe(300)
  })

  it("tickets: por pessoa e por mesa", () => {
    const concluidos = [
      paga(1, new Date(2026, 10, 13, 12), 120, 4),
      paga(2, new Date(2026, 10, 13, 13), 80.5, 2),
      paga(3, new Date(2026, 10, 13, 14), 99.5, 4),
    ]
    const r = indicadoresSalao(entrada({ concluidos }))
    expect(r.ticketPorPessoa).toBe(30)
    expect(r.ticketPorMesa).toBe(100)
  })

  it("ticket arredonda em centavos, meio para cima", () => {
    const concluidos = [paga(1, new Date(2026, 10, 13, 12), 10, 3)]
    const r = indicadoresSalao(entrada({ concluidos }))
    expect(r.ticketPorPessoa).toBe(3.33)
    const meio = [paga(2, new Date(2026, 10, 13, 12), 0.05, 2)]
    expect(indicadoresSalao(entrada({ concluidos: meio })).ticketPorPessoa).toBe(0.03)
  })

  it("permanência e giro", () => {
    const h = (min: number) => new Date(2026, 10, 13, 18, min)
    const concluidos = [
      paga(1, h(60), 10, 1, h(0)),
      paga(2, new Date(2026, 10, 13, 19, 30), 10, 1, h(0)),
      paga(3, h(45), 10, 1, h(0)),
    ]
    const mesas = [
      mesaDe(1, { bloqueio: {} }),
      ...Array.from({ length: 19 }, (_, i) => mesaDe(i + 2)),
    ]
    const r = indicadoresSalao(entrada({ concluidos, mesas }))
    expect(r.permanenciaMin).toBe(65)
    expect(r.giro).toBe(0.2)
  })

  it("sem nenhuma paga hoje: valores por conta paga são null e faturamento 0", () => {
    const r = indicadoresSalao(entrada({ mesas: [mesaDe(1)] }))
    expect(r).toMatchObject({
      faturamento: 0,
      ticketPorPessoa: null,
      ticketPorMesa: null,
      permanenciaMin: null,
      giro: null,
    })
  })
})
