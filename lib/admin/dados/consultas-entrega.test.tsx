import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { clear } from "idb-keyval"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { useSegmentoAtual } from "../segmento-atual"
import { reiniciarServidores, useLoja } from "./consultas"
import { useConectarPagamento, useSalvarLoja, useSalvarMotoboy } from "./consultas-entrega"

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
  useSegmentoAtual.setState(useSegmentoAtual.getInitialState(), true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("consultas dos cadastros", () => {
  test("salvar a loja e desconectar a conta online aparecem na configuração", async () => {
    const { result } = renderHook(
      () => ({ loja: useLoja(), salvar: useSalvarLoja(), conectar: useConectarPagamento() }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.loja.data?.nome).toBe("Casa da Pizza"))
    const loja = result.current.loja.data
    if (!loja) throw new Error("A loja devia ter carregado")

    await act(() => result.current.salvar.mutateAsync({ ...loja, nome: "Pizza da Esquina" }))
    await waitFor(() => expect(result.current.loja.data?.nome).toBe("Pizza da Esquina"))

    await act(() => result.current.conectar.mutateAsync(false))
    await waitFor(() =>
      expect(result.current.loja.data).toMatchObject({
        pagamentoOnlineConectado: false,
        pagamentos: { pix: false, "cartao-online": false },
      }),
    )
  })

  test("salvar um motoboy não troca a configuração da loja", async () => {
    const { result } = renderHook(() => ({ loja: useLoja(), salvar: useSalvarMotoboy() }), {
      wrapper: envolver(),
    })
    await waitFor(() => expect(result.current.loja.data?.nome).toBe("Casa da Pizza"))

    await act(() =>
      result.current.salvar.mutateAsync({ nome: "Davi", telefone: "12992220000", ativo: true }),
    )
    await waitFor(() => expect(result.current.salvar.isSuccess).toBe(true))
    expect(result.current.loja.data?.nome).toBe("Casa da Pizza")
  })
})
