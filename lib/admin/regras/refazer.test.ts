import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, Produto } from "../dados/tipos"
import {
  avancarRodada,
  colunasDaCozinha,
  prontoNaPraca,
  prontosParaServir,
  riscarItem,
  servirRodada,
  statusPelasRodadas,
  ticketsDaCozinha,
  voltarRodada,
} from "./cozinha"
import { historicoDoDia } from "./historico"
import { entregarRefazer, podeRefazer, refazer } from "./refazer"

const historicoDe = (pedido: Pedido) =>
  historicoDoDia([pedido], new Date(2026, 10, 13), { agora: new Date(2026, 10, 13, 21, 0) }).map(
    ({ ticket }) => ticket,
  )

const AGORA = new Date(2026, 10, 13, 21, 0)
const as = (hora: string, dia = 13) => {
  const [h, m] = hora.split(":").map(Number)
  return new Date(2026, 10, dia, h, m).toISOString()
}

const item = (id: string, extra: Partial<ItemPedido> = {}): ItemPedido => ({
  id,
  produtoId: id,
  nome: id,
  quantidade: 2,
  precoUnitario: 10,
  opcoes: ["Borda: Catupiry"],
  observacao: "sem cebola",
  total: 20,
  ...extra,
})

const feito = { iniciadoEm: as("20:05"), feitoEm: as("20:20") }

/** Entrega de hoje, já saiu: duas pizzas e um refri, todos feitos. */
const ENTREGA: Pedido = {
  id: 1,
  numero: 1410,
  token: "t1",
  origem: "site",
  tipo: "entrega",
  status: "saiu-para-entrega",
  cliente: { nome: "Ana", telefone: "12991230000" },
  itens: [item("pizza", feito), item("refri", { ...feito, quantidade: 1, total: 10 })],
  subtotal: 30,
  desconto: 0,
  taxaEntrega: 0,
  total: 30,
  pagamento: "pix",
  situacaoPagamento: "pago",
  criadoEm: as("20:00"),
  atualizadoEm: as("20:30"),
  enviarParaCozinha: true,
}

describe("refazer", () => {
  test("guarda à parte uma cópia dos itens escolhidos, sem horários; o pedido não muda", () => {
    const refeito = refazer(
      ENTREGA,
      { rodada: 1, itens: [{ itemId: "pizza", quantidade: 1 }], motivo: "caiu" },
      AGORA,
    )
    expect(refeito.refacoes).toEqual([
      {
        numero: 1,
        rodada: 1,
        motivo: "caiu",
        em: AGORA.toISOString(),
        itens: [
          {
            id: "pizza~r1",
            produtoId: "pizza",
            nome: "pizza",
            quantidade: 1,
            precoUnitario: 10,
            opcoes: ["Borda: Catupiry"],
            observacao: "sem cebola",
            total: 10,
            rodada: 1,
          },
        ],
      },
    ])
    const { refacoes, ...resto } = refeito
    expect(resto).toEqual(ENTREGA)
  })

  test("só refaz a rodada de hoje que já ficou pronta, de pedido não cancelado", () => {
    const tudo = {
      rodada: 1,
      itens: [{ itemId: "pizza", quantidade: 2 }],
      motivo: "errado" as const,
    }
    expect(() => refazer({ ...ENTREGA, status: "cancelado" }, tudo, AGORA)).toThrow(
      "Pedido cancelado não pode ser refeito.",
    )
    expect(() => refazer(ENTREGA, tudo, new Date(2026, 10, 14, 10, 0))).toThrow(
      "Só dá para refazer pedidos de hoje.",
    )
    const noFogo = { ...ENTREGA, itens: [item("pizza", { iniciadoEm: as("20:05") })] }
    expect(() => refazer(noFogo, tudo, AGORA)).toThrow(
      "Este ticket ainda está na cozinha: use voltar ou desriscar.",
    )
    expect(() => refazer(ENTREGA, { ...tudo, rodada: 2 }, AGORA)).toThrow(
      "Esta rodada não passou pela cozinha.",
    )
  })

  test("confere a escolha: algum item da rodada, quantidade de 1 até a pedida, texto curto", () => {
    const pedir = (entrada: Partial<Parameters<typeof refazer>[1]>) => () =>
      refazer(ENTREGA, { rodada: 1, itens: [], motivo: "outro", ...entrada }, AGORA)
    expect(pedir({ itens: [] })).toThrow("Escolha ao menos um item.")
    expect(pedir({ itens: [{ itemId: "pizza", quantidade: 0 }] })).toThrow(
      "Escolha ao menos um item.",
    )
    expect(pedir({ itens: [{ itemId: "pizza", quantidade: 3 }] })).toThrow(
      "pizza: refaça no máximo 2.",
    )
    expect(pedir({ itens: [{ itemId: "sumiu", quantidade: 1 }] })).toThrow(
      "Este item não é desta rodada.",
    )
    expect(pedir({ itens: [{ itemId: "pizza", quantidade: 1 }], texto: "x".repeat(61) })).toThrow(
      "Explique em até 60 letras.",
    )
    // A quantidade zero só não conta: com outro item escolhido, refaz o outro.
    const refeito = refazer(
      ENTREGA,
      {
        rodada: 1,
        motivo: "outro",
        texto: "  cliente pediu de novo ",
        itens: [
          { itemId: "pizza", quantidade: 0 },
          { itemId: "refri", quantidade: 1 },
        ],
      },
      AGORA,
    )
    expect(refeito.refacoes?.[0].itens.map((copia) => copia.id)).toEqual(["refri~r1"])
    expect(refeito.refacoes?.[0].texto).toBe("cliente pediu de novo")
  })
})

describe("o refazer na cozinha", () => {
  const caiu = () =>
    refazer(
      ENTREGA,
      { rodada: 1, itens: [{ itemId: "pizza", quantidade: 1 }], motivo: "caiu" },
      AGORA,
    )

  test("vira um ticket em A fazer, marcado, mesmo com o pedido já fora da cozinha", () => {
    const [ticket] = ticketsDaCozinha([caiu()])
    expect(ticket).toMatchObject({
      id: "1:1:r1",
      rodada: 1,
      status: "recebido",
      chegouEm: AGORA.toISOString(),
      refazer: { numero: 1, motivo: "caiu" },
    })
    expect(ticket.itens.map((copia) => [copia.id, copia.quantidade])).toEqual([["pizza~r1", 1]])
    // Só o refazer: a rodada original já saiu.
    expect(ticketsDaCozinha([caiu()])).toHaveLength(1)
    expect(statusPelasRodadas(caiu())).toBeNull()
  })

  test("inicia, risca, volta e fica pronto como os outros; o pedido e os itens dele não mudam", () => {
    const hora = (h: string) => as(h)
    let pedido = caiu()
    const doRefazer = () => ticketsDaCozinha([pedido])[0]
    pedido = avancarRodada(pedido, 1, "recebido", hora("21:01"), 1)
    expect(doRefazer().status).toBe("em-preparo")
    pedido = voltarRodada(pedido, 1, "em-preparo", 1)
    expect(doRefazer().status).toBe("recebido")
    pedido = riscarItem(pedido, "pizza~r1", true, hora("21:05"))
    expect(doRefazer().status).toBe("pronto")

    expect(pedido.status).toBe("saiu-para-entrega")
    expect(pedido.itens).toEqual(ENTREGA.itens)
    expect(pedido.refacoes?.[0].itens[0]).toMatchObject({
      iniciadoEm: hora("21:05"),
      feitoEm: hora("21:05"),
    })
  })

  test("na mesa, sai quando o garçom serve; na entrega, quando a cozinha entrega", () => {
    const mesa: Pedido = {
      ...ENTREGA,
      tipo: "mesa",
      status: "pronto",
      mesa: { id: "m4", numero: 4 },
      itens: [item("pizza", { ...feito, servidoEm: as("20:25") })],
    }
    let naMesa = refazer(
      mesa,
      { rodada: 1, itens: [{ itemId: "pizza", quantidade: 1 }], motivo: "errado" },
      AGORA,
    )
    naMesa = riscarItem(naMesa, "pizza~r1", true, as("21:10"))
    expect(prontosParaServir([naMesa]).map((ticket) => ticket.id)).toEqual(["1:1:r1"])
    naMesa = servirRodada(naMesa, 1, as("21:12"), 1)
    expect(ticketsDaCozinha([naMesa])).toEqual([])
    expect(naMesa.itens).toEqual(mesa.itens)

    let entrega = riscarItem(caiu(), "pizza~r1", true, as("21:10"))
    entrega = entregarRefazer(entrega, 1, as("21:15"))
    expect(entrega.refacoes?.[0].entregueEm).toBe(as("21:15"))
    expect(ticketsDaCozinha([entrega])).toEqual([])
    expect(() => entregarRefazer(caiu(), 1, as("21:15"))).toThrow(
      "Este refazer ainda não está pronto.",
    )
    expect(() => entregarRefazer(ENTREGA, 1, as("21:15"))).toThrow("Refazer não encontrado.")
  })

  test("entra no topo de A fazer, como prioridade; o pedido cancelado depois some do quadro", () => {
    const outro: Pedido = {
      ...ENTREGA,
      id: 2,
      numero: 1411,
      status: "recebido",
      criadoEm: as("20:40"),
      itens: [item("esfiha")],
    }
    const [aFazer] = colunasDaCozinha([outro, caiu()], "todos", AGORA)
    expect(aFazer.tickets.map((ticket) => ticket.id)).toEqual(["1:1:r1", "2:1"])
    expect(ticketsDaCozinha([{ ...caiu(), status: "cancelado" }])).toEqual([])
  })

  test("na praça, o pronto risca só a parte dela do refazer", () => {
    const visao = {
      pracaId: "forno",
      produtos: [
        { id: "pizza", categoriaId: "pizzas" },
        { id: "refri", categoriaId: "bebidas" },
      ] as Produto[],
      pracas: [
        {
          id: "forno",
          nome: "Forno",
          cor: "ambar" as const,
          categoriaIds: ["pizzas"],
          imprime: true,
          tocaSom: true,
        },
      ],
    }
    // A mesa ainda não serviu: a rodada original continua em Prontos, ao lado do refazer.
    const mesa: Pedido = {
      ...ENTREGA,
      tipo: "mesa",
      status: "pronto",
      mesa: { id: "m6", numero: 6 },
    }
    const tudo = refazer(
      mesa,
      {
        rodada: 1,
        itens: [
          { itemId: "pizza", quantidade: 1 },
          { itemId: "refri", quantidade: 1 },
        ],
        motivo: "reclamacao",
      },
      AGORA,
    )
    const feitoNoForno = prontoNaPraca(tudo, 1, visao, as("21:08"), 1)
    expect(
      feitoNoForno.refacoes?.[0].itens.map((copia) => [copia.id, Boolean(copia.feitoEm)]),
    ).toEqual([
      ["pizza~r1", true],
      ["refri~r1", false],
    ])
    expect(feitoNoForno.itens).toEqual(ENTREGA.itens)
  })
})

describe("podeRefazer", () => {
  test("o ticket de hoje, pronto, de pedido não cancelado; o próprio refazer não", () => {
    const [ticket] = historicoDe(ENTREGA)
    expect(podeRefazer(ticket, AGORA)).toBe(true)
    expect(podeRefazer(ticket, new Date(2026, 10, 14, 9, 0))).toBe(false)
    expect(podeRefazer({ ...ticket, status: "em-preparo" }, AGORA)).toBe(false)
    expect(podeRefazer({ ...ticket, pedido: { ...ENTREGA, status: "cancelado" } }, AGORA)).toBe(
      false,
    )
    expect(podeRefazer({ ...ticket, refazer: { numero: 1, motivo: "caiu" } }, AGORA)).toBe(false)
  })
})
