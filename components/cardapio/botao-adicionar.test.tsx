import { act, renderHook } from "@testing-library/react"
import type { StaticImageData } from "next/image"
import { beforeEach, describe, expect, test } from "vitest"
import { useSacola } from "@/lib/sacola"
import { useQuantidadeNaSacola } from "./botao-adicionar"

const IMAGEM = { src: "/pizza.jpg", width: 1, height: 1 } as StaticImageData

function adicionar(produtoId: string, quantidade: number, resumo: string[] = []) {
  useSacola.getState().adicionar({
    produtoId,
    nome: produtoId,
    imagem: IMAGEM,
    precoUnitario: 40,
    quantidade,
    resumo,
  })
}

beforeEach(() => {
  useSacola.setState(useSacola.getInitialState(), true)
})

describe("useQuantidadeNaSacola", () => {
  test("antes de ler a sacola salva, mostra zero", () => {
    adicionar("calabresa", 2)
    const { result } = renderHook(() => useQuantidadeNaSacola("calabresa"))

    expect(result.current).toBe(0)
  })

  test("soma todas as montagens do mesmo produto e ignora os outros", () => {
    useSacola.setState({ hidratada: true })
    adicionar("calabresa", 2)
    adicionar("calabresa", 1, ["Borda catupiry"])
    adicionar("mussarela", 5)
    const { result } = renderHook(() => useQuantidadeNaSacola("calabresa"))

    expect(result.current).toBe(3)
  })

  test("acompanha a sacola quando um item entra", () => {
    useSacola.setState({ hidratada: true })
    const { result } = renderHook(() => useQuantidadeNaSacola("calabresa"))
    expect(result.current).toBe(0)

    act(() => adicionar("calabresa", 1))

    expect(result.current).toBe(1)
  })
})
