import { describe, expect, it } from "vitest"
import type { Mesa, Pedido } from "../dados/tipos"
import { type FiltrosMesas, filtrarMesas, type MesaNaGrade } from "./filtro-mesas"
import { pedidoDeTeste } from "./pedidos-de-teste"

const LIVRE = { estado: "livre", rotulo: "Livre", tom: "fim" } as const
const OCUPADA = { estado: "ocupada", rotulo: "Ocupada", tom: "caminho" } as const
const COZINHA = { estado: "na-cozinha", rotulo: "Na cozinha", tom: "preparo" } as const
const SERVIR = { estado: "servir", rotulo: "Servir", tom: "pronto" } as const
const CONTA = { estado: "conta-pedida", rotulo: "Pediu a conta", tom: "novo" } as const
const ALERTA = { tipo: "servir", texto: "Pronta há 10 min" } as const

function linha(
  numero: number,
  mudancas: Partial<Mesa> = {},
  extra: Partial<MesaNaGrade> = {},
): MesaNaGrade {
  return {
    mesa: {
      id: `m${numero}`,
      numero,
      nome: `Mesa ${numero}`,
      status: "livre",
      areaId: "salao",
      lugares: 4,
      forma: "quadrada",
      posicao: { x: 0, y: 0 },
      ...mudancas,
    },
    estado: LIVRE,
    alertas: [],
    ...extra,
  }
}

function comandaDe(garcom: string): Pedido {
  return pedidoDeTeste(1, new Date(2026, 10, 13, 20, 0), 50, {
    tipo: "mesa",
    mesa: { id: "m1", numero: 1, garcom },
  })
}

const vazios: FiltrosMesas = { busca: "", area: null, estado: null, garcom: null, atencao: false }
const numeros = (linhas: MesaNaGrade[]) => linhas.map((l) => l.mesa.numero)

describe("filtrarMesas", () => {
  it("busca pelo número: '12' acha a 12 e a 120, mas não a 1 nem a 21", () => {
    const linhas = [linha(1), linha(21), linha(12), linha(120)]
    const achadas = filtrarMesas(linhas, { ...vazios, busca: "12" }, "numero")
    expect(numeros(achadas)).toEqual([12, 120])
  })

  it("o número casa pelo começo: '12' não acha a 112 nem a 212", () => {
    const linhas = [linha(12), linha(112), linha(120), linha(212)]
    expect(numeros(filtrarMesas(linhas, { ...vazios, busca: "12" }, "numero"))).toEqual([12, 120])
  })

  it("com zero à esquerda, como no nome 'Mesa 07': '07' acha a 7, não a 70; '7' acha a 7 e a 70", () => {
    const linhas = [linha(7), linha(70)]
    expect(numeros(filtrarMesas(linhas, { ...vazios, busca: "07" }, "numero"))).toEqual([7])
    expect(numeros(filtrarMesas(linhas, { ...vazios, busca: "7" }, "numero"))).toEqual([7, 70])
  })

  it("termo só com dígitos olha só o número: '3' não acha a mesa 'Varanda 3'", () => {
    const linhas = [linha(3), linha(7, { nome: "Varanda 3" })]
    expect(numeros(filtrarMesas(linhas, { ...vazios, busca: "3" }, "numero"))).toEqual([3])
  })

  it("o garçom casa sem acento nem maiúscula nos dois lados", () => {
    const linhas = [
      linha(1, {}, { comanda: comandaDe("ania") }),
      linha(2, {}, { comanda: comandaDe("Beto") }),
    ]
    expect(numeros(filtrarMesas(linhas, { ...vazios, garcom: "Ânia" }, "numero"))).toEqual([1])
    const outras = [linha(3, {}, { comanda: comandaDe("ÂNIA") })]
    expect(numeros(filtrarMesas(outras, { ...vazios, garcom: "ania" }, "numero"))).toEqual([3])
  })

  it("busca sem acento nem maiúscula: 'julia' acha a cliente Júlia e 'VARANDA' acha 'Varanda 3'", () => {
    const linhas = [
      linha(1),
      linha(2, { status: "ocupada", clienteNome: "Júlia" }),
      linha(3, { nome: "Varanda 3" }),
    ]
    expect(numeros(filtrarMesas(linhas, { ...vazios, busca: "julia" }, "numero"))).toEqual([2])
    expect(numeros(filtrarMesas(linhas, { ...vazios, busca: "VARANDA" }, "numero"))).toEqual([3])
  })

  it("área, estado e garçom combinam (E)", () => {
    const comAna = comandaDe("Ana")
    const linhas = [
      linha(1, { status: "ocupada", areaId: "varanda" }, { estado: OCUPADA, comanda: comAna }),
      linha(2, { status: "ocupada", areaId: "salao" }, { estado: OCUPADA, comanda: comAna }),
      linha(
        3,
        { status: "ocupada", areaId: "varanda" },
        { estado: OCUPADA, comanda: comandaDe("Beto") },
      ),
      linha(4, { areaId: "varanda" }),
    ]
    const achadas = filtrarMesas(
      linhas,
      { ...vazios, area: "varanda", estado: "ocupada", garcom: "Ana" },
      "numero",
    )
    expect(numeros(achadas)).toEqual([1])
  })

  it("o estado 'ocupada' pega ocupada, na cozinha, servir e conta pedida", () => {
    const linhas = [
      linha(1, {}, { estado: OCUPADA }),
      linha(2, {}, { estado: COZINHA }),
      linha(3, {}, { estado: SERVIR }),
      linha(4, {}, { estado: CONTA }),
      linha(5),
    ]
    expect(numeros(filtrarMesas(linhas, { ...vazios, estado: "ocupada" }, "numero"))).toEqual([
      1, 2, 3, 4,
    ])
    expect(numeros(filtrarMesas(linhas, { ...vazios, estado: "servir" }, "numero"))).toEqual([3])
  })

  it("a ordem 'numero' vai 1, 2, 12", () => {
    const linhas = [linha(12), linha(1), linha(2)]
    expect(numeros(filtrarMesas(linhas, vazios, "numero"))).toEqual([1, 2, 12])
  })

  it("os filtros vazios devolvem tudo na ordem do número, sem mexer na lista de entrada", () => {
    const linhas = [linha(3), linha(1), linha(2)]
    expect(numeros(filtrarMesas(linhas, vazios, "numero"))).toEqual([1, 2, 3])
    expect(numeros(linhas)).toEqual([3, 1, 2])
  })

  it("a ordem 'tempo' vai da mais antiga para a mais nova, e as livres ficam no fim pelo número", () => {
    const aberta = (numero: number, ocupadaEm: string) =>
      linha(numero, { status: "ocupada", ocupadaEm }, { estado: OCUPADA })
    const linhas = [
      linha(3),
      aberta(5, "2026-11-13T19:30:00-03:00"),
      linha(1),
      aberta(7, "2026-11-13T18:00:00-03:00"),
      aberta(2, "2026-11-13T20:00:00-03:00"),
    ]
    expect(numeros(filtrarMesas(linhas, vazios, "tempo"))).toEqual([7, 5, 2, 1, 3])
  })

  it("'atencao' deixa só as mesas com alerta", () => {
    const linhas = [linha(1), linha(2, {}, { estado: SERVIR, alertas: [ALERTA] }), linha(3)]
    expect(numeros(filtrarMesas(linhas, { ...vazios, atencao: true }, "numero"))).toEqual([2])
  })
})
