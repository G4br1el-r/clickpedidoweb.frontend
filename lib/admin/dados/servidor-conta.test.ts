import "fake-indexeddb/auto"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { pagoNoDiaSemTaxa, resumoDaConta } from "../regras/conta"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor, type ItemLancado } from "./servidor"
import type { CatalogoLoja, Pedido } from "./tipos"

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)

/** X-Burger com Bacon: R$ 23,00. */
const xBurger: ItemLancado = {
  produtoId: "prod-x-burger",
  escolhas: { "grp-x-burger-1": ["opc-x-burger-1-1"] },
  quantidade: 1,
}

/** Lanchonete de teste com o garçom Rafa, taxa de 10% e couvert de R$ 8,00 ligados. */
function servidor(mudar?: (catalogo: CatalogoLoja) => void) {
  return criarServidor({
    segmento: "lanchonete",
    carregarCatalogo: async () => {
      const base = catalogoDeTeste()
      base.salao.garcons = [{ id: "garcom-rafa", nome: "Rafa", ativo: true }]
      base.salao.taxaServico = { ativa: true, percentual: 10 }
      base.salao.couvert = { ativo: true, porPessoa: 8 }
      mudar?.(base)
      return base
    },
    espera: 0,
  })
}

type Api = ReturnType<typeof servidor>

/** Mesa 30 nova, aberta para `pessoas` com o Rafa. */
async function abrirMesa(api: Api, pessoas = 2, numero = 30) {
  const mesa = await api.mesas.criar({ numero })
  const comanda = await api.mesas.abrir(mesa.id, { pessoas, garcom: "Rafa" })
  return { mesa, comanda }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("taxa e couvert congelados", () => {
  test("abrir guarda a taxa e o couvert do salão, e o total soma os dois", async () => {
    const api = servidor()
    const { mesa, comanda } = await abrirMesa(api)
    expect(comanda).toMatchObject({ taxaServico: { percentual: 10 }, couvert: { porPessoa: 8 } })

    const lancada = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [xBurger],
    })
    // 23 + 2,30 de taxa + 2 × 8 de couvert.
    expect(lancada).toMatchObject({ subtotal: 23, desconto: 0, total: 41.3 })
  })

  test("a comanda aberta já soma o couvert", async () => {
    const { comanda } = await abrirMesa(servidor())
    expect(comanda.total).toBe(16)
  })

  test("mudar o salão depois não mexe na conta aberta", async () => {
    const api = servidor()
    const { mesa } = await abrirMesa(api)
    const salao = await api.salao.config()
    await api.salao.salvar({
      ...salao,
      taxaServico: { ativa: true, percentual: 15 },
      couvert: { ativo: false, porPessoa: 8 },
    })
    const lancada = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [xBurger],
    })
    expect(lancada).toMatchObject({
      taxaServico: { percentual: 10 },
      couvert: { porPessoa: 8 },
      total: 41.3,
    })
  })

  test("lançar na mesa livre (pelo Garçom) também congela, com 1 pessoa", async () => {
    const api = servidor()
    const mesa = await api.mesas.criar({ numero: 30 })
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      garcom: "Rafa",
      enviarParaCozinha: false,
      itens: [xBurger],
    })
    // 23 + 2,30 + 8.
    expect(comanda).toMatchObject({ taxaServico: { percentual: 10 }, total: 33.3 })
  })

  test("com a taxa e o couvert desligados, a comanda nasce sem os campos", async () => {
    const api = servidor((catalogo) => {
      catalogo.salao.taxaServico = { ativa: false, percentual: 10 }
      catalogo.salao.couvert = { ativo: false, porPessoa: 8 }
    })
    const { comanda } = await abrirMesa(api)
    expect(comanda).not.toHaveProperty("taxaServico")
    expect(comanda).not.toHaveProperty("couvert")
  })
})

/** Servidor sem taxa nem couvert, com a limpeza ligada ou não. */
const semTaxa = (limpeza = true) =>
  servidor((catalogo) => {
    catalogo.salao.taxaServico = { ativa: false, percentual: 10 }
    catalogo.salao.couvert = { ativo: false, porPessoa: 8 }
    catalogo.salao.limpeza = limpeza
  })

/** Mesa 30 com a conta de R$ 100,00 (Rodízio avulso), sem taxa nem couvert. */
async function contaDeCem(api: Api) {
  const { mesa } = await abrirMesa(api)
  const comanda = await api.mesas.lancar({
    mesaId: mesa.id,
    enviarParaCozinha: false,
    itens: [{ avulso: { nome: "Rodízio", preco: 100 }, quantidade: 1 }],
  })
  return { mesa, comanda }
}

describe("pagar contra o saldo", () => {
  test("Pix de R$ 33,33: o saldo cai e a comanda continua aberta", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    const paga = await api.mesas.pagar(comanda.id, { forma: "pix", valor: 33.33, por: "Rafa" })
    expect(paga.status).toBe("pronto")
    expect(paga.situacaoPagamento).toBe("na-entrega")
    expect(paga.pagamentos).toEqual([
      { id: expect.any(String), forma: "pix", valor: 33.33, em: AGORA.toISOString(), por: "Rafa" },
    ])
    expect(paga.eventos?.at(-1)).toEqual({
      tipo: "pagamento",
      em: AGORA.toISOString(),
      por: "Rafa",
      texto: "Pix R$ 33,33",
    })
  })

  test("misto: Pix e dinheiro com troco; o saldo zerado fecha a conta sozinho", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await api.mesas.pagar(comanda.id, { forma: "pix", valor: 33.33 })
    const fechada = await api.mesas.pagar(comanda.id, {
      forma: "dinheiro",
      valor: 66.67,
      recebido: 80,
    })
    expect(fechada.pagamentos?.at(-1)).toMatchObject({
      forma: "dinheiro",
      valor: 66.67,
      recebido: 80,
      troco: 13.33,
    })
    expect(fechada).toMatchObject({
      status: "concluido",
      situacaoPagamento: "pago",
      pagoEm: AGORA.toISOString(),
      // A forma do pedido é a do maior pagamento.
      pagamento: "dinheiro",
      total: 100,
    })
    expect(fechada).not.toHaveProperty("trocoPara")
    expect(fechada.eventos?.slice(-2).map((evento) => evento.texto)).toEqual([
      "Dinheiro R$ 66,67 · troco R$ 13,33",
      "Conta fechada",
    ])
  })

  test("cartão pede crédito ou débito, e guarda qual foi", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await expect(
      api.mesas.pagar(comanda.id, { forma: "cartao-na-entrega", valor: 10 }),
    ).rejects.toThrow("Escolha crédito ou débito.")
    const paga = await api.mesas.pagar(comanda.id, {
      forma: "cartao-na-entrega",
      valor: 10,
      cartao: "credito",
    })
    expect(paga.pagamentos?.[0]).toMatchObject({ cartao: "credito", valor: 10 })
    expect(paga.eventos?.at(-1)?.texto).toBe("Cartão de crédito R$ 10,00")
  })

  test("acima do saldo recusa, menos em dinheiro, que fecha e dá troco", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await expect(api.mesas.pagar(comanda.id, { forma: "pix", valor: 100.01 })).rejects.toThrow(
      "O valor passa do saldo de R$ 100,00.",
    )
    for (const valor of [0, -5, Number.NaN, 10.005]) {
      await expect(api.mesas.pagar(comanda.id, { forma: "pix", valor })).rejects.toThrow(
        "Informe um valor acima de zero.",
      )
    }
    await expect(
      api.mesas.pagar(comanda.id, { forma: "dinheiro", valor: 50, recebido: 40 }),
    ).rejects.toThrow("O valor recebido é menor que o da parte.")
    const fechada = await api.mesas.pagar(comanda.id, { forma: "dinheiro", valor: 150 })
    expect(fechada.pagamentos).toMatchObject([{ valor: 100, recebido: 150, troco: 50 }])
    expect(fechada).toMatchObject({ status: "concluido", trocoPara: 150 })
  })

  test("por item: o item de R$ 40,00 com 10% paga R$ 44,00 e não se paga de novo", async () => {
    const api = servidor()
    const { mesa } = await abrirMesa(api)
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [
        { avulso: { nome: "Pizza", preco: 40 }, quantidade: 1 },
        { avulso: { nome: "Suco", preco: 9.5 }, quantidade: 1 },
      ],
    })
    const [pizza] = comanda.itens
    const paga = await api.mesas.pagar(comanda.id, { forma: "pix", itens: [pizza.id] })
    expect(paga.pagamentos).toMatchObject([{ forma: "pix", valor: 44, itens: [pizza.id] }])
    expect(paga.eventos?.at(-1)?.texto).toBe("Pix R$ 44,00 · 1 item")
    await expect(api.mesas.pagar(comanda.id, { forma: "pix", itens: [pizza.id] })).rejects.toThrow(
      "Esse item já foi pago.",
    )
    await expect(api.mesas.pagar(comanda.id, { forma: "pix", itens: ["outro"] })).rejects.toThrow(
      "Item não encontrado na comanda",
    )
  })

  test("a conta fechada pelo último pagamento põe a mesa em limpeza, se ligada", async () => {
    for (const limpeza of [true, false]) {
      await clear()
      const api = semTaxa(limpeza)
      const { mesa, comanda } = await contaDeCem(api)
      await api.mesas.pagar(comanda.id, { forma: "pix", valor: 40 })
      await api.mesas.pagar(comanda.id, { forma: "pix", valor: 60 })
      const depois = (await api.mesas.listar()).find((item) => item.id === mesa.id)
      expect(depois?.status).toBe("livre")
      expect(depois?.limpezaDesde).toBe(limpeza ? AGORA.toISOString() : undefined)
    }
  })

  test("fecharConta paga o saldo inteiro de uma vez, como um pagamento", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await api.mesas.pagar(comanda.id, { forma: "pix", valor: 30 })
    const fechada = await api.mesas.fecharConta(comanda.id, "dinheiro")
    expect(fechada.status).toBe("concluido")
    expect(fechada.pagamentos).toMatchObject([
      { forma: "pix", valor: 30 },
      { forma: "dinheiro", valor: 70 },
    ])
  })

  test("Marcar como pago em Pedidos recusa a comanda de mesa aberta", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await expect(api.pedidos.marcarPago(comanda.id)).rejects.toThrow(
      "Receba a conta pela tela de Mesas.",
    )
  })
})

describe("desconto, cortesia, taxa e couvert", () => {
  test("desconto em reais ou em %, com motivo; zero tira o desconto", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    const comDesconto = await api.mesas.descontar(comanda.id, {
      modo: "reais",
      valor: 10,
      motivo: " Cliente antigo ",
      por: "Rafa",
    })
    expect(comDesconto).toMatchObject({
      descontoConta: { modo: "reais", valor: 10, motivo: "Cliente antigo" },
      desconto: 10,
      total: 90,
    })
    expect(comDesconto.eventos?.at(-1)).toMatchObject({
      tipo: "desconto",
      por: "Rafa",
      texto: "Desconto de R$\u00a010,00",
      motivo: "Cliente antigo",
    })

    const porCento = await api.mesas.descontar(comanda.id, {
      modo: "percentual",
      valor: 12.5,
      motivo: "Aniversário",
    })
    expect(porCento).toMatchObject({ desconto: 12.5, total: 87.5 })
    expect(porCento.eventos?.at(-1)?.texto).toBe("Desconto de 12,5% (R$\u00a012,50)")

    // Tirar o desconto pede motivo e fica no histórico (revisão da Fase 4).
    await expect(
      api.mesas.descontar(comanda.id, { modo: "reais", valor: 0, motivo: " " }),
    ).rejects.toThrow("Diga o motivo para tirar o desconto.")
    const semDesconto = await api.mesas.descontar(comanda.id, {
      modo: "reais",
      valor: 0,
      motivo: "Lançado errado",
      por: "Rafa",
    })
    expect(semDesconto).not.toHaveProperty("descontoConta")
    expect(semDesconto.total).toBe(100)
    expect(semDesconto.eventos?.at(-1)).toMatchObject({
      tipo: "desconto",
      por: "Rafa",
      texto: "Tirou o desconto",
      motivo: "Lançado errado",
    })
    await expect(
      api.mesas.descontar(comanda.id, { modo: "reais", valor: 0, motivo: "De novo" }),
    ).rejects.toThrow("Esta conta não tem desconto.")
  })

  test("desconto sem motivo ou acima dos itens recusa", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await expect(
      api.mesas.descontar(comanda.id, { modo: "reais", valor: 10, motivo: "" }),
    ).rejects.toThrow("Diga o motivo do desconto.")
    await expect(
      api.mesas.descontar(comanda.id, { modo: "reais", valor: 100.01, motivo: "Erro" }),
    ).rejects.toThrow("O desconto passa do valor dos itens.")
  })

  test("cortesia zera o item com motivo e não devolve o estoque", async () => {
    const api = semTaxa()
    const [lanche] = (await api.produtos.listar()).filter(
      (produto) => produto.id === "prod-x-burger",
    )
    await api.produtos.salvar({
      ...lanche,
      id: "refri",
      nome: "Refri lata",
      preco: 6,
      grupos: [],
      estoque: { controlar: true, quantidade: 5, minimo: 1, esgotarAoZerar: true },
    })
    const { mesa } = await contaDeCem(api)
    const comRefri = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ produtoId: "refri", escolhas: {}, quantidade: 1 }],
    })
    const refri = comRefri.itens.at(-1)
    if (!refri) throw new Error("O Refri devia estar na comanda")
    expect(comRefri.total).toBe(106)

    const cortesia = await api.mesas.darCortesia(comRefri.id, refri.id, {
      motivo: "Aniversário",
      por: "Rafa",
    })
    expect(cortesia.itens.at(-1)).toMatchObject({ cortesia: { motivo: "Aniversário" }, total: 6 })
    expect(cortesia.total).toBe(100)
    expect(cortesia.eventos?.at(-1)).toMatchObject({
      tipo: "cortesia",
      por: "Rafa",
      texto: "Cortesia: 1× Refri lata",
      motivo: "Aniversário",
    })
    const produto = (await api.produtos.listar()).find((item) => item.id === "refri")
    expect(produto?.estoque?.quantidade).toBe(4)

    await expect(
      api.mesas.darCortesia(comRefri.id, refri.id, { motivo: "De novo" }),
    ).rejects.toThrow("Refri lata já é cortesia.")
    await expect(api.mesas.darCortesia(comRefri.id, refri.id, { motivo: "" })).rejects.toThrow(
      "Diga o motivo da cortesia.",
    )
  })

  test("tirar a taxa e o couvert pede motivo e tira da conta", async () => {
    const api = servidor()
    const { mesa } = await abrirMesa(api)
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [xBurger],
    })
    await expect(api.mesas.tirarTaxa(comanda.id, { motivo: " " })).rejects.toThrow(
      "Diga o motivo para tirar a taxa de serviço.",
    )
    const semTaxaDeServico = await api.mesas.tirarTaxa(comanda.id, {
      motivo: "Demorou",
      por: "Rafa",
    })
    expect(semTaxaDeServico).toMatchObject({
      taxaServico: { percentual: 10, removida: { motivo: "Demorou" } },
      total: 39,
    })
    expect(semTaxaDeServico.eventos?.at(-1)).toMatchObject({
      tipo: "taxa-removida",
      por: "Rafa",
      texto: "Tirou a taxa de serviço",
      motivo: "Demorou",
    })
    await expect(api.mesas.tirarTaxa(comanda.id, { motivo: "De novo" })).rejects.toThrow(
      "Esta conta não tem taxa de serviço.",
    )

    await expect(api.mesas.tirarCouvert(comanda.id, { motivo: "" })).rejects.toThrow(
      "Diga o motivo para tirar o couvert.",
    )
    const semCouvert = await api.mesas.tirarCouvert(comanda.id, { motivo: "Sem música" })
    expect(semCouvert).toMatchObject({ couvert: { removido: { motivo: "Sem música" } }, total: 23 })
    expect(semCouvert.eventos?.at(-1)).toMatchObject({
      tipo: "couvert-removido",
      texto: "Tirou o couvert",
    })
    await expect(api.mesas.tirarCouvert(comanda.id, { motivo: "De novo" })).rejects.toThrow(
      "Esta conta não tem couvert.",
    )
  })

  test("nada deixa a conta menor que o já pago", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await api.mesas.pagar(comanda.id, { forma: "pix", valor: 95 })
    const erro = "A conta ficaria menor que o já pago. Estorne um pagamento antes."
    await expect(
      api.mesas.descontar(comanda.id, { modo: "reais", valor: 10, motivo: "Erro" }),
    ).rejects.toThrow(erro)
    await expect(
      api.mesas.darCortesia(comanda.id, comanda.itens[0].id, { motivo: "Brinde" }),
    ).rejects.toThrow(erro)
    await expect(api.mesas.removerItem(comanda.id, comanda.itens[0].id)).rejects.toThrow(erro)
  })

  test("estornar um pagamento devolve o saldo, com motivo", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    const paga = await api.mesas.pagar(comanda.id, { forma: "pix", valor: 33.33 })
    const [pix] = paga.pagamentos ?? []
    await expect(api.mesas.estornarPagamento(comanda.id, pix.id, { motivo: "" })).rejects.toThrow(
      "Diga o motivo do estorno.",
    )
    await expect(
      api.mesas.estornarPagamento(comanda.id, "pag-outro", { motivo: "Errado" }),
    ).rejects.toThrow("Pagamento não encontrado")
    const estornada = await api.mesas.estornarPagamento(comanda.id, pix.id, {
      motivo: "Pix não caiu",
      por: "Rafa",
    })
    expect(estornada.pagamentos).toEqual([])
    expect(estornada.eventos?.at(-1)).toMatchObject({
      tipo: "pagamento-estornado",
      por: "Rafa",
      texto: "Estornou Pix R$ 33,33",
      motivo: "Pix não caiu",
    })
  })
})

describe("pré-conta", () => {
  test("imprimir a pré-conta marca Pediu a conta; de novo, fica a primeira hora", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    const impressa = await api.mesas.imprimirPreConta(comanda.id, "Rafa")
    expect(impressa.contaPedidaEm).toBe(AGORA.toISOString())
    expect(impressa.eventos?.slice(-2)).toMatchObject([
      { tipo: "conta-pedida", texto: "Pediu a conta", por: "Rafa" },
      { tipo: "pre-conta", texto: "Pré-conta impressa", por: "Rafa" },
    ])

    vi.setSystemTime(new Date(2026, 10, 13, 20, 40))
    const outra = await api.mesas.imprimirPreConta(comanda.id)
    expect(outra.contaPedidaEm).toBe(AGORA.toISOString())
    expect(outra.eventos?.at(-1)?.tipo).toBe("pre-conta")
    expect(outra.eventos?.filter((evento) => evento.tipo === "conta-pedida")).toHaveLength(1)
  })
})

describe("reabrir a conta", () => {
  test("reabre a conta fechada hoje: volta aberta, com os pagamentos, e a mesa sai da limpeza", async () => {
    const api = semTaxa()
    const { mesa, comanda } = await contaDeCem(api)
    await api.mesas.pagar(comanda.id, { forma: "pix", valor: 40 })
    await api.mesas.fecharConta(comanda.id, "dinheiro")
    expect((await api.mesas.listar()).find((item) => item.id === mesa.id)?.limpezaDesde).toBe(
      AGORA.toISOString(),
    )

    vi.setSystemTime(new Date(2026, 10, 13, 21, 0))
    const reaberta = await api.mesas.reabrir(comanda.id, {
      motivo: "Faltou a sobremesa",
      por: "Rafa",
    })
    expect(reaberta).toMatchObject({ status: "pronto", situacaoPagamento: "na-entrega" })
    expect(reaberta).not.toHaveProperty("pagoEm")
    expect(reaberta.pagamentos).toMatchObject([{ valor: 40 }, { valor: 60 }])
    expect(reaberta.eventos?.at(-1)).toMatchObject({
      tipo: "reaberta",
      por: "Rafa",
      texto: "Conta reaberta",
      motivo: "Faltou a sobremesa",
    })
    const depois = (await api.mesas.listar()).find((item) => item.id === mesa.id)
    expect(depois).toMatchObject({ status: "ocupada", pedidoAtivoId: comanda.id })
    expect(depois).not.toHaveProperty("limpezaDesde")
  })

  test("sem motivo, com a mesa já aberta ou na penúltima conta, recusa", async () => {
    const api = semTaxa()
    const { mesa, comanda } = await contaDeCem(api)
    await api.mesas.fecharConta(comanda.id, "pix")
    await expect(api.mesas.reabrir(comanda.id, { motivo: " " })).rejects.toThrow(
      "Diga o motivo para reabrir a conta.",
    )
    const segunda = await api.mesas.abrir(mesa.id, { pessoas: 2, garcom: "Rafa" })
    await expect(api.mesas.reabrir(comanda.id, { motivo: "Erro" })).rejects.toThrow(
      "A mesa 30 já está aberta.",
    )
    await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    await api.mesas.fecharConta(segunda.id, "pix")
    await expect(api.mesas.reabrir(comanda.id, { motivo: "Erro" })).rejects.toThrow(
      "Só dá para reabrir a última conta da mesa.",
    )
  })

  test("virada do dia: aberta às 23:40 e paga às 00:10 reabre às 00:30, mas não no dia seguinte", async () => {
    vi.setSystemTime(new Date(2026, 10, 13, 23, 40))
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    vi.setSystemTime(new Date(2026, 10, 14, 0, 10))
    await api.mesas.fecharConta(comanda.id, "pix")

    vi.setSystemTime(new Date(2026, 10, 15, 0, 30))
    await expect(api.mesas.reabrir(comanda.id, { motivo: "Erro" })).rejects.toThrow(
      "Só dá para reabrir a conta no mesmo dia.",
    )
    vi.setSystemTime(new Date(2026, 10, 14, 0, 30))
    const reaberta = await api.mesas.reabrir(comanda.id, { motivo: "Erro" })
    expect(reaberta.status).toBe("pronto")
  })

  test("ultimaConta: a conta fechada hoje da mesa livre; nada na mesa ocupada ou sem conta hoje", async () => {
    const api = semTaxa()
    const { mesa, comanda } = await contaDeCem(api)
    expect(await api.mesas.ultimaConta(mesa.id)).toBeNull()
    await api.mesas.fecharConta(comanda.id, "pix")
    expect((await api.mesas.ultimaConta(mesa.id))?.id).toBe(comanda.id)
    vi.setSystemTime(new Date(2026, 10, 14, 12, 0))
    expect(await api.mesas.ultimaConta(mesa.id)).toBeNull()
  })
})

describe("conta com saldo zero", () => {
  test("tudo em cortesia, sem couvert: Fechar conta fecha sem pagamento", async () => {
    const api = semTaxa()
    const { mesa, comanda } = await contaDeCem(api)
    await api.mesas.darCortesia(comanda.id, comanda.itens[0].id, { motivo: "Aniversário" })
    const fechada = await api.mesas.fecharConta(comanda.id, undefined, { por: "Rafa" })
    expect(fechada).toMatchObject({
      status: "concluido",
      situacaoPagamento: "pago",
      pagoEm: AGORA.toISOString(),
      total: 0,
    })
    expect(fechada.pagamentos ?? []).toEqual([])
    expect(fechada.eventos?.at(-1)).toMatchObject({
      tipo: "fechada",
      por: "Rafa",
      texto: "Conta fechada",
    })
    expect((await api.mesas.listar()).find((item) => item.id === mesa.id)?.status).toBe("livre")
  })

  test("o desconto que zera o saldo de uma conta já paga em parte fecha a conta sozinho", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await api.mesas.pagar(comanda.id, { forma: "pix", valor: 90 })
    const fechada = await api.mesas.descontar(comanda.id, {
      modo: "reais",
      valor: 10,
      motivo: "Demorou",
      por: "Rafa",
    })
    expect(fechada).toMatchObject({
      status: "concluido",
      situacaoPagamento: "pago",
      pagoEm: AGORA.toISOString(),
      pagamento: "pix",
      total: 90,
    })
    expect(fechada.eventos?.slice(-2)).toMatchObject([
      { tipo: "desconto", texto: "Desconto de R$\u00a010,00" },
      { tipo: "fechada", por: "Rafa", texto: "Conta fechada" },
    ])
  })

  test("reaberta sem mudar nada, fecha de novo pelo Fechar conta", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await api.mesas.fecharConta(comanda.id, "pix")
    vi.setSystemTime(new Date(2026, 10, 13, 21, 0))
    await api.mesas.reabrir(comanda.id, { motivo: "Engano" })
    const fechada = await api.mesas.fecharConta(comanda.id)
    expect(fechada).toMatchObject({ status: "concluido", pagoEm: "2026-11-14T00:00:00.000Z" })
    expect(fechada.pagamentos).toMatchObject([{ forma: "pix", valor: 100 }])
  })

  test("sem saldo, não recebe nada, nem em dinheiro", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await api.mesas.fecharConta(comanda.id, "pix")
    vi.setSystemTime(new Date(2026, 10, 13, 21, 0))
    await api.mesas.reabrir(comanda.id, { motivo: "Engano" })
    for (const forma of ["dinheiro", "pix"] as const) {
      await expect(api.mesas.pagar(comanda.id, { forma, valor: 0.01 })).rejects.toThrow(
        "Não há saldo a receber. Feche a conta.",
      )
    }
  })

  test("com saldo, Fechar conta sem forma recusa", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    await expect(api.mesas.fecharConta(comanda.id)).rejects.toThrow(
      "Escolha uma forma de pagamento válida.",
    )
  })
})

describe("virada do dia", () => {
  test("aberta às 23:40 com R$ 30,00 em Pix, segue aberta depois da recarga às 00:05 e fecha às 00:10 no dia novo", async () => {
    vi.setSystemTime(new Date(2026, 10, 13, 23, 40))
    const { comanda } = await contaDeCem(semTaxa())
    await semTaxa().mesas.pagar(comanda.id, { forma: "pix", valor: 30 })

    // Recarregar a página no dia seguinte: outra instância do servidor completa o dia.
    vi.setSystemTime(new Date(2026, 10, 14, 0, 5))
    const depois = semTaxa()
    const aberta = await depois.pedidos.buscar(comanda.id)
    expect(aberta).toMatchObject({ status: "pronto", situacaoPagamento: "na-entrega", total: 100 })
    expect(aberta).not.toHaveProperty("pagoEm")
    expect(resumoDaConta(aberta as Pedido).saldo).toBe(70)

    vi.setSystemTime(new Date(2026, 10, 14, 0, 10))
    const fechada = await depois.mesas.fecharConta(comanda.id, "dinheiro")
    expect(fechada).toMatchObject({ status: "concluido", pagoEm: "2026-11-14T03:10:00.000Z" })
    expect(pagoNoDiaSemTaxa(fechada, new Date(2026, 10, 14, 12, 0))).toBe(70)
    expect(pagoNoDiaSemTaxa(fechada, new Date(2026, 10, 13, 12, 0))).toBe(30)
  })
})

describe("item em cortesia ou já pago", () => {
  test("não aumenta: o pedido a mais é lançado de novo", async () => {
    const api = semTaxa()
    const { mesa } = await abrirMesa(api)
    const comanda = await api.mesas.lancar({
      mesaId: mesa.id,
      enviarParaCozinha: false,
      itens: [
        { avulso: { nome: "Refri", preco: 6 }, quantidade: 1 },
        { avulso: { nome: "Pizza", preco: 50 }, quantidade: 1 },
        { avulso: { nome: "Suco", preco: 9 }, quantidade: 1 },
      ],
    })
    const [refri, pizza, suco] = comanda.itens
    await api.mesas.darCortesia(comanda.id, refri.id, { motivo: "Brinde" })
    await api.mesas.pagar(comanda.id, { forma: "pix", itens: [pizza.id] })
    for (const item of [refri, pizza]) {
      await expect(api.mesas.alterarQuantidade(comanda.id, item.id, 2)).rejects.toThrow(
        "Lance o item de novo.",
      )
    }
    const mais = await api.mesas.alterarQuantidade(comanda.id, suco.id, 2)
    expect(mais.itens[2]).toMatchObject({ quantidade: 2, total: 18 })
  })
})

describe("cancelar a comanda", () => {
  test("com pagamento recusa: o dinheiro recebido não some", async () => {
    const api = semTaxa()
    const { comanda } = await contaDeCem(api)
    const paga = await api.mesas.pagar(comanda.id, { forma: "pix", valor: 30 })
    await expect(api.mesas.cancelarComanda(comanda.id, { motivo: "Foi embora" })).rejects.toThrow(
      "Estorne os pagamentos antes.",
    )
    const [pix] = paga.pagamentos ?? []
    await api.mesas.estornarPagamento(comanda.id, pix.id, { motivo: "Devolvido" })
    const cancelada = await api.mesas.cancelarComanda(comanda.id, { motivo: "Foi embora" })
    expect(cancelada.status).toBe("cancelado")
  })
})
