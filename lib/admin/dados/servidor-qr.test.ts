import "fake-indexeddb/auto"
import { clear, get, set } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"
import type { BaseLoja, ConfigSalao } from "./tipos"

const CHAVE = "clickpedido-admin-dados:lanchonete"

/** Muda a base guardada direto, como outra aba faria. */
async function naBase(mudar: (base: BaseLoja) => void) {
  const guardado = (await get(CHAVE)) as { base: BaseLoja }
  mudar(guardado.base)
  await set(CHAVE, guardado)
}

/** Sexta, 13/11/2026, 20:30 em São Paulo. */
const AGORA = new Date(2026, 10, 13, 20, 30)

/** Lanchonete de teste: as mesas 1 e 2 do Salão; o X-Burger (R$ 20) pede o Bacon (R$ 3). */
function servidor() {
  return criarServidor({
    segmento: "lanchonete",
    carregarCatalogo: async () => catalogoDeTeste(),
    espera: 0,
  })
}

type Api = ReturnType<typeof servidor>

/** Liga o QR (desligado no catálogo de teste) e muda as opções dele. */
async function ligarQr(api: Api, qr: Partial<ConfigSalao["qr"]> = {}) {
  const config = await api.salao.config()
  await api.salao.salvar({
    ...config,
    funcoes: { ...config.funcoes, qr: true },
    qr: { ...config.qr, ...qr },
  })
}

/** Mesa nova (30 e acima: as do catálogo têm comanda da demonstração). */
const mesaNova = async (api: Api, numero = 30) => (await api.mesas.criar({ numero })).id

const xBurger = { produtoId: "prod-x-burger", escolhas: { "grp-x-burger-1": ["opc-x-burger-1-1"] } }

/** Abre a mesa pelo garçom, com um X-Burger. */
const comComanda = async (api: Api, mesaId: string) =>
  api.mesas.lancar({ mesaId, itens: [{ ...xBurger, quantidade: 1 }], enviarParaCozinha: false })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("QR: mesa indisponível", () => {
  test("a mesa que não existe", async () => {
    const api = servidor()
    await ligarQr(api)
    await expect(api.qr.chamar("mesa-99", "garcom")).rejects.toThrow("Mesa indisponível.")
  })

  test("a mesa excluída", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    await api.mesas.excluir(mesaId)
    await expect(api.qr.chamar(mesaId, "garcom")).rejects.toThrow("Mesa indisponível.")
  })

  test("a mesa bloqueada", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    await api.mesas.bloquear(mesaId)
    await expect(api.qr.chamar(mesaId, "garcom")).rejects.toThrow("Mesa indisponível.")
  })

  test("a loja com o QR desligado", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api)
    await expect(api.qr.chamar(mesaId, "garcom")).rejects.toThrow("Mesa indisponível.")
  })
})

describe("QR: chamados", () => {
  test("chamar o garçom cria o chamado aberto; o segundo toque devolve o mesmo", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)

    const chamado = await api.qr.chamar(mesaId, "garcom")
    const deNovo = await api.qr.chamar(mesaId, "garcom")

    expect(chamado).toMatchObject({ mesaId, tipo: "garcom", criadoEm: AGORA.toISOString() })
    expect(chamado.atendidoEm).toBeUndefined()
    expect(deNovo.id).toBe(chamado.id)
    expect(await api.chamados.listar()).toEqual([chamado])
  })

  test("pedir a conta sem comanda recusa", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    await expect(api.qr.chamar(mesaId, "conta")).rejects.toThrow("A mesa ainda não tem conta.")
  })

  test("pedir a conta cria o chamado e marca Pediu a conta, pelo cliente", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    const comanda = await comComanda(api, mesaId)

    const chamado = await api.qr.chamar(mesaId, "conta")

    expect(chamado).toMatchObject({ mesaId, tipo: "conta" })
    const depois = await api.pedidos.buscar(comanda.id)
    expect(depois?.contaPedidaEm).toBe(AGORA.toISOString())
    expect(depois?.eventos?.at(-1)).toMatchObject({
      tipo: "conta-pedida",
      texto: "Pediu a conta",
      por: "Cliente pelo QR",
    })
  })

  test("atender grava a hora (o tempo de resposta); atender de novo recusa", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    const chamado = await api.qr.chamar(mesaId, "garcom")

    vi.setSystemTime(new Date(2026, 10, 13, 20, 34))
    const atendido = await api.chamados.atender(chamado.id)

    expect(atendido.atendidoEm).toBe(new Date(2026, 10, 13, 20, 34).toISOString())
    await expect(api.chamados.atender(chamado.id)).rejects.toThrow("Esse chamado já foi atendido.")
    await expect(api.chamados.atender("nenhum")).rejects.toThrow("Chamado não encontrado")
  })

  test("listar traz os chamados de hoje, pela hora; o aberto de ontem não segura o de hoje", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    await naBase((base) => {
      base.chamados.push({
        id: "ontem",
        mesaId,
        tipo: "garcom",
        criadoEm: new Date(2026, 10, 12, 21, 0).toISOString(),
      })
    })

    const outra = servidor()
    const segundo = await outra.qr.chamar(mesaId, "conta").catch(() => null)
    const hoje = await outra.qr.chamar(mesaId, "garcom")

    expect(segundo).toBeNull()
    expect(hoje.id).not.toBe("ontem")
    expect((await outra.chamados.listar()).map((item) => item.id)).toEqual([hoje.id])
  })
})
