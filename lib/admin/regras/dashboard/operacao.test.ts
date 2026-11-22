import { addMinutes } from "date-fns"
import { describe, expect, test } from "vitest"
import type { Pedido, StatusPedido, TipoPedido } from "../../dados/tipos"
import { PERIODO_DE_TESTE as PERIODO, pedidoDeTeste } from "../pedidos-de-teste"
import {
  atrasosPorHora,
  cancelamentos,
  mesasDoPeriodo,
  noPrazo,
  pontualidade,
  temposPorEtapa,
} from "./operacao"

const CRIADO = new Date(2026, 10, 13, 19)

/**
 * Pedido encerrado com o histórico dado em minutos desde a criação: `[["recebido", 0],
 * ["em-preparo", 3], ...]`. O status é o da última etapa.
 */
function comHistorico(
  id: number,
  tipo: TipoPedido,
  etapas: [StatusPedido, number][],
  mudancas: Partial<Pedido> = {},
  criado = CRIADO,
): Pedido {
  const historico = etapas.map(([status, minutos]) => ({
    status,
    em: addMinutes(criado, minutos).toISOString(),
  }))
  return pedidoDeTeste(id, criado, 50, {
    tipo,
    status: etapas.at(-1)?.[0] ?? "recebido",
    historico,
    atualizadoEm: historico.at(-1)?.em ?? criado.toISOString(),
    ...mudancas,
  })
}

describe("temposPorEtapa", () => {
  test("média e o tempo em que 9 de cada 10 pedidos ficam, em cada etapa e no total", () => {
    const pedidos = [
      comHistorico(1, "entrega", [
        ["recebido", 0],
        ["em-preparo", 2],
        ["pronto", 22],
        ["saiu-para-entrega", 27],
        ["concluido", 47],
      ]),
      comHistorico(2, "entrega", [
        ["recebido", 0],
        ["em-preparo", 4],
        ["pronto", 34],
        ["saiu-para-entrega", 45],
        ["concluido", 75],
      ]),
      // Retirada: o total vai até ficar pronto (a demora do cliente não conta).
      comHistorico(3, "retirada", [
        ["recebido", 0],
        ["em-preparo", 6],
        ["pronto", 16],
        ["concluido", 90],
      ]),
    ]
    expect(temposPorEtapa(pedidos, PERIODO)).toEqual({
      aceite: { pedidos: 3, media: 4, noveEmDez: 6 },
      preparo: { pedidos: 3, media: 20, noveEmDez: 30 },
      espera: { pedidos: 2, media: 8, noveEmDez: 11 },
      entrega: { pedidos: 2, media: 25, noveEmDez: 30 },
      total: { pedidos: 3, media: 46, noveEmDez: 75 },
    })
  })

  test("pago online, o relógio começa no pagamento; em andamento e cancelado não entram", () => {
    const pedidos = [
      comHistorico(1, "retirada", [
        ["aguardando-pagamento", 0],
        ["recebido", 5],
        ["em-preparo", 7],
        ["pronto", 27],
        ["concluido", 30],
      ]),
      comHistorico(2, "retirada", [
        ["recebido", 0],
        ["em-preparo", 3],
      ]),
      comHistorico(3, "retirada", [
        ["recebido", 0],
        ["cancelado", 9],
      ]),
    ]
    expect(temposPorEtapa(pedidos, PERIODO)).toMatchObject({
      aceite: { pedidos: 1, media: 2 },
      total: { pedidos: 1, media: 22 },
      espera: { pedidos: 0, media: 0, noveEmDez: 0 },
    })
  })
})

describe("noPrazo e atrasosPorHora", () => {
  const pedidos = [
    // 19h: um no prazo (35 min) e um atrasado (41 min na entrega).
    comHistorico(1, "entrega", [
      ["recebido", 0],
      ["em-preparo", 2],
      ["pronto", 20],
      ["saiu-para-entrega", 22],
      ["concluido", 35],
    ]),
    comHistorico(2, "entrega", [
      ["recebido", 0],
      ["em-preparo", 2],
      ["pronto", 20],
      ["saiu-para-entrega", 25],
      ["concluido", 41],
    ]),
    // 20h: retirada pronta em 39 min ainda está no prazo (a fila marca atrasado a partir de 40).
    comHistorico(
      3,
      "retirada",
      [
        ["recebido", 0],
        ["em-preparo", 5],
        ["pronto", 39],
        ["concluido", 70],
      ],
      {},
      new Date(2026, 10, 13, 20, 10),
    ),
  ]

  test("% dos pedidos concluídos dentro dos 40 minutos da fila", () => {
    const prazo = noPrazo(pedidos, PERIODO)
    expect(prazo).toMatchObject({ pedidos: 3, noPrazo: 2 })
    expect(prazo.percentual).toBeCloseTo(66.67, 2)
  })

  test("atrasados em cada hora do dia em que houve pedido", () => {
    expect(atrasosPorHora(pedidos, PERIODO)).toEqual([
      { hora: 19, pedidos: 2, atrasados: 1 },
      { hora: 20, pedidos: 1, atrasados: 0 },
    ])
  })
})

describe("cancelamentos", () => {
  const pedidos = [
    pedidoDeTeste(1, CRIADO, 50, { tipo: "entrega" }),
    pedidoDeTeste(2, CRIADO, 40, {
      tipo: "entrega",
      status: "cancelado",
      motivoCancelamento: "demora",
    }),
    pedidoDeTeste(3, CRIADO, 30, {
      tipo: "entrega",
      status: "cancelado",
      motivoCancelamento: "demora",
    }),
    pedidoDeTeste(4, CRIADO, 20, { tipo: "retirada", status: "cancelado" }),
    pedidoDeTeste(5, CRIADO, 60, { tipo: "retirada" }),
    pedidoDeTeste(6, CRIADO, 70, { tipo: "retirada" }),
    pedidoDeTeste(7, CRIADO, 80, { tipo: "retirada" }),
    // Ainda esperando o Pix: nem cancelado, nem válido; fica fora da conta.
    pedidoDeTeste(8, CRIADO, 90, { status: "aguardando-pagamento" }),
  ]

  test("a taxa sobre os pedidos do período, por motivo (sem motivo é Não informado) e por canal", () => {
    const resultado = cancelamentos(pedidos, PERIODO)
    expect(resultado.cancelados).toBe(3)
    expect(resultado.taxa).toBeCloseTo(42.86, 2)
    expect(resultado.porMotivo).toEqual([
      { motivo: "demora", pedidos: 2, total: 70 },
      { motivo: "nao-informado", pedidos: 1, total: 20 },
    ])
    expect(
      resultado.porCanal.map((canal) => [canal.tipo, canal.cancelados, canal.pedidos]),
    ).toEqual([
      ["entrega", 2, 3],
      ["retirada", 1, 4],
    ])
  })

  test("o pagamento online que nunca entrou: cancelado sem passar de aguardando pagamento", () => {
    const naoPago = pedidoDeTeste(9, CRIADO, 45, {
      status: "cancelado",
      historico: [
        { status: "aguardando-pagamento", em: CRIADO.toISOString() },
        { status: "cancelado", em: addMinutes(CRIADO, 30).toISOString() },
      ],
    })
    expect(cancelamentos([...pedidos, naoPago], PERIODO).onlineNaoPago).toEqual({
      pedidos: 1,
      total: 45,
    })
  })
})

describe("mesasDoPeriodo", () => {
  test("comandas fechadas, tempo médio da mesa aberta, ticket e as vendas de cada garçom", () => {
    const mesa = (id: number, total: number, minutos: number, garcom?: string) =>
      comHistorico(
        id,
        "mesa",
        [
          ["recebido", 0],
          ["em-preparo", 2],
          ["pronto", 20],
          ["concluido", minutos],
        ],
        { total, mesa: { id: `m${id}`, numero: id, ...(garcom ? { garcom } : {}) } },
      )
    const pedidos = [
      mesa(1, 120, 60, "Lucas"),
      mesa(2, 80, 90, "Paula"),
      mesa(3, 100, 120, "Lucas"),
      mesa(4, 40, 30),
      // Comanda aberta e entrega não entram.
      comHistorico(5, "mesa", [["recebido", 0]], { mesa: { id: "m5", numero: 5 } }),
      comHistorico(6, "entrega", [
        ["recebido", 0],
        ["concluido", 50],
      ]),
    ]
    expect(mesasDoPeriodo(pedidos, PERIODO)).toEqual({
      comandas: 4,
      minutosPorMesa: 75,
      ticket: 85,
      porGarcom: [
        { garcom: "Lucas", comandas: 2, total: 220 },
        { garcom: "Paula", comandas: 1, total: 80 },
        { garcom: "Sem garçom", comandas: 1, total: 40 },
      ],
    })
  })
})

describe("pontualidade", () => {
  test("atraso para começar, % que começou na hora (até 10 min) e duração real contra a marcada", () => {
    const marcado = new Date(2026, 10, 13, 10)
    const atendimento = (id: number, comecou: number, terminou: number, duracaoMin: number) =>
      comHistorico(
        id,
        "atendimento",
        [
          ["recebido", 0],
          ["em-preparo", 60 * 24 + comecou],
          ["concluido", 60 * 24 + terminou],
        ],
        { agendamento: { inicio: addMinutes(marcado, 0).toISOString(), duracaoMin } },
        // Marcado um dia antes, às 10h do dia 12.
        new Date(2026, 10, 12, 10),
      )
    const pedidos = [
      // Começou na hora e durou 60 dos 60 marcados.
      atendimento(1, 0, 60, 60),
      // Começou 20 min depois e durou 50 dos 30 marcados.
      atendimento(2, 20, 70, 30),
      // Começou 5 min antes: conta como sem atraso.
      atendimento(3, -5, 40, 45),
    ]
    expect(pontualidade(pedidos, PERIODO)).toEqual({
      atendimentos: 3,
      atrasoMedio: 7,
      naHora: 66.67,
      duracaoReal: 52,
      duracaoMarcada: 45,
    })
  })
})
