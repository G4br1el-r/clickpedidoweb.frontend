import { describe, expect, test } from "vitest"
import { pedidoDeTeste as pedido } from "../pedidos-de-teste"
import { destaquesDoSegmento, type EntradaDestaques } from "./segmento"

/** Sexta, 13/11/2026, 20:30. */
const AGORA = new Date(2026, 10, 13, 20, 30)

function entrada(mudancas: Partial<EntradaDestaques>): EntradaDestaques {
  return {
    segmento: "pizzaria",
    agora: AGORA,
    pedidos: [],
    lotes: [],
    receitas: [],
    decisoes: {},
    mesas: null,
    ...mudancas,
  }
}

const agendado = (id: number, inicio: Date, total: number) =>
  pedido(id, new Date(2026, 10, 10, 9), total, {
    tipo: "atendimento",
    status: "recebido",
    agendamento: { inicio: inicio.toISOString(), duracaoMin: 60 },
  })

describe("destaquesDoSegmento", () => {
  test("no salão, a agenda de hoje com o valor e quantos amanhã", () => {
    const pedidos = [
      agendado(1, new Date(2026, 10, 13, 10), 80),
      agendado(2, new Date(2026, 10, 13, 15), 120),
      agendado(3, new Date(2026, 10, 14, 9), 60),
    ]

    expect(destaquesDoSegmento(entrada({ segmento: "salao", pedidos }))).toEqual([
      {
        id: "agenda",
        rotulo: "Agenda de hoje",
        valor: 2,
        // O Intl separa o R$ com espaço não separável.
        detalhe: "R$ 200,00 · 1 amanhã",
        href: "/admin/agendamentos",
      },
    ])
  })

  test("na farmácia, as receitas a conferir e os lotes que vencem em 30 dias", () => {
    const receita = (id: string) => ({
      id,
      recebidaEm: AGORA.toISOString(),
      canal: "site" as const,
      paciente: { nome: "Ana", telefone: "12991230000" },
      prescritor: { nome: "Dr. Leo", conselho: "CRM" as const, numero: "123", uf: "SP" },
      tipo: "simples" as const,
      emitidaEm: "2026-11-10",
      itens: [],
    })
    const lote = (id: string, validade: string) => ({
      id,
      produtoId: "dipirona",
      codigo: id,
      validade,
      quantidade: 4,
      minimo: 1,
    })

    expect(
      destaquesDoSegmento(
        entrada({
          segmento: "farmacia",
          receitas: [receita("r1"), receita("r2")],
          decisoes: { r1: {} },
          lotes: [lote("l1", "2026-11-20"), lote("l2", "2027-06-01")],
        }),
      ),
    ).toEqual([
      { id: "receitas", rotulo: "Receitas a conferir", valor: 1, href: "/admin/receitas" },
      {
        id: "lotes",
        rotulo: "Lotes vencendo",
        valor: 1,
        detalhe: "Vencidos ou em até 30 dias",
        href: "/admin/validade",
      },
    ])
  })

  test("no açougue, a pesagem; onde há mesas, as ocupadas de quantas", () => {
    const porQuilo = {
      id: "picanha",
      produtoId: "picanha",
      nome: "Picanha",
      quantidade: 1,
      precoUnitario: 90,
      opcoes: [],
      total: 90,
      pesoGramas: 1000,
      precoKg: 90,
    }
    const pedidos = [
      pedido(1, AGORA, 90, {
        status: "recebido",
        pagamento: "pagar-apos-pesagem",
        itens: [porQuilo],
      }),
    ]
    const mesa = (numero: number, status: "livre" | "ocupada") => ({
      id: `m${numero}`,
      numero,
      nome: `Mesa ${numero}`,
      status,
    })
    const mesas = [mesa(1, "ocupada"), mesa(2, "livre"), mesa(3, "ocupada")]

    expect(destaquesDoSegmento(entrada({ segmento: "acougue", pedidos, mesas }))).toEqual([
      { id: "pesagem", rotulo: "Esperando pesagem", valor: 1, href: "/admin/fila" },
      {
        id: "mesas",
        rotulo: "Mesas ocupadas",
        valor: 2,
        detalhe: "De 3 mesas",
        href: "/admin/mesas",
      },
    ])
    expect(destaquesDoSegmento(entrada({ segmento: "pizzaria", mesas: [] }))).toEqual([
      {
        id: "mesas",
        rotulo: "Mesas ocupadas",
        valor: 0,
        detalhe: "De 0 mesas",
        href: "/admin/mesas",
      },
    ])
  })
})
