import { describe, expect, test } from "vitest"
import type { ItemPedido, Mesa, Pedido } from "../dados/tipos"
import { estadoDaMesa } from "./mesas"

const mesa = (status: Mesa["status"]) => ({ status }) as Mesa
const comanda = (status: Pedido["status"], itens: Partial<ItemPedido>[] = []) =>
  ({ status, tipo: "mesa", enviarParaCozinha: true, itens }) as Pedido

const pronta = {
  id: "a",
  rodada: 1,
  iniciadoEm: "2026-11-13T20:00:00.000Z",
  feitoEm: "2026-11-13T20:10:00.000Z",
}

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
    const servida = { ...pronta, servidoEm: "2026-11-13T20:12:00.000Z" }
    expect(estadoDaMesa(mesa("ocupada"), comanda("pronto", [servida])).rotulo).toBe("Ocupada")
    expect(estadoDaMesa(mesa("ocupada"), undefined).rotulo).toBe("Ocupada")
  })

  test("rodada pronta e não servida vem antes de tudo: é o que o garçom tem a fazer", () => {
    expect(estadoDaMesa(mesa("ocupada"), comanda("pronto", [pronta]))).toEqual({
      rotulo: "Pronto para servir",
      tom: "pronto",
    })
    const novaRodada = { id: "b", rodada: 2 }
    expect(estadoDaMesa(mesa("ocupada"), comanda("recebido", [pronta, novaRodada])).rotulo).toBe(
      "Pronto para servir",
    )
  })
})
