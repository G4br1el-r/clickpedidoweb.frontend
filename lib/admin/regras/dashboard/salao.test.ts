import { describe, expect, test } from "vitest"
import type { HorarioFuncionamento, Pedido } from "../../dados/tipos"
import { PERIODO_DE_TESTE as PERIODO, pedidoDeTeste } from "../pedidos-de-teste"
import {
  cancelamentosDaAgenda,
  ocupacaoDaAgenda,
  servicosMaisAgendados,
  vagosHojeEAmanha,
} from "./salao"

/** Aberto todos os dias, das 9h às 18h (540 minutos). */
const HORARIOS: HorarioFuncionamento[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
  dia,
  aberto: true,
  abre: "09:00",
  fecha: "18:00",
}))

/** Atendimento marcado para `inicio`, com a duração e o status dados. */
const atendimento = (
  id: number,
  inicio: Date,
  duracaoMin: number,
  mudancas: Partial<Pedido> = {},
): Pedido =>
  pedidoDeTeste(id, new Date(2026, 10, 1, 10), 80, {
    tipo: "atendimento",
    status: "recebido",
    origem: "painel",
    agendamento: { inicio: inicio.toISOString(), duracaoMin },
    ...mudancas,
  })

describe("ocupacaoDaAgenda", () => {
  test("minutos marcados sobre os minutos abertos vezes a capacidade, pelo dia do atendimento", () => {
    const pedidos = [
      atendimento(1, new Date(2026, 10, 12, 10), 240),
      atendimento(2, new Date(2026, 10, 13, 14), 300, { status: "concluido" }),
      // Cancelado e fora do período não ocupam.
      atendimento(3, new Date(2026, 10, 13, 9), 60, { status: "cancelado" }),
      atendimento(4, new Date(2026, 10, 14, 9), 60),
    ]
    // Dois dias de 540 min, com 2 cadeiras: 2.160 min; marcados 540.
    expect(ocupacaoDaAgenda(pedidos, { horarios: HORARIOS, capacidade: 2, periodo: PERIODO })).toEqual({
      marcados: 540,
      disponiveis: 2160,
      percentual: 25,
    })
  })
})

describe("vagosHojeEAmanha", () => {
  test("horários de 30 min ainda livres hoje (a partir de agora) e amanhã", () => {
    const agora = new Date(2026, 10, 13, 16)
    const pedidos = [
      // Hoje, das 16h30 às 17h30: sobram 16h e 17h30.
      atendimento(1, new Date(2026, 10, 13, 16, 30), 60),
      // Amanhã, das 10h às 11h: sobram 16 dos 18 horários.
      atendimento(2, new Date(2026, 10, 14, 10), 60),
      // Cancelado não ocupa.
      atendimento(3, new Date(2026, 10, 14, 15), 60, { status: "cancelado" }),
    ]
    expect(vagosHojeEAmanha(pedidos, { horarios: HORARIOS, capacidade: 1, agora })).toEqual({
      hoje: 2,
      amanha: 16,
    })
  })
})

const servico = (nome: string, total: number) => ({
  id: nome,
  produtoId: nome,
  nome,
  quantidade: 1,
  precoUnitario: total,
  opcoes: [],
  total,
})

describe("servicosMaisAgendados", () => {
  test("quantas vezes cada serviço foi marcado no período e quanto somou, sem os cancelados", () => {
    const pedidos = [
      atendimento(1, new Date(2026, 10, 12, 10), 60, {
        itens: [servico("Corte", 60), servico("Escova", 40)],
      }),
      atendimento(2, new Date(2026, 10, 13, 10), 60, { itens: [servico("Corte", 60)] }),
      atendimento(3, new Date(2026, 10, 13, 15), 60, {
        status: "cancelado",
        itens: [servico("Escova", 40)],
      }),
    ]
    expect(servicosMaisAgendados(pedidos, PERIODO)).toEqual([
      { nome: "Corte", vezes: 2, total: 120 },
      { nome: "Escova", vezes: 1, total: 40 },
    ])
  })
})

describe("cancelamentosDaAgenda", () => {
  test("dos marcados para o período, quantos cancelaram, a taxa e o valor que deixou de entrar", () => {
    const pedidos = [
      atendimento(1, new Date(2026, 10, 12, 10), 60),
      atendimento(2, new Date(2026, 10, 12, 14), 60, { status: "concluido" }),
      atendimento(3, new Date(2026, 10, 13, 10), 60, { status: "cancelado", total: 90 }),
      atendimento(4, new Date(2026, 10, 13, 11), 60, { status: "cancelado", total: 50 }),
      // Fora do período.
      atendimento(5, new Date(2026, 10, 20, 10), 60, { status: "cancelado" }),
    ]
    expect(cancelamentosDaAgenda(pedidos, PERIODO)).toEqual({
      marcados: 4,
      cancelados: 2,
      taxa: 50,
      perdido: 140,
    })
  })
})
