import "fake-indexeddb/auto"
import { clear, get, set } from "idb-keyval"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { catalogoDeTeste } from "./catalogo-de-teste"
import { criarServidor } from "./servidor"
import type { BaseLoja, CatalogoLoja, ControleEstoque, Produto } from "./tipos"

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
 * Lanchonete de teste com garçons (Rafa e Bia) e estoque: Refri lata (5 un, sem cozinha) e
 * Bacon (10 un), ligado à opção "Bacon" do X-Burger.
 */
function catalogo(mudar?: (catalogo: CatalogoLoja) => void) {
  const base = catalogoDeTeste()
  base.salao.garcons = [
    { id: "garcom-rafa", nome: "Rafa", ativo: true },
    { id: "garcom-bia", nome: "Bia", ativo: true },
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

type Api = ReturnType<typeof servidor>

const REFRI = (quantidade: number) => [{ produtoId: "refri", escolhas: {}, quantidade }]
const X_BURGER = (quantidade: number) => [
  { produtoId: "prod-x-burger", escolhas: { "grp-x-burger-1": ["opc-x-burger-1-1"] }, quantidade },
]

/** Mesa nova (30 e acima: as do catálogo podem ter comanda da demonstração). */
const mesaNova = async (api: Api, numero: number) => (await api.mesas.criar({ numero })).id

/** A mesa aberta com Rafa e 2 Refris lançados sem cozinha. */
async function aberta(api: Api, numero = 30, itens = REFRI(2)) {
  const mesaId = await mesaNova(api, numero)
  const comanda = await api.mesas.lancar({
    mesaId,
    garcom: "Rafa",
    enviarParaCozinha: false,
    itens,
  })
  return { mesaId, comanda }
}

/** Muda a base guardada direto, como outra aba (ou uma fase futura) faria. */
async function naBase(mudar: (base: BaseLoja) => void) {
  const guardado = (await get(CHAVE)) as { base: BaseLoja }
  mudar(guardado.base)
  await set(CHAVE, guardado)
}

const mesaDe = async (api: Api, id: string) =>
  (await api.mesas.listar()).find((mesa) => mesa.id === id)
const saldo = async (api: Api, produtoId: string) =>
  (await api.produtos.listar()).find((produto) => produto.id === produtoId)?.estoque?.quantidade

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(AGORA)
  await clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("transferir a mesa", () => {
  test("a comanda vai para a mesa livre com os mesmos itens; a de origem fica livre, sem limpeza; o estoque não muda", async () => {
    const api = servidor()
    const { mesaId, comanda } = await aberta(api)
    const destino = await mesaNova(api, 31)
    const movimentos = (await api.estoque.movimentos()).length

    const { comanda: transferida } = await api.mesas.transferir(comanda.id, destino, { por: "Bia" })

    expect(transferida).toMatchObject({
      id: comanda.id,
      // Sem cliente, a comanda leva o nome da mesa: ele acompanha a mesa nova.
      cliente: { nome: "Mesa 31" },
      mesa: { id: destino, numero: 31, garcom: "Rafa" },
      itens: comanda.itens,
      total: comanda.total,
    })
    expect(transferida.eventos?.at(-1)).toEqual({
      tipo: "transferida",
      em: AGORA.toISOString(),
      por: "Bia",
      texto: "Transferida da mesa 30 para a mesa 31",
    })
    expect(await mesaDe(api, destino)).toMatchObject({
      status: "ocupada",
      pedidoAtivoId: comanda.id,
    })
    const origem = await mesaDe(api, mesaId)
    expect(origem?.status).toBe("livre")
    expect(origem?.limpezaDesde).toBeUndefined()
    expect(await saldo(api, "refri")).toBe(3)
    expect(await api.estoque.movimentos()).toHaveLength(movimentos)
  })

  test("a mesa em limpeza recebe a comanda e sai da limpeza", async () => {
    const api = servidor()
    const { comanda } = await aberta(api)
    const destino = await mesaNova(api, 31)
    await naBase((base) => {
      base.mesas = base.mesas.map((mesa) =>
        mesa.id === destino ? { ...mesa, limpezaDesde: AGORA.toISOString() } : mesa,
      )
    })

    await servidor().mesas.transferir(comanda.id, destino)

    const mesa = await mesaDe(servidor(), destino)
    expect(mesa?.status).toBe("ocupada")
    expect(mesa?.limpezaDesde).toBeUndefined()
  })

  test("recusa a própria mesa, a bloqueada, a aberta e a que não existe", async () => {
    const api = servidor()
    const { mesaId, comanda } = await aberta(api)
    const { mesaId: outraAberta } = await aberta(api, 31)
    const bloqueada = await mesaNova(api, 32)
    await api.mesas.bloquear(bloqueada)

    await expect(api.mesas.transferir(comanda.id, mesaId)).rejects.toThrow("Escolha outra mesa.")
    await expect(api.mesas.transferir(comanda.id, bloqueada)).rejects.toThrow(
      "A mesa 32 está bloqueada.",
    )
    await expect(api.mesas.transferir(comanda.id, outraAberta)).rejects.toThrow(
      "A mesa 31 já está aberta. Junte as mesas ou transfira os itens.",
    )
    await expect(api.mesas.transferir(comanda.id, "mesa-99")).rejects.toThrow("Mesa não encontrada")
  })

  test("a comanda com mesas juntadas separa antes de transferir", async () => {
    const api = servidor()
    const { comanda } = await aberta(api)
    const junta = await mesaNova(api, 31)
    const destino = await mesaNova(api, 32)
    await naBase((base) => {
      base.pedidos = base.pedidos.map((pedido) =>
        pedido.id === comanda.id && pedido.mesa
          ? { ...pedido, mesa: { ...pedido.mesa, juntadas: [{ id: junta, numero: 31 }] } }
          : pedido,
      )
    })

    await expect(servidor().mesas.transferir(comanda.id, destino)).rejects.toThrow(
      "Separe as mesas antes de transferir.",
    )
  })

  test("a mesa reservada às 20:45 pede confirmação; confirmada, recebe a comanda", async () => {
    const api = servidor()
    const { comanda } = await aberta(api)
    const destino = await mesaNova(api, 31)
    await naBase((base) => {
      base.reservas = [
        {
          id: "res-1",
          nome: "Carla",
          inicio: new Date(2026, 10, 13, 20, 45).toISOString(),
          pessoas: 4,
          mesaId: destino,
          status: "marcada",
        },
      ]
    })
    const outra = servidor()

    await expect(outra.mesas.transferir(comanda.id, destino)).rejects.toThrow(
      "A mesa 31 está reservada às 20:45. Confirme para transferir.",
    )
    const { comanda: transferida } = await outra.mesas.transferir(comanda.id, destino, {
      confirmarReserva: true,
    })
    expect(transferida.mesa?.id).toBe(destino)
  })

  test("duas abas: a comanda que a outra aba acabou de fechar não é transferida nem duplicada", async () => {
    const estaAba = servidor()
    const { mesaId, comanda } = await aberta(estaAba)
    const destino = await mesaNova(estaAba, 31)
    // A outra aba lê a mesma base guardada e fecha a conta; esta continua com a de antes.
    const outraAba = servidor()
    await outraAba.mesas.fecharConta(comanda.id, "pix")
    const pedidosAntes = (await outraAba.pedidos.listar()).length

    await expect(estaAba.mesas.transferir(comanda.id, destino)).rejects.toThrow(
      "A comanda da mesa 30 não está mais aberta. Atualize a tela.",
    )
    const depois = servidor()
    expect(await depois.pedidos.listar()).toHaveLength(pedidosAntes)
    expect((await depois.pedidos.buscar(comanda.id))?.status).toBe("concluido")
    expect((await mesaDe(depois, destino))?.status).toBe("livre")
    expect((await mesaDe(depois, mesaId))?.pedidoAtivoId).toBeUndefined()
  })
})

describe("desfazer", () => {
  test("em 9 s, a comanda volta para a mesa de antes, sem o evento da transferência", async () => {
    const api = servidor()
    const { mesaId, comanda } = await aberta(api)
    const destino = await mesaNova(api, 31)
    const { desfazer } = await api.mesas.transferir(comanda.id, destino, { por: "Bia" })

    vi.setSystemTime(AGORA.getTime() + 9_000)
    await api.mesas.desfazer(desfazer)

    expect(await api.pedidos.buscar(comanda.id)).toEqual(comanda)
    expect(await mesaDe(api, mesaId)).toMatchObject({
      status: "ocupada",
      pedidoAtivoId: comanda.id,
    })
    expect((await mesaDe(api, destino))?.status).toBe("livre")
  })

  test("depois de 10 s, ou da segunda vez, o tempo acabou", async () => {
    const api = servidor()
    const { comanda } = await aberta(api)
    const destino = await mesaNova(api, 31)
    const destino2 = await mesaNova(api, 32)
    const primeira = await api.mesas.transferir(comanda.id, destino)

    vi.setSystemTime(AGORA.getTime() + 11_000)
    await expect(api.mesas.desfazer(primeira.desfazer)).rejects.toThrow(
      "O tempo para desfazer acabou.",
    )
    const segunda = await api.mesas.transferir(comanda.id, destino2)
    await api.mesas.desfazer(segunda.desfazer)
    await expect(api.mesas.desfazer(segunda.desfazer)).rejects.toThrow(
      "O tempo para desfazer acabou.",
    )
    expect((await api.pedidos.buscar(comanda.id))?.mesa?.id).toBe(destino)
  })

  test("se a comanda mudou depois, recusa e não mexe em nada", async () => {
    const api = servidor()
    const { comanda } = await aberta(api)
    const destino = await mesaNova(api, 31)
    const { desfazer } = await api.mesas.transferir(comanda.id, destino)
    const lancada = await api.mesas.lancar({
      mesaId: destino,
      enviarParaCozinha: false,
      itens: REFRI(1),
    })

    await expect(api.mesas.desfazer(desfazer)).rejects.toThrow(
      "A mesa mudou depois disso. Desfaça pela comanda.",
    )
    expect(await api.pedidos.buscar(comanda.id)).toEqual(lancada)
  })

  test("a limpeza que a mesa de destino tinha volta", async () => {
    const api = servidor()
    const { comanda } = await aberta(api)
    const destino = await mesaNova(api, 31)
    const limpezaDesde = new Date(AGORA.getTime() - 60_000).toISOString()
    await naBase((base) => {
      base.mesas = base.mesas.map((mesa) =>
        mesa.id === destino ? { ...mesa, limpezaDesde } : mesa,
      )
    })
    const outra = servidor()
    const { desfazer } = await outra.mesas.transferir(comanda.id, destino)

    await outra.mesas.desfazer(desfazer)

    expect((await mesaDe(outra, destino))?.limpezaDesde).toBe(limpezaDesde)
  })
})
