import { describe, expect, it } from "vitest"
import type { Pedido } from "../dados/tipos"
import {
  divisaoDoLoteAgenda,
  rotuloDoAvancoAgenda,
  textoDoLoteAgenda,
  textoDosParadosAgenda,
} from "./lote-agenda"

function atendimento(id: number, status: Pedido["status"]) {
  return { id, numero: 700 + id, status, tipo: "atendimento" } as Pedido
}

describe("divisaoDoLoteAgenda", () => {
  it("separa quem avança, quem pode ser cancelado e quem já terminou", () => {
    const lote = [
      atendimento(1, "recebido"),
      atendimento(2, "em-preparo"),
      atendimento(3, "concluido"),
      atendimento(4, "cancelado"),
    ]
    const { avancaveis, cancelaveis, parados } = divisaoDoLoteAgenda(lote)
    expect(avancaveis.map((item) => item.id)).toEqual([1, 2])
    expect(cancelaveis.map((item) => item.id)).toEqual([1, 2])
    expect(parados.map((item) => item.id)).toEqual([3, 4])
  })

  it("concluído não avança nem cancela", () => {
    const { avancaveis, cancelaveis } = divisaoDoLoteAgenda([atendimento(1, "concluido")])
    expect(avancaveis).toHaveLength(0)
    expect(cancelaveis).toHaveLength(0)
  })

  it("lote vazio não tem nada a fazer", () => {
    expect(divisaoDoLoteAgenda([])).toEqual({ avancaveis: [], cancelaveis: [], parados: [] })
  })
})

describe("rotuloDoAvancoAgenda", () => {
  it("só agendados: iniciar o atendimento", () => {
    const lote = [atendimento(1, "recebido"), atendimento(2, "recebido")]
    expect(rotuloDoAvancoAgenda(lote)).toBe("Iniciar 2 atendimentos")
  })

  it("só em atendimento: concluir", () => {
    expect(rotuloDoAvancoAgenda([atendimento(1, "em-preparo")])).toBe("Concluir 1 atendimento")
  })

  it("etapas diferentes: avançar", () => {
    const lote = [atendimento(1, "recebido"), atendimento(2, "em-preparo")]
    expect(rotuloDoAvancoAgenda(lote)).toBe("Avançar 2 atendimentos")
  })
})

describe("textoDoLoteAgenda", () => {
  it("um atendimento", () => {
    expect(textoDoLoteAgenda(1)).toBe("1 atendimento selecionado")
  })

  it("vários atendimentos", () => {
    expect(textoDoLoteAgenda(4)).toBe("4 atendimentos selecionados")
  })
})

describe("textoDosParadosAgenda", () => {
  it("um que já terminou", () => {
    expect(textoDosParadosAgenda(1)).toBe("1 já terminou")
  })

  it("vários que já terminaram", () => {
    expect(textoDosParadosAgenda(3)).toBe("3 já terminaram")
  })
})
