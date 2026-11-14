import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns"
import type { FormaPagamento, Pedido, StatusPedido, TipoPedido } from "../dados/tipos"
import { diasNoPeriodo, type Periodo, periodoAnterior } from "./periodo"

export type DiaDaSerie = {
  data: Date
  faturamento: number
  pedidos: number
  hoje: boolean
  pico: boolean
}
export type Fatia<T> = { pedidos: number; total: number; percentual: number } & T
export type ProdutoVendido = { nome: string; quantidade: number; total: number }

export type Resumo = {
  hoje: {
    pedidos: number
    faturamento: number
    ticket: number
    emAndamento: number
    aguardandoPagamento: number
    cancelados: number
  }
  periodo: {
    faturamento: number
    pedidos: number
    ticket: number
    cancelados: number
    mediaPorDia: number
    faturamentoAnterior: number
    /** Variação % do faturamento sobre o período anterior; `null` sem vendas antes. */
    variacao: number | null
    melhorDia: { data: Date; faturamento: number; pedidos: number } | null
  }
  serie: DiaDaSerie[]
  pagamentos: Fatia<{ forma: FormaPagamento }>[]
  canais: Fatia<{ tipo: TipoPedido }>[]
  maisVendidos: { periodo: ProdutoVendido[]; hoje: ProdutoVendido[] }
  recentes: Pedido[]
}

const EM_ANDAMENTO: readonly StatusPedido[] = [
  "recebido",
  "em-preparo",
  "pronto",
  "saiu-para-entrega",
]

/** Venda que conta no faturamento: nem cancelada, nem esperando o pagamento online. */
export const ehValido = (pedido: Pedido) =>
  pedido.status !== "cancelado" && pedido.status !== "aguardando-pagamento"

const reais = (valor: number) => Math.round(valor * 100) / 100
const soma = (pedidos: Pedido[]) =>
  reais(pedidos.reduce((total, pedido) => total + pedido.total, 0))
const ticket = (pedidos: Pedido[]) => (pedidos.length ? reais(soma(pedidos) / pedidos.length) : 0)
const chaveDoDia = (data: Date) => format(data, "yyyy-MM-dd")

function noPeriodo(pedidos: Pedido[], { de, ate }: Periodo) {
  const inicio = startOfDay(de).getTime()
  const fim = endOfDay(ate).getTime()
  return pedidos.filter((pedido) => {
    const criado = Date.parse(pedido.criadoEm)
    return criado >= inicio && criado <= fim
  })
}

/** Agrupa e ordena do maior total para o menor (empate: mais pedidos). */
function fatias<K extends string>(pedidos: Pedido[], chave: (pedido: Pedido) => K) {
  const total = soma(pedidos)
  const grupos = new Map<K, Pedido[]>()
  for (const pedido of pedidos)
    grupos.set(chave(pedido), [...(grupos.get(chave(pedido)) ?? []), pedido])
  return [...grupos.entries()]
    .map(([valor, lista]) => ({
      valor,
      pedidos: lista.length,
      total: soma(lista),
      percentual: total ? (soma(lista) / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total || b.pedidos - a.pedidos)
}

function maisVendidos(pedidos: Pedido[], limite: number): ProdutoVendido[] {
  const produtos = new Map<string, ProdutoVendido>()
  for (const item of pedidos.flatMap((pedido) => pedido.itens)) {
    const atual = produtos.get(item.nome) ?? { nome: item.nome, quantidade: 0, total: 0 }
    produtos.set(item.nome, {
      ...atual,
      quantidade: atual.quantidade + item.quantidade,
      total: reais(atual.total + item.total),
    })
  }
  return [...produtos.values()]
    .sort((a, b) => b.quantidade - a.quantidade || b.total - a.total)
    .slice(0, limite)
}

/** Tudo o que a visão geral mostra, a partir dos pedidos do período e do anterior. */
export function resumir(pedidos: Pedido[], periodo: Periodo, agora: Date): Resumo {
  const doPeriodo = noPeriodo(pedidos, periodo)
  const validos = doPeriodo.filter(ehValido)
  const anteriores = noPeriodo(pedidos, periodoAnterior(periodo)).filter(ehValido)
  const deHoje = noPeriodo(pedidos, { de: agora, ate: agora })
  const validosHoje = deHoje.filter(ehValido)

  const faturamento = soma(validos)
  const faturamentoAnterior = soma(anteriores)

  const porDia = new Map<string, Pedido[]>()
  for (const pedido of validos) {
    const chave = chaveDoDia(new Date(pedido.criadoEm))
    porDia.set(chave, [...(porDia.get(chave) ?? []), pedido])
  }
  const dias = Array.from({ length: diasNoPeriodo(periodo) }, (_, indice) => {
    const data = addDays(startOfDay(periodo.de), indice)
    const lista = porDia.get(chaveDoDia(data)) ?? []
    return { data, faturamento: soma(lista), pedidos: lista.length }
  })
  const melhor = dias.reduce<(typeof dias)[number] | null>(
    (atual, dia) =>
      dia.faturamento > 0 &&
      (!atual ||
        dia.faturamento > atual.faturamento ||
        (dia.faturamento === atual.faturamento && dia.pedidos > atual.pedidos))
        ? dia
        : atual,
    null,
  )

  return {
    hoje: {
      pedidos: validosHoje.length,
      faturamento: soma(validosHoje),
      ticket: ticket(validosHoje),
      // Agendamento marcado para depois ainda não começou.
      emAndamento: pedidos.filter(
        (pedido) =>
          EM_ANDAMENTO.includes(pedido.status) &&
          !(pedido.agendamento && Date.parse(pedido.agendamento.inicio) > agora.getTime()),
      ).length,
      aguardandoPagamento: deHoje.filter((pedido) => pedido.status === "aguardando-pagamento")
        .length,
      cancelados: deHoje.filter((pedido) => pedido.status === "cancelado").length,
    },
    periodo: {
      faturamento,
      pedidos: validos.length,
      ticket: ticket(validos),
      cancelados: doPeriodo.filter((pedido) => pedido.status === "cancelado").length,
      mediaPorDia: validos.length / diasNoPeriodo(periodo),
      faturamentoAnterior,
      variacao:
        faturamentoAnterior > 0
          ? ((faturamento - faturamentoAnterior) / faturamentoAnterior) * 100
          : null,
      melhorDia: melhor,
    },
    serie: dias.map((dia) => ({ ...dia, hoje: isSameDay(dia.data, agora), pico: dia === melhor })),
    pagamentos: fatias(validos, (pedido) => pedido.pagamento).map(({ valor, ...resto }) => ({
      forma: valor,
      ...resto,
    })),
    canais: fatias(validos, (pedido) => pedido.tipo).map(({ valor, ...resto }) => ({
      tipo: valor,
      ...resto,
    })),
    maisVendidos: { periodo: maisVendidos(validos, 8), hoje: maisVendidos(validosHoje, 6) },
    recentes: doPeriodo
      .toSorted((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))
      .slice(0, 10),
  }
}
