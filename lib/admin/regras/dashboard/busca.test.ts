import { describe, expect, test } from "vitest"
import { periodoDaBusca } from "./busca"

/** Sexta, 13/11/2026, 20:30. */
const AGORA = new Date(2026, 10, 13, 20, 30)

describe("periodoDaBusca", () => {
  test("no período de hoje, ainda busca desde o início do mês, que cobre a sexta passada", () => {
    const hoje = { de: new Date(2026, 10, 13), ate: new Date(2026, 10, 13) }
    expect(periodoDaBusca(hoje, AGORA)).toEqual({
      de: new Date(2026, 10, 1),
      ate: new Date(2026, 10, 13),
    })
  })

  test("no começo do mês, a semana passada vem do mês anterior", () => {
    const terca = new Date(2026, 11, 1, 10)
    const hoje = { de: new Date(2026, 11, 1), ate: new Date(2026, 11, 1) }
    expect(periodoDaBusca(hoje, terca).de).toEqual(new Date(2026, 10, 24))
  })

  test("num período longo, começa no período anterior a ele", () => {
    const trintaDias = { de: new Date(2026, 9, 15), ate: new Date(2026, 10, 13) }
    expect(periodoDaBusca(trintaDias, AGORA).de).toEqual(new Date(2026, 8, 15))
  })
})
