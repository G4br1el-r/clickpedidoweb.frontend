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
  useBloquearMesa,
  useConfigSalao,
  useCriarMesa,
  useDesbloquearMesa,
  useEditarMesa,
  useLancarNaMesa,
  useMarcarLimpa,
  useMesas,
  useSalvarConfigSalao,
} from "./consultas-mesas"
import type { Mesa } from "./tipos"

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

  test("editar, bloquear, desbloquear e marcar limpa chegam ao servidor e atualizam as mesas", async () => {
    const api = servidorDo("pizzaria")
    const mesa = await api.mesas.criar({ numero: 82 })
    const { result } = renderHook(
      () => ({
        mesas: useMesas(),
        editar: useEditarMesa(),
        bloquear: useBloquearMesa(),
        desbloquear: useDesbloquearMesa(),
        limpa: useMarcarLimpa(),
      }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.mesas.data).toBeDefined())
    const doServidor = async () =>
      (await api.mesas.listar()).find((item) => item.id === mesa.id) as Mesa
    const daTela = () => result.current.mesas.data?.find((item) => item.id === mesa.id)

    await act(() =>
      result.current.editar.mutateAsync({
        id: mesa.id,
        dados: {
          numero: 82,
          nome: "Janela",
          areaId: mesa.areaId,
          lugares: 6,
          forma: "redonda",
        },
      }),
    )
    expect(await doServidor()).toMatchObject({ nome: "Janela", lugares: 6, forma: "redonda" })
    await waitFor(() => expect(daTela()?.nome).toBe("Janela"))

    await act(() => result.current.bloquear.mutateAsync({ id: mesa.id, motivo: "Quebrada" }))
    expect((await doServidor()).bloqueio).toEqual({ motivo: "Quebrada" })
    await waitFor(() => expect(daTela()?.bloqueio).toEqual({ motivo: "Quebrada" }))

    await act(() => result.current.desbloquear.mutateAsync(mesa.id))
    expect((await doServidor()).bloqueio).toBeUndefined()
    await waitFor(() => expect(daTela()?.bloqueio).toBeUndefined())

    // A conta paga com a limpeza ligada (pizzaria) deixa a mesa em limpeza até marcá-la limpa.
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    await api.mesas.fecharConta(comanda.id, "pix")
    expect((await doServidor()).limpezaDesde).toBeDefined()
    await act(() => result.current.limpa.mutateAsync(mesa.id))
    expect((await doServidor()).limpezaDesde).toBeUndefined()
  })

  test("criar mesa repassa área, lugares e forma", async () => {
    const api = servidorDo("pizzaria")
    const area = (await api.salao.config()).areas[0]
    const { result } = renderHook(() => useCriarMesa(), { wrapper: envolver() })
    await act(() =>
      result.current.mutateAsync({
        numero: 83,
        areaId: area.id,
        lugares: 8,
        forma: "retangular",
      }),
    )
    const criada = (await api.mesas.listar()).find((mesa) => mesa.numero === 83)
    expect(criada).toMatchObject({ areaId: area.id, lugares: 8, forma: "retangular" })
  })
})
