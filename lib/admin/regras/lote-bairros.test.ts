import { describe, expect, it } from "vitest"
import type { Bairro } from "../dados/tipos"
import { efeitoDoLoteBairros, idsDoLote, textoDoLoteBairros } from "./lote-bairros"

function bairro(id: string, ativo: boolean, taxa = 6): Bairro {
  return { id, cidade: "Lorena", nome: `Bairro ${id}`, taxa, ativo }
}

describe("idsDoLote", () => {
  it("só conta o que está marcado e continua na lista visível", () => {
    const visiveis = [bairro("a", true), bairro("b", true)]
    const selecao = { a: true, b: false, c: true }
    // "c" foi marcado, mas o filtro o escondeu: ele não entra no lote.
    expect(idsDoLote(selecao, visiveis)).toEqual(["a"])
  })

  it("sem marcação, o lote é vazio", () => {
    expect(idsDoLote({}, [bairro("a", true)])).toEqual([])
  })
})

describe("efeitoDoLoteBairros", () => {
  const todos = [bairro("a", true), bairro("b", false), bairro("c", false), bairro("d", true)]

  it("separa quem seria ativado de quem seria desativado", () => {
    expect(efeitoDoLoteBairros(todos, ["a", "b", "c"])).toEqual({
      aAtivar: ["b", "c"],
      aDesativar: ["a"],
    })
  })

  it("ignora o id que não está na lista", () => {
    expect(efeitoDoLoteBairros(todos, ["x", "b"])).toEqual({ aAtivar: ["b"], aDesativar: [] })
  })

  it("lote vazio não muda nada", () => {
    expect(efeitoDoLoteBairros(todos, [])).toEqual({ aAtivar: [], aDesativar: [] })
  })
})

describe("textoDoLoteBairros", () => {
  it("um bairro", () => {
    expect(textoDoLoteBairros(1)).toBe("1 bairro selecionado")
  })

  it("vários bairros", () => {
    expect(textoDoLoteBairros(3)).toBe("3 bairros selecionados")
  })
})
