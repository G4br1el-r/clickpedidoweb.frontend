import "fake-indexeddb/auto"
import { clear, get, set } from "idb-keyval"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"
import type { BaseLoja } from "./tipos"

/** O IndexedDB do navegador (fronteira): dá para segurar a gravação até o teste soltar. */
const disco = vi.hoisted(() => ({
  segurar: false,
  soltar: [] as (() => void)[],
  /** Roda uma vez, na próxima leitura do disco: outra aba gravando no meio. */
  aoLer: undefined as (() => Promise<void>) | undefined,
}))

vi.mock("idb-keyval", async (original) => {
  const real = await original<typeof import("idb-keyval")>()
  return {
    ...real,
    get: async (...argumentos: Parameters<typeof real.get>) => {
      const valor = await real.get(...argumentos)
      const aoLer = disco.aoLer
      disco.aoLer = undefined
      await aoLer?.()
      return valor
    },
    set: (...argumentos: Parameters<typeof real.set>) => {
      const gravar = () => real.set(...argumentos)
      if (!disco.segurar) return gravar()
      // A transação já entrou na fila do IndexedDB; só a resposta demora.
      const gravando = gravar()
      return new Promise<void>((pronto, falhou) =>
        disco.soltar.push(() => gravando.then(pronto, falhou)),
      )
    },
  }
})

function aba() {
  return criarServidor({
    segmento: "lanchonete",
    carregarCatalogo: async () => catalogoDeTeste(),
    espera: 0,
  })
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  disco.segurar = false
  disco.soltar = []
  disco.aoLer = undefined
  await clear()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

test("a próxima gravação não espera o IndexedDB terminar a anterior", async () => {
  const api = aba()
  await api.mesas.listar()
  disco.segurar = true

  const primeira = api.mesas.criar({ numero: 30 })
  const segunda = api.mesas.criar({ numero: 31 })

  // As duas mudaram a base antes de o disco responder à primeira.
  await vi.waitFor(() => expect(disco.soltar).toHaveLength(2))
  expect((await api.mesas.listar()).map((mesa) => mesa.numero)).toEqual([1, 2, 30, 31])

  for (const soltar of disco.soltar) soltar()
  await Promise.all([primeira, segunda])
  expect((await aba().mesas.listar()).map((mesa) => mesa.numero)).toEqual([1, 2, 30, 31])
})

test("outra aba grava entre a leitura e a gravação desta: a gravação refaz sobre a base nova", async () => {
  const a = aba()
  await a.mesas.listar()
  // Uma aba grava a mesa 30: a aba A vai reler a base na próxima mudança.
  await aba().mesas.criar({ numero: 30 })
  // Enquanto A relê, uma terceira aba (sem passar por esta página) grava a mesa 32.
  disco.aoLer = async () => {
    const chave = "clickpedido-admin-dados:lanchonete"
    const guardado = (await get(chave)) as { base: BaseLoja }
    const [modelo] = guardado.base.mesas
    guardado.base.mesas.push({ ...modelo, id: "mesa-32", numero: 32, posicao: { x: 0, y: 8 } })
    await set(chave, guardado)
    localStorage.setItem(`${chave}:revisao`, "outra-aba")
  }

  await a.mesas.criar({ numero: 31 })

  expect((await aba().mesas.listar()).map((mesa) => mesa.numero)).toEqual([1, 2, 30, 31, 32])
})
