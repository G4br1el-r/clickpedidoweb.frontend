import { describe, expect, test } from "vitest"
import { GRADE_MAPA, mesasSeCruzam, tamanhoDaMesa } from "../regras/salao"
import { salaoDemo } from "./salao-demo"

describe("salaoDemo", () => {
  test("20 mesas: Salão 1 a 10, Varanda 11 a 16, Balcão 17 a 20", () => {
    const { mesas, salao } = salaoDemo("pizzaria")
    expect(mesas).toHaveLength(20)
    expect(salao.areas.map((area) => area.nome)).toEqual(["Salão", "Varanda", "Balcão"])
    const area = (numero: number) =>
      salao.areas.find((a) => a.id === mesas.find((m) => m.numero === numero)?.areaId)?.nome
    expect([1, 10, 11, 16, 17, 20].map(area)).toEqual([
      "Salão",
      "Salão",
      "Varanda",
      "Varanda",
      "Balcão",
      "Balcão",
    ])
  })

  test("ids e nomes seguem mesa-N e Mesa 0N, todas livres", () => {
    const { mesas } = salaoDemo("adega")
    expect(mesas[0]).toMatchObject({ id: "mesa-1", numero: 1, nome: "Mesa 01", status: "livre" })
    expect(mesas[19]).toMatchObject({ id: "mesa-20", numero: 20, nome: "Mesa 20", status: "livre" })
  })

  test("lugares e formas", () => {
    const por = (numero: number) => salaoDemo("adega").mesas.find((m) => m.numero === numero)
    expect(por(1)).toMatchObject({ forma: "quadrada", lugares: 4 })
    expect(por(9)).toMatchObject({ forma: "retangular", lugares: 8 })
    expect(por(11)).toMatchObject({ forma: "redonda", lugares: 2 })
    expect(por(15)).toMatchObject({ forma: "retangular", lugares: 6 })
    expect(por(17)).toMatchObject({ forma: "redonda", lugares: 2 })
  })

  test("a mesa 20 está bloqueada para manutenção", () => {
    expect(salaoDemo("lanchonete").mesas.find((m) => m.numero === 20)?.bloqueio).toEqual({
      motivo: "Em manutenção",
    })
    expect(salaoDemo("lanchonete").mesas.filter((m) => m.bloqueio)).toHaveLength(1)
  })

  test.each(["adega", "acougue", "pizzaria", "lanchonete"] as const)(
    "%s: nenhuma mesa se sobrepõe nem sai do mapa",
    (segmento) => {
      const { mesas } = salaoDemo(segmento)
      const retangulos = mesas.map((mesa) => ({
        numero: mesa.numero,
        areaId: mesa.areaId,
        ...mesa.posicao,
        ...tamanhoDaMesa(mesa),
      }))
      for (const r of retangulos) {
        expect(r.x).toBeGreaterThanOrEqual(0)
        expect(r.y).toBeGreaterThanOrEqual(0)
        expect(r.x + r.largura).toBeLessThanOrEqual(GRADE_MAPA.colunas)
        expect(r.y + r.altura).toBeLessThanOrEqual(GRADE_MAPA.linhas)
      }
      const sobrepostas: string[] = []
      for (const [i, a] of mesas.entries()) {
        for (const b of mesas.slice(i + 1)) {
          if (a.areaId === b.areaId && mesasSeCruzam(a, b))
            sobrepostas.push(`${a.numero}/${b.numero}`)
        }
      }
      expect(sobrepostas).toEqual([])
    },
  )

  test("taxa e couvert por segmento; limpeza ligada em todos", () => {
    expect(salaoDemo("pizzaria").salao).toMatchObject({
      taxaServico: { ativa: true, percentual: 10 },
      couvert: { ativo: true, porPessoa: 8 },
      limpeza: true,
    })
    expect(salaoDemo("adega").salao).toMatchObject({
      taxaServico: { ativa: true, percentual: 10 },
      couvert: { ativo: false },
      limpeza: true,
    })
    expect(salaoDemo("acougue").salao).toMatchObject({
      taxaServico: { ativa: true },
      couvert: { ativo: false },
      limpeza: true,
    })
    expect(salaoDemo("lanchonete").salao).toMatchObject({
      taxaServico: { ativa: false },
      couvert: { ativo: false },
      limpeza: true,
    })
  })

  test("garçons da demonstração", () => {
    const { garcons } = salaoDemo("pizzaria").salao
    expect(garcons.map((g) => g.nome)).toEqual(["Lucas", "Paula", "Rafa", "Bia"])
    expect(garcons[0]).toEqual({ id: "garcom-lucas", nome: "Lucas", ativo: true })
  })

  test("as três funções Pro vêm ligadas para a demonstração mostrar tudo", () => {
    expect(salaoDemo("pizzaria").salao.funcoes).toEqual({ mapa: true, reservas: true, qr: true })
  })
})
