import { describe, expect, it } from "vitest"
import type { Pedido } from "../dados/tipos"
import { alternarSelecao, divisaoDoLote, textoDoLote } from "./lote-pedidos"

function pedido(id: number, status: Pedido["status"], tipo: Pedido["tipo"] = "entrega") {
  return { id, numero: 400 + id, status, tipo } as Pedido
}

describe("divisaoDoLote", () => {
  it("separa quem tem próxima etapa de quem não tem", () => {
    const lote = [
      pedido(1, "recebido"),
      pedido(2, "em-preparo"),
      pedido(3, "concluido"),
      pedido(4, "cancelado"),
      pedido(5, "aguardando-pagamento"),
    ]
    const { avancaveis, parados } = divisaoDoLote(lote)
    expect(avancaveis.map((item) => item.id)).toEqual([1, 2])
    expect(parados.map((item) => item.id)).toEqual([3, 4, 5])
  })

  it("mesa pronta não avança: só conclui ao fechar a conta", () => {
    const { avancaveis, parados } = divisaoDoLote([pedido(1, "pronto", "mesa")])
    expect(avancaveis).toHaveLength(0)
    expect(parados).toHaveLength(1)
  })

  it("lote vazio não tem nada para avançar", () => {
    expect(divisaoDoLote([])).toEqual({ avancaveis: [], parados: [] })
  })
})

describe("textoDoLote", () => {
  it("um pedido", () => {
    expect(textoDoLote(1)).toBe("1 pedido selecionado")
  })

  it("vários pedidos", () => {
    expect(textoDoLote(5)).toBe("5 pedidos selecionados")
  })
})

describe("alternarSelecao", () => {
  it("marca o que não estava marcado", () => {
    expect([...alternarSelecao(new Set([1]), 2)]).toEqual([1, 2])
  })

  it("desmarca o que estava marcado", () => {
    expect([...alternarSelecao(new Set([1, 2]), 1)]).toEqual([2])
  })

  it("não altera o conjunto de origem", () => {
    const origem = new Set([1])
    alternarSelecao(origem, 2)
    expect([...origem]).toEqual([1])
  })
})
