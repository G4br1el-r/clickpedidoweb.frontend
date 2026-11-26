import { describe, expect, test } from "vitest"
import { movimentoDoBicho } from "./bicho-velocidade"

describe("movimentoDoBicho", () => {
  test("a tartaruga escolhida anda devagar, em laço, e cresce 20%", () => {
    expect(
      movimentoDoBicho({ bicho: "tartaruga", ativo: true, fracao: 0.1, reduzido: false }),
    ).toEqual({
      animate: { x: [0, 2.5, 0, -1, 0], rotate: [0, -5, 0, 3, 0], scale: 1.2 },
      transition: { duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
    })
  })

  test("o coelho escolhido dá pulinhos com pausa entre eles", () => {
    expect(
      movimentoDoBicho({ bicho: "coelho", ativo: true, fracao: 0.9, reduzido: false }),
    ).toEqual({
      animate: { y: [0, -7, 0, -3, 0], rotate: [0, -8, 0, -4, 0], scale: 1.2 },
      transition: {
        duration: 0.55,
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: 0.35,
        ease: "easeOut",
      },
    })
  })

  test("o bicho que não foi escolhido fica parado e encolhe um pouco conforme o outro lado", () => {
    expect(
      movimentoDoBicho({ bicho: "tartaruga", ativo: false, fracao: 0.5, reduzido: false }),
    ).toEqual({
      animate: { x: 0, rotate: 0, scale: 0.925 },
      transition: { duration: 0.3 },
    })
    expect(
      movimentoDoBicho({ bicho: "coelho", ativo: false, fracao: 0.5, reduzido: false }),
    ).toEqual({
      animate: { y: 0, rotate: 0, scale: 0.925 },
      transition: { duration: 0.3 },
    })
  })

  test("com movimento reduzido, não há laço nem deslocamento: só o tamanho muda", () => {
    for (const bicho of ["tartaruga", "coelho"] as const) {
      const ativo = movimentoDoBicho({ bicho, ativo: true, fracao: 0.5, reduzido: true })
      expect(ativo.transition).toEqual({ duration: 0 })
      expect(ativo.animate).toEqual({ x: 0, y: 0, rotate: 0, scale: 1.2 })
      const parado = movimentoDoBicho({ bicho, ativo: false, fracao: 0.5, reduzido: true })
      expect(parado.animate).toEqual({ x: 0, y: 0, rotate: 0, scale: 0.925 })
    }
  })
})
