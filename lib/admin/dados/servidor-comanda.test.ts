import "fake-indexeddb/auto"
import { clear, get, set } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"
import type { CatalogoLoja, ControleEstoque, Produto } from "./tipos"

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)
const CHAVE = "clickpedido-admin-dados:lanchonete"

const controle = (quantidade: number): ControleEstoque => ({
  controlar: true,
  quantidade,
  minimo: 2,
  esgotarAoZerar: true,
})

/**
 * Lanchonete de teste com garçons (Rafa e Bia ativos, Lucas inativo) e estoque: Refri lata
 * (5 un) e Bacon (10 un), ligado à opção "Bacon" do X-Burger.
 */
function catalogo(mudar?: (catalogo: CatalogoLoja) => void) {
  const base = catalogoDeTeste()
  base.salao.garcons = [
    { id: "garcom-rafa", nome: "Rafa", ativo: true },
    { id: "garcom-bia", nome: "Bia", ativo: true },
    { id: "garcom-lucas", nome: "Lucas", ativo: false },
  ]
  const [lanche] = base.produtos
  const refri: Produto = {
    ...lanche,
    id: "refri",
    nome: "Refri lata",
    preco: 6,
    grupos: [],
    custo: 3,
    estoque: controle(5),
  }
  const bacon: Produto = { ...refri, id: "bacon", nome: "Bacon", preco: 3, estoque: controle(10) }
  lanche.grupos[0].itens[0].produtoId = "bacon"
  base.produtos.push(refri, bacon)
  mudar?.(base)
  return base
}

function servidor(mudar?: (catalogo: CatalogoLoja) => void) {
  return criarServidor({
    segmento: "lanchonete",
    carregarCatalogo: async () => catalogo(mudar),
    espera: 0,
  })
}

/** Mesa nova, livre: as mesas 1 e 2 do catálogo podem ter comanda gerada pela demonstração. */
const mesaLivre = async (api: ReturnType<typeof servidor>, numero = 30) =>
  (await api.mesas.criar({ numero })).id

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("abrir mesa", () => {
  test("abre a mesa 1 para 3 pessoas com Rafa: comanda vazia, mesa ocupada e o evento de abertura", async () => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    const comanda = await api.mesas.abrir(mesaId, {
      pessoas: 3,
      garcom: "Rafa",
      clienteNome: " Ana ",
    })

    expect(comanda).toMatchObject({
      tipo: "mesa",
      itens: [],
      total: 0,
      cliente: { nome: "Ana" },
      mesa: { id: mesaId, numero: 30, garcom: "Rafa", pessoas: 3 },
      eventos: [
        {
          tipo: "aberta",
          em: AGORA.toISOString(),
          por: "Rafa",
          texto: "Mesa aberta para 3 pessoas",
        },
      ],
    })
    const mesa = (await api.mesas.listar()).find((item) => item.id === mesaId)
    expect(mesa).toMatchObject({ status: "ocupada", pedidoAtivoId: comanda.id })
  })

  test.each([0, 100, 2.5, Number.NaN])("%s pessoas: recusa", async (pessoas) => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    await expect(api.mesas.abrir(mesaId, { pessoas, garcom: "Rafa" })).rejects.toThrow(
      "Informe de 1 a 99 pessoas.",
    )
  })

  test("o garçom é obrigatório e tem que ser um dos ativos do salão", async () => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    await expect(api.mesas.abrir(mesaId, { pessoas: 2 })).rejects.toThrow("Escolha o garçom.")
    for (const garcom of ["Lucas", "Zé", "  "]) {
      await expect(api.mesas.abrir(mesaId, { pessoas: 2, garcom })).rejects.toThrow(
        garcom.trim() ? "Esse garçom não está na lista do salão." : "Escolha o garçom.",
      )
    }
  })

  test("sem nenhum garçom ativo no salão, abre sem garçom", async () => {
    const api = servidor((catalogo) => {
      catalogo.salao.garcons = [{ id: "garcom-lucas", nome: "Lucas", ativo: false }]
    })
    const mesaId = await mesaLivre(api)
    const comanda = await api.mesas.abrir(mesaId, { pessoas: 2 })
    expect(comanda.mesa).toEqual({ id: mesaId, numero: 30, pessoas: 2 })
    expect(comanda.eventos?.[0]).not.toHaveProperty("por")
  })

  test("mesa bloqueada, já aberta ou inexistente recusa", async () => {
    const api = servidor()
    const bloqueada = await mesaLivre(api, 31)
    await api.mesas.bloquear(bloqueada, "Pé quebrado")
    await expect(api.mesas.abrir(bloqueada, { pessoas: 2, garcom: "Rafa" })).rejects.toThrow(
      "A mesa 31 está bloqueada.",
    )
    const mesaId = await mesaLivre(api)
    await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })
    await expect(api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Bia" })).rejects.toThrow(
      "A mesa 30 já está aberta.",
    )
    await expect(api.mesas.abrir("mesa-99", { pessoas: 2, garcom: "Rafa" })).rejects.toThrow(
      "Mesa não encontrada",
    )
  })

  test("5 pessoas numa mesa de 4 lugares abre; a mesa em limpeza abre e sai da limpeza", async () => {
    const api = servidor((catalogo) => {
      catalogo.salao.limpeza = true
    })
    const mesaId = await mesaLivre(api)
    const anterior = await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    await api.mesas.fecharConta(anterior.id, "pix")
    expect(
      (await api.mesas.listar()).find((item) => item.id === mesaId)?.limpezaDesde,
    ).toBeDefined()

    const comanda = await api.mesas.abrir(mesaId, { pessoas: 5, garcom: "Bia" })
    expect(comanda.mesa?.pessoas).toBe(5)
    const mesa = (await api.mesas.listar()).find((item) => item.id === mesaId)
    expect(mesa?.status).toBe("ocupada")
    expect(mesa).not.toHaveProperty("limpezaDesde")
  })

  test("mesa reservada às 20:45 (agora 20:30, antecedência 30) só abre com confirmarReserva", async () => {
    const mesaId = await mesaLivre(servidor())
    // A Fase 7 ainda não tem a operação de reservar: a reserva entra direto na base guardada.
    const guardado = await get(CHAVE)
    guardado.base.reservas = [
      {
        id: "reserva-1",
        nome: "Carla",
        inicio: new Date(2026, 10, 13, 20, 45).toISOString(),
        pessoas: 2,
        mesaId,
        status: "marcada",
      },
    ]
    await set(CHAVE, guardado)
    const api = servidor()

    await expect(api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })).rejects.toThrow(
      "A mesa 30 está reservada às 20:45. Confirme para abrir.",
    )
    const comanda = await api.mesas.abrir(mesaId, {
      pessoas: 2,
      garcom: "Rafa",
      confirmarReserva: true,
    })
    expect(comanda.mesa?.id).toBe(mesaId)
  })
})

describe("lançar na comanda", () => {
  test("cada rodada entra no histórico, com o destino, os itens e quem lançou", async () => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })
    await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: true,
      por: "Bia",
      itens: [{ produtoId: "refri", escolhas: {}, quantidade: 2 }],
    })
    const comanda = await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    expect(comanda.eventos?.slice(1)).toEqual([
      {
        tipo: "rodada",
        em: AGORA.toISOString(),
        por: "Bia",
        texto: "Rodada 1 para a cozinha: 2× Refri lata",
      },
      { tipo: "rodada", em: AGORA.toISOString(), texto: "Rodada 2 lançada na mesa: 1× Água" },
    ])
  })

  test("lançar depois de pedir a conta limpa o pedido de conta", async () => {
    const api = servidor()
    const mesaId = await mesaLivre(api)
    const aberta = await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })
    await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    expect((await api.mesas.pedirConta(aberta.id)).contaPedidaEm).toBe(AGORA.toISOString())

    const comanda = await api.mesas.lancar({
      mesaId,
      enviarParaCozinha: true,
      itens: [{ produtoId: "refri", escolhas: {}, quantidade: 1 }],
    })
    expect(comanda).not.toHaveProperty("contaPedidaEm")
  })
})
