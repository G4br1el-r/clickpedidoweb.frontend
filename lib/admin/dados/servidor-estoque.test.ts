import "fake-indexeddb/auto"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"
import type { CatalogoLoja, ControleEstoque, Produto } from "./tipos"

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)

const controle = (quantidade: number, mudanca: Partial<ControleEstoque> = {}): ControleEstoque => ({
  controlar: true,
  quantidade,
  minimo: 2,
  custo: 3,
  esgotarAoZerar: true,
  ...mudanca,
})

/**
 * Lanchonete de teste com estoque: Refri lata (5 un) e Bacon (10 un), ligado à
 * opção "Bacon" do X-Burger.
 */
function catalogoComEstoque(mudar?: (catalogo: CatalogoLoja) => void) {
  const catalogo = catalogoDeTeste()
  const [lanche] = catalogo.produtos
  const refri: Produto = {
    ...lanche,
    id: "refri",
    nome: "Refri lata",
    preco: 6,
    grupos: [],
    estoque: controle(5),
  }
  const bacon: Produto = { ...refri, id: "bacon", nome: "Bacon", preco: 3, estoque: controle(10) }
  lanche.grupos[0].itens[0].produtoId = "bacon"
  catalogo.produtos.push(refri, bacon)
  mudar?.(catalogo)
  return catalogo
}

function servidor(
  mudar?: (catalogo: CatalogoLoja) => void,
  segmento: "lanchonete" | "acougue" = "lanchonete",
) {
  return criarServidor({
    segmento,
    carregarCatalogo: async () => catalogoComEstoque(mudar),
    espera: 0,
  })
}

const saldo = async (api: ReturnType<typeof servidor>, id: string) =>
  (await api.produtos.listar()).find((produto) => produto.id === id)
const refriNoPdv = (quantidade: number, concluida = true) => ({
  itens: [{ produtoId: "refri", escolhas: {}, quantidade }],
  pagamento: "pix" as const,
  desconto: { modo: "reais" as const, valor: 0 },
  concluida,
})

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("estoque: movimentos à mão", () => {
  test("entrada, saída com motivo e contagem, com o histórico do mais novo ao mais antigo", async () => {
    const api = servidor()
    await api.estoque.entrada("refri", {
      quantidade: 10,
      custoUnitario: 2.8,
      observacao: "Nota 123",
    })
    await api.estoque.saida("refri", { quantidade: 2, motivo: "Quebra" })
    await api.estoque.contagem("refri", { contado: 12 })
    expect((await saldo(api, "refri"))?.estoque).toMatchObject({ quantidade: 12, custo: 2.8 })

    const historico = await api.estoque.movimentos("refri")
    expect(historico.map((item) => [item.tipo, item.quantidade, item.saldo])).toEqual([
      ["contagem", -1, 12],
      ["saida", -2, 13],
      ["entrada", 10, 15],
    ])
    expect(historico[1]).toMatchObject({ motivo: "Quebra", criadoEm: AGORA.toISOString() })
    expect(historico[2]).toMatchObject({ custoUnitario: 2.8, observacao: "Nota 123" })

    await expect(api.estoque.saida("refri", { quantidade: 1, motivo: "" })).rejects.toThrow(
      "Diga o motivo da saída.",
    )
    await expect(api.estoque.entrada("refri", { quantidade: 1.5 })).rejects.toThrow(
      "Na unidade, a quantidade é inteira.",
    )
  })

  test("configurar liga o controle, o mínimo, o custo e o esgotar ao zerar", async () => {
    const api = servidor()
    const configurado = await api.estoque.configurar("prod-x-burger", {
      controlar: true,
      minimo: 4,
      custo: 7.5,
      esgotarAoZerar: false,
    })
    expect(configurado.estoque).toEqual({
      controlar: true,
      quantidade: 0,
      minimo: 4,
      custo: 7.5,
      esgotarAoZerar: false,
    })
  })
})

describe("estoque: vendas", () => {
  test("o PDV baixa, recusa passar do saldo e, ao zerar, esgota; a entrada devolve", async () => {
    const api = servidor()
    const venda = await api.pdv.finalizar(refriNoPdv(3))
    expect((await saldo(api, "refri"))?.estoque?.quantidade).toBe(2)
    expect((await api.estoque.movimentos("refri"))[0]).toMatchObject({
      tipo: "venda",
      quantidade: -3,
      saldo: 2,
      pedidoId: venda.id,
    })

    await expect(api.pdv.finalizar(refriNoPdv(3))).rejects.toThrow("Só restam 2 de Refri lata.")

    await api.pdv.finalizar(refriNoPdv(2))
    expect(await saldo(api, "refri")).toMatchObject({
      disponivel: false,
      estoque: { quantidade: 0, esgotadoPeloEstoque: true },
    })
    await expect(api.pdv.finalizar(refriNoPdv(1))).rejects.toThrow("Refri lata está esgotado.")

    await api.estoque.entrada("refri", { quantidade: 6 })
    expect(await saldo(api, "refri")).toMatchObject({
      disponivel: true,
      estoque: { quantidade: 6 },
    })
  })

  test("quem esgotou na mão continua esgotado depois da entrada", async () => {
    const api = servidor()
    await api.produtos.alternar("refri", "disponivel")
    await api.estoque.entrada("refri", { quantidade: 6 })
    expect((await saldo(api, "refri"))?.disponivel).toBe(false)
  })

  test("cancelar devolve o que saiu, uma vez só", async () => {
    const api = servidor()
    const venda = await api.pdv.finalizar(refriNoPdv(2, false))
    expect((await saldo(api, "refri"))?.estoque?.quantidade).toBe(3)
    await api.pedidos.cancelar(venda.id, "recebido")
    expect((await saldo(api, "refri"))?.estoque?.quantidade).toBe(5)
    expect((await api.estoque.movimentos("refri"))[0]).toMatchObject({
      tipo: "devolucao",
      quantidade: 2,
      pedidoId: venda.id,
    })
    expect((await api.pedidos.buscar(venda.id))?.estoqueBaixado).toBe(false)
  })

  test("comanda: lançar baixa, mudar a quantidade acerta, tirar devolve e não passa do saldo", async () => {
    const api = servidor()
    const mesa = await api.mesas.criar({ numero: 30 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ produtoId: "refri", escolhas: {}, quantidade: 2 }],
    })
    const [item] = comanda.itens
    expect((await saldo(api, "refri"))?.estoque?.quantidade).toBe(3)

    await api.mesas.alterarQuantidade(comanda.id, item.id, 4)
    expect((await saldo(api, "refri"))?.estoque?.quantidade).toBe(1)
    await expect(api.mesas.alterarQuantidade(comanda.id, item.id, 6)).rejects.toThrow(
      "Só restam 1 de Refri lata.",
    )
    await api.mesas.alterarQuantidade(comanda.id, item.id, 1)
    expect((await saldo(api, "refri"))?.estoque?.quantidade).toBe(4)
    await api.mesas.removerItem(comanda.id, item.id)
    expect((await saldo(api, "refri"))?.estoque?.quantidade).toBe(5)

    await expect(
      api.mesas.lancar({
        mesaId: mesa.id,
        enviarParaCozinha: false,
        itens: [{ produtoId: "refri", escolhas: {}, quantidade: 6 }],
      }),
    ).rejects.toThrow("Só restam 5 de Refri lata.")
  })

  test("combo: a opção ligada a um produto baixa o estoque dele", async () => {
    const api = servidor()
    const mesa = await api.mesas.criar({ numero: 31 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [
        {
          produtoId: "prod-x-burger",
          escolhas: { "grp-x-burger-1": ["opc-x-burger-1-1"] },
          quantidade: 2,
        },
      ],
    })
    expect(comanda.itens[0].produtosDasOpcoes).toEqual(["bacon"])
    expect((await saldo(api, "bacon"))?.estoque?.quantidade).toBe(8)
  })

  test("pedido do site entra mesmo sem saldo, o estoque fica negativo e o produto esgota", async () => {
    // Só 1 X-Burger em estoque; o pedido aguardando pagamento online pede mais que isso.
    const api = servidor((catalogo) => {
      catalogo.produtos[0].estoque = controle(1)
      // Só o X-Burger entra nos pedidos gerados: o aguardando sempre leva o produto do teste.
      for (const produto of catalogo.produtos.slice(1)) produto.ativo = false
    })
    const [aguardando] = await api.pedidos.listar({ status: ["aguardando-pagamento"] })
    const pedidos = aguardando.itens
      .filter((item) => item.produtoId === "prod-x-burger")
      .reduce((soma, item) => soma + item.quantidade, 0)
    expect(aguardando.estoqueBaixado).toBeFalsy()

    await api.pedidos.marcarPago(aguardando.id)
    expect(await saldo(api, "prod-x-burger")).toMatchObject({
      disponivel: false,
      estoque: { quantidade: 1 - pedidos },
    })
    expect((await api.pedidos.buscar(aguardando.id))?.estoqueBaixado).toBe(true)
  })
})

describe("estoque: açougue", () => {
  test("a pesagem acerta a diferença entre o peso pedido e o da balança", async () => {
    const api = servidor((catalogo) => {
      const [carne] = catalogo.produtos
      carne.unidade = "kg"
      carne.preco = 60
      carne.grupos = []
      carne.estoque = controle(50)
      // Só a carne: assim os pedidos ao vivo trazem item por quilo para pesar.
      catalogo.produtos = [carne]
      catalogo.loja.pagamentos["pagar-apos-pesagem"] = true
    }, "acougue")
    const abertos = await api.pedidos.listar({ status: ["recebido", "em-preparo", "pronto"] })
    const pedido = abertos.find((item) => item.pagamento === "pagar-apos-pesagem" && !item.pesagem)
    if (!pedido) throw new Error("A demonstração devia ter um pedido a pesar")
    // O saldo inicial já desconta os pedidos em andamento.
    expect(pedido.estoqueBaixado).toBe(true)
    const antes = (await saldo(api, "prod-x-burger"))?.estoque?.quantidade as number

    // Cada item com 100 g a mais do que foi pedido.
    const pesos = Object.fromEntries(
      pedido.itens
        .filter((item) => item.pesoGramas)
        .map((item) => [item.id, (item.pesoGramas as number) * item.quantidade + 100]),
    )
    await api.pedidos.registrarPesagem(pedido.id, pesos)
    const itens = Object.keys(pesos).length
    const depois = (await saldo(api, "prod-x-burger"))?.estoque?.quantidade as number
    expect(Math.round((antes - depois) * 1000)).toBe(itens * 100)
    expect((await api.estoque.movimentos("prod-x-burger"))[0]).toMatchObject({
      tipo: "pesagem",
      pedidoId: pedido.id,
    })
  })
})
