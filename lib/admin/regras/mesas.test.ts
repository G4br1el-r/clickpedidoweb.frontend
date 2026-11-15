import { describe, expect, test } from "vitest"
import type { Mesa, Pedido } from "../dados/tipos"
import { estadoDaMesa } from "./mesas"

const mesa = (status: Mesa["status"]) => ({ status }) as Mesa
const comanda = (status: Pedido["status"]) => ({ status }) as Pedido

describe("estadoDaMesa", () => {
  test("mesa sem gente está livre e fica apagada", () => {
    expect(estadoDaMesa(mesa("livre"), undefined)).toEqual({ rotulo: "Livre", tom: "fim" })
  })

  test("com rodada nova ou em preparo, a mesa está esperando a cozinha", () => {
    expect(estadoDaMesa(mesa("ocupada"), comanda("recebido"))).toEqual({
      rotulo: "Na cozinha",
      tom: "preparo",
    })
    expect(estadoDaMesa(mesa("ocupada"), comanda("em-preparo")).rotulo).toBe("Na cozinha")
  })

  test("ocupada com tudo servido, ou sem comanda ainda, é só ocupada", () => {
    expect(estadoDaMesa(mesa("ocupada"), comanda("pronto"))).toEqual({
      rotulo: "Ocupada",
      tom: "caminho",
    })
    expect(estadoDaMesa(mesa("ocupada"), undefined).rotulo).toBe("Ocupada")
  })
})
