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

describe("QR: a mesa vista pelo cliente", () => {
  test("o nome da loja, o número, o cardápio sem o inativo e o esgotado, e a comanda", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    const [produto] = await api.produtos.listar()
    await api.produtos.salvar({
      ...produto,
      id: "prod-esgotado",
      nome: "Esgotado",
      disponivel: false,
    })
    await api.produtos.salvar({ ...produto, id: "prod-inativo", nome: "Inativo", ativo: false })

    const livre = await api.qr.mesa(mesaId)
    expect(livre).toMatchObject({ loja: "Teste", mesa: { id: mesaId, numero: 30 }, comanda: null })
    expect(livre.produtos.map((item) => item.nome)).toEqual(["X-Burger"])
    expect(livre.categorias.map((item) => item.nome)).toEqual(["Lanches"])

    const comanda = await comComanda(api, mesaId)
    expect((await api.qr.mesa(mesaId)).comanda?.id).toBe(comanda.id)
  })
})

describe("QR: o pedido do cliente", () => {
  const pedido = [{ ...xBurger, quantidade: 2, observacao: " sem cebola " }]

  test("com o aceite do garçom, fica aguardando com o resumo e a mesa continua livre", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)

    const { pedido: aguardando, comanda } = await api.qr.pedir(mesaId, pedido)

    expect(comanda).toBeNull()
    expect(aguardando).toMatchObject({
      mesaId,
      status: "aguardando",
      total: 46,
      criadoEm: AGORA.toISOString(),
      resumo: [
        {
          nome: "X-Burger",
          quantidade: 2,
          opcoes: ["Adicional: Bacon"],
          observacao: "sem cebola",
          total: 46,
        },
      ],
    })
    expect(await api.pedidosQr.listar()).toEqual([aguardando])
    expect((await api.qr.mesa(mesaId)).aguardando).toBe(1)
    expect((await api.mesas.listar()).find((mesa) => mesa.id === mesaId)?.status).toBe("livre")
  })

  test("aceitar abre a mesa com a rodada para a cozinha, pedida pelo QR", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    const { pedido: aguardando } = await api.qr.pedir(mesaId, pedido)

    const comanda = await api.pedidosQr.aceitar(aguardando?.id as string, { por: "Paula" })

    expect(comanda).toMatchObject({ status: "recebido", total: 46, mesa: { id: mesaId } })
    expect(comanda.itens[0]).toMatchObject({ nome: "X-Burger", vaiParaCozinha: true })
    expect(comanda.eventos?.at(-1)).toMatchObject({
      texto: "Rodada 1 para a cozinha, pedida pelo QR: 2× X-Burger",
      por: "Paula",
    })
    expect(await api.pedidosQr.listar()).toEqual([])
    await expect(api.pedidosQr.aceitar(aguardando?.id as string, {})).rejects.toThrow(
      "Esse pedido já foi resolvido.",
    )
  })

  test("recusar marca recusado e não mexe na mesa", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    const { pedido: aguardando } = await api.qr.pedir(mesaId, pedido)

    const recusado = await api.pedidosQr.recusar(aguardando?.id as string)

    expect(recusado).toMatchObject({ status: "recusado", resolvidoEm: AGORA.toISOString() })
    expect(await api.pedidosQr.listar()).toEqual([])
    expect((await api.mesas.listar()).find((mesa) => mesa.id === mesaId)?.status).toBe("livre")
    await expect(api.pedidosQr.recusar(aguardando?.id as string)).rejects.toThrow(
      "Esse pedido já foi resolvido.",
    )
    await expect(api.pedidosQr.recusar("nenhum")).rejects.toThrow("Pedido não encontrado")
  })

  test("direto: na mesa livre abre a comanda com a rodada; na aberta, acrescenta", async () => {
    const api = servidor()
    await ligarQr(api, { aceite: "direto" })
    const mesaId = await mesaNova(api)

    const primeiro = await api.qr.pedir(mesaId, pedido)
    const segundo = await api.qr.pedir(mesaId, [{ ...xBurger, quantidade: 1 }])

    expect(primeiro.pedido).toBeNull()
    expect(primeiro.comanda).toMatchObject({ status: "recebido", total: 46 })
    expect(primeiro.comanda?.eventos?.at(-1)).toMatchObject({ por: "Cliente pelo QR" })
    expect(segundo.comanda).toMatchObject({ id: primeiro.comanda?.id, total: 69 })
  })

  test("com abrir pelo QR desligado, a mesa livre pede o garçom; a aberta recebe", async () => {
    const api = servidor()
    await ligarQr(api, { aceite: "direto", abrirMesaPeloQr: false })
    const mesaId = await mesaNova(api)

    await expect(api.qr.pedir(mesaId, pedido)).rejects.toThrow("Chame o garçom para abrir a mesa.")
    await comComanda(api, mesaId)
    await expect(api.qr.pedir(mesaId, pedido)).resolves.toMatchObject({ pedido: null })
  })

  test("a mesa reservada agora pede o garçom", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    await api.reservas.criar({
      nome: "Marina",
      inicio: new Date(2026, 10, 13, 20, 50).toISOString(),
      pessoas: 2,
      mesaId,
    })
    await expect(api.qr.pedir(mesaId, pedido)).rejects.toThrow("Chame o garçom para abrir a mesa.")
  })

  test("o pedido vazio e o produto esgotado recusam na hora", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    await expect(api.qr.pedir(mesaId, [])).rejects.toThrow("Inclua pelo menos um item.")
    await api.produtos.alternar("prod-x-burger", "disponivel")
    await expect(api.qr.pedir(mesaId, pedido)).rejects.toThrow("X-Burger está esgotado.")
  })
})

describe("QR: o pedido aguardando é da comanda da hora", () => {
  const umXBurger = [{ ...xBurger, quantidade: 1 }]

  test("guarda a comanda da hora do pedido: nenhuma na mesa livre, a aberta na ocupada", async () => {
    const api = servidor()
    await ligarQr(api)
    const livre = await mesaNova(api, 30)
    const ocupada = await mesaNova(api, 31)
    const comanda = await comComanda(api, ocupada)

    expect((await api.qr.pedir(livre, umXBurger)).pedido?.comandaId).toBeNull()
    expect((await api.qr.pedir(ocupada, umXBurger)).pedido?.comandaId).toBe(comanda.id)
  })

  test("a mesa abriu depois do pedido: aceitar recusa", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    const { pedido } = await api.qr.pedir(mesaId, umXBurger)
    await comComanda(api, mesaId)

    await expect(api.pedidosQr.aceitar(pedido?.id as string, {})).rejects.toThrow(
      "A mesa mudou depois desse pedido.",
    )
  })

  test("a comanda cancelada ou paga leva junto o pedido que aguardava", async () => {
    const api = servidor()
    await ligarQr(api)
    const cancelada = await mesaNova(api, 30)
    const paga = await mesaNova(api, 31)
    const primeira = await comComanda(api, cancelada)
    const segunda = await comComanda(api, paga)
    const { pedido: daCancelada } = await api.qr.pedir(cancelada, umXBurger)
    const { pedido: daPaga } = await api.qr.pedir(paga, umXBurger)

    await api.mesas.cancelarComanda(primeira.id, { motivo: "Desistiu" })
    await api.mesas.fecharConta(segunda.id, "dinheiro")

    expect(await api.pedidosQr.listar()).toEqual([])
    const resolvidos = (await api.base()).pedidosQr ?? []
    expect(resolvidos.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: daCancelada?.id, status: "recusado" },
      { id: daPaga?.id, status: "recusado" },
    ])
    await expect(api.pedidosQr.aceitar(daCancelada?.id as string, {})).rejects.toThrow(
      "Esse pedido já foi resolvido.",
    )
  })

  test("na virada do dia, o pedido que aguardava de ontem vence", async () => {
    const api = servidor()
    await ligarQr(api)
    const mesaId = await mesaNova(api)
    const { pedido } = await api.qr.pedir(mesaId, umXBurger)
    vi.setSystemTime(new Date(2026, 10, 14, 12, 0))

    const outra = servidor()

    expect(await outra.pedidosQr.listar()).toEqual([])
    expect((await outra.base()).pedidosQr).toEqual([
      expect.objectContaining({ id: pedido?.id, status: "recusado" }),
    ])
  })
})

describe("QR: demonstração e virada do dia", () => {
  /** O catálogo de teste com o QR ligado, como a demonstração. */
  function comQr() {
    return criarServidor({
      segmento: "lanchonete",
      carregarCatalogo: async () => {
        const catalogo = catalogoDeTeste()
        catalogo.salao.funcoes = { ...catalogo.salao.funcoes, qr: true }
        return catalogo
      },
      espera: 0,
    })
  }

  test("sem a função ligada, a base nasce sem chamados", async () => {
    expect(await servidor().chamados.listar()).toEqual([])
  })

  test("com a função ligada, a base nasce com 1 chamado de garçom aberto", async () => {
    expect(await comQr().chamados.listar()).toEqual([
      {
        id: "chamado-20261113-1",
        mesaId: "mesa-1",
        tipo: "garcom",
        criadoEm: new Date(2026, 10, 13, 20, 27).toISOString(),
      },
    ])
  })

  test("na virada, o dia novo ganha o chamado dele e a lista só mostra os de hoje", async () => {
    await comQr().chamados.listar()
    vi.setSystemTime(new Date(2026, 10, 14, 20, 30))

    const api = comQr()

    expect((await api.base()).chamados.map((chamado) => chamado.id)).toEqual([
      "chamado-20261113-1",
      "chamado-20261114-1",
    ])
    expect((await api.chamados.listar()).map((chamado) => chamado.id)).toEqual([
      "chamado-20261114-1",
    ])
  })
})
