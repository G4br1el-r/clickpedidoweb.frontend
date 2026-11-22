import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, Praca, Produto } from "../dados/tipos"
import { historicoDoDia, historicoDoPeriodo, linhaDoTempo } from "./historico"

const DIA = new Date(2026, 10, 13)
const AGORA = new Date(2026, 10, 13, 21, 0)
/** "20:05" do dia de teste, em ISO. */
const as = (hora: string, dia = 13) => {
  const [h, m] = hora.split(":").map(Number)
  return new Date(2026, 10, dia, h, m).toISOString()
}

const item = (id: string, extra: Partial<ItemPedido> = {}): ItemPedido => ({
  id,
  produtoId: id,
  nome: id,
  quantidade: 1,
  precoUnitario: 10,
  opcoes: [],
  total: 10,
  ...extra,
})

let proximo = 1
const pedido = (extra: Partial<Pedido>): Pedido => {
  const numero = proximo++
  return {
    id: numero,
    numero: 1400 + numero,
    token: `t${numero}`,
    origem: "site",
    tipo: "entrega",
    status: "concluido",
    cliente: { nome: "Ana", telefone: "12991230000" },
    itens: [],
    subtotal: 10,
    desconto: 0,
    taxaEntrega: 0,
    total: 10,
    pagamento: "pix",
    situacaoPagamento: "pago",
    criadoEm: as("20:00"),
    atualizadoEm: as("20:00"),
    enviarParaCozinha: true,
    ...extra,
  }
}

describe("historicoDoDia", () => {
  test("uma linha por rodada que chegou no dia, a mais nova primeiro; o que não passou pela cozinha fica de fora", () => {
    const mesa = pedido({
      tipo: "mesa",
      mesa: { id: "m5", numero: 5 },
      criadoEm: as("19:00"),
      itens: [
        item("pizza", {
          rodada: 1,
          lancadoEm: as("19:00"),
          feitoEm: as("19:20"),
          servidoEm: as("19:25"),
        }),
        item("suco", {
          rodada: 2,
          lancadoEm: as("20:10"),
          feitoEm: as("20:15"),
          servidoEm: as("20:16"),
        }),
      ],
    })
    const entrega = pedido({
      criadoEm: as("20:00"),
      itens: [item("esfiha", { feitoEm: as("20:12") })],
    })
    const ontem = pedido({ criadoEm: as("20:00", 12), itens: [item("pizza")] })
    const balcao = pedido({ tipo: "retirada", enviarParaCozinha: false, itens: [item("refri")] })

    const linhas = historicoDoDia([mesa, entrega, ontem, balcao], DIA, { agora: AGORA })
    expect(linhas.map(({ ticket }) => ticket.id)).toEqual([
      `${mesa.id}:2`,
      `${entrega.id}:1`,
      `${mesa.id}:1`,
    ])
  })

  test("como terminou e quanto levou até ficar pronto; passou do atraso da loja, atrasado", () => {
    const pronto = (feito: string) => [item("pizza", { feitoEm: as(feito) })]
    const servido = pedido({
      tipo: "mesa",
      mesa: { id: "m1", numero: 1 },
      itens: [
        item("pizza", { lancadoEm: as("20:00"), feitoEm: as("20:30"), servidoEm: as("20:35") }),
      ],
    })
    const saiu = pedido({ itens: pronto("20:10"), etapas: { "saiu-para-entrega": as("20:15") } })
    const retirado = pedido({
      tipo: "retirada",
      itens: pronto("20:12"),
      etapas: { concluido: as("20:20") },
    })
    const cancelado = pedido({ status: "cancelado", itens: [item("pizza")] })
    const noQuadro = pedido({
      status: "em-preparo",
      itens: [item("pizza", { iniciadoEm: as("20:02") })],
    })
    const esperando = pedido({ status: "pronto", itens: pronto("20:20") })

    const linhas = historicoDoDia([servido, saiu, retirado, cancelado, noQuadro, esperando], DIA, {
      agora: AGORA,
      tempos: { atencaoMin: 15, atrasoMin: 25, prontoFicaMin: 15 },
    })
    const por = (alvo: Pedido) => {
      const linha = linhas.find(({ ticket }) => ticket.pedido.id === alvo.id)
      return [linha?.fim, linha?.minutosAtePronto, linha?.atrasado]
    }
    expect(por(servido)).toEqual(["servido", 30, true])
    expect(por(saiu)).toEqual(["saiu", 10, false])
    expect(por(retirado)).toEqual(["retirado", 12, false])
    expect(por(cancelado)).toEqual(["cancelado", null, false])
    expect(por(esperando)).toEqual(["pronto", 20, false])
    // Ainda no quadro: conta até agora (21:00), e já passou do atraso.
    expect(por(noQuadro)).toEqual(["no-quadro", null, true])
  })

  describe("busca e filtros", () => {
    const mesa5 = pedido({
      tipo: "mesa",
      mesa: { id: "m5", numero: 5 },
      cliente: { nome: "Mesa 5", telefone: "" },
      itens: [item("pizza", { feitoEm: as("20:40"), servidoEm: as("20:45") })],
    })
    const jose = pedido({
      numero: 1415,
      cliente: { nome: "José Araújo", telefone: "" },
      itens: [item("pizza", { feitoEm: as("20:10") })],
    })
    const cancelado = pedido({ status: "cancelado", tipo: "retirada", itens: [item("pizza")] })
    const todos = [mesa5, jose, cancelado]
    const ids = (opcoes: Parameters<typeof historicoDoDia>[2]) =>
      historicoDoDia(todos, DIA, opcoes).map(({ ticket }) => ticket.pedido.id)

    test("a busca acha pelo número, pela mesa e pelo nome, sem acento nem maiúscula", () => {
      expect(ids({ agora: AGORA, busca: "1415" })).toEqual([jose.id])
      expect(ids({ agora: AGORA, busca: "#1415" })).toEqual([jose.id])
      expect(ids({ agora: AGORA, busca: "mesa 5" })).toEqual([mesa5.id])
      expect(ids({ agora: AGORA, busca: "jose ARAUJO" })).toEqual([jose.id])
      expect(ids({ agora: AGORA, busca: "  " })).toHaveLength(3)
    })

    test("o tipo e a situação filtram", () => {
      expect(ids({ agora: AGORA, filtro: "mesas" })).toEqual([mesa5.id])
      expect(ids({ agora: AGORA, filtro: "retirada" })).toEqual([cancelado.id])
      expect(ids({ agora: AGORA, situacao: "cancelados" })).toEqual([cancelado.id])
      // A mesa levou 40 min (20:00 a 20:40): passou dos 25 do atraso.
      expect(ids({ agora: AGORA, situacao: "atrasados" })).toEqual([mesa5.id])
    })
  })
})

describe("linhaDoTempo", () => {
  const praca = (id: string, nome: string, categoriaIds: string[]): Praca => ({
    id,
    nome,
    cor: "ambar",
    categoriaIds,
    imprime: true,
    tocaSom: true,
  })
  const PRACAS = [praca("forno", "Forno", ["pizzas"]), praca("montagem", "Montagem", ["massas"])]
  const PRODUTOS = [
    { id: "pizza", categoriaId: "pizzas" },
    { id: "lasanha", categoriaId: "massas" },
  ] as Produto[]

  test("chegou, iniciou, cada praça pronta, pronto e servido, com quanto levou cada passo", () => {
    const mesa = pedido({
      tipo: "mesa",
      mesa: { id: "m2", numero: 2 },
      itens: [
        item("pizza", {
          lancadoEm: as("20:00"),
          iniciadoEm: as("20:03"),
          feitoEm: as("20:18"),
          servidoEm: as("20:26"),
        }),
        item("lasanha", {
          lancadoEm: as("20:00"),
          iniciadoEm: as("20:03"),
          feitoEm: as("20:22"),
          servidoEm: as("20:26"),
        }),
      ],
    })
    const [{ ticket }] = historicoDoDia([mesa], DIA, { agora: AGORA })
    expect(
      linhaDoTempo(ticket, { produtos: PRODUTOS, pracas: PRACAS }).map(({ rotulo, minutos }) => [
        rotulo,
        minutos,
      ]),
    ).toEqual([
      ["Chegou", null],
      ["Iniciou", 3],
      ["Forno pronto", 15],
      ["Montagem pronto", 4],
      ["Pronto", 0],
      ["Servido", 4],
    ])
  })

  test("com os itens numa praça só, o pronto dela é o próprio Pronto: não repete", () => {
    const soForno = pedido({
      itens: [item("pizza", { iniciadoEm: as("20:03"), feitoEm: as("20:18") })],
    })
    const [{ ticket }] = historicoDoDia([soForno], DIA, { agora: AGORA })
    expect(
      linhaDoTempo(ticket, { produtos: PRODUTOS, pracas: PRACAS }).map(({ rotulo }) => rotulo),
    ).toEqual(["Chegou", "Iniciou", "Pronto"])
  })

  test("a saída da entrega e da retirada, o cancelamento e os avisos com o ciente", () => {
    const passos = (alvo: Pedido) =>
      linhaDoTempo(historicoDoDia([alvo], DIA, { agora: AGORA })[0].ticket, {
        produtos: [],
        pracas: [],
      }).map(({ rotulo }) => rotulo)
    const feito = [item("pizza", { iniciadoEm: as("20:02"), feitoEm: as("20:10") })]
    expect(passos(pedido({ itens: feito, etapas: { "saiu-para-entrega": as("20:15") } }))).toEqual([
      "Chegou",
      "Iniciou",
      "Pronto",
      "Saiu para entrega",
    ])
    expect(
      passos(pedido({ tipo: "retirada", itens: feito, etapas: { concluido: as("20:30") } })),
    ).toEqual(["Chegou", "Iniciou", "Pronto", "Retirado"])
    expect(
      passos(
        pedido({
          status: "cancelado",
          itens: [item("pizza", { iniciadoEm: as("20:02") })],
          etapas: { cancelado: as("20:05") },
          avisosCozinha: [{ id: "a1", tipo: "cancelado", em: as("20:05"), cienteEm: as("20:07") }],
        }),
      ),
    ).toEqual(["Chegou", "Iniciou", "Cancelado", "Ciente do cancelamento"])
    // Cancelado antes de a cozinha ver (sem aviso): a hora vem da etapa do pedido.
    expect(
      passos(
        pedido({ status: "cancelado", itens: [item("pizza")], etapas: { cancelado: as("20:01") } }),
      ),
    ).toEqual(["Chegou", "Cancelado"])
    expect(
      passos(
        pedido({
          tipo: "mesa",
          mesa: { id: "m3", numero: 3 },
          itens: [item("pizza", { iniciadoEm: as("20:02") })],
          avisosCozinha: [
            {
              id: "a2",
              tipo: "alterado",
              em: as("20:04"),
              rodada: 1,
              itens: [{ nome: "Coca", quantidade: 1 }],
            },
          ],
        }),
      ),
    ).toEqual(["Chegou", "Iniciou", "Alterado: −1 Coca"])
  })
})

describe("o refazer no Histórico", () => {
  const original = () =>
    pedido({
      criadoEm: as("20:00"),
      itens: [item("pizza", { iniciadoEm: as("20:02"), feitoEm: as("20:15") })],
      etapas: { "saiu-para-entrega": as("20:20") },
      refacoes: [
        {
          numero: 1,
          rodada: 1,
          motivo: "caiu",
          em: as("20:40"),
          itens: [item("pizza~r1", { iniciadoEm: as("20:42"), feitoEm: as("20:50") })],
          entregueEm: as("20:55"),
        },
      ],
    })

  test("o refazer é uma linha própria, o original fica marcado Refeito e o filtro acha os dois", () => {
    const alvo = original()
    const linhas = historicoDoDia([alvo], DIA, { agora: AGORA })
    expect(linhas.map((linha) => [linha.ticket.id, linha.fim, linha.refeito])).toEqual([
      [`${alvo.id}:1:r1`, "entregue", false],
      [`${alvo.id}:1`, "saiu", true],
    ])
    expect(historicoDoDia([alvo], DIA, { agora: AGORA, situacao: "refeitos" })).toHaveLength(2)
    expect(
      historicoDoDia([pedido({ itens: [item("x", { feitoEm: as("20:10") })] })], DIA, {
        agora: AGORA,
        situacao: "refeitos",
      }),
    ).toEqual([])
  })

  test("a linha do tempo do original mostra quando foi refeito e por quê", () => {
    const linhas = historicoDoDia([original()], DIA, { agora: AGORA })
    const doOriginal = linhas[1].ticket
    expect(
      linhaDoTempo(doOriginal, { produtos: [], pracas: [] }).map(({ rotulo }) => rotulo),
    ).toEqual(["Chegou", "Iniciou", "Pronto", "Saiu para entrega", "Refeito: caiu"])
    expect(
      linhaDoTempo(linhas[0].ticket, { produtos: [], pracas: [] }).map(({ rotulo }) => rotulo),
    ).toEqual(["Chegou", "Iniciou", "Pronto", "Entregue"])
  })
})

describe("historicoDoPeriodo", () => {
  test("as linhas de cada dia do período, dia a dia; no dia, a mais nova primeiro", () => {
    const antes = pedido({ criadoEm: as("20:00", 10), itens: [item("pizza")] })
    const cedo = pedido({ criadoEm: as("19:00", 11), itens: [item("pizza")] })
    const tarde = pedido({ criadoEm: as("21:00", 11), itens: [item("pizza")] })
    const hoje = pedido({ criadoEm: as("20:00", 13), itens: [item("pizza")] })
    const depois = pedido({ criadoEm: as("20:00", 14), itens: [item("pizza")] })

    const linhas = historicoDoPeriodo(
      [hoje, antes, cedo, depois, tarde],
      { de: new Date(2026, 10, 11), ate: DIA },
      { agora: AGORA },
    )
    expect(linhas.map(({ ticket }) => ticket.id)).toEqual([
      `${tarde.id}:1`,
      `${cedo.id}:1`,
      `${hoje.id}:1`,
    ])
  })
})
