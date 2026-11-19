import { describe, expect, test } from "vitest"
import type { Mesa } from "../dados/tipos"
import { GRADE_MAPA, primeiraPosicaoLivre, tamanhoDaMesa } from "./salao"

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

describe("primeiraPosicaoLivre", () => {
  const mesaEm = (areaId: string, x: number, y: number): Mesa =>
    ({ areaId, forma: "quadrada", lugares: 4, posicao: { x, y } }) as Mesa

  test("varre linha a linha, da esquerda para a direita, sem sobrepor", () => {
    const ocupada = mesaEm("a", 0, 0)
    expect(primeiraPosicaoLivre([ocupada], "a", { forma: "quadrada", lugares: 4 })).toEqual({
      x: 2,
      y: 0,
    })
    expect(primeiraPosicaoLivre([ocupada], "b", { forma: "quadrada", lugares: 4 })).toEqual({
      x: 0,
      y: 0,
    })
  })

  test("não passa da borda direita: a retangular que não cabe na sobra vai para a linha de baixo", () => {
    // 11 quadradas ocupam x de 0 a 21 na linha 0; sobram as colunas 22 e 23
    const fila = Array.from({ length: 11 }, (_, i) => mesaEm("a", i * 2, 0))
    expect(primeiraPosicaoLivre(fila, "a", { forma: "quadrada", lugares: 4 })).toEqual({
      x: 22,
      y: 0,
    })
    expect(primeiraPosicaoLivre(fila, "a", { forma: "retangular", lugares: 6 })).toEqual({
      x: 0,
      y: 2,
    })
  })

  test("área cheia não tem posição", () => {
    // 96 mesas 2 × 2 enchem 24 × 16
    const cheia = Array.from({ length: 96 }, (_, i) =>
      mesaEm("a", (i % 12) * 2, Math.floor(i / 12) * 2),
    )
    expect(primeiraPosicaoLivre(cheia, "a", { forma: "quadrada", lugares: 4 })).toBeNull()
    expect(primeiraPosicaoLivre(cheia, "b", { forma: "quadrada", lugares: 4 })).toEqual({
      x: 0,
      y: 0,
    })
  })
})
