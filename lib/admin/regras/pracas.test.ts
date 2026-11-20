import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, Praca, Produto } from "../dados/tipos"
import {
  atrasadosNaCozinha,
  chavesDaCozinha,
  colunasDaCozinha,
  maisTardeNaCozinha,
  prontoNaPraca,
  ticketsDaCozinha,
} from "./cozinha"
import { AGORA_DE_TESTE as AGORA, PEDIDOS_DE_TESTE } from "./pedidos-de-teste"
import { marcarVia, pracaDoItem, ticketNaPraca, viasAImprimir, viasDoTicket } from "./pracas"

const praca = (id: string, categoriaIds: string[]): Praca => ({
  id,
  nome: id[0].toUpperCase() + id.slice(1),
  cor: "ambar",
  categoriaIds,
  imprime: true,
  tocaSom: true,
})

const PRACAS = [praca("forno", ["cat-pizzas"]), praca("montagem", ["cat-massas"])]

const produto = (id: string, categoriaId: string, pracaId?: string) =>
  ({ id, categoriaId, ...(pracaId ? { pracaId } : {}) }) as Produto

const PRODUTOS = [
  produto("calabresa", "cat-pizzas"),
  produto("lasanha", "cat-massas"),
  // Pizza doce sai da Montagem, apesar da categoria.
  produto("brigadeiro", "cat-pizzas", "montagem"),
  produto("refri", "cat-bebidas"),
]

const item = (produtoId: string | null) =>
  ({ id: produtoId ?? "avulso", produtoId, nome: produtoId ?? "Avulso" }) as ItemPedido

describe("pracaDoItem", () => {
  test("a praça do produto, senão a da categoria, senão Geral", () => {
    expect(pracaDoItem(item("calabresa"), PRODUTOS, PRACAS)).toBe("forno")
    expect(pracaDoItem(item("lasanha"), PRODUTOS, PRACAS)).toBe("montagem")
    expect(pracaDoItem(item("brigadeiro"), PRODUTOS, PRACAS)).toBe("montagem")
    expect(pracaDoItem(item("refri"), PRODUTOS, PRACAS)).toBe("geral")
  })

  test("o item avulso e o produto que saiu do cardápio vão para Geral", () => {
    expect(pracaDoItem(item(null), PRODUTOS, PRACAS)).toBe("geral")
    expect(pracaDoItem(item("sumiu"), PRODUTOS, PRACAS)).toBe("geral")
  })

  test("a praça do produto que foi apagada não vale: volta para a da categoria", () => {
    const semMontagem = [PRACAS[0]]
    expect(pracaDoItem(item("brigadeiro"), PRODUTOS, semMontagem)).toBe("forno")
  })
})

const atras = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000).toISOString()

/** Entrega com 2 pizzas (Forno), 1 lasanha (Montagem) e 1 refri (Geral). */
function entrega(feitos: string[] = [], iniciado = false): Pedido {
  const linha = (id: string, produtoId: string): ItemPedido => ({
    ...item(produtoId),
    id,
    quantidade: 1,
    precoUnitario: 10,
    opcoes: [],
    total: 10,
    ...(iniciado || feitos.includes(id) ? { iniciadoEm: atras(5) } : {}),
    ...(feitos.includes(id) ? { feitoEm: atras(1) } : {}),
  })
  return {
    ...PEDIDOS_DE_TESTE[2],
    id: 50,
    numero: 50,
    tipo: "entrega",
    status: iniciado || feitos.length > 0 ? "em-preparo" : "recebido",
    enviarParaCozinha: true,
    criadoEm: atras(8),
    itens: [
      linha("p1", "calabresa"),
      linha("p2", "brigadeiro"),
      linha("p3", "lasanha"),
      linha("p4", "refri"),
    ],
  }
}

const visao = (pracaId: string) => ({ pracaId, produtos: PRODUTOS, pracas: PRACAS })
const nomesDos = (itens: ItemPedido[]) => itens.map((linha) => linha.id)

describe("ticketNaPraca", () => {
  test("só os itens da praça, e o que falta nas outras", () => {
    const [ticket] = ticketsDaCozinha([entrega()])
    const noForno = ticketNaPraca(ticket, visao("forno"))
    expect(nomesDos(noForno?.itens ?? [])).toEqual(["p1"])
    expect(noForno?.status).toBe("recebido")
    expect(noForno?.outras).toEqual([
      { id: "montagem", nome: "Montagem", cor: "ambar", faltam: 2 },
      { id: "geral", nome: "Geral", cor: "cinza", faltam: 1 },
    ])
  })

  test("com os itens da praça riscados, fica pronto nela, aguardando as outras", () => {
    const [ticket] = ticketsDaCozinha([entrega(["p1"], true)])
    expect(ticket.status).toBe("em-preparo")
    const noForno = ticketNaPraca(ticket, visao("forno"))
    expect(noForno?.status).toBe("pronto")
    expect(noForno?.outras.map((outra) => [outra.id, outra.faltam])).toEqual([
      ["montagem", 2],
      ["geral", 1],
    ])
  })

  test("sem itens da praça, o ticket não aparece nela", () => {
    const soRefri = { ...entrega(), itens: entrega().itens.filter((linha) => linha.id === "p4") }
    const [ticket] = ticketsDaCozinha([soRefri])
    expect(ticketNaPraca(ticket, visao("forno"))).toBeNull()
    expect(ticketNaPraca(ticket, visao("geral"))?.outras).toEqual([])
  })
})

describe("colunasDaCozinha numa praça", () => {
  test("cada praça vê o ticket na coluna dos itens dela", () => {
    const pedidos = [entrega(["p1"], true)]
    const ids = (pracaId: string) =>
      colunasDaCozinha(pedidos, "todos", AGORA, undefined, visao(pracaId)).map((coluna) =>
        coluna.tickets.map((ticket) => ticket.id),
      )
    expect(ids("forno")).toEqual([[], [], ["50:1"]])
    expect(ids("montagem")).toEqual([[], ["50:1"], []])
  })
})

describe("alertas e Mais tarde numa praça", () => {
  const soRefri = { ...entrega(), id: 51, itens: entrega().itens.filter((l) => l.id === "p4") }

  test("o alerta de novo só conta o ticket que tem itens da praça", () => {
    const pedidos = [entrega(), soRefri]
    expect(chavesDaCozinha(pedidos, AGORA, undefined, visao("forno"))).toEqual(new Set(["50:1"]))
    expect(chavesDaCozinha(pedidos, AGORA, undefined, visao("geral"))).toEqual(
      new Set(["50:1", "51:1"]),
    )
  })

  test("o atraso conta só para a praça que ainda não terminou", () => {
    const atrasado = { ...entrega(["p1"], true), criadoEm: atras(40) }
    expect(atrasadosNaCozinha([atrasado], AGORA, undefined, visao("forno"))).toEqual(new Set())
    expect(atrasadosNaCozinha([atrasado], AGORA, undefined, visao("montagem"))).toEqual(
      new Set(["50:1"]),
    )
  })

  test("Mais tarde mostra só o agendado com itens da praça", () => {
    const para = new Date(AGORA.getTime() + 90 * 60_000).toISOString()
    const agendar = (pedido: Pedido) => ({
      ...pedido,
      itens: pedido.itens.map((linha) => ({ ...linha, agendadoPara: para })),
    })
    const pedidos = [agendar(entrega()), agendar(soRefri)]
    const ids = (pracaId: string) =>
      maisTardeNaCozinha(pedidos, "todos", AGORA, undefined, visao(pracaId)).map((t) => t.id)
    expect(ids("forno")).toEqual(["50:1"])
    expect(ids("geral")).toEqual(["50:1", "51:1"])
  })
})

describe("prontoNaPraca", () => {
  const agora = AGORA.toISOString()

  test("risca só os itens da praça e começa a rodada inteira", () => {
    const pedido = prontoNaPraca(entrega(), 1, visao("montagem"), agora)
    expect(
      pedido.itens.map((linha) => [linha.id, Boolean(linha.iniciadoEm), Boolean(linha.feitoEm)]),
    ).toEqual([
      ["p1", true, false],
      ["p2", true, true],
      ["p3", true, true],
      ["p4", true, false],
    ])
    expect(pedido.status).toBe("em-preparo")
  })

  test("quando a última praça termina, a rodada fica pronta", () => {
    let pedido = entrega()
    for (const pracaId of ["forno", "montagem", "geral"]) {
      pedido = prontoNaPraca(pedido, 1, visao(pracaId), agora)
    }
    expect(pedido.status).toBe("pronto")
  })

  test("recusa a praça sem itens na rodada e o pedido cancelado", () => {
    const soRefri = { ...entrega(), itens: entrega().itens.filter((l) => l.id === "p4") }
    expect(() => prontoNaPraca(soRefri, 1, visao("forno"), agora)).toThrow(
      "Esta praça não tem itens nesta rodada.",
    )
    expect(() =>
      prontoNaPraca({ ...entrega(), status: "cancelado" }, 1, visao("forno"), agora),
    ).toThrow("Este pedido foi cancelado.")
  })
})

describe("vias da cozinha", () => {
  const opcoes = (pracaDoAparelho: string, extra = {}) => ({
    agora: AGORA,
    produtos: PRODUTOS,
    pracas: [{ ...PRACAS[0] }, { ...PRACAS[1], imprime: false }],
    pracaDoAparelho,
    ...extra,
  })
  const resumo = (vias: ReturnType<typeof viasAImprimir>) =>
    vias.map((via) => [via.chave, via.praca.nome, via.itens.map((linha) => linha.id)])

  test("em Todas, uma via por praça que imprime, da rodada em A fazer", () => {
    const iniciada = { ...entrega([], true), id: 52 }
    expect(resumo(viasAImprimir([entrega(), iniciada], opcoes("todas")))).toEqual([
      ["50:1:forno", "Forno", ["p1"]],
    ])
  })

  test("o aparelho de uma praça imprime só a dela", () => {
    expect(resumo(viasAImprimir([entrega()], opcoes("montagem")))).toEqual([])
    expect(resumo(viasAImprimir([entrega()], opcoes("forno")))).toEqual([
      ["50:1:forno", "Forno", ["p1"]],
    ])
  })

  test("a via já impressa em outro aparelho não sai de novo", () => {
    const impresso = { ...entrega(), viasImpressas: ["1:forno"] }
    expect(viasAImprimir([impresso], opcoes("todas"))).toEqual([])
  })

  test("sem praças, uma via só (Geral), se a loja liga a via da cozinha", () => {
    const semPracas = { pracas: [], viaDaCozinha: true }
    expect(resumo(viasAImprimir([entrega()], opcoes("todas", semPracas)))).toEqual([
      ["50:1:geral", "Geral", ["p1", "p2", "p3", "p4"]],
    ])
    expect(viasAImprimir([entrega()], opcoes("todas", { pracas: [] }))).toEqual([])
  })

  test("marcar a via diz se ela é nova; a repetida não muda o pedido", () => {
    const primeira = marcarVia(entrega(), "1:forno")
    expect(primeira.nova).toBe(true)
    expect(primeira.pedido.viasImpressas).toEqual(["1:forno"])
    const repetida = marcarVia(primeira.pedido, "1:forno")
    expect(repetida).toEqual({ pedido: primeira.pedido, nova: false })
  })
})

describe("viasDoTicket (reimprimir)", () => {
  const [ticket] = ticketsDaCozinha([entrega()])
  const resumo = (pracaDoAparelho: string, pracas = PRACAS) =>
    viasDoTicket(ticket, { produtos: PRODUTOS, pracas, pracaDoAparelho }).map((via) => [
      via.praca.nome,
      via.itens.map((linha) => linha.id),
    ])

  test("na praça, a via dela; em Todas, uma por praça com itens, Geral no fim", () => {
    expect(resumo("montagem")).toEqual([["Montagem", ["p2", "p3"]]])
    expect(resumo("todas")).toEqual([
      ["Forno", ["p1"]],
      ["Montagem", ["p2", "p3"]],
      ["Geral", ["p4"]],
    ])
  })

  test("sem praças, uma via com tudo", () => {
    expect(resumo("todas", [])).toEqual([["Geral", ["p1", "p2", "p3", "p4"]]])
  })
})
