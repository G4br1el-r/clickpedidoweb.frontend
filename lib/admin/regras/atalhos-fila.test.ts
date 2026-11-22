import { describe, expect, test } from "vitest"
import { acaoDaTecla, vizinho } from "./atalhos-fila"

/** Colunas da fila pelos ids dos cartões, da esquerda para a direita. */
const COLUNAS = [[1, 2, 3], [], [4], [5, 6]]

describe("vizinho", () => {
  test("sem cartão em foco, qualquer seta vai para o primeiro", () => {
    expect(vizinho(COLUNAS, null, "ArrowDown")).toBe(1)
  })

  test("para cima e para baixo na coluna, parando nas pontas", () => {
    expect(vizinho(COLUNAS, 1, "ArrowDown")).toBe(2)
    expect(vizinho(COLUNAS, 3, "ArrowDown")).toBe(3)
    expect(vizinho(COLUNAS, 2, "ArrowUp")).toBe(1)
    expect(vizinho(COLUNAS, 1, "ArrowUp")).toBe(1)
  })

  test("para os lados pula coluna vazia e mantém a altura que dá", () => {
    expect(vizinho(COLUNAS, 3, "ArrowRight")).toBe(4)
    expect(vizinho(COLUNAS, 4, "ArrowRight")).toBe(5)
    expect(vizinho(COLUNAS, 6, "ArrowLeft")).toBe(4)
    expect(vizinho(COLUNAS, 4, "ArrowLeft")).toBe(1)
    expect(vizinho(COLUNAS, 1, "ArrowLeft")).toBe(1)
  })
})

describe("acaoDaTecla", () => {
  test("Enter avança, A aceita, R recusa, P imprime, / busca e ? abre a ajuda", () => {
    expect(acaoDaTecla("Enter")).toBe("avancar")
    expect(acaoDaTecla("a")).toBe("aceitar")
    expect(acaoDaTecla("R")).toBe("recusar")
    expect(acaoDaTecla("p")).toBe("imprimir")
    expect(acaoDaTecla("/")).toBe("buscar")
    expect(acaoDaTecla("?")).toBe("ajuda")
    expect(acaoDaTecla("ArrowUp")).toBe("mover")
    expect(acaoDaTecla("x")).toBeNull()
  })
})
