import { describe, expect, test } from "vitest"
import { indicadoresSalao } from "../indicadores-salao"
import {
  AGORA_DE_TESTE as AGORA,
  PEDIDOS_DE_TESTE as PEDIDOS,
  PERIODO_DE_TESTE as PERIODO,
  pedidoDeTeste,
} from "../pedidos-de-teste"
import { resumir } from "./resumo"

describe("resumir", () => {
  const resumo = resumir(PEDIDOS, PERIODO, AGORA)

  test("hoje: conta só pedidos válidos, mais os em andamento e aguardando pagamento", () => {
    expect(resumo.hoje).toEqual({
      pedidos: 2,
      faturamento: 90,
      ticket: 45,
      emAndamento: 1,
      aguardandoPagamento: 1,
      cancelados: 0,
    })
  })

  test("período: faturamento, pedidos, ticket, média e variação sobre o anterior", () => {
    expect(resumo.periodo).toMatchObject({
      faturamento: 170,
      pedidos: 4,
      ticket: 42.5,
      cancelados: 1,
      mediaPorDia: 2,
      faturamentoAnterior: 160,
      variacao: 6.25,
    })
  })

  test("o melhor dia é o de maior faturamento", () => {
    expect(resumo.periodo.melhorDia).toEqual({
      data: new Date(2026, 10, 13),
      faturamento: 90,
      pedidos: 2,
    })
  })

  test("a série tem todos os dias do período, com hoje e o pico marcados", () => {
    expect(resumo.serie).toEqual([
      { data: new Date(2026, 10, 12), faturamento: 80, pedidos: 2, hoje: false, pico: false },
      { data: new Date(2026, 10, 13), faturamento: 90, pedidos: 2, hoje: true, pico: true },
    ])
  })

  test("formas de pagamento e canais, do maior para o menor", () => {
    expect(resumo.pagamentos.map(({ forma, pedidos, total }) => [forma, pedidos, total])).toEqual([
      ["dinheiro", 2, 100],
      ["pix", 1, 50],
      ["cartao-na-entrega", 1, 20],
    ])
    expect(resumo.pagamentos[0].percentual).toBeCloseTo(58.82, 2)
    expect(resumo.canais.map(({ tipo, pedidos, total }) => [tipo, pedidos, total])).toEqual([
      ["entrega", 2, 70],
      ["mesa", 1, 70],
      ["retirada", 1, 30],
    ])
  })

  test("mais vendidos no período e hoje, pela quantidade", () => {
    expect(resumo.maisVendidos.periodo).toEqual([
      { nome: "Coca", quantidade: 4, total: 60 },
      { nome: "Calabresa", quantidade: 2, total: 80 },
      { nome: "Guaraná", quantidade: 1, total: 20 },
    ])
    expect(resumo.maisVendidos.hoje.map((produto) => produto.nome)).toEqual([
      "Coca",
      "Calabresa",
      "Guaraná",
    ])
  })

  test("os recentes são os pedidos do período, inclusive cancelados, do mais novo ao mais antigo", () => {
    expect(resumo.recentes.map((recente) => recente.id)).toEqual([6, 5, 4, 3, 2, 1])
  })

  test("agendamento marcado para depois não está em andamento", () => {
    const agendado = {
      ...PEDIDOS[5],
      id: 9,
      tipo: "atendimento" as const,
      status: "recebido" as const,
      agendamento: { inicio: new Date(2026, 10, 14, 10).toISOString(), duracaoMin: 60 },
    }
    const comAgendamento = resumir([...PEDIDOS, agendado], PERIODO, AGORA)
    expect(comAgendamento.hoje.emAndamento).toBe(1)
  })

  test("sem vendas antes, a variação fica em branco", () => {
    const semAnterior = resumir(
      PEDIDOS.filter((p) => p.id < 7),
      PERIODO,
      AGORA,
    )
    expect(semAnterior.periodo.variacao).toBeNull()
  })

  test("período sem nenhuma venda: tudo zerado e sem melhor dia", () => {
    const vazio = resumir([], PERIODO, AGORA)
    expect(vazio.periodo).toMatchObject({ faturamento: 0, pedidos: 0, ticket: 0, melhorDia: null })
    expect(vazio.pagamentos).toEqual([])
    expect(vazio.serie.every((dia) => dia.faturamento === 0 && !dia.pico)).toBe(true)
  })

  test("conta paga em duas formas: cada parte soma na sua forma, e a taxa aparece separada", () => {
    const item = {
      id: "i1",
      produtoId: "p",
      nome: "Pizza",
      quantidade: 1,
      precoUnitario: 100,
      opcoes: [],
      total: 100,
    }
    const misto = pedidoDeTeste(20, new Date(2026, 10, 13, 19), 110, {
      tipo: "mesa",
      pagamento: "dinheiro",
      itens: [item],
      taxaServico: { percentual: 10 },
      pagoEm: new Date(2026, 10, 13, 20).toISOString(),
      pagamentos: [
        { id: "p1", forma: "pix", valor: 40, em: "" },
        { id: "p2", forma: "dinheiro", valor: 70, em: "" },
      ],
    })
    const resumo = resumir(
      [misto, pedidoDeTeste(21, new Date(2026, 10, 13, 19), 30)],
      PERIODO,
      AGORA,
    )
    expect(resumo.pagamentos.map(({ forma, pedidos, total }) => [forma, pedidos, total])).toEqual([
      // Empate no total: vem antes a forma com mais pedidos.
      ["pix", 2, 70],
      ["dinheiro", 1, 70],
    ])
    expect(resumo.pagamentos[0].percentual).toBeCloseTo(50, 2)
    expect(resumo.taxaServico).toBe(10)
    expect(resumir(PEDIDOS, PERIODO, AGORA).taxaServico).toBe(0)
  })

  describe("taxa de serviço (Q34): é do garçom, e não da casa", () => {
    const pizza = {
      id: "i1",
      produtoId: "p",
      nome: "Pizza",
      quantidade: 1,
      precoUnitario: 100,
      opcoes: [],
      total: 100,
    }
    /** Conta de mesa de R$ 110,00 (100 + 10% de taxa), aberta e paga em `dia`. */
    const contaDeMesa = (id: number, criada: Date, paga?: Date) =>
      pedidoDeTeste(id, criada, 110, {
        tipo: "mesa",
        mesa: { id: "mesa-1", numero: 1, pessoas: 2 },
        itens: [pizza],
        subtotal: 100,
        taxaServico: { percentual: 10 },
        ...(paga
          ? {
              pagoEm: paga.toISOString(),
              pagamentos: [
                { id: `p${id}`, forma: "pix" as const, valor: 110, em: paga.toISOString() },
              ],
            }
          : { status: "pronto" as const, situacaoPagamento: "na-entrega" as const }),
      })

    test("o faturamento, o ticket, a série e o melhor dia ficam sem a taxa", () => {
      const hoje = new Date(2026, 10, 13, 19)
      const resumo = resumir(
        [contaDeMesa(20, hoje, hoje), pedidoDeTeste(21, hoje, 30)],
        PERIODO,
        AGORA,
      )
      expect(resumo.hoje).toMatchObject({ pedidos: 2, faturamento: 130, ticket: 65 })
      expect(resumo.periodo).toMatchObject({ faturamento: 130, ticket: 65 })
      expect(resumo.periodo.melhorDia).toMatchObject({ faturamento: 130 })
      expect(resumo.serie.at(-1)).toMatchObject({ faturamento: 130 })
      expect(resumo.canais.map(({ tipo, total }) => [tipo, total])).toEqual([
        ["mesa", 100],
        ["retirada", 30],
      ])
      // As formas mostram o que entrou no caixa, com a taxa.
      expect(resumo.pagamentos.map(({ forma, total }) => [forma, total])).toEqual([["pix", 140]])
    })

    test("o bloco da taxa soma só as contas pagas, pelo dia do pagamento", () => {
      const pagas = resumir(
        [
          // Aberta às 23:40 do dia 11 e paga às 00:10 do dia 12: entra no período.
          contaDeMesa(30, new Date(2026, 10, 11, 23, 40), new Date(2026, 10, 12, 0, 10)),
          contaDeMesa(31, new Date(2026, 10, 13, 19), new Date(2026, 10, 13, 20)),
        ],
        PERIODO,
        AGORA,
      )
      expect(pagas.taxaServico).toBe(20)
      // Ainda aberta: a taxa não foi paga.
      expect(
        resumir([contaDeMesa(32, new Date(2026, 10, 13, 19))], PERIODO, AGORA).taxaServico,
      ).toBe(0)
    })

    test("o Início e a tela de Mesas dão o mesmo faturamento do salão no dia", () => {
      const hoje = new Date(2026, 10, 13, 19)
      const conta = contaDeMesa(40, hoje, new Date(2026, 10, 13, 20))
      const resumo = resumir([conta], PERIODO, AGORA)
      const salao = indicadoresSalao({ mesas: [], abertas: [], concluidos: [conta], agora: AGORA })
      expect(resumo.hoje.faturamento).toBe(100)
      expect(salao.faturamento).toBe(100)
    })
  })
})
