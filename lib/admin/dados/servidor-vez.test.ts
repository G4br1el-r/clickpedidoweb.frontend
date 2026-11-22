import "fake-indexeddb/auto"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"

/** O IndexedDB do navegador (fronteira): dá para segurar a gravação até o teste soltar. */
const disco = vi.hoisted(() => ({ segurar: false, soltar: [] as (() => void)[] }))

vi.mock("idb-keyval", async (original) => {
  const real = await original<typeof import("idb-keyval")>()
  return {
    ...real,
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
  await clear()
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
