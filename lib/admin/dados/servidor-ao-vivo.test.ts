import "fake-indexeddb/auto"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { exclusivo } from "./bloqueio"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"

/** Uma aba do navegador: cada uma tem o seu servidor, sobre o mesmo IndexedDB. */
function aba(aoGravar?: () => void) {
  return criarServidor({
    segmento: "lanchonete",
    carregarCatalogo: async () => catalogoDeTeste(),
    espera: 0,
    ...(aoGravar ? { aoGravar } : {}),
  })
}

const numeros = async (api: ReturnType<typeof aba>) =>
  (await api.mesas.listar()).map((mesa) => mesa.numero)

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 10, 13, 20, 30))
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("duas abas sobre a mesma base", () => {
  test("a aba desatualizada grava sem apagar o que a outra gravou", async () => {
    const a = aba()
    const b = aba()
    await a.mesas.listar()
    await b.mesas.listar()

    await a.mesas.criar({ numero: 30 })
    await b.mesas.criar({ numero: 31 })

    expect(await numeros(aba())).toEqual([1, 2, 30, 31])
  })

  test("A e B gravam quase juntas: as duas gravações ficam", async () => {
    const a = aba()
    const b = aba()
    await a.mesas.listar()
    await b.mesas.listar()

    await Promise.all([a.mesas.criar({ numero: 30 }), b.mesas.criar({ numero: 31 })])

    expect(await numeros(aba())).toEqual([1, 2, 30, 31])
  })

  test("na mesma aba, duas gravações juntas não se apagam", async () => {
    const api = aba()
    await api.mesas.listar()

    await Promise.all([api.mesas.criar({ numero: 30 }), api.mesas.criar({ numero: 31 })])

    expect(await numeros(aba())).toEqual([1, 2, 30, 31])
  })

  test("enquanto outra aba grava, a leitura não espera; a gravação espera a vez", async () => {
    const api = aba()
    await api.mesas.listar()
    let liberar = () => {}
    // Outra aba no meio de uma gravação: segura a vez da base.
    const outra = exclusivo(
      "clickpedido-admin-dados:lanchonete",
      () => new Promise<void>((pronto) => (liberar = pronto)),
    )
    let gravou = false
    const gravacao = api.mesas.criar({ numero: 30 }).then(() => (gravou = true))

    expect(await numeros(api)).toEqual([1, 2])
    expect(gravou).toBe(false)

    liberar()
    await outra
    await gravacao
    expect(await numeros(api)).toEqual([1, 2, 30])
  })

  test("a outra aba já lê o que foi gravado, sem recarregar", async () => {
    const a = aba()
    const b = aba()
    await b.mesas.listar()

    await a.mesas.criar({ numero: 30 })

    expect(await numeros(b)).toEqual([1, 2, 30])
  })
})

describe("aviso e memória", () => {
  test("com o localStorage bloqueado, a aba continua lendo e gravando", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Bloqueado")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Bloqueado")
    })
    const api = aba()

    await api.mesas.criar({ numero: 30 })

    expect(await numeros(api)).toEqual([1, 2, 30])
  })

  test("com o localStorage bloqueado, a aba desatualizada não apaga o que a outra gravou", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Bloqueado")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Bloqueado")
    })
    const a = aba()
    const b = aba()
    await a.mesas.listar()
    await b.mesas.listar()

    await a.mesas.criar({ numero: 30 })
    await b.mesas.criar({ numero: 31 })

    expect(await numeros(aba())).toEqual([1, 2, 30, 31])
  })

  test("aoGravar é chamado uma vez por gravação", async () => {
    const aoGravar = vi.fn()
    const api = aba(aoGravar)
    await api.mesas.listar()
    aoGravar.mockClear()

    await api.mesas.criar({ numero: 30 })

    expect(aoGravar).toHaveBeenCalledTimes(1)
  })

  test("esquecer faz a próxima leitura voltar ao IndexedDB", async () => {
    let lidas = 0
    const api = criarServidor({
      segmento: "lanchonete",
      carregarCatalogo: async () => {
        lidas += 1
        return catalogoDeTeste()
      },
      espera: 0,
    })
    await api.mesas.listar()
    await clear()

    api.esquecer()
    await api.mesas.listar()

    expect(lidas).toBe(2)
  })
})
