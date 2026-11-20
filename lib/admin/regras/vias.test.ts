import { describe, expect, test } from "vitest"
import { viasDoPedido } from "./vias"

describe("viasDoPedido", () => {
  test("de fábrica: entrega e retirada saem nas duas vias; mesa só produção; salão só cliente", () => {
    expect(viasDoPedido({}, "entrega")).toEqual(["producao", "cliente"])
    expect(viasDoPedido({}, "retirada")).toEqual(["producao", "cliente"])
    expect(viasDoPedido({}, "mesa")).toEqual(["producao"])
    expect(viasDoPedido({}, "atendimento")).toEqual(["cliente"])
  })

  test("a loja escolhe as vias de cada canal", () => {
    const loja = { viasPorCanal: { entrega: { producao: false, cliente: true } } }
    expect(viasDoPedido(loja, "entrega")).toEqual(["cliente"])
    expect(viasDoPedido(loja, "mesa")).toEqual(["producao"])
  })
})
