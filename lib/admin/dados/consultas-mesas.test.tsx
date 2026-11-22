import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { clear } from "idb-keyval"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { useSegmentoAtual } from "../segmento-atual"
import { reiniciarServidores, servidorDo, usePedido } from "./consultas"
import {
  useAlterarQuantidade,
  useConfigSalao,
  useLancarNaMesa,
  useMesas,
  useSalvarConfigSalao,
} from "./consultas-mesas"

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

describe("consultas das mesas", () => {
  test("salvar a configuração do salão atualiza a configuração e as mesas", async () => {
    const api = servidorDo("pizzaria")
    const inicial = await api.salao.config()
    const { result } = renderHook(
      () => ({ config: useConfigSalao(), mesas: useMesas(), salvar: useSalvarConfigSalao() }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.config.data?.limpeza).toBe(inicial.limpeza))
    await waitFor(() => expect(result.current.mesas.data).toBeDefined())
    const mesasAntes = result.current.mesas.dataUpdatedAt

    vi.setSystemTime(new Date(2026, 10, 13, 20, 31))
    await act(() => result.current.salvar.mutateAsync({ ...inicial, limpeza: !inicial.limpeza }))
    await waitFor(() => expect(result.current.config.data?.limpeza).toBe(!inicial.limpeza))
    await waitFor(() => expect(result.current.mesas.dataUpdatedAt).toBeGreaterThan(mesasAntes))
  })

  test("lançar na mesa traz a comanda nova para quem a tem aberta", async () => {
    const api = servidorDo("pizzaria")
    const mesa = await api.mesas.criar({ numero: 81 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    const { result } = renderHook(
      () => ({ comanda: usePedido(comanda.id), lancar: useLancarNaMesa() }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.comanda.data?.total).toBe(4))

    await act(() =>
      result.current.lancar.mutateAsync({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [{ avulso: { nome: "Suco", preco: 9.5 }, quantidade: 1 }],
      }),
    )
    await waitFor(() => expect(result.current.comanda.data?.total).toBe(13.5))
  })

  test("a quantidade muda na hora e volta se o servidor recusar", async () => {
    const api = servidorDo("pizzaria")
    const mesa = await api.mesas.criar({ numero: 80 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    const [agua] = comanda.itens

    const { result } = renderHook(
      () => ({ comanda: usePedido(comanda.id), alterar: useAlterarQuantidade() }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.comanda.data?.total).toBe(4))

    act(() =>
      result.current.alterar.mutate({ pedidoId: comanda.id, itemId: agua.id, quantidade: 3 }),
    )
    await waitFor(() => expect(result.current.comanda.data?.total).toBe(12))

    // 1000 passa do máximo: a tela volta para o que o servidor tem.
    act(() =>
      result.current.alterar.mutate({ pedidoId: comanda.id, itemId: agua.id, quantidade: 1000 }),
    )
    await waitFor(() => expect(result.current.alterar.isError).toBe(true))
    expect(result.current.comanda.data?.itens[0].quantidade).toBe(3)
    expect(result.current.comanda.data?.total).toBe(12)
  })
})
