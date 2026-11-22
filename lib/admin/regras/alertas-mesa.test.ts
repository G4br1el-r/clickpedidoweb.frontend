import { describe, expect, test } from "vitest"
import type { ConfigSalao } from "../dados/tipos"
import { alertasDaMesa, tempoDesde } from "./alertas-mesa"

const agora = new Date(2026, 10, 13, 20, 30)
const minutosAntes = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString()

describe("tempoDesde", () => {
  test("menos de uma hora sai em minutos", () => {
    expect(tempoDesde(minutosAntes(0), agora)).toBe("0 min")
    expect(tempoDesde(minutosAntes(59), agora)).toBe("59 min")
  })

  test("início no futuro vira 0 min", () => {
    expect(tempoDesde(minutosAntes(-5), agora)).toBe("0 min")
  })

  test("de uma hora em diante sai em horas e minutos com dois dígitos", () => {
    expect(tempoDesde(minutosAntes(60), agora)).toBe("1 h 00")
    expect(tempoDesde(minutosAntes(125), agora)).toBe("2 h 05")
  })
})

const limites: ConfigSalao["alertas"] = {
  semPedidoMin: 15,
  contaPedidaMin: 10,
  servirMin: 10,
  abertaMin: 150,
}
const item = { nome: "Suco" } as never
const mesaOcupada = { status: "ocupada" as const, ocupadaEm: minutosAntes(1) }

describe("alertasDaMesa", () => {
  test("conta pedida: nada a 9 min, alerta aos 10 min", () => {
    const com = (min: number) => ({ itens: [item], contaPedidaEm: minutosAntes(min) })
    expect(alertasDaMesa(mesaOcupada, com(9), limites, agora)).toEqual([])
    expect(alertasDaMesa(mesaOcupada, com(10), limites, agora)).toEqual([
      { tipo: "conta-pedida", texto: "Pediu a conta há 10 min" },
    ])
  })
})

describe("alertasDaMesa: servir", () => {
  test("nada a 9 min, alerta aos 10 min", () => {
    const com = (min: number) => ({ itens: [item], servirDesde: minutosAntes(min) })
    expect(alertasDaMesa(mesaOcupada, com(9), limites, agora)).toEqual([])
    expect(alertasDaMesa(mesaOcupada, com(10), limites, agora)).toEqual([
      { tipo: "servir", texto: "Pronta há 10 min" },
    ])
  })
})

describe("alertasDaMesa: sem pedido", () => {
  test("comanda sem itens: nada a 14 min, alerta aos 15 min", () => {
    const aberta = (min: number) => ({ status: "ocupada" as const, ocupadaEm: minutosAntes(min) })
    const vazia = { itens: [] }
    expect(alertasDaMesa(aberta(14), vazia, limites, agora)).toEqual([])
    expect(alertasDaMesa(aberta(15), vazia, limites, agora)).toEqual([
      { tipo: "sem-pedido", texto: "Sem pedido há 15 min" },
    ])
  })

  test("com item na comanda não é sem pedido", () => {
    const mesa = { status: "ocupada" as const, ocupadaEm: minutosAntes(15) }
    expect(alertasDaMesa(mesa, { itens: [item] }, limites, agora)).toEqual([])
  })
})

describe("alertasDaMesa: aberta", () => {
  test("nada a 149 min, alerta aos 150 min", () => {
    const aberta = (min: number) => ({ status: "ocupada" as const, ocupadaEm: minutosAntes(min) })
    expect(alertasDaMesa(aberta(149), { itens: [item] }, limites, agora)).toEqual([])
    expect(alertasDaMesa(aberta(150), { itens: [item] }, limites, agora)).toEqual([
      { tipo: "aberta", texto: "Aberta há 2 h 30" },
    ])
  })
})

describe("alertasDaMesa: mesas sem alerta", () => {
  const antiga = { itens: [], contaPedidaEm: minutosAntes(200), servirDesde: minutosAntes(200) }

  test("livre, bloqueada e juntada não alertam, mesmo com comanda antiga", () => {
    const ocupadaEm = minutosAntes(200)
    expect(alertasDaMesa({ status: "livre", ocupadaEm }, antiga, limites, agora)).toEqual([])
    expect(
      alertasDaMesa({ status: "ocupada", ocupadaEm, bloqueio: {} }, antiga, limites, agora),
    ).toEqual([])
    expect(
      alertasDaMesa({ status: "ocupada", ocupadaEm, juntadaCom: "m1" }, antiga, limites, agora),
    ).toEqual([])
  })

  test("bate três limites: conta pedida, servir e aberta, nessa ordem", () => {
    const comanda = {
      itens: [item],
      contaPedidaEm: minutosAntes(10),
      servirDesde: minutosAntes(10),
    }
    const mesa = { status: "ocupada" as const, ocupadaEm: minutosAntes(150) }
    expect(alertasDaMesa(mesa, comanda, limites, agora)).toEqual([
      { tipo: "conta-pedida", texto: "Pediu a conta há 10 min" },
      { tipo: "servir", texto: "Pronta há 10 min" },
      { tipo: "aberta", texto: "Aberta há 2 h 30" },
    ])
  })
})
