import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { clear } from "idb-keyval"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { useSegmentoAtual } from "../segmento-atual"
import { reiniciarServidores } from "./consultas"
import {
  useAlternarProduto,
  useCategorias,
  useCopiarProduto,
  useCriarCategoria,
  useDefinirPreco,
  useExcluirCategoria,
  useProdutos,
  useReordenarCategorias,
} from "./consultas-cardapio"

function envolver() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  )
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
  reiniciarServidores()
  useSegmentoAtual.setState({ ...useSegmentoAtual.getInitialState(), segmento: "lanchonete" }, true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("consultas do cardápio", () => {
  test("esgotar, mudar o preço e copiar aparecem na lista", async () => {
    const { result } = renderHook(
      () => ({
        produtos: useProdutos(),
        alternar: useAlternarProduto(),
        preco: useDefinirPreco(),
        copiar: useCopiarProduto(),
      }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.produtos.data?.length).toBeGreaterThan(0))
    const [primeiro] = result.current.produtos.data ?? []

    await act(() => result.current.alternar.mutateAsync({ id: primeiro.id, campo: "disponivel" }))
    await act(() => result.current.preco.mutateAsync({ id: primeiro.id, preco: 12.34 }))
    await act(() => result.current.copiar.mutateAsync(primeiro.id))

    await waitFor(() => {
      const lista = result.current.produtos.data ?? []
      const atualizado = lista.find((produto) => produto.id === primeiro.id)
      expect(atualizado?.disponivel).toBe(false)
      expect(atualizado?.preco).toBe(12.34)
      expect(lista.some((produto) => produto.nome === `${primeiro.nome} (Cópia)`)).toBe(true)
    })
  })

  test("categorias: criar, reordenar e recusar excluir com produtos", async () => {
    const { result } = renderHook(
      () => ({
        categorias: useCategorias(),
        criar: useCriarCategoria(),
        reordenar: useReordenarCategorias(),
        excluir: useExcluirCategoria(),
      }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.categorias.data?.length).toBeGreaterThan(0))
    const primeira = result.current.categorias.data?.[0]

    const nova = await act(() => result.current.criar.mutateAsync("Promoções"))
    await act(() => result.current.reordenar.mutateAsync({ de: nova.id, para: primeira?.id ?? "" }))
    await waitFor(() => expect(result.current.categorias.data?.[0].nome).toBe("Promoções"))

    await act(async () => {
      await expect(result.current.excluir.mutateAsync(primeira?.id ?? "")).rejects.toThrow(
        "Mova ou exclua os produtos antes.",
      )
    })
  })
})
