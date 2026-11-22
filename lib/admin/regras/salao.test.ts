import { describe, expect, test } from "vitest"
import type { Mesa } from "../dados/tipos"
import {
  arrastar,
  colide,
  descreverPosicao,
  GRADE_MAPA,
  type MesaNoMapa,
  mesasSeCruzam,
  moverPorTeclado,
  posicaoValida,
  primeiraPosicaoLivre,
  tamanhoDaMesa,
} from "./salao"

describe("tamanhoDaMesa", () => {
  test("tamanho no mapa: quadrada e redonda 2 × 2, retangular 3 × 2, retangular grande 4 × 2", () => {
    expect(tamanhoDaMesa({ forma: "quadrada", lugares: 4 })).toEqual({ largura: 2, altura: 2 })
    expect(tamanhoDaMesa({ forma: "redonda", lugares: 2 })).toEqual({ largura: 2, altura: 2 })
    expect(tamanhoDaMesa({ forma: "retangular", lugares: 6 })).toEqual({ largura: 3, altura: 2 })
    expect(tamanhoDaMesa({ forma: "retangular", lugares: 7 })).toEqual({ largura: 4, altura: 2 })
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

describe("mesasSeCruzam", () => {
  const quadrada = (x: number, y: number) => ({
    forma: "quadrada" as const,
    lugares: 4,
    posicao: { x, y },
  })

  test("cruzam quando os retângulos se sobrepõem", () => {
    expect(mesasSeCruzam(quadrada(0, 0), quadrada(1, 1))).toBe(true)
    expect(mesasSeCruzam(quadrada(0, 0), quadrada(0, 0))).toBe(true)
  })

  test("encostar na borda não cruza", () => {
    expect(mesasSeCruzam(quadrada(0, 0), quadrada(2, 0))).toBe(false)
    expect(mesasSeCruzam(quadrada(0, 0), quadrada(0, 2))).toBe(false)
  })

  test("usa o tamanho de cada forma: retangular grande 4 × 2 cruza onde a quadrada não cruzaria", () => {
    const grande = { forma: "retangular" as const, lugares: 8, posicao: { x: 0, y: 0 } }
    expect(mesasSeCruzam(grande, quadrada(3, 0))).toBe(true)
    expect(mesasSeCruzam(grande, quadrada(4, 0))).toBe(false)
  })
})

const noMapa = (id: string, x: number, y: number, extra: Partial<MesaNoMapa> = {}): MesaNoMapa => ({
  id,
  areaId: "salao",
  forma: "quadrada",
  lugares: 4,
  posicao: { x, y },
  ...extra,
})

describe("colide", () => {
  test("a quadrada em (1, 1) colide com a de (2, 2) da mesma área", () => {
    expect(colide(noMapa("a", 1, 1), [noMapa("b", 2, 2)])).toBe(true)
  })

  test("encostar não colide", () => {
    expect(colide(noMapa("a", 1, 1), [noMapa("b", 3, 1)])).toBe(false)
  })

  test("a própria mesa (mesmo id) não conta", () => {
    expect(colide(noMapa("a", 1, 1), [noMapa("a", 1, 1)])).toBe(false)
  })

  test("a mesa de outra área no mesmo lugar não colide", () => {
    expect(colide(noMapa("a", 1, 1), [noMapa("b", 1, 1, { areaId: "varanda" })])).toBe(false)
  })

  test("a retangular de 8 lugares em (0, 0) colide com a quadrada em (3, 0)", () => {
    const grande = noMapa("a", 0, 0, { forma: "retangular", lugares: 8 })
    expect(colide(grande, [noMapa("b", 3, 0)])).toBe(true)
  })
})

describe("posicaoValida", () => {
  test("a quadrada vale até o canto de baixo à direita, (22, 14)", () => {
    expect(posicaoValida(noMapa("a", 22, 14), [])).toBe(true)
  })

  test("não passa da coluna 24 nem da linha 16", () => {
    expect(posicaoValida(noMapa("a", 23, 0), [])).toBe(false)
    expect(posicaoValida(noMapa("a", 0, 15), [])).toBe(false)
  })

  test("coordenada negativa ou quebrada não vale", () => {
    expect(posicaoValida(noMapa("a", -1, 0), [])).toBe(false)
    expect(posicaoValida(noMapa("a", 0, -1), [])).toBe(false)
    expect(posicaoValida(noMapa("a", 1.5, 0), [])).toBe(false)
    expect(posicaoValida(noMapa("a", 0, 2.5), [])).toBe(false)
  })

  test("a retangular de 8 lugares (4 × 2) vale em (20, 0) e não em (21, 0)", () => {
    const grande = { forma: "retangular" as const, lugares: 8 }
    expect(posicaoValida(noMapa("a", 20, 0, grande), [])).toBe(true)
    expect(posicaoValida(noMapa("a", 21, 0, grande), [])).toBe(false)
  })

  test("colidindo com outra mesa não vale", () => {
    expect(posicaoValida(noMapa("a", 1, 1), [noMapa("b", 2, 2)])).toBe(false)
  })
})

describe("moverPorTeclado", () => {
  const quadradaEm = (x: number, y: number) => ({
    forma: "quadrada" as const,
    lugares: 4,
    posicao: { x, y },
  })

  test("anda 1 ou 4 células na direção da seta", () => {
    expect(moverPorTeclado(quadradaEm(5, 5), "direita", 1)).toEqual({ x: 6, y: 5 })
    expect(moverPorTeclado(quadradaEm(5, 5), "esquerda", 4)).toEqual({ x: 1, y: 5 })
    expect(moverPorTeclado(quadradaEm(5, 5), "cima", 1)).toEqual({ x: 5, y: 4 })
    expect(moverPorTeclado(quadradaEm(5, 5), "baixo", 4)).toEqual({ x: 5, y: 9 })
  })

  test("para na borda do mapa", () => {
    expect(moverPorTeclado(quadradaEm(1, 5), "esquerda", 4)).toEqual({ x: 0, y: 5 })
    expect(moverPorTeclado(quadradaEm(5, 2), "cima", 4)).toEqual({ x: 5, y: 0 })
    expect(moverPorTeclado(quadradaEm(21, 13), "direita", 4)).toEqual({ x: 22, y: 13 })
    expect(moverPorTeclado(quadradaEm(21, 13), "baixo", 4)).toEqual({ x: 21, y: 14 })
  })

  test("a borda conta o tamanho da mesa: a retangular de 8 em (19, 0) para em (20, 0)", () => {
    const grande = { forma: "retangular" as const, lugares: 8, posicao: { x: 19, y: 0 } }
    expect(moverPorTeclado(grande, "direita", 4)).toEqual({ x: 20, y: 0 })
  })
})

describe("arrastar", () => {
  const em55 = { forma: "quadrada" as const, lugares: 4, posicao: { x: 5, y: 5 } }
  const celula = { largura: 40, altura: 30 }

  test("o deslocamento em pixels encaixa na célula mais próxima", () => {
    expect(arrastar(em55, { x: 41, y: -29 }, celula)).toEqual({ x: 6, y: 4 })
    expect(arrastar(em55, { x: 19, y: 14 }, celula)).toEqual({ x: 5, y: 5 })
    expect(arrastar(em55, { x: 21, y: 16 }, celula)).toEqual({ x: 6, y: 6 })
  })

  test("para na borda do mapa", () => {
    expect(arrastar(em55, { x: -400, y: 1000 }, celula)).toEqual({ x: 0, y: 14 })
  })
})

describe("descreverPosicao", () => {
  test("conta coluna e linha a partir de 1, como a pessoa conta", () => {
    expect(descreverPosicao({ x: 2, y: 1 })).toBe("coluna 3, linha 2")
  })
})
