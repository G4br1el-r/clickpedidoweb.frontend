import { describe, expect, test } from "vitest"
import { retornoDeErro, variantesDoPasso } from "./movimento"

type Quadro = { opacity?: number; x?: number; filter?: string; transition?: { duration?: number } }

const quadro = (valor: unknown, direcao: number) =>
  (typeof valor === "function" ? valor(direcao) : valor) as Quadro

describe("variantesDoPasso", () => {
  const { entrar, parado, sair } = variantesDoPasso(false)

  test("avançar: o passo novo entra da direita e o antigo sai pela esquerda", () => {
    expect(quadro(entrar, 1).x).toBe(24)
    expect(quadro(sair, 1).x).toBe(-24)
  })

  test("voltar: o passo novo entra da esquerda e o antigo sai pela direita", () => {
    expect(quadro(entrar, -1).x).toBe(-24)
    expect(quadro(sair, -1).x).toBe(24)
  })

  test("é um crossfade: entra e sai transparente, para opaco e no lugar", () => {
    expect(quadro(entrar, 1).opacity).toBe(0)
    expect(quadro(sair, 1).opacity).toBe(0)
    expect(quadro(parado, 1)).toMatchObject({ opacity: 1, x: 0 })
  })

  test("a saída é mais rápida que a entrada", () => {
    const entrada = quadro(parado, 1).transition?.duration ?? 0
    const saida = quadro(sair, 1).transition?.duration ?? 0
    expect(saida).toBeLessThan(entrada)
    expect(entrada).toBeLessThanOrEqual(0.3)
  })

  test("com movimento reduzido, só a opacidade muda", () => {
    const reduzido = variantesDoPasso(true)
    for (const direcao of [1, -1]) {
      expect(quadro(reduzido.entrar, direcao)).toEqual({ opacity: 0 })
      expect(quadro(reduzido.sair, direcao)).toMatchObject({ opacity: 0 })
      expect(quadro(reduzido.sair, direcao).x).toBeUndefined()
      expect(quadro(reduzido.parado, direcao).x).toBeUndefined()
    }
  })
})

describe("retornoDeErro", () => {
  test("é um empurrão curto, de poucos pixels", () => {
    const { x, transition } = retornoDeErro(false) as {
      x: number[]
      transition: { duration: number }
    }
    expect(Math.max(...x.map(Math.abs))).toBeLessThanOrEqual(4)
    expect(transition.duration).toBeLessThanOrEqual(0.3)
  })

  test("com movimento reduzido, não desloca nada", () => {
    expect(retornoDeErro(true)).not.toHaveProperty("x")
  })
})
