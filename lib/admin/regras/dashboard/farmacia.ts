import { endOfDay, startOfDay } from "date-fns"
import type {
  Lote,
  MovimentoControlado,
  Pedido,
  Produto,
  Receita,
  TipoMedicamento,
} from "../../dados/tipos"
import { saldosControlados, situacaoDoLote } from "../farmacia"
import type { Periodo } from "../periodo"
import { ehValido, noPeriodo, reais } from "./comum"

const CANAIS: readonly Receita["canal"][] = ["site", "whatsapp", "balcao"]

/** A situação gravada pelo farmacêutico; sem decisão, a receita espera a conferência. */
type Decisoes = Record<string, { situacao: string } | undefined>

/** Receitas recebidas no período, por canal, com o que já foi aprovado, recusado ou espera. */
export function receitasPorCanal(receitas: Receita[], decisoes: Decisoes, { de, ate }: Periodo) {
  const inicio = startOfDay(de).getTime()
  const fim = endOfDay(ate).getTime()
  const doPeriodo = receitas.filter((receita) => {
    const quando = Date.parse(receita.recebidaEm)
    return quando >= inicio && quando <= fim
  })
  return CANAIS.flatMap((canal) => {
    const delas = doPeriodo.filter((receita) => receita.canal === canal)
    if (delas.length === 0) return []
    const contar = (situacao: string) =>
      delas.filter((receita) => decisoes[receita.id]?.situacao === situacao).length
    const aprovadas = contar("aprovada")
    const recusadas = contar("recusada")
    return [
      {
        canal,
        recebidas: delas.length,
        aprovadas,
        recusadas,
        aguardando: delas.length - aprovadas - recusadas,
      },
    ]
  })
}

type Risco = { lotes: number; unidades: number; valor: number }

/**
 * O estoque que pode se perder, pelo preço de venda: lotes com saldo já vencidos, que vencem
 * em até 30 dias e entre 31 e 90 dias.
 */
export function valorEmRisco(lotes: Lote[], produtos: Produto[], agora: Date) {
  const vazio = (): Risco => ({ lotes: 0, unidades: 0, valor: 0 })
  const riscos = { vencidos: vazio(), em30: vazio(), em90: vazio() }
  const faixa = { vencido: "vencidos", "vence-em-30": "em30", "vence-em-90": "em90" } as const
  for (const lote of lotes) {
    if (lote.quantidade <= 0) continue
    const { validade } = situacaoDoLote(lote, agora)
    if (validade === "em-dia") continue
    const preco = produtos.find((produto) => produto.id === lote.produtoId)?.preco ?? 0
    const risco = riscos[faixa[validade]]
    risco.lotes += 1
    risco.unidades += lote.quantidade
    risco.valor = reais(risco.valor + preco * lote.quantidade)
  }
  return riscos
}

/** O saldo de cada produto de lista (controlado ou antimicrobiano) pela escrituração. */
export function saldoDosControlados(movimentos: MovimentoControlado[], produtos: Produto[]) {
  const saldos = saldosControlados(movimentos)
  return produtos
    .flatMap((produto) =>
      produto.medicamento?.lista
        ? [
            {
              produtoId: produto.id,
              nome: produto.nome,
              lista: produto.medicamento.lista,
              saldo: saldos[produto.id] ?? 0,
            },
          ]
        : [],
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}

/** O tipo do medicamento, ou "livre" para o que não é medicamento (higiene, beleza). */
export type TipoDeVenda = TipoMedicamento | "livre"

/** Itens vendidos e faturamento de cada tipo de medicamento no período, do que mais vende ao que menos. */
export function vendasPorTipoDeMedicamento(
  pedidos: Pedido[],
  produtos: Produto[],
  periodo: Periodo,
) {
  const tipos = new Map<TipoDeVenda, { tipo: TipoDeVenda; itens: number; total: number }>()
  for (const pedido of noPeriodo(pedidos, periodo).filter(ehValido)) {
    for (const item of pedido.itens) {
      const tipo: TipoDeVenda =
        produtos.find((produto) => produto.id === item.produtoId)?.medicamento?.tipo ?? "livre"
      const atual = tipos.get(tipo) ?? { tipo, itens: 0, total: 0 }
      tipos.set(tipo, {
        tipo,
        itens: atual.itens + item.quantidade,
        total: reais(atual.total + item.total),
      })
    }
  }
  return [...tipos.values()].sort((a, b) => b.total - a.total || b.itens - a.itens)
}
