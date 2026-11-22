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

/** A mesa aberta por "Abrir mesa" com Rafa, para tantas pessoas, e uma rodada. */
async function abertaPara(
  api: Api,
  numero: number,
  pessoas: number,
  itens: ReturnType<typeof REFRI>,
  enviarParaCozinha = false,
) {
  const mesaId = await mesaNova(api, numero)
  await api.mesas.abrir(mesaId, { pessoas, garcom: "Rafa" })
  const comanda = await api.mesas.lancar({ mesaId, enviarParaCozinha, itens })
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

describe("juntar e separar", () => {
  test("a mesa livre junta à aberta: ela fica com a principal, sem comanda própria", async () => {
    const api = servidor()
    const { mesaId, comanda } = await aberta(api)
    const livre = await mesaNova(api, 31)

    const { comanda: junta } = await api.mesas.juntar(comanda.id, [livre], { por: "Bia" })

    expect(junta.mesa?.juntadas).toEqual([{ id: livre, numero: 31 }])
    expect(junta.eventos?.at(-1)).toEqual({
      tipo: "juntada",
      em: AGORA.toISOString(),
      por: "Bia",
      texto: "Juntou a mesa 31",
    })
    const secundaria = await mesaDe(api, livre)
    expect(secundaria).toMatchObject({ status: "livre", juntadaCom: mesaId })
    expect(secundaria?.pedidoAtivoId).toBeUndefined()
  })

  test("a comanda da mesa aberta entra na principal: itens, pessoas e pagamento; o estoque não muda", async () => {
    const api = servidor()
    const { comanda } = await abertaPara(api, 30, 3, X_BURGER(1))
    const { mesaId: outra, comanda: daOutra } = await abertaPara(api, 31, 2, REFRI(2))
    await api.mesas.pagar(daOutra.id, { forma: "pix", valor: 6 })
    const movimentos = (await api.estoque.movimentos()).length

    const { comanda: junta } = await api.mesas.juntar(comanda.id, [outra])

    expect(junta.itens.map((item) => `${item.quantidade}× ${item.nome}`)).toEqual([
      "1× X-Burger",
      "2× Refri lata",
    ])
    expect(junta.mesa).toMatchObject({ pessoas: 5, juntadas: [{ id: outra, numero: 31 }] })
    expect(junta.pagamentos).toMatchObject([{ forma: "pix", valor: 6 }])
    expect(junta).toMatchObject({ total: 35, eventos: expect.any(Array) })
    expect(junta.eventos?.at(-1)?.texto).toBe("Juntou a mesa 31: 2× Refri lata")
    expect(await api.pedidos.buscar(daOutra.id)).toBeUndefined()
    expect(await saldo(api, "refri")).toBe(3)
    expect(await saldo(api, "bacon")).toBe(9)
    expect(await api.estoque.movimentos()).toHaveLength(movimentos)
  })

  test("recusa sem mesa, a própria, a bloqueada, a que já está junto e a reservada", async () => {
    const api = servidor()
    const { mesaId, comanda } = await aberta(api)
    const { comanda: outraComanda } = await aberta(api, 31)
    const bloqueada = await mesaNova(api, 32)
    await api.mesas.bloquear(bloqueada)
    const junta = await mesaNova(api, 33)
    await api.mesas.juntar(outraComanda.id, [junta])
    const reservada = await mesaNova(api, 34)
    await naBase((base) => {
      base.reservas = [
        {
          id: "res-1",
          nome: "Carla",
          inicio: new Date(2026, 10, 13, 20, 45).toISOString(),
          pessoas: 4,
          mesaId: reservada,
          status: "marcada",
        },
      ]
    })
    const outra = servidor()

    await expect(outra.mesas.juntar(comanda.id, [])).rejects.toThrow(
      "Escolha as mesas para juntar.",
    )
    await expect(outra.mesas.juntar(comanda.id, [mesaId])).rejects.toThrow("Escolha outra mesa.")
    await expect(outra.mesas.juntar(comanda.id, [bloqueada])).rejects.toThrow(
      "A mesa 32 está bloqueada.",
    )
    await expect(outra.mesas.juntar(comanda.id, [junta])).rejects.toThrow(
      "A mesa 33 já está junto com a mesa 31.",
    )
    await expect(outra.mesas.juntar(comanda.id, [reservada])).rejects.toThrow(
      "A mesa 34 está reservada às 20:45.",
    )
  })

  test("recusa o que as regras da conta recusam: desconto na secundária e as duas na cozinha", async () => {
    const api = servidor()
    const { comanda } = await aberta(api, 30, X_BURGER(1))
    const { mesaId: comDesconto, comanda: daOutra } = await aberta(api, 31)
    await api.mesas.descontar(daOutra.id, { modo: "reais", valor: 2, motivo: "Cliente fiel" })
    await expect(api.mesas.juntar(comanda.id, [comDesconto])).rejects.toThrow(
      "Tire o desconto da mesa 31 antes de juntar.",
    )

    const { comanda: naCozinha } = await abertaPara(api, 32, 1, X_BURGER(1), true)
    const { mesaId: tambem } = await abertaPara(api, 33, 1, X_BURGER(1), true)
    await expect(api.mesas.juntar(naCozinha.id, [tambem])).rejects.toThrow(
      "A cozinha está com rodadas das mesas 32 e 33. Junte depois que uma ficar pronta.",
    )
  })

  test("a secundária que pagou com taxa não junta numa principal sem taxa: a conta ficaria menor que o pago", async () => {
    const api = servidor()
    // A principal abre sem taxa; depois o salão liga 10% e a 31 abre com ela.
    const principal = await mesaNova(api, 30)
    const comanda = await api.mesas.abrir(principal, { pessoas: 2, garcom: "Rafa" })
    const salao = await api.salao.config()
    await api.salao.salvar({ ...salao, taxaServico: { ativa: true, percentual: 10 } })
    const { mesaId: outra, comanda: daOutra } = await aberta(api, 31)
    // 2 Refris (R$ 12,00) + 10% = R$ 13,20; pagou R$ 13,00. Na principal, a conta seria R$ 12,00.
    await api.mesas.pagar(daOutra.id, { forma: "pix", valor: 13 })

    await expect(api.mesas.juntar(comanda.id, [outra])).rejects.toThrow(
      "A conta ficaria menor que o já pago. Estorne um pagamento antes.",
    )
    // A comanda da 31 continua aberta, onde estava.
    expect((await api.pedidos.buscar(daOutra.id))?.status).toBe("pronto")
  })

  test("a secundária aponta para a principal: lançar nela entra na comanda junta; abrir, bloquear e excluir recusam", async () => {
    const api = servidor()
    const { comanda } = await aberta(api)
    const livre = await mesaNova(api, 31)
    await api.mesas.juntar(comanda.id, [livre])

    const lancada = await api.mesas.lancar({
      mesaId: livre,
      enviarParaCozinha: false,
      itens: REFRI(1),
    })

    expect(lancada.id).toBe(comanda.id)
    expect(lancada.itens).toHaveLength(2)
    await expect(api.mesas.abrir(livre, { pessoas: 2, garcom: "Rafa" })).rejects.toThrow(
      "A mesa 31 já está aberta.",
    )
    await expect(api.mesas.bloquear(livre)).rejects.toThrow(
      "Feche a conta antes de bloquear a mesa.",
    )
    await expect(api.mesas.excluir(livre)).rejects.toThrow("Feche a conta antes de excluir a mesa.")
  })

  test("o garçom lança na secundária com o nome de um cliente: a comanda da principal não muda de nome", async () => {
    const api = servidor()
    const { comanda } = await aberta(api)
    const livre = await mesaNova(api, 31)
    await api.mesas.juntar(comanda.id, [livre])

    const lancada = await api.mesas.lancar({
      mesaId: livre,
      garcom: "Bia",
      clienteNome: "João",
      enviarParaCozinha: false,
      itens: REFRI(1),
    })

    expect(lancada.cliente.nome).toBe("Mesa 30")
  })

  test("fechar a conta da principal libera as duas e, com a limpeza ligada, põe as duas em limpeza", async () => {
    const api = servidor((catalogo) => {
      catalogo.salao.limpeza = true
    })
    const { mesaId, comanda } = await aberta(api)
    const livre = await mesaNova(api, 31)
    await api.mesas.juntar(comanda.id, [livre])

    await api.mesas.fecharConta(comanda.id, "pix")

    for (const id of [mesaId, livre]) {
      const mesa = await mesaDe(api, id)
      expect(mesa).toMatchObject({ status: "livre", limpezaDesde: AGORA.toISOString() })
      expect(mesa?.juntadaCom).toBeUndefined()
    }
  })

  test("separar solta as secundárias; itens e pessoas ficam na principal", async () => {
    const api = servidor()
    const { comanda } = await abertaPara(api, 30, 3, X_BURGER(1))
    const { mesaId: outra } = await abertaPara(api, 31, 2, REFRI(2))
    const livre = await mesaNova(api, 32)
    await api.mesas.juntar(comanda.id, [outra, livre])

    const { comanda: separada } = await api.mesas.separar(comanda.id, { por: "Bia" })

    expect(separada.mesa?.juntadas).toBeUndefined()
    expect(separada.mesa?.pessoas).toBe(5)
    expect(separada.itens).toHaveLength(2)
    expect(separada.eventos?.at(-1)).toMatchObject({
      tipo: "separada",
      por: "Bia",
      texto: "Separou as mesas 31 e 32",
    })
    expect((await mesaDe(api, outra))?.juntadaCom).toBeUndefined()
    await expect(api.mesas.separar(comanda.id)).rejects.toThrow(
      "A mesa 30 não está junto com outra.",
    )
  })

  test("desfazer o juntar devolve a comanda da secundária, com o mesmo id; desfazer o separar junta de novo", async () => {
    const api = servidor()
    const { comanda } = await aberta(api)
    const { mesaId: outra, comanda: daOutra } = await aberta(api, 31)
    const juntou = await api.mesas.juntar(comanda.id, [outra])

    await api.mesas.desfazer(juntou.desfazer)

    expect(await api.pedidos.buscar(daOutra.id)).toEqual(daOutra)
    expect(await api.pedidos.buscar(comanda.id)).toEqual(comanda)
    expect(await mesaDe(api, outra)).toMatchObject({ status: "ocupada", pedidoAtivoId: daOutra.id })

    const livre = await mesaNova(api, 32)
    const { comanda: junta } = await api.mesas.juntar(comanda.id, [livre])
    const separou = await api.mesas.separar(comanda.id)
    await api.mesas.desfazer(separou.desfazer)
    expect(await api.pedidos.buscar(comanda.id)).toEqual(junta)
    expect((await mesaDe(api, livre))?.juntadaCom).toBe(comanda.mesa?.id)
  })
})

describe("transferir itens", () => {
  const refriDe = (pedido: { itens: { id: string; nome: string }[] }) =>
    pedido.itens.find((item) => item.nome === "Refri lata")?.id as string

  test("1 de 3 Refris para a mesa livre: a linha se divide e a mesa abre com 1; o estoque não muda", async () => {
    const api = servidor()
    const { comanda } = await aberta(api, 30, REFRI(3))
    const destino = await mesaNova(api, 31)
    const movimentos = (await api.estoque.movimentos()).length

    const resultado = await api.mesas.transferirItens(comanda.id, {
      mesaDestinoId: destino,
      itens: [{ itemId: refriDe(comanda), quantidade: 1 }],
      por: "Bia",
    })

    expect(resultado.comanda.itens).toMatchObject([
      { id: refriDe(comanda), quantidade: 2, total: 12 },
    ])
    expect(resultado.comanda.total).toBe(12)
    expect(resultado.comanda.eventos?.at(-1)).toEqual({
      tipo: "itens-transferidos",
      em: AGORA.toISOString(),
      por: "Bia",
      texto: "Transferiu 1× Refri lata para a mesa 31",
    })
    expect(resultado.destino).toMatchObject({
      mesa: { id: destino, numero: 31, garcom: "Rafa", pessoas: 1 },
      itens: [
        {
          nome: "Refri lata",
          quantidade: 1,
          total: 6,
          transferido: { daMesa: 30, preparado: false },
        },
      ],
      total: 6,
    })
    expect(resultado.destino.itens[0].id).not.toBe(refriDe(comanda))
    expect(resultado.destino.eventos?.map((evento) => evento.texto)).toEqual([
      "Mesa aberta para 1 pessoa",
      "Recebeu 1× Refri lata da mesa 30",
    ])
    expect(await mesaDe(api, destino)).toMatchObject({
      status: "ocupada",
      pedidoAtivoId: resultado.destino.id,
    })
    expect(await saldo(api, "refri")).toBe(2)
    expect(await api.estoque.movimentos()).toHaveLength(movimentos)
  })

  test("para a mesa aberta, os itens entram na comanda dela e o pediu a conta sai", async () => {
    const api = servidor()
    const { comanda } = await aberta(api, 30, REFRI(2))
    const { mesaId: outra, comanda: daOutra } = await aberta(api, 31, REFRI(1))
    await api.mesas.pedirConta(daOutra.id)

    const { destino } = await api.mesas.transferirItens(comanda.id, {
      mesaDestinoId: outra,
      itens: [{ itemId: refriDe(comanda), quantidade: 2 }],
    })

    expect(destino.id).toBe(daOutra.id)
    expect(destino.itens.map((item) => item.quantidade)).toEqual([1, 2])
    expect(destino.contaPedidaEm).toBeUndefined()
    expect(destino.total).toBe(18)
  })

  test("para uma mesa juntada, os itens vão para a comanda da principal dela", async () => {
    const api = servidor()
    const { comanda } = await aberta(api, 30, REFRI(2))
    const { comanda: principal } = await aberta(api, 31, REFRI(1))
    const junta = await mesaNova(api, 32)
    await api.mesas.juntar(principal.id, [junta])

    const { destino } = await api.mesas.transferirItens(comanda.id, {
      mesaDestinoId: junta,
      itens: [{ itemId: refriDe(comanda), quantidade: 1 }],
    })

    expect(destino.id).toBe(principal.id)
    expect(destino.itens).toHaveLength(2)
  })

  test("o preparado chega preparado (tirar pede motivo); o sem cozinha sai sem motivo e devolve o estoque", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    const comanda = await api.mesas.lancar({
      mesaId,
      garcom: "Rafa",
      enviarParaCozinha: true,
      itens: X_BURGER(1),
    })
    await api.pedidos.avancar(comanda.id, "recebido")
    await api.pedidos.avancar(comanda.id, "em-preparo")
    const comRefri = await api.mesas.lancar({ mesaId, enviarParaCozinha: false, itens: REFRI(1) })
    const destino = await mesaNova(api, 31)

    const { destino: chegou } = await api.mesas.transferirItens(comanda.id, {
      mesaDestinoId: destino,
      itens: comRefri.itens.map((item) => ({ itemId: item.id, quantidade: 1 })),
    })

    const [xBurger, refri] = chegou.itens
    expect(xBurger.transferido).toEqual({ daMesa: 30, preparado: true })
    expect(refri.transferido).toEqual({ daMesa: 30, preparado: false })
    await expect(api.mesas.removerItem(chegou.id, xBurger.id)).rejects.toThrow(
      "Diga o motivo para tirar o que a cozinha já preparou.",
    )
    await api.mesas.removerItem(chegou.id, refri.id)
    expect(await saldo(api, "refri")).toBe(5)
  })

  test("o item pronto e não servido leva o Servir; a origem fica com ele enquanto sobrar algo pronto", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    const comanda = await api.mesas.lancar({
      mesaId,
      garcom: "Rafa",
      enviarParaCozinha: true,
      itens: X_BURGER(2),
    })
    await api.pedidos.avancar(comanda.id, "recebido")
    await api.pedidos.avancar(comanda.id, "em-preparo")
    const destino = await mesaNova(api, 31)
    const outro = await mesaNova(api, 32)

    // 1 dos 2 X-Burgers: sobra 1 pronto na 30, e as duas mesas ficam com o Servir.
    const parte = await api.mesas.transferirItens(comanda.id, {
      mesaDestinoId: destino,
      itens: [{ itemId: comanda.itens[0].id, quantidade: 1 }],
    })
    expect(parte.comanda.servirDesde).toBe(AGORA.toISOString())
    expect(parte.destino.servirDesde).toBe(AGORA.toISOString())

    // O que sobrou: a 30 fica sem nada pronto e perde o Servir; a 32 ganha.
    const resto = await api.mesas.transferirItens(comanda.id, {
      mesaDestinoId: outro,
      itens: [{ itemId: comanda.itens[0].id, quantidade: 1 }],
    })
    expect(resto.comanda.servirDesde).toBeUndefined()
    expect(resto.destino.servirDesde).toBe(AGORA.toISOString())
  })

  test("recusa sem itens, quantidade fora da linha, a mesma mesa e a bloqueada", async () => {
    const api = servidor()
    const { mesaId, comanda } = await aberta(api, 30, REFRI(3))
    const destino = await mesaNova(api, 31)
    const bloqueada = await mesaNova(api, 32)
    await api.mesas.bloquear(bloqueada)
    const transferir = (mesaDestinoId: string, quantidade: number) =>
      api.mesas.transferirItens(comanda.id, {
        mesaDestinoId,
        itens: [{ itemId: refriDe(comanda), quantidade }],
      })

    await expect(
      api.mesas.transferirItens(comanda.id, { mesaDestinoId: destino, itens: [] }),
    ).rejects.toThrow("Escolha os itens.")
    for (const quantidade of [0, 4, 1.5]) {
      await expect(transferir(destino, quantidade)).rejects.toThrow(
        "Informe uma quantidade válida.",
      )
    }
    await expect(transferir(mesaId, 1)).rejects.toThrow("Escolha outra mesa.")
    await expect(transferir(bloqueada, 1)).rejects.toThrow("A mesa 32 está bloqueada.")
  })

  test("recusa o item que a cozinha ainda tem, o pago por item e a origem que ficaria menor que o pago", async () => {
    const api = servidor()
    const mesaId = await mesaNova(api, 30)
    const naCozinha = await api.mesas.lancar({
      mesaId,
      garcom: "Rafa",
      enviarParaCozinha: true,
      itens: X_BURGER(1),
    })
    const destino = await mesaNova(api, 31)
    await expect(
      api.mesas.transferirItens(naCozinha.id, {
        mesaDestinoId: destino,
        itens: [{ itemId: naCozinha.itens[0].id, quantidade: 1 }],
      }),
    ).rejects.toThrow("A cozinha ainda está com X-Burger. Transfira quando ficar pronta.")

    const { comanda: paga } = await aberta(api, 32, [...REFRI(2), ...X_BURGER(1)])
    await api.mesas.pagar(paga.id, { forma: "pix", itens: [refriDe(paga)] })
    await expect(
      api.mesas.transferirItens(paga.id, {
        mesaDestinoId: destino,
        itens: [{ itemId: refriDe(paga), quantidade: 1 }],
      }),
    ).rejects.toThrow("Esse item já foi pago.")

    const { comanda: emParte } = await aberta(api, 33, REFRI(2))
    await api.mesas.pagar(emParte.id, { forma: "pix", valor: 10 })
    await expect(
      api.mesas.transferirItens(emParte.id, {
        mesaDestinoId: destino,
        itens: [{ itemId: refriDe(emParte), quantidade: 1 }],
      }),
    ).rejects.toThrow("A conta ficaria menor que o já pago. Estorne um pagamento antes.")
  })

  test("desfazer devolve a linha inteira e tira a comanda que abriu na mesa livre", async () => {
    const api = servidor()
    const { comanda } = await aberta(api, 30, REFRI(3))
    const destino = await mesaNova(api, 31)
    const { destino: aberta31, desfazer } = await api.mesas.transferirItens(comanda.id, {
      mesaDestinoId: destino,
      itens: [{ itemId: refriDe(comanda), quantidade: 1 }],
    })

    await api.mesas.desfazer(desfazer)

    expect(await api.pedidos.buscar(comanda.id)).toEqual(comanda)
    expect(await api.pedidos.buscar(aberta31.id)).toBeUndefined()
    expect((await mesaDe(api, destino))?.status).toBe("livre")
  })
})

describe("marcar limpa", () => {
  const limpezaDesde = new Date(AGORA.getTime() - 5 * 60_000).toISOString()

  async function emLimpeza() {
    const mesaId = await mesaNova(servidor(), 30)
    await naBase((base) => {
      base.mesas = base.mesas.map((mesa) => (mesa.id === mesaId ? { ...mesa, limpezaDesde } : mesa))
    })
    return mesaId
  }

  test("devolve a mesa e o desfazer; desfazer volta a limpeza com a hora de antes", async () => {
    const mesaId = await emLimpeza()
    const api = servidor()

    const { mesa, desfazer } = await api.mesas.marcarLimpa(mesaId)
    expect(mesa.limpezaDesde).toBeUndefined()
    await api.mesas.desfazer(desfazer)

    expect((await mesaDe(api, mesaId))?.limpezaDesde).toBe(limpezaDesde)
  })

  test("depois de abrir a mesa, desfazer a limpeza recusa", async () => {
    const mesaId = await emLimpeza()
    const api = servidor()
    const { desfazer } = await api.mesas.marcarLimpa(mesaId)
    await api.mesas.abrir(mesaId, { pessoas: 2, garcom: "Rafa" })

    await expect(api.mesas.desfazer(desfazer)).rejects.toThrow(
      "A mesa mudou depois disso. Desfaça pela comanda.",
    )
  })
})

describe("ids depois de juntar (achado da revisão)", () => {
  // A comanda juntada sai de Pedidos: o id e o número dela não voltam a ser usados.
  test("duas junções seguidas não repetem o id; tirar uma linha não tira a outra", async () => {
    const api = servidor()
    const { comanda } = await aberta(api, 30, X_BURGER(1))
    const { mesaId: m31, comanda: c31 } = await aberta(api, 31, REFRI(1))
    await api.mesas.juntar(comanda.id, [m31])
    const { mesaId: m32, comanda: c32 } = await aberta(api, 32, REFRI(2))

    expect(c32.id).toBe(c31.id + 1)
    expect(c32.numero).toBe(c31.numero + 1)

    const { comanda: junta } = await api.mesas.juntar(comanda.id, [m32])
    const ids = junta.itens.map((item) => item.id)
    expect(new Set(ids).size).toBe(3)

    const doisRefris = junta.itens.find((item) => item.quantidade === 2) as { id: string }
    const tirada = await api.mesas.removerItem(comanda.id, doisRefris.id)
    expect(tirada.itens.map((item) => `${item.quantidade}× ${item.nome}`)).toEqual([
      "1× X-Burger",
      "1× Refri lata",
    ])
  })

  test("abrir a mesa e transferir itens para a mesa livre também não repetem o id", async () => {
    const api = servidor()
    const { comanda } = await aberta(api, 30, X_BURGER(1))
    const { mesaId: m31, comanda: c31 } = await aberta(api, 31, REFRI(1))
    await api.mesas.juntar(comanda.id, [m31])

    const livre = await mesaNova(api, 32)
    const { destino } = await api.mesas.transferirItens(comanda.id, {
      mesaDestinoId: livre,
      itens: [{ itemId: comanda.itens[0].id, quantidade: 1 }],
    })
    expect(destino.id).toBe(c31.id + 1)

    const vazia = await mesaNova(api, 33)
    const aberta33 = await api.mesas.abrir(vazia, { pessoas: 2, garcom: "Rafa" })
    expect(aberta33.id).toBe(c31.id + 2)
  })
})

describe("reabrir a conta da principal (achado da revisão)", () => {
  /** A 30 com a 31 junta, a conta fechada. */
  async function fechadaComJunta(api: Api) {
    const { mesaId, comanda } = await aberta(api)
    const livre = await mesaNova(api, 31)
    await api.mesas.juntar(comanda.id, [livre])
    await api.mesas.fecharConta(comanda.id, "pix")
    return { mesaId, comanda, livre }
  }

  test("com as secundárias livres, reabre com a junção", async () => {
    const api = servidor()
    const { comanda, livre } = await fechadaComJunta(api)

    const reaberta = await api.mesas.reabrir(comanda.id, { motivo: "Errou a forma" })

    expect(reaberta.mesa?.juntadas).toEqual([{ id: livre, numero: 31 }])
    expect((await mesaDe(api, livre))?.juntadaCom).toBe(comanda.mesa?.id)
  })

  test("a secundária que abriu comanda própria: recusa, e a 31 continua com a comanda dela", async () => {
    const api = servidor()
    const { comanda, livre } = await fechadaComJunta(api)
    const daMesa31 = await api.mesas.lancar({
      mesaId: livre,
      garcom: "Bia",
      enviarParaCozinha: false,
      itens: REFRI(1),
    })

    expect(await api.mesas.ultimaConta(comanda.mesa?.id as string)).toBeNull()
    await expect(api.mesas.reabrir(comanda.id, { motivo: "Errou" })).rejects.toThrow(
      "A mesa 31 já está aberta. Reabrir não junta de novo.",
    )
    const lancada = await api.mesas.lancar({
      mesaId: livre,
      enviarParaCozinha: false,
      itens: REFRI(1),
    })
    expect(lancada.id).toBe(daMesa31.id)
  })

  test("a secundária bloqueada ou junta a outra mesa: recusa", async () => {
    const api = servidor()
    const { comanda, livre } = await fechadaComJunta(api)
    await api.mesas.bloquear(livre)
    await expect(api.mesas.reabrir(comanda.id, { motivo: "Errou" })).rejects.toThrow(
      "A mesa 31 está bloqueada. Reabrir não junta de novo.",
    )
    await api.mesas.desbloquear(livre)

    const { comanda: outra } = await aberta(api, 40)
    await api.mesas.juntar(outra.id, [livre])
    await expect(api.mesas.reabrir(comanda.id, { motivo: "Errou" })).rejects.toThrow(
      "A mesa 31 já está junto com a mesa 40. Reabrir não junta de novo.",
    )

    await api.mesas.separar(outra.id)
    await api.mesas.excluir(livre)
    await expect(api.mesas.reabrir(comanda.id, { motivo: "Errou" })).rejects.toThrow(
      "A mesa 31 foi excluída. Reabrir não junta de novo.",
    )
  })

  test("na base que já tem as duas abertas, a secundária lança na comanda dela", async () => {
    const api = servidor()
    const { comanda, livre } = await fechadaComJunta(api)
    const daMesa31 = await api.mesas.lancar({
      mesaId: livre,
      garcom: "Bia",
      enviarParaCozinha: false,
      itens: REFRI(1),
    })
    // Como a base ficava antes da correção: a principal reaberta com a junção.
    await naBase((base) => {
      base.pedidos = base.pedidos.map((pedido) =>
        pedido.id === comanda.id ? { ...pedido, status: "pronto" } : pedido,
      )
    })
    const outra = servidor()

    const lancada = await outra.mesas.lancar({
      mesaId: livre,
      enviarParaCozinha: false,
      itens: REFRI(1),
    })

    expect(lancada.id).toBe(daMesa31.id)
  })
})
