import { describe, expect, test } from "vitest"
import { GRADE_MAPA, tamanhoDaMesa } from "./salao"

describe("tamanhoDaMesa", () => {
  test("tamanho no mapa: quadrada e redonda 2 × 2, retangular 3 × 2, retangular grande 4 × 2", () => {
    expect(tamanhoDaMesa({ forma: "quadrada", lugares: 4 })).toEqual({ largura: 2, altura: 2 })
    expect(tamanhoDaMesa({ forma: "redonda", lugares: 2 })).toEqual({ largura: 2, altura: 2 })
    expect(tamanhoDaMesa({ forma: "retangular", lugares: 6 })).toEqual({ largura: 3, altura: 2 })
    expect(tamanhoDaMesa({ forma: "retangular", lugares: 8 })).toEqual({ largura: 4, altura: 2 })
  })

  test("a grade do mapa tem 24 colunas e 16 linhas", () => {
    expect(GRADE_MAPA).toEqual({ colunas: 24, linhas: 16 })
  })
})
