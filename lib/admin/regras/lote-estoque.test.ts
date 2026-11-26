import { describe, expect, it } from "vitest"
import type { Produto } from "../dados/tipos"
import {
  ajusteDoMinimo,
  erroDoMinimoEmLote,
  planoDoMinimo,
  textoDoPlanoDoMinimo,
  textoDosProdutos,
} from "./lote-estoque"

function produto(
  id: string,
  estoque: Produto["estoque"],
  unidade: Produto["unidade"] = "un",
): Produto {
  return { id, nome: `Produto ${id}`, unidade, estoque } as Produto
}

const controlado = (id: string, minimo: number, unidade: Produto["unidade"] = "un") =>
  produto(id, { controlar: true, quantidade: 10, minimo, esgotarAoZerar: true }, unidade)
const semControle = (id: string) => produto(id, undefined)
const desligado = (id: string) =>
  produto(id, { controlar: false, quantidade: 0, minimo: 3, esgotarAoZerar: true })

describe("textoDosProdutos", () => {
  it("um produto", () => {
    expect(textoDosProdutos(1)).toBe("1 produto selecionado")
  })

  it("vários produtos", () => {
    expect(textoDosProdutos(4)).toBe("4 produtos selecionados")
  })
})

describe("planoDoMinimo", () => {
  it("só muda o mínimo de quem é controlado e tem outro mínimo", () => {
    const plano = planoDoMinimo(
      [controlado("a", 5), controlado("b", 12), controlado("c", 12), semControle("d")],
      12,
    )
    expect(plano.alterar.map((item) => item.id)).toEqual(["a"])
    expect(plano.iguais.map((item) => item.id)).toEqual(["b", "c"])
    expect(plano.semControle.map((item) => item.id)).toEqual(["d"])
  })

  it("controle desligado conta como sem controle", () => {
    const plano = planoDoMinimo([desligado("x")], 5)
    expect(plano.semControle.map((item) => item.id)).toEqual(["x"])
    expect(plano.alterar).toHaveLength(0)
  })

  it("nada marcado, nada a mudar", () => {
    expect(planoDoMinimo([], 5)).toEqual({ alterar: [], iguais: [], semControle: [] })
  })
})

describe("erroDoMinimoEmLote", () => {
  it("vazio não vale", () => {
    expect(erroDoMinimoEmLote(null, [controlado("a", 1)])).toBe(
      "Informe um mínimo de zero ou mais.",
    )
  })

  it("negativo não vale", () => {
    expect(erroDoMinimoEmLote(-1, [controlado("a", 1)])).toBe("Informe um mínimo de zero ou mais.")
  })

  it("zero vale", () => {
    expect(erroDoMinimoEmLote(0, [controlado("a", 1)])).toBeNull()
  })

  it("quebrado só vale se todos forem vendidos no quilo", () => {
    expect(erroDoMinimoEmLote(1.5, [controlado("a", 1, "kg")])).toBeNull()
    expect(erroDoMinimoEmLote(1.5, [controlado("a", 1, "kg"), controlado("b", 1, "un")])).toBe(
      "Na unidade, o mínimo é inteiro.",
    )
  })

  it("quem está sem controle não pesa na conferência", () => {
    expect(erroDoMinimoEmLote(1.5, [controlado("a", 1, "kg"), semControle("b")])).toBeNull()
  })
})

describe("ajusteDoMinimo", () => {
  it("mantém o controle e o esgotar ao zerar; só troca o mínimo", () => {
    const item = produto("a", {
      controlar: true,
      quantidade: 4,
      minimo: 2,
      esgotarAoZerar: false,
    })
    expect(ajusteDoMinimo(item, 9)).toEqual({
      id: "a",
      controlar: true,
      minimo: 9,
      esgotarAoZerar: false,
    })
  })
})

describe("textoDoPlanoDoMinimo", () => {
  it("diz quantos mudam e o que fica de fora", () => {
    const plano = {
      alterar: [controlado("a", 1), controlado("b", 1)],
      iguais: [controlado("c", 9)],
      semControle: [semControle("d"), semControle("e")],
    }
    expect(textoDoPlanoDoMinimo(plano)).toBe(
      "Muda o mínimo de 2 produtos. 1 já tem esse mínimo e 2 estão sem controle: ficam como estão.",
    )
  })

  it("sem nada de fora, só diz o que muda", () => {
    expect(
      textoDoPlanoDoMinimo({ alterar: [controlado("a", 1)], iguais: [], semControle: [] }),
    ).toBe("Muda o mínimo de 1 produto.")
  })

  it("quando nada muda, avisa", () => {
    expect(
      textoDoPlanoDoMinimo({ alterar: [], iguais: [controlado("a", 9)], semControle: [] }),
    ).toBe("Nenhum produto muda. 1 já tem esse mínimo: fica como está.")
  })
})
