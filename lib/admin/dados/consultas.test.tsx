import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { clear } from "idb-keyval"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { useSegmentoAtual } from "../segmento-atual"
import {
  reiniciarServidores,
  servidorDo,
  useAtribuirMotoboy,
  useAvancarPedido,
  useCancelarPedido,
  useDefinirAberta,
  useDefinirEntrega,
  useFila,
  useLoja,
  useMarcarPago,
  useMotoboys,
  usePedido,
  usePedidos,
  useSimularPedido,
} from "./consultas"

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

describe("consultas do painel", () => {
  test("trocar o segmento traz a loja do outro segmento", async () => {
    const { result } = renderHook(() => useLoja(), { wrapper: envolver() })
    await waitFor(() => expect(result.current.data?.nome).toBe("Casa da Pizza"))

    act(() => useSegmentoAtual.getState().escolher("salao"))
    await waitFor(() => expect(result.current.data?.nome).toBe("Empório das Deusas"))
  })

  test("avançar um pedido atualiza a lista sem recarregar a página", async () => {
    const { result } = renderHook(() => ({ pedidos: usePedidos(), avancar: useAvancarPedido() }), {
      wrapper: envolver(),
    })
    await waitFor(() => expect(result.current.pedidos.data?.length).toBeGreaterThan(0))
    const novo = result.current.pedidos.data?.find((pedido) => pedido.status === "recebido")
    expect(novo).toBeDefined()

    await act(() => result.current.avancar.mutateAsync({ id: novo?.id ?? 0, de: "recebido" }))

    await waitFor(() =>
      expect(result.current.pedidos.data?.find((pedido) => pedido.id === novo?.id)?.status).toBe(
        "em-preparo",
      ),
    )
  })

  test("avançar a partir de uma etapa que já passou é recusado e a lista não pula etapa", async () => {
    const { result } = renderHook(() => ({ pedidos: usePedidos(), avancar: useAvancarPedido() }), {
      wrapper: envolver(),
    })
    await waitFor(() => expect(result.current.pedidos.data?.length).toBeGreaterThan(0))
    const novo = result.current.pedidos.data?.find((pedido) => pedido.status === "recebido")
    const id = novo?.id ?? 0
    // Outra aba já avançou o pedido.
    await servidorDo("pizzaria").pedidos.avancar(id, "recebido")

    await act(async () => {
      await expect(result.current.avancar.mutateAsync({ id, de: "recebido" })).rejects.toThrow(
        "Este pedido já mudou de etapa. Atualize a tela.",
      )
    })
    await waitFor(() =>
      expect(result.current.pedidos.data?.find((pedido) => pedido.id === id)?.status).toBe(
        "em-preparo",
      ),
    )
  })

  test("marcar como pago e cancelar aparecem na lista", async () => {
    const { result } = renderHook(
      () => ({ pedidos: usePedidos(), pagar: useMarcarPago(), cancelar: useCancelarPedido() }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.pedidos.data?.length).toBeGreaterThan(0))
    const naEntrega = result.current.pedidos.data?.find(
      (pedido) => pedido.status === "recebido" && pedido.situacaoPagamento === "na-entrega",
    )
    const id = naEntrega?.id ?? 0

    await act(() => result.current.pagar.mutateAsync(id))
    await waitFor(() =>
      expect(
        result.current.pedidos.data?.find((pedido) => pedido.id === id)?.situacaoPagamento,
      ).toBe("pago"),
    )

    await act(() => result.current.cancelar.mutateAsync({ id, de: "recebido" }))
    await waitFor(() =>
      expect(result.current.pedidos.data?.find((pedido) => pedido.id === id)?.status).toBe(
        "cancelado",
      ),
    )
  })

  test("escolher o motoboy aparece na lista", async () => {
    const { result } = renderHook(
      () => ({ pedidos: usePedidos(), motoboys: useMotoboys(), atribuir: useAtribuirMotoboy() }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.motoboys.data?.length).toBeGreaterThan(0))
    await waitFor(() => expect(result.current.pedidos.data?.length).toBeGreaterThan(0))
    const entrega = result.current.pedidos.data?.find(
      (pedido) => pedido.tipo === "entrega" && pedido.status === "em-preparo",
    )
    const motoboy = result.current.motoboys.data?.[1]

    await act(() =>
      result.current.atribuir.mutateAsync({ id: entrega?.id ?? 0, motoboyId: motoboy?.id ?? "" }),
    )
    await waitFor(() =>
      expect(
        result.current.pedidos.data?.find((pedido) => pedido.id === entrega?.id)?.motoboyId,
      ).toBe(motoboy?.id),
    )
  })

  test("o pedido aberto acompanha as ações, sem recarregar", async () => {
    const { result: lista } = renderHook(() => usePedidos(), { wrapper: envolver() })
    await waitFor(() => expect(lista.current.data?.length).toBeGreaterThan(0))
    const novo = lista.current.data?.find((pedido) => pedido.status === "recebido")
    const id = novo?.id ?? 0

    const { result } = renderHook(() => ({ pedido: usePedido(id), avancar: useAvancarPedido() }), {
      wrapper: envolver(),
    })
    await waitFor(() => expect(result.current.pedido.data?.status).toBe("recebido"))

    await act(() => result.current.avancar.mutateAsync({ id, de: "recebido" }))
    await waitFor(() => expect(result.current.pedido.data?.status).toBe("em-preparo"))
  })

  test("fechar a loja e desligar a entrega aparecem na configuração", async () => {
    const { result } = renderHook(
      () => ({ loja: useLoja(), aberta: useDefinirAberta(), entrega: useDefinirEntrega() }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.loja.data?.aberta).toBe(true))

    await act(() => result.current.aberta.mutateAsync(false))
    await act(() => result.current.entrega.mutateAsync(false))
    await waitFor(() => expect(result.current.loja.data?.aberta).toBe(false))
    expect(result.current.loja.data?.aceitaEntrega).toBe(false)
  })

  test("a fila traz o que está em aberto e recebe o pedido simulado", async () => {
    const { result } = renderHook(() => ({ fila: useFila(), simular: useSimularPedido() }), {
      wrapper: envolver(),
    })
    await waitFor(() => expect(result.current.fila.data?.length).toBeGreaterThan(0))
    for (const pedido of result.current.fila.data ?? []) {
      expect(["concluido", "cancelado"]).not.toContain(pedido.status)
    }

    const novo = await act(() => result.current.simular.mutateAsync())
    await waitFor(() =>
      expect(result.current.fila.data?.some((pedido) => pedido.id === novo.id)).toBe(true),
    )
  })

  test("um erro ao avançar desfaz a mudança na lista", async () => {
    const { result } = renderHook(() => ({ pedidos: usePedidos(), avancar: useAvancarPedido() }), {
      wrapper: envolver(),
    })
    await waitFor(() => expect(result.current.pedidos.data?.length).toBeGreaterThan(0))
    const concluido = result.current.pedidos.data?.find((pedido) => pedido.status === "concluido")

    await act(async () => {
      await expect(
        result.current.avancar.mutateAsync({ id: concluido?.id ?? 0, de: "concluido" }),
      ).rejects.toThrow("Este pedido não tem próxima etapa")
    })
    expect(result.current.pedidos.data?.find((pedido) => pedido.id === concluido?.id)?.status).toBe(
      "concluido",
    )
  })
})
