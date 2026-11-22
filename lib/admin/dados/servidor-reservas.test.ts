import "fake-indexeddb/auto"
import { clear, get, set } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"
import type { BaseLoja } from "./tipos"

const CHAVE = "clickpedido-admin-dados:lanchonete"

/** Muda a base guardada direto, como outra aba faria. */
async function naBase(mudar: (base: BaseLoja) => void) {
  const guardado = (await get(CHAVE)) as { base: BaseLoja }
  mudar(guardado.base)
  await set(CHAVE, guardado)
}

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)
const as = (hora: string, dia = 13) => {
  const [h, m] = hora.split(":").map(Number)
  return new Date(2026, 10, dia, h, m).toISOString()
}

/** Lanchonete de teste: as mesas 1 e 2 do Salão, 4 lugares cada, sem garçons. */
function servidor() {
  return criarServidor({
    segmento: "lanchonete",
    carregarCatalogo: async () => catalogoDeTeste(),
    espera: 0,
  })
}

type Api = ReturnType<typeof servidor>

/** Mesa nova (30 e acima: as do catálogo têm comanda da demonstração). */
const mesaNova = async (api: Api, numero: number) => (await api.mesas.criar({ numero })).id

const marina = { nome: "Marina Costa", telefone: "12991234567", inicio: as("20:50"), pessoas: 2 }

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("reservas", () => {
  test("criar grava a reserva marcada, e listar traz as de hoje pelo horário", async () => {
    const api = servidor()
    await api.reservas.criar({ ...marina, nome: "Roberto", inicio: as("22:30") })
    const criada = await api.reservas.criar({ ...marina, mesaId: "mesa-1" })

    expect(criada).toMatchObject({ ...marina, mesaId: "mesa-1", status: "marcada" })
    expect((await servidor().reservas.listar()).map((reserva) => reserva.nome)).toEqual([
      "Marina Costa",
      "Roberto",
    ])
  })
})

describe("reservas: o que o servidor confere", () => {
  test("a reserva de ontem não entra na lista de hoje", async () => {
    await servidor().reservas.criar(marina)
    await naBase((base) => {
      base.reservas.push({ ...base.reservas[0], id: "ontem", inicio: as("20:00", 12) })
    })
    expect((await servidor().reservas.listar()).map((reserva) => reserva.id)).not.toContain("ontem")
  })

  test.each([
    [{ nome: "  " }, "Informe o nome."],
    [{ telefone: "123456789" }, "Informe o telefone com DDD."],
    [{ pessoas: 0 }, "Informe de 1 a 99 pessoas."],
    [{ pessoas: 2.5 }, "Informe de 1 a 99 pessoas."],
    [{ inicio: as("20:29") }, "Esse horário já passou."],
    [{ inicio: "amanhã" }, "Informe o horário."],
    [{ inicio: as("20:50", 14) }, "Reserve para hoje."],
    [{ mesaId: "mesa-9" }, "Mesa não encontrada"],
  ])("recusa %o: %s", async (mudanca, erro) => {
    const api = servidor()
    await expect(api.reservas.criar({ ...marina, ...mudanca })).rejects.toThrow(erro)
    expect(await api.reservas.listar()).toEqual([])
  })

  test("recusa a mesa bloqueada", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    await api.mesas.bloquear(mesaId)
    await expect(api.reservas.criar({ ...marina, mesaId })).rejects.toThrow(
      "A mesa 30 está bloqueada.",
    )
  })

  test("recusa outra reserva da mesma mesa a menos de 2 h", async () => {
    const api = servidor()
    await api.reservas.criar({ ...marina, mesaId: "mesa-1" })
    await expect(
      api.reservas.criar({ ...marina, nome: "Outra", inicio: as("22:00"), mesaId: "mesa-1" }),
    ).rejects.toThrow("A mesa 1 já tem reserva às 20:50.")
    await expect(
      api.reservas.criar({ ...marina, nome: "Outra", inicio: as("22:50"), mesaId: "mesa-1" }),
    ).resolves.toMatchObject({ nome: "Outra" })
  })

  test("o nome é aparado e o telefone fica só com os dígitos", async () => {
    const criada = await servidor().reservas.criar({
      ...marina,
      nome: "  Marina  ",
      telefone: "(12) 99123-4567",
    })
    expect(criada).toMatchObject({ nome: "Marina", telefone: "12991234567" })
  })
})

describe("reservas: editar, cancelar e não compareceu", () => {
  test("editar troca os dados e não conflita consigo", async () => {
    const api = servidor()
    const { id } = await api.reservas.criar({ ...marina, mesaId: "mesa-1" })
    const editada = await api.reservas.editar(id, {
      ...marina,
      inicio: as("21:00"),
      pessoas: 3,
      mesaId: "mesa-1",
    })
    expect(editada).toMatchObject({ id, inicio: as("21:00"), pessoas: 3, status: "marcada" })
    expect(await servidor().reservas.listar()).toEqual([editada])
  })

  test("a reserva atrasada ainda se edita, sem mudar o horário", async () => {
    const api = servidor()
    const { id } = await api.reservas.criar(marina)
    vi.setSystemTime(new Date(2026, 10, 13, 20, 55))
    await expect(api.reservas.editar(id, { ...marina, mesaId: "mesa-2" })).resolves.toMatchObject({
      mesaId: "mesa-2",
    })
  })

  test("cancelar e não compareceu gravam o status e soltam a mesa", async () => {
    const api = servidor()
    const [trinta, trintaEUm] = [await mesaNova(api, 30), await mesaNova(api, 31)]
    const um = await api.reservas.criar({ ...marina, mesaId: trinta })
    const dois = await api.reservas.criar({ ...marina, mesaId: trintaEUm })
    expect(await api.reservas.cancelar(um.id)).toMatchObject({ status: "cancelada" })
    expect(await api.reservas.naoCompareceu(dois.id)).toMatchObject({ status: "nao-compareceu" })
    await expect(api.mesas.abrir(trinta, { pessoas: 2 })).resolves.toBeDefined()
    await expect(api.mesas.abrir(trintaEUm, { pessoas: 2 })).resolves.toBeDefined()
  })

  test("a reserva que não está mais marcada não muda", async () => {
    const api = servidor()
    const { id } = await api.reservas.criar(marina)
    await api.reservas.cancelar(id)
    const erro = "Essa reserva não está mais marcada."
    await expect(api.reservas.editar(id, marina)).rejects.toThrow(erro)
    await expect(api.reservas.cancelar(id)).rejects.toThrow(erro)
    await expect(api.reservas.naoCompareceu(id)).rejects.toThrow(erro)
    await expect(api.reservas.cancelar("nenhuma")).rejects.toThrow("Reserva não encontrada")
  })

  test("a mesa da reserva da vez pede confirmação para abrir", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    await api.reservas.criar({ ...marina, mesaId })
    await expect(api.mesas.abrir(mesaId, { pessoas: 2 })).rejects.toThrow(
      "A mesa 30 está reservada às 20:50. Confirme para abrir.",
    )
  })
})
