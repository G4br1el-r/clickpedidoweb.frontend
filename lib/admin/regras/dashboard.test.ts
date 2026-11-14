import { describe, expect, test } from "vitest"
import { resumir } from "./dashboard"
import {
  AGORA_DE_TESTE as AGORA,
  PEDIDOS_DE_TESTE as PEDIDOS,
  PERIODO_DE_TESTE as PERIODO,
} from "./pedidos-de-teste"

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
})
