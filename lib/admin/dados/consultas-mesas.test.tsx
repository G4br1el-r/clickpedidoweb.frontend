import "fake-indexeddb/auto"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { clear } from "idb-keyval"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { useSegmentoAtual } from "../segmento-atual"
import { reiniciarServidores, servidorDo, usePedido } from "./consultas"
import {
  useAbrirMesa,
  useAlterarQuantidade,
  useBloquearMesa,
  useCancelarComanda,
  useConfigSalao,
  useCriarMesa,
  useDesbloquearMesa,
  useEditarItem,
  useEditarMesa,
  useLancarNaMesa,
  useMarcarLimpa,
  useMarcarServido,
  useMesas,
  usePedirConta,
  useRemoverItem,
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

/** A pizzaria da demonstração cobra taxa e couvert: aqui o teste confere só a soma dos itens. */
async function semTaxaNemCouvert(api: ReturnType<typeof servidorDo>) {
  const salao = await api.salao.config()
  await api.salao.salvar({
    ...salao,
    taxaServico: { ...salao.taxaServico, ativa: false },
    couvert: { ...salao.couvert, ativo: false },
  })
}

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
    await semTaxaNemCouvert(api)
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
    await semTaxaNemCouvert(api)
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

  test("a previsão da quantidade já conta a taxa e o couvert da comanda", async () => {
    const api = servidorDo("pizzaria")
    const mesa = await api.mesas.criar({ numero: 82 })
    // Água de R$ 4,00 na pizzaria: 10% de taxa e R$ 8,00 de couvert para 1 pessoa.
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    const { result } = renderHook(
      () => ({ comanda: usePedido(comanda.id), alterar: useAlterarQuantidade() }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.comanda.data?.total).toBe(12.4))

    // A rede demora: o servidor ainda não respondeu quando a tela muda.
    vi.spyOn(api.mesas, "alterarQuantidade").mockReturnValue(new Promise(() => {}))
    act(() =>
      result.current.alterar.mutate({
        pedidoId: comanda.id,
        itemId: comanda.itens[0].id,
        quantidade: 3,
      }),
    )
    // Antes de o servidor responder, a tela já mostra 12 + 1,20 + 8.
    await waitFor(() => expect(result.current.comanda.data?.total).toBe(21.2))
  })

  test("diminuir o que a cozinha preparou repassa o motivo e quem tirou", async () => {
    const api = servidorDo("pizzaria")
    const mesa = await api.mesas.criar({ numero: 84 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [{ avulso: { nome: "Pizza", preco: 40 }, quantidade: 2 }],
    })
    await api.pedidos.avancar(comanda.id, "recebido")
    const [pizza] = comanda.itens
    const { result } = renderHook(() => useAlterarQuantidade(), { wrapper: envolver() })

    const depois = await act(() =>
      result.current.mutateAsync({
        pedidoId: comanda.id,
        itemId: pizza.id,
        quantidade: 1,
        motivo: "Queimou",
        por: "Bia",
      }),
    )
    expect(depois.itens[0].quantidade).toBe(1)
    expect(depois.eventos?.at(-1)).toMatchObject({
      tipo: "item-removido",
      texto: "Tirou 1× Pizza",
      motivo: "Queimou",
      por: "Bia",
    })
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

  test("abrir, editar, servir, pedir a conta, tirar com motivo e cancelar chegam ao servidor e à comanda aberta", async () => {
    const api = servidorDo("pizzaria")
    const mesa = await api.mesas.criar({ numero: 82 })
    const { result } = renderHook(
      () => ({
        mesas: useMesas(),
        abrir: useAbrirMesa(),
        editar: useEditarItem(),
        servir: useMarcarServido(),
        pedirConta: usePedirConta(),
        remover: useRemoverItem(),
        cancelar: useCancelarComanda(),
      }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.mesas.data).toBeDefined())

    const aberta = await act(() =>
      result.current.abrir.mutateAsync({ mesaId: mesa.id, pessoas: 2, garcom: "Bia" }),
    )
    await waitFor(() =>
      expect(result.current.mesas.data?.find((item) => item.id === mesa.id)?.status).toBe(
        "ocupada",
      ),
    )
    const { result: comanda } = renderHook(() => usePedido(aberta.id), { wrapper: envolver() })
    await waitFor(() => expect(comanda.current.data?.mesa?.pessoas).toBe(2))

    const lancada = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: true,
      itens: [
        { avulso: { nome: "Pizza", preco: 40 }, quantidade: 1 },
        { avulso: { nome: "Água", preco: 4 }, quantidade: 1 },
      ],
    })
    const [pizza, agua] = lancada.itens
    const editada = await act(() =>
      result.current.editar.mutateAsync({
        pedidoId: aberta.id,
        itemId: agua.id,
        observacao: "Com gelo",
      }),
    )
    expect(editada.itens[1].observacao).toBe("Com gelo")

    await api.pedidos.avancar(aberta.id, "recebido")
    await api.pedidos.avancar(aberta.id, "em-preparo")
    expect(
      (await act(() => result.current.servir.mutateAsync({ pedidoId: aberta.id }))).servirDesde,
    ).toBeUndefined()
    expect(
      (await act(() => result.current.pedirConta.mutateAsync({ pedidoId: aberta.id })))
        .contaPedidaEm,
    ).toBe(new Date(2026, 10, 13, 20, 30).toISOString())
    const semPizza = await act(() =>
      result.current.remover.mutateAsync({
        pedidoId: aberta.id,
        itemId: pizza.id,
        motivo: "Queimou",
      }),
    )
    expect(semPizza.eventos?.at(-1)).toMatchObject({ tipo: "item-removido", motivo: "Queimou" })

    await act(() =>
      result.current.cancelar.mutateAsync({ pedidoId: aberta.id, motivo: "Cliente foi embora" }),
    )
    await waitFor(() =>
      expect(result.current.mesas.data?.find((item) => item.id === mesa.id)?.status).toBe("livre"),
    )
  })
})
