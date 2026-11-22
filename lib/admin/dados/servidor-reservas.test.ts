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

describe("sentar a reserva", () => {
  test("abre a mesa da reserva com o nome e as pessoas, sem pedir confirmação", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    const { id } = await api.reservas.criar({ ...marina, mesaId })

    const { reserva, comanda } = await api.reservas.sentar(id, { por: "Rafa" })

    expect(reserva).toMatchObject({ id, status: "sentou", mesaId })
    expect(comanda.cliente.nome).toBe("Marina Costa")
    expect(comanda.mesa).toMatchObject({ id: mesaId, numero: 30, pessoas: 2 })
    expect(comanda.eventos?.at(-1)).toMatchObject({
      texto: "Mesa aberta para 2 pessoas",
      por: "Rafa",
    })
    const [mesa] = (await servidor().mesas.listar()).filter((item) => item.id === mesaId)
    expect(mesa).toMatchObject({ status: "ocupada", clienteNome: "Marina Costa" })
    expect((await servidor().reservas.listar())[0].status).toBe("sentou")
  })
})

describe("sentar a reserva: a mesa e o horário", () => {
  test("sem mesa na reserva, senta na mesa dada e guarda nela; sem nenhuma, pede", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    const { id } = await api.reservas.criar(marina)
    await expect(api.reservas.sentar(id, {})).rejects.toThrow("Escolha a mesa.")
    const { reserva } = await api.reservas.sentar(id, { mesaId })
    expect(reserva.mesaId).toBe(mesaId)
  })

  test("a atrasada ainda senta; a cancelada, não", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    const atrasada = await api.reservas.criar({ ...marina, mesaId })
    const cancelada = await api.reservas.criar({ ...marina, nome: "Outra" })
    await api.reservas.cancelar(cancelada.id)
    vi.setSystemTime(new Date(2026, 10, 13, 21, 10))
    await expect(api.reservas.sentar(atrasada.id, {})).resolves.toBeDefined()
    await expect(api.reservas.sentar(cancelada.id, { mesaId })).rejects.toThrow(
      "Essa reserva não está mais marcada.",
    )
  })

  test("outra reserva da vez na mesa escolhida pede confirmação", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    await api.reservas.criar({ ...marina, mesaId })
    const { id } = await api.reservas.criar({ ...marina, nome: "Roberto" })
    await expect(api.reservas.sentar(id, { mesaId })).rejects.toThrow(
      "A mesa 30 está reservada às 20:50. Confirme para abrir.",
    )
    await expect(api.reservas.sentar(id, { mesaId, confirmarReserva: true })).resolves.toBeDefined()
  })
})

describe("lista de espera", () => {
  test("entrar põe no fim da fila, com a hora de chegada; listar traz quem espera", async () => {
    const api = servidor()
    await api.espera.entrar({ nome: "Carlos", pessoas: 2, telefone: "(12) 99876-1234" })
    vi.setSystemTime(new Date(2026, 10, 13, 20, 35))
    const juliana = await api.espera.entrar({ nome: " Juliana ", pessoas: 4 })

    expect(juliana).toMatchObject({
      nome: "Juliana",
      pessoas: 4,
      chegouEm: new Date(2026, 10, 13, 20, 35).toISOString(),
      status: "esperando",
    })
    expect((await servidor().espera.listar()).map((entrada) => entrada.nome)).toEqual([
      "Carlos",
      "Juliana",
    ])
    expect((await api.espera.listar())[0].telefone).toBe("12998761234")
  })

  test.each([
    [{ nome: "" }, "Informe o nome."],
    [{ pessoas: 100 }, "Informe de 1 a 99 pessoas."],
    [{ telefone: "12345" }, "Informe o telefone com DDD."],
  ])("entrar recusa %o: %s", async (mudanca, erro) => {
    const api = servidor()
    await expect(api.espera.entrar({ nome: "Carlos", pessoas: 2, ...mudanca })).rejects.toThrow(
      erro,
    )
  })

  test("chamar grava a hora da chamada; desistir tira da lista", async () => {
    const api = servidor()
    const carlos = await api.espera.entrar({ nome: "Carlos", pessoas: 2 })
    const juliana = await api.espera.entrar({ nome: "Juliana", pessoas: 4 })
    vi.setSystemTime(new Date(2026, 10, 13, 20, 40))
    expect(await api.espera.chamar(carlos.id)).toMatchObject({
      chamadaEm: new Date(2026, 10, 13, 20, 40).toISOString(),
      status: "esperando",
    })
    expect(await api.espera.desistir(juliana.id)).toMatchObject({ status: "desistiu" })
    expect((await servidor().espera.listar()).map((entrada) => entrada.nome)).toEqual(["Carlos"])
  })

  test("sentar abre a mesa com o nome e as pessoas, e tira da fila", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    const { id } = await api.espera.entrar({ nome: "Juliana", pessoas: 4 })
    const { entrada, comanda } = await api.espera.sentar(id, { mesaId, por: "Bia" })

    expect(entrada.status).toBe("sentou")
    expect(comanda.cliente.nome).toBe("Juliana")
    expect(comanda.mesa).toMatchObject({ id: mesaId, pessoas: 4 })
    expect(await servidor().espera.listar()).toEqual([])
  })

  test("quem saiu da fila não é chamado nem sentado; sem mesa, pede", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    const { id } = await api.espera.entrar({ nome: "Juliana", pessoas: 4 })
    await expect(api.espera.sentar(id, {})).rejects.toThrow("Escolha a mesa.")
    await api.espera.desistir(id)
    const erro = "Essa pessoa não está mais na espera."
    await expect(api.espera.sentar(id, { mesaId })).rejects.toThrow(erro)
    await expect(api.espera.chamar(id)).rejects.toThrow(erro)
    await expect(api.espera.desistir(id)).rejects.toThrow(erro)
    await expect(api.espera.chamar("ninguem")).rejects.toThrow("Não está na espera.")
  })
})

describe("a mesa com reserva não some", () => {
  test("excluir e bloquear a mesa com reserva ativa recusam", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    await api.reservas.criar({ ...marina, inicio: as("22:30"), mesaId })
    const erro = "A mesa 30 tem reserva às 22:30. Tire a mesa da reserva antes."
    await expect(api.mesas.excluir(mesaId)).rejects.toThrow(erro)
    await expect(api.mesas.bloquear(mesaId)).rejects.toThrow(erro)
    expect((await servidor().mesas.listar()).find((mesa) => mesa.id === mesaId)).toBeDefined()
  })

  test("a reserva vencida e a cancelada não impedem", async () => {
    const api = servidor()
    const [trinta, trintaEUm] = [await mesaNova(api, 30), await mesaNova(api, 31)]
    await api.reservas.criar({ ...marina, mesaId: trinta })
    const cancelada = await api.reservas.criar({ ...marina, mesaId: trintaEUm })
    await api.reservas.cancelar(cancelada.id)
    vi.setSystemTime(new Date(2026, 10, 13, 21, 6))
    await expect(api.mesas.bloquear(trinta)).resolves.toBeDefined()
    await expect(api.mesas.excluir(trintaEUm)).resolves.toBeUndefined()
  })
})

describe("demonstração e virada do dia", () => {
  /** O catálogo de teste com as reservas ligadas, como a demonstração. */
  function comReservas() {
    return criarServidor({
      segmento: "lanchonete",
      carregarCatalogo: async () => {
        const catalogo = catalogoDeTeste()
        catalogo.salao.funcoes = { ...catalogo.salao.funcoes, reservas: true }
        return catalogo
      },
      espera: 0,
    })
  }

  test("sem a função ligada, a base nasce sem reservas e sem espera", async () => {
    const api = servidor()
    expect(await api.reservas.listar()).toEqual([])
    expect(await api.espera.listar()).toEqual([])
  })

  test("com a função ligada, a base nasce com as 2 reservas e as 3 pessoas na espera", async () => {
    const api = comReservas()
    expect((await api.reservas.listar()).map((reserva) => reserva.nome)).toEqual([
      "Marina Costa",
      "Roberto Andrade",
    ])
    expect((await api.espera.listar()).map((entrada) => entrada.nome)).toEqual([
      "Carlos Mendes",
      "Juliana Rocha",
      "Pedro Alves",
    ])
  })

  test("na virada, a marcada de ontem não compareceu, a espera desistiu e o dia novo tem as suas", async () => {
    const ontem = comReservas()
    const roberto = (await ontem.reservas.listar())[1]
    await ontem.reservas.cancelar(roberto.id)
    vi.setSystemTime(new Date(2026, 10, 14, 20, 30))

    const base = await comReservas().base()

    expect(
      Object.fromEntries(base.reservas.map((reserva) => [reserva.id, reserva.status])),
    ).toEqual({
      "reserva-20261113-1": "nao-compareceu",
      "reserva-20261113-2": "cancelada",
      "reserva-20261114-1": "marcada",
      "reserva-20261114-2": "marcada",
    })
    expect(
      base.espera.filter((entrada) => entrada.id.includes("20261113")).map((e) => e.status),
    ).toEqual(["desistiu", "desistiu", "desistiu"])
    expect((await comReservas().espera.listar()).map((entrada) => entrada.id)).toEqual([
      "espera-20261114-1",
      "espera-20261114-2",
      "espera-20261114-3",
    ])
  })
})
