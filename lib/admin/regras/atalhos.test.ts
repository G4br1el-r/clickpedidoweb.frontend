import { describe, expect, test } from "vitest"
import { vizinhoNoQuadro } from "./atalhos"

/** A fazer com a e b; Preparando vazia; Prontos com c, d e e. */
const GRADE = [["a", "b"], [], ["c", "d", "e"]]

describe("vizinhoNoQuadro", () => {
  test("sem ticket em foco, qualquer seta vai para o primeiro do quadro", () => {
    expect(vizinhoNoQuadro(GRADE, null, "baixo")).toBe("a")
    expect(vizinhoNoQuadro([[], ["x"]], null, "direita")).toBe("x")
  })

  test("para cima e para baixo anda na coluna e para nas pontas", () => {
    expect(vizinhoNoQuadro(GRADE, "c", "baixo")).toBe("d")
    expect(vizinhoNoQuadro(GRADE, "e", "baixo")).toBe("e")
    expect(vizinhoNoQuadro(GRADE, "d", "cima")).toBe("c")
    expect(vizinhoNoQuadro(GRADE, "a", "cima")).toBe("a")
  })

  test("para os lados pula a coluna vazia, na mesma altura ou no último da coluna", () => {
    expect(vizinhoNoQuadro(GRADE, "b", "direita")).toBe("d")
    expect(vizinhoNoQuadro(GRADE, "e", "esquerda")).toBe("b")
    // Nas pontas do quadro, fica onde está.
    expect(vizinhoNoQuadro(GRADE, "a", "esquerda")).toBe("a")
    expect(vizinhoNoQuadro(GRADE, "c", "direita")).toBe("c")
  })

  test("o ticket que saiu do quadro volta para o primeiro", () => {
    expect(vizinhoNoQuadro(GRADE, "sumiu", "cima")).toBe("a")
  })
})
