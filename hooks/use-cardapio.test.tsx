import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, test } from "vitest"
import { useLojaAtual } from "@/lib/loja-atual"
import { useCardapio } from "./use-cardapio"

function envolver({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

beforeEach(() => {
  useLojaAtual.setState(useLojaAtual.getInitialState(), true)
})

describe("useCardapio", () => {
  test("espera ler a loja salva antes de buscar, para não mostrar a loja errada", async () => {
    const { result } = renderHook(() => useCardapio(), { wrapper: envolver })
    await new Promise((resolver) => setTimeout(resolver, 600))
    expect(result.current.data).toBeUndefined()
  })

  test("traz o cardápio da loja escolhida", async () => {
    useLojaAtual.setState({ id: "drogaria-bem-estar", hidratada: true })
    const { result } = renderHook(() => useCardapio(), { wrapper: envolver })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.map((categoria) => categoria.nome)).toContain("Antibióticos")
  })
})
