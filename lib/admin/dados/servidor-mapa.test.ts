import "fake-indexeddb/auto"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)

/** Lanchonete de teste: as mesas 1 e 2 do Salão, em (0, 0) e (4, 0). */
function servidor() {
  return criarServidor({
    segmento: "lanchonete",
    carregarCatalogo: async () => catalogoDeTeste(),
    espera: 0,
  })
}

const posicoes = async (api: ReturnType<typeof servidor>) =>
  Object.fromEntries((await api.mesas.listar()).map((mesa) => [mesa.numero, mesa.posicao]))

/** Cria a Varanda e uma mesa 5 nela, em (0, 0). */
async function comVaranda(api: ReturnType<typeof servidor>) {
  const salao = await api.salao.config()
  await api.salao.salvar({
    ...salao,
    areas: [...salao.areas, { id: "area-varanda", nome: "Varanda", ordem: 2 }],
  })
  return api.mesas.criar({ numero: 5, areaId: "area-varanda" })
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("posicionar as mesas", () => {
  test("grava as posições do lote e devolve as mesas, pelo número", async () => {
    const api = servidor()
    const movidas = await api.mesas.posicionar([
      { id: "mesa-2", posicao: { x: 0, y: 8 } },
      { id: "mesa-1", posicao: { x: 10, y: 3 } },
    ])

    expect(movidas.map((mesa) => [mesa.numero, mesa.posicao])).toEqual([
      [1, { x: 10, y: 3 }],
      [2, { x: 0, y: 8 }],
    ])
    expect(await posicoes(servidor())).toEqual({ 1: { x: 10, y: 3 }, 2: { x: 0, y: 8 } })
  })

  test("mesa por cima de outra recusa o lote inteiro, sem gravar nada", async () => {
    const api = servidor()
    await api.mesas.criar({ numero: 3 }) // nasce em (2, 0)

    await expect(
      api.mesas.posicionar([
        { id: "mesa-2", posicao: { x: 10, y: 10 } },
        { id: "mesa-1", posicao: { x: 3, y: 1 } },
      ]),
    ).rejects.toThrow("A mesa 1 ficaria sobre a mesa 3.")
    expect(await posicoes(servidor())).toEqual({
      1: { x: 0, y: 0 },
      2: { x: 4, y: 0 },
      3: { x: 2, y: 0 },
    })
  })

  test.each([
    ["passa da coluna 24", { x: 23, y: 0 }],
    ["passa da linha 16", { x: 0, y: 15 }],
    ["negativa", { x: -1, y: 0 }],
    ["quebrada", { x: 1.5, y: 0 }],
  ])("posição que %s recusa com a mensagem do mapa", async (_nome, posicao) => {
    const api = servidor()
    await expect(api.mesas.posicionar([{ id: "mesa-1", posicao }])).rejects.toThrow(
      "A mesa 1 sai do mapa.",
    )
    expect((await posicoes(servidor()))[1]).toEqual({ x: 0, y: 0 })
  })

  test("mesa que não existe recusa o lote inteiro", async () => {
    const api = servidor()
    await expect(
      api.mesas.posicionar([
        { id: "mesa-1", posicao: { x: 10, y: 10 } },
        { id: "nada", posicao: { x: 0, y: 8 } },
      ]),
    ).rejects.toThrow("Mesa não encontrada")
    expect((await posicoes(servidor()))[1]).toEqual({ x: 0, y: 0 })
  })

  test("mesas de áreas diferentes no mesmo lote são recusadas", async () => {
    const api = servidor()
    const varanda = await comVaranda(api)
    await expect(
      api.mesas.posicionar([
        { id: "mesa-1", posicao: { x: 10, y: 10 } },
        { id: varanda.id, posicao: { x: 0, y: 8 } },
      ]),
    ).rejects.toThrow("Salve as posições de uma área por vez.")
    expect((await posicoes(servidor()))[1]).toEqual({ x: 0, y: 0 })
  })

  test("trocar duas mesas de lugar no mesmo lote vale: a conferência é do resultado final", async () => {
    const api = servidor()
    await api.mesas.posicionar([
      { id: "mesa-1", posicao: { x: 4, y: 0 } },
      { id: "mesa-2", posicao: { x: 0, y: 0 } },
    ])
    expect(await posicoes(servidor())).toEqual({ 1: { x: 4, y: 0 }, 2: { x: 0, y: 0 } })
  })

  test("mesa de outra área no mesmo lugar não colide", async () => {
    const api = servidor()
    await comVaranda(api) // a mesa 5 da Varanda está em (0, 0)
    await api.mesas.posicionar([{ id: "mesa-1", posicao: { x: 1, y: 1 } }])
    expect((await posicoes(servidor()))[1]).toEqual({ x: 1, y: 1 })
  })

  test("mesa aberta e mesa bloqueada se movem sem mudar a comanda nem o bloqueio", async () => {
    // Mesas novas: as do catálogo podem ter comanda da demonstração.
    const api = servidor()
    const aberta = await api.mesas.criar({ numero: 30 })
    const bloqueada = await api.mesas.criar({ numero: 31 })
    const comanda = await api.mesas.lancar({
      mesaId: aberta.id,
      enviarParaCozinha: false,
      itens: [{ avulso: { nome: "Água", preco: 4 }, quantidade: 1 }],
    })
    await api.mesas.bloquear(bloqueada.id, "Em manutenção")
    await api.mesas.posicionar([
      { id: aberta.id, posicao: { x: 0, y: 10 } },
      { id: bloqueada.id, posicao: { x: 20, y: 10 } },
    ])
    const lista = await servidor().mesas.listar()
    const [um, dois] = [aberta, bloqueada].map((mesa) => lista.find((m) => m.id === mesa.id))
    expect(um).toMatchObject({
      status: "ocupada",
      pedidoAtivoId: comanda.id,
      posicao: { x: 0, y: 10 },
    })
    expect(dois).toMatchObject({ bloqueio: { motivo: "Em manutenção" }, posicao: { x: 20, y: 10 } })
  })

  test("lote vazio não muda nada", async () => {
    expect(await servidor().mesas.posicionar([])).toEqual([])
    expect(await posicoes(servidor())).toEqual({ 1: { x: 0, y: 0 }, 2: { x: 4, y: 0 } })
  })
})
