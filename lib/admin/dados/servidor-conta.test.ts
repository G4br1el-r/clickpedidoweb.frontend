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
