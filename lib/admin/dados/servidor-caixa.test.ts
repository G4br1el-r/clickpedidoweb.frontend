import "fake-indexeddb/auto"
import { clear } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)

const servidor = () =>
  criarServidor({
    segmento: "pizzaria",
    carregarCatalogo: async () => catalogoDeTeste(),
    espera: 0,
  })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("equipe", () => {
  test("a base nova traz a equipe de demonstração e turnos fechados", async () => {
    const api = servidor()
    expect((await api.equipe.listar()).map((membro) => membro.nome)).toEqual([
      "Carla N.",
      "Rafael M.",
      "Marina S.",
      "João P.",
    ])
    const { turnos } = await api.base()
    expect(turnos.length).toBeGreaterThan(10)
    expect(turnos.every((turno) => turno.fechadoEm && turno.conferencia)).toBe(true)
    expect(turnos.some((turno) => turno.id === "turno-20261113")).toBe(false)
  })

  test("entrar com o PIN certo devolve a pessoa; errado recusa", async () => {
    const api = servidor()
    expect((await api.equipe.entrar("eq-marina", "1111")).nome).toBe("Marina S.")
    await expect(api.equipe.entrar("eq-marina", "1112")).rejects.toThrow("PIN errado.")
  })

  test("pessoa desativada não entra", async () => {
    const api = servidor()
    const [, , marina] = await api.equipe.listar()
    await api.equipe.salvar({ ...marina, ativo: false })
    await expect(api.equipe.entrar("eq-marina", "1111")).rejects.toThrow(
      "Esta pessoa está desativada.",
    )
  })

  test("salvar confere pelas regras", async () => {
    const api = servidor()
    await expect(
      api.equipe.salvar({ nome: "Bia L.", perfil: "caixa", pin: "12", ativo: true }),
    ).rejects.toThrow("O PIN tem de 4 a 6 números.")
    const [carla] = await api.equipe.listar()
    await expect(api.equipe.salvar({ ...carla, ativo: false })).rejects.toThrow(
      "O painel precisa de um Dono ativo.",
    )
  })

  test("salvar cria com id novo e edita pelo id", async () => {
    const api = servidor()
    const bia = await api.equipe.salvar({
      nome: "Bia L.",
      perfil: "caixa",
      pin: "3333",
      ativo: true,
    })
    expect(bia.id).toMatch(/^eq-/)
    await api.equipe.salvar({ ...bia, nome: "Bia Lima" })
    const equipe = await api.equipe.listar()
    expect(equipe).toHaveLength(5)
    expect(equipe.at(-1)).toEqual({ ...bia, nome: "Bia Lima" })
  })

  test("no dia seguinte, a base ganha os turnos dos dias que faltavam e nenhum de hoje", async () => {
    const antes = (await servidor().base()).turnos
    vi.setSystemTime(new Date(2026, 10, 17, 20, 30))
    const depois = (await servidor().base()).turnos
    const novos = depois.filter((turno) => !antes.some((velho) => velho.id === turno.id))
    expect(depois.slice(0, antes.length)).toEqual(antes)
    expect(novos.length).toBeGreaterThan(0)
    for (const turno of novos) {
      expect(turno.id > "turno-20261113" && turno.id < "turno-20261117").toBe(true)
      expect(turno.fechadoEm).toBeDefined()
    }
    const { pedidos } = await servidor().base()
    const doPdv = pedidos.filter((pedido) => pedido.origem === "pdv")
    expect(doPdv.every((pedido) => depois.some((turno) => turno.id === pedido.turnoId))).toBe(true)
  })
})
