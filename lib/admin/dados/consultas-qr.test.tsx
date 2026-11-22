import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { clear } from "idb-keyval"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { useSegmentoAtual } from "../segmento-atual"
import { reiniciarServidores, servidorDo } from "./consultas"
import { useChamarNaMesa, useMesaQr, usePedirNaMesa } from "./consultas-qr"

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
  // O painel está em outra loja: a vitrine da mesa segue a loja do endereço.
  useSegmentoAtual.setState({ ...useSegmentoAtual.getInitialState(), segmento: "adega" }, true)
})

afterEach(() => {
  vi.useRealTimers()
})

test("a vitrine da mesa lê, pede e chama pela loja do endereço, não pela do painel", async () => {
  const { result } = renderHook(
    () => ({
      mesa: useMesaQr("pizzaria", "mesa-11"),
      pedir: usePedirNaMesa("pizzaria", "mesa-11"),
      chamar: useChamarNaMesa("pizzaria", "mesa-11"),
    }),
    { wrapper: envolver() },
  )
  await waitFor(() => expect(result.current.mesa.data?.mesa.numero).toBe(11))
  expect(result.current.mesa.data?.loja).toBe("Casa da Pizza")

  await act(() =>
    result.current.pedir.mutateAsync([{ produtoId: "prod-agua", escolhas: {}, quantidade: 1 }]),
  )
  await act(() => result.current.chamar.mutateAsync("garcom"))

  await waitFor(() => expect(result.current.mesa.data?.aguardando).toBe(1))
  const chamados = await servidorDo("pizzaria").chamados.listar()
  expect(chamados.at(-1)).toMatchObject({ mesaId: "mesa-11", tipo: "garcom" })
})

test("a mesa indisponível vira erro da consulta", async () => {
  const { result } = renderHook(() => useMesaQr("pizzaria", "mesa-99"), {
    wrapper: envolver(),
  })
  await waitFor(() => expect(result.current.error?.message).toBe("Mesa indisponível."))
})
