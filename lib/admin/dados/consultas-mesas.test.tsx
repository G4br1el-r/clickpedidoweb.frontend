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
  useDarCortesia,
  useDesbloquearMesa,
  useDescontar,
  useDesfazer,
  useEditarItem,
  useEditarMesa,
  useEstornarPagamento,
  useImprimirPreConta,
  useJuntarMesas,
  useLancarNaMesa,
  useMarcarLimpa,
  useMarcarServido,
  useMesas,
  usePagar,
  usePedirConta,
  useReabrirConta,
  useRemoverItem,
  useSalvarConfigSalao,
  useSepararMesas,
  useTirarCouvert,
  useTirarTaxa,
  useTransferirItens,
  useTransferirMesa,
  useUltimaConta,
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

  test("a conta: desconto, cortesia, taxa, couvert, pagar, estornar, pré-conta, fechar e reabrir", async () => {
    const api = servidorDo("pizzaria")
    const mesa = await api.mesas.criar({ numero: 83 })
    const aberta = await api.mesas.abrir(mesa.id, { pessoas: 2, garcom: "Bia" })
    const lancada = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [
        { avulso: { nome: "Pizza", preco: 40 }, quantidade: 1 },
        { avulso: { nome: "Água", preco: 4 }, quantidade: 1 },
      ],
    })
    const [, agua] = lancada.itens
    const { result } = renderHook(
      () => ({
        comanda: usePedido(aberta.id),
        ultima: useUltimaConta(mesa.id),
        descontar: useDescontar(),
        cortesia: useDarCortesia(),
        tirarTaxa: useTirarTaxa(),
        tirarCouvert: useTirarCouvert(),
        pagar: usePagar(),
        estornar: useEstornarPagamento(),
        preConta: useImprimirPreConta(),
        reabrir: useReabrirConta(),
      }),
      { wrapper: envolver() },
    )
    // 44 + 4,40 de taxa + 16 de couvert.
    await waitFor(() => expect(result.current.comanda.data?.total).toBe(64.4))
    await waitFor(() => expect(result.current.ultima.isSuccess).toBe(true))
    expect(result.current.ultima.data).toBeNull()

    await act(() =>
      result.current.descontar.mutateAsync({
        pedidoId: aberta.id,
        modo: "reais",
        valor: 4,
        motivo: "Demora",
      }),
    )
    await waitFor(() => expect(result.current.comanda.data?.total).toBe(60))
    await act(() =>
      result.current.cortesia.mutateAsync({
        pedidoId: aberta.id,
        itemId: agua.id,
        motivo: "Brinde",
      }),
    )
    await act(() => result.current.tirarTaxa.mutateAsync({ pedidoId: aberta.id, motivo: "Pedido" }))
    await act(() =>
      result.current.tirarCouvert.mutateAsync({ pedidoId: aberta.id, motivo: "Pedido" }),
    )
    // 44 − 4 de cortesia − 4 de desconto.
    await waitFor(() => expect(result.current.comanda.data?.total).toBe(36))

    const paga = await act(() =>
      result.current.pagar.mutateAsync({ pedidoId: aberta.id, forma: "pix", valor: 10 }),
    )
    const [pix] = paga.pagamentos ?? []
    await act(() =>
      result.current.estornar.mutateAsync({
        pedidoId: aberta.id,
        pagamentoId: pix.id,
        motivo: "Errado",
      }),
    )
    await waitFor(() => expect(result.current.comanda.data?.pagamentos).toEqual([]))
    await act(() => result.current.preConta.mutateAsync({ pedidoId: aberta.id, por: "Bia" }))
    await waitFor(() => expect(result.current.comanda.data?.contaPedidaEm).toBeDefined())

    await act(() => result.current.pagar.mutateAsync({ pedidoId: aberta.id, forma: "dinheiro" }))
    await waitFor(() => expect(result.current.comanda.data?.status).toBe("concluido"))
    await waitFor(() => expect(result.current.ultima.data?.id).toBe(aberta.id))

    await act(() => result.current.reabrir.mutateAsync({ pedidoId: aberta.id, motivo: "Erro" }))
    await waitFor(() => expect(result.current.comanda.data?.status).toBe("pronto"))
  })
})

describe("consultas das movimentações", () => {
  async function comandaNaMesa(numero: number) {
    const api = servidorDo("pizzaria")
    const mesa = await api.mesas.criar({ numero })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Suco", preco: 9.5 }, quantidade: 3 }],
    })
    return { api, mesa, comanda }
  }

  test("transferir, juntar, separar e desfazer chegam ao servidor e atualizam a comanda e as mesas", async () => {
    const { api, mesa, comanda } = await comandaNaMesa(81)
    const destino = await api.mesas.criar({ numero: 82 })
    const livre = await api.mesas.criar({ numero: 83 })
    const { result } = renderHook(
      () => ({
        mesas: useMesas(),
        comanda: usePedido(comanda.id),
        transferir: useTransferirMesa(),
        juntar: useJuntarMesas(),
        separar: useSepararMesas(),
        desfazer: useDesfazer(),
      }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.comanda.data?.mesa?.numero).toBe(81))
    const daTela = (id: string) => result.current.mesas.data?.find((item) => item.id === id)

    const { desfazer } = await act(() =>
      result.current.transferir.mutateAsync({ pedidoId: comanda.id, mesaDestinoId: destino.id }),
    )
    await waitFor(() => expect(result.current.comanda.data?.mesa?.numero).toBe(82))
    await waitFor(() => expect(daTela(destino.id)?.status).toBe("ocupada"))

    await act(() => result.current.desfazer.mutateAsync(desfazer))
    await waitFor(() => expect(result.current.comanda.data?.mesa?.numero).toBe(81))
    await waitFor(() => expect(daTela(mesa.id)?.status).toBe("ocupada"))

    await act(() =>
      result.current.juntar.mutateAsync({ pedidoId: comanda.id, mesaIds: [livre.id], por: "Bia" }),
    )
    await waitFor(() =>
      expect(result.current.comanda.data?.mesa?.juntadas).toEqual([{ id: livre.id, numero: 83 }]),
    )
    await waitFor(() => expect(daTela(livre.id)?.juntadaCom).toBe(mesa.id))

    await act(() => result.current.separar.mutateAsync({ pedidoId: comanda.id }))
    await waitFor(() => expect(result.current.comanda.data?.mesa?.juntadas).toBeUndefined())
    await waitFor(() => expect(daTela(livre.id)?.juntadaCom).toBeUndefined())
  })

  test("transferir itens guarda as duas comandas; marcar limpa devolve o desfazer", async () => {
    const { api, comanda } = await comandaNaMesa(84)
    const destino = await api.mesas.criar({ numero: 85 })
    const { result } = renderHook(
      () => ({
        comanda: usePedido(comanda.id),
        transferir: useTransferirItens(),
        limpa: useMarcarLimpa(),
      }),
      { wrapper: envolver() },
    )
    await waitFor(() => expect(result.current.comanda.data).toBeDefined())

    const { destino: aberta } = await act(() =>
      result.current.transferir.mutateAsync({
        pedidoId: comanda.id,
        mesaDestinoId: destino.id,
        itens: [{ itemId: comanda.itens[0].id, quantidade: 1 }],
      }),
    )
    await waitFor(() => expect(result.current.comanda.data?.itens[0].quantidade).toBe(2))
    expect(aberta.mesa?.numero).toBe(85)

    const limpa = await act(() => result.current.limpa.mutateAsync("mesa-9"))
    expect(limpa.desfazer).toEqual(expect.any(String))
  })
})
