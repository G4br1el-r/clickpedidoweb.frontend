import { describe, expect, it } from "vitest"
import { alternarMarca, marcarVarios } from "./selecao"

describe("alternarMarca", () => {
  it("marca o que não estava marcado", () => {
    expect([...alternarMarca(new Set(["a"]), "b")]).toEqual(["a", "b"])
  })

  it("desmarca o que estava marcado", () => {
    expect([...alternarMarca(new Set(["a", "b"]), "a")]).toEqual(["b"])
  })

  it("não altera o conjunto de origem", () => {
    const origem = new Set(["a"])
    alternarMarca(origem, "b")
    expect([...origem]).toEqual(["a"])
  })
})

describe("marcarVarios", () => {
  it("marca todos de uma vez, sem repetir quem já estava", () => {
    expect([...marcarVarios(new Set(["a"]), ["a", "b", "c"], true)]).toEqual(["a", "b", "c"])
  })

  it("desmarca só os que foram pedidos e deixa o resto", () => {
    expect([...marcarVarios(new Set(["a", "b", "z"]), ["a", "b"], false)]).toEqual(["z"])
  })

  it("não altera o conjunto de origem", () => {
    const origem = new Set(["a"])
    marcarVarios(origem, ["b"], true)
    expect([...origem]).toEqual(["a"])
  })
})
