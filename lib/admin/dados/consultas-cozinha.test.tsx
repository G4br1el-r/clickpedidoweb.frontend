import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { clear } from "idb-keyval"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { ticketsDaCozinha } from "../regras/cozinha"
import { useSegmentoAtual } from "../segmento-atual"
import {
  reiniciarServidores,
  servidorDo,
  useAvancarTicket,
  useAvisarSobreRodada,
  useCozinha,
  useDarCiente,
  usePriorizarPedido,
  useRiscarItem,
  useServirRodada,
  useVerMensagem,
  useVoltarTicket,
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

/** Mesa 81 com uma rodada de batata e refrigerante na cozinha. */
async function mesaNaCozinha() {
  const api = servidorDo("pizzaria")
  const mesa = await api.mesas.criar({ numero: 81 })
  const comanda = await api.mesas.lancar({
    mesaId: mesa.id,
    enviarParaCozinha: true,
    itens: [
      { avulso: { nome: "Batata", preco: 12 }, quantidade: 1 },
      { avulso: { nome: "Esfiha", preco: 6 }, quantidade: 2 },
    ],
  })
  return { api, comanda }
}

function useQuadro() {
  return {
    cozinha: useCozinha(),
    avancar: useAvancarTicket(),
    voltar: useVoltarTicket(),
    riscar: useRiscarItem(),
    priorizar: usePriorizarPedido(),
  }
}

describe("consultas da cozinha", () => {
  test("avançar e voltar um ticket aparecem no quadro, sem recarregar", async () => {
    const { api, comanda } = await mesaNaCozinha()
    const { result } = renderHook(useQuadro, { wrapper: envolver() })
    const ticket = () =>
      ticketsDaCozinha(result.current.cozinha.data ?? []).find(
        (item) => item.pedido.id === comanda.id,
      )
    await waitFor(() => expect(ticket()?.status).toBe("recebido"))

    act(() => result.current.avancar.mutate({ id: comanda.id, rodada: 1, de: "recebido" }))
    await waitFor(() => expect(ticket()?.status).toBe("em-preparo"))
    await waitFor(() => expect(result.current.avancar.isSuccess).toBe(true))
    expect((await api.pedidos.buscar(comanda.id))?.status).toBe("em-preparo")

    act(() => result.current.voltar.mutate({ id: comanda.id, rodada: 1, de: "em-preparo" }))
    await waitFor(() => expect(ticket()?.status).toBe("recebido"))
  })

  test("avançar a partir de uma etapa que já passou é recusado, e o ticket não pula", async () => {
    const { api, comanda } = await mesaNaCozinha()
    const { result } = renderHook(useQuadro, { wrapper: envolver() })
    const ticket = () =>
      ticketsDaCozinha(result.current.cozinha.data ?? []).find(
        (item) => item.pedido.id === comanda.id,
      )
    await waitFor(() => expect(ticket()?.status).toBe("recebido"))

    act(() => result.current.avancar.mutate({ id: comanda.id, rodada: 1, de: "em-preparo" }))
    await waitFor(() =>
      expect(result.current.avancar.error?.message).toBe(
        "Este ticket já mudou de etapa. Atualize a tela.",
      ),
    )
    expect(ticket()?.status).toBe("recebido")
    expect((await api.pedidos.buscar(comanda.id))?.status).toBe("recebido")
  })

  test("dar ciente do cancelamento tira o ticket do quadro", async () => {
    const { api, comanda } = await mesaNaCozinha()
    const cancelado = await api.pedidos.cancelar(comanda.id, "recebido")
    const [aviso] = cancelado.avisosCozinha ?? []
    const { result } = renderHook(() => ({ ...useQuadro(), ciente: useDarCiente() }), {
      wrapper: envolver(),
    })
    const tickets = () =>
      ticketsDaCozinha(result.current.cozinha.data ?? []).filter(
        (item) => item.pedido.id === comanda.id,
      )
    await waitFor(() => expect(tickets()).toHaveLength(1))

    act(() => result.current.ciente.mutate({ id: comanda.id, avisoId: aviso.id }))
    await waitFor(() => expect(tickets()).toHaveLength(0))
  })

  test("riscar um item e marcar prioridade aparecem no quadro", async () => {
    const { comanda } = await mesaNaCozinha()
    const { result } = renderHook(useQuadro, { wrapper: envolver() })
    const doQuadro = () => result.current.cozinha.data?.find((item) => item.id === comanda.id)
    await waitFor(() => expect(doQuadro()).toBeDefined())

    const [batata] = comanda.itens
    act(() => result.current.riscar.mutate({ id: comanda.id, itemId: batata.id, feito: true }))
    await waitFor(() => expect(doQuadro()?.itens[0].feitoEm).toBeDefined())
    expect(doQuadro()?.status).toBe("em-preparo")

    act(() => result.current.priorizar.mutate({ id: comanda.id, prioridade: true }))
    await waitFor(() => expect(doQuadro()?.prioridade).toBe(true))
  })

  test("servir a rodada pronta tira o ticket do quadro", async () => {
    const { api, comanda } = await mesaNaCozinha()
    await api.cozinha.avancar(comanda.id, 1, "recebido")
    await api.cozinha.avancar(comanda.id, 1, "em-preparo")
    const { result } = renderHook(() => ({ ...useQuadro(), servir: useServirRodada() }), {
      wrapper: envolver(),
    })
    const tickets = () =>
      ticketsDaCozinha(result.current.cozinha.data ?? []).filter(
        (item) => item.pedido.id === comanda.id,
      )
    await waitFor(() => expect(tickets()).toHaveLength(1))

    act(() => result.current.servir.mutate({ id: comanda.id, rodada: 1 }))
    await waitFor(() => expect(tickets()).toHaveLength(0))
    await waitFor(() => expect(result.current.servir.isSuccess).toBe(true))
  })

  test("a mensagem da cozinha aparece no pedido, e o Ok tira", async () => {
    const { comanda } = await mesaNaCozinha()
    const { result } = renderHook(
      () => ({ ...useQuadro(), avisar: useAvisarSobreRodada(), ver: useVerMensagem() }),
      { wrapper: envolver() },
    )
    const mensagens = () =>
      result.current.cozinha.data
        ?.find((item) => item.id === comanda.id)
        ?.mensagensCozinha?.filter((mensagem) => !mensagem.vistaEm) ?? []
    await waitFor(() => expect(result.current.cozinha.data).toBeDefined())

    act(() => result.current.avisar.mutate({ id: comanda.id, rodada: 1, tipo: "atraso" }))
    await waitFor(() => expect(mensagens().map((mensagem) => mensagem.tipo)).toEqual(["atraso"]))
    await waitFor(() => expect(result.current.avisar.isSuccess).toBe(true))
    await waitFor(() => expect(mensagens()[0]?.id).toMatch(/^msg-/))

    act(() => result.current.ver.mutate({ id: comanda.id, mensagemId: mensagens()[0].id }))
    await waitFor(() => expect(mensagens()).toEqual([]))
  })
})
