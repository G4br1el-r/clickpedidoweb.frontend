import { describe, expect, test } from "vitest"
import type { ItemPedido, Pedido, Praca, Produto } from "../dados/tipos"
import {
  numerosDoPeriodo,
  porHora,
  porPraca,
  porTipo,
  produtosDemorados,
  resumoDoTurno,
} from "./desempenho"

const AGORA = new Date(2026, 10, 13, 21, 0)
const TEMPOS = { atencaoMin: 15, atrasoMin: 25, prontoFicaMin: 15 }
const as = (hora: string, dia = 13) => {
  const [h, m] = hora.split(":").map(Number)
  return new Date(2026, 10, dia, h, m).toISOString()
}

const item = (nome: string, extra: Partial<ItemPedido> = {}): ItemPedido => ({
  id: nome,
  produtoId: nome,
  nome,
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
    historico: [],
    ...extra,
  }
}

describe("resumoDoTurno", () => {
  test("tempo médio até pronto, prontos de hoje, atrasados agora e o item mais pedido", () => {
    const pedidos = [
      pedido({
        criadoEm: as("19:00"),
        itens: [item("Pizza", { quantidade: 2, feitoEm: as("19:10") })],
      }),
      pedido({ criadoEm: as("19:30"), itens: [item("Pizza", { feitoEm: as("19:50") })] }),
      pedido({
        criadoEm: as("20:00"),
        itens: [item("Coca", { quantidade: 2, feitoEm: as("20:12") })],
      }),
      // Ainda no quadro desde 20:20: 40 min, atrasado.
      pedido({
        status: "em-preparo",
        criadoEm: as("20:20"),
        itens: [item("Lasanha", { iniciadoEm: as("20:25") })],
      }),
      // Ontem e cancelado não contam.
      pedido({
        criadoEm: as("20:00", 12),
        itens: [item("Pizza", { quantidade: 9, feitoEm: as("20:10", 12) })],
      }),
      pedido({ status: "cancelado", itens: [item("Pizza", { quantidade: 9 })] }),
    ]
    expect(resumoDoTurno(pedidos, AGORA, TEMPOS)).toEqual({
      // (10 + 20 + 12) / 3 = 14
      tempoMedioMin: 14,
      prontos: 3,
      atrasadosAgora: 1,
      maisPedido: { nome: "Pizza", quantidade: 3 },
    })
  })

  test("sem nada hoje, os números ficam vazios", () => {
    expect(resumoDoTurno([], AGORA, TEMPOS)).toEqual({
      tempoMedioMin: null,
      prontos: 0,
      atrasadosAgora: 0,
      maisPedido: null,
    })
  })
})

describe("numerosDoPeriodo", () => {
  test("tempo médio, % no prazo, tickets, retrabalho e cancelados depois de iniciar, nos dias do período", () => {
    const pedidos = [
      // Dia 12: 10 min. Dia 13: 30 min (atrasado) e 20 min.
      pedido({ criadoEm: as("20:00", 12), itens: [item("Pizza", { feitoEm: as("20:10", 12) })] }),
      pedido({ criadoEm: as("19:00"), itens: [item("Pizza", { feitoEm: as("19:30") })] }),
      pedido({
        criadoEm: as("19:30"),
        itens: [item("Coca", { feitoEm: as("19:50") })],
        refacoes: [
          {
            numero: 1,
            rodada: 1,
            motivo: "caiu",
            em: as("20:00"),
            itens: [item("Coca~r1", { feitoEm: as("20:05") })],
          },
        ],
      }),
      pedido({
        status: "cancelado",
        criadoEm: as("20:10"),
        itens: [item("Lasanha", { iniciadoEm: as("20:12") })],
      }),
      pedido({ status: "cancelado", criadoEm: as("20:15"), itens: [item("Lasanha")] }),
      // Fora do período.
      pedido({ criadoEm: as("20:00", 10), itens: [item("Pizza", { feitoEm: as("21:30", 10) })] }),
    ]
    expect(
      numerosDoPeriodo(
        pedidos,
        { de: new Date(2026, 10, 12), ate: new Date(2026, 10, 13) },
        {
          agora: AGORA,
          tempos: TEMPOS,
        },
      ),
    ).toEqual({
      tickets: 3,
      tempoMedioMin: 20,
      noPrazoPct: 67,
      refeitos: 1,
      retrabalhoPct: 33,
      canceladosDepoisDeIniciar: 1,
    })
  })
})

const HOJE = { de: new Date(2026, 10, 13), ate: new Date(2026, 10, 13) }

describe("porHora", () => {
  test("tickets e tempo médio pela hora da chegada, só nas horas com movimento", () => {
    const pedidos = [
      pedido({ criadoEm: as("19:05"), itens: [item("Pizza", { feitoEm: as("19:15") })] }),
      pedido({ criadoEm: as("19:40"), itens: [item("Pizza", { feitoEm: as("20:10") })] }),
      pedido({
        criadoEm: as("20:10"),
        itens: [item("Pizza", { iniciadoEm: as("20:12") })],
        status: "em-preparo",
      }),
    ]
    expect(porHora(pedidos, HOJE, { agora: AGORA, tempos: TEMPOS })).toEqual([
      { hora: 19, tickets: 2, tempoMedioMin: 20 },
      { hora: 20, tickets: 1, tempoMedioMin: null },
    ])
  })
})

describe("porTipo e porPraca", () => {
  test("tempo médio e tickets por tipo de pedido, na ordem mesa, entrega, retirada", () => {
    const pedidos = [
      pedido({
        tipo: "mesa",
        mesa: { id: "m", numero: 1 },
        itens: [item("Pizza", { feitoEm: as("20:16") })],
      }),
      pedido({ tipo: "entrega", itens: [item("Pizza", { feitoEm: as("20:10") })] }),
      pedido({ tipo: "entrega", itens: [item("Pizza", { feitoEm: as("20:20") })] }),
    ]
    expect(porTipo(pedidos, HOJE, { agora: AGORA, tempos: TEMPOS })).toEqual([
      { tipo: "mesa", tickets: 1, tempoMedioMin: 16 },
      { tipo: "entrega", tickets: 2, tempoMedioMin: 15 },
    ])
  })

  test("cada praça conta da chegada até o último item dela riscado", () => {
    const praca = (id: string, nome: string, categoriaIds: string[]): Praca => ({
      id,
      nome,
      cor: "ambar",
      categoriaIds,
      imprime: true,
      tocaSom: true,
    })
    const pracas = [praca("forno", "Forno", ["pizzas"]), praca("bar", "Bar", ["bebidas"])]
    const produtos = [
      { id: "Pizza", categoriaId: "pizzas" },
      { id: "Coca", categoriaId: "bebidas" },
    ] as Produto[]
    const pedidos = [
      pedido({
        itens: [item("Pizza", { feitoEm: as("20:20") }), item("Coca", { feitoEm: as("20:02") })],
      }),
      pedido({ itens: [item("Pizza", { feitoEm: as("20:10") })] }),
    ]
    expect(porPraca(pedidos, HOJE, { agora: AGORA, tempos: TEMPOS, produtos, pracas })).toEqual([
      { id: "forno", nome: "Forno", tickets: 2, tempoMedioMin: 15 },
      { id: "bar", nome: "Bar", tickets: 1, tempoMedioMin: 2 },
    ])
  })
})

describe("produtosDemorados", () => {
  test("média da chegada até o item riscado, do mais demorado para o menos, até cinco", () => {
    const pedidos = [
      pedido({
        itens: [
          item("Pizza", { feitoEm: as("20:30") }),
          item("Coca", { feitoEm: as("20:02") }),
          item("Lasanha", { feitoEm: as("20:20") }),
        ],
      }),
      pedido({
        itens: [item("Pizza", { feitoEm: as("20:20") }), item("A", { feitoEm: as("20:01") })],
      }),
      pedido({ itens: [item("B", { feitoEm: as("20:03") }), item("C", { feitoEm: as("20:04") })] }),
    ]
    expect(produtosDemorados(pedidos, HOJE, { agora: AGORA, tempos: TEMPOS })).toEqual([
      { produtoId: "Pizza", nome: "Pizza", vezes: 2, tempoMedioMin: 25 },
      { produtoId: "Lasanha", nome: "Lasanha", vezes: 1, tempoMedioMin: 20 },
      { produtoId: "C", nome: "C", vezes: 1, tempoMedioMin: 4 },
      { produtoId: "B", nome: "B", vezes: 1, tempoMedioMin: 3 },
      { produtoId: "Coca", nome: "Coca", vezes: 1, tempoMedioMin: 2 },
    ])
  })
})
