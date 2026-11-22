import { describe, expect, test } from "vitest"
import type {
  DadosMedicamento,
  Lote,
  MovimentoControlado,
  Produto,
  Receita,
} from "../../dados/tipos"
import { PERIODO_DE_TESTE as PERIODO, pedidoDeTeste } from "../pedidos-de-teste"
import {
  receitasPorCanal,
  saldoDosControlados,
  valorEmRisco,
  vendasPorTipoDeMedicamento,
} from "./farmacia"

const receita = (id: string, canal: Receita["canal"], recebidaEm: Date): Receita => ({
  id,
  recebidaEm: recebidaEm.toISOString(),
  canal,
  paciente: { nome: "Ana", telefone: "12991234567" },
  prescritor: { nome: "Dr. Paulo", conselho: "CRM", numero: "143278", uf: "SP" },
  tipo: "simples",
  emitidaEm: "2026-11-10",
  itens: [],
})

describe("receitasPorCanal", () => {
  test("recebidas no período por canal, com aprovadas, recusadas e as que esperam conferência", () => {
    const receitas = [
      receita("r1", "whatsapp", new Date(2026, 10, 12, 10)),
      receita("r2", "site", new Date(2026, 10, 12, 11)),
      receita("r3", "site", new Date(2026, 10, 13, 9)),
      receita("r4", "site", new Date(2026, 10, 13, 10)),
      // Fora do período.
      receita("r5", "balcao", new Date(2026, 10, 1, 10)),
    ]
    const decisoes = {
      r1: { situacao: "aprovada" },
      r2: { situacao: "aprovada" },
      r3: { situacao: "recusada" },
    }
    expect(receitasPorCanal(receitas, decisoes, PERIODO)).toEqual([
      { canal: "site", recebidas: 3, aprovadas: 1, recusadas: 1, aguardando: 1 },
      { canal: "whatsapp", recebidas: 1, aprovadas: 1, recusadas: 0, aguardando: 0 },
    ])
  })
})

const produto = (id: string, preco: number, medicamento?: Produto["medicamento"]): Produto => ({
  id,
  categoriaId: "c1",
  nome: id,
  descricao: "",
  preco,
  ativo: true,
  disponivel: true,
  destaque: false,
  oferta: false,
  ordem: 1,
  unidade: "un",
  grupos: [],
  ...(medicamento ? { medicamento } : {}),
})

const lote = (id: string, produtoId: string, validade: string, quantidade: number): Lote => ({
  id,
  produtoId,
  codigo: id,
  validade,
  quantidade,
  minimo: 1,
})

describe("valorEmRisco", () => {
  test("unidades e valor de venda dos lotes vencidos, que vencem em 30 dias e em 90 dias", () => {
    const agora = new Date(2026, 10, 13, 10)
    const produtos = [produto("dipirona", 10), produto("xarope", 25)]
    const lotes = [
      lote("l1", "dipirona", "2026-11-10", 4),
      lote("l2", "dipirona", "2026-12-01", 10),
      lote("l3", "xarope", "2026-12-13", 2),
      lote("l4", "xarope", "2027-01-20", 3),
      // Em dia e sem saldo ficam de fora.
      lote("l5", "xarope", "2027-08-01", 50),
      lote("l6", "dipirona", "2026-11-20", 0),
    ]
    expect(valorEmRisco(lotes, produtos, agora)).toEqual({
      vencidos: { lotes: 1, unidades: 4, valor: 40 },
      em30: { lotes: 2, unidades: 12, valor: 150 },
      em90: { lotes: 1, unidades: 3, valor: 75 },
    })
  })
})

const remedio = (tipo: DadosMedicamento["tipo"], lista?: DadosMedicamento["lista"]) => ({
  tarja: "vermelha" as const,
  tipo,
  principioAtivo: "x",
  apresentacao: "x",
  laboratorio: "x",
  registroMs: "1234567890123",
  ...(lista ? { lista } : {}),
})

describe("saldoDosControlados", () => {
  test("o saldo de cada produto de lista pela escrituração, em ordem de nome", () => {
    const produtos = [
      { ...produto("zolpidem", 30, remedio("referencia", "B1")), nome: "Zolpidem 10 mg" },
      { ...produto("clonazepam", 20, remedio("generico", "B1")), nome: "Clonazepam 2 mg" },
      // Sem lista: não é controlado.
      produto("dipirona", 10, remedio("generico")),
    ]
    const movimento = (
      produtoId: string,
      tipo: MovimentoControlado["tipo"],
      quantidade: number,
    ): MovimentoControlado => ({
      id: `${produtoId}-${tipo}-${quantidade}`,
      produtoId,
      em: "2026-11-10T10:00:00.000Z",
      tipo,
      quantidade,
      documento: "NF 1",
    })
    const movimentos = [
      movimento("clonazepam", "entrada", 30),
      movimento("clonazepam", "saida", 2),
      movimento("clonazepam", "perda", 1),
      movimento("zolpidem", "entrada", 10),
    ]
    expect(saldoDosControlados(movimentos, produtos)).toEqual([
      { produtoId: "clonazepam", nome: "Clonazepam 2 mg", lista: "B1", saldo: 27 },
      { produtoId: "zolpidem", nome: "Zolpidem 10 mg", lista: "B1", saldo: 10 },
    ])
  })
})

describe("vendasPorTipoDeMedicamento", () => {
  test("itens vendidos e faturamento de genérico, similar, referência e venda livre", () => {
    const produtos = [
      produto("losartana", 20, remedio("generico")),
      produto("dorflex", 15, remedio("referencia")),
      produto("protetor", 60),
    ]
    const item = (produtoId: string, quantidade: number, total: number) => ({
      id: produtoId,
      produtoId,
      nome: produtoId,
      quantidade,
      precoUnitario: total / quantidade,
      opcoes: [],
      total,
    })
    const dia = new Date(2026, 10, 13, 10)
    const pedidos = [
      pedidoDeTeste(1, dia, 100, { itens: [item("losartana", 2, 40), item("protetor", 1, 60)] }),
      pedidoDeTeste(2, dia, 55, { itens: [item("losartana", 2, 40), item("dorflex", 1, 15)] }),
      pedidoDeTeste(3, dia, 15, { status: "cancelado", itens: [item("dorflex", 1, 15)] }),
    ]
    expect(vendasPorTipoDeMedicamento(pedidos, produtos, PERIODO)).toEqual([
      { tipo: "generico", itens: 4, total: 80 },
      { tipo: "livre", itens: 1, total: 60 },
      { tipo: "referencia", itens: 1, total: 15 },
    ])
  })
})
