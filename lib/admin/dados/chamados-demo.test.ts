import { describe, expect, test } from "vitest"
import { chamadosDemo } from "./chamados-demo"
import type { Mesa } from "./tipos"

const AGORA = new Date(2026, 10, 13, 20, 30)

const mesa = (numero: number, mudanca: Partial<Mesa> = {}): Mesa => ({
  id: `mesa-${numero}`,
  numero,
  nome: `Mesa ${numero}`,
  status: "livre",
  areaId: "area-salao",
  lugares: 4,
  forma: "quadrada",
  posicao: { x: numero * 3, y: 0 },
  ...mudanca,
})

describe("chamadosDemo", () => {
  test("um chamado de garçom aberto há 3 min na primeira mesa ocupada, pelo número", () => {
    const mesas = [
      mesa(5, { status: "ocupada" }),
      mesa(1),
      mesa(3, { status: "ocupada" }),
      mesa(2, { juntadaCom: "mesa-3" }),
    ]
    expect(chamadosDemo(mesas, AGORA)).toEqual([
      {
        id: "chamado-20261113-1",
        mesaId: "mesa-3",
        tipo: "garcom",
        criadoEm: new Date(2026, 10, 13, 20, 27).toISOString(),
      },
    ])
  })

  test("sem mesa ocupada, nenhum chamado", () => {
    expect(chamadosDemo([mesa(1), mesa(2)], AGORA)).toEqual([])
  })
})
