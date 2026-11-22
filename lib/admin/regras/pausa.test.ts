import { describe, expect, test } from "vitest"
import { catalogoDeTeste } from "../dados/catalogo-de-teste"
import type { ConfigLoja } from "../dados/tipos"
import { pausaAtiva, textoDaPausa, textoDaVitrine } from "./pausa"

/** Sexta, 13/11/2026, 20:30. */
const AGORA = new Date(2026, 10, 13, 20, 30)
const LOJA: ConfigLoja = { ...catalogoDeTeste().loja, controleAutomatico: false, aberta: true }
const ate = (hora: number, minuto: number) => new Date(2026, 10, 13, hora, minuto).toISOString()

describe("pausaAtiva", () => {
  test("vale até a hora marcada e depois volta sozinha", () => {
    const pausada = { ...LOJA, pausa: { ate: ate(20, 45), so: "loja" as const } }
    expect(pausaAtiva(pausada, AGORA)).toEqual(pausada.pausa)
    expect(pausaAtiva(pausada, new Date(2026, 10, 13, 20, 45))).toBeUndefined()
    expect(pausaAtiva(LOJA, AGORA)).toBeUndefined()
  })
})

describe("textoDaPausa", () => {
  test("o que está pausado, até quando e quanto falta", () => {
    expect(textoDaPausa({ ate: ate(20, 45), so: "loja" }, AGORA)).toBe(
      "Loja pausada até 20:45 · 15 min",
    )
    expect(textoDaPausa({ ate: ate(21, 0), so: "entrega" }, AGORA)).toBe(
      "Entrega pausada até 21:00 · 30 min",
    )
  })
})

describe("textoDaVitrine", () => {
  test("aberta, ocupada (pausa), só sem entrega ou fechada", () => {
    expect(textoDaVitrine(LOJA, AGORA)).toEqual({ aberta: true, texto: "Aberto agora" })
    expect(textoDaVitrine({ ...LOJA, pausa: { ate: ate(20, 45), so: "loja" } }, AGORA)).toEqual({
      aberta: false,
      texto: "Loja ocupada, volte às 20:45",
    })
    expect(textoDaVitrine({ ...LOJA, pausa: { ate: ate(20, 45), so: "entrega" } }, AGORA)).toEqual({
      aberta: true,
      texto: "Aberto agora · entrega volta às 20:45",
    })
    expect(textoDaVitrine({ ...LOJA, aberta: false }, AGORA)).toEqual({
      aberta: false,
      texto: "Fechado agora",
    })
  })
})
