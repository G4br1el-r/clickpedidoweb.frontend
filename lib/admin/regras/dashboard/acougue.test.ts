import { describe, expect, test } from "vitest"
import type { ItemPedido } from "../../dados/tipos"
import { PERIODO_DE_TESTE as PERIODO, pedidoDeTeste } from "../pedidos-de-teste"
import { kgVendidos, pesagensDoPeriodo, retiradasPorDia } from "./acougue"

const DIA = new Date(2026, 10, 13, 10)

/** Item por quilo: `gramas` pedidos por unidade e, se já pesou, o peso real da linha. */
const porKg = (id: string, gramas: number, quantidade: number, pesoReal?: number): ItemPedido => ({
  id,
  produtoId: id,
  nome: id,
  quantidade,
  precoUnitario: 50,
  opcoes: [],
  total: 50,
  pesoGramas: gramas,
  precoKg: 50,
  ...(pesoReal === undefined ? {} : { pesoReal }),
})

describe("pesagensDoPeriodo", () => {
  test("quantos pesaram, a diferença média em reais e a diferença sobre o estimado", () => {
    const pesado = (id: number, totalEstimado: number, diferenca: number) =>
      pedidoDeTeste(id, DIA, totalEstimado + diferenca, {
        pesagem: { totalEstimado, diferenca, pesadoEm: DIA.toISOString() },
      })
    const pedidos = [
      pesado(1, 100, 6),
      pesado(2, 200, -2),
      pesado(3, 100, 4),
      // Sem pesagem, ou cancelado, fica de fora.
      pedidoDeTeste(4, DIA, 80),
      { ...pesado(5, 300, 30), status: "cancelado" as const },
    ]
    expect(pesagensDoPeriodo(pedidos, PERIODO)).toEqual({
      pesados: 3,
      diferencaMedia: 2.67,
      percentual: 2,
    })
  })
})

describe("kgVendidos", () => {
  test("o peso vendido no período: o da balança, ou o pedido quando ainda não pesou", () => {
    const pedidos = [
      pedidoDeTeste(1, DIA, 50, { itens: [porKg("picanha", 500, 2, 1040)] }),
      pedidoDeTeste(2, DIA, 50, { itens: [porKg("alcatra", 750, 1)] }),
      pedidoDeTeste(3, DIA, 50, { status: "cancelado", itens: [porKg("alcatra", 750, 4)] }),
    ]
    expect(kgVendidos(pedidos, PERIODO)).toBe(1.79)
  })
})

describe("retiradasPorDia", () => {
  test("pedidos e valor marcados para buscar em cada dia, do mais cedo ao mais tarde", () => {
    const pedidos = [
      pedidoDeTeste(1, DIA, 80, { dataRetirada: "2026-11-15" }),
      pedidoDeTeste(2, DIA, 40, { dataRetirada: "2026-11-13" }),
      pedidoDeTeste(3, DIA, 60, { dataRetirada: "2026-11-15" }),
      pedidoDeTeste(4, DIA, 90, { dataRetirada: "2026-11-14", status: "cancelado" }),
      pedidoDeTeste(5, DIA, 70),
    ]
    expect(retiradasPorDia(pedidos, PERIODO)).toEqual([
      { dia: "2026-11-13", pedidos: 1, total: 40 },
      { dia: "2026-11-15", pedidos: 2, total: 140 },
    ])
  })
})
