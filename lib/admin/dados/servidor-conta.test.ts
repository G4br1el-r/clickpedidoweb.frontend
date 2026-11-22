import "fake-indexeddb/auto"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor, type ItemLancado } from "./servidor"
import type { CatalogoLoja } from "./tipos"

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
